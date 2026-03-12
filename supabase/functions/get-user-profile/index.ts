/**
 * Edge Function: Get User Profile
 *
 * Retorna o perfil do usuário logado.
 * Usa service role key para bypassar RLS.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { maskEmail } from '../_shared/email.ts';
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

    // Primeiro, verificar o token do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente com anon key para verificar o usuário
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Obter usuário autenticado
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuário autenticado:', user.id, maskEmail(user.email));

    // Criar cliente admin para buscar dados
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, plan, emails_limit, emails_used, shops_limit, status, created_at, is_trial, trial_started_at, trial_ends_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);

      // Se não encontrou, pode ser que o usuário existe no Auth mas não na tabela users
      if (profileError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({
            error: 'User profile not found',
            hint: 'User exists in Auth but not in users table',
            user_id: user.id,
            email: user.email,
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Erro ao buscar perfil: ${profileError.message}`);
    }

    // Verificar expiração de trial (tempo ou créditos)
    if (profile?.is_trial && profile.status === 'active') {
      const now = new Date();
      const endsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const expiredByTime = endsAt ? endsAt.getTime() < now.getTime() : false;
      const limit = profile.emails_limit;
      const used = profile.emails_used ?? 0;
      const expiredByCredits = typeof limit === 'number' ? used >= limit : false;

      // Backfill trial_ends_at if missing but trial_started_at exists
      if (!endsAt && profile.trial_started_at) {
        const computedEndsAt = new Date(new Date(profile.trial_started_at).getTime() + 7 * 24 * 60 * 60 * 1000);
        await supabaseAdmin
          .from('users')
          .update({ trial_ends_at: computedEndsAt.toISOString(), updated_at: now.toISOString() })
          .eq('id', user.id);
        profile.trial_ends_at = computedEndsAt.toISOString();
      }

      if (expiredByTime || expiredByCredits) {
        await supabaseAdmin
          .from('users')
          .update({ status: 'expired', updated_at: now.toISOString() })
          .eq('id', user.id);

        const reason = expiredByTime ? 'time' : 'credits';
        const expiredProfile = { ...profile, status: 'expired' };

        return new Response(
          JSON.stringify({
            code: 'TRIAL_EXPIRED',
            reason,
            profile: expiredProfile,
            shops: [],
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar lojas do usuário
    const { data: shops, error: shopsError } = await supabaseAdmin
      .from('shops')
      .select('id, name, shopify_domain, is_active')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (shopsError) {
      console.error('Erro ao buscar lojas:', shopsError);
    }

    // Buscar memberships de equipe (equipes das quais o usuário é membro)
    const { data: teamMemberships } = await supabaseAdmin
      .from('team_members')
      .select('id, owner_user_id, role, allowed_shop_ids, permissions, created_at')
      .eq('member_user_id', user.id);

    // Enriquecer memberships com dados do owner
    const enrichedMemberships = [];
    for (const membership of (teamMemberships || [])) {
      const { data: owner } = await supabaseAdmin
        .from('users')
        .select('id, name, email')
        .eq('id', membership.owner_user_id)
        .single();

      enrichedMemberships.push({
        ...membership,
        owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
      });
    }

    // Contar membros da equipe do owner (para exibir no frontend)
    const { count: teamMembersCount } = await supabaseAdmin
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', user.id);

    return new Response(
      JSON.stringify({
        profile,
        shops: shops || [],
        team_memberships: enrichedMemberships,
        team_members_count: teamMembersCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
