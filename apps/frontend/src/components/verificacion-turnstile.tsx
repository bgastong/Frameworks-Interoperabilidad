"use client"

import { useCallback, useState } from "react"
import { Turnstile } from "@marsidev/react-turnstile"

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""

export type AccionTurnstile = "login" | "registro" | "recuperar"

export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  const reiniciar = useCallback(() => {
    setToken(null)
    setIntento((valor) => valor + 1)
  }, [])

  return {
    token: token ?? undefined,
    listo: !SITE_KEY || token !== null,
    reiniciar,
    clave: intento,
    onToken: setToken,
  }
}

type VerificacionTurnstileProps = {
  accion: AccionTurnstile
  onToken: (token: string | null) => void
}

export function VerificacionTurnstile({ accion, onToken }: VerificacionTurnstileProps) {
  if (!SITE_KEY) return null

  return (
    <Turnstile
      siteKey={SITE_KEY}
      options={{ action: accion, language: "es", theme: "auto", size: "flexible" }}
      onSuccess={onToken}
      onExpire={() => onToken(null)}
      onError={() => onToken(null)}
      className="w-full"
    />
  )
}
