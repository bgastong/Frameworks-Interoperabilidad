import { AuthGuard } from "@/components/auth-guard"
import { Home } from "@/components/home"
import { NotificacionesProvider } from "@/components/notificaciones"

export default function Page() {
  return (
    <AuthGuard>
      <NotificacionesProvider><Home /></NotificacionesProvider>
    </AuthGuard>
  )
}
