import type { Core } from '@strapi/strapi';

const URL_VERIFICACION = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type Configuracion = {
  rutas?: Record<string, string>;
};

type RespuestaVerificacion = {
  success: boolean;
  action?: string;
  'error-codes'?: string[];
};

async function verificarToken(secret: string, token: string, ip: string) {
  const respuesta = await fetch(URL_VERIFICACION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(10000),
  });
  return (await respuesta.json()) as RespuestaVerificacion;
}

export default (config: Configuracion, { strapi }: { strapi: Core.Strapi }) => {
  const rutas = config.rutas ?? {};
  let avisoMostrado = false;

  return async (ctx: any, next: () => Promise<void>) => {
    const accionEsperada = rutas[ctx.path];
    if (ctx.method !== 'POST' || !accionEsperada) {
      return next();
    }

    const body = ctx.request.body ?? {};
    const token = body.turnstileToken;
    delete body.turnstileToken;

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        return ctx.serviceUnavailable('La verificación anti-bots no está configurada.');
      }
      if (!avisoMostrado) {
        strapi.log.warn('TURNSTILE_SECRET_KEY no está definida: la verificación anti-bots queda desactivada.');
        avisoMostrado = true;
      }
      return next();
    }

    if (typeof token !== 'string' || !token) {
      return ctx.badRequest('Completá la verificación anti-bots.');
    }

    let resultado: RespuestaVerificacion;
    try {
      resultado = await verificarToken(secret, token, ctx.request.ip);
    } catch {
      return ctx.badGateway('No se pudo comprobar la verificación anti-bots. Intentá de nuevo.');
    }

    if (!resultado.success) {
      strapi.log.info(`Turnstile rechazó ${ctx.path}: ${(resultado['error-codes'] ?? []).join(', ')}`);
      return ctx.forbidden('La verificación anti-bots falló. Intentá de nuevo.');
    }

    if (resultado.action && resultado.action !== accionEsperada) {
      return ctx.forbidden('La verificación anti-bots no corresponde a este formulario.');
    }

    return next();
  };
};
