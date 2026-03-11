/**
 * Edge Function: Team Members
 *
 * GET - Lista membros da equipe (se owner) ou memberships (se membro)
 * PATCH - Atualiza role/permissões/lojas de um membro
 * DELETE - Remove membro da equipe
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

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // GET - Listar membros e memberships
    if (req.method === 'GET') {
      // Membros da minha equipe (sou owner)
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, member_user_id, role, allowed_shop_ids, permissions, created_at, updated_at')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false });

      if (membersError) throw membersError;

      // Enriquecer com dados do usuário membro
      const enrichedMembers = [];
      for (const member of (members || [])) {
        const { data: memberUser } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', member.member_user_id)
          .single();

        // Buscar nomes das lojas
        let shopNames: { id: string; name: string }[] = [];
        if (member.allowed_shop_ids?.length) {
          const { data: shops } = await supabase
            .from('shops')
            .select('id, name')
            .in('id', member.allowed_shop_ids);
          shopNames = shops || [];
        }

        enrichedMembers.push({
          ...member,
          user: memberUser ? { id: memberUser.id, name: memberUser.name, email: memberUser.email } : null,
          shops: shopNames,
        });
      }

      // Equipes das quais sou membro
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('id, owner_user_id, role, allowed_shop_ids, permissions, created_at')
        .eq('member_user_id', user.id)
        .order('created_at', { ascending: false });

      if (membershipError) throw membershipError;

      // Enriquecer memberships com dados do owner
      const enrichedMemberships = [];
      for (const membership of (memberships || [])) {
        const { data: ownerUser } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', membership.owner_user_id)
          .single();

        // Buscar lojas permitidas com nome
        let shopNames: { id: string; name: string }[] = [];
        if (membership.allowed_shop_ids?.length) {
          const { data: shops } = await supabase
            .from('shops')
            .select('id, name, shopify_domain, is_active')
            .in('id', membership.allowed_shop_ids);
          shopNames = shops || [];
        }

        enrichedMemberships.push({
          ...membership,
          owner: ownerUser ? { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email } : null,
          shops: shopNames,
        });
      }

      return new Response(
        JSON.stringify({
          members: enrichedMembers,
          memberships: enrichedMemberships,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PATCH - Atualizar membro
    if (req.method === 'PATCH') {
      const body = await req.json();
      const { member_id, role, allowed_shop_ids, permissions } = body;

      if (!member_id) {
        return new Response(
          JSON.stringify({ error: 'member_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se o membro pertence ao owner
      const { data: member, error: findError } = await supabase
        .from('team_members')
        .select('id, owner_user_id')
        .eq('id', member_id)
        .eq('owner_user_id', user.id)
        .single();

      if (findError || !member) {
        return new Response(
          JSON.stringify({ error: 'Membro não encontrado na sua equipe' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar role se fornecido
      if (role && !['viewer', 'operator', 'manager'].includes(role)) {
        return new Response(
          JSON.stringify({ error: 'Role inválido. Use: viewer, operator ou manager' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Se alterar lojas, verificar que pertencem ao owner
      if (allowed_shop_ids) {
        const { data: ownerShops } = await supabase
          .from('shops')
          .select('id')
          .eq('user_id', user.id);

        const ownerShopIds = (ownerShops || []).map((s: { id: string }) => s.id);
        const invalidShops = allowed_shop_ids.filter((id: string) => !ownerShopIds.includes(id));

        if (invalidShops.length > 0) {
          return new Response(
            JSON.stringify({ error: 'Uma ou mais lojas não pertencem à sua conta' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Montar update
      const updateData: Record<string, unknown> = {};
      if (role) {
        updateData.role = role;
        // Atualizar permissões padrão se o role mudar e não forneceu permissions customizadas
        if (!permissions) {
          const { data: defaultPerms } = await supabase.rpc('get_default_team_permissions', { p_role: role });
          updateData.permissions = defaultPerms || {};
        }
      }
      if (allowed_shop_ids) updateData.allowed_shop_ids = allowed_shop_ids;
      if (permissions) updateData.permissions = permissions;

      if (Object.keys(updateData).length === 0) {
        return new Response(
          JSON.stringify({ error: 'Nenhum campo para atualizar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase
        .from('team_members')
        .update(updateData)
        .eq('id', member_id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Remover membro
    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const memberId = url.searchParams.get('id');

      if (!memberId) {
        return new Response(
          JSON.stringify({ error: 'ID do membro é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se o membro pertence ao owner
      const { data: member } = await supabase
        .from('team_members')
        .select('id')
        .eq('id', memberId)
        .eq('owner_user_id', user.id)
        .single();

      if (!member) {
        return new Response(
          JSON.stringify({ error: 'Membro não encontrado na sua equipe' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)
        .eq('owner_user_id', user.id);

      if (deleteError) throw deleteError;

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
    console.error('[TEAM-MEMBERS] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
