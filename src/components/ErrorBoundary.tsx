import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        padding: '24px',
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '40px 32px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239,68,68,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '28px',
          }}>
            ⚠️
          </div>
          <h2 style={{
            color: 'var(--text-primary)',
            fontSize: '20px',
            fontWeight: 700,
            margin: '0 0 12px',
          }}>
            Algo deu errado
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            margin: '0 0 24px',
            lineHeight: '1.6',
          }}>
            Ocorreu um erro inesperado nesta página. Tente recarregar — se o problema persistir, entre em contato com o suporte.
          </p>
          {this.state.error && (
            <details style={{
              textAlign: 'left',
              marginBottom: '24px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}>
              <summary style={{
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                userSelect: 'none',
              }}>
                Detalhes do erro
              </summary>
              <pre style={{
                color: 'var(--text-secondary)',
                fontSize: '11px',
                marginTop: '8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReload}
            style={{
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recarregar página
          </button>
        </div>
      </div>
    )
  }
}
