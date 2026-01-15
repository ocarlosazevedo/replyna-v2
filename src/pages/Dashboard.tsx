import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user } = useAuth()

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>Painel de Controle</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
        {/* Card - Lojas */}
        <div style={cardStyle}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏪</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>0</div>
          <div style={{ color: '#6b7280' }}>Lojas cadastradas</div>
        </div>

        {/* Card - Emails respondidos */}
        <div style={cardStyle}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📧</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>0</div>
          <div style={{ color: '#6b7280' }}>Emails respondidos</div>
        </div>

        {/* Card - Emails restantes */}
        <div style={cardStyle}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>300</div>
          <div style={{ color: '#6b7280' }}>Emails restantes</div>
        </div>

        {/* Card - Plano */}
        <div style={cardStyle}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⭐</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>Starter</div>
          <div style={{ color: '#6b7280' }}>Plano atual</div>
        </div>
      </div>

      {/* Boas vindas */}
      <div style={{ ...cardStyle, marginTop: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
          Bem-vindo, {user?.user_metadata?.name || 'usuário'}! 👋
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Comece adicionando sua primeira loja para ativar o atendimento automático por email.
        </p>
      </div>
    </div>
  )
}
