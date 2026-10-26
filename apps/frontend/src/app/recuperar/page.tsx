"use client"

import { useState } from "react"
import Link from "next/link"

import { pedirRecuperacion } from "@/lib/auth"
import { VerificacionTurnstile, useTurnstile } from "@/components/verificacion-turnstile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function RecuperarPage() {
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const turnstile = useTurnstile()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get("email"))
    setError("")
    setLoading(true)
    try {
      await pedirRecuperacion(email, turnstile.token)
      setEnviado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado")
      turnstile.reiniciar()
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Recuperar contraseña</CardTitle>
          <CardDescription>Te enviamos un enlace para elegir una contraseña nueva</CardDescription>
        </CardHeader>
        {enviado ? (
          <CardContent className="flex flex-col gap-4">
            <p role="status" className="text-sm">
              Si el email está registrado, vas a recibir un correo con el enlace. Vence en una hora y se puede usar una sola vez.
            </p>
            <Link href="/login" className="text-sm underline">
              Volver a iniciar sesión
            </Link>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm">
                Email
                <Input name="email" type="email" required autoComplete="email" />
              </label>
              <VerificacionTurnstile key={turnstile.clave} accion="recuperar" onToken={turnstile.onToken} />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
            <CardFooter className="mt-4 flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || !turnstile.listo}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </Button>
              <Link href="/login" className="text-sm text-muted-foreground underline">
                Volver a iniciar sesión
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </main>
  )
}