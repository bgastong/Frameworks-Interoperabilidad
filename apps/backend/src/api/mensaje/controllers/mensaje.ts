/**
 * mensaje controller
 */

import { factories } from '@strapi/strapi';
import type { Context } from 'koa';
import { createOneSignal } from '../../../lib/onesignal';

const mensajeUid = 'api::mensaje.mensaje';
const canalUid = 'api::canal.canal';
const membresiaUid = 'api::membresia.membresia';

const LIMITE_HISTORIAL = 50;

type Mensaje = {
  id: number;
  documentId: string;
  contenido: string;
  createdAt: string;
  usuario?: { id: number; username: string } | null;
};

const serializar = ({ id, documentId, contenido, createdAt, usuario }: Mensaje) => ({
  id,
  documentId,
  contenido,
  createdAt,
  usuario: usuario ? { id: usuario.id, username: usuario.username } : null,
});

export default factories.createCoreController(mensajeUid, ({ strapi }) => {
  const canalAccesible = async (ctx: Context, documentId: unknown) => {
    if (typeof documentId !== 'string' || !documentId) {
      ctx.badRequest('Se requiere el canal.');
      return null;
    }

    const canal = await strapi.db.query(canalUid).findOne({
      where: { documentId },
      populate: ['comunidad'],
    });

    if (!canal?.comunidad) {
      ctx.notFound('No se encontró el canal.');
      return null;
    }

    const membresia = await strapi.db.query(membresiaUid).findOne({
      where: { usuario: ctx.state.user.id, comunidad: canal.comunidad.id },
    });

    if (!membresia) {
      ctx.forbidden('No pertenecés a esta comunidad.');
      return null;
    }

    return canal;
  };

  return {
    async find(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }

      const canal = await canalAccesible(ctx, ctx.query.canal);
      if (!canal) {
        return;
      }

      const desde = ctx.query.desde;
      const fecha = typeof desde === 'string' ? new Date(desde) : null;
      if (fecha && Number.isNaN(fecha.getTime())) {
        return ctx.badRequest('El parámetro desde no es una fecha válida.');
      }

      const mensajes: Mensaje[] = await strapi.db.query(mensajeUid).findMany({
        where: {
          canal: canal.id,
          ...(fecha ? { createdAt: { $gt: fecha.toISOString() } } : {}),
        },
        populate: ['usuario'],
        orderBy: { createdAt: 'desc' },
        limit: LIMITE_HISTORIAL,
      });

      ctx.body = { data: mensajes.reverse().map(serializar) };
    },

    async create(ctx) {
      const user = ctx.state.user;
      const data = ctx.request.body?.data;

      if (!user) {
        return ctx.unauthorized();
      }

      const contenido = typeof data?.contenido === 'string' ? data.contenido.trim() : '';
      if (contenido.length < 1 || contenido.length > 3000) {
        return ctx.badRequest('El mensaje debe tener entre 1 y 3000 caracteres.');
      }

      const canal = await canalAccesible(ctx, data?.canal);
      if (!canal) {
        return;
      }

      const creado = await strapi.db.query(mensajeUid).create({
        data: { contenido, canal: canal.id, usuario: user.id },
      });

      // El mensaje ya está persistido. El proveedor no bloquea la respuesta
      // ni genera errores que lleven al cliente a duplicar el mensaje.
      void createOneSignal(strapi).notifyMessage(canal, user.id);

      ctx.status = 201;
      ctx.body = {
        data: serializar({ ...creado, usuario: { id: user.id, username: user.username } }),
      };
    },
  };
});
