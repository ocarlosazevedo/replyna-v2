/**
 * Edge Function: Admin Partners
 *
 * Lista todos os partners com stats para o painel admin.
 * GET - Usa service role key.
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

    // Buscar dados em paralelo
    const [partnersResult, usersResult, commissionsResult, withdrawalsResult] = await Promise.all([
      supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('id, name, email, plan, status'),
      supabase
        .from('partner_commissions')
        .select('partner_id, commission_value, status'),
      supabase
        .from('partner_withdrawals')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    if (partnersResult.error) throw partnersResult.error;

    const partners = partnersResult.data || [];
    const users = usersResult.data || [];
    const commissions = commissionsResult.data || [];
    const withdrawals = withdrawalsResult.data || [];

    // Enriquecer dados dos partners
    const enrichedPartners = partners.map(p => {
      const user = users.find(u => u.id === p.user_id);
      const partnerCommissions = commissions.filter(c => c.partner_id === p.id);
      const partnerWithdrawals = withdrawals.filter(w => w.partner_id === p.id);

      return {
        ...p,
        user_name: user?.name || 'N/A',
        user_email: user?.email || 'N/A',
        user_plan: user?.plan || 'N/A',
        user_status: user?.status || 'N/A',
        total_commissions: partnerCommissions.length,
        pending_withdrawals: partnerWithdrawals.filter(w => w.status === 'pending').length,
      };
    });

    // Stats resumo
    const totalPartners = partners.length;
    const activePartners = partners.filter(p => p.status === 'active').length;
    const totalCommissionsPaid = commissions
      .filter(c => c.status === 'withdrawn')
      .reduce((sum, c) => sum + Number(c.commission_value), 0);
    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');

    return new Response(
      JSON.stringify({
        stats: {
          total_partners: totalPartners,
          active_partners: activePartners,
          total_commissions_paid: totalCommissionsPaid,
          pending_withdrawals_count: pendingWithdrawals.length,
          pending_withdrawals_amount: pendingWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0),
        },
        partners: enrichedPartners,
        pending_withdrawals: pendingWithdrawals.map(w => {
          const partner = partners.find(p => p.id === w.partner_id);
          const user = partner ? users.find(u => u.id === partner.user_id) : null;
          return {
            ...w,
            partner_name: user?.name || 'N/A',
            partner_email: user?.email || 'N/A',
            partner_coupon: partner?.coupon_code || 'N/A',
          };
        }),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[AdminPartners] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
