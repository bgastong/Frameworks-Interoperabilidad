"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"

import { getToken } from "@/lib/auth"

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener("community-hub:session-expired", onStoreChange)
  return () => window.removeEventListener("community-hub:session-expired", onStoreChange)
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const token = useSyncExternalStore(subscribe, getToken, () => undefined)

  useEffect(() => {
    if (token === null) router.replace(`/login${window.location.search}`)
  }, [token, router])

  return token ? children : null
}
