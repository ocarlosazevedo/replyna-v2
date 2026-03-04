import jsPDF from 'jspdf'
import type { FormFields } from './types'
import type { Order, LineItem } from './types'
import { TERMS_TEXT } from './constants'

interface PDFData {
  returnId: string
  customerEmail: string
  fields: FormFields
  selectedOrder: Order
  signature: string | null
  shopName: string | null
  locale: string
}

const REASON_LABELS: Record<string, string> = {
  defective: 'Produto defeituoso / Defective product',
  not_as_described: 'Não confere com a descrição / Not as described',
  wrong_item: 'Item errado enviado / Wrong item sent',
  quality: 'Problema de qualidade / Quality issue',
  size_fit: 'Problemas de tamanho/ajuste / Size/fit issues',
  changed_mind: 'Mudei de ideia / Changed mind',
  late_delivery: 'Chegou muito tarde / Late delivery',
  missing_parts: 'Peças faltando / Missing parts',
  packaging_damaged: 'Danificado no transporte / Damaged in shipping',
  other: 'Outro / Other',
}

const WHEN_NOTICED_LABELS: Record<string, string> = {
  upon_delivery: 'Na entrega / Upon delivery',
  opening_package: 'Ao abrir a embalagem / Opening package',
  first_use: 'No primeiro uso / First use',
  after_few_uses: 'Após alguns usos / After a few uses',
  after_week: 'Após uma semana ou mais / After a week or more',
}

const TRIED_RESOLVE_LABELS: Record<string, string> = {
  no: 'Não tentou / Did not try',
  yes_failed: 'Sim, mas não funcionou / Yes, but failed',
  yes_partial: 'Sim, parcialmente resolvido / Yes, partially resolved',
  contacted_support: 'Entrou em contato com o suporte / Contacted support',
}

const PRODUCT_USED_LABELS: Record<string, string> = {
  no_sealed: 'Não, ainda lacrado / No, still sealed',
  no_opened: 'Não, aberto mas não usado / No, opened but unused',
  yes_once: 'Sim, usado uma vez / Yes, used once',
  yes_few_times: 'Sim, usado algumas vezes / Yes, used a few times',
  yes_regularly: 'Sim, usado regularmente / Yes, used regularly',
}

const RESOLUTION_LABELS: Record<string, string> = {
  refund: 'Reembolso Integral / Full Refund',
  exchange: 'Troca de Produto / Product Exchange',
  store_credit: 'Crédito na Loja / Store Credit',
}

