// Prueba de humo: sirve dist/, abre el juego en Chromium headless, espera __KERANA_READY__
// y falla si hay errores en consola. Guarda capturas en tmp/screenshots/.
// Navegador: variable CHROME_PATH o rutas habituales (Chrome, Chromium, Playwright).
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'tmp', 'screenshots');
const TILE = 16;

function findBrowser() {
  const candidates = [process.env.CHROME_PATH];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(pw)) {
    for (const d of readdirSync(pw).filter((n) => n.startsWith('chromium-'))) candidates.push(join(pw, d, 'chrome-linux', 'chrome'));
  }
  candidates.push(
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  );
  return candidates.find((p) => p && existsSync(p));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) {
    console.warn('smoke: no encontré Chrome/Chromium (definí CHROME_PATH). Se omite la prueba.');
    return;
  }
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) throw new Error('Falta dist/: corré "npm run build" antes.');

  const server = await preview({ root: ROOT, preview: { port: 4173, strictPort: false, open: false }, logLevel: 'warn' });
  const base = server.resolvedUrls.local[0];
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'],
  });
  const errors = [];
  const warnings = [];
  mkdirSync(SHOTS, { recursive: true });

  async function open(path) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${path}] ${m.text()}`);
      else if (m.type() === 'warn' || m.type() === 'warning') warnings.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`[${path}] ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`[${path}] request failed: ${r.url()}`));
    await page.goto(base + path.replace(/^\//, ''), { waitUntil: 'load' });
    return page;
  }

  const check = (cond, msg) => {
    if (!cond) errors.push(`check: ${msg}`);
    else console.log(`✓ ${msg}`);
  };

  try {
    // 1) Título → Enter → nivel de prueba.
    const title = await open('/');
    await sleep(1500);
    await title.screenshot({ path: join(SHOTS, 'title.png') });
    await title.keyboard.press('Enter');
    await title.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    check(true, 'Título → Enter → nivel listo');
    await sleep(500);
    await title.screenshot({ path: join(SHOTS, 'level.png') });
    await title.close();

    // 2) Nivel directo con depuración: correr, saltar, pozo, agua y espinas.
    const page = await open('/?debug=1&level=test');
    await page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const pos = () =>
      page.evaluate(() => {
        const d = window.__KERANA_DEBUG__;
        return { x: d.player.x, y: d.player.y, state: d.player.motor.state, safeX: d.safeGround.x, safeY: d.safeGround.y };
      });
    const start = await pos();
    await page.keyboard.down('ArrowRight');
    await sleep(500);
    const running = await pos();
    await page.keyboard.up('ArrowRight');
    check(running.x > start.x + 30 && running.state === 'run', `corre (x ${Math.round(start.x)} → ${Math.round(running.x)}, ${running.state})`);
    await page.keyboard.down('Space');
    await sleep(150);
    const jumping = await pos();
    await page.keyboard.up('Space');
    check(jumping.y < start.y - 10 && jumping.state === 'jump', `salta (y ${Math.round(start.y)} → ${Math.round(jumping.y)}, ${jumping.state})`);
    await sleep(1000);
    await page.screenshot({ path: join(SHOTS, 'debug.png') });

    const teleport = (tx, ty) =>
      page.evaluate(
        (x, y) => {
          const p = window.__KERANA_DEBUG__.player;
          p.body.reset(x, y);
        },
        tx,
        ty,
      );
    for (const [name, tx, ty] of [
      ['pozo', 33 * TILE, 20 * TILE],
      ['agua', 61 * TILE, 25 * TILE],
      ['espinas', 47 * TILE, 24 * TILE],
    ]) {
      const before = await pos();
      await teleport(tx, ty);
      await sleep(2000);
      const after = await pos();
      check(
        Math.abs(after.x - before.safeX) < 2 && Math.abs(after.y - before.safeY) < 2,
        `${name}: vuelve al último suelo firme (${Math.round(after.x)}, ${Math.round(after.y)})`,
      );
    }
    // Vista de la pileta y las plataformas para revisar tiles.
    await teleport(60 * TILE, 23 * TILE);
    await sleep(1500);
    await page.screenshot({ path: join(SHOTS, 'water.png') });
    await page.close();
  } catch (err) {
    errors.push(String(err));
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }

  const missing = warnings.filter((w) => w.includes('[ASSET FALTANTE]'));
  if (missing.length) console.log(`Assets faltantes (placeholders): ${[...new Set(missing)].join(', ')}`);
  if (errors.length) {
    console.error(`✗ smoke: ${errors.length} error(es):\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`✓ smoke OK (capturas en tmp/screenshots/)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
