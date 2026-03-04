export const RETURN_REASONS = [
  { value: '', label: 'Selecione um motivo...' },
  { value: 'defective', label: 'Produto defeituoso' },
  { value: 'not_as_described', label: 'Não confere com a descrição' },
  { value: 'wrong_item', label: 'Item errado enviado' },
  { value: 'quality', label: 'Problema de qualidade' },
  { value: 'size_fit', label: 'Problemas de tamanho/ajuste' },
  { value: 'changed_mind', label: 'Mudei de ideia' },
  { value: 'late_delivery', label: 'Chegou muito tarde' },
  { value: 'missing_parts', label: 'Peças faltando' },
  { value: 'packaging_damaged', label: 'Danificado no transporte' },
  { value: 'other', label: 'Outro' },
]

export const WHEN_NOTICED_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'upon_delivery', label: 'Na entrega' },
  { value: 'opening_package', label: 'Ao abrir a embalagem' },
  { value: 'first_use', label: 'No primeiro uso' },
  { value: 'after_few_uses', label: 'Após alguns usos' },
  { value: 'after_week', label: 'Após uma semana ou mais' },
]

export const TRIED_RESOLVE_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'no', label: 'Não, não tentei nada' },
  { value: 'yes_failed', label: 'Sim, mas não funcionou' },
  { value: 'yes_partial', label: 'Sim, parcialmente resolvido' },
  { value: 'contacted_support', label: 'Entrei em contato com o suporte antes' },
]

export const PRODUCT_USED_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'no_sealed', label: 'Não, ainda lacrado' },
  { value: 'no_opened', label: 'Não, aberto mas não usado' },
  { value: 'yes_once', label: 'Sim, usado uma vez' },
  { value: 'yes_few_times', label: 'Sim, usado algumas vezes' },
  { value: 'yes_regularly', label: 'Sim, usado regularmente' },
]

export const RESOLUTION_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'refund', label: 'Reembolso Integral (para o método de pagamento original)' },
  { value: 'exchange', label: 'Troca de Produto' },
  { value: 'store_credit', label: 'Crédito na Loja' },
]

export const PROGRESS_MAP: Record<number, number> = {
  2: 12.5,
  3: 25,
  4: 37.5,
  5: 50,
  6: 62.5,
  7: 75,
  8: 87.5,
  9: 100,
}

