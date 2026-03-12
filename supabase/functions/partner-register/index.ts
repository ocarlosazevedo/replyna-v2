/**
 * Edge Function: Partner Register
 *
 * Ativa um usuário como partner: valida unicidade do código
 * (contra partners E coupons), cria registro na tabela partners.
 * Requer autenticação (usuário ativo).
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

    const body = await req.json();
    const { coupon_code } = body;

    if (!coupon_code || typeof coupon_code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Código do cupom é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const code = coupon_code.toUpperCase().trim();

    // Validar formato: apenas letras, números e hífens, 3-20 caracteres
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: 'Código inválido. Use 3-20 caracteres (letras, números e hífens)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar unicidade contra tabela partners (excluindo o próprio)
    const { data: existingPartnerCode } = await supabase
      .from('partners')
      .select('id')
      .eq('coupon_code', code)
      .neq('user_id', user.id)
      .single();

    if (existingPartnerCode) {
      return new Response(
        JSON.stringify({ error: 'Este código já está em uso. Escolha outro.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar unicidade contra tabela coupons (cupons regulares)
    const { data: existingCoupon } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', code)
      .single();

    if (existingCoupon) {
      return new Response(
        JSON.stringify({ error: 'Este código já está em uso. Escolha outro.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'PUT') {
      // Atualizar cupom de partner existente
      const { data: partner, error: updateError } = await supabase
        .from('partners')
        .update({ coupon_code: code, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('[PartnerRegister] Erro ao atualizar cupom:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar cupom.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[PartnerRegister] Cupom atualizado: ${partner.id}, code: ${code}`);
      return new Response(
        JSON.stringify({ success: true, partner }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Criar partner (fallback, caso partner-profile não tenha auto-criado)
    const { data: existingPartner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existingPartner) {
      return new Response(
        JSON.stringify({ error: 'Você já é um parceiro' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: partner, error: insertError } = await supabase
      .from('partners')
      .insert({
        user_id: user.id,
        coupon_code: code,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[PartnerRegister] Erro ao criar partner:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar parceiro.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PartnerRegister] Partner criado: ${partner.id}, code: ${code}`);
    return new Response(
      JSON.stringify({ success: true, partner }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[PartnerRegister] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
