# Notificaciones push con OneSignal

## Alcance

El backend envía un aviso a los miembros actuales de la comunidad después de
guardar un mensaje, excluyendo al autor y a las cuentas bloqueadas. El usuario
activa o desactiva el push en su menú. El click abre la comunidad y el canal;
el destino también se conserva al iniciar sesión. La API vuelve a comprobar
la membresía, por lo que el enlace no concede acceso.

Solo se envía un aviso genérico, sin contenido, nombres ni invitaciones. Esto
evita revelar información en la pantalla bloqueada o en un push que ya estaba
en tránsito cuando alguien fue expulsado. El polling existente sigue siendo
responsable de actualizar el chat; el push no lo reemplaza.

## Configuración

Usar Node.js 24 para esta instalación. La dependencia nativa better-sqlite3
12.8.0 del repositorio no pudo compilarse con Node.js 26 en Windows.

1. Crear una aplicación en OneSignal y configurar Web Push con **Custom Code**.
2. Configurar exactamente el origen del frontend. Para desarrollo, usar
   `http://localhost:3000` y habilitar la opción de pruebas locales del panel.
   No alternar `localhost` y `127.0.0.1`. En producción usar HTTPS. Utilizar
   aplicaciones OneSignal separadas para desarrollo y producción.
3. En `apps/frontend/.env.local` agregar:

   ```dotenv
   NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
   NEXT_PUBLIC_ONESIGNAL_APP_ID=app-id-del-panel
   ```

4. En `apps/backend/.env` agregar:

   ```dotenv
   FRONTEND_URL=http://localhost:3000
   ONESIGNAL_APP_ID=el-mismo-app-id
   ONESIGNAL_REST_API_KEY=app-api-key-privada
   ONESIGNAL_IDENTITY_SECRET=secreto-aleatorio-de-al-menos-32-caracteres
   ```

   Generar el último valor localmente con
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   No compartirlo, versionarlo ni cambiarlo entre reinicios: identifica a los
   usuarios del entorno. Una rotación requiere volver a vincular sus navegadores.

5. Reiniciar ambos servicios. Los valores `NEXT_PUBLIC_*` se incorporan al
   compilar: reconstruir el frontend si se usa una compilación de producción.
6. Comprobar que
   `http://localhost:3000/push/onesignal/OneSignalSDKWorker.js` es público y devuelve
   el `importScripts`. El SDK usa el scope `/push/onesignal/`.
7. Iniciar sesión y abrir el menú del usuario → **Notificaciones** → **Activar
   notificaciones**. El permiso solo se solicita con esa acción. Si se rechazó,
   cambiarlo en los permisos del sitio del navegador.

Sin configuración completa, Strapi conserva el funcionamiento del chat sin
enviar push. No se necesitan cambios en el registro ni en Resend/reCAPTCHA.

## Identidad y cierre de sesión

`GET /api/notificaciones/contexto` requiere JWT y devuelve solo el App ID público
y un alias opaco del usuario autenticado. El servidor lo deriva mediante HMAC;
no usa IDs numéricos predecibles ni acepta un destinatario del navegador.
Cada envío consulta las membresías vigentes y utiliza esos mismos aliases.

El Web SDK v16 todavía no admite Token Identity Verification según la
documentación consultada. **No activar ese toggle en el panel para esta app web**:
impediría registrar suscripciones. El alias opaco reduce la suplantación por
enumeración, pero no equivale a verificación de identidad del SDK. No exponer
aliases en listados de miembros, logs ni capturas compartidas.

Al cerrar sesión desde el menú se espera `optOut()` y `logout()`. Al vencer la
sesión se intenta desvincular la suscripción. Al cerrar una pestaña normalmente
no se desvincula: ese es el propósito del push. Si la red falla durante el
logout, la desvinculación remota puede no completarse; por eso los avisos no
incluyen datos privados. Una sesión de navegador compartida entre cuentas o
pestañas no permite mantener identidades push diferentes simultáneamente.

## Pruebas

`npm run test:push` verifica destinatarios, autor excluido, cuentas bloqueadas,
expulsiones, configuración incompleta, errores y ausencia de suscriptores,
sin usar credenciales reales ni contactar a OneSignal.

