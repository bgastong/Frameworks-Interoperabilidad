// Proveedor de email para Strapi que envia los correos con la API REST de Resend.
// Docs: https://resend.com/docs/api-reference/emails/send-email
module.exports = {
  init(providerOptions, settings) {
    return {
      async send(options) {
        const { from, to, cc, bcc, replyTo, subject, text, html } = options;

        const respuesta = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${providerOptions.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: from || settings.defaultFrom,
            to,
            cc,
            bcc,
            reply_to: replyTo || settings.defaultReplyTo,
            subject,
            text,
            html,
          }),
        });

        // Resend responde 200 con el id del correo, o un error (401 key invalida, 403 destinatario no permitido, 422 datos invalidos, 429 limite)
        if (!respuesta.ok) {
          const detalle = await respuesta.text();
          throw new Error(`Resend respondio ${respuesta.status}: ${detalle}`);
        }
      },
    };
  },
};
