// S89: pelea completa contra Luisón en el build, jugada con teclas simuladas como una persona.
// Kerana entra a la arena de l7 (`?debug=1&level=7&boss=1&god=1`) y lo sigue a tajos (tecla X) de la vida completa a cero.
// `debug=1` se usa solo para LEER el estado (dónde está Luisón, qué ataque viene): nada se fuerza ni se resta a mano.
// Registra cuadro a cuadro vida, fase, estado del cerebro, el cuerpo y el tajo en tmp/luison/*.json, e imprime la tabla
// de vida contra tiempo y cada tajo que conecta (solapa el cuerpo) y no descuenta, agrupado por fase, ataque y estado.
// Falla si no lo vence o si un tajo solapa el cuerpo con la ventana abierta y no resta vida.
// Uso: npm run build && npm run luison [-- <peleas> <etiqueta>]
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tmp', 'luison');
const QUERY = '?debug=1&level=7&boss=1&god=1';
const FIGHTS = Number(process.argv[2] ?? 3);
const LABEL = process.argv[3] ?? 'pelea';
// 'pegado': lo sigue siempre. 'prudente': fuera de la ventana se aleja a KEEP_AWAY px, como quien esquiva, y entra a pegar al abrirse.
const STYLE = process.env.LUISON_STYLE ?? 'pegado';
const KEEP_AWAY = 96;
const MAX_MS = Number(process.env.LUISON_MAX_MS ?? 240000);
/** Suelo libre entre los mausoleos, en tiles de la arena (GAMEPLAY.luison.floorTiles). */
const FLOOR = [8, 33];
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

/** Registro cuadro a cuadro (solo lee el estado). */
function installRecorder() {
  const d = window.__KERANA_DEBUG__;
  const sc = d.scene;
  window.__REC = [];
  const ov = (a, b) => a.x < b.x + b.w && a.x + a.width > b.x && a.y < b.y + b.h && a.y + a.height > b.y;
  sc.events.on('postupdate', () => {
    const b = sc.boss;
    if (!b || (!sc.fighting && b.brain.state !== 'defeated')) return;
    if (b.brain.state === 'defeated' && window.__REC.length && window.__REC[window.__REC.length - 1].st === 'defeated') return;
    const p = d.player;
    const img = b.body;
    const body = { x: img.x - img.displayWidth / 2, y: img.y - img.displayHeight, w: img.displayWidth, h: img.displayHeight };
    const act = p.motor.attackHitboxActive;
    const r = p.attackRect;
    window.__REC.push({
      t: Math.round(sc.time.now), hp: b.brain.hp, ph: b.brain.phase, st: b.brain.state, atk: b.brain.attack?.id ?? null,
      left: Math.round(b.brain.msLeft), vul: b.brain.vulnerable, bx: +img.x.toFixed(1), by: +img.y.toFixed(1), spot: b.spot,
      act, ovl: act && ov(r, body), swungHit: p.hasHitThisSwing(b), px: +p.x.toFixed(1), py: +p.y.toFixed(1),
    });
  });
}

function snapshot() {
  const d = window.__KERANA_DEBUG__;
  const sc = d.scene;
  const b = sc.boss;
  const p = d.player;
  return {
    fighting: sc.fighting, cutscene: sc.cutscene, st: b.brain.state, vul: b.brain.vulnerable, hp: b.brain.hp, bx: b.body.x, by: b.body.y, bw: b.body.displayWidth,
    px: p.x, py: p.y, fc: p.motor.facing, left: sc.arenaRect.left, right: sc.arenaRect.right,
  };
}

