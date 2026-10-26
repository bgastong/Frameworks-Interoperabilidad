import type { Context } from 'koa';
import { createOneSignal } from '../../../lib/onesignal';

export default {
  async context(ctx: Context) {
    if (!ctx.state.user) return ctx.unauthorized();
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data: createOneSignal(strapi).context(ctx.state.user.id) };
  },
};
