/**
 * Edge Function: fetch-emails (Ingestion Worker)
 *
 * Responsável apenas por buscar emails via IMAP e enfileirar para processamento.
 * Separação de concerns: ingestion != processing
 *
 * Chamado via pg_cron a cada 5 minutos
 *
 * Fluxo:
 * 1. Busca lojas ativas com email configurado
 * 2. Para cada loja:
 *    - Fetch unread emails via IMAP (limit 50)
 *    - Salva em messages table (com dedup via message_id)
 *    - Enfileira job em job_queue
 * 3. Retorna estatísticas
 */

// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import {
  getSupabaseClient,
  getActiveShopsWithEmail,
  type Shop,
} from '../_shared/supabase.ts';
import { decryptEmailCredentials, fetchUnreadEmails } from '../_shared/email.ts';

// Configuration
const MAX_CONCURRENT_SHOPS = 10; // Process 10 shops in parallel
const MAX_EMAILS_PER_SHOP = 50; // Fetch up to 50 unread emails per shop
const MAX_EXECUTION_TIME_MS = 110000; // 110 seconds (Edge Function limit is 120s)

interface IncomingEmail {
  message_id: string;
  from_email: string;
  from_name: string;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string;
  in_reply_to?: string;
  references?: string;
  received_at: string;
}

interface ShopResult {
  shop_id: string;
  shop_name: string;
  emails_fetched: number;
  jobs_enqueued: number;
  errors: number;
  error_message?: string;
}

interface FetchResult {
  success: boolean;
  execution_time_ms: number;
  shops_processed: number;
  total_emails_fetched: number;
  total_jobs_enqueued: number;
  total_errors: number;
  shop_results: ShopResult[];
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  try {
    console.log('[Ingestion] Starting email fetch cycle');

    // Get all active shops with email configured
    const shops = await getActiveShopsWithEmail();
    console.log(`[Ingestion] Found ${shops.length} active shops with email`);

    if (shops.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          execution_time_ms: Date.now() - startTime,
          shops_processed: 0,
          total_emails_fetched: 0,
          total_jobs_enqueued: 0,
          total_errors: 0,
          shop_results: [],
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process shops in batches
    const shopResults: ShopResult[] = [];
    let totalEmailsFetched = 0;
    let totalJobsEnqueued = 0;
    let totalErrors = 0;

    for (let i = 0; i < shops.length; i += MAX_CONCURRENT_SHOPS) {
      // Check timeout
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log('[Ingestion] Approaching timeout, stopping batch processing');
        break;
      }

      const batch = shops.slice(i, i + MAX_CONCURRENT_SHOPS);
      console.log(`[Ingestion] Processing batch ${Math.floor(i / MAX_CONCURRENT_SHOPS) + 1}: ${batch.length} shops`);

      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map((shop) => processShop(shop, supabase))
      );

      // Collect results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          shopResults.push(result.value);
          totalEmailsFetched += result.value.emails_fetched;
          totalJobsEnqueued += result.value.jobs_enqueued;
          totalErrors += result.value.errors;
        } else {
          console.error('[Ingestion] Shop processing failed:', result.reason);
          totalErrors++;
        }
      }
    }

    const executionTime = Date.now() - startTime;
    const response: FetchResult = {
      success: true,
      execution_time_ms: executionTime,
      shops_processed: shopResults.length,
      total_emails_fetched: totalEmailsFetched,
      total_jobs_enqueued: totalJobsEnqueued,
      total_errors: totalErrors,
      shop_results: shopResults,
    };

    console.log('[Ingestion] Cycle complete:', {
      shops_processed: response.shops_processed,
      emails_fetched: response.total_emails_fetched,
      jobs_enqueued: response.total_jobs_enqueued,
      errors: response.total_errors,
      execution_time_ms: executionTime,
    });

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Ingestion] Fatal error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        execution_time_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Process a single shop: fetch emails + enqueue jobs
 */
