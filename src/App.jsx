import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/clientes/Clientes'
import ClienteForm from './pages/clientes/ClienteForm'
import ClienteDetalhe from './pages/clientes/ClienteDetalhe'
import Financeiro from './pages/financeiro/Financeiro'
import Obrigacoes from './pages/obrigacoes/Obrigacoes'
import Legalizacao from './pages/legalizacao/Legalizacao'
import Usuarios from './pages/Usuarios'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-slate-500">Carregando...</div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/novo" element={<ClienteForm />} />
              <Route path="/clientes/:id" element={<ClienteDetalhe />} />
              <Route path="/clientes/:id/editar" element={<ClienteForm />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/obrigacoes" element={<Obrigacoes />} />
              <Route path="/legalizacao" element={<Legalizacao />} />
              <Route path="/usuarios" element={<Usuarios />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
