/**
 * Edge Function: Admin Get Partner Invites
 *
 * Lista convites de Partners para o admin.
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

    const { data: invites, error } = await supabase
      .from('partner_invites')
      .select('id, token, used, used_by, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Erro ao buscar convites:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar convites' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const usedByIds = (invites || [])
      .map((invite) => invite.used_by)
      .filter((id): id is string => Boolean(id));

    const usersById: Record<string, { email: string | null; name: string | null }> = {};
    if (usedByIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', usedByIds);

      (users || []).forEach((user) => {
        usersById[user.id] = { email: user.email, name: user.name };
      });
    }

    const enriched = (invites || []).map((invite) => ({
      ...invite,
      used_by_email: invite.used_by ? usersById[invite.used_by]?.email ?? null : null,
      used_by_name: invite.used_by ? usersById[invite.used_by]?.name ?? null : null,
    }));

    return new Response(
      JSON.stringify({ invites: enriched }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao buscar convites:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
