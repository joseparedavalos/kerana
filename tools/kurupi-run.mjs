// S114: pelea completa contra Kurupi en el build, jugada con teclas simuladas como una persona (como `npm run luison`).
// Kerana entra a la arena de l5 (`?debug=1&level=5&boss=1&god=1`), salta las ondas del pisotón cuando se le vienen
// encima, se queda a distancia mientras Kurupi ataca y le tira tajos (tecla X) en cada ventana, hasta vencerlo.
// `debug=1` se usa solo para LEER el estado (dónde está Kurupi, si la ventana está abierta, dónde van las ondas): nada
// se fuerza ni se resta a mano. En la fase 3 sigue al verdadero (una persona lo reconoce por las huellas al revés).
// Registra cuadro a cuadro vida, fase, estado y ataque en tmp/kurupi/*.json e imprime la duración de cada pelea (en
// tiempo de juego), los golpes contra el tiempo, lo que duró cada fase, los pisotones y las ondas saltadas.
// Con KURUPI_SEED=<n>, la pelea i siembra el azar del cerebro de Kurupi (`BossBrain.rng`, qué ataque elige) con n + i:
// así dos builds se comparan a igual suerte (el resto del azar del juego no se toca).
// Uso: npm run build && npm run kurupi [-- <peleas> <etiqueta>]
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tmp', 'kurupi');
const QUERY = '?debug=1&level=5&boss=1&god=1';
const FIGHTS = Number(process.argv[2] ?? 3);
const LABEL = process.argv[3] ?? 'pelea';
const DIST = process.env.KURUPI_DIST ?? join(ROOT, 'dist');
const MAX_MS = Number(process.env.KURUPI_MAX_MS ?? 300000);
const SEED = process.env.KURUPI_SEED === undefined ? null : Number(process.env.KURUPI_SEED);
/** Fuera de la ventana se queda a esta distancia de Kurupi (px), como quien espera; en la ventana entra a pegar. */
const KEEP_AWAY = 72;
/** Salta una onda que viene hacia ella a menos de tantos px (la onda corre a 150 px/s). */
const JUMP_AT = 44;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const candidates = [process.env.CHROME_PATH];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(pw)) {
    for (const d of readdirSync(pw).filter((n) => n.startsWith('chromium-'))) candidates.push(join(pw, d, 'chrome-linux', 'chrome'));
    candidates.push(join(pw, 'chromium'));
  }
  candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  return candidates.find((p) => p && existsSync(p));
}

/** Las ondas de Kurupi: hasta S113 un arreglo de rectángulos, desde S114 `KurupiWaves.list` (los dos se leen igual). */
function wavesOf(b) {
  const list = Array.isArray(b.waves) ? b.waves : b.waves.list;
  return list.map((w) => ({ x: w.rect ? w.rect.x : w.x, vx: w.vx, life: w.lifeMs }));
}

/** Registro cuadro a cuadro (solo lee el estado). */
function installRecorder(wavesOfSrc) {
  const wavesOf = new Function(`return ${wavesOfSrc}`)();
  const d = window.__KERANA_DEBUG__;
  const sc = d.scene;
  window.__REC = [];
  sc.events.on('postupdate', () => {
    const b = sc.boss;
    if (!b || (!sc.fighting && b.brain.state !== 'defeated')) return;
    const last = window.__REC[window.__REC.length - 1];
    if (b.brain.state === 'defeated' && last?.st === 'defeated') return;
    const waves = wavesOf(b).filter((w) => w.life > 0).length;
    window.__REC.push({ t: Math.round(sc.time.now), hp: b.brain.hp, ph: b.brain.phase, st: b.brain.state, atk: b.brain.attack?.id ?? null, vul: b.brain.vulnerable, waves, px: Math.round(d.player.x) });
  });
}

function snapshot(wavesOfSrc) {
  const wavesOf = new Function(`return ${wavesOfSrc}`)();
  const d = window.__KERANA_DEBUG__;
  const sc = d.scene;
  const b = sc.boss;
  const p = d.player;
  return {
    fighting: sc.fighting, cutscene: sc.cutscene, st: b.brain.state, vul: b.brain.vulnerable, hp: b.brain.hp,
    bx: b.body.x, bw: b.body.displayWidth, px: p.x, ground: p.body.blocked.down || p.body.touching.down, fc: p.motor.facing,
    left: sc.arenaRect.left, right: sc.arenaRect.right, waves: wavesOf(b).filter((w) => w.life > 0),
  };
}

