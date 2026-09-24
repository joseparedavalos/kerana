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
    // 1) Título → Nueva partida → Prólogo (salteado) → Mapa → nivel 1 → LevelExit → Nivel completado → Mapa.
    // (?debug=1, sin `level`, para poder teletransportar a Kerana sin cambiar el flujo Título → Mapa.)
    const title = await open('/?debug=1');
    await sleep(1500);
    await title.screenshot({ path: join(SHOTS, 'title.png') });
    await title.keyboard.press('Enter'); // "Nueva partida" (primer ítem del menú)
    await title.waitForFunction(() => window.__KERANA_GAME__?.scene.isActive('Story') ?? false, { timeout: 10000 });
    check(true, 'Título → Nueva partida → Prólogo');
    await title.keyboard.down('Escape'); // mantener Pausa salta el prólogo entero
    await sleep(700);
    await title.keyboard.up('Escape');
    await title.waitForFunction(() => window.__KERANA_GAME__?.scene.isActive('Map') ?? false, { timeout: 10000 });
    check(true, 'Prólogo → Mapa');
    await sleep(300);
    await title.screenshot({ path: join(SHOTS, 'map.png') });
    await title.keyboard.press('Enter'); // entra al nodo 1 (Paraguarí)
    await title.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    check(true, 'Mapa → nivel 1 listo');
    await sleep(500);
    await title.screenshot({ path: join(SHOTS, 'level.png') });

    // Liberación de Teju Jagua (atajo de depuración): cámara lenta, marca, diálogo, ascenso, don → Nivel completado.
    const isActive = (key) => title.evaluate((k) => window.__KERANA_GAME__?.scene.isActive(k) ?? false, key);
    await title.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    // El diálogo pide 2 pulsaciones por línea (revelar y avanzar); el resto de la secuencia corre sola.
    for (let i = 0; i < 40 && !(await isActive('LevelComplete')); i++) {
      await title.keyboard.press('Space');
      await sleep(300);
    }
    check(await isActive('LevelComplete'), 'Jefe vencido → liberación → Nivel completado');
    await sleep(300);
    await title.screenshot({ path: join(SHOTS, 'level-complete.png') });
    await title.keyboard.press('Enter');
    await title.waitForFunction(() => window.__KERANA_GAME__?.scene.isActive('Map') ?? false, { timeout: 10000 });
    check(true, 'Nivel completado → Mapa');
    const freed = await title.evaluate(() => JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}'));
    check(freed.freed?.includes('teju_jagua') && freed.gifts?.includes('charged_slash'), 'guardado: Teju Jagua liberado y tajo cargado');
    await title.close();

    // 1b) ?level=1&boss=1: empieza en la antesala; al entrar a la arena empieza la pelea.
    const bossPage = await open('/?debug=1&level=1&boss=1&god=1');
    await bossPage.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const bx = await bossPage.evaluate(() => window.__KERANA_DEBUG__.player.x);
    check(bx > 176 * TILE && bx < 200 * TILE, `boss=1 empieza en la antesala (x ${Math.round(bx / TILE)} tiles)`);
    await bossPage.keyboard.down('ArrowRight');
    await sleep(2500);
    await bossPage.keyboard.up('ArrowRight');
    check(await bossPage.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true), 'entrar a la arena cierra la entrada y empieza la pelea');
    await sleep(6000); // presentación y un par de ataques (god=1: Kerana no recibe daño)
    await bossPage.screenshot({ path: join(SHOTS, 'boss.png') });
    const bstate = await bossPage.evaluate(() => window.__KERANA_DEBUG__.scene.boss.brain.state);
    check(bstate !== 'waiting', `Teju Jagua ataca (estado ${bstate})`);
    await bossPage.close();

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
