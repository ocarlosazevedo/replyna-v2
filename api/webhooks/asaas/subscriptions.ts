import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

interface AsaasSubscriptionPayload {
  event: 'SUBSCRIPTION_CREATED' | 'SUBSCRIPTION_UPDATED' | 'SUBSCRIPTION_DELETED' | 'SUBSCRIPTION_INACTIVATED'
  subscription: {
    id: string
    customer: string
    value: number | string
    cycle?: string
    status?: string
  }
}

function mapAsaasStatus(status?: string): 'active' | 'canceled' | 'past_due' {
  const normalized = (status || '').toUpperCase()
  if (normalized === 'ACTIVE') return 'active'
  if (normalized === 'INACTIVE' || normalized === 'EXPIRED') return 'canceled'
  return 'active'
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Sempre responder 200 para evitar reenvio excessivo do Asaas
  const respondOk = (body: unknown) => res.status(200).json(body)

  try {
    const token = req.headers['asaas-access-token']
    const expected = process.env.ASAAS_WEBHOOK_TOKEN_SUBSCRIPTIONS

    if (!expected || token !== expected) {
      console.error('[ASAAS][WEBHOOK] Token invalido ou ausente')
      return respondOk({ error: 'Unauthorized' })
    }

    const payload = req.body as AsaasSubscriptionPayload

    if (!payload?.event || !payload?.subscription?.id) {
      console.error('[ASAAS][WEBHOOK] Payload invalido:', JSON.stringify(payload))
      return respondOk({ error: 'Invalid payload' })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[ASAAS][WEBHOOK] SUPABASE envs ausentes')
      return respondOk({ error: 'Missing Supabase envs' })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { subscription } = payload
    const subscriptionId = subscription.id
    const customerId = subscription.customer

    if (payload.event === 'SUBSCRIPTION_CREATED') {
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('asaas_subscription_id', subscriptionId)
        .maybeSingle()

      if (existing?.id) {
        console.log('[ASAAS][WEBHOOK] SUBSCRIPTION_CREATED ja processado:', subscriptionId)
        return respondOk({ ok: true, idempotent: true })
      }

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('asaas_customer_id', customerId)
        .maybeSingle()

      if (!user?.id) {
        console.warn('[ASAAS][WEBHOOK] Usuario nao encontrado para customer:', customerId)
        return respondOk({ ok: true, warning: 'User not found' })
      }

      const now = new Date()
      const periodEnd = addDays(now, 30)

      await supabase
        .from('subscriptions')
        .update({
          asaas_subscription_id: subscriptionId,
          asaas_customer_id: customerId,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq('user_id', user.id)

      console.log('SUBSCRIPTION_CREATED processado:', subscriptionId)
      return respondOk({ ok: true })
    }

    if (payload.event === 'SUBSCRIPTION_UPDATED') {
      const { data: subscriptionRow } = await supabase
        .from('subscriptions')
        .select('id, user_id')
        .eq('asaas_subscription_id', subscriptionId)
        .maybeSingle()

      if (!subscriptionRow?.id) {
        console.warn('[ASAAS][WEBHOOK] SUBSCRIPTION_UPDATED sem registro local:', subscriptionId)
        return respondOk({ ok: true, warning: 'Subscription not found' })
      }

      const mappedStatus = mapAsaasStatus(subscription.status)

      await supabase
        .from('subscriptions')
        .update({
          status: mappedStatus,
        })
        .eq('id', subscriptionRow.id)

      return respondOk({ ok: true })
    }

    if (payload.event === 'SUBSCRIPTION_DELETED') {
      const { data: subscriptionRow } = await supabase
        .from('subscriptions')
        .select('id, user_id')
        .eq('asaas_subscription_id', subscriptionId)
        .maybeSingle()

      if (!subscriptionRow?.id) {
        console.warn('[ASAAS][WEBHOOK] SUBSCRIPTION_DELETED sem registro local:', subscriptionId)
        return respondOk({ ok: true, warning: 'Subscription not found' })
      }

      await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
        })
        .eq('id', subscriptionRow.id)

      return respondOk({ ok: true })
    }

    if (payload.event === 'SUBSCRIPTION_INACTIVATED') {
      const { data: subscriptionRow } = await supabase
        .from('subscriptions')
        .select('id, user_id')
        .eq('asaas_subscription_id', subscriptionId)
        .maybeSingle()

      if (!subscriptionRow?.id) {
        console.warn('[ASAAS][WEBHOOK] SUBSCRIPTION_INACTIVATED sem registro local:', subscriptionId)
        return respondOk({ ok: true, warning: 'Subscription not found' })
      }

      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
        })
        .eq('id', subscriptionRow.id)

      return respondOk({ ok: true })
    }

    console.warn('[ASAAS][WEBHOOK] Evento nao tratado:', payload.event)
    return respondOk({ ok: true, ignored: true })
  } catch (error) {
    console.error('[ASAAS][WEBHOOK] Erro:', error)
    return res.status(200).json({ error: (error as Error).message || 'Erro interno' })
  }
}