async function runFight(browser, base, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + QUERY, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__KERANA_READY__ === true, { timeout: 20000 });
  await sleep(500);
  await page.evaluate(installRecorder);
  const snap = () => page.evaluate(snapshot);
  const held = new Set();
  const hold = async (k, on) => {
    if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); }
    if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); }
  };
  const move = async (dx, tol = 3) => { await hold('ArrowRight', dx > tol); await hold('ArrowLeft', dx < -tol); };
  const tap = async (k, ms = 40) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };

  // Entra por encima del mausoleo de la izquierda (3 tiles: se salta) y baja al suelo libre de la arena.
  await hold('ArrowRight', true);
  let lastX = -1;
  for (let i = 0; i < 400; i++) {
    const w = await snap();
    if (w.fighting && w.px > w.left + FLOOR[0] * 16 + 24) break;
    if (Math.abs(w.px - lastX) < 0.5) await tap('Space', 320);
    lastX = w.px;
    await sleep(60);
  }
  await hold('ArrowRight', false);

  // Lo sigue y le tira tajos sin parar cuando lo tiene a tiro: así se ve también cada tajo que conecta fuera de la ventana.
  const t0 = Date.now();
  let lastSwing = 0;
  let s;
  while (Date.now() - t0 < MAX_MS) {
    s = await snap();
    if (s.st === 'defeated' || s.cutscene || !s.fighting) break;
    const side = s.px <= s.bx ? -1 : 1; // se queda del lado en que ya está
    const reach = STYLE === 'prudente' && !s.vul ? KEEP_AWAY : s.bw / 2 + 12;
    const hitReach = s.bw / 2 + 26;
    let target = s.bx + side * reach;
    const lo = s.left + FLOOR[0] * 16 + 10;
    const hi = s.left + FLOOR[1] * 16 - 10;
    if (target < lo || target > hi) target = s.bx - side * reach;
    target = Math.max(lo, Math.min(hi, target));
    const dx = target - s.px;
    if (Math.abs(dx) > 6) await move(dx, 4);
    else {
      await move(0);
      const want = s.bx >= s.px ? 1 : -1;
      if (s.fc !== want) await tap(want > 0 ? 'ArrowRight' : 'ArrowLeft', 20);
    }
    if (Math.abs(s.bx - s.px) < hitReach && Math.abs(s.by - s.py) < 24 && Date.now() - lastSwing > 320) {
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
  const sec = (t) => ((t - start) / 1000).toFixed(1);
  const hits = [];
  for (let i = 1; i < rec.length; i++) {
    if (rec[i].hp < rec[i - 1].hp) hits.push({ t: sec(rec[i].t), hp: rec[i].hp, fase: rec[i - 1].ph + 1, ataque: rec[i - 1].atk, estado: rec[i - 1].st });
  }
  // Tajos que solapan el cuerpo y no descuentan: uno por tajo (primer cuadro del solape).
  const blocked = [];
  let inSwing = false;
  let swingHit = false;
  let first = null;
  for (let i = 1; i < rec.length; i++) {
    const r = rec[i];
    if (r.act && !inSwing) { inSwing = true; swingHit = false; first = null; }
    if (r.act && r.ovl && !first) first = r;
    if (r.hp < rec[i - 1].hp || r.swungHit) swingHit = true;
    if (!r.act && inSwing) {
      inSwing = false;
      if (first && !swingHit) blocked.push({ t: sec(first.t), hp: first.hp, fase: first.ph + 1, ataque: first.atk, estado: first.st, vul: first.vul, lugar: first.spot });
    }
  }
  const groups = {};
  for (const b of blocked) {
    const k = `fase ${b.fase} · ${b.ataque ?? '(pausa)'} · ${b.estado}${b.vul ? ' · VENTANA ABIERTA' : ''}`;
    groups[k] = (groups[k] ?? 0) + 1;
  }
  // Tiempo en cada fase y ventanas (recover castigable) que hubo en ella.
  const phases = [0, 1, 2].map((ph) => {
    const rows = rec.filter((r) => r.ph === ph && r.st !== 'waiting');
    let windows = 0;
    let windowMs = 0;
    for (let i = 1; i < rec.length; i++) {
      if (rec[i].ph !== ph) continue;
      if (rec[i].vul && !rec[i - 1].vul) windows++;
      if (rec[i].vul) windowMs += rec[i].t - rec[i - 1].t;
    }
    return { fase: ph + 1, seg: rows.length ? +((rows[rows.length - 1].t - rows[0].t) / 1000).toFixed(1) : 0, ventanas: windows, ventanaMs: Math.round(windowMs), golpes: hits.filter((h) => h.fase === ph + 1).length };
  });
  const end = rec[rec.length - 1];
  const openMisses = blocked.filter((b) => b.vul);
  return { label, defeated: s?.st === 'defeated', hpFinal: end?.hp, seg: end ? +sec(end.t) : 0, hits, blocked, groups, phases, openMisses: openMisses.length, errors };
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) {
    console.warn('luison: no encontré Chrome/Chromium (definí CHROME_PATH).');
    process.exit(1);
  }
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) throw new Error('Falta dist/: corré "npm run build" antes.');
  mkdirSync(OUT, { recursive: true });
  const server = await preview({ root: ROOT, preview: { port: 4175, strictPort: false, open: false }, logLevel: 'warn' });
  const base = server.resolvedUrls.local[0];
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'] });
  let ok = true;
  try {
    for (let i = 1; i <= FIGHTS; i++) {
      const run = await runFight(browser, base, `${LABEL}-${i}`);
      console.log(`\n── ${run.label}: ${run.defeated ? 'vencido' : 'NO vencido'} en ${run.seg} s (vida final ${run.hpFinal})`);
      console.log('vida contra tiempo (s → vida, fase, ataque):');
      console.log(run.hits.map((h) => `  ${h.t.padStart(6)} s → ${String(h.hp).padStart(2)}  fase ${h.fase}  ${h.ataque}`).join('\n'));
      console.log('por fase:', JSON.stringify(run.phases));
      console.log('tajos que conectan y no descuentan:', JSON.stringify(run.groups, null, 1));
      if (run.errors.length) console.log('errores de consola:', run.errors);
      const pass = run.defeated && run.openMisses === 0 && run.errors.length === 0;
      console.log(`${pass ? 'OK   ' : 'FALLA'} ${run.label}`);
      ok &&= pass;
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
