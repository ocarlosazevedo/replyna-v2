import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { getCorsHeaders } from '../_shared/cors.ts'

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { shopify_domain, user_id } = await req.json()

    if (!shopify_domain) {
      return new Response(
        JSON.stringify({ error: 'shopify_domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = getSupabaseAdmin()

    // Check if user is on a paid plan (not trial) - paid users can use any domain
    if (user_id) {
      const { data: userData } = await supabase
        .from('users')
        .select('is_trial')
        .eq('id', user_id)
        .single()

      if (userData && !userData.is_trial) {
        return new Response(
          JSON.stringify({ available: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check if domain was already used for trial
    const { data: existing } = await supabase
      .from('trial_domains')
      .select('id')
      .eq('shopify_domain', shopify_domain)
      .maybeSingle()

    const available = !existing

    return new Response(
      JSON.stringify({
        available,
        reason: available ? undefined : 'Este dominio Shopify ja foi utilizado em um periodo de teste. Assine um plano para continuar.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error checking trial domain:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
