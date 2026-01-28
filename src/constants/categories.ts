/**
 * Constantes compartilhadas para categorias de conversas
 * Usar em TODOS os componentes para garantir consistência visual
 */

export type CategoryKey =
  | 'spam'
  | 'duvidas_gerais'
  | 'rastreio'
  | 'troca_devolucao_reembolso'
  | 'edicao_pedido'
  | 'suporte_humano'
  | 'acknowledgment'

/**
 * Cores principais das categorias (para texto e ícones)
 */
export const CATEGORY_COLORS: Record<string, string> = {
  spam: '#dc2626',                    // Vermelho
  duvidas_gerais: '#3b82f6',          // Azul
  rastreio: '#22c55e',                // Verde
  troca_devolucao_reembolso: '#f59e0b', // Laranja/Amarelo
  edicao_pedido: '#8b5cf6',           // Roxo
  suporte_humano: '#ec4899',          // Rosa/Pink
  acknowledgment: '#6b7280',          // Cinza
}

/**
 * Labels das categorias em português
 */
export const CATEGORY_LABELS: Record<string, string> = {
  spam: 'Spam',
  duvidas_gerais: 'Dúvidas gerais',
  rastreio: 'Rastreio',
  troca_devolucao_reembolso: 'Troca/Devolução/Reembolso',
  edicao_pedido: 'Edição de pedido',
  suporte_humano: 'Suporte humano',
  acknowledgment: 'Confirmação',
}

/**
 * Retorna o estilo do badge de categoria (background + cor do texto)
 */
export function getCategoryBadgeStyle(category: string | null): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
  }

  const color = category ? CATEGORY_COLORS[category] : '#6b7280'

  if (!color) {
    return {
      ...base,
      backgroundColor: 'rgba(107, 114, 128, 0.15)',
      color: '#6b7280',
    }
  }

  // Converter hex para rgba com opacidade de 15%
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  return {
    ...base,
    backgroundColor: hexToRgba(color, 0.15),
    color: color,
  }
}

/**
 * Retorna a cor da categoria ou cor padrão
 */
export function getCategoryColor(category: string | null | undefined): string {
  if (!category) return '#6b7280'
  return CATEGORY_COLORS[category] || '#6b7280'
}

/**
 * Retorna o label da categoria ou o valor original
 */
export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Processando...'
  return CATEGORY_LABELS[category] || category
}
