import { CheckCircle, XCircle, Download } from 'lucide-react'
import { primaryBtnStyle, secondaryBtnStyle } from './constants'

// ===================== Loading Screen =====================
export function LoadingScreen() {
  return (
    <div style={{ textAlign: 'center', padding: '64px 32px', animation: 'fadeIn 0.4s ease' }}>
      <div style={{
        width: '56px',
        height: '56px',
        border: '4px solid rgba(70, 114, 236, 0.2)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 24px',
      }} />
      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
        Processando sua solicitação...
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
        Isso pode levar um momento. Por favor, não feche esta página.
      </div>
    </div>
  )
}

// ===================== Success Screen =====================
interface SuccessProps {
  returnId: string | null
  customerEmail: string
}

export function SuccessScreen({ returnId, customerEmail }: SuccessProps) {
  const refNumber = returnId ? returnId.substring(0, 8).toUpperCase() : '--------'

  const handleDownloadPDF = () => {
    if (!returnId) return
    const pdfUrl = `/api/returns/generate-pdf?return_id=${returnId}&customer_email=${encodeURIComponent(customerEmail)}`
    window.open(pdfUrl, '_blank')
  }

  return (
    <div style={{ textAlign: 'center', padding: '48px 32px', animation: 'fadeIn 0.4s ease' }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: '#22c55e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)',
      }}>
        <CheckCircle size={44} color="#fff" />
      </div>

      <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
        Solicitação Enviada!
      </div>
      <div style={{
        fontSize: '15px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
        maxWidth: '480px',
        margin: '0 auto',
      }}>
        Sua solicitação de devolução foi recebida. Analisaremos seu envio e entraremos em contato em 3-5 dias úteis com nossa decisão.
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        display: 'inline-block',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Número de Referência:</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
          {refNumber}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <button onClick={handleDownloadPDF} style={{ ...primaryBtnStyle, gap: '8px' }}>
          <Download size={18} />
          Baixar Comprovante da Solicitação (PDF)
        </button>
      </div>
    </div>
  )
}

// ===================== Out of Period Screen =====================
interface OutOfPeriodProps {
  onReset: () => void
}

export function OutOfPeriodScreen({ onReset }: OutOfPeriodProps) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 32px', animation: 'fadeIn 0.4s ease' }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)',
      }}>
        <XCircle size={44} color="#fff" />
      </div>

      <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444', marginBottom: '16px' }}>
        Período de Devolução Expirado
      </div>
      <div style={{
        fontSize: '15px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
        maxWidth: '480px',
        margin: '0 auto',
      }}>
        Infelizmente, seu pedido foi recebido há mais de 14 dias e está fora do nosso período de devolução e troca.
        De acordo com nossa política de devolução, só podemos processar devoluções para pedidos recebidos dentro de 14 dias da data da solicitação.
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: '10px',
        borderLeft: '4px solid #f59e0b',
        textAlign: 'left',
      }}>
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
          <strong>Política de Devolução:</strong><br />
          Devoluções e trocas devem ser solicitadas em até 14 dias após a entrega. Os produtos devem estar em condição original, sem uso e com toda a embalagem original.
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <button onClick={onReset} style={secondaryBtnStyle}>
          Voltar ao Início
        </button>
      </div>
    </div>
  )
}
