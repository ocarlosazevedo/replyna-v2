/**
 * Edge Function: Sync Coupon
 *
 * Sincroniza cupons entre o banco de dados Replyna e o Stripe.
 * Cria ou atualiza cupons no Stripe quando criados/editados no admin.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
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
        JSON.stringify({ error: 'coupon_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const stripe = getStripeClient();

    // Buscar cupom no banco
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', coupon_id)
      .single();

    if (couponError && action !== 'delete') {
      throw new Error('Cupom não encontrado');
    }

    // Ação: Deletar
    if (action === 'delete') {
      if (coupon?.stripe_coupon_id) {
        try {
          await stripe.coupons.del(coupon.stripe_coupon_id);
          console.log(`Cupom ${coupon.stripe_coupon_id} deletado do Stripe`);
        } catch (stripeError: unknown) {
          // Se o cupom não existe no Stripe, ignorar
          const error = stripeError as { code?: string };
          if (error.code !== 'resource_missing') {
            throw stripeError;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Cupom deletado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar dados do cupom para o Stripe
    const stripeCouponData: {
      id?: string;
      name: string;
      percent_off?: number;
      amount_off?: number;
      currency?: string;
      duration: 'forever' | 'once' | 'repeating';
      duration_in_months?: number;
      max_redemptions?: number;
      redeem_by?: number;
    } = {
      name: coupon.description || coupon.code,
      duration: 'once', // Desconto apenas na primeira mensalidade
    };

    // Configurar tipo de desconto
    if (coupon.discount_type === 'percentage') {
      stripeCouponData.percent_off = coupon.discount_value;
    } else {
      // Stripe espera valores em centavos
      stripeCouponData.amount_off = Math.round(coupon.discount_value * 100);
      stripeCouponData.currency = 'brl';
    }

    // Limite de usos
    if (coupon.usage_limit) {
      stripeCouponData.max_redemptions = coupon.usage_limit;
    }

    // Data de expiração
    if (coupon.valid_until) {
      stripeCouponData.redeem_by = Math.floor(new Date(coupon.valid_until).getTime() / 1000);
    }

    let stripeCouponId = coupon.stripe_coupon_id;

    // Ação: Criar ou Atualizar
    if (action === 'create' || !stripeCouponId) {
      // Criar novo cupom no Stripe
      // Usar o código como ID do cupom no Stripe para facilitar
      stripeCouponData.id = coupon.code.toUpperCase();

      try {
        const stripeCoupon = await stripe.coupons.create(stripeCouponData);
        stripeCouponId = stripeCoupon.id;
        console.log(`Cupom criado no Stripe: ${stripeCouponId}`);
      } catch (stripeError: unknown) {
        const error = stripeError as { code?: string; message?: string };
        // Se já existe um cupom com esse ID, tentar atualizar
        if (error.code === 'resource_already_exists') {
          stripeCouponId = coupon.code.toUpperCase();
          console.log(`Cupom ${stripeCouponId} já existe no Stripe`);
        } else {
          throw stripeError;
        }
      }
    } else if (action === 'update' && stripeCouponId) {
      // Stripe não permite atualizar todos os campos de um cupom
      // A estratégia é deletar e recriar se houve mudanças significativas
      try {
        // Verificar se o cupom existe
        const existingCoupon = await stripe.coupons.retrieve(stripeCouponId);

        // Verificar se houve mudanças significativas
        const hasSignificantChanges =
          (coupon.discount_type === 'percentage' && existingCoupon.percent_off !== coupon.discount_value) ||
          (coupon.discount_type === 'fixed_amount' && existingCoupon.amount_off !== Math.round(coupon.discount_value * 100));

        if (hasSignificantChanges) {
          // Deletar cupom antigo
          await stripe.coupons.del(stripeCouponId);

          // Criar novo com o mesmo código
          stripeCouponData.id = coupon.code.toUpperCase();
          const newCoupon = await stripe.coupons.create(stripeCouponData);
          stripeCouponId = newCoupon.id;
          console.log(`Cupom recriado no Stripe: ${stripeCouponId}`);
        } else {
          // Apenas atualizar nome (único campo atualizável)
          await stripe.coupons.update(stripeCouponId, {
            name: coupon.description || coupon.code,
          });
          console.log(`Cupom atualizado no Stripe: ${stripeCouponId}`);
        }
      } catch (stripeError: unknown) {
        const error = stripeError as { code?: string };
        if (error.code === 'resource_missing') {
          // Cupom não existe, criar novo
          stripeCouponData.id = coupon.code.toUpperCase();
          const newCoupon = await stripe.coupons.create(stripeCouponData);
          stripeCouponId = newCoupon.id;
          console.log(`Cupom criado no Stripe (não existia): ${stripeCouponId}`);
        } else {
          throw stripeError;
        }
      }
    }

    // Criar Promotion Code (código que o cliente digita no checkout)
    // O Promotion Code é diferente do Coupon - é o código público
    if (stripeCouponId) {
      try {
        // Verificar se já existe um promotion code com esse código
        const existingPromoCodes = await stripe.promotionCodes.list({
          code: coupon.code.toUpperCase(),
          limit: 1,
        });

        if (existingPromoCodes.data.length === 0) {
          // Criar novo promotion code
          await stripe.promotionCodes.create({
            coupon: stripeCouponId,
            code: coupon.code.toUpperCase(),
            active: coupon.is_active,
            max_redemptions: coupon.usage_limit || undefined,
            expires_at: coupon.valid_until
              ? Math.floor(new Date(coupon.valid_until).getTime() / 1000)
              : undefined,
          });
          console.log(`Promotion Code criado: ${coupon.code.toUpperCase()}`);
        } else {
          // Atualizar promotion code existente (apenas active pode ser atualizado)
          await stripe.promotionCodes.update(existingPromoCodes.data[0].id, {
            active: coupon.is_active,
          });
          console.log(`Promotion Code atualizado: ${coupon.code.toUpperCase()}`);
        }
      } catch (promoError: unknown) {
        console.error('Erro ao criar/atualizar Promotion Code:', promoError);
        // Não falhar a operação toda por causa do promotion code
      }
    }

    // Atualizar stripe_coupon_id no banco se mudou
    if (stripeCouponId && stripeCouponId !== coupon.stripe_coupon_id) {
      await supabase
        .from('coupons')
        .update({ stripe_coupon_id: stripeCouponId })
        .eq('id', coupon_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        stripe_coupon_id: stripeCouponId,
        message: action === 'create' ? 'Cupom criado no Stripe' : 'Cupom atualizado no Stripe',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao sincronizar cupom:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
