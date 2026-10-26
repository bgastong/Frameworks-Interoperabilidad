"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, User2 } from "lucide-react"

import { getUsername, logout } from "@/lib/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RailBoton } from "@/components/sidebar/comunidades-rail"
import { NotificacionesMenu } from "@/components/notificaciones"
import { disconnectPush } from "@/lib/onesignal"

type Props = {
  expandida: boolean
}

// ** Menú del usuario logueado (pie de la sidebar) **
export function UsuarioMenu({ expandida }: Props) {
  const router = useRouter()
  const [username] = useState(getUsername)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <RailBoton
          icono={
            <span className="flex size-8 shrink-0 items-center justify-center">
              <User2 className="size-4" aria-hidden="true" />
            </span>
          }
          label={username}
          expandida={expandida}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end">
        <NotificacionesMenu />
        <DropdownMenuItem
          onSelect={async () => {
            try { await disconnectPush() } catch { /* La salida local debe funcionar sin red. */ }
            logout()
            router.replace("/login")
          }}
        >
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
