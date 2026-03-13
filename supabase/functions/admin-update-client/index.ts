/**
 * Edge Function: Admin Update Client
 *
 * Atualiza dados do cliente usando service role.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';

interface UpdateClientRequest {
  user_id: string;
  name?: string | null;
  status?: string | null;
  admin_notes?: string | null;
  plan?: string | null;
  emails_limit?: number | null;
  shops_limit?: number | null;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload = (await req.json()) as UpdateClientRequest;

    if (!payload.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.admin_notes !== undefined) updateData.admin_notes = payload.admin_notes;
    if (payload.plan !== undefined) updateData.plan = payload.plan;
    if (payload.emails_limit !== undefined) updateData.emails_limit = payload.emails_limit;
    if (payload.shops_limit !== undefined) updateData.shops_limit = payload.shops_limit;

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', payload.user_id);

    if (error) {
      console.error('Erro ao atualizar cliente:', error);
      return new Response(
        JSON.stringify({ error: error.message || 'Erro ao atualizar cliente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
