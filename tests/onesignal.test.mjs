import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Compilar el módulo real, sin arrancar Strapi ni contactar al proveedor.
const source = readFileSync(new URL('../apps/backend/src/lib/onesignal.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(createRequire(import.meta.url), module, module.exports);
const { createOneSignal } = module.exports;
const env = {
  ONESIGNAL_APP_ID: 'fake-app', ONESIGNAL_REST_API_KEY: 'private-test-key',
  ONESIGNAL_IDENTITY_SECRET: 'a'.repeat(64), FRONTEND_URL: 'https://chat.example.test',
};
const canal = { id: 7, documentId: 'canal-7', comunidad: { id: 3, documentId: 'comunidad-3' } };

function fixture(memberships = [], fetcher = async () => Response.json({ id: 'accepted' }), configuration = env) {
  const calls = [], logs = [], queries = [];
  const strapi = {
    db: { query(uid) { assert.equal(uid, 'api::membresia.membresia'); return { async findMany(query) { queries.push(query); return memberships; } }; } },
    log: Object.fromEntries(['warn', 'info'].map(level => [level, text => logs.push(text)])),
  };
  const service = createOneSignal(strapi, configuration, async (...args) => { calls.push(args); return fetcher(...args); });
  return { service, calls, logs, queries };
}

test('Solo miembros actuales, únicos y habilitados; excluye al autor y no filtra datos privados', async () => {
  const f = fixture([{ usuario: { id: 1 } }, { usuario: { id: 2 } }, { usuario: { id: 2 } }, { usuario: null }, { usuario: { id: 4, blocked: true } }]);
  await f.service.notifyMessage(canal, 1);
  assert.deepEqual(f.queries[0].where, { comunidad: 3, usuario: { id: { $ne: 1 } } });
  assert.equal(f.calls.length, 1);
  const [endpoint, options] = f.calls[0];
  assert.equal(endpoint, 'https://api.onesignal.com/notifications?c=push');
  assert.equal(options.headers.Authorization, 'Key private-test-key');
  const body = JSON.parse(options.body);
  assert.deepEqual(body.include_aliases.external_id, [f.service.context(2).externalId]);
  assert.equal(body.include_aliases.external_id[0].length, 64);
  assert.equal(body.contents.es.includes('Abrí el chat'), true);
  assert.equal(body.url, 'https://chat.example.test/?comunidad=comunidad-3&canal=canal-7');
  assert.equal('included_segments' in body, false);
  assert.match(body.idempotency_key, /^[0-9a-f-]{36}$/);
  assert.equal(f.logs.join('').includes('private-test-key'), false);
  assert.equal(f.logs.join('').includes(body.include_aliases.external_id[0]), false);
});

test('El contexto es estable por usuario, distinto entre usuarios y no revela secretos', () => {
  const { service } = fixture();
  assert.deepEqual(service.context(1), service.context(1));
  assert.notEqual(service.context(1).externalId, service.context(2).externalId);
  assert.equal(JSON.stringify(service.context(1)).includes(env.ONESIGNAL_REST_API_KEY), false);
  assert.equal(JSON.stringify(service.context(1)).includes(env.ONESIGNAL_IDENTITY_SECRET), false);
});

test('Sin configuración o con origen inseguro no consulta la base ni envía', async () => {
  for (const configuration of [{}, { ...env, ONESIGNAL_IDENTITY_SECRET: 'short' }, { ...env, FRONTEND_URL: 'http://example.com' }]) {
    const f = fixture([], undefined, configuration);
    assert.deepEqual(f.service.context(1), { enabled: false });
    await f.service.notifyMessage(canal, 1);
    assert.equal(f.queries.length, 0);
    assert.equal(f.calls.length, 0);
  }
});

test('Una comunidad sin otros miembros no genera un envío global accidental', async () => {
  const f = fixture([{ usuario: { id: 1 } }]);
  await f.service.notifyMessage(canal, 1);
  assert.equal(f.calls.length, 0);
});

test('Fallos HTTP, de red o sin suscriptores no rechazan la creación del mensaje', async () => {
  for (const fetcher of [async () => new Response('', { status: 429 }), async () => { throw new Error('private-test-key'); }, async () => Response.json({ id: '', errors: ['none'] })]) {
    const f = fixture([{ usuario: { id: 2 } }], fetcher);
    await assert.doesNotReject(f.service.notifyMessage(canal, 1));
    assert.equal(f.logs.length, 1);
    assert.equal(f.logs.join('').includes('private-test-key'), false);
  }
});

test('Reconsulta las membresías: una expulsión excluye al usuario de los próximos envíos', async () => {
  const memberships = [{ usuario: { id: 2 } }];
  const f = fixture(memberships);
  await f.service.notifyMessage(canal, 1);
  memberships.length = 0;
  await f.service.notifyMessage(canal, 1);
  assert.equal(f.queries.length, 2);
  assert.equal(f.calls.length, 1);
});