export const TERMS_TEXT = `Acordo da Política de Devolução e Troca

Ao enviar esta solicitação de devolução, você reconhece e concorda com os seguintes termos e condições:

1. Elegibilidade do Período de Devolução
As solicitações de devolução e troca DEVEM ser enviadas dentro de 14 dias corridos a partir da data em que você recebeu seu pedido. Pedidos recebidos há mais de 14 dias antes da data da solicitação NÃO são elegíveis para devolução, troca ou reembolso sob nenhuma circunstância. Este período de 14 dias é rigorosamente aplicado para garantir o processamento justo de todas as solicitações dos clientes.

2. Requisitos de Condição do Produto
Os produtos devem ser devolvidos em sua condição original e sem uso para serem elegíveis para reembolso ou troca. Isso significa:
• O produto NÃO deve ter sido usado, vestido, lavado ou alterado de nenhuma forma
• Todas as etiquetas, rótulos e embalagens originais devem estar intactos e sem danos
• O produto NÃO deve apresentar sinais de uso, dano ou modificação
• Todos os acessórios, manuais e componentes devem estar incluídos
• O produto NÃO deve ter sido exposto a água, produtos químicos ou outras substâncias
Produtos que não atenderem a essas condições serão rejeitados e devolvidos a você por sua conta.

3. Produtos Inelegíveis
Os seguintes produtos NÃO são elegíveis para devolução ou troca:
• Produtos que foram violados, danificados, usados ou apresentam sinais de desgaste
• Produtos com lacres rompidos ou embalagem original ausente
• Produtos que foram modificados, reparados ou alterados de qualquer forma
• Produtos adquiridos há mais de 14 dias antes da data da solicitação de devolução
• Itens de liquidação, venda final ou com desconto especial (exceto se defeituosos na chegada)

4. Processo de Inspeção
Todos os itens devolvidos passam por uma inspeção abrangente no recebimento. Nossa equipe verificará se os produtos atendem a todos os requisitos de condição listados acima. Este processo de inspeção pode levar de 5 a 10 dias úteis. Reservamo-nos o direito de rejeitar devoluções que não atendam aos nossos critérios rigorosos de devolução. Devoluções rejeitadas serão enviadas de volta a você, e você será responsável por todos os custos de envio da devolução.

5. Processamento de Reembolso e Troca
• Reembolsos: Reembolsos aprovados serão processados diretamente no seu método de pagamento original dentro de 5 a 10 dias úteis após a aprovação da inspeção. Os custos de envio originais não são reembolsáveis, a menos que a devolução seja devido a erro nosso (produto defeituoso, item errado enviado).
• Trocas: As trocas de produtos estão sujeitas à disponibilidade de estoque. Se o item de troca solicitado não estiver disponível, um reembolso integral será emitido. Cobriremos os custos de envio para trocas aprovadas devido a erro nosso; caso contrário, você é responsável pelo envio da devolução.
• Crédito na Loja: O crédito na loja será emitido dentro de 3 a 5 dias úteis e pode ser usado para compras futuras.

6. Documentação Necessária
Você deve fornecer comprovante de endereço válido (datado nos últimos 90 dias) e documento de identificação emitido pelo governo. A não apresentação desses documentos resultará na negação automática da sua solicitação de devolução.

7. Reclamações Fraudulentas e Declarações Falsas
O envio de informações falsas ou enganosas em uma solicitação de devolução é estritamente proibido e constitui fraude. Isso inclui, mas não se limita a:
• Alegar falsamente que um produto é defeituoso quando não é
• Fornecer fotos alteradas ou manipuladas
• Usar a identidade ou documentos de outra pessoa
• Alegar não recebimento quando o produto foi entregue
Tais ações podem resultar em negação imediata da sua solicitação, suspensão permanente da conta, ação legal e denúncia às autoridades competentes.

8. Privacidade e Uso de Dados
As informações fornecidas neste formulário, incluindo documentos pessoais e fotos, serão usadas exclusivamente para processar sua solicitação de devolução, prevenção de fraudes e melhoria de nossos serviços. Mantemos sigilo rigoroso e cumprimos todas as regulamentações de proteção de dados aplicáveis. Suas informações podem ser retidas para fins de registro e conformidade legal.

9. Limitação de Responsabilidade
Nossa responsabilidade é estritamente limitada ao preço de compra do produto devolvido. Não somos responsáveis por quaisquer danos indiretos, incidentais, consequenciais ou punitivos decorrentes do uso do produto, atrasos na devolução ou devoluções negadas.

10. Autoridade de Decisão Final
Reservamo-nos o direito de tomar a decisão final sobre todas as solicitações de devolução e troca. Nossa decisão é baseada nas informações e evidências que você fornece, nos resultados da inspeção do produto e na conformidade com esta política. Todas as decisões são finais e não estão sujeitas a recurso.

11. Legislação Aplicável
Este acordo é regido pelas leis de proteção ao consumidor aplicáveis na jurisdição para onde o produto foi enviado. Ao enviar esta solicitação, você concorda em resolver quaisquer disputas através dos canais legais apropriados nessa jurisdição.`

export const UPLOAD_LABELS: Record<string, string> = {
  product_front: 'Foto do Produto (Vista Frontal)',
  product_back: 'Foto do Produto (Vista Traseira)',
  defect: 'Foto do Defeito/Problema',
  packaging: 'Foto da Embalagem',
  label: 'Foto da Etiqueta de Envio',
  id_document: 'Enviar Documento de Identidade',
  proof_of_address: 'Comprovante de Endereço',
}

// Step labels for the progress indicator
export const STEP_LABELS: Record<number, string> = {
  2: 'Identidade',
  3: 'Pedido',
  4: 'Motivo',
  5: 'Detalhes',
  6: 'Fotos',
  7: 'Endereço',
  8: 'Resolução',
  9: 'Termos',
}

// Shared inline style objects for consistency
export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  border: '1.5px solid var(--input-border)',
  borderRadius: '10px',
  fontSize: '14px',
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
  backgroundColor: 'var(--input-bg)',
  color: 'var(--text-primary)',
  transition: 'all 0.2s ease',
  outline: 'none',
}

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: '40px',
}

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: '120px',
  resize: 'vertical' as const,
  lineHeight: '1.6',
}

export const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '13px 28px',
  fontSize: '15px',
  fontWeight: 600,
  fontFamily: 'inherit',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  background: 'linear-gradient(135deg, var(--accent), #3558c8)',
  color: '#ffffff',
  minWidth: '130px',
  boxShadow: '0 2px 8px rgba(70, 114, 236, 0.25)',
}

export const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'transparent',
  backgroundColor: 'transparent',
  border: '1.5px solid var(--border-color)',
  color: 'var(--text-primary)',
  boxShadow: 'none',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: '8px',
}

export const hintStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
  marginTop: '6px',
  lineHeight: '1.4',
}

export const errorBoxStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  color: '#dc2626',
  padding: '14px 16px',
  borderRadius: '10px',
  fontSize: '14px',
  marginBottom: '16px',
  borderLeft: '4px solid #ef4444',
}
