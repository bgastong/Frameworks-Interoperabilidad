import type { Core } from '@strapi/strapi';

const permisosAutenticado = [
  'api::comunidad.comunidad.create',
  'api::comunidad.comunidad.join',
  'api::comunidad.comunidad.find',
  'api::comunidad.comunidad.findOne',
  'api::membresia.membresia.find',
  'api::membresia.membresia.findOne',
  'api::membresia.membresia.update',
  'api::membresia.membresia.delete',
  'api::canal.canal.find',
  'api::canal.canal.findOne',
  'api::canal.canal.create',
  'api::canal.canal.update',
  'api::canal.canal.delete',
  'api::mensaje.mensaje.find',
  'api::mensaje.mensaje.create',
  'api::notificacion.notificacion.context',
];

export default {
  // Los permisos de acceso a la API se crean al arrancar en una instalación nueva.
  // Cada controlador comprueba además la pertenencia y el rol en el recurso.
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const rol = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' }, populate: ['permissions'] });

    if (!rol) {
      return;
    }

    const existentes = rol.permissions.map((permiso: { action: string }) => permiso.action);

    for (const action of permisosAutenticado) {
      if (!existentes.includes(action)) {
        await strapi.db
          .query('plugin::users-permissions.permission')
          .create({ data: { action, role: rol.id } });
      }
    }
  },
};
