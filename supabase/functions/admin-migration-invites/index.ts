/**
 * Edge Function: Admin Migration Invites
 *
 * CRUD de convites de migração para clientes V1.
 * GET - Lista todos os convites
 * POST - Cria novo convite
 * DELETE - Cancela convite
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

// Gera código único de 8 caracteres
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem I, O, 0, 1 para evitar confusão
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // GET - Listar convites
    if (req.method === 'GET') {
      const { data: invites, error } = await supabase
        .from('migration_invites')
        .select(`
          *,
          plan:plans(id, name, price_monthly),
          admin:admins(id, name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar planos ativos para o formulário
      const { data: plans } = await supabase
        .from('plans')
        .select('id, name, price_monthly, shops_limit')
        .eq('is_active', true)
        .order('sort_order');

      return new Response(
        JSON.stringify({ invites: invites || [], plans: plans || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Criar convite
    if (req.method === 'POST') {
      const body = await req.json();
      const {
        customer_email,
        customer_name,
        plan_id,
        billing_start_date,
        admin_id,
      } = body;

      // Validações
      if (!customer_email || !plan_id || !billing_start_date) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatórios: customer_email, plan_id, billing_start_date' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se já existe convite pendente para este email
      const { data: existingInvite } = await supabase
        .from('migration_invites')
        .select('id')
        .eq('customer_email', customer_email.toLowerCase())
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        return new Response(
          JSON.stringify({ error: 'Já existe um convite pendente para este email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Gerar código único
      let code = generateInviteCode();
      let attempts = 0;
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('migration_invites')
          .select('id')
          .eq('code', code)
          .single();

        if (!existing) break;
        code = generateInviteCode();
        attempts++;
      }

      // Criar convite - adiciona T12:00:00 para evitar problemas de timezone
      const billingDateStr = billing_start_date.includes('T')
        ? billing_start_date
        : `${billing_start_date}T12:00:00.000Z`;

      const { data: invite, error } = await supabase
        .from('migration_invites')
        .insert({
          code,
          customer_email: customer_email.toLowerCase(),
          customer_name,
          plan_id,
          billing_start_date: billingDateStr,
          created_by_admin_id: admin_id,
        })
        .select()
        .single();

      if (error) throw error;

      // Gerar URL do convite
      const inviteUrl = `${Deno.env.get('SITE_URL') || 'https://replyna.me'}/migrate/${code}`;

      return new Response(
        JSON.stringify({
          success: true,
          invite,
          invite_url: inviteUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Cancelar convite
    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const inviteId = url.searchParams.get('id');

      if (!inviteId) {
        return new Response(
          JSON.stringify({ error: 'ID do convite é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('migration_invites')
        .update({ status: 'cancelled' })
        .eq('id', inviteId)
        .eq('status', 'pending'); // Só cancela se estiver pendente

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