`node --test tests/onesignal-ui.test.mjs` prueba la interfaz con SDK y respuestas
de API simulados. Requiere Next dev en `http://127.0.0.1:3100` con
`NEXT_PUBLIC_ONESIGNAL_APP_ID=00000000-0000-4000-8000-000000000001` y un navegador
de Playwright instalado. No usar ese App ID ficticio para una prueba real.

Prueba manual de integración (requiere cuenta y claves reales):

1. Crear usuarios A y B en perfiles de navegador distintos, fuera de incógnito.
2. Unir ambos a la misma comunidad y activar push para B.
3. Enviar un mensaje como A. Comprobar el aviso en B y el enlace al canal.
4. Activar push en A y comprobar que no recibe avisos de sus propios mensajes.
5. Con un usuario C ajeno, comprobar que no recibe el aviso.
6. Expulsar B y enviar otro mensaje: no debe ser destinatario de nuevos envíos.
7. Desactivar las notificaciones en B y comprobar que el chat continúa funcionando.
8. Cerrar sesión en B y comprobar la desvinculación en el panel.
9. Denegar permisos y probar una clave de envío inválida: el mensaje debe seguir
   guardándose sin duplicados y el error debe informarse sin revelar secretos.

Guardar capturas del permiso, la notificación, el canal abierto y el resultado
del proveedor. No presentar las pruebas simuladas como recepción real.

### Resultado de la validación del 26 de octubre de 2026

- Las seis pruebas unitarias de push pasaron.
- El recorrido de API pasó sus nueve verificaciones, incluyendo autenticación
  del contexto push y rechazo de selección de identidades ajenas.
- Pasó la prueba de interfaz con proveedor simulado: destino del canal,
  activación, desactivación, permiso denegado y cierre de sesión.
- Pasaron el análisis estático del frontend y la comprobación TypeScript.
  Las compilaciones del backend y del frontend se verificaron durante la
  implementación; después del ajuste de suscripción se volvieron a comprobar
  TypeScript, lint y el recorrido simulado de interfaz.
- La consulta autenticada a OneSignal respondió HTTP 200 y mostró
  suscripciones habilitadas con token para los dos usuarios de prueba.
- Valentín confirmó la recepción real de los avisos y, posteriormente, que las
  pruebas manuales pasaban y las capturas estaban tomadas. Las capturas se
  conservan por separado; todavía no se incorporaron al repositorio.

Issue de implementación: https://github.com/valentin-bustamante/community-hub/issues/45

### Problemas encontrados y resolución

La App API Key es distinta del App ID. Copiar el App ID en
`ONESIGNAL_REST_API_KEY` produjo HTTP 401 al consultar OneSignal. Se corrigió
guardando una App API Key válida y reiniciando el backend. No guardar esa clave
en variables `NEXT_PUBLIC_*`.

En Brave se observó bloqueo de carga del SDK y fallos del servicio push. Para
la prueba local se revisaron los bloqueos específicos del sitio y la opción
de servicios de Google para mensajes push. Un token vacío no constituye una
suscripción activa. El permiso del navegador por sí solo tampoco confirma que
el proveedor tenga una suscripción alcanzable.

## Límites

El envío es de mejor esfuerzo y tiene un timeout de cinco segundos por lote.
Se hace fuera de la respuesta del chat: no hay cola persistente ni reintentos
automáticos; reiniciar el proceso puede perder un aviso pendiente. OneSignal
puede aceptar un mensaje sin suscriptores alcanzables y eso se registra aparte.
La aceptación no demuestra recepción. El navegador y el sistema operativo
determinan la entrega; revisar la configuración de notificaciones y no molestar.

## Comparación para la Actividad 2

OneSignal ofrece Web SDK, gestión de suscripciones, targeting por usuario y
panel de envíos. FCM también permite push web mediante tokens, SDK y service
worker. Se eligió OneSignal por su gestión integrada de suscripciones y sus
herramientas para observar la demostración. Ambos requieren permisos del
navegador, configuración del frontend y un emisor autenticado en el servidor.
Consultar cuotas y condiciones del plan de la cuenta antes de la entrega.

## Fuentes oficiales

- https://documentation.onesignal.com/docs/en/web-sdk-reference
- https://documentation.onesignal.com/docs/en/onesignal-service-worker
- https://documentation.onesignal.com/docs/en/identity-verification
- https://documentation.onesignal.com/reference/push-notification
- https://firebase.google.com/docs/cloud-messaging/web/get-started
