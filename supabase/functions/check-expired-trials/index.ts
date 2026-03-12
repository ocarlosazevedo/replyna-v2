/**
 * Edge Function: Check Expired Trials
 *
 * Marca como 'expired' trials que passaram do prazo
 * ou atingiram o limite de emails.
 * Executada via pg_cron diariamente.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();

    const { data: trialUsers, error } = await supabase
      .from('users')
      .select('id, email, status, is_trial, emails_used, emails_limit, trial_ends_at')
      .eq('is_trial', true)
      .eq('status', 'active');

    if (error) {
      console.error('[CheckExpiredTrials] Erro ao buscar trials:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!trialUsers || trialUsers.length === 0) {
      return new Response(JSON.stringify({ expired: 0 }), { status: 200 });
    }

    const expiredUsers = trialUsers.filter((u) => {
      const endsAt = u.trial_ends_at ? new Date(u.trial_ends_at) : null;
      const expiredByTime = endsAt ? endsAt.getTime() < now.getTime() : false;
      const limit = typeof u.emails_limit === 'number' ? u.emails_limit : null;
      const used = u.emails_used ?? 0;
      const expiredByCredits = limit !== null ? used >= limit : false;
      return expiredByTime || expiredByCredits;
    });

    if (expiredUsers.length === 0) {
      return new Response(JSON.stringify({ expired: 0 }), { status: 200 });
    }

    const ids = expiredUsers.map(u => u.id);

    const { error: updateError } = await supabase
      .from('users')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .in('id', ids);

    if (updateError) {
      console.error('[CheckExpiredTrials] Erro ao atualizar usuarios:', updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    console.log(`[CheckExpiredTrials] Marcados como expired: ${expiredUsers.length}`);

    return new Response(
      JSON.stringify({ expired: expiredUsers.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CheckExpiredTrials] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
