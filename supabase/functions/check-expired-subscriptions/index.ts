/**
 * Edge Function: Check Expired Subscriptions
 *
 * Verifica usuários ativos cujo período de assinatura expirou
 * e suspende automaticamente quem não renovou.
 *
 * Executada via pg_cron a cada hora.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date().toISOString();

    // Buscar usuários ativos com subscription expirada
    // Junta users + subscriptions para encontrar quem tem period_end no passado
    const { data: expiredSubs, error: subError } = await supabase
      .from('subscriptions')
      .select('id, user_id, status, current_period_end')
      .in('status', ['active', 'trialing'])
      .lt('current_period_end', now);

    if (subError) {
      console.error('[CheckExpired] Erro ao buscar subscriptions expiradas:', subError.message);
      return new Response(JSON.stringify({ error: subError.message }), { status: 500 });
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      console.log('[CheckExpired] Nenhuma subscription expirada encontrada');
      return new Response(JSON.stringify({ suspended: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let suspendedCount = 0;

    for (const sub of expiredSubs) {
      // Verificar se o usuário ainda está ativo
      const { data: user } = await supabase
        .from('users')
        .select('id, email, name, status')
        .eq('id', sub.user_id)
        .single();

      if (!user || user.status !== 'active') {
        continue;
      }

      // Suspender subscription
      const { error: subUpdateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          updated_at: now,
        })
        .eq('id', sub.id);

      if (subUpdateError) {
        console.error(`[CheckExpired] Erro ao atualizar subscription ${sub.id}:`, subUpdateError.message);
        continue;
      }

      // Suspender usuário
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({
          status: 'suspended',
          updated_at: now,
        })
        .eq('id', sub.user_id);

      if (userUpdateError) {
        console.error(`[CheckExpired] Erro ao suspender usuario ${sub.user_id}:`, userUpdateError.message);
        continue;
      }

      suspendedCount++;
      console.log(
        `[CheckExpired] Usuario suspenso: ${user.name || user.email} (${user.email}) - ` +
        `periodo expirou em ${sub.current_period_end}`
      );
    }

    console.log(`[CheckExpired] Total suspensos: ${suspendedCount} de ${expiredSubs.length} expirados`);

    return new Response(
      JSON.stringify({
        checked: expiredSubs.length,
        suspended: suspendedCount,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[CheckExpired] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