async function processShop(shop: Shop, supabase: any): Promise<ShopResult> {
  const shopResult: ShopResult = {
    shop_id: shop.id,
    shop_name: shop.name,
    emails_fetched: 0,
    jobs_enqueued: 0,
    errors: 0,
  };

  try {
    console.log(`[Shop:${shop.name}] Starting email fetch`);

    // Decrypt email credentials
    const emailCredentials = await decryptEmailCredentials(shop);

    if (!emailCredentials) {
      console.error(`[Shop:${shop.name}] Failed to decrypt email credentials`);
      shopResult.errors++;
      shopResult.error_message = 'Failed to decrypt email credentials';
      return shopResult;
    }

    // Calculate IMAP start date based on shop's email_start_mode
    let emailStartDate: Date;
    if (shop.email_start_mode === 'from_integration_date' && shop.email_start_date) {
      // Use shop's integration date - only fetch emails after this date
      emailStartDate = new Date(shop.email_start_date);
      console.log(`[Shop:${shop.name}] Using integration date filter: ${emailStartDate.toISOString()}`);
    } else {
      // Default: fetch emails from last 7 days
      emailStartDate = new Date();
      emailStartDate.setDate(emailStartDate.getDate() - 7);
      console.log(`[Shop:${shop.name}] Using default 7-day filter: ${emailStartDate.toISOString()}`);
    }

    // Fetch unread emails via IMAP
    let incomingEmails: IncomingEmail[] = [];
    try {
      incomingEmails = await fetchUnreadEmails(
        emailCredentials,
        MAX_EMAILS_PER_SHOP,
        emailStartDate
      );
      console.log(`[Shop:${shop.name}] Fetched ${incomingEmails.length} unread emails`);
      shopResult.emails_fetched = incomingEmails.length;
    } catch (error: any) {
      console.error(`[Shop:${shop.name}] IMAP fetch failed:`, error.message);
      shopResult.errors++;
      shopResult.error_message = `IMAP error: ${error.message}`;
      // Don't throw - continue to next shop
      return shopResult;
    }

    // Process each email: save + enqueue
    for (const email of incomingEmails) {
      try {
        await saveAndEnqueueEmail(email, shop, supabase);
        shopResult.jobs_enqueued++;
      } catch (error: any) {
        console.error(`[Shop:${shop.name}] Failed to save/enqueue email ${email.message_id}:`, error.message);
        shopResult.errors++;
      }
    }

    // Update shop last sync timestamp
    await updateShopEmailSync(shop.id, supabase);

    console.log(`[Shop:${shop.name}] Completed: ${shopResult.jobs_enqueued} jobs enqueued, ${shopResult.errors} errors`);
    return shopResult;
  } catch (error: any) {
    console.error(`[Shop:${shop.name}] Unexpected error:`, error);
    shopResult.errors++;
    shopResult.error_message = error.message;
    return shopResult;
  }
}

/**
 * Save incoming email to messages table + enqueue processing job
 */
async function saveAndEnqueueEmail(
  email: IncomingEmail,
  shop: Shop,
  supabase: any
): Promise<void> {
  // Check if email already exists (deduplication via message_id)
  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('message_id', email.message_id)
    .single();

  if (existing) {
    console.log(`[Shop:${shop.name}] Email ${email.message_id} already exists, skipping`);
    return;
  }

  // Get or create conversation (using existing RPC function)
  const { data: conversation, error: convError } = await supabase.rpc(
    'get_or_create_conversation',
    {
      p_shop_id: shop.id,
      p_customer_email: email.from_email,
      p_subject: email.subject,
      p_in_reply_to: email.in_reply_to || null,
      p_references: email.references || null,
    }
  );

  if (convError || !conversation || conversation.length === 0) {
    throw new Error(`Failed to get/create conversation: ${convError?.message || 'Unknown error'}`);
  }

  // A RPC retorna um array de rows, pegamos o primeiro
  const conversationData = conversation[0];

  // Insert message
  const { data: savedMessage, error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationData.id,
      message_id: email.message_id,
      from_email: email.from_email,
      from_name: email.from_name,
      to_email: email.to_email,
      subject: email.subject,
      body_text: email.body_text,
      body_html: email.body_html,
      in_reply_to: email.in_reply_to || null,
      references_header: email.references || null,
      direction: 'inbound',
      status: 'pending',
      received_at: email.received_at,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (messageError || !savedMessage) {
    throw new Error(`Failed to save message: ${messageError?.message || 'Unknown error'}`);
  }

  // Enqueue processing job using RPC function
  const { data: jobId, error: jobError } = await supabase.rpc('enqueue_job', {
    p_job_type: 'process_email',
    p_shop_id: shop.id,
    p_message_id: savedMessage.id,
    p_payload: {
      conversation_id: conversationData.id,
      from_email: email.from_email,
      subject: email.subject,
    },
    p_priority: 0, // Normal priority
    p_max_attempts: 5,
  });

  if (jobError) {
    console.error(`[Shop:${shop.name}] Failed to enqueue job for message ${savedMessage.id}:`, jobError);
    // Don't throw - message is saved, can be manually enqueued later
  } else {
    console.log(`[Shop:${shop.name}] Enqueued job ${jobId} for message ${savedMessage.id}`);
  }
}

/**
 * Update shop's last email sync timestamp
 */
async function updateShopEmailSync(shopId: string, supabase: any): Promise<void> {
  const { error } = await supabase
    .from('shops')
    .update({ last_email_sync: new Date().toISOString() })
    .eq('id', shopId);

  if (error) {
    console.error(`Failed to update shop email sync timestamp:`, error);
  }
}
