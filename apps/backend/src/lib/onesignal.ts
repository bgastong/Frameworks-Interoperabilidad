import { createHmac, randomUUID } from 'node:crypto';
import type { Core } from '@strapi/strapi';

type Canal = {
  id: number;
  documentId: string;
  comunidad: { id: number; documentId: string };
};

// Solo el servidor deriva los identificadores. No se publican IDs predecibles
// de Strapi como external_id ni se aceptan destinatarios enviados por el cliente.
export function createOneSignal(
  strapi: Core.Strapi,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
) {
  const appId = env.ONESIGNAL_APP_ID?.trim();
  const apiKey = env.ONESIGNAL_REST_API_KEY?.trim();
  const secret = env.ONESIGNAL_IDENTITY_SECRET;
  let origin: string | undefined;
  try {
    const url = new URL(env.FRONTEND_URL ?? '');
    if (url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      origin = url.origin;
    }
  } catch { /* Sin configuración, el chat funciona sin push. */ }

  const enabled = Boolean(appId && apiKey && secret && secret.length >= 32 && origin);
  const externalId = (userId: number) => createHmac('sha256', secret!)
    .update(`community-hub:${appId}:${userId}`).digest('hex');

  return {
    context(userId: number) {
      return enabled
        ? { enabled: true, appId, externalId: externalId(userId) }
        : { enabled: false };
    },

    async notifyMessage(canal: Canal, authorId: number) {
      if (!enabled) return;
      try {
        const memberships = await strapi.db.query('api::membresia.membresia').findMany({
          where: { comunidad: canal.comunidad.id, usuario: { id: { $ne: authorId } } },
          populate: ['usuario'],
        });
        const recipients = [...new Set<string>(memberships.flatMap(
          (m: { usuario?: { id: number; blocked?: boolean } | null }) =>
            m.usuario && m.usuario.id !== authorId && !m.usuario.blocked
              ? [externalId(m.usuario.id)] : [],
        ))];
        if (!recipients.length) return;

        const url = new URL('/', origin);
        url.searchParams.set('comunidad', canal.comunidad.documentId);
        url.searchParams.set('canal', canal.documentId);

        // No enviamos texto, nombres ni códigos privados: un push ya en tránsito
        // puede llegar después de una expulsión. El enlace vuelve a autorizarse.
        for (let start = 0; start < recipients.length; start += 20000) {
          const response = await fetcher('https://api.onesignal.com/notifications?c=push', {
            method: 'POST',
            headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              app_id: appId,
              target_channel: 'push',
              include_aliases: { external_id: recipients.slice(start, start + 20000) },
              headings: { en: 'Community Hub', es: 'Community Hub' },
              contents: { en: 'You have a new message. Open the chat to read it.',
                es: 'Tenés un mensaje nuevo. Abrí el chat para leerlo.' },
              url: url.toString(),
              ttl: 300,
              idempotency_key: randomUUID(),
            }),
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) {
            strapi.log.warn(`[OneSignal] Envío rechazado (HTTP ${response.status}). El mensaje se guardó.`);
            continue;
          }
          const result = await response.json() as { id?: string; errors?: unknown };
          if (!result.id) strapi.log.info('[OneSignal] Sin suscripciones alcanzables para este envío.');
          else if (result.errors) strapi.log.warn('[OneSignal] Envío aceptado con destinatarios omitidos.');
          else strapi.log.info('[OneSignal] Notificación aceptada por el proveedor.');
        }
      } catch {
        // No registrar credenciales, aliases ni respuestas completas del proveedor.
        strapi.log.warn('[OneSignal] No se pudo enviar el push. El mensaje se guardó.');
      }
    },
  };
}
