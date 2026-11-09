import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { PublicOnly, RequireRole } from './auth/guards'
import { AdminLayout, ClientLayout, DriverLayout } from './components/Layouts'
import Landing from './pages/Landing'
import { ForgotPassword, Login, Register, ResetPassword } from './pages/auth/AuthPages'
import { Notifications, Placeholder, Profile } from './pages/Shared'
import { ClientHome, ClientOrders } from './pages/client/ClientPages'
import { DriverHome } from './pages/driver/DriverPages'
import { AdminDrivers, AdminHome } from './pages/admin/AdminPages'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route element={<PublicOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/registo" element={<Register />} />
            <Route path="/recuperar" element={<ForgotPassword />} />
          </Route>
          <Route path="/nova-palavra-passe" element={<ResetPassword />} />

          <Route element={<RequireRole role="client" />}>
            <Route path="/app" element={<ClientLayout />}>
              <Route index element={<ClientHome />} />
              <Route path="pedidos" element={<ClientOrders />} />
              <Route path="notificacoes" element={<Notifications />} />
              <Route path="perfil" element={<Profile />} />
            </Route>
          </Route>

          <Route element={<RequireRole role="driver" />}>
            <Route path="/driver" element={<DriverLayout />}>
              <Route index element={<DriverHome />} />
              <Route path="servicos" element={<Placeholder title="Serviços" phase="Fase 3" />} />
              <Route path="ganhos" element={<Placeholder title="Ganhos" phase="Fase 3">Mostrará pagamentos directos e processados pela app em separado.</Placeholder>} />
              <Route path="notificacoes" element={<Notifications />} />
              <Route path="perfil" element={<Profile />} />
            </Route>
          </Route>

          <Route element={<RequireRole role="admin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="motoristas" element={<AdminDrivers />} />
              <Route path="pedidos" element={<Placeholder title="Pedidos" phase="Fase 3" />} />
              <Route path="clientes" element={<Placeholder title="Clientes" phase="Fase 3" />} />
              <Route path="pagamentos" element={<Placeholder title="Pagamentos" phase="Fase 3" />} />
              <Route path="tarifas" element={<Placeholder title="Tarifas" phase="Fase 3">Preço por litro, taxa base e mínimos, configuráveis por zona.</Placeholder>} />
              <Route path="zonas" element={<Placeholder title="Zonas de cobertura" phase="Fase 3" />} />
              <Route path="reclamacoes" element={<Placeholder title="Reclamações" phase="Fase 3" />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