/** mulberry32: el azar sembrado del cerebro (solo con KURUPI_SEED). */
function seedBrain(seed) {
  let a = seed >>> 0;
  window.__KERANA_DEBUG__.scene.boss.brain.rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function runFight(browser, base, label, seed) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + QUERY, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 20000 });
  await sleep(500);
  const src = wavesOf.toString();
  await page.evaluate(installRecorder, src);
  if (seed !== null) await page.evaluate(seedBrain, seed);
  const snap = () => page.evaluate(snapshot, src);
  const held = new Set();
  const hold = async (k, on) => {
    if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); }
    if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); }
  };
  const move = async (dx, tol = 3) => { await hold('ArrowRight', dx > tol); await hold('ArrowLeft', dx < -tol); };
  const tap = async (k, ms = 40) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };

  // Camina a la derecha desde la antesala hasta que la arena se cierra.
  await hold('ArrowRight', true);
  for (let i = 0; i < 400; i++) {
    const w = await snap();
    if (w.fighting && w.px > w.left + 48) break;
    await sleep(60);
  }
  await hold('ArrowRight', false);

  const t0 = Date.now();
  let lastSwing = 0;
  let lastJump = 0;
  let jumps = 0;
  let s;
  while (Date.now() - t0 < MAX_MS) {
    s = await snap();
    if (s.st === 'defeated' || s.cutscene || !s.fighting) break;
    // Una onda que se le viene encima: salta (como una persona, un poco antes de que llegue).
    const threat = s.waves.some((w) => Math.sign(s.px - w.x) === Math.sign(w.vx) && Math.abs(s.px - w.x) < JUMP_AT);
    if (threat && s.ground && Date.now() - lastJump > 350) {
      lastJump = Date.now();
      jumps++;
      await tap('Space', 220);
    }
    const side = s.px <= s.bx ? -1 : 1;
    const reach = s.vul ? s.bw / 2 + 12 : KEEP_AWAY;
    const lo = s.left + 24;
    const hi = s.right - 24;
    let target = s.bx + side * reach;
    if (target < lo || target > hi) target = s.bx - side * reach;
    target = Math.max(lo, Math.min(hi, target));
    const dx = target - s.px;
    if (Math.abs(dx) > 6) await move(dx, 4);
    else {
      await move(0);
      const want = s.bx >= s.px ? 1 : -1;
      if (s.fc !== want) await tap(want > 0 ? 'ArrowRight' : 'ArrowLeft', 20);
    }
    if (s.vul && Math.abs(s.bx - s.px) < s.bw / 2 + 26 && Date.now() - lastSwing > 300) {
      lastSwing = Date.now();
      await tap('x', 40);
    }
    await sleep(16);
  }
  await move(0);
  await sleep(200);
  const rec = await page.evaluate(() => window.__REC.slice());
  await page.close();
  writeFileSync(join(OUT, `${label}.json`), JSON.stringify(rec));

  const start = rec.find((r) => r.st !== 'waiting')?.t ?? rec[0]?.t ?? 0;
  const sec = (t) => +((t - start) / 1000).toFixed(1);
  const hits = [];
  let stomps = 0;
  for (let i = 1; i < rec.length; i++) {
    if (rec[i].hp < rec[i - 1].hp) hits.push({ t: sec(rec[i].t), hp: rec[i].hp, fase: rec[i - 1].ph + 1, ataque: rec[i - 1].atk });
    if (rec[i].waves > rec[i - 1].waves) stomps++;
  }
  const phases = [0, 1, 2].map((ph) => {
    const rows = rec.filter((r) => r.ph === ph && r.st !== 'waiting');
    return rows.length ? +((rows[rows.length - 1].t - rows[0].t) / 1000).toFixed(1) : 0;
  });
  const end = rec[rec.length - 1];
  return { label, defeated: s?.st === 'defeated', hpFinal: end?.hp, seg: end ? sec(end.t) : 0, hits, phases, stomps, jumps, errors };
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) {
    console.warn('kurupi: no encontré Chrome/Chromium (definí CHROME_PATH).');
    process.exit(1);
  }
  if (!existsSync(join(DIST, 'index.html'))) throw new Error(`Falta ${DIST}: corré "npm run build" antes.`);
  mkdirSync(OUT, { recursive: true });
  const server = await preview({ root: ROOT, build: { outDir: DIST }, preview: { port: 4176, strictPort: false, open: false }, logLevel: 'warn' });
  const base = server.resolvedUrls.local[0];
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'] });
  let ok = true;
  const all = [];
  try {
    for (let i = 1; i <= FIGHTS; i++) {
      const run = await runFight(browser, base, `${LABEL}-${i}`, SEED === null ? null : SEED + i);
      all.push(run);
      console.log(`\n── ${run.label}: ${run.defeated ? 'vencido' : 'NO vencido'} en ${run.seg} s de juego (vida final ${run.hpFinal})`);
      console.log(`   por fase: ${run.phases.join(' s, ')} s · pisotones: ${run.stomps} · ondas saltadas: ${run.jumps}`);
      console.log('   golpes (s → vida, fase, ataque): ' + run.hits.map((h) => `${h.t}→${h.hp} f${h.fase} ${h.ataque}`).join(' · '));
      if (run.errors.length) console.log('   errores de consola:', run.errors);
      const pass = run.defeated && run.errors.length === 0;
      console.log(`${pass ? 'OK   ' : 'FALLA'} ${run.label}`);
      ok &&= pass;
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }
  const secs = all.map((r) => r.seg);
  console.log(`\n${LABEL}: ${secs.join(' s, ')} s · promedio ${(secs.reduce((a, b) => a + b, 0) / secs.length).toFixed(1)} s`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
