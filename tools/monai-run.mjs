// S66: pelea completa contra Moñái en el build, jugada con teclas simuladas como una persona.
// Kerana entra a la arena de l3 (`?debug=1&level=3&boss=1`, sin `god`), esquiva y le pega SOLO A LA CABEZA con el tajo
// (tecla X) hasta vencerla; después, en otra página, muere a propósito, vuelve a entrar y la vence de nuevo entera.
// `debug=1` se usa solo para LEER el estado (dónde está Moñái, qué ataque viene): nada se fuerza ni se resta a mano.
// Registra cuadro a cuadro vida, fase, estado del cerebro, la zona de la cabeza y el tajo en tmp/monai/*.json.
// Falla si no la vence, si un tajo solapa la cabeza en una ventana abierta y no resta vida, si la cabeza no se dibuja
// (con alfa > 0) o si Kerana sale de la arena en plena pelea. Uso: npm run build && npm run monai
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tmp', 'monai');
const QUERY = '?debug=1&level=3&boss=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const candidates = [process.env.CHROME_PATH];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(pw)) {
    for (const d of readdirSync(pw).filter((n) => n.startsWith('chromium-'))) candidates.push(join(pw, d, 'chrome-linux', 'chrome'));
  }
  candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  return candidates.find((p) => p && existsSync(p));
}

/** Registro cuadro a cuadro (solo lee el estado). */
function installRecorder() {
  const d = window.__KERANA_DEBUG__;
  const sc = d.scene;
  window.__REC = [];
  const ov = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  let f = 0;
  sc.events.on('postupdate', () => {
    f++;
    const b = sc.boss;
    if (!b || (!sc.fighting && !sc.cutscene)) return;
    const p = d.player;
    const head = b.headStrikeBounds();
    const tail = b.tailStrikeBounds();
    const act = p.motor.attackHitboxActive;
    const r = p.attackRect;
    const v = sc.cameras.main.worldView;
    window.__REC.push({
      f, t: Math.round(sc.time.now), hp: b.brain.hp, ph: b.brain.phase, st: b.brain.state, atk: b.brain.attack?.id ?? null,
      ex: b.exposed, vul: b.brain.vulnerable, hx: +b.head.x.toFixed(1), hy: +b.head.y.toFixed(1),
      zone: { x: +head.x.toFixed(1), y: +head.y.toFixed(1), w: head.width, h: head.height },
      sl: act ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: r.width, h: r.height } : null,
      headOvl: act && ov(r, head), tailOvl: act && ov(r, tail), swungHit: p.hasHitThisSwing(b),
      px: +p.x.toFixed(1), left: sc.arenaRect.left, hearts: p.health.current, conf: p.status.confused,
      ha: b.head.alpha, hv: b.head.visible, hsc: b.head.scaleX, htex: b.head.texture.key, hidx: sc.children.getIndex(b.head), inView: v.contains(b.head.x, b.head.y),
    });
  });
}

function snapshot() {
  const d = window.__KERANA_DEBUG__;
  const sc = d.scene;
  const b = sc.boss;
  const p = d.player;
  return {
    fighting: sc.fighting, cutscene: sc.cutscene, st: b.brain.state, atk: b.brain.attack?.id ?? null, hp: b.brain.hp,
    ex: b.exposed, vul: b.brain.vulnerable, hx: b.head.x, hy: b.head.y, flip: b.head.flipX, harmful: b.harmful, grounded: b.grounded,
    sx: b.shadow.x, sv: b.shadow.visible, px: p.x, fc: p.motor.facing, onGround: p.body.blocked.down, bw: p.body.width,
    left: sc.arenaRect.left, right: sc.arenaRect.right, conf: p.status.confused,
  };
}

