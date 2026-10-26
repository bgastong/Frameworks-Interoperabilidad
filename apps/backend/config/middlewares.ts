import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  {
    name: 'global::turnstile',
    config: {
      rutas: {
        '/api/auth/local': 'login',
        '/api/auth/local/register': 'registro',
        '/api/auth/forgot-password': 'recuperar',
      },
    },
  },
];

export default config;
