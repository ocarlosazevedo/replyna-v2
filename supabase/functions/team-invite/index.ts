/**
 * Edge Function: Team Invite
 *
 * POST - Cria convite de equipe e envia email
 * DELETE - Cancela convite pendente
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isValidEmail } from '../_shared/validation.ts';

// Gera código único de 8 caracteres (sem I, O, 0, 1 para evitar confusão)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

    // Verificar autenticação do usuário
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

    // Cliente admin para operações
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // POST - Criar convite
    if (req.method === 'POST') {
      const body = await req.json();
      const { invited_email, invited_name, role, allowed_shop_ids } = body;

      // Validações
      if (!invited_email || !role || !allowed_shop_ids || allowed_shop_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatórios: invited_email, role, allowed_shop_ids' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!isValidEmail(invited_email)) {
        return new Response(
          JSON.stringify({ error: 'Formato de email inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['viewer', 'operator', 'manager'].includes(role)) {
        return new Response(
          JSON.stringify({ error: 'Role inválido. Use: viewer, operator ou manager' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Não pode convidar a si mesmo
      if (invited_email.toLowerCase() === user.email?.toLowerCase()) {
        return new Response(
          JSON.stringify({ error: 'Você não pode convidar a si mesmo' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar perfil do owner e verificar plano
      const { data: ownerProfile, error: profileError } = await supabase
        .from('users')
        .select('id, name, plan, status')
        .eq('id', user.id)
        .single();

      if (profileError || !ownerProfile) {
        return new Response(
          JSON.stringify({ error: 'Perfil do usuário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (ownerProfile.status !== 'active') {
        return new Response(
          JSON.stringify({ error: 'Sua conta precisa estar ativa para convidar membros' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar limite de membros do plano
      let teamMembersLimit: number | null = 0;

      // Tentar buscar subscription ativa
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id, plans(team_members_limit)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (subscription?.plans) {
        teamMembersLimit = subscription.plans.team_members_limit; // null = ilimitado
      } else {
        // Fallback: buscar limite pelo campo plan do usuário
        const { data: planData } = await supabase
          .from('plans')
          .select('slug, team_members_limit')
          .eq('slug', ownerProfile.plan || '')
          .single();

        if (planData) {
          teamMembersLimit = planData.team_members_limit; // null = ilimitado
        }
      }

      // Contar membros atuais
      const { count: currentMembers } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', user.id);

      if (teamMembersLimit !== null && (currentMembers || 0) >= teamMembersLimit) {
        return new Response(
          JSON.stringify({
            error: `Seu plano permite no máximo ${teamMembersLimit} membros de equipe. Faça upgrade para adicionar mais.`,
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se as lojas pertencem ao owner
      const { data: ownerShops } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', user.id);

      const ownerShopIds = (ownerShops || []).map((s: { id: string }) => s.id);
      const invalidShops = allowed_shop_ids.filter((id: string) => !ownerShopIds.includes(id));

      if (invalidShops.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Uma ou mais lojas selecionadas não pertencem à sua conta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se já é membro
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('owner_user_id', user.id)
        .filter('member_user_id', 'in', `(SELECT id FROM users WHERE email = '${invited_email.toLowerCase()}')`)
        .single();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'Este usuário já é membro da sua equipe' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se já existe convite pendente
      const { data: existingInvite } = await supabase
        .from('team_invites')
        .select('id')
        .eq('owner_user_id', user.id)
        .eq('invited_email', invited_email.toLowerCase())
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
          .from('team_invites')
          .select('id')
          .eq('code', code)
          .single();
        if (!existing) break;
        code = generateInviteCode();
        attempts++;
      }

      // Obter permissões padrão para o role
      const { data: defaultPerms } = await supabase.rpc('get_default_team_permissions', { p_role: role });
      const permissions = defaultPerms || {};

      // Criar convite
      const { data: invite, error: insertError } = await supabase
        .from('team_invites')
        .insert({
          owner_user_id: user.id,
          code,
          invited_email: invited_email.toLowerCase(),
          invited_name: invited_name || null,
          role,
          allowed_shop_ids,
          permissions,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Enviar email de convite via Resend
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const inviteUrl = `${Deno.env.get('SITE_URL') || 'https://app.replyna.me'}/team/invite/${code}`;
        const ownerName = ownerProfile.name || user.email;
        const safeName = invited_name?.trim() || 'Olá';

        const roleLabels: Record<string, string> = {
          viewer: 'Visualizador',
          operator: 'Operador',
          manager: 'Gerente',
        };

        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Replyna <no-reply@replyna.me>',
              to: invited_email.toLowerCase(),
              subject: `${ownerName} convidou você para a equipe no Replyna`,
              html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 600px;">
                  <h2 style="margin: 0 0 12px;">${safeName}, você foi convidado!</h2>
                  <p style="margin: 0 0 8px;">
                    <strong>${ownerName}</strong> convidou você para fazer parte da equipe como <strong>${roleLabels[role] || role}</strong>.
                  </p>
                  <p style="margin: 0 0 24px; color: #475569;">
                    Clique no botão abaixo para aceitar o convite e acessar a plataforma.
                  </p>
                  <p style="margin: 0 0 24px;">
                    <a href="${inviteUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">
                      Aceitar convite
                    </a>
                  </p>
                  <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
                    Este convite expira em 7 dias.
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                    Se o botão não funcionar, copie e cole este link no navegador:<br/>
                    ${inviteUrl}
                  </p>
                </div>
              `,
              text: `${ownerName} convidou você para a equipe no Replyna como ${roleLabels[role] || role}. Aceite o convite: ${inviteUrl}`,
            }),
          });
          console.log('[TEAM-INVITE] Email enviado para', invited_email);
        } catch (emailErr) {
          console.error('[TEAM-INVITE] Erro ao enviar email:', emailErr);
          // Não falhar a operação se o email não for enviado
        }
      }

      const inviteUrl = `${Deno.env.get('SITE_URL') || 'https://app.replyna.me'}/team/invite/${code}`;

      return new Response(
        JSON.stringify({ success: true, invite, invite_url: inviteUrl }),
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
        .from('team_invites')
        .update({ status: 'cancelled' })
        .eq('id', inviteId)
        .eq('owner_user_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET - Listar convites do owner
    if (req.method === 'GET') {
      const { data: invites, error } = await supabase
        .from('team_invites')
        .select('*')
        .eq('owner_user_id', user.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ invites: invites || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[TEAM-INVITE] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
