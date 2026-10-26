import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// Ejecutar contra una instancia local y descartable. Las cuentas no se escriben en disco.
const base = process.env.TEST_API_URL ?? 'http://127.0.0.1:1337';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Las pruebas solo admiten un CMS local.');
async function request(path, token, method = 'GET', body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}
async function register(name) {
  const suffix = randomBytes(5).toString('hex');
  const credentials = { username: `${name}_${suffix}`, email: `${name}_${suffix}@example.test`, password: randomBytes(16).toString('hex') };
  const result = await request('/api/auth/local/register', null, 'POST', credentials);
  assert.equal(result.status, 200, 'El registro debe funcionar');
  return { ...result.body, credentials };
}

test('Recorrido completo: autenticación, comunidades, canales, membresías y mensajes', async (t) => {
  const owner = await register('propietario');
  const member = await register('miembro');
  const stranger = await register('ajeno');
  let a, b, channel, membership;

  await t.test('Autenticación y sesión inválida', async () => {
    assert.equal((await request('/api/auth/local', null, 'POST', { identifier: owner.credentials.email, password: owner.credentials.password })).status, 200);
    assert.equal((await request('/api/auth/local', null, 'POST', { identifier: owner.credentials.email, password: 'incorrecta' })).status, 400);
    assert.equal((await request('/api/membresias')).status, 403);
    assert.equal((await request('/api/membresias', 'token-invalido')).status, 401);
  });
  await t.test('Contexto push autenticado sin seleccionar identidades ajenas', async () => {
    assert.equal((await request('/api/notificaciones/contexto')).status, 403);
    assert.equal((await request('/api/notificaciones/contexto', 'token-invalido')).status, 401);
    const own = await request('/api/notificaciones/contexto', owner.jwt);
    assert.equal(own.status, 200);
    assert.equal(typeof own.body.data.enabled, 'boolean');
    const forged = await request(`/api/notificaciones/contexto?userId=${stranger.user.id}`, owner.jwt);
    assert.deepEqual(forged.body.data, own.body.data);
    for (const key of Object.keys(own.body.data)) {
      assert.ok(['enabled', 'appId', 'externalId'].includes(key));
    }
  });
  await t.test('Estado vacío y creación de dos comunidades con canal y propietario', async () => {
    assert.deepEqual((await request('/api/membresias', owner.jwt)).body.data, []);
    for (const name of ['Comunidad Alfa', 'Comunidad Beta']) {
      const result = await request('/api/comunidades', owner.jwt, 'POST', { data: { nombre: name } });
      assert.equal(result.status, 200);
      if (!a) a = result.body.data; else b = result.body.data;
    }
    assert.equal((await request('/api/membresias', owner.jwt)).body.data.length, 2);
    assert.equal((await request(`/api/canales?comunidad=${a.documentId}`, owner.jwt)).body.data[0].nombre, 'general');
    assert.equal((await request('/api/comunidades', stranger.jwt)).body.data.length, 0);
  });
  await t.test('Invitación, duplicados y aislamiento de todas las rutas de lectura', async () => {
    const invitation = (await request(`/api/comunidades/${a.documentId}`, owner.jwt)).body.data.codigoInvitacion;
    assert.equal(typeof invitation, 'string');
    assert.equal((await request('/api/comunidades/unirse', member.jwt, 'POST', { codigoInvitacion: invitation })).status, 201);
    assert.equal((await request('/api/comunidades/unirse', member.jwt, 'POST', { codigoInvitacion: invitation })).status, 409);
    assert.equal((await request('/api/comunidades/unirse', member.jwt, 'POST', { codigoInvitacion: 'inexistente' })).status, 404);
    for (const path of [`/api/comunidades/${a.documentId}`, `/api/canales?comunidad=${a.documentId}`, `/api/membresias?comunidad=${a.documentId}`]) {
      assert.equal((await request(path, stranger.jwt)).status, 403);
    }
    assert.equal((await request(`/api/comunidades/${b.documentId}`, member.jwt)).status, 403);
    assert.equal((await request('/api/membresias', member.jwt)).body.data.length, 1);
  });
  await t.test('Administración de canales y validaciones', async () => {
    const body = { data: { nombre: 'pruebas', comunidad: a.documentId } };
    assert.equal((await request('/api/canales', member.jwt, 'POST', body)).status, 403);
    const created = await request('/api/canales', owner.jwt, 'POST', body);
    assert.equal(created.status, 201); channel = created.body.data;
    assert.equal((await request('/api/canales', owner.jwt, 'POST', body)).status, 409);
    assert.equal((await request('/api/canales', owner.jwt, 'POST', { data: { nombre: 'x'.repeat(21), comunidad: a.documentId } })).status, 400);
    assert.equal((await request(`/api/canales/${channel.documentId}`, owner.jwt, 'PUT', { data: { nombre: 'renombrado' } })).status, 200);
    assert.equal((await request(`/api/canales/${channel.documentId}`, stranger.jwt)).status, 403);
    assert.equal((await request(`/api/canales?comunidad=${b.documentId}`, owner.jwt)).body.data.length, 1);
  });
  await t.test('Mensajes: vacío, límites, autor real y acceso denegado', async () => {
    const path = `/api/mensajes?canal=${channel.documentId}`;
    assert.deepEqual((await request(path, member.jwt)).body.data, []);
    assert.equal((await request(path, stranger.jwt)).status, 403);
    assert.equal((await request('/api/mensajes', stranger.jwt, 'POST', { data: { contenido: 'ajeno', canal: channel.documentId } })).status, 403);
    for (const contenido of ['', 'x'.repeat(3001)]) {
      assert.equal((await request('/api/mensajes', member.jwt, 'POST', { data: { contenido, canal: channel.documentId } })).status, 400);
    }
    const sent = await request('/api/mensajes', member.jwt, 'POST', { data: { contenido: 'x'.repeat(3000), canal: channel.documentId, usuario: owner.user.id } });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.data.usuario.id, member.user.id);
    assert.equal((await request(path, owner.jwt)).body.data.length, 1);
    assert.equal((await request(path + '&desde=no-es-fecha', owner.jwt)).status, 400);
  });
  await t.test('Roles, expulsión y revocación inmediata de acceso', async () => {
    const members = (await request(`/api/membresias?comunidad=${a.documentId}`, owner.jwt)).body.data;
    membership = members.find(m => m.usuario.id === member.user.id);
    const path = `/api/membresias/${membership.documentId}`;
    assert.equal((await request(path, member.jwt, 'PUT', { data: { rol: 'propietario' } })).status, 403);
    for (const rol of ['administrador', 'miembro']) {
      const updated = await request(path, owner.jwt, 'PUT', { data: { rol } });
      assert.equal(updated.status, 200); assert.equal(updated.body.data.rol, rol);
    }
    assert.equal((await request(path, owner.jwt, 'DELETE')).status, 204);
    assert.equal((await request(`/api/mensajes?canal=${channel.documentId}`, member.jwt)).status, 403);
    const own = (await request(`/api/membresias?comunidad=${a.documentId}`, owner.jwt)).body.data[0];
    assert.equal((await request(`/api/membresias/${own.documentId}`, owner.jwt, 'DELETE')).status, 409);
  });
  await t.test('Eliminar canal y mensajes relacionados; conservar último canal', async () => {
    assert.equal((await request(`/api/canales/${channel.documentId}`, owner.jwt, 'DELETE')).status, 204);
    assert.equal((await request(`/api/mensajes?canal=${channel.documentId}`, owner.jwt)).status, 404);
    const last = (await request(`/api/canales?comunidad=${a.documentId}`, owner.jwt)).body.data[0];
    assert.equal((await request(`/api/canales/${last.documentId}`, owner.jwt, 'DELETE')).status, 409);
  });
});
