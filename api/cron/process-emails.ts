import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Cron endpoint que chama a Edge Function process-emails do Supabase
 * Configurado para rodar a cada 15 minutos via vercel.json
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verificar se é uma chamada do cron do Vercel
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET

  // Se CRON_SECRET estiver configurado, validar
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/process-emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Edge Function error:', data)
      return res.status(response.status).json(data)
    }

    console.log('Process emails completed:', data)
    return res.status(200).json(data)
  } catch (error) {
    console.error('Cron error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
