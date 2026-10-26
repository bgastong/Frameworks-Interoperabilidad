"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { getToken } from "@/lib/auth"
import { strapiRequest } from "@/lib/strapi"
import { disconnectPush, getPushClient, pushIdentityTask, type PushSDK } from "@/lib/onesignal"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type PushContext = { enabled: boolean; appId?: string; externalId?: string }
type State = { sdk: PushSDK | null; ready: boolean; subscribed: boolean; error: string }
const Notifications = createContext<State & { openSettings: () => void }>({
  sdk: null, ready: false, subscribed: false, error: "", openSettings: () => undefined,
})

export function NotificacionesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ sdk: null, ready: false, subscribed: false, error: "" })
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) return
    let current = true
    let sdk: PushSDK | undefined
    const token = getToken()
    const update = () => {
      if (current && sdk) setState({ sdk, ready: true, subscribed: !!sdk.User.PushSubscription.optedIn, error: "" })
    }
    async function start() {
      try {
        const context = await strapiRequest<PushContext>('/api/notificaciones/contexto', (data) => data as PushContext)
        if (!current || getToken() !== token) return
        if (!context.enabled || context.appId !== process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || !context.externalId) {
          throw new Error('Las notificaciones no están configuradas en el servidor.')
        }
        sdk = await getPushClient()
        await pushIdentityTask(async () => {
          if (!current || getToken() !== token) return
          await sdk!.login(context.externalId!)
        })
        if (!current) return
        if (!sdk.Notifications.isPushSupported()) throw new Error('Este navegador no admite notificaciones push.')
        sdk.User.PushSubscription.addEventListener('change', update)
        sdk.Notifications.addEventListener('permissionChange', update)
        update()
      } catch (error) {
        if (current) setState({ sdk: null, ready: true, subscribed: false,
          error: error instanceof Error ? error.message : 'No se pudieron iniciar las notificaciones.' })
      }
    }
    void start()
    const sessionChanged = () => { void disconnectPush().catch(() => undefined) }
    window.addEventListener('community-hub:session-expired', sessionChanged)
    const storageChanged = (event: StorageEvent) => {
      if (event.key === 'token') window.location.reload()
    }
    window.addEventListener('storage', storageChanged)
    return () => {
      current = false
      sdk?.User.PushSubscription.removeEventListener('change', update)
      sdk?.Notifications.removeEventListener('permissionChange', update)
      window.removeEventListener('community-hub:session-expired', sessionChanged)
      window.removeEventListener('storage', storageChanged)
      // No desvincular en un desmontaje normal: el push debe seguir al cerrar la pestaña.
    }
  }, [])
  return <Notifications.Provider value={{ ...state, openSettings: () => setOpen(true) }}>
    {children}
    <NotificacionesDialog open={open} onOpenChange={setOpen} />
  </Notifications.Provider>
}

export function NotificacionesMenu() {
  const { openSettings } = useContext(Notifications)
  if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) return null
  return <DropdownMenuItem onSelect={openSettings}><Bell /> Notificaciones</DropdownMenuItem>
}

function NotificacionesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const state = useContext(Notifications)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = state.subscribed
  if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) return null

  async function toggle() {
    if (!state.sdk) return
    setBusy(true)
    setError('')
    try {
      if (active) await state.sdk.User.PushSubscription.optOut()
      else {
        if (Notification.permission === 'denied') {
          throw new Error('Las notificaciones están bloqueadas. Habilitalas en los permisos del sitio en tu navegador.')
        }
        // optIn ya solicita permiso y registra el push si hace falta. Pedir
        // permiso antes por separado puede disparar dos registros del SDK.
        await state.sdk.User.PushSubscription.optIn()
        if (!state.sdk.Notifications.permission) {
          throw new Error('No se concedió el permiso. Podés seguir usando el chat y volver a intentarlo.')
        }
        if (!state.sdk.User.PushSubscription.optedIn) {
          throw new Error('El navegador no pudo registrar las notificaciones. En Brave, revisá la opción de servicios de Google para mensajes push y reiniciá el navegador.')
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(/push service|registration failed|AbortError/i.test(message)
        ? 'No se pudo conectar con el servicio push del navegador. En Brave, activá los servicios de Google para mensajes push y reiniciá el navegador.'
        : message || 'No se pudo cambiar la suscripción.')
    } finally { setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Notificaciones de mensajes</DialogTitle>
        <DialogDescription>
          Recibí avisos de nuevos mensajes de tus comunidades, incluso cuando no estés en el chat.
          Los avisos no incluyen el contenido de los mensajes.
        </DialogDescription>
        <p role="status" className="text-sm">
          {!state.ready ? 'Preparando notificaciones...' : active ? 'Notificaciones activadas en este navegador.' : 'Notificaciones desactivadas en este navegador.'}
        </p>
        {(error || state.error) && <p role="alert" className="text-sm text-destructive">{error || state.error}</p>}
        <Button disabled={busy || !state.sdk || !state.ready} onClick={() => void toggle()}>
          {busy ? 'Guardando...' : active ? 'Desactivar notificaciones' : 'Activar notificaciones'}
        </Button>
      </DialogContent>
  </Dialog>
}
