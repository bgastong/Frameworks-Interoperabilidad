"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { authenticate, type AuthMode } from "@/lib/auth"
import { VerificacionTurnstile, useTurnstile } from "@/components/verificacion-turnstile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const copy = {
  login: {
    title: "Iniciar sesión",
    description: "Ingresá con tu email y contraseña",
    submit: "Ingresar",
    alt: "¿No tenés cuenta?",
    altLink: "Registrate",
    altHref: "/registro",
  },
  registro: {
    title: "Crear cuenta",
    description: "Completá tus datos para registrarte",
    submit: "Registrarme",
    alt: "¿Ya tenés cuenta?",
    altLink: "Iniciá sesión",
    altHref: "/login",
  },
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const turnstile = useTurnstile()
  const text = copy[mode]

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError("")
    setLoading(true)
    try {
      await authenticate(mode, {
        username: String(data.get("username") ?? ""),
        email: String(data.get("email")),
        password: String(data.get("password")),
      }, turnstile.token)
      // Conservar únicamente el destino del canal, nunca una URL arbitraria.
      const source = new URLSearchParams(window.location.search)
      const destination = new URLSearchParams()
      for (const key of ['comunidad', 'canal']) {
        const value = source.get(key)
        if (value) destination.set(key, value)
      }
      router.replace(destination.size ? `/?${destination}` : "/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado")
      setLoading(false)
      turnstile.reiniciar()
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{text.title}</CardTitle>
          <CardDescription>{text.description}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            {mode === "registro" && (
              <label className="flex flex-col gap-2 text-sm">
                Nombre de usuario
                <Input name="username" required minLength={3} maxLength={30} autoComplete="username" />
              </label>
            )}
            <label className="flex flex-col gap-2 text-sm">
              Email
              <Input name="email" type="email" required autoComplete="email" />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Contraseña
              <Input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>
            {mode === "login" && (
              <Link href="/recuperar" className="-mt-2 self-end text-sm text-muted-foreground underline">
                ¿Olvidaste tu contraseña?
              </Link>
            )}
            <VerificacionTurnstile key={turnstile.clave} accion={mode} onToken={turnstile.onToken} />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="mt-4 flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading || !turnstile.listo}>
              {loading ? "Enviando..." : text.submit}
            </Button>
            <p className="text-sm text-muted-foreground">
              {text.alt}{" "}
              <Link href={text.altHref} className="text-foreground underline">
                {text.altLink}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
