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
];

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

// Separa "Nombre <email>" en sus dos partes para la plantilla de correo.
function remitente() {
  const valor = process.env.EMAIL_FROM ?? 'Community Hub <onboarding@resend.dev>';
  const partes = valor.match(/^(.*)<(.+)>$/);
  return partes
    ? { name: partes[1].trim(), email: partes[2].trim() }
    : { name: 'Community Hub', email: valor.trim() };
}

// Configura el enlace de recuperacion y deja el correo en español con el remitente de Resend.
async function configurarRecuperacion(strapi: Core.Strapi) {
  const store = strapi.store({ type: 'plugin', name: 'users-permissions' });

  const avanzadas = (await store.get({ key: 'advanced' })) as Record<string, unknown>;
  await store.set({
    key: 'advanced',
    value: { ...avanzadas, email_reset_password: `${FRONTEND_URL}/restablecer` },
  });

  const plantillas = (await store.get({ key: 'email' })) as Record<string, unknown>;
  await store.set({
    key: 'email',
    value: {
      ...plantillas,
      reset_password: {
        display: 'Email.template.reset_password',
        icon: 'sync',
        options: {
          from: remitente(),
          response_email: '',
          object: 'Restablecé tu contraseña de Community Hub',
          message: `<p>Hola <%= USER.username %>,</p>
<p>Recibimos un pedido para restablecer tu contraseña. Para elegir una nueva, hacé clic en el siguiente enlace:</p>
<p><a href="<%= URL %>?code=<%= TOKEN %>">Restablecer contraseña</a></p>
<p>El enlace vence en una hora y se puede usar una sola vez. Si no lo pediste, ignorá este correo.</p>`,
        },
      },
    },
  });
}

export default {
  // Los permisos de acceso a la API se crean al arrancar en una instalación nueva.
  // Cada controlador comprueba además la pertenencia y el rol en el recurso.
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await configurarRecuperacion(strapi);
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
