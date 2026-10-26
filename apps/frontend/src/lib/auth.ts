export const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337"
const TOKEN_KEY = "token"
const USER_KEY = "username"

export type AuthMode = "login" | "registro"

export type AuthFields = {
  username: string
  email: string
  password: string
}

export async function authenticate(mode: AuthMode, fields: AuthFields, turnstileToken?: string) {
  const path = mode === "login" ? "/api/auth/local" : "/api/auth/local/register"
  const credenciales =
    mode === "login"
      ? { identifier: fields.email, password: fields.password }
      : fields
  const body = turnstileToken ? { ...credenciales, turnstileToken } : credenciales

  const res = await fetch(API_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    const message = json?.error?.message
    const traducciones: Record<string, string> = {
      "Invalid identifier or password": "El email o la contraseña son incorrectos.",
      "Email or Username are already taken": "El email o el nombre de usuario ya están registrados.",
      "Your account has been blocked by an administrator": "Tu cuenta está bloqueada.",
    }
    throw new Error(traducciones[message] ?? message ?? "No se pudo completar la operación")
  }

  localStorage.setItem(TOKEN_KEY, json.jwt)
  localStorage.setItem(USER_KEY, json.user.username)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUsername() {
  return localStorage.getItem(USER_KEY) ?? "Usuario"
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function expireSession() {
  logout()
  window.dispatchEvent(new Event("community-hub:session-expired"))
}

// Hace un POST a Strapi y traduce los errores de recuperacion de contraseña.
async function postAuth(path: string, body: unknown) {
  const res = await fetch(API_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    const message = json?.error?.message
    const traducciones: Record<string, string> = {
      "Incorrect code provided": "El enlace no es válido o ya fue usado. Pedí uno nuevo.",
      "Passwords do not match": "Las contraseñas no coinciden.",
    }
    throw new Error(traducciones[message] ?? message ?? "No se pudo completar la operación")
  }
  return json
}

// Pide a Strapi que mande el mail de recuperacion (lo envia con Resend).
export async function pedirRecuperacion(email: string, turnstileToken?: string) {
  await postAuth("/api/auth/forgot-password", turnstileToken ? { email, turnstileToken } : { email })
}

// Cambia la contraseña con el codigo del mail y deja la sesion iniciada.
export async function restablecerPassword(code: string, password: string, passwordConfirmation: string) {
  const json = await postAuth("/api/auth/reset-password", { code, password, passwordConfirmation })
  localStorage.setItem(TOKEN_KEY, json.jwt)
  localStorage.setItem(USER_KEY, json.user.username)
}