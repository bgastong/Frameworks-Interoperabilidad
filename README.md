# Community Hub

**Trabajo Práctico 2 — Frameworks e Interoperabilidad**

Community Hub es una aplicación web de comunidades con canales de texto,
mensajes y membresías. Combina un frontend en Next.js con un CMS Strapi que
expone una API protegida. Este repositorio reúne el código, las instrucciones
para ejecutarlo y la documentación técnica y de validación para la entrega.

## Resumen

El proyecto adapta una interfaz de chat de referencia a una aplicación en la
que cada usuario puede crear comunidades, invitar a otras personas, organizar
conversaciones en canales y administrar las membresías. Strapi conserva los
datos y aplica las reglas de acceso; Next.js presenta el contexto activo,
consume la API autenticada y actualiza la experiencia de usuario.

La aplicación cubre autenticación, comunidades, canales, mensajes y roles de
propietario, administrador y miembro. La estructura de navegación y el panel
de integrantes se ajustan al tamaño de pantalla. La validación funcional se
registra por recorrido y se reproduce con pruebas de API y de navegador sobre
una base descartable.

## Objetivos

- Integrar un frontend React/Next.js con un CMS headless y su API.
- Modelar comunidades, canales, mensajes y membresías con sus relaciones.
- Aplicar autenticación y autorización en el servidor, según la pertenencia y
  el rol del usuario.
- Adaptar el template de referencia y reemplazar los datos de demostración por
  información persistida en Strapi.
- Documentar las decisiones de implementación y verificar los recorridos
  principales con datos de prueba aislados.

## Funcionalidades

- Registro, inicio y cierre de sesión.
- Creación de comunidades y unión mediante código de invitación.
- Canales por comunidad, con acciones de administración para el propietario.
- Historial y envío de mensajes de texto por canal.
- Listado de integrantes y cambio de roles o expulsión por parte del
  propietario.
- Estados de carga, error y colección vacía en las vistas integradas.
- Navegación adaptable: selector de comunidades y panel de integrantes en
  pantallas angostas; navegación y panel lateral en pantallas grandes.

### Actividad 2 de TP3

La integración opcional de OneSignal agrega avisos push de nuevos mensajes.
Configuración, pruebas y comparación con FCM: [docs/onesignal.md](docs/onesignal.md).
Las claves privadas se guardan únicamente en el entorno del backend.

## Arquitectura

```text
Navegador
   │
   ├── Next.js / React
   │     ├── autenticación y sesión de interfaz
   │     ├── comunidades, canales, mensajes y miembros
   │     └── cliente HTTP autenticado
   │
   └── Strapi 5
         ├── API REST y controladores de dominio
         ├── Users & Permissions y autorización por membresía
         └── SQLite local
```

El frontend envía el JWT de la sesión como `Authorization: Bearer …` en las
consultas protegidas. El backend identifica al usuario desde ese token y
comprueba su membresía antes de devolver canales, mensajes o integrantes.
Ocultar una acción en la interfaz mejora la experiencia, pero no reemplaza
esa verificación en Strapi.

### Modelo de datos

| Entidad | Datos principales | Relación |
| --- | --- | --- |
| Comunidad | Nombre, código de invitación privado e icono opcional | Tiene canales y membresías |
| Canal | Nombre de hasta 20 caracteres | Pertenece a una comunidad y contiene mensajes |
| Mensaje | Contenido de 1 a 3000 caracteres y fecha de creación | Pertenece a un canal y a un usuario |
| Membresía | Rol: `propietario`, `administrador` o `miembro` | Vincula un usuario con una comunidad |
| Usuario | Identidad gestionada por el plugin Users & Permissions | Puede tener membresías y enviar mensajes |

Las comunidades requieren un nombre de entre 5 y 30 caracteres. Al crear una,
Strapi genera el código de invitación, un canal `general` y la membresía de
propietario. Los códigos son privados y se entregan solo mediante el endpoint
autorizado de invitación.

### Permisos principales

| Acción | Regla |
| --- | --- |
| Consultar comunidades propias | Usuario autenticado; la respuesta contiene solo sus membresías |
| Unirse a una comunidad | Usuario autenticado con un código válido |
| Leer canales, mensajes o integrantes | Requiere pertenecer a la comunidad correspondiente |
| Enviar mensajes | Requiere pertenecer a la comunidad del canal |
| Crear, renombrar o eliminar canales | Propietario de la comunidad |
| Cambiar roles o expulsar integrantes | Propietario de la comunidad |
| Salir de una comunidad | El propio miembro; el propietario debe transferir primero la propiedad |

Strapi carga los permisos del rol `Authenticated` al iniciar. Los controladores
de dominio aplican además la autorización por recurso y por comunidad.

## Tecnologías

| Área | Tecnología |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript |
| Interfaz | Tailwind CSS, shadcn/ui, Radix UI, Lucide |
| CMS y API | Strapi 5, TypeScript, Users & Permissions |
| Persistencia local | SQLite mediante `better-sqlite3` |
| Organización | Monorepo npm workspaces |

## Requisitos

- Node.js 22 o 24 LTS recomendado; mínimo 20.9, dentro del rango admitido por Strapi (`<=26.x`).
- npm.
- Git para clonar el repositorio.

La base SQLite es local y comienza vacía. Para uso académico o de desarrollo,
cada instalación mantiene sus propios datos; no se sincronizan entre clones.

## Instalación y ejecución

Desde la raíz del repositorio:

```sh
npm ci
```

Generar el entorno del backend con secretos aleatorios (se conserva un `.env`
existente):

```sh
npm run setup
```

