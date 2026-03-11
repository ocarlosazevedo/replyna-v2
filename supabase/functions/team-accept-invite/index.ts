/**
 * Edge Function: Team Accept Invite
 *
 * POST - Aceita um convite de equipe
 * GET - Valida/retorna dados do convite (para exibir na página de aceite)
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Cliente admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // GET - Validar convite (pode ser chamado sem autenticação para exibir dados públicos)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');

      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Código do convite é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: invite, error } = await supabase
        .from('team_invites')
        .select('id, code, invited_email, invited_name, role, status, expires_at, owner_user_id')
        .eq('code', code.toUpperCase())
        .single();

      if (error || !invite) {
        return new Response(
          JSON.stringify({ error: 'Convite não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se expirou
      if (invite.status === 'pending' && new Date(invite.expires_at) < new Date()) {
        await supabase
          .from('team_invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);

        return new Response(
          JSON.stringify({ error: 'Este convite expirou', status: 'expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (invite.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: `Este convite já foi ${invite.status === 'accepted' ? 'aceito' : invite.status}`, status: invite.status }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar nome do owner
      const { data: owner } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', invite.owner_user_id)
        .single();

      // Buscar nomes das lojas permitidas
      const { data: inviteFull } = await supabase
        .from('team_invites')
        .select('allowed_shop_ids')
        .eq('id', invite.id)
        .single();

      let shopNames: string[] = [];
      if (inviteFull?.allowed_shop_ids?.length) {
        const { data: shops } = await supabase
          .from('shops')
          .select('name')
          .in('id', inviteFull.allowed_shop_ids);
        shopNames = (shops || []).map((s: { name: string }) => s.name);
      }

      return new Response(
        JSON.stringify({
          invite: {
            code: invite.code,
            invited_name: invite.invited_name,
            role: invite.role,
            status: invite.status,
            expires_at: invite.expires_at,
          },
          owner: {
            name: owner?.name || owner?.email || 'Desconhecido',
          },
          shops: shopNames,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Aceitar convite (requer autenticação)
    if (req.method === 'POST') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization header required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar token do usuário
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json();
      const { code } = body;

      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Código do convite é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar convite
      const { data: invite, error: inviteError } = await supabase
        .from('team_invites')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        return new Response(
          JSON.stringify({ error: 'Convite não encontrado ou já foi utilizado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar expiração
      if (new Date(invite.expires_at) < new Date()) {
        await supabase
          .from('team_invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);

        return new Response(
          JSON.stringify({ error: 'Este convite expirou' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Não pode aceitar convite da própria conta
      if (invite.owner_user_id === user.id) {
        return new Response(
          JSON.stringify({ error: 'Você não pode aceitar um convite da sua própria conta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se já é membro
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('owner_user_id', invite.owner_user_id)
        .eq('member_user_id', user.id)
        .single();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'Você já é membro desta equipe' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Criar membro
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          owner_user_id: invite.owner_user_id,
          member_user_id: user.id,
          role: invite.role,
          allowed_shop_ids: invite.allowed_shop_ids,
          permissions: invite.permissions,
          invite_id: invite.id,
        });

      if (memberError) {
        console.error('[TEAM-ACCEPT] Erro ao criar membro:', memberError);
        throw memberError;
      }

      // Atualizar convite como aceito
      await supabase
        .from('team_invites')
        .update({
          status: 'accepted',
          accepted_by_user_id: user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      console.log(`[TEAM-ACCEPT] Usuário ${user.id} aceitou convite ${invite.code} do owner ${invite.owner_user_id}`);

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
    console.error('[TEAM-ACCEPT] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
