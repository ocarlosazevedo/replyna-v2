import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

interface AsaasPaymentPayload {
  event:
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_OVERDUE'
    | 'PAYMENT_DELETED'
    | 'PAYMENT_REFUNDED'
    | 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED'
  payment: {
    id: string
    customer: string
    subscription?: string | null
    value: number | string
    status?: string
    billingType?: string
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function isRecent(dateStr?: string | null, minutes = 60): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return false
  const diff = Date.now() - date.getTime()
  return diff < minutes * 60 * 1000
}

async function callProcessPendingCredits(supabaseUrl: string, serviceRoleKey: string, userId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/process-pending-credits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ASAAS][WEBHOOK] Erro process-pending-credits:', response.status, errorText)
    }
  } catch (err) {
    console.error('[ASAAS][WEBHOOK] Excecao process-pending-credits:', err)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Sempre responder 200 para evitar reenvio excessivo do Asaas
  const respondOk = (body: unknown) => res.status(200).json(body)

  try {
    const token = req.headers['asaas-access-token']
    const expected = process.env.ASAAS_WEBHOOK_TOKEN_PAYMENTS

    if (!expected || token !== expected) {
      console.error('[ASAAS][WEBHOOK] Token invalido ou ausente')
      return respondOk({ error: 'Unauthorized' })
    }

    const payload = req.body as AsaasPaymentPayload

    if (!payload?.event || !payload?.payment?.id) {
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

    const payment = payload.payment
    const subscriptionId = payment.subscription || null

    if (payload.event === 'PAYMENT_CONFIRMED' || payload.event === 'PAYMENT_RECEIVED') {
      if (subscriptionId) {
        const { data: subscriptionRow } = await supabase
          .from('subscriptions')
          .select('id, user_id, status, current_period_start')
          .eq('asaas_subscription_id', subscriptionId)
          .maybeSingle()

        if (!subscriptionRow?.id) {
          console.warn('[ASAAS][WEBHOOK] Pagamento com subscription nao encontrada:', subscriptionId)
          return respondOk({ ok: true, warning: 'Subscription not found' })
        }

        // Idempotencia: se ja atualizou recentemente, nao processa novamente
        if (subscriptionRow.status === 'active' && isRecent(subscriptionRow.current_period_start)) {
          return respondOk({ ok: true, idempotent: true })
        }

        const now = new Date()
        const periodEnd = addDays(now, 30)

        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            asaas_payment_id: payment.id,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', subscriptionRow.id)

        await supabase
          .from('users')
          .update({
            status: 'active',
            emails_used: 0,
            extra_emails_used: 0,
            pending_extra_emails: 0,
            updated_at: now.toISOString(),
          })
          .eq('id', subscriptionRow.user_id)

        await callProcessPendingCredits(supabaseUrl, supabaseServiceKey, subscriptionRow.user_id)
        return respondOk({ ok: true })
      }

      // Pagamento avulso (email extra)
      const { data: purchase } = await supabase
        .from('email_extra_purchases')
        .select('id, user_id, package_size, status')
        .eq('asaas_payment_id', payment.id)
        .maybeSingle()

      if (!purchase?.id) {
        console.warn('[ASAAS][WEBHOOK] Pagamento avulso sem purchase:', payment.id)
        return respondOk({ ok: true, warning: 'Purchase not found' })
      }

      if (purchase.status === 'completed') {
        return respondOk({ ok: true, idempotent: true })
      }

      const now = new Date()

      await supabase
        .from('email_extra_purchases')
        .update({
          status: 'completed',
          completed_at: now.toISOString(),
        })
        .eq('id', purchase.id)

      const { data: user } = await supabase
        .from('users')
        .select('extra_emails_purchased, pending_extra_emails')
        .eq('id', purchase.user_id)
        .maybeSingle()

      const currentPurchased = user?.extra_emails_purchased || 0
      const currentPending = user?.pending_extra_emails || 0

      await supabase
        .from('users')
        .update({
          extra_emails_purchased: currentPurchased + purchase.package_size,
          pending_extra_emails: Math.max(0, currentPending - purchase.package_size),
          updated_at: now.toISOString(),
        })
        .eq('id', purchase.user_id)

      await callProcessPendingCredits(supabaseUrl, supabaseServiceKey, purchase.user_id)
      return respondOk({ ok: true })
    }

    if (payload.event === 'PAYMENT_OVERDUE' || payload.event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED') {
      if (subscriptionId) {
        const { data: subscriptionRow } = await supabase
          .from('subscriptions')
          .select('id, user_id')
          .eq('asaas_subscription_id', subscriptionId)
          .maybeSingle()

        if (subscriptionRow?.id) {
          const now = new Date()
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: now.toISOString() })
            .eq('id', subscriptionRow.id)

          await supabase
            .from('users')
            .update({ status: 'suspended', updated_at: now.toISOString() })
            .eq('id', subscriptionRow.user_id)
        }
      }

      if (payload.event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED') {
        console.log('Cartao recusado para customer:', payment.customer)
      }

      return respondOk({ ok: true })
    }

    if (payload.event === 'PAYMENT_REFUNDED') {
      console.log('Pagamento estornado:', payment.id)

      if (!subscriptionId) {
        const { data: purchase } = await supabase
          .from('email_extra_purchases')
          .select('id')
          .eq('asaas_payment_id', payment.id)
          .maybeSingle()

        if (purchase?.id) {
          await supabase
            .from('email_extra_purchases')
            .update({ status: 'refunded' })
            .eq('id', purchase.id)
        }
      }

      return respondOk({ ok: true })
    }

    if (payload.event === 'PAYMENT_DELETED') {
      console.log('Pagamento deletado:', payment.id)
      return respondOk({ ok: true })
    }

    console.warn('[ASAAS][WEBHOOK] Evento nao tratado:', payload.event)
    return respondOk({ ok: true, ignored: true })
  } catch (error) {
    console.error('[ASAAS][WEBHOOK] Erro:', error)
    return res.status(200).json({ error: (error as Error).message || 'Erro interno' })
  }
}
