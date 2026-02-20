/**
 * Edge Function: Sync Coupon (Asaas)
 *
 * Asaas nao possui sistema global de cupons.
 * Mantemos cupons apenas no Supabase. Esta funcao retorna sucesso.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SyncCouponRequest {
  coupon_id: string;
  action: 'create' | 'update' | 'delete';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coupon_id, action } = (await req.json()) as SyncCouponRequest;

    if (!coupon_id) {
      return new Response(
        JSON.stringify({ error: 'coupon_id e obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // Apenas garantir que o cupom existe para logs
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id, code')
      .eq('id', coupon_id)
      .single();

    console.log(`[ASAAS][COUPON] ${action.toUpperCase()} - ${coupon?.code || coupon_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cupom mantido localmente (Asaas nao sincroniza).',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao processar cupom:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
