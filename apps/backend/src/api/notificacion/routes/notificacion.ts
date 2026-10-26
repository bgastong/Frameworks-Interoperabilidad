export default {
  routes: [{
    method: 'GET',
    path: '/notificaciones/contexto',
    handler: 'notificacion.context',
    config: { policies: [], middlewares: [] },
  }],
};