También se puede copiar `apps/backend/.env.example` a `.env` y reemplazar sus
valores de ejemplo. No versionar secretos ni bases de datos locales.

Iniciar Strapi y Next.js juntos:

```sh
npm run dev
```

| Servicio | Dirección |
| --- | --- |
| Aplicación web | <http://localhost:3000> |
| API y administración de Strapi | <http://localhost:1337> |
| Panel de administración | <http://localhost:1337/admin> |

La primera vez, Strapi solicita crear el usuario administrador del CMS. La
aplicación registra usuarios desde sus pantallas de `/registro` e
`/login`; son cuentas distintas del administrador de Strapi.

Para iniciar cada servicio por separado:

```sh
npm run dev:backend
npm run dev:frontend
```

Si Strapi usa otra URL, copiar `apps/frontend/.env.example` a
`apps/frontend/.env.local` y actualizar `NEXT_PUBLIC_STRAPI_URL`.

## Comprobaciones

Comprobación estática completa y compilación:

```sh
npm run lint
npm run build
```

Pruebas funcionales reproducibles (Node.js y Chromium):

```sh
npx playwright install chromium
npm run verify
```

`verify` requiere la compilación previa. Inicia Strapi con una base SQLite
descartable en el puerto 1337 y el frontend compilado en el puerto 3100. Cerrar
antes cualquier servicio local que ocupe esos puertos. El build debe usar la
URL de API predeterminada `http://localhost:1337`. El script fuerza SQLite, crea cuentas
temporales, ejecuta los recorridos y elimina su base al terminar. Los logs de
los servicios quedan en la carpeta temporal del sistema (`community-service-0.log`
y `community-service-1.log`). Las capturas de cada ejecución quedan en la
subcarpeta temporal `community-hub-ui`; el comando no modifica las capturas
versionadas. Para actualizarlas expresamente, definir `UPDATE_SCREENSHOTS=1`
antes de ejecutar la verificación y revisar el diff antes de incluirlas en un PR.

Para validar solo la API, sin instalar Chromium:

```sh
npm run verify:api
```

También se pueden ejecutar `npm run test:api` y `npm run test:ui` contra
servicios locales ya iniciados, configurando `TEST_API_URL` y `TEST_WEB_URL`.
Esos comandos crean datos de prueba: usarlos en una instancia descartable.
Las pruebas no aceptan hosts remotos. La matriz distingue los casos reales
de los estados simulados en el navegador.

## Documentación técnica

- [Origen, estructura y capturas del template de referencia](docs/T-04-template-original.md)
- [Adaptación y validación de la vista principal](docs/T-14-vista-principal.md)
- [Arquitectura, decisiones y mantenimiento](docs/ARQUITECTURA.md)
- [Matriz de pruebas funcionales y resultados](docs/T-16-pruebas-funcionales.md)
- [Instrucciones específicas del frontend](apps/frontend/README.md)
- [Modelos, endpoints y permisos del backend](apps/backend/README.md)
- [Tablero del proyecto](https://github.com/users/valentin-bustamante/projects/1)
- [Issues, alcance y criterios de aceptación](https://github.com/valentin-bustamante/community-hub/issues)

### Referencia del template

El punto de partida documentado es `chat-template`, variante `whatsapp-mock`,
atribuido a Manoj (`rayimanoj8`) en 21st.dev. La documentación del template
registra la atribución y la licencia indicada, aclara que la ficha original ya
no está disponible y conserva capturas históricas del snapshot previo a la
adaptación. No se redistribuyen fotografías de avatares externos. El detalle y
las fuentes consultadas están en
[`docs/T-04-template-original.md`](docs/T-04-template-original.md).

## Decisiones y límites conocidos

- **JWT en `localStorage`:** la interfaz guarda el token y el nombre de usuario
  en el navegador. Las consultas protegidas no se cachean; una respuesta `401`
  limpia la sesión y vuelve al inicio de sesión. Esta decisión permite la
  integración directa con la API, pero hace importante evitar scripts
  inyectados y no guardar tokens en logs o capturas.
- **Autorización en Strapi:** la pertenencia y los permisos por rol se
  verifican en los controladores del backend; el estado visual del frontend
  no se considera un control de seguridad.
- **Actualización de mensajes:** el historial inicial devuelve hasta 50
  mensajes y el cliente consulta mensajes nuevos cada tres segundos. No se usa
  una conexión de tiempo real.
- **Datos de desarrollo:** la instalación usa SQLite local. No incluye
  sincronización, despliegue ni configuración de una base de producción.
- **Pruebas:** el runner nativo de Node.js valida la API y Playwright recorre
  la interfaz. Las colecciones vacías y los errores de conexión se simulan
  explícitamente para revisar sus estados visuales.

## Estructura del repositorio

```text
apps/
├── backend/                 # Strapi, API, modelos y permisos
└── frontend/                # Next.js, pantallas y cliente de API
docs/
├── assets/                  # Template original y capturas de la aplicación
├── T-04-template-original.md
├── T-14-vista-principal.md
├── ARQUITECTURA.md
└── T-16-pruebas-funcionales.md
scripts/                     # Entorno local y verificación aislada
tests/                       # Recorridos REST y de navegador
README.md                    # Guía y documentación principal de entrega
```

No subir `.env`, bases SQLite locales, `node_modules`, compilaciones ni datos
personales de prueba.

## Alcance de la entrega

El repositorio contiene el código y la documentación técnica del TP2.
El informe académico y la presentación se preparan y entregan por separado.
El equipo debe completar la exposición en vivo y verificar el acceso de los
docentes al repositorio y al tablero. Esos requisitos dependen de la cátedra
y no se certifican mediante una compilación o un archivo.
