/**
 * Edge Function: Partner Withdraw
 *
 * Solicita saque de comissões do partner.
 * Valida mínimo R$100, saldo disponível e PIX cadastrado.
 * POST - Requer autenticação.
 *
 * Também aceita PUT para atualizar dados PIX do partner.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';

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

function getSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
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
    // Autenticar usuário
    const supabaseClient = getSupabaseClient(req);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();

    // Buscar partner
    const { data: partner } = await supabase
      .from('partners')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!partner) {
      return new Response(
        JSON.stringify({ error: 'Você não é um parceiro' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (partner.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Parceiro suspenso. Regularize sua assinatura.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();

    // PUT: Atualizar dados PIX
    if (req.method === 'PUT') {
      const { pix_key_type, pix_key } = body;

      if (!pix_key_type || !pix_key) {
        return new Response(
          JSON.stringify({ error: 'Tipo e chave PIX são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['cpf', 'email', 'phone', 'random'].includes(pix_key_type)) {
        return new Response(
          JSON.stringify({ error: 'Tipo de chave PIX inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase
        .from('partners')
        .update({
          pix_key_type,
          pix_key,
          updated_at: new Date().toISOString(),
        })
        .eq('id', partner.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar dados PIX' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Solicitar saque
    if (!partner.pix_key || !partner.pix_key_type) {
      return new Response(
        JSON.stringify({ error: 'Cadastre sua chave PIX antes de solicitar saque' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const availableBalance = Number(partner.available_balance || 0);
    const MIN_WITHDRAWAL = 100;

    if (availableBalance < MIN_WITHDRAWAL) {
      return new Response(
        JSON.stringify({ error: `Saldo mínimo para saque é R$${MIN_WITHDRAWAL},00. Saldo atual: R$${availableBalance.toFixed(2)}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já tem saque pendente
    const { data: pendingWithdrawal } = await supabase
      .from('partner_withdrawals')
      .select('id')
      .eq('partner_id', partner.id)
      .eq('status', 'pending')
      .limit(1);

    if (pendingWithdrawal && pendingWithdrawal.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Você já tem um saque pendente. Aguarde a aprovação.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amount = body.amount ? Math.min(Number(body.amount), availableBalance) : availableBalance;

    if (amount < MIN_WITHDRAWAL) {
      return new Response(
        JSON.stringify({ error: `Valor mínimo para saque é R$${MIN_WITHDRAWAL},00` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar withdrawal
    const { data: withdrawal, error: withdrawError } = await supabase
      .from('partner_withdrawals')
      .insert({
        partner_id: partner.id,
        amount,
        pix_key_type: partner.pix_key_type,
        pix_key: partner.pix_key,
        status: 'pending',
      })
      .select()
      .single();

    if (withdrawError) {
      console.error('[PartnerWithdraw] Erro ao criar saque:', withdrawError);
      return new Response(
        JSON.stringify({ error: 'Erro ao solicitar saque' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Debitar do saldo disponível
    await supabase
      .from('partners')
      .update({
        available_balance: Math.max(0, availableBalance - amount),
        updated_at: new Date().toISOString(),
      })
      .eq('id', partner.id);

    console.log(`[PartnerWithdraw] Saque solicitado: partner=${partner.id}, amount=${amount}`);

    return new Response(
      JSON.stringify({ success: true, withdrawal }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[PartnerWithdraw] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
