// Agrega vencimiento al enlace de recuperacion de contraseña del plugin de usuarios.
const USUARIO = 'plugin::users-permissions.user';

// Minutos de validez del enlace (configurable para la demo).
const VIGENCIA_MS = Number(process.env.RESET_PASSWORD_MINUTOS ?? 60) * 60 * 1000;

export default (plugin: any) => {
  const crearAuth = plugin.controllers.auth;

  plugin.controllers.auth = ({ strapi }: { strapi: any }) => {
    const auth = crearAuth({ strapi });

    return {
      ...auth,

      // Despues de generar el codigo y mandar el mail, guarda cuando se pidio.
      async forgotPassword(ctx: any) {
        await auth.forgotPassword(ctx);

        const email = String(ctx.request.body?.email ?? '').toLowerCase();
        const usuario = await strapi.db.query(USUARIO).findOne({ where: { email } });

        if (usuario?.resetPasswordToken) {
          await strapi.db.query(USUARIO).update({
            where: { id: usuario.id },
            data: { resetPasswordSentAt: new Date() },
          });
        }
      },

      // Antes de cambiar la contraseña, rechaza el codigo si ya vencio.
      async resetPassword(ctx: any) {
        const code = ctx.request.body?.code;

        if (typeof code === 'string' && code) {
          const usuario = await strapi.db.query(USUARIO).findOne({ where: { resetPasswordToken: code } });
          const pedido = usuario?.resetPasswordSentAt ? new Date(usuario.resetPasswordSentAt).getTime() : 0;

          if (usuario && Date.now() - pedido > VIGENCIA_MS) {
            await strapi.db.query(USUARIO).update({
              where: { id: usuario.id },
              data: { resetPasswordToken: null, resetPasswordSentAt: null },
            });
            return ctx.badRequest('El enlace venció. Pedí uno nuevo.');
          }
        }

        return auth.resetPassword(ctx);
      },
    };
  };

  return plugin;
};
