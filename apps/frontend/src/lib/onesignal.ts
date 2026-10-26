export type PushSDK = {
  init(options: Record<string, unknown>): Promise<void>
  login(externalId: string): Promise<void>
  logout(): Promise<void>
  Notifications: {
    isPushSupported(): boolean
    permission: boolean
    requestPermission(): Promise<void>
    addEventListener(event: string, callback: () => void): void
    removeEventListener(event: string, callback: () => void): void
  }
  User: {
    PushSubscription: {
      optedIn: boolean
      optIn(): Promise<void>
      optOut(): Promise<void>
      addEventListener(event: string, callback: () => void): void
      removeEventListener(event: string, callback: () => void): void
    }
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(sdk: PushSDK) => void>
  }
}

let client: Promise<PushSDK> | undefined
let identityWork: Promise<unknown> = Promise.resolve()

// Serializa login/logout para no asociar una cuenta anterior después de salir.
export function pushIdentityTask<T>(task: () => Promise<T>): Promise<T> {
  const next = identityWork.catch(() => undefined).then(task)
  identityWork = next
  return next
}

export function getPushClient(): Promise<PushSDK> {
  if (client) return client
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  if (!appId) return Promise.reject(new Error('Las notificaciones todavía no están configuradas.'))
  client = new Promise((resolve, reject) => {
    let expired = false
    const timer = window.setTimeout(() => {
      expired = true
      reject(new Error('No se pudo cargar OneSignal. Revisá la conexión o los bloqueadores.'))
    }, 15000)
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (sdk) => {
      if (expired) return
      try {
        await sdk.init({
          appId,
          serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/push/onesignal/' },
          allowLocalhostAsSecureOrigin: process.env.NODE_ENV !== 'production',
          notifyButton: { enable: false },
          welcomeNotification: { disable: true },
          promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
        })
        window.clearTimeout(timer)
        resolve(sdk)
      } catch {
        window.clearTimeout(timer)
        reject(new Error('No se pudo iniciar OneSignal. Revisá la configuración del sitio.'))
      }
    })
    if (!document.getElementById('onesignal-sdk')) {
      const script = document.createElement('script')
      script.id = 'onesignal-sdk'
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
      script.defer = true
      script.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error('No se pudo cargar OneSignal. Revisá la conexión.'))
      }
      document.head.appendChild(script)
    }
  })
  return client
}

export async function disconnectPush() {
  if (!client) return
  await pushIdentityTask(async () => {
    const sdk = await client!
    await sdk.User.PushSubscription.optOut()
    await sdk.logout()
  })
}
