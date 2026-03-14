export async function fetchBillingPortalUrl(userId: string) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-billing-portal`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ user_id: userId }),
    }
  )

  const data = await response.json()

  if (data.success && data.url) {
    return data.url as string
  }

  throw new Error(data.error || 'Nenhuma fatura encontrada')
}
