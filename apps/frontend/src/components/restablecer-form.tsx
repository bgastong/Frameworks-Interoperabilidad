"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { restablecerPassword } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function RestablecerForm({ code }: { code: string }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError("")
    setLoading(true)
    try {
      await restablecerPassword(code, String(data.get("password")), String(data.get("confirmacion")))
      router.replace("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado")
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Elegí una contraseña nueva</CardTitle>
          <CardDescription>Después vas a entrar directamente a tu cuenta</CardDescription>
        </CardHeader>
        {!code ? (
          <CardContent className="flex flex-col gap-4">
            <p role="alert" className="text-sm text-destructive">
              El enlace no es válido. Pedí uno nuevo.
            </p>
            <Link href="/recuperar" className="text-sm underline">
              Pedir otro enlace
            </Link>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm">
                Contraseña nueva
                <Input name="password" type="password" required minLength={6} autoComplete="new-password" />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Repetir contraseña
                <Input name="confirmacion" type="password" required minLength={6} autoComplete="new-password" />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}{" "}
                  <Link href="/recuperar" className="underline">
                    Pedir otro enlace
                  </Link>
                </p>
              )}
            </CardContent>
            <CardFooter className="mt-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando..." : "Cambiar contraseña"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </main>
  )
}