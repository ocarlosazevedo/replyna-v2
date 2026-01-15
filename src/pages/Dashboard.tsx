import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Painel de Controle</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card - Lojas */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl mb-2">🏪</div>
          <div className="text-3xl font-bold text-gray-800">0</div>
          <div className="text-gray-600">Lojas cadastradas</div>
        </div>

        {/* Card - Emails respondidos */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl mb-2">📧</div>
          <div className="text-3xl font-bold text-gray-800">0</div>
          <div className="text-gray-600">Emails respondidos</div>
        </div>

        {/* Card - Emails restantes */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl mb-2">📊</div>
          <div className="text-3xl font-bold text-gray-800">300</div>
          <div className="text-gray-600">Emails restantes</div>
        </div>

        {/* Card - Plano */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-3xl mb-2">⭐</div>
          <div className="text-3xl font-bold text-primary-600">Starter</div>
          <div className="text-gray-600">Plano atual</div>
        </div>
      </div>

      {/* Boas vindas */}
      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Bem-vindo, {user?.user_metadata?.name || 'usuário'}! 👋
        </h2>
        <p className="text-gray-600">
          Comece adicionando sua primeira loja para ativar o atendimento automático por email.
        </p>
      </div>
    </div>
  )
}
