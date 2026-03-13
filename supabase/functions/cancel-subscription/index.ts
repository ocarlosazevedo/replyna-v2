/**
 * Edge Function: Cancel Subscription (Asaas)
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { deleteSubscription as asaasDeleteSubscription } from '../_shared/asaas.ts';

interface CancelRequest {
  user_id: string;
  reason?: string | null;
}

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, reason } = (await req.json()) as CancelRequest;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id e obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_trial')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, asaas_subscription_id')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar assinatura' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (user.is_trial === true) {
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({
          status: 'inactive',
          emails_limit: 0,
          shops_limit: 0,
        })
        .eq('id', user_id);

      if (userUpdateError) {
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar usuario' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (reason && subscription) {
        await supabase
          .from('subscriptions')
          .update({ cancel_reason: reason })
          .eq('id', subscription.id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscription) {
      return new Response(
        JSON.stringify({ error: 'Assinatura nao encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (subscription.asaas_subscription_id) {
      try {
        await asaasDeleteSubscription(subscription.asaas_subscription_id);
      } catch (err) {
        console.error('Erro ao cancelar assinatura no Asaas:', err);
      }
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      cancel_at_period_end: true,
      canceled_at: now,
      updated_at: now,
    };

    if (reason) {
      updateData.cancel_reason = reason;
    }

    await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscription.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
