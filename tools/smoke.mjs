// Prueba de humo: sirve dist/, abre el juego en Chromium headless, espera __KERANA_READY__
// y falla si hay errores en consola. Guarda capturas en tmp/screenshots/.
// Navegador: variable CHROME_PATH o rutas habituales (Chrome, Chromium, Playwright).
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import { installPilot } from './lib/pilot.mjs';
import { L1_HIGH, L1_LOW, L2_COPA, L2_HIGH, L2_MAIN, L3_MAIN, L3_SECRET } from './lib/pilot-plans.mjs';

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
// Pulsaciones (cada 300 ms) para pasar la liberación hasta "Nivel completado": el bucle corta apenas llega.
// Con 60 (≈ 18 s) a veces no alcanzaba cuando el headless iba lento (falló una vez en l7, S18).
const PRESS_MAX = 150;

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

  // Camina a la derecha hasta que se cierre la arena (o hasta `maxMs`): con tiempo fijo fallaba en máquinas lentas.
  // `jump`: salta cada tanto (en N7 hay que subir al techo del mausoleo de la entrada).
  async function walkIntoArena(page, maxMs = 15000, jump = false) {
    await page.keyboard.down('ArrowRight');
    for (let t = 0, i = 0; t < maxMs && !(await page.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true)); t += 100, i++) {
      if (jump && i % 6 === 0) {
        await page.keyboard.down('Space');
        await sleep(300);
        await page.keyboard.up('Space');
        t += 300;
      }
      await sleep(100);
    }
    await page.keyboard.up('ArrowRight');
  }

  try {
    // 1) Título → Nueva partida → Prólogo (salteado) → Mapa → nivel 1 → LevelExit → Nivel completado → Mapa.
    // (?debug=1, sin `level`, para poder teletransportar a Kerana sin cambiar el flujo Título → Mapa.)
    const title = await open('/?debug=1');
    // Por estado: con 1500 ms fijos, si la carga iba lenta el Enter se perdía (falló una vez en S18).
    await title.waitForFunction(() => window.__KERANA_GAME__?.scene.isActive('Title') ?? false, { timeout: 20000 });
    await sleep(500);
    await title.screenshot({ path: join(SHOTS, 'title.png') });
    const inStory = () => title.evaluate(() => window.__KERANA_GAME__?.scene.isActive('Story') ?? false);
    // "Nueva partida" (primer ítem del menú); se repite si el menú todavía no escuchaba.
    for (let t = 0; t < 10000 && !(await inStory()); t += 1000) {
      await title.keyboard.press('Enter');
      for (let w = 0; w < 1000 && !(await inStory()); w += 100) await sleep(100);
    }
    await title.waitForFunction(() => window.__KERANA_GAME__?.scene.isActive('Story') ?? false, { timeout: 10000 });
    check(true, 'Título → Nueva partida → Prólogo');
    // Mantener Pausa salta el prólogo entero: se mantiene hasta que aparece el mapa (con 700 ms fijos fallaba en máquinas lentas).
    await title.keyboard.down('Escape');
    for (let t = 0; t < 5000 && !(await title.evaluate(() => window.__KERANA_GAME__?.scene.isActive('Map') ?? false)); t += 100) await sleep(100);
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
    // Fondos (S12e, S13a): l1_cave solo dentro de las zonas Cave y l1_far solo fuera; en la boca, los dos con un degradado.
    const backdropState = (page) => page.evaluate(() => window.__KERANA_DEBUG__.scene.backdrop.debugState);
    const bgStart = await backdropState(title);
    check(bgStart.images === 2 && bgStart.cave && !bgStart.far, `nivel 1: la cueva inicial usa solo el fondo de cueva (${JSON.stringify(bgStart)})`);
    // Boca de la cueva inicial (x ≈ 45) y de la cueva de C (x ≈ 190, S19): cielo y cueva a la vez, con el borde oscuro.
    for (const [tx, ty] of [
      [45, 11],
      [190, 10],
    ]) {
      await title.evaluate(([x, y]) => window.__KERANA_DEBUG__.player.body.reset(x * 16, y * 16), [tx, ty]);
      await sleep(1200);
      const bgMouth = await backdropState(title);
      check(bgMouth.cave && bgMouth.far && bgMouth.edges === 1, `nivel 1: en la boca x ${tx} se ven cielo y cueva con el borde (${JSON.stringify(bgMouth)})`);
      await title.screenshot({ path: join(SHOTS, `bg-l1-boca-${tx}.png`) });
    }
    await title.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(72 * 16, 8 * 16));
    await sleep(1200);
    const bgSlope = await backdropState(title);
    check(!bgSlope.cave && bgSlope.far, `nivel 1: en la ladera solo el cielo (${JSON.stringify(bgSlope)})`);
    await title.screenshot({ path: join(SHOTS, 'bg-l1-ladera.png') });

    // Plumas (S17): se guardan al tocarlas, no reaparecen al volver a entrar y el conteo no baja.
    const featherState = (page) =>
      page.evaluate(() => {
        const scene = window.__KERANA_DEBUG__.scene;
        const save = JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}');
        return {
          hud: scene.feathers,
          onMap: scene.pickups.filter((p) => p.kind === 'pluma' && p.active).map((p) => p.index),
          saved: save.feathers?.l1 ?? null,
        };
      });
    const before = await featherState(title);
    check(before.hud === 0 && before.onMap.join() === '0,1,2', `nivel 1: 3 plumas en el mapa y 0 en el HUD (${JSON.stringify(before)})`);
    // Pluma 0 (S19: en el nicho enrejado de la cueva inicial). Kerana aparece sobre ella.
    await title.evaluate(() => {
      const d = window.__KERANA_DEBUG__;
      const f = d.scene.pickups.find((p) => p.kind === 'pluma' && p.index === 0);
      d.player.body.reset(f.x, f.y);
    });
    await sleep(800);
    const got = await featherState(title);
    check(got.hud === 1 && got.saved?.join() === 'true,false,false', `nivel 1: la pluma 0 se guarda al tocarla (${JSON.stringify(got)})`);
    // Pausa → Salir al mapa (4.º ítem) → volver a entrar al nodo 1.
    const tap = async (key) => {
      await title.keyboard.down(key);
      await sleep(120);
      await title.keyboard.up(key);
      await sleep(120);
    };
    await tap('Escape');
    await title.waitForFunction(() => window.__KERANA_GAME__?.scene.isActive('Pause') ?? false, { timeout: 5000 });
    for (let i = 0; i < 3; i++) await tap('ArrowDown');
    await tap('Enter');
    await title.waitForFunction(() => window.__KERANA_GAME__?.scene.isActive('Map') ?? false, { timeout: 10000 });
    await title.evaluate(() => (window.__KERANA_READY__ = false));
    await sleep(500);
    await tap('Enter');
    await title.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(300);
    const again = await featherState(title);
    check(
      again.hud === 1 && again.onMap.join() === '1,2' && again.saved?.join() === 'true,false,false',
      `nivel 1 otra vez: la pluma 0 no reaparece y el conteo no bajó (${JSON.stringify(again)})`,
    );

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
    check(freed.feathers?.l1?.join() === 'true,false,false', `guardado: vencer al jefe no pisa las plumas (${JSON.stringify(freed.feathers?.l1)})`);
    await title.close();

    // 1b) ?level=1&boss=1: empieza en la antesala; al entrar a la arena empieza la pelea.
    const bossPage = await open('/?debug=1&level=1&boss=1&god=1');
    await bossPage.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const bx = await bossPage.evaluate(() => window.__KERANA_DEBUG__.player.x);
    check(bx > 250 * TILE && bx < 274 * TILE, `boss=1 empieza en la antesala (x ${Math.round(bx / TILE)} tiles)`);
    await walkIntoArena(bossPage);
    check(await bossPage.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true), 'entrar a la arena cierra la entrada y empieza la pelea');
    await sleep(6000); // presentación y un par de ataques (god=1: Kerana no recibe daño)
    await bossPage.screenshot({ path: join(SHOTS, 'boss.png') });
    await bossPage.screenshot({ path: join(SHOTS, 'bg-l1-caverna.png') });
    const bgBoss = await backdropState(bossPage);
    check(bgBoss.cave && !bgBoss.far, 'nivel 1: la caverna de Teju Jagua usa solo el fondo de cueva');
    const bstate = await bossPage.evaluate(() => window.__KERANA_DEBUG__.scene.boss.brain.state);
    check(bstate !== 'waiting', `Teju Jagua ataca (estado ${bstate})`);
    await bossPage.close();

    // 1b2) l1 de punta a punta (S19): el piloto (tools/lib/pilot.mjs, plan en pilot-plans.mjs) maneja a Kerana con las teclas en cada
    // paso del juego: piedra y reja, balsa sobre el pozo 2, ruta baja, hongo, cueva, pozo vertical, arena. Después,
    // la liberación hasta "Nivel completado". god=1 para que un golpe no la tire a un pozo; las caídas se cuentan igual.
    const l1Page = await open('/?debug=1&level=1&god=1');
    await l1Page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l1Info = await l1Page.evaluate(() => {
      const s = window.__KERANA_DEBUG__.scene;
      return {
        movers: s.movers.length,
        gates: s.gates.length,
        switches: s.switches.length,
        bouncers: s.bouncers.map((b) => b.motor.state).join(','),
        // Las ya guardadas (la pluma 0 del paso 1) no se crean: en el mapa más las del HUD son 3.
        feathers: s.pickups.filter((p) => p.kind === 'pluma').length + s.feathers,
      };
    });
    check(
      l1Info.movers === 3 && l1Info.gates === 3 && l1Info.switches === 4 && l1Info.bouncers === 'ready,ready,asleep' && l1Info.feathers === 3,
      `nivel 1: 3 plataformas, 3 rejas, 4 piedras, hongos de un uso y dormido, 3 plumas (${JSON.stringify(l1Info)})`,
    );
    await l1Page.evaluate(installPilot, L1_LOW);
    const pilot = (page) => page.evaluate(() => {
      const p = window.__KERANA_PILOT__;
      return { done: p.done, step: p.step, timeMs: Math.round(p.timeMs), splits: p.splits, respawns: p.respawns, x: Math.round(window.__KERANA_DEBUG__.player.x / 16) };
    });
    // Tope de reloj amplio: el headless a veces va a ≈ 35 fps; el piloto avanza por pasos del juego.
    for (let t = 0; t < 240000 && !(await pilot(l1Page)).done; t += 500) await sleep(500);
    const run1 = await pilot(l1Page);
    check(run1.done && run1.respawns === 0, `nivel 1: Kerana cruza el nivel entero sin caer a un pozo (${JSON.stringify(run1)})`);
    if (!run1.done) {
      await l1Page.screenshot({ path: join(SHOTS, 'l1-piloto-atascado.png') });
      console.log((await l1Page.evaluate(() => window.__KERANA_PILOT__.log)).join('\n'));
    }
    console.log(`  l1 (ruta baja): ${(run1.timeMs / 1000).toFixed(1)} s de juego hasta la arena; parciales ${JSON.stringify(run1.splits)}`);
    await l1Page.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    for (let i = 0; i < PRESS_MAX && !(await l1Page.evaluate(() => window.__KERANA_GAME__?.scene.isActive('LevelComplete') ?? false)); i++) {
      await l1Page.keyboard.press('Space');
      await sleep(300);
    }
    check(await l1Page.evaluate(() => window.__KERANA_GAME__?.scene.isActive('LevelComplete') ?? false), 'nivel 1 recorrido → liberación → Nivel completado');
    await l1Page.close();

    // 1b3) l1, ruta alta (S19): desde el fuego de x 101, el hongo del hoyo lleva a las repisas; la pluma B paga el salto.
    const l1High = await open('/?debug=1&level=1&god=1');
    await l1High.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    await l1High.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(102 * 16, 9 * 16));
    await sleep(300);
    const highStart = await l1High.evaluate(() => window.__KERANA_DEBUG__.scene.feathers);
    await l1High.evaluate(installPilot, L1_HIGH);
    const highAt = () => l1High.evaluate(() => ({ step: window.__KERANA_PILOT__.step, hud: window.__KERANA_DEBUG__.scene.feathers, respawns: window.__KERANA_PILOT__.respawns, x: Math.round(window.__KERANA_DEBUG__.player.x / 16) }));
    for (let t = 0; t < 120000 && (await highAt()).x < 186; t += 500) await sleep(500);
    const high = await highAt();
    check(high.x >= 186 && high.hud === highStart + 1 && high.respawns === 0, `nivel 1: la ruta alta llega a la cima con la pluma B (${JSON.stringify(high)})`);
    await l1High.close();

    // 1b4) l1 al rejugar (S19): con el tajo cargado, la onda atraviesa la roca hasta la piedra encerrada y abre la cámara
    // de la pluma C; la piedra temporizada de la cueva inicial abre el nicho de la pluma A.
    const l1Back = await open('/?debug=1&level=1&gifts=all&god=1');
    await l1Back.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const powered = (id) => l1Back.evaluate((k) => window.__KERANA_DEBUG__.scene.switchBoard.isPowered(k), id);
    await l1Back.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(26 * 16 + 4, 12 * 16));
    await sleep(300);
    await l1Back.evaluate(() => (window.__KERANA_DEBUG__.player.motor.facing = 1));
    await l1Back.keyboard.press('KeyX');
    for (let t = 0; t < 3000 && !(await powered('reja_cueva')); t += 50) await sleep(50);
    check(await powered('reja_cueva'), 'nivel 1: el sable enciende la piedra temporizada de la cueva');
    const sealedBefore = await powered('reja_camara');
    await l1Back.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(204 * 16 + 10, 22 * 16));
    await sleep(300);
    await l1Back.evaluate(() => (window.__KERANA_DEBUG__.player.motor.facing = -1));
    await l1Back.keyboard.down('KeyX');
    for (let t = 0; t < 10000 && (await l1Back.evaluate(() => window.__KERANA_DEBUG__.player.motor.chargeFraction)) < 1; t += 50) await sleep(50);
    await sleep(100);
    await l1Back.keyboard.up('KeyX');
    for (let t = 0; t < 3000 && !(await powered('reja_camara')); t += 50) await sleep(50);
    check(!sealedBefore && (await powered('reja_camara')), 'nivel 1: la onda del tajo cargado atraviesa la roca y abre la cámara de la pluma C');
    await l1Back.screenshot({ path: join(SHOTS, 'l1-camara.png') });
    await l1Back.close();

    // 1c) Nivel 2: el mapa carga, ?boss=1 lleva a la antesala y Mbói Tu'i ataca.
    const l2Page = await open('/?debug=1&level=2&boss=1&god=1');
    await l2Page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l2x = await l2Page.evaluate(() => window.__KERANA_DEBUG__.player.x);
    // S24: la antesala se corrió 67 tiles con la zona de ritmo (x 376-395).
    check(l2x > 376 * TILE && l2x < 396 * TILE, `nivel 2 con boss=1 empieza en la antesala (x ${Math.round(l2x / TILE)} tiles)`);
    // Camina hasta que se cierre la arena (islote A): se detiene en cuanto se cierra (tope 15 s, para máquinas lentas).
    await walkIntoArena(l2Page);
    check(await l2Page.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true), "nivel 2: la arena de Mbói Tu'i se cierra");
    await sleep(6000);
    await l2Page.screenshot({ path: join(SHOTS, 'boss-l2.png') });
    const l2state = await l2Page.evaluate(() => window.__KERANA_DEBUG__.scene.boss.brain.state);
    check(l2state !== 'waiting', `Mbói Tu'i ataca (estado ${l2state})`);
    // Fase 3 forzada: enroscado, camalotes que van y vienen y flores que curan (sin errores en consola).
    const phase3 = await l2Page.evaluate(async () => {
      const boss = window.__KERANA_DEBUG__.scene.boss;
      boss.brain.damage(8);
      boss.onPhaseChanged(boss.brain.phase);
      await new Promise((r) => setTimeout(r, 5000));
      const scene = window.__KERANA_DEBUG__.scene;
      return { phase: boss.brain.phase, flowers: scene.pickups.filter((p) => p.kind === 'yvoty').length, cycling: scene.sinkers.some((s) => s.motor.autoCycle) };
    });
    check(phase3.phase === 2 && phase3.cycling && phase3.flowers > 0, `Mbói Tu'i fase 3: camalotes en ciclo y flores (${JSON.stringify(phase3)})`);
    await l2Page.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    // El Space del bucle puede saltar "Nivel completado" al mapa justo cuando aparece: ambas cuentan.
    const l2Done = () => l2Page.evaluate(() => { const s = window.__KERANA_GAME__?.scene; return !!s && (s.isActive('LevelComplete') || s.isActive('Map')); });
    for (let i = 0; i < 40 && !(await l2Done()); i++) {
      await l2Page.keyboard.press('Space');
      await sleep(300);
    }
    check(await l2Done(), "Mbói Tu'i vencido → liberación → Nivel completado");
    const l2save = await l2Page.evaluate(() => JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}'));
    check(l2save.freed?.includes('mboi_tui') && l2save.maxHearts === 5, "guardado: Mbói Tu'i liberado y +1 corazón (5)");
    await l2Page.close();

    // 1c2) l2 de punta a punta (S22): el piloto cruza el estero por la ruta principal (roca agrietada, cadenas de camalotes,
    // piedra encerrada y balsa, par de balsas, hongo -> balsa alta, atajo del fardo, ruta baja, hongo dormido, plataforma
    // vertical, hongo de un uso -> balsa alta, la cadena más larga) y después la liberación hasta "Nivel completado".
    // El tajo cargado viene del guardado (l1 ya vencido en los pasos de arriba).
    const l2Run = await open('/?debug=1&level=2&god=1');
    await l2Run.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l2Info = await l2Run.evaluate(() => {
      const s = window.__KERANA_DEBUG__.scene;
      const groups = new Set(s.breakables.map((b) => b.group));
      return {
        charge: window.__KERANA_DEBUG__.player.motor.chargeEnabled,
        movers: s.movers.length,
        // Recorrido vertical: la plataforma se mueve en y (dx = 0).
        vertical: s.movers.filter((m) => m.motor.uy !== 0).length,
        switches: s.switches.length,
        bouncers: s.bouncers.map((b) => b.motor.state).join(','),
        rocks: [...groups].filter((g) => g[0].kind === 'rock').length,
        brittle: [...groups].filter((g) => g[0].kind === 'brittle').length,
        drawn: s.breakables.every((b) => b.look.length > 0),
        checkpoints: s.checkpoints.length,
        feathers: s.pickups.filter((p) => p.kind === 'pluma').length + s.feathers,
        // S23: enemigos (el guasu es el ñakurutu en grande) y la red de seguridad (S24: ningún encierro, el hueco tiene salida).
        enemies: s.enemies.reduce((acc, e) => ({ ...acc, [e.def.id]: (acc[e.def.id] ?? 0) + 1 }), {}),
        guardianScale: s.enemies.find((e) => e.def.id === 'nakurutu_guasu')?.scaleX,
        bigJakareScale: s.enemies.find((e) => e.def.id === 'jakare_guasu')?.scaleX,
        traps: s.trapCells ? s.trapCells.reduce((n, v) => n + v, 0) : 0,
      };
    });
    check(
      l2Info.charge &&
        l2Info.movers === 22 &&
        l2Info.vertical === 3 &&
        l2Info.switches === 1 &&
        l2Info.bouncers === 'ready,ready,ready,ready,asleep' &&
        l2Info.rocks === 2 &&
        l2Info.brittle === 7 &&
        l2Info.drawn &&
        l2Info.checkpoints === 4 &&
        l2Info.feathers === 3 &&
        l2Info.enemies.jakare === 3 &&
        l2Info.enemies.jakare_guasu === 4 &&
        l2Info.bigJakareScale > 1 &&
        l2Info.enemies.nakurutu === 3 &&
        l2Info.enemies.mboi === 4 &&
        l2Info.enemies.nakurutu_guasu === 1 &&
        l2Info.guardianScale > 2 &&
        l2Info.traps === 0,
      `nivel 2: 22 plataformas (3 verticales), 1 piedra, 5 hongos, 2 rocas y 7 fardos dibujados, 4 fuegos, 3 plumas, enemigos con el ñakurutu guasu y 4 jakare guasu, ningún encierro (${JSON.stringify(l2Info)})`,
    );
    // El tajo normal no rompe la roca agrietada del peñasco (x 14-16); el piloto la rompe después con el cargado.
    await l2Run.evaluate(() => {
      const d = window.__KERANA_DEBUG__;
      d.player.body.reset(12.5 * 16, 33 * 16);
      d.player.motor.facing = 1;
    });
    await sleep(300);
    await l2Run.screenshot({ path: join(SHOTS, 'l2-rompibles.png') });
    // Chispas del tajo normal (S22): captura durante el golpe.
    await l2Run.keyboard.down('KeyX');
    await sleep(90);
    await l2Run.screenshot({ path: join(SHOTS, 'l2-tajo.png') });
    await l2Run.keyboard.up('KeyX');
    await sleep(600);
    const rockA = () => l2Run.evaluate(() => window.__KERANA_DEBUG__.scene.breakables.find((b) => b.kind === 'rock' && b.zone.x === 14 * 16).broken);
    check((await rockA()) === false, 'nivel 2: el tajo normal no rompe la roca agrietada');
    // S24, zona de ritmo: mientras corre el piloto, cada jakare guasu tiene que asomar solo con las dos balsas de su
    // encuentro juntas (2 tiles de hueco) y nunca con ellas separadas.
    await l2Run.evaluate(() => {
      const s = window.__KERANA_DEBUG__.scene;
      const crocs = s.enemies.filter((e) => e.def.id === 'jakare_guasu');
      const rafts = s.movers.filter((m) => m.zone.y === 33 * 16);
      window.__RHYTHM__ = { exposed: 0, apart: 0 };
      s.events.on('postupdate', () => {
        for (const c of crocs) {
          if (c.lurkState !== 'exposed') continue;
          const from = rafts.filter((m) => m.block.x + m.block.width <= c.spawnX).sort((a, b) => b.block.x - a.block.x)[0];
          const to = rafts.filter((m) => m.block.x >= c.spawnX).sort((a, b) => a.block.x - b.block.x)[0];
          window.__RHYTHM__.exposed++;
          if (!from || !to || Math.abs(to.block.x - (from.block.x + from.block.width) - 32) > 1) window.__RHYTHM__.apart++;
        }
      });
    });
    await l2Run.evaluate(installPilot, L2_MAIN);
    for (let t = 0; t < 420000 && !(await pilot(l2Run)).done; t += 500) await sleep(500);
    const run2 = await pilot(l2Run);
    const rhythm = await l2Run.evaluate(() => window.__RHYTHM__);
    check(rhythm.exposed > 0 && rhythm.apart === 0, `nivel 2: los jakare guasu asoman solo con las balsas de su encuentro juntas (${JSON.stringify(rhythm)})`);
    check(run2.done && run2.respawns === 0, `nivel 2: Kerana cruza el estero entero sin caer al agua (${JSON.stringify(run2)})`);
    if (!run2.done) {
      await l2Run.screenshot({ path: join(SHOTS, 'l2-piloto-atascado.png') });
      console.log((await l2Run.evaluate(() => window.__KERANA_PILOT__.log)).slice(-30).join('\n'));
    }
    check(await rockA(), 'nivel 2: el tajo cargado rompe la roca agrietada entera (3 × 4 tiles de un golpe)');
    console.log(`  l2 (ruta principal): ${(run2.timeMs / 1000).toFixed(1)} s de juego hasta la arena; parciales ${JSON.stringify(run2.splits)}`);
    await l2Run.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    for (let i = 0; i < PRESS_MAX && !(await l2Run.evaluate(() => { const s = window.__KERANA_GAME__?.scene; return !!s && (s.isActive('LevelComplete') || s.isActive('Map')); })); i++) {
      await l2Run.keyboard.press('Space');
      await sleep(300);
    }
    check(await l2Run.evaluate(() => { const s = window.__KERANA_GAME__?.scene; return !!s && (s.isActive('LevelComplete') || s.isActive('Map')); }), 'nivel 2 recorrido → liberación → Nivel completado');
    await l2Run.close();

    // 1c3) l2, ruta alta (S22): desde la repisa del ascenso 1, las pencas en zigzag, el muro de roca agrietada (tajo
    // cargado), la balsa sobre el hueco y la pluma B; y el nido de la ruta baja deja caer su guavirá al romperse.
    const l2High = await open('/?debug=1&level=2&god=1');
    await l2High.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    await l2High.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(143.5 * 16, 26 * 16));
    await sleep(300);
    const l2HighStart = await l2High.evaluate(() => window.__KERANA_DEBUG__.scene.feathers);
    await l2High.evaluate(installPilot, L2_HIGH);
    for (let t = 0; t < 120000 && !(await pilot(l2High)).done; t += 500) await sleep(500);
    const high2 = await l2High.evaluate(() => ({ done: window.__KERANA_PILOT__.done, hud: window.__KERANA_DEBUG__.scene.feathers, respawns: window.__KERANA_PILOT__.respawns, x: Math.round(window.__KERANA_DEBUG__.player.x / 16), timeMs: Math.round(window.__KERANA_PILOT__.timeMs) }));
    // S23: la pluma B se mudó a la copa (camino del ñakurutu guasu); desde la ruta alta no se alcanza.
    check(high2.done && high2.hud === l2HighStart && high2.respawns === 0, `nivel 2: la ruta alta llega al fuego 2 (sin la pluma B, que está en la copa) (${JSON.stringify(high2)})`);
    const nest = await l2High.evaluate(async () => {
      const scene = window.__KERANA_DEBUG__.scene;
      const g = scene.pickups.find((p) => p.kind === 'guavira' && Math.floor(p.x / 16) === 161);
      const before = g.baseY / 16;
      scene.breakBreakable(scene.breakables.find((b) => b.kind === 'brittle' && b.zone.x === 161 * 16));
      await new Promise((r) => setTimeout(r, 1500));
      return { before, after: g.baseY / 16, y: Math.round(g.y / 16) };
    });
    check(nest.before === 27 && nest.after === 33, `nivel 2: al romper el nido, la guavirá cae al suelo (${JSON.stringify(nest)})`);
    await l2High.close();

    // 1c4) l2, copa del palmar (S23): el camino oculto del ñakurutu guasu. Desde la cima del albardón: muro de roca
    // agrietada, ascensor del tronco hueco, par de balsas de la copa, rama del guardián (se lanza; god=1 no recibe daño)
    // y la pluma B en la repisa de abajo.
    const l2Copa = await open('/?debug=1&level=2&god=1');
    await l2Copa.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    await l2Copa.evaluate(() => {
      const d = window.__KERANA_DEBUG__;
      d.player.body.reset(155.5 * 16, 18 * 16);
      // Registra si el guardián deja su rama (aviso y picada) mientras pasa Kerana.
      const g = d.scene.enemies.find((e) => e.def.id === 'nakurutu_guasu');
      window.__GUARD__ = { warned: false, dove: false, spawnY: g.spawnY };
      d.scene.events.on('postupdate', () => {
        if (g.warning) window.__GUARD__.warned = true;
        if (g.y > g.spawnY + 24) window.__GUARD__.dove = true;
      });
    });
    await sleep(300);
    const copaStart = await l2Copa.evaluate(() => window.__KERANA_DEBUG__.scene.feathers);
    await l2Copa.evaluate(installPilot, L2_COPA);
    for (let t = 0; t < 150000 && !(await pilot(l2Copa)).done; t += 500) await sleep(500);
    const copa = await l2Copa.evaluate(() => ({ done: window.__KERANA_PILOT__.done, hud: window.__KERANA_DEBUG__.scene.feathers, respawns: window.__KERANA_PILOT__.respawns, x: Math.round(window.__KERANA_DEBUG__.player.x / 16), timeMs: Math.round(window.__KERANA_PILOT__.timeMs), ...window.__GUARD__ }));
    check(
      copa.done && copa.hud === copaStart + 1 && copa.respawns === 0 && copa.warned && copa.dove,
      `nivel 2: el camino oculto de la copa pasa al ñakurutu guasu (avisa y se lanza) y llega a la pluma B (${JSON.stringify(copa)})`,
    );
    if (!copa.done) console.log((await l2Copa.evaluate(() => window.__KERANA_PILOT__.log)).slice(-30).join('\n'));
    console.log(`  l2 (copa del palmar): ${(copa.timeMs / 1000).toFixed(1)} s de juego desde la cima del albardón hasta el fuego 2`);
    await l2Copa.close();

    // 1c5) El hueco del premio tiene salida (S24): Kerana baja del pilar al hueco (x 234-238), cobra la Luz de Arasy y la
    // guavirá, ve el fardo de la base del pilar desde adentro (en cámara, captura l2-hueco.png), lo rompe con el tajo
    // normal (el que se tiene siempre) y sale por el túnel al pie del ascenso. La red no actúa: ya no es un encierro.
    const l2Hole = await open('/?debug=1&level=2');
    await l2Hole.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const holeState = () =>
      l2Hole.evaluate(() => {
        const d = window.__KERANA_DEBUG__;
        const s = d.scene;
        const fardo = s.breakables.find((b) => b.kind === 'brittle' && b.zone.x === 233 * 16);
        return {
          x: +(d.player.body.center.x / 16).toFixed(1),
          feet: +(d.player.body.bottom / 16).toFixed(1),
          immune: d.player.isImmune,
          hearts: d.player.health.current,
          traps: window.__TRAPS__,
          fardo: fardo ? (fardo.broken ? 'roto' : fardo.look.length > 0 ? 'dibujado' : 'sin dibujo') : 'no está',
          // El fardo entra en la cámara con Kerana en el hueco.
          inView: !!fardo && s.cameras.main.worldView.contains(fardo.zone.centerX, fardo.zone.centerY),
          prize: s.pickups.filter((p) => p.active && Math.floor(p.x / 16) >= 234 && Math.floor(p.x / 16) <= 238 && p.y / 16 > 30).length,
        };
      });
    await l2Hole.evaluate(() => {
      const d = window.__KERANA_DEBUG__;
      window.__TRAPS__ = 0;
      const orig = d.scene.respawn;
      d.scene.respawn = function (reason) {
        if (reason === 'trap') window.__TRAPS__++;
        return orig.call(this, reason);
      };
      d.player.body.reset(231.5 * 16, 26 * 16);
    });
    await sleep(500);
    const holeStart = await holeState();
    // Al hueco caminando desde el pilar, y de pared a pared para cobrar el premio.
    await l2Hole.keyboard.down('ArrowRight');
    for (let t = 0; t < 6000 && (await holeState()).x < 237.5; t += 100) await sleep(100);
    await l2Hole.keyboard.up('ArrowRight');
    await l2Hole.keyboard.down('ArrowLeft');
    for (let t = 0; t < 4000 && (await holeState()).x > 234.6; t += 100) await sleep(100);
    await l2Hole.keyboard.up('ArrowLeft');
    await sleep(300);
    const inHole = await holeState();
    await l2Hole.screenshot({ path: join(SHOTS, 'l2-hueco.png') });
    // Tajo normal hacia el fardo (mirando a la izquierda, pegada a la pared).
    await l2Hole.keyboard.press('KeyX');
    for (let t = 0; t < 2000 && (await holeState()).fardo !== 'roto'; t += 100) await sleep(100);
    const broken = await holeState();
    // Sale por el túnel hasta el piso de C1, al pie del ascenso (x < 227).
    await l2Hole.keyboard.down('ArrowLeft');
    for (let t = 0; t < 6000 && (await holeState()).x > 226; t += 100) await sleep(100);
    await l2Hole.keyboard.up('ArrowLeft');
    const out = await holeState();
    check(
      holeStart.fardo === 'dibujado' &&
        inHole.feet === 33 &&
        inHole.immune &&
        inHole.prize === 0 &&
        inHole.inView &&
        broken.fardo === 'roto' &&
        out.x <= 226 &&
        out.feet === 33 &&
        out.traps === 0,
      `nivel 2: el hueco del premio se cobra (Luz y guavirá), el fardo se ve desde adentro, cae con el tajo normal y se sale por el túnel; la red no actúa (${JSON.stringify({ holeStart, inHole, broken, out })})`,
    );
    await l2Hole.close();

    // 1c6) Ñakurutu con tiro libre (S24): el del poste de C1 (x 204), con Kerana quieta en el piso a 4 tiles y el camino
    // libre, avisa, se lanza y llega hasta ella. Con Kerana al pie del poste (el camino cruza el poste) espera en su lugar.
    const l2Dive = await open('/?debug=1&level=2&god=1');
    await l2Dive.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const diveAt = (kx, ms) =>
      l2Dive.evaluate(
        (kx, ms) =>
          new Promise((resolve) => {
            const d = window.__KERANA_DEBUG__;
            const s = d.scene;
            const n = s.enemies.find((e) => e.def.id === 'nakurutu' && Math.floor(e.spawnX / 16) === 204);
            n.body.reset(n.spawnX, n.spawnY);
            n.diveState = 'perch';
            n.msLeft = 0;
            d.player.body.reset(kx * 16, 33 * 16);
            const out = { warned: false, dove: false, minDist: 99 };
            let left = ms;
            const tick = (_t, delta) => {
              if (n.diveState === 'telegraph') out.warned = true;
              if (n.diveState === 'dive') {
                out.dove = true;
                out.minDist = Math.min(out.minDist, +(Math.hypot(n.x - d.player.x, n.y - d.player.y) / 16).toFixed(2));
              }
              left -= delta;
              if (left > 0 && !(out.dove && n.diveState === 'return')) return;
              s.events.off('postupdate', tick);
              resolve(out);
            };
            s.events.on('postupdate', tick);
          }),
        kx,
        ms,
      );
    const diveFree = await diveAt(200.5, 4000);
    const diveBlocked = await diveAt(203.4, 2500);
    check(
      diveFree.warned && diveFree.dove && diveFree.minDist < 1.5 && !diveBlocked.warned && !diveBlocked.dove,
      `nivel 2: el ñakurutu del poste con tiro libre avisa y se lanza hasta Kerana; con el poste en el medio espera (${JSON.stringify({ diveFree, diveBlocked })})`,
    );
    // Zona de ritmo (S24): captura desde la orilla con el primer jakare guasu afuera (l2-ritmo.png).
    await l2Dive.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(316.5 * 16, 33 * 16));
    const firstOut = () => l2Dive.evaluate(() => window.__KERANA_DEBUG__.scene.enemies.find((e) => e.def.id === 'jakare_guasu').lurkState === 'exposed');
    for (let t = 0; t < 10000 && !(await firstOut()); t += 100) await sleep(100);
    await sleep(200);
    await l2Dive.screenshot({ path: join(SHOTS, 'l2-ritmo.png') });
    await l2Dive.close();

    // 1d) Nivel 3: antesala, cierre de la arena de Moñái, fase 3 forzada (robo) y liberación con salto doble.
    const l3Page = await open('/?debug=1&level=3&boss=1&god=1');
    await l3Page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l3x = await l3Page.evaluate(() => window.__KERANA_DEBUG__.player.x);
    // S25: la antesala se corrió con el rediseño (x 448-477).
    check(l3x > 448 * TILE && l3x < 478 * TILE, `nivel 3 con boss=1 empieza en la antesala (x ${Math.round(l3x / TILE)} tiles)`);
    await walkIntoArena(l3Page);
    check(await l3Page.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true), 'nivel 3: la arena de Moñái se cierra');
    await sleep(6000);
    await l3Page.screenshot({ path: join(SHOTS, 'boss-l3.png') });
    const l3state = await l3Page.evaluate(() => window.__KERANA_DEBUG__.scene.boss.brain.state);
    check(l3state !== 'waiting', `Moñái ataca (estado ${l3state})`);
    const l3phase = await l3Page.evaluate(async () => {
      const boss = window.__KERANA_DEBUG__.scene.boss;
      boss.brain.damage(8);
      await new Promise((r) => setTimeout(r, 6000));
      return boss.brain.phase;
    });
    check(l3phase === 2, `Moñái fase 3 sin errores (fase ${l3phase})`);
    await l3Page.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    // El Space del bucle puede saltar "Nivel completado" al mapa justo cuando aparece: ambas cuentan.
    const l3Done = () => l3Page.evaluate(() => { const s = window.__KERANA_GAME__?.scene; return !!s && (s.isActive('LevelComplete') || s.isActive('Map')); });
    for (let i = 0; i < PRESS_MAX && !(await l3Done()); i++) {
      await l3Page.keyboard.press('Space');
      await sleep(300);
    }
    check(await l3Done(), 'Moñái vencido → liberación → Nivel completado');
    const l3save = await l3Page.evaluate(() => JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}'));
    check(l3save.freed?.includes('monai') && l3save.gifts?.includes('double_jump'), 'guardado: Moñái liberado y salto doble');
    await l3Page.close();

    // 1d2) l3 de punta a punta (S25): el piloto cruza el campo por la ruta principal (tacurú agrietado, par de balsas, pencas
    // de la loma, viento en contra, hongo -> ascensor, barra y rama alta, meseta, hongo dormido, pencas en zigzag, copas, la
    // cadena de seis y la zona de ritmo con viento) y después la liberación hasta "Nivel completado".
    const l3Run = await open('/?debug=1&level=3&god=1');
    await l3Run.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l3Info = await l3Run.evaluate(() => {
      const s = window.__KERANA_DEBUG__.scene;
      const groups = new Set(s.breakables.map((b) => b.group));
      return {
        charge: window.__KERANA_DEBUG__.player.motor.chargeEnabled,
        movers: s.movers.length,
        vertical: s.movers.filter((m) => m.motor.uy !== 0).length,
        switches: s.switches.length,
        gates: s.gates.length,
        bouncers: s.bouncers.map((b) => b.motor.state).join(','),
        rocks: [...groups].filter((g) => g[0].kind === 'rock').length,
        brittle: [...groups].filter((g) => g[0].kind === 'brittle').length,
        wind: s.windZones.length,
        checkpoints: s.checkpoints.length,
        feathers: s.pickups.filter((p) => p.kind === 'pluma').length + s.feathers,
        enemies: s.enemies.reduce((acc, e) => ({ ...acc, [e.def.id]: (acc[e.def.id] ?? 0) + 1 }), {}),
        traps: s.trapCells ? s.trapCells.reduce((n, v) => n + v, 0) : 0,
      };
    });
    check(
      l3Info.charge &&
        l3Info.movers === 19 &&
        l3Info.vertical === 3 &&
        l3Info.switches === 2 &&
        l3Info.gates === 1 &&
        l3Info.bouncers === 'ready,ready,ready,asleep' &&
        l3Info.rocks === 2 &&
        l3Info.brittle === 5 &&
        l3Info.wind === 12 &&
        l3Info.checkpoints === 4 &&
        l3Info.feathers === 3 &&
        l3Info.enemies.karakara === 9 &&
        l3Info.traps === 0,
      `nivel 3: 19 plataformas (3 verticales), 2 piedras y 1 reja, 4 hongos, 2 tacurúes agrietados y 5 fardos, 12 zonas de viento, 4 fuegos, 3 plumas, 9 karakara, ningún encierro (${JSON.stringify(l3Info)})`,
    );
    // Zona de ritmo: mientras corre el piloto, el viento en contra de cada encuentro sopla cuando las balsas llegan y
    // amaina con ellas juntas (lo mismo que tests/rhythm.test.ts, ahora en el juego).
    await l3Run.evaluate(() => {
      const s = window.__KERANA_DEBUG__.scene;
      const zones = s.windZones.filter((z) => z.zone.y === 27 * 16);
      const rafts = s.movers.filter((m) => m.zone.y === 33 * 16 && m.zone.x >= 362 * 16);
      const open = zones.map(() => null);
      window.__WINDS__ = { meetings: 0, calm: 0, startGust: 0 };
      s.events.on('postupdate', (_t, d) => {
        zones.forEach((z, i) => {
          const from = rafts.filter((m) => m.block.x + m.block.width <= z.zone.x + 1).sort((a, b) => b.block.x - a.block.x)[0];
          const to = rafts.filter((m) => m.block.x >= z.zone.right - 1).sort((a, b) => a.block.x - b.block.x)[0];
          const together = to.block.x - (from.block.x + from.block.width) <= 3 * 16 + 0.5;
          if (together && !open[i]) open[i] = { gust: z.cycle.phase === 'gust', calm: 0 };
          if (together && z.cycle.phase === 'calm') open[i].calm += d;
          if (!together && open[i]) {
            const w = window.__WINDS__;
            w.meetings++;
            if (open[i].calm >= 600) w.calm++;
            if (open[i].gust) w.startGust++;
            open[i] = null;
          }
        });
      });
    });
    await l3Run.evaluate(installPilot, L3_MAIN);
    for (let t = 0; t < 420000 && !(await pilot(l3Run)).done; t += 500) await sleep(500);
    const run3 = await pilot(l3Run);
    check(run3.done && run3.respawns === 0, `nivel 3: Kerana cruza el campo entero sin caer (${JSON.stringify(run3)})`);
    if (!run3.done) {
      await l3Run.screenshot({ path: join(SHOTS, 'l3-piloto-atascado.png') });
      console.log((await l3Run.evaluate(() => window.__KERANA_PILOT__.log)).slice(-30).join('\n'));
    }
    const winds3 = await l3Run.evaluate(() => window.__WINDS__);
    // La primera vuelta de cada zona arranca en calma (offsetMs): se acepta un encuentro sin ráfaga por zona.
    check(
      winds3.meetings > 20 && winds3.calm === winds3.meetings && winds3.startGust >= winds3.meetings - 6,
      `nivel 3: en la zona de ritmo el viento sopla cuando llegan las balsas y amaina con ellas juntas (${JSON.stringify(winds3)})`,
    );
    console.log(`  l3 (ruta principal): ${(run3.timeMs / 1000).toFixed(1)} s de juego hasta la arena; parciales ${JSON.stringify(run3.splits)}`);
    await l3Run.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    for (let i = 0; i < PRESS_MAX && !(await l3Run.evaluate(() => { const s = window.__KERANA_GAME__?.scene; return !!s && (s.isActive('LevelComplete') || s.isActive('Map')); })); i++) {
      await l3Run.keyboard.press('Space');
      await sleep(300);
    }
    check(await l3Run.evaluate(() => { const s = window.__KERANA_GAME__?.scene; return !!s && (s.isActive('LevelComplete') || s.isActive('Map')); }), 'nivel 3 recorrido → liberación → Nivel completado');
    await l3Run.close();

    // 1d3) l3, el lugar secreto (S25): la cueva del viento. Desde la repisa del ascenso 2: el fardo de la ladera se ve con
    // el ascensor abajo (captura l3-cueva.png), se rompe, los dos pozos de 8 se cruzan solo con la ráfaga a favor, la pluma B
    // está en la cámara y el túnel de abajo devuelve al pie del ascenso. Antes, un salto en calma cae al túnel de abajo.
    const l3Cave = await open('/?debug=1&level=3&god=1');
    await l3Cave.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const calmJump = await l3Cave.evaluate(async () => {
      const d = window.__KERANA_DEBUG__;
      const z = d.scene.windZones.find((w) => w.zone.x === 189 * 16);
      d.player.body.reset(186 * 16, 23.3 * 16);
      await new Promise((r) => {
        const f = () => (z.cycle.phase === 'calm' && z.cycle.leftMs > 1400 ? r() : setTimeout(f, 16));
        f();
      });
      return true;
    });
    await l3Cave.evaluate(installPilot, { aim: true, steps: [{ run: 1, untilX: 199 }] });
    for (let t = 0; t < 15000 && !(await pilot(l3Cave)).done; t += 250) await sleep(250);
    const calmEnd = await l3Cave.evaluate(() => window.__KERANA_DEBUG__.player.body.bottom / 16);
    check(calmJump && calmEnd > 30, `nivel 3: en la cueva, el salto en calma no cruza el pozo de 8 y cae al túnel de abajo (pies en la fila ${calmEnd.toFixed(1)})`);
    await l3Cave.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(178.5 * 16, 23.3 * 16));
    await l3Cave.waitForFunction(() => { const m = window.__KERANA_DEBUG__.scene.movers.find((mv) => mv.zone.x === 181 * 16); return m.motor.pos < 1 && m.motor.waitLeftMs > 300; }, { timeout: 30000, polling: 50 });
    await l3Cave.screenshot({ path: join(SHOTS, 'l3-cueva.png') });
    const caveStart = await l3Cave.evaluate(() => window.__KERANA_DEBUG__.scene.feathers);
    await l3Cave.evaluate(installPilot, L3_SECRET);
    for (let t = 0; t < 120000 && !(await pilot(l3Cave)).done; t += 500) await sleep(500);
    const cave = await l3Cave.evaluate(() => ({ done: window.__KERANA_PILOT__.done, hud: window.__KERANA_DEBUG__.scene.feathers, respawns: window.__KERANA_PILOT__.respawns, x: Math.round(window.__KERANA_DEBUG__.player.x / 16), feet: Math.round(window.__KERANA_DEBUG__.player.body.bottom / 16), timeMs: Math.round(window.__KERANA_PILOT__.timeMs) }));
    check(
      cave.done && cave.hud === caveStart + 1 && cave.respawns === 0 && cave.feet === 33 && cave.x < 184,
      `nivel 3: la cueva del viento se cruza con la ráfaga a favor, paga la pluma B y devuelve al pie del ascenso (${JSON.stringify(cave)})`,
    );
    if (!cave.done) console.log((await l3Cave.evaluate(() => window.__KERANA_PILOT__.log)).slice(-30).join('\n'));
    console.log(`  l3 (cueva del viento): ${(cave.timeMs / 1000).toFixed(1)} s de juego desde la repisa del ascenso 2 hasta volver al pie`);
    await l3Cave.close();

    // 1e) Nivel 4: antesala, cierre de la arena de Jasy Jatere, fase invisible, carrera por el bastón y dash guardado.
    const l4Page = await open('/?debug=1&level=4&boss=1&god=1');
    await l4Page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l4x = await l4Page.evaluate(() => window.__KERANA_DEBUG__.player.x);
    check(l4x > 210 * TILE && l4x < 230 * TILE, `nivel 4 con boss=1 empieza en la antesala (x ${Math.round(l4x / TILE)} tiles)`);
    await walkIntoArena(l4Page);
    check(await l4Page.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true), 'nivel 4: la arena de Jasy Jatere se cierra');
    await sleep(5000);
    await l4Page.screenshot({ path: join(SHOTS, 'boss-l4.png') });
    await l4Page.screenshot({ path: join(SHOTS, 'bg-l4.png') });
    check((await backdropState(l4Page)).images === 1, 'nivel 4: tiene su fondo (l4_far)');
    const l4state = await l4Page.evaluate(() => window.__KERANA_DEBUG__.scene.boss.brain.state);
    check(l4state !== 'waiting', `Jasy Jatere ataca (estado ${l4state})`);
    const l4phase = await l4Page.evaluate(async () => {
      const boss = window.__KERANA_DEBUG__.scene.boss;
      boss.brain.damage(4);
      await new Promise((r) => setTimeout(r, 6000));
      return { phase: boss.brain.phase, alpha: boss.body.alpha };
    });
    check(l4phase.phase === 1 && l4phase.alpha < 0.5, `Jasy Jatere invisible en la fase 2 (fase ${l4phase.phase}, alpha ${l4phase.alpha})`);
    // Carrera: el golpe final suelta el bastón; Kerana lo toca y gana.
    const l4race = await l4Page.evaluate(async () => {
      const boss = window.__KERANA_DEBUG__.scene.boss;
      boss.brain.damage(boss.brain.hp - 1);
      boss.startRace();
      const started = boss.race.active;
      await new Promise((r) => setTimeout(r, 1200));
      window.__KERANA_DEBUG__.player.body.reset(boss.staff.x, boss.staff.y + 20);
      await new Promise((r) => setTimeout(r, 300));
      return { started, defeated: boss.brain.state === 'defeated' };
    });
    check(l4race.started && l4race.defeated, `carrera por el bastón: Kerana lo toca y gana (${JSON.stringify(l4race)})`);
    // El Space del bucle puede saltar "Nivel completado" al mapa justo cuando aparece: ambas cuentan.
    const l4Done = () => l4Page.evaluate(() => { const s = window.__KERANA_GAME__?.scene; return !!s && (s.isActive('LevelComplete') || s.isActive('Map')); });
    for (let i = 0; i < PRESS_MAX && !(await l4Done()); i++) {
      await l4Page.keyboard.press('Space');
      await sleep(300);
    }
    check(await l4Done(), 'Jasy Jatere vencido → liberación → Nivel completado');
    const l4save = await l4Page.evaluate(() => JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}'));
    check(l4save.freed?.includes('jasy_jatere') && l4save.gifts?.includes('dash'), 'guardado: Jasy Jatere liberado y Paso de la siesta');
    await l4Page.close();

    // 1f) Nivel 5: antesala, cierre de la arena de Kurupi, llamado de animales, engaño (fase 3) y +1 corazón.
    const l5Page = await open('/?debug=1&level=5&boss=1&god=1');
    await l5Page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l5x = await l5Page.evaluate(() => window.__KERANA_DEBUG__.player.x);
    check(l5x > 210 * TILE && l5x < 240 * TILE, `nivel 5 con boss=1 empieza en la antesala (x ${Math.round(l5x / TILE)} tiles)`);
    await walkIntoArena(l5Page);
    check(await l5Page.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true), 'nivel 5: la arena de Kurupi se cierra');
    await sleep(5000);
    await l5Page.screenshot({ path: join(SHOTS, 'boss-l5.png') });
    const l5state = await l5Page.evaluate(() => window.__KERANA_DEBUG__.scene.boss.brain.state);
    check(l5state !== 'waiting', `Kurupi ataca (estado ${l5state})`);
    // Fase 3 forzada: espera a que arme el engaño (copias vivas) sin errores.
    const l5phase = await l5Page.evaluate(async () => {
      const boss = window.__KERANA_DEBUG__.scene.boss;
      boss.brain.damage(8);
      let copies = 0;
      for (let i = 0; i < 80 && copies === 0; i++) {
        await new Promise((r) => setTimeout(r, 100));
        copies = boss.copies.filter((c) => c.alive).length;
      }
      return { phase: boss.brain.phase, copies };
    });
    check(l5phase.phase === 2 && l5phase.copies === 2, `Kurupi fase 3: se divide en tres (${JSON.stringify(l5phase)})`);
    await l5Page.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    // El Space del bucle puede saltar "Nivel completado" al mapa justo cuando aparece: ambas cuentan.
    const l5Done = () => l5Page.evaluate(() => { const s = window.__KERANA_GAME__?.scene; return !!s && (s.isActive('LevelComplete') || s.isActive('Map')); });
    for (let i = 0; i < PRESS_MAX && !(await l5Done()); i++) {
      await l5Page.keyboard.press('Space');
      await sleep(300);
    }
    check(await l5Done(), 'Kurupi vencido → liberación → Nivel completado');
    const l5save = await l5Page.evaluate(() => JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}'));
    check(l5save.freed?.includes('kurupi') && l5save.maxHearts === 6, `guardado: Kurupi liberado y +1 corazón (${l5save.maxHearts})`);
    await l5Page.close();

    // 1g) Nivel 5 desde el principio: caminando a la derecha, el primer hongo hace rebotar a Kerana más alto que un salto.
    // (Empieza pasadas las espinas de práctica del Paso de la siesta, x 7-9.)
    const l5aPage = await open('/?debug=1&level=5&god=1');
    await l5aPage.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await l5aPage.evaluate(() => {
      const d = window.__KERANA_DEBUG__;
      d.player.body.reset(11 * 16 + 8, d.player.y);
    });
    await sleep(500);
    // La altura la mide el juego (BounceMeter de Kerana, en cada paso): muestrear desde afuera perdía el pico
    // y una ventana fija de tiempo real se quedaba corta cuando el headless va lento. Espera por estado (tope 15 s).
    await l5aPage.keyboard.down('ArrowRight');
    for (let t = 0; t < 15000 && (await l5aPage.evaluate(() => window.__KERANA_DEBUG__.player.bounceMeter.count)) < 1; t += 50) await sleep(50);
    await l5aPage.keyboard.up('ArrowRight');
    const l5bounce = Math.round(await l5aPage.evaluate(() => window.__KERANA_DEBUG__.player.bounceMeter.lastHeight));
    check(l5bounce > 90, `nivel 5: el hongo hace rebotar a Kerana (${l5bounce} px)`);
    await l5aPage.close();

    // 1h) Nivel 6: antesala, cierre de la arena de Ao Ao, refugio en el pindó, furia (fase 3) y +1 corazón (7).
    const l6Page = await open('/?debug=1&level=6&boss=1&god=1');
    await l6Page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l6x = await l6Page.evaluate(() => window.__KERANA_DEBUG__.player.x);
    check(l6x > 230 * TILE && l6x < 250 * TILE, `nivel 6 con boss=1 empieza en la antesala (x ${Math.round(l6x / TILE)} tiles)`);
    await walkIntoArena(l6Page);
    check(await l6Page.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true), 'nivel 6: la arena de Ao Ao se cierra');
    await sleep(4000);
    await l6Page.screenshot({ path: join(SHOTS, 'boss-l6.png') });
    const l6state = await l6Page.evaluate(() => window.__KERANA_DEBUG__.scene.boss.brain.state);
    check(l6state !== 'waiting', `Ao Ao ataca (estado ${l6state})`);
    // Kerana en la copa del pindó derecho: Ao Ao deja de atacar y da vueltas al pie.
    const l6refuge = await l6Page.evaluate(async () => {
      const d = window.__KERANA_DEBUG__;
      const r = d.scene.refuges[d.scene.refuges.length - 1];
      d.player.body.reset((r.left + r.right) / 2, r.top - 2);
      let circling = false;
      for (let i = 0; i < 60 && !circling; i++) {
        await new Promise((res) => setTimeout(res, 100));
        circling = d.scene.boss.circling;
      }
      return { onRefuge: d.scene.playerOnRefuge(), circling };
    });
    check(l6refuge.onRefuge && l6refuge.circling, `en el pindó Kerana está a salvo y Ao Ao da vueltas (${JSON.stringify(l6refuge)})`);
    // Baja a pelear y fuerza la furia: la pelea sigue sin errores.
    const l6phase = await l6Page.evaluate(async () => {
      const d = window.__KERANA_DEBUG__;
      d.player.body.reset(d.scene.arena.rect.centerX, d.scene.boss.ctx.floorY - 20);
      d.scene.boss.brain.damage(10);
      await new Promise((res) => setTimeout(res, 5000));
      return { phase: d.scene.boss.brain.phase, circling: d.scene.boss.circling };
    });
    check(l6phase.phase === 2 && !l6phase.circling, `Ao Ao fase 3 (${JSON.stringify(l6phase)})`);
    await l6Page.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    const l6Done = () => l6Page.evaluate(() => { const s = window.__KERANA_GAME__?.scene; return !!s && (s.isActive('LevelComplete') || s.isActive('Map')); });
    for (let i = 0; i < PRESS_MAX && !(await l6Done()); i++) {
      await l6Page.keyboard.press('Space');
      await sleep(300);
    }
    check(await l6Done(), 'Ao Ao vencido → liberación → Nivel completado');
    const l6save = await l6Page.evaluate(() => JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}'));
    check(l6save.freed?.includes('ao_ao') && l6save.maxHearts === 7, `guardado: Ao Ao liberado y +1 corazón (${l6save.maxHearts})`);
    await l6Page.close();

    // 1i) Nivel 4 (extra): vacas sueltas y onda de luz del tajo cargado.
    const cowPage = await open('/?debug=1&level=4&gifts=all&god=1');
    await cowPage.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const cows = await cowPage.evaluate(() => window.__KERANA_DEBUG__.scene.cows.length);
    check(cows === 3, `nivel 4: vacas sueltas (${cows})`);
    // Mantener hasta que el tajo esté cargado (en máquinas lentas el tiempo de juego va más lento que el real).
    // Espera por estado (carga completa, tope 10 s) en vez de un tiempo fijo.
    await cowPage.keyboard.down('KeyX');
    for (let t = 0; t < 10000 && (await cowPage.evaluate(() => window.__KERANA_DEBUG__.player.motor.chargeFraction)) < 1; t += 50) await sleep(50);
    await sleep(100);
    await cowPage.keyboard.up('KeyX');
    let wave = false;
    for (let t = 0; t < 3000 && !wave; t += 30) {
      wave = await cowPage.evaluate(() => window.__KERANA_DEBUG__.scene.lightWave.active);
      if (!wave) await sleep(30);
    }
    check(wave, 'tajo cargado: sale la onda de luz');
    await sleep(200);
    await cowPage.screenshot({ path: join(SHOTS, 'light-wave.png') });
    await cowPage.close();

    // 1j) Nivel 7: oscuridad, faroles y póra que solo se ven (y se pueden golpear) con luz.
    const l7aPage = await open('/?debug=1&level=7&god=1');
    await l7aPage.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l7info = await l7aPage.evaluate(() => {
      const s = window.__KERANA_DEBUG__.scene;
      const pora = s.enemies.filter((e) => e.def.id === 'pora');
      return { webgl: s.sys.renderer.type === 2, lanterns: s.lanterns.length, pora: pora.length, poraLit: pora.some((e) => e.lit) };
    });
    check(l7info.lanterns >= 10 && l7info.pora >= 3 && !l7info.poraLit, `nivel 7: faroles y póra a oscuras (${JSON.stringify(l7info)})`);
    // Kerana camina hasta el primer farol y lo enciende. Tope de 12 s de reloj (S24: con el headless a 12-17 fps, 4 s no
    // siempre alcanzaban); el bucle corta apenas se enciende.
    await l7aPage.keyboard.down('ArrowRight');
    for (let t = 0; t < 12000 && !(await l7aPage.evaluate(() => window.__KERANA_DEBUG__.scene.lanterns[0].lit)); t += 100) await sleep(100);
    await l7aPage.keyboard.up('ArrowRight');
    check(await l7aPage.evaluate(() => window.__KERANA_DEBUG__.scene.lanterns[0].lit), 'nivel 7: tocar un farol lo enciende');
    await l7aPage.screenshot({ path: join(SHOTS, 'l7-street.png') });
    // Junto a un póra, el halo lo ilumina y se vuelve vulnerable.
    const poraLit = await l7aPage.evaluate(async () => {
      const d = window.__KERANA_DEBUG__;
      const p = d.scene.enemies.find((e) => e.def.id === 'pora' && e.active);
      d.player.body.reset(p.x, p.y + 10);
      await new Promise((res) => setTimeout(res, 300));
      return p.lit && p.vulnerable;
    });
    check(poraLit, 'nivel 7: con el halo de Kerana el póra queda iluminado y vulnerable');
    await l7aPage.close();

    // 1k) Nivel 7 con boss=1: arena de Luisón, apagón (fase 2), sombra de Tau (fase 3), velas, final y créditos.
    const l7Page = await open('/?debug=1&level=7&boss=1&god=1');
    await l7Page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const l7x = await l7Page.evaluate(() => window.__KERANA_DEBUG__.player.x);
    check(l7x > 220 * TILE && l7x < 240 * TILE, `nivel 7 con boss=1 empieza en la antesala (x ${Math.round(l7x / TILE)} tiles)`);
    await walkIntoArena(l7Page, 15000, true);
    check(await l7Page.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true), 'nivel 7: la arena de Luisón se cierra');
    await sleep(4000);
    const l7state = await l7Page.evaluate(() => window.__KERANA_DEBUG__.scene.boss.brain.state);
    check(l7state !== 'waiting', `Luisón ataca (estado ${l7state})`);
    const l7blackout = await l7Page.evaluate(async () => {
      const d = window.__KERANA_DEBUG__;
      d.scene.boss.brain.damage(6);
      await new Promise((res) => setTimeout(res, 3000));
      const arena = d.scene.arena.rect;
      const arenaLanterns = d.scene.lanterns.filter((l) => arena.contains(l.zone.centerX, l.zone.bottom - 1));
      return { phase: d.scene.boss.brain.phase, blackout: d.scene.darkness.blackout, lit: arenaLanterns.filter((l) => l.lit).length };
    });
    check(l7blackout.phase === 1 && l7blackout.blackout && l7blackout.lit === 0, `Luisón fase 2: apagón (${JSON.stringify(l7blackout)})`);
    await l7Page.screenshot({ path: join(SHOTS, 'boss-l7.png') });
    const l7p3 = await l7Page.evaluate(async () => {
      const d = window.__KERANA_DEBUG__;
      d.scene.boss.brain.damage(6);
      await new Promise((res) => setTimeout(res, 4000));
      return { phase: d.scene.boss.brain.phase, tau: d.scene.boss.tauShadow.visible };
    });
    check(l7p3.phase === 2 && l7p3.tau, `Luisón fase 3: la sombra de Tau (${JSON.stringify(l7p3)})`);
    await l7Page.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    const l7Active = (key) => l7Page.evaluate((k) => window.__KERANA_GAME__?.scene.isActive(k) ?? false, key);
    await sleep(1500);
    check(await l7Page.evaluate(() => window.__KERANA_DEBUG__.scene.darkness.candles), 'Luisón liberado: las velas se encienden');
    await l7Page.screenshot({ path: join(SHOTS, 'l7-candles.png') });
    for (let i = 0; i < PRESS_MAX && !(await l7Active('LevelComplete')); i++) {
      await l7Page.keyboard.press('Space');
      await sleep(300);
    }
    check(await l7Active('LevelComplete'), 'Luisón vencido → liberación → Nivel completado');
    const l7save = await l7Page.evaluate(() => JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}'));
    check(l7save.freed?.includes('luison'), 'guardado: Luisón liberado');
    await l7Page.keyboard.press('Enter');
    await l7Page.waitForFunction(() => window.__KERANA_GAME__?.scene.isActive('Story') ?? false, { timeout: 10000 });
    check(true, 'último nivel → Eichu y aparece Tau (diapositivas)');
    await sleep(500);
    await l7Page.screenshot({ path: join(SHOTS, 'tau-arrival.png') });
    await l7Page.keyboard.down('Escape');
    const inYvaga = () =>
      l7Page.evaluate(() => (window.__KERANA_GAME__?.scene.isActive('Level') ?? false) && window.__KERANA_DEBUG__?.scene.def.id === 'yvaga');
    for (let t = 0; t < 5000 && !(await inYvaga()); t += 100) await sleep(100);
    await l7Page.keyboard.up('Escape');
    check(await inYvaga(), 'diapositivas → Yvága (arena de Tau)');
    await l7Page.close();

    // 1l) Yvága con ?level=yvaga: Tau en 3 fases (disfraz, ecos, forma real), sellado, final y créditos.
    const tauPage = await open('/?debug=1&level=yvaga&god=1');
    await tauPage.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    await walkIntoArena(tauPage, 8000);
    check(await tauPage.evaluate(() => window.__KERANA_DEBUG__.scene.fighting === true), 'Yvága: la arena de Tau se cierra');
    await sleep(4000);
    const tau1 = await tauPage.evaluate(() => {
      const b = window.__KERANA_DEBUG__.scene.boss;
      return { state: b.brain.state, form: b.form, stars: b.stars.length };
    });
    check(tau1.state !== 'waiting' && tau1.form === 'disguise' && tau1.stars === 7, `Tau fase 1: el joven de la flauta ataca (${JSON.stringify(tau1)})`);
    await tauPage.screenshot({ path: join(SHOTS, 'tau-1.png') });
    const tau2 = await tauPage.evaluate(async () => {
      const b = window.__KERANA_DEBUG__.scene.boss;
      b.brain.damage(7);
      const seen = new Set();
      for (let i = 0; i < 40; i++) {
        await new Promise((res) => setTimeout(res, 150));
        for (const [id, e] of Object.entries(b.echoes)) if (e.visible) seen.add(id);
      }
      return { phase: b.brain.phase, form: b.form, echoes: [...seen] };
    });
    check(tau2.phase === 1 && tau2.form === 'echoes' && tau2.echoes.length > 0, `Tau fase 2: los ecos de los hijos (${JSON.stringify(tau2)})`);
    await tauPage.screenshot({ path: join(SHOTS, 'tau-2.png') });
    const tau3 = await tauPage.evaluate(async () => {
      const b = window.__KERANA_DEBUG__.scene.boss;
      b.brain.damage(7);
      let smoke = false;
      let lit = -1;
      for (let i = 0; i < 40; i++) {
        await new Promise((res) => setTimeout(res, 150));
        if (b.smokeRect.visible) smoke = true;
        if (b.litStar >= 0) lit = b.litStar;
      }
      return { phase: b.brain.phase, form: b.form, core: b.core.visible, smoke, lit };
    });
    check(tau3.phase === 2 && tau3.form === 'true' && tau3.core, `Tau fase 3: forma real de humo (${JSON.stringify(tau3)})`);
    await tauPage.screenshot({ path: join(SHOTS, 'tau-3.png') });
    await tauPage.evaluate(() => window.__KERANA_DEBUG__.defeatBoss());
    const tauActive = (key) => tauPage.evaluate((k) => window.__KERANA_GAME__?.scene.isActive(k) ?? false, key);
    for (let i = 0; i < PRESS_MAX && !(await tauActive('Story')); i++) {
      await tauPage.keyboard.press('Space');
      await sleep(300);
    }
    check(await tauActive('Story'), 'Tau sellado → final verdadero (diapositivas)');
    const tauSave = await tauPage.evaluate(() => JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}'));
    check(tauSave.freed?.includes('tau'), 'guardado: Tau sellado (el mapa recupera sus colores)');
    check(tauSave.playTimeMs > 0, `guardado: tiempo de juego (${tauSave.playTimeMs} ms)`);
    // Diapositivas del final con fondo (S13a): Asunción sanada, noche con Eichu y el manantial con Eichu.
    // Pulsa hasta llegar a la diapositiva `index` con el texto entero (sin contar pulsaciones a ciegas).
    const storyState = () =>
      tauPage.evaluate(() => {
        const s = window.__KERANA_GAME__.scene.getScene('Story');
        return { index: s.index, done: s.shownChars >= s.fullText.length, imageKey: s.slides[s.index]?.imageKey };
      });
    for (const [index, name] of [
      [1, 'healed'],
      [2, 'night'],
      [3, 'spring'],
    ]) {
      for (let i = 0; i < 30; i++) {
        const st = await storyState();
        if (st.index === index && st.done) break;
        await tauPage.keyboard.press('Space');
        await sleep(200);
      }
      await sleep(300);
      await tauPage.screenshot({ path: join(SHOTS, `ending-${name}.png`) });
    }
    const slideKey = (await storyState()).imageKey;
    check(slideKey === 'bg_final' && (await tauPage.evaluate(() => window.__KERANA_GAME__.textures.exists('bg_final'))), 'final: el manantial con su imagen (bg_final)');
    await tauPage.keyboard.down('Escape');
    for (let t = 0; t < 5000 && !(await tauActive('Credits')); t += 100) await sleep(100);
    await tauPage.keyboard.up('Escape');
    check(await tauActive('Credits'), 'final → créditos');
    await sleep(300);
    await tauPage.screenshot({ path: join(SHOTS, 'credits.png') });
    await tauPage.close();

    // 1m) Vitrina de S18: plataformas móviles que llevan a Kerana, Switch con el sable y con la onda tras una pared, hongos.
    const vPage = await open('/?debug=1&level=vitrina&gifts=all&god=1');
    await vPage.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    const vInfo = await vPage.evaluate(() => {
      const s = window.__KERANA_DEBUG__.scene;
      return { movers: s.movers.length, gates: s.gates.length, switches: s.switches.length, bouncers: s.bouncers.map((b) => b.motor.state).join(',') };
    });
    check(
      vInfo.movers === 3 && vInfo.gates === 1 && vInfo.switches === 3 && vInfo.bouncers === 'ready,asleep',
      `vitrina: plataformas móviles, reja, Switch y hongos (${JSON.stringify(vInfo)})`,
    );
    // Sobre una plataforma (pies y cara de arriba, y corrimiento respecto de ella).
    const vRide = (tileX) =>
      vPage.evaluate((tx) => {
        const d = window.__KERANA_DEBUG__;
        const m = d.scene.movers.find((mv) => mv.zone.x === tx * 16);
        const p = d.player.body;
        return { gap: Math.abs(p.bottom - m.body.top), rel: p.center.x - m.body.x, off: m.motor.offsetX + m.motor.offsetY, down: p.blocked.down || p.touching.down };
      }, tileX);
    const vPut = (tileX) =>
      vPage.evaluate((tx) => {
        const d = window.__KERANA_DEBUG__;
        const m = d.scene.movers.find((mv) => mv.zone.x === tx * 16);
        m.reset();
        d.player.body.reset(m.block.x + 24, m.block.y);
      }, tileX);
    // Mirar a la derecha sin caminar (con la flecha, en un headless lento llegaba a moverse varios px).
    const vFaceRight = () => vPage.evaluate(() => (window.__KERANA_DEBUG__.player.motor.facing = 1));
    // Horizontal, sobre el pozo: avanza con ella.
    await vPut(16);
    await sleep(300);
    const h0 = await vRide(16);
    for (let t = 0; t < 8000 && (await vRide(16)).off < 64; t += 50) await sleep(50);
    const h1 = await vRide(16);
    check(h1.off >= 64 && Math.abs(h1.rel - h0.rel) < 2 && h1.gap < 2 && h1.down, `vitrina: la plataforma horizontal lleva a Kerana (${JSON.stringify(h1)})`);
    // Vertical: sube y baja sin que Kerana la atraviese ni se despegue.
    await vPut(36);
    // El cuerpo se sincroniza en el próximo paso de la física: se mide desde ahí.
    await sleep(300);
    let vMaxGap = 0;
    let vTop = 0;
    for (let t = 0; t < 15000 && vTop > -100; t += 50) {
      const r = await vRide(36);
      vMaxGap = Math.max(vMaxGap, r.gap);
      vTop = Math.min(vTop, r.off);
      await sleep(50);
    }
    let vBack = vTop;
    for (let t = 0; t < 15000 && vBack < -16; t += 50) {
      const r = await vRide(36);
      vMaxGap = Math.max(vMaxGap, r.gap);
      vBack = r.off;
      await sleep(50);
    }
    check(vTop <= -100 && vBack >= -16 && vMaxGap < 3, `vitrina: la plataforma vertical sube y baja con Kerana encima (separación máx. ${vMaxGap.toFixed(1)} px)`);
    // Switch con el sable: abre la reja.
    await vPage.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(50 * 16 + 8, 27 * 16));
    await sleep(300);
    await vFaceRight();
    await vPage.keyboard.press('KeyX');
    for (let t = 0; t < 3000 && !(await vPage.evaluate(() => window.__KERANA_DEBUG__.scene.gates[0].isOpen)); t += 50) await sleep(50);
    check(await vPage.evaluate(() => window.__KERANA_DEBUG__.scene.gates[0].isOpen), 'vitrina: el sable enciende el Switch y la reja se abre');
    // Switch encerrado en la pared: solo la onda del tajo cargado lo enciende y el ascensor sube.
    await vPage.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(70 * 16 + 4, 27 * 16));
    await sleep(300);
    await vFaceRight();
    await vPage.keyboard.down('KeyX');
    for (let t = 0; t < 10000 && (await vPage.evaluate(() => window.__KERANA_DEBUG__.player.motor.chargeFraction)) < 1; t += 50) await sleep(50);
    await sleep(100);
    await vPage.keyboard.up('KeyX');
    const ascOn = () => vPage.evaluate(() => window.__KERANA_DEBUG__.scene.switchBoard.isPowered('ascensor'));
    for (let t = 0; t < 3000 && !(await ascOn()); t += 50) await sleep(50);
    check(await ascOn(), 'vitrina: la onda atraviesa la pared, enciende el Switch y el ascensor arranca');
    await vPage.screenshot({ path: join(SHOTS, 'vitrina.png') });
    // Hongo de un solo uso: rebota y se desinfla. Hongo dormido: no rebota hasta el tajo cargado.
    const bState = (i) => vPage.evaluate((k) => window.__KERANA_DEBUG__.scene.bouncers[k].motor.state, i);
    await vPage.evaluate(() => {
      const d = window.__KERANA_DEBUG__;
      d.player.body.reset(76 * 16 + 8, 14 * 16 - 20);
    });
    for (let t = 0; t < 5000 && (await bState(0)) !== 'deflated'; t += 50) await sleep(50);
    check((await bState(0)) === 'deflated', 'vitrina: el hongo de un solo uso se desinfla al rebotar');
    await vPage.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(81 * 16 + 4, 14 * 16));
    await sleep(300);
    await vFaceRight();
    const asleep = (await bState(1)) === 'asleep';
    await vPage.keyboard.down('KeyX');
    for (let t = 0; t < 10000 && (await vPage.evaluate(() => window.__KERANA_DEBUG__.player.motor.chargeFraction)) < 1; t += 50) await sleep(50);
    await sleep(100);
    await vPage.keyboard.up('KeyX');
    for (let t = 0; t < 3000 && (await bState(1)) !== 'ready'; t += 50) await sleep(50);
    check(asleep && (await bState(1)) === 'ready', 'vitrina: el hongo dormido despierta con el tajo cargado');
    await vPage.close();

    // 1m2) Red de seguridad (S24) con lo que hace una persona encerrada: en el pozo F de la vitrina (pared de 7, con
    // salto doble no se sale) Kerana no se queda quieta: corre de pared a pared, salta, usa el salto doble y ataca sin
    // parar. La red la saca igual a los GAMEPLAY.trap.waitMs (4000) de juego, a la torre y con un corazón menos.
    // (S23 lo probaba con Kerana quieta y sin salto doble; con salto doble el modelo daba por salida la pared de 7.)
    const netPage = await open('/?debug=1&level=vitrina&gifts=all');
    await netPage.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 10000 });
    await sleep(500);
    // Primero en la torre (último suelo firme), después adentro del pozo.
    await netPage.evaluate(() => window.__KERANA_DEBUG__.player.body.reset(84.5 * 16, 14 * 16));
    await sleep(600);
    const net = await netPage.evaluate(
      () =>
        new Promise((resolve) => {
          const d = window.__KERANA_DEBUG__;
          const s = d.scene;
          const b = d.player.body;
          const kb = s.input.keyboard;
          const keys = { left: kb.addKey(37), right: kb.addKey(39), jump: kb.addKey(32), attack: kb.addKey(88) };
          const set = (k, on) => {
            if (k.isDown === on) return;
            k.isDown = on;
            k.isUp = !on;
            k.emit(on ? 'down' : 'up', k);
          };
          const out = { hearts0: d.player.health.current, marked: !!s.trapCells, traps: 0, ms: 0, jumps: 0, doubles: 0, attacks: 0, topFeet: 99, x0: 99, x1: 0 };
          const orig = s.respawn;
          s.respawn = function (reason) {
            if (reason === 'trap') out.traps++;
            return orig.call(this, reason);
          };
          b.reset(88.5 * 16, 27 * 16);
          let f = 0;
          let after = -1;
          let phase = 'ground';
          const tick = (_time, delta) => {
            f++;
            if (out.traps > 0) {
              for (const k of Object.values(keys)) set(k, false);
              // Unos cuadros después de la red (reaparece un poco arriba y cae), para leer dónde quedó.
              if (++after < 40) return;
              s.events.off('preupdate', tick);
              Object.assign(out, { x: +(b.center.x / 16).toFixed(1), feet: +(b.bottom / 16).toFixed(1), hearts: d.player.health.current });
              resolve(out);
              return;
            }
            out.ms += delta;
            out.topFeet = Math.min(out.topFeet, +(b.bottom / 16).toFixed(2));
            out.x0 = Math.min(out.x0, +(b.center.x / 16).toFixed(2));
            out.x1 = Math.max(out.x1, +(b.center.x / 16).toFixed(2));
            // De pared a pared, cambiando cada 25 cuadros.
            const right = Math.floor(f / 25) % 2 === 0;
            set(keys.right, right);
            set(keys.left, !right);
            // Salta apenas pisa; cerca del ápice suelta y vuelve a apretar (salto doble).
            if (phase === 'ground' && b.blocked.down) {
              set(keys.jump, true);
              out.jumps++;
              phase = 'rise';
            } else if (phase === 'rise' && b.velocity.y > -60) {
              set(keys.jump, false);
              phase = 'double';
            } else if (phase === 'double') {
              set(keys.jump, true);
              out.doubles++;
              phase = 'fall';
            } else if (phase === 'fall' && b.blocked.down) {
              set(keys.jump, false);
              phase = 'ground';
            }
            // Un tajo cada 23 cuadros.
            if (f % 23 === 0) out.attacks++;
            set(keys.attack, f % 23 === 0);
            if (out.ms > 12000) {
              s.events.off('preupdate', tick);
              for (const k of Object.values(keys)) set(k, false);
              resolve(out);
            }
          };
          s.events.on('preupdate', tick);
        }),
    );
    check(
      net.marked &&
        net.traps === 1 &&
        net.ms >= 3900 &&
        net.ms <= 4400 &&
        net.jumps >= 4 &&
        net.doubles >= 3 &&
        net.attacks >= 5 &&
        net.topFeet > 20 &&
        net.x >= 71 &&
        net.x <= 87 &&
        Math.abs(net.feet - 14) < 0.2 &&
        net.hearts === net.hearts0 - 1,
      `red de seguridad: Kerana encerrada que corre, salta, usa el salto doble y ataca sale a los 4 s, a la torre y con un corazón menos (${JSON.stringify(net)})`,
    );
    await netPage.close();

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