export function generateReturnPDF(data: PDFData) {
  const { returnId, customerEmail, fields, selectedOrder, signature, shopName } = data
  const refNumber = returnId.substring(0, 8).toUpperCase()
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = 210
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = 20

  const DARK_BLUE = [30, 58, 138] as const
  const MEDIUM_BLUE = [59, 130, 246] as const
  const DARK_GRAY = [31, 41, 55] as const
  const MEDIUM_GRAY = [107, 114, 128] as const
  const LIGHT_BG = [248, 250, 252] as const

  function checkPageBreak(needed: number) {
    if (y + needed > 275) {
      doc.addPage()
      y = 20
    }
  }

  function drawLine() {
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  function sectionTitle(title: string) {
    checkPageBreak(16)
    doc.setFillColor(...DARK_BLUE)
    doc.roundedRect(margin, y, contentWidth, 9, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text(title, margin + 5, y + 6.5)
    y += 14
  }

  function fieldRow(label: string, value: string) {
    checkPageBreak(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...MEDIUM_GRAY)
    doc.text(label, margin + 2, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...DARK_GRAY)
    const lines = doc.splitTextToSize(value || '—', contentWidth - 4)
    doc.text(lines, margin + 2, y + 5)
    y += 5 + lines.length * 4.5 + 2
  }

  // ==================== HEADER ====================
  doc.setFillColor(...DARK_BLUE)
  doc.rect(0, 0, pageWidth, 42, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('COMPROVANTE DE SOLICITAÇÃO', pageWidth / 2, 15, { align: 'center' })
  doc.text('DE DEVOLUÇÃO', pageWidth / 2, 23, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(200, 210, 255)
  const headerSubtitle = shopName
    ? `Return Request Receipt — ${shopName}`
    : 'Return Request Receipt'
  doc.text(headerSubtitle, pageWidth / 2, 32, { align: 'center' })

  y = 50

  // Reference number and date box
  doc.setFillColor(...LIGHT_BG)
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F')
  doc.setDrawColor(...MEDIUM_BLUE)
  doc.setLineWidth(0.5)
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK_BLUE)
  doc.text(`Protocolo / Reference: #${refNumber}`, margin + 5, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MEDIUM_GRAY)
  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  doc.text(`Emitido em / Issued on: ${dateStr}`, margin + 5, y + 13)

  doc.text(`ID: ${returnId}`, pageWidth - margin - 5, y + 7, { align: 'right' })

  y += 26

  // ==================== 1. CUSTOMER INFO ====================
  sectionTitle('1. DADOS DO SOLICITANTE / CUSTOMER INFORMATION')

  fieldRow('Nome Completo / Full Name:', fields.fullName)
  fieldRow('E-mail:', customerEmail)
  fieldRow('Telefone / Phone:', fields.customerPhone)
  if (fields.customerDocument) {
    fieldRow('Documento / Document:', fields.customerDocument)
  }

  y += 2
  drawLine()

  // ==================== 2. ORDER DETAILS ====================
  sectionTitle('2. DADOS DO PEDIDO / ORDER DETAILS')

  fieldRow('Número do Pedido / Order Number:', selectedOrder.order_number)
  fieldRow('Data do Pedido / Order Date:', selectedOrder.order_date)
  fieldRow('Total:', `${selectedOrder.currency} ${selectedOrder.total}`)
  fieldRow('Data de Recebimento / Received On:', fields.receiveDate)

  if (selectedOrder.line_items && selectedOrder.line_items.length > 0) {
    checkPageBreak(12 + selectedOrder.line_items.length * 8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...MEDIUM_GRAY)
    doc.text('Itens do Pedido / Order Items:', margin + 2, y)
    y += 6

    selectedOrder.line_items.forEach((item: LineItem) => {
      checkPageBreak(10)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...DARK_GRAY)
      const itemText = `- ${item.title} (x${item.quantity}) -- ${selectedOrder.currency} ${item.price}`
      const itemLines = doc.splitTextToSize(itemText, contentWidth - 10)
      doc.text(itemLines, margin + 6, y)
      y += itemLines.length * 4 + 2
    })
    y += 2
  }

  drawLine()

  // ==================== 3. RETURN REASON ====================
  sectionTitle('3. MOTIVO DA DEVOLUÇÃO / RETURN REASON')

  fieldRow('Motivo Principal / Main Reason:', REASON_LABELS[fields.returnReason] || fields.returnReason)
  fieldRow('Descrição Detalhada / Detailed Description:', fields.returnDescription)

  drawLine()

  // ==================== 4. PROBLEM DETAILS ====================
  sectionTitle('4. DETALHES DO PROBLEMA / PROBLEM DETAILS')

  fieldRow('Quando Notou / When Noticed:', WHEN_NOTICED_LABELS[fields.whenNoticed] || fields.whenNoticed)
  fieldRow('Tentou Resolver / Tried to Resolve:', TRIED_RESOLVE_LABELS[fields.triedResolve] || fields.triedResolve)
  if (fields.resolutionAttempts) {
    fieldRow('Tentativas de Resolução / Resolution Attempts:', fields.resolutionAttempts)
  }
  fieldRow('Produto Utilizado / Product Used:', PRODUCT_USED_LABELS[fields.productUsed] || fields.productUsed)

  drawLine()

  // ==================== 5. ADDRESS ====================
  sectionTitle('5. ENDEREÇO DE DEVOLUÇÃO / RETURN ADDRESS')

  const addressParts = [
    fields.addressLine1,
    fields.addressLine2,
    `${fields.city}, ${fields.state} - ${fields.zipCode}`,
    fields.country,
  ].filter(Boolean)
  fieldRow('Endereço / Address:', addressParts.join('\n'))

  drawLine()

  // ==================== 6. RESOLUTION ====================
  sectionTitle('6. RESOLUÇÃO SOLICITADA / REQUESTED RESOLUTION')

  fieldRow('Tipo de Resolução / Resolution Type:', RESOLUTION_LABELS[fields.resolutionType] || fields.resolutionType)
  if (fields.additionalComments) {
    fieldRow('Comentários Adicionais / Additional Comments:', fields.additionalComments)
  }

  drawLine()

  // ==================== 7. TERMS ACCEPTED ====================
  sectionTitle('7. TERMOS ACEITOS / TERMS ACCEPTED')

  checkPageBreak(30)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...DARK_GRAY)

  const termsChecks = [
    '[X] Li e compreendo os termos e condições da política de devolução.\n     I have read and understand the return policy terms and conditions.',
    '[X] Confirmo que todas as informações fornecidas são precisas e verdadeiras.\n     I confirm that all information provided is accurate and truthful.',
    '[X] Entendo que informações falsas podem resultar na negação da solicitação.\n     I understand that false information may result in denial of my request.',
  ]

  termsChecks.forEach(term => {
    checkPageBreak(12)
    const lines = doc.splitTextToSize(term, contentWidth - 8)
    doc.text(lines, margin + 4, y)
    y += lines.length * 4 + 3
  })

  y += 4
  drawLine()

  // ==================== 8. FULL TERMS ====================
  sectionTitle('8. POLÍTICA COMPLETA / FULL RETURN POLICY')

  checkPageBreak(20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MEDIUM_GRAY)

  const termsLines = doc.splitTextToSize(TERMS_TEXT, contentWidth - 8)
  for (let i = 0; i < termsLines.length; i++) {
    checkPageBreak(5)
    doc.text(termsLines[i], margin + 4, y)
    y += 3.2
  }

  y += 4
  drawLine()

  // ==================== 9. APPLICABLE LAWS ====================
  sectionTitle('9. LEGISLAÇÃO APLICÁVEL / APPLICABLE LEGISLATION')

  checkPageBreak(60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...DARK_GRAY)

  const lawsText = `Este documento está amparado pelas seguintes legislações / This document is supported by the following legislation:

• Código de Defesa do Consumidor (CDC) — Lei nº 8.078/1990
  Art. 18: Responsabilidade por vícios de qualidade do produto.
  Art. 26: Prazos para reclamação de vícios aparentes (30 dias para não duráveis, 90 dias para duráveis).
  Art. 49: Direito de arrependimento — o consumidor pode desistir do contrato no prazo de 7 dias a contar do recebimento do produto quando a compra ocorrer fora do estabelecimento comercial (compras online).

• Decreto Federal nº 7.962/2013 — Regulamentação do Comércio Eletrônico
  Art. 5º: O fornecedor deve informar, de forma clara e ostensiva, os meios adequados e eficazes para o exercício do direito de arrependimento pelo consumidor.

• Lei Geral de Proteção de Dados (LGPD) — Lei nº 13.709/2018
  Os dados pessoais coletados neste formulário são tratados conforme a LGPD, sendo utilizados exclusivamente para o processamento desta solicitação de devolução, prevenção de fraudes e cumprimento de obrigações legais.

• Marco Civil da Internet — Lei nº 12.965/2014
  Proteção dos dados e privacidade do consumidor em transações realizadas pela internet.

• Regulamento Geral de Proteção de Dados (GDPR) — Regulamento (UE) 2016/679
  Para consumidores na União Europeia, aplicam-se as disposições do GDPR relativas ao tratamento de dados pessoais.

• Diretiva 2011/83/UE — Direitos do Consumidor (União Europeia)
  Art. 9-14: Direito de retratação de 14 dias para compras à distância dentro da UE.`

  const lawLines = doc.splitTextToSize(lawsText, contentWidth - 8)
  for (let i = 0; i < lawLines.length; i++) {
    checkPageBreak(5)
    doc.text(lawLines[i], margin + 4, y)
    y += 3.8
  }

  y += 6
  drawLine()

  // ==================== 10. SIGNATURE ====================
  sectionTitle('10. ASSINATURA DIGITAL / DIGITAL SIGNATURE')

  checkPageBreak(50)

  if (signature) {
    try {
      doc.addImage(signature, 'PNG', margin + 10, y, 60, 25)
      y += 28
    } catch {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(...MEDIUM_GRAY)
      doc.text('[Assinatura digital registrada / Digital signature recorded]', margin + 4, y)
      y += 8
    }
  }

  doc.setDrawColor(...DARK_BLUE)
  doc.setLineWidth(0.5)
  doc.line(margin + 10, y, margin + 80, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...DARK_GRAY)
  doc.text(fields.fullName, margin + 10, y)
  y += 5
  doc.setFontSize(8)
  doc.setTextColor(...MEDIUM_GRAY)
  doc.text(`Assinado digitalmente em / Digitally signed on: ${dateStr}`, margin + 10, y)

  y += 10

  // ==================== FOOTER ====================
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)

    // Footer line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(margin, 285, pageWidth - margin, 285)

    // Footer text
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MEDIUM_GRAY)
    doc.text(
      `Documento gerado automaticamente — ${shopName || 'Replyna'} — Protocolo #${refNumber}`,
      pageWidth / 2, 289,
      { align: 'center' }
    )
    doc.text(`Página ${p} de ${totalPages}`, pageWidth / 2, 293, { align: 'center' })
  }

  // Save
  doc.save(`comprovante_devolucao_${refNumber}.pdf`)
}