async function runPage(browser, base, { dieFirst }) {
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
  const jump = async (ms = 260) => tap('Space', ms);

  async function walkIn() {
    await hold('ArrowRight', true);
    for (let i = 0; i < 300 && !(await snap()).fighting; i++) await sleep(50);
    await hold('ArrowRight', false);
  }

  /** Pelea con teclas. `die`: ir hacia la cabeza hasta caer. Devuelve el último estado. */
  async function fight(die, maxMs = 300000) {
    const t0 = Date.now();
    let lastSwing = 0;
    let lastDash = 0;
    let s;
    while (Date.now() - t0 < maxMs) {
      s = await snap();
      if (s.st === 'defeated' || s.cutscene || !s.fighting) break;
      if (die) { await move(s.hx - s.px, 2); await sleep(16); continue; }
      const inv = s.conf ? -1 : 1; // confundida: izquierda y derecha invertidas
      const mv = (dx, tol) => move(inv * dx, tol);
      // Tras el descenso la cabeza termina sobre la sombra (aunque el cuadro todavía la muestre cayendo).
      const hx = s.atk === 'descent' && s.st === 'recover' ? s.sx : s.hx;
      // La joroba (S44) se levanta detrás de la nuca cuando la cabeza está en el suelo: no tocarla.
      let lo = null;
      let hi = null;
      if (s.grounded && s.ex !== 'tail') {
        const back = s.flip ? -1 : 1;
        const neck = hx + back * 9;
        lo = Math.min(neck, neck + back * 40) - 7 - s.bw / 2 - 4;
        hi = Math.max(neck, neck + back * 40) + 7 + s.bw / 2 + 4;
      }
      if (s.vul && (s.ex === 'body' || s.ex === 'tail')) {
        // Ventana: de frente a la cabeza y tajo.
        const front = s.flip ? 1 : -1;
        const target = Math.max(s.left + 20, Math.min(s.right - 20, hx + front * (13 + s.bw / 2 + 10)));
        const dx = target - s.px;
        const inside = lo !== null && s.px >= lo && s.px <= hi;
        const crosses = inside || (lo !== null && ((s.px < lo && target > lo) || (s.px > hi && target < hi)));
        const near = inside || (crosses && (s.px < lo ? lo - s.px : s.px - hi) < 28);
        if (crosses && near && s.onGround) { await mv(dx, 0); await jump(); }
        else if (Math.abs(dx) > 5) await mv(dx, 4);
        else {
          await move(0);
          if (s.conf) { if (Date.now() - lastSwing > 150) { lastSwing = Date.now(); await tap('x', 30); } }
          else if (s.fc !== -front) await tap(-front > 0 ? 'ArrowRight' : 'ArrowLeft', 20);
          else if (Date.now() - lastSwing > 320) { lastSwing = Date.now(); await tap('x', 40); }
        }
      } else if (s.atk === 'steal' && s.st === 'active') {
        // Embestida: correr lejos y, si la cabeza llega, dash (intangible).
        let dir = s.px >= s.hx ? 1 : -1;
        if ((dir > 0 && s.px > s.right - 30) || (dir < 0 && s.px < s.left + 30)) dir = -dir;
        await mv(dir * 100, 0);
        if (Math.abs(s.hx - s.px) < 48 && s.hy > 468 && Date.now() - lastDash > 700) { lastDash = Date.now(); await tap('c', 30); }
      } else if (s.atk === 'descent' && (s.st === 'telegraph' || s.st === 'active') && s.sv) {
        // Descenso: más allá de la sombra, del lado contrario a la copa; contra la pared, del otro lado de la copa.
        const side = s.sx >= s.hx ? 1 : -1;
        let goal = Math.max(s.left + 12, Math.min(s.right - 12, s.sx + side * 56));
        if (Math.abs(goal - s.sx) < 34) goal = s.hx - side * 48;
        await mv(goal - s.px, 3);
      } else if (s.atk === 'pulse' && (s.st === 'telegraph' || s.st === 'active') && Math.abs(s.px - s.hx) < 80) {
        const dir = s.px >= s.hx ? 1 : -1;
        let goal = s.hx + dir * 90;
        if (goal < s.left + 20 || goal > s.right - 20) goal = s.hx - dir * 90;
        await mv(goal - s.px, 3);
      } else if (lo !== null && s.px > lo - 6 && s.px < hi + 6) {
        await mv((s.px - lo < hi - s.px ? lo - 14 : hi + 14) - s.px, 2);
      } else if (s.st === 'idle' && (s.px < s.left + 110 || s.px > s.right - 110)) {
        await mv((s.left + s.right) / 2 - s.px, 60);
      } else {
        await move(0);
        if (s.conf && Date.now() - lastSwing > 150) { lastSwing = Date.now(); await tap('x', 30); }
      }
      await sleep(16);
    }
    await move(0);
    return s;
  }

  /** Una pelea: cuadros desde el cierre de la arena hasta el final, con los chequeos. */
  async function oneFight(label, die) {
    await page.evaluate(() => { window.__REC.length = 0; });
    await walkIn();
    const end = await fight(die);
    await sleep(200);
    const rec = await page.evaluate(() => window.__REC.slice());
    writeFileSync(join(OUT, `${label}.json`), JSON.stringify(rec));
    const hits = [];
    for (let i = 1; i < rec.length; i++) {
      if (rec[i].hp >= rec[i - 1].hp) continue;
      const a = rec[i - 1];
      hits.push({ hp: rec[i].hp, fase: a.ph + 1, ataque: a.atk, ventana: a.ex, cabeza: rec[i].headOvl, cola: rec[i].tailOvl, tajo: rec[i].sl, zona: rec[i].zone });
    }
    // Tajo sobre la cabeza con la ventana abierta y sin restar vida (lo que S66 fue a buscar).
    const misses = rec.filter((r, i) => i > 0 && r.headOvl && r.vul && !r.swungHit && r.hp === rec[i - 1].hp && r.st !== 'defeated');
    const headBad = rec.filter((r) => r.ha > 0 && (!r.hv || r.hsc < 0.3 || r.hidx < 0 || r.htex !== 'monai_head'));
    const outside = rec.filter((r) => r.px < r.left);
    const first = rec.find((r) => r.ha > 0);
    return { label, end: { st: end?.st, hp: end?.hp }, frames: rec.length, hits, misses: misses.length, missSample: misses.slice(0, 3), headBad: headBad.length, outside: outside.length, firstHead: first && { alpha: first.ha, visible: first.hv, tex: first.htex } };
  }

  const results = [];
  if (dieFirst) {
    results.push(await oneFight('muere', true));
    await sleep(1500); // KO: vuelve al fuego de la antesala
  }
  results.push(await oneFight(dieFirst ? 'reintento' : 'pelea', false));
  // Liberación y «Nivel completado»: los diálogos se pasan con Espacio.
  let complete = false;
  for (let i = 0; i < 150 && !complete; i++) {
    complete = await page.evaluate(() => window.__KERANA_GAME__.scene.isActive('LevelComplete'));
    if (complete) break;
    if (await page.evaluate(() => window.__KERANA_DEBUG__?.scene.dialogueBox?.active ?? false)) await page.keyboard.press('Space');
    await sleep(300);
  }
  const freed = await page.evaluate(() => JSON.parse(localStorage.getItem('kerana.save.v1') ?? '{}').freed ?? []);
  await page.close();
  return { results, complete, freed, errors };
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) {
    console.warn('monai: no encontré Chrome/Chromium (definí CHROME_PATH).');
    process.exit(1);
  }
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) throw new Error('Falta dist/: corré "npm run build" antes.');
  mkdirSync(OUT, { recursive: true });
  const server = await preview({ root: ROOT, preview: { port: 4174, strictPort: false, open: false }, logLevel: 'warn' });
  const base = server.resolvedUrls.local[0];
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'] });
  let ok = true;
  try {
    for (const dieFirst of [false, true]) {
      const run = await runPage(browser, base, { dieFirst });
      console.log(JSON.stringify(run, null, 1));
      const last = run.results[run.results.length - 1];
      const pass =
        last.end.st === 'defeated' &&
        last.hits.length === 12 &&
        last.hits.every((h) => h.cabeza) &&
        run.results.every((r) => r.misses === 0 && r.headBad === 0 && r.outside === 0) &&
        (!dieFirst || run.results[0].end.hp === 12) &&
        run.complete &&
        run.freed.includes('monai') &&
        run.errors.length === 0;
      console.log(`${pass ? 'OK  ' : 'FALLA'} ${dieFirst ? 'muere, reintenta y la vence' : 'la vence'} a cabezazos de tajo (${last.hits.length} golpes, 12 → ${last.end.hp})`);
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
