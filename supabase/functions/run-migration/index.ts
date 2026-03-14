import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Connect directly to Postgres
  const { Client } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts');

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_DB_URL not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const client = new Client(dbUrl);
  try {
    await client.connect();
    await client.queryObject('ALTER TABLE shops ADD COLUMN IF NOT EXISTS pending_backfill boolean DEFAULT false;');
    await client.end();

    return new Response(
      JSON.stringify({ success: true, message: 'Column pending_backfill added to shops' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    try { await client.end(); } catch {}
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
