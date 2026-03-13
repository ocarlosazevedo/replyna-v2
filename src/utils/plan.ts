export const normalizePlanSlug = (value?: string | null): string => {
  const normalized = (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')

  if (!normalized) return ''
  if (normalized === 'free-trial' || normalized === 'free_trial') return 'trial'
  return normalized
}

const toTitleCase = (value: string): string =>
  value
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export const getPlanDisplayName = (value?: string | null): string => {
  const slug = normalizePlanSlug(value)

  switch (slug) {
    case 'starter':
      return 'Starter'
    case 'business':
      return 'Business'
    case 'enterprise':
      return 'Enterprise'
    case 'scale':
      return 'Scale'
    case 'high-scale':
      return 'High Scale'
    case 'trial':
      return 'Free Trial'
    case 'team_member':
      return 'Membro de Equipe'
    case 'free':
      return 'Free'
    default:
      if (!slug) return '—'
      return toTitleCase(slug)
  }
}
