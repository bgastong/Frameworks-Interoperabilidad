import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Iniciar Next dev con NEXT_PUBLIC_ONESIGNAL_APP_ID del valor de prueba.
// El SDK y Strapi se simulan aquí; esto NO acredita recepción real de push.
const web = process.env.TEST_WEB_URL ?? 'http://127.0.0.1:3100';
const appId = process.env.PUSH_TEST_APP_ID ?? '00000000-0000-4000-8000-000000000001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(web).hostname));

const sdkScript = `
window.pushCalls = [];
const listeners = new Set();
const subscription = {
  optedIn: false,
  async optIn() { sdk.Notifications.permission = true; this.optedIn = true; window.pushCalls.push('optIn'); listeners.forEach(f => f()); },
  async optOut() { this.optedIn = false; window.pushCalls.push('optOut'); listeners.forEach(f => f()); },
  addEventListener(e,f) { listeners.add(f); }, removeEventListener(e,f) { listeners.delete(f); }
};
const sdk = {
  async init() { window.pushCalls.push('init'); },
  async login(id) { window.pushCalls.push('login:' + id); },
  async logout() { window.pushCalls.push('logout'); },
  Notifications: {
    permission: false, isPushSupported() { return true; },
    async requestPermission() { this.permission = true; window.pushCalls.push('permission'); },
    addEventListener() {}, removeEventListener() {}
  },
  User: { PushSubscription: subscription }
};
const queue = window.OneSignalDeferred || [];
window.OneSignalDeferred = { push: callback => callback(sdk) };
queue.forEach(callback => callback(sdk));
`;

test('Push UI: destino autorizado, consentimiento, opt-out, permisos y cierre de sesión', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      // Headless Shell puede denegar push por defecto; el proveedor es simulado.
      Object.defineProperty(Notification, 'permission', { configurable: true, value: 'default' });
      if (!sessionStorage.getItem('push-test-seeded')) {
        localStorage.setItem('token', 'fake-jwt');
        localStorage.setItem('username', 'estudiante-push');
        sessionStorage.setItem('push-test-seeded', '1');
      }
    });
    await page.route('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js', route => route.fulfill({ contentType: 'application/javascript', body: sdkScript }));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path.endsWith('/notificaciones/contexto')) data = { enabled: true, appId, externalId: 'opaque-current-user' };
      else if (path.endsWith('/membresias')) data = [{ id: 1, documentId: 'm1', rol: 'miembro', comunidad: { id: 1, documentId: 'c1', nombre: 'Comunidad Prueba' }, usuario: { id: 1, username: 'estudiante-push' } }];
      else if (path.endsWith('/canales')) data = [{ id: 1, documentId: 'general', nombre: 'general' }, { id: 2, documentId: 'pruebas', nombre: 'pruebas' }];
      await route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: JSON.stringify({ data }) });
    });
    await page.goto(web + '/?comunidad=c1&canal=pruebas');
    await page.getByRole('button', { name: '# pruebas', exact: true }).waitFor();
    await page.waitForFunction(() => window.pushCalls?.includes('login:opaque-current-user'));
    assert.equal(await page.evaluate(() => window.pushCalls.includes('permission')), false, 'No solicitar permisos automáticamente');
    await page.getByRole('button', { name: 'estudiante-push', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Notificaciones', exact: true }).click();
    await page.getByRole('button', { name: 'Activar notificaciones', exact: true }).click();
    await page.getByText('Notificaciones activadas en este navegador.', { exact: true }).waitFor();
    const assets = process.env.PUSH_SCREENSHOT_DIR ?? join(tmpdir(), 'community-hub-push-ui');
    await mkdir(assets, { recursive: true });
    await page.screenshot({ path: join(assets, 'notificaciones.png') });
    await page.getByRole('button', { name: 'Desactivar notificaciones', exact: true }).click();
    await page.getByText('Notificaciones desactivadas en este navegador.', { exact: true }).waitFor();
    await page.evaluate(() => Object.defineProperty(Notification, 'permission', { configurable: true, value: 'denied' }));
    await page.getByRole('button', { name: 'Activar notificaciones', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Las notificaciones están bloqueadas' }).waitFor();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'estudiante-push', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
    await page.waitForURL(/\/login$/);
    assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
    assert.ok(await page.evaluate(() => window.pushCalls.includes('logout')));
    assert.deepEqual(errors, []);
  } catch (error) {
    const assets = process.env.PUSH_SCREENSHOT_DIR ?? join(tmpdir(), 'community-hub-push-ui');
    await mkdir(assets, { recursive: true });
    await page.screenshot({ path: join(assets, 'failure.png') });
    console.error(await page.locator('body').innerText());
    throw error;
  } finally { await browser.close(); }
});
