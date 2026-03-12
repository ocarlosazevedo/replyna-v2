/**
 * Edge Function: Admin Partner Withdrawal
 *
 * Admin aprova, rejeita ou marca como pago um saque de partner.
 * POST - Usa service role key.
 *
 * Body: { withdrawal_id, action: 'approve' | 'reject' | 'paid', admin_notes? }
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { withdrawal_id, action, admin_notes, admin_id } = body;

    if (!withdrawal_id || !action) {
      return new Response(
        JSON.stringify({ error: 'withdrawal_id e action são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['approve', 'reject', 'paid'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'action deve ser: approve, reject ou paid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar withdrawal
    const { data: withdrawal } = await supabase
      .from('partner_withdrawals')
      .select('*')
      .eq('id', withdrawal_id)
      .single();

    if (!withdrawal) {
      return new Response(
        JSON.stringify({ error: 'Saque não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      if (withdrawal.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: 'Saque não está pendente' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('partner_withdrawals')
        .update({
          status: 'approved',
          reviewed_by: admin_id || null,
          reviewed_at: now,
          admin_notes: admin_notes || null,
        })
        .eq('id', withdrawal_id);

    } else if (action === 'reject') {
      if (withdrawal.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: 'Saque não está pendente' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Devolver saldo ao partner
      const { data: partner } = await supabase
        .from('partners')
        .select('available_balance')
        .eq('id', withdrawal.partner_id)
        .single();

      if (partner) {
        await supabase
          .from('partners')
          .update({
            available_balance: Number(partner.available_balance || 0) + Number(withdrawal.amount),
            updated_at: now,
          })
          .eq('id', withdrawal.partner_id);
      }

      await supabase
        .from('partner_withdrawals')
        .update({
          status: 'rejected',
          reviewed_by: admin_id || null,
          reviewed_at: now,
          admin_notes: admin_notes || null,
        })
        .eq('id', withdrawal_id);

    } else if (action === 'paid') {
      if (withdrawal.status !== 'approved') {
        return new Response(
          JSON.stringify({ error: 'Saque precisa estar aprovado para marcar como pago' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('partner_withdrawals')
        .update({
          status: 'paid',
          paid_at: now,
          admin_notes: admin_notes || withdrawal.admin_notes,
        })
        .eq('id', withdrawal_id);

      // Incrementar withdrawn_balance do partner
      const { data: partner } = await supabase
        .from('partners')
        .select('withdrawn_balance')
        .eq('id', withdrawal.partner_id)
        .single();

      if (partner) {
        await supabase
          .from('partners')
          .update({
            withdrawn_balance: Number(partner.withdrawn_balance || 0) + Number(withdrawal.amount),
            updated_at: now,
          })
          .eq('id', withdrawal.partner_id);
      }

      // Marcar comissões correspondentes como withdrawn
      const withdrawAmount = Number(withdrawal.amount);
      let remaining = withdrawAmount;

      const { data: availableCommissions } = await supabase
        .from('partner_commissions')
        .select('id, commission_value')
        .eq('partner_id', withdrawal.partner_id)
        .eq('status', 'available')
        .order('created_at', { ascending: true });

      if (availableCommissions) {
        for (const comm of availableCommissions) {
          if (remaining <= 0) break;
          await supabase
            .from('partner_commissions')
            .update({ status: 'withdrawn' })
            .eq('id', comm.id);
          remaining -= Number(comm.commission_value);
        }
      }
    }

    console.log(`[AdminPartnerWithdrawal] ${action}: withdrawal=${withdrawal_id}`);

    return new Response(
      JSON.stringify({ success: true, action }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[AdminPartnerWithdrawal] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
