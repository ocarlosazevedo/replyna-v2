/**
 * Edge Function: Partner Profile
 *
 * Retorna dados completos do partner: perfil, referidos, comissões e saques.
 * GET - Requer autenticação.
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
    let { data: partner } = await supabase
      .from('partners')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Auto-criar partner se não existe (todo usuário ativo é partner)
    if (!partner) {
      // Buscar nome do usuário para gerar cupom
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();

      // Gerar código de cupom baseado no nome + sufixo aleatório
      const baseName = (userData?.name || 'REPLYNA')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      let couponCode = `${baseName}${suffix}`;

      // Verificar unicidade contra partners e coupons (em paralelo)
      let attempts = 0;
      while (attempts < 5) {
        const [{ data: ep }, { data: ec }] = await Promise.all([
          supabase.from('partners').select('id').eq('coupon_code', couponCode).maybeSingle(),
          supabase.from('coupons').select('id').eq('code', couponCode).maybeSingle(),
        ]);
        if (!ep && !ec) break;
        couponCode = `${baseName}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        attempts++;
      }

      const { data: newPartner, error: createError } = await supabase
        .from('partners')
        .insert({
          user_id: user.id,
          coupon_code: couponCode,
          status: 'active',
        })
        .select()
        .single();

      if (createError) {
        console.error('[PartnerProfile] Erro ao auto-criar partner:', createError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar perfil de parceiro' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      partner = newPartner;
    }

    // Buscar referidos, comissões e saques em paralelo
    const [
      { data: referrals },
      { data: commissions },
      { data: withdrawals },
    ] = await Promise.all([
      supabase
        .from('partner_referrals')
        .select('id, created_at, referred_user_id')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('partner_commissions')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('partner_withdrawals')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false }),
    ]);

    // Buscar dados dos usuários referidos
    let referralDetails: any[] = [];
    if (referrals && referrals.length > 0) {
      const userIds = referrals.map(r => r.referred_user_id);
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, plan, status')
        .in('id', userIds);

      referralDetails = referrals.map(ref => {
        const refUser = users?.find(u => u.id === ref.referred_user_id);
        return {
          id: ref.id,
          created_at: ref.created_at,
          user_name: refUser?.name || 'N/A',
          user_email: refUser?.email || 'N/A',
          user_plan: refUser?.plan || 'N/A',
          user_status: refUser?.status || 'N/A',
        };
      });
    }

    return new Response(
      JSON.stringify({
        is_partner: true,
        partner,
        referrals: referralDetails,
        commissions: commissions || [],
        withdrawals: withdrawals || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[PartnerProfile] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
