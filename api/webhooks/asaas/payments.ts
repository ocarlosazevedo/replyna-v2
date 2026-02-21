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

function maskEmail(email?: string | null) {
  if (!email) return '[vazio]'
  const parts = email.split('@')
  if (parts.length !== 2) return '[email-invalido]'
  const [local, domain] = parts
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local[0]}***${local[local.length - 1]}@${domain}`
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

async function sendPasswordSetupEmail({
  supabase,
  email,
  name,
}: {
  supabase: ReturnType<typeof createClient>
  email: string
  name?: string | null
}) {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.error('[ASAAS][WEBHOOK] RESEND_API_KEY ausente')
    return
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'https://app.replyna.me/reset-password' },
  })

  if (linkError) {
    console.error('[ASAAS][WEBHOOK] Erro ao gerar link de reset:', linkError)
    return
  }

  const actionLink = linkData?.properties?.action_link
  if (!actionLink) {
    console.error('[ASAAS][WEBHOOK] Link de reset ausente')
    return
  }

  const from = process.env.RESEND_FROM_EMAIL || 'Replyna <no-reply@replyna.me>'
  const subject = 'Defina sua senha no Replyna'
  const safeName = name?.trim() || 'Olá'
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">${safeName}, sua conta foi ativada</h2>
      <p style="margin: 0 0 16px;">
        Clique no botão abaixo para definir sua senha e acessar o Replyna.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${actionLink}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
          Definir minha senha
        </a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #475569;">
        Se o botão não funcionar, copie e cole este link no navegador:
        <br />
        ${actionLink}
      </p>
    </div>
  `
  const text = `Sua conta foi ativada. Defina sua senha: ${actionLink}`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ASAAS][WEBHOOK] Erro Resend:', response.status, errorText)
    } else {
      console.log('[ASAAS][WEBHOOK] Email de senha enviado para', maskEmail(email))
    }
  } catch (err) {
    console.error('[ASAAS][WEBHOOK] Excecao Resend:', err)
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
          .select('id, user_id, status, current_period_start, asaas_payment_id')
          .eq('asaas_subscription_id', subscriptionId)
          .maybeSingle()

        if (!subscriptionRow?.id) {
          console.warn('[ASAAS][WEBHOOK] Pagamento com subscription nao encontrada:', subscriptionId)
          return respondOk({ ok: true, warning: 'Subscription not found' })
        }

        const shouldSendPasswordEmail = !subscriptionRow.asaas_payment_id

        // Idempotencia: se ja atualizou recentemente, nao processa novamente
        if (
          subscriptionRow.status === 'active' &&
          isRecent(subscriptionRow.current_period_start) &&
          subscriptionRow.asaas_payment_id === payment.id
        ) {
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
          })
          .eq('id', subscriptionRow.id)

        if (shouldSendPasswordEmail) {
          const { data: user } = await supabase
            .from('users')
            .select('email, name')
            .eq('id', subscriptionRow.user_id)
            .maybeSingle()

          if (user?.email) {
            await sendPasswordSetupEmail({
              supabase,
              email: user.email,
              name: user.name,
            })
          } else {
            console.warn('[ASAAS][WEBHOOK] Email do usuario nao encontrado para envio de senha')
          }
        }

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
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('id', subscriptionRow.id)

          // Suspender usuario quando pagamento atrasa ou cartao recusado
          await supabase
            .from('users')
            .update({ status: 'suspended' })
            .eq('id', subscriptionRow.user_id)

          console.log('Usuario suspenso apos', payload.event, ':', subscriptionRow.user_id)
        }
      }

      if (payload.event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED') {
        console.log('Cartao recusado para customer:', payment.customer)
      }

      return respondOk({ ok: true })
    }

    if (payload.event === 'PAYMENT_REFUNDED') {
      console.log('Pagamento estornado:', payment.id)

      if (subscriptionId) {
        // Reembolso de assinatura: desativar usuario e cancelar subscription
        const { data: subscriptionRow } = await supabase
          .from('subscriptions')
          .select('id, user_id')
          .eq('asaas_subscription_id', subscriptionId)
          .maybeSingle()

        if (subscriptionRow?.id) {
          await supabase
            .from('subscriptions')
            .update({ status: 'canceled', canceled_at: new Date().toISOString() })
            .eq('id', subscriptionRow.id)

          await supabase
            .from('users')
            .update({ status: 'inactive', plan: 'free', emails_limit: 0, shops_limit: 0 })
            .eq('id', subscriptionRow.user_id)

          console.log('Usuario desativado apos reembolso:', subscriptionRow.user_id)
        }
      } else {
        // Reembolso de compra avulsa (email extra)
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
