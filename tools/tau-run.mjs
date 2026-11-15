// S94: pelea completa contra Tau en el build, jugada con teclas simuladas (flechas, Espacio, X) como una persona.
// Kerana entra a la arena de Yvága (`?debug=1&level=yvaga&boss=1&god=1`) y lo vence de la vida completa a cero.
// `debug=1` se usa solo para LEER el estado (dónde está Tau, qué ataque viene, qué estrella se enciende): nada se fuerza,
// ni se teletransporta ni se resta vida a mano. Fases 1 y 2: lo sigue por las nubes y le pega cuando baja. Fase 3: sube
// a la estrella encendida (directo desde las nubes a las de 3 y 6 tiles; a las de 9, desde una de 6) y le pega cuando
// la estrella lo baja, saltando si queda arriba. Con la melodía (controles invertidos) invierte las flechas.
// Registra cuadro a cuadro en tmp/tau/*.json e imprime cuánto dura cada fase y cada golpe.
// Uso: npm run build && npm run tau [-- <peleas> <etiqueta>]   (DIST=otra/carpeta para medir otro build)
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tmp', 'tau');
const DIST = resolve(ROOT, process.env.DIST ?? 'dist');
const QUERY = '?debug=1&level=yvaga&boss=1&god=1';
const FIGHTS = Number(process.argv[2] ?? 3);
const LABEL = process.argv[3] ?? 'pelea';
const MAX_MS = Number(process.env.TAU_MAX_MS ?? 300000);
const TILE = 16;
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
  const sc = window.__KERANA_DEBUG__.scene;
  window.__REC = [];
  sc.events.on('postupdate', () => {
    const b = sc.boss;
    if (!b || (!sc.fighting && b.brain.state !== 'defeated')) return;
    const last = window.__REC[window.__REC.length - 1];
    if (b.brain.state === 'defeated' && last?.st === 'defeated') return;
    const p = window.__KERANA_DEBUG__.player;
    const t = b.form === 'true' ? b.core : b.body;
    window.__REC.push({ t: Math.round(sc.time.now), hp: b.brain.hp, ph: b.brain.phase, st: b.brain.state, atk: b.brain.attack?.id ?? null, vul: b.brain.vulnerable,
      px: Math.round(p.x), py: Math.round(p.y), tx: Math.round(t.x), ty: Math.round(t.y), hyp: p.status.hypnotized });
  });
}

/** Lo que una persona ve en pantalla: Tau (su cuerpo que recibe el tajo), la estrella encendida y Kerana. */
function snapshot() {
  const d = window.__KERANA_DEBUG__;
  const sc = d.scene;
  const b = sc.boss;
  const p = d.player;
  const r = b.bounds(new b.bodyRect.constructor());
  return {
    fighting: sc.fighting, cutscene: sc.cutscene, st: b.brain.state, vul: b.brain.vulnerable, ph: b.brain.phase, atk: b.brain.attack?.id ?? null,
    form: b.form, lit: b.litStar, rx: r.x, ry: r.y, rw: r.width, rh: r.height,
    px: p.x, py: p.y, ground: p.body.blocked.down || p.body.touching.down, fc: p.motor.facing, hyp: p.status.hypnotized,
    floorY: b.ctx.floorY, left: b.ctx.arena.left, right: b.ctx.arena.right,
    stars: b.starCenters.map((cx, i) => ({ cx, top: b.starTops[i] })),
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
  let inverted = false;
  /** Flecha hacia dx (en pantalla); con la melodía, la contraria. */
  const move = async (dx, tol = 3) => {
    const right = dx > tol;
    const left = dx < -tol;
    await hold(inverted ? 'ArrowLeft' : 'ArrowRight', right);
    await hold(inverted ? 'ArrowRight' : 'ArrowLeft', left);
  };
  const tap = async (k, ms = 40) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };
  const face = async (dir, s) => {
    if (s.fc === dir) return;
    await tap((dir > 0) !== inverted ? 'ArrowRight' : 'ArrowLeft', 20);
  };

  // Entra desde la antesala por las nubes hasta que la arena se cierra.
  await hold('ArrowRight', true);
  for (let i = 0; i < 300; i++) {
    const w = await snap();
    if (w.fighting && w.px > w.left + 3 * TILE) break;
    await sleep(60);
  }
  await hold('ArrowRight', false);

  const STAR_W = 3 * TILE;
  let lastSwing = 0;
  let lastJump = 0;
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < MAX_MS) {
    s = await snap();
    if (s.st === 'defeated' || s.cutscene || !s.fighting) break;
    if (s.hyp !== inverted) { await move(0); inverted = s.hyp; }
    const tcx = s.rx + s.rw / 2;
    const onFloor = s.ground && s.py > s.floorY - 4;
    const standingStar = s.ground && !onFloor ? s.stars.findIndex((st) => Math.abs(st.top - s.py) < 4 && Math.abs(st.cx - s.px) < STAR_W / 2 + 6) : -1;
    // ¿El tajo (26 × 18, delante, de los pies − 20 a los pies − 2) llega al cuerpo de Tau desde acá?
    const hx = s.px + s.fc * 22;
    const inX = s.rx < hx + 16 && s.rx + s.rw > hx - 16;
    const nearX = s.rx < s.px + 30 && s.rx + s.rw > s.px - 30;
    const inY = s.ry < s.py - 2 && s.ry + s.rh > s.py - 20;
    const above = s.ry + s.rh <= s.py - 20; // Tau queda arriba del tajo
    const gapUp = s.py - 20 - (s.ry + s.rh);

    if (s.form === 'true') {
      const smoke = s.atk === 'smoke' && (s.st === 'telegraph' || s.st === 'active');
      // Estrella a la que hay que ir: la encendida mientras sube el humo; si no, quedarse donde está.
      let goal = smoke && s.lit >= 0 ? s.lit : -1;
      if (s.vul && nearX && (inY || (above && gapUp < 105))) goal = -1; // la ventana: a pegarle
      if (goal >= 0 && standingStar !== goal) {
        const g = s.stars[goal];
        const rise = s.floorY - g.top;
        if (rise > 6 * TILE + 4) {
          // Las de 9 tiles: desde la estrella de 6 tiles más cercana, con un salto hacia ella.
          const hops = s.stars.map((st, i) => ({ ...st, i })).filter((st) => Math.abs(s.floorY - st.top - 6 * TILE) < 4);
          const hop = hops.sort((a, b) => Math.abs(a.cx - g.cx) - Math.abs(b.cx - g.cx))[0];
          if (standingStar === hop.i) {
            const dir = g.cx > hop.cx ? 1 : -1;
            const edge = hop.cx + dir * (STAR_W / 2 - 6);
            if (Math.abs(s.px - edge) > 5) await move(edge - s.px, 2);
            else if (Date.now() - lastJump > 500) {
              lastJump = Date.now();
              await move(dir * 10);
              await page.keyboard.down('Space');
              await sleep(260);
              await page.keyboard.up('Space');
              await sleep(20);
              await page.keyboard.down('Space'); // salto doble, por las dudas (hay que soltar y volver a apretar)
              await sleep(250);
              await page.keyboard.up('Space');
              for (let i = 0; i < 20; i++) {
                const w = await snap();
                if (w.px * dir >= g.cx * dir - 4) break;
                await sleep(25);
              }
              await move(0);
            }
          } else {
            await goUnderAndJump(hop);
          }
        } else {
          await goUnderAndJump(g);
        }
        await sleep(16);
        continue;
      }
      if (goal < 0 && s.vul && nearX && above && gapUp < 105 && s.ground && Date.now() - lastJump > 450) {
        // Tau quedó arriba (la estrella lo bajó sobre Kerana): salto, salto doble si hace falta, y tajo arriba.
        lastJump = Date.now();
        await move(0);
        await face(tcx >= s.px ? 1 : -1, s);
        await page.keyboard.down('Space');
        await sleep(gapUp > 50 ? 230 : 170);
        if (gapUp > 50) {
          await page.keyboard.up('Space');
          await sleep(20);
          await page.keyboard.down('Space');
          await sleep(120);
        }
        await tap('x', 40);
        await sleep(120);
        await page.keyboard.up('Space');
        lastSwing = Date.now();
        await sleep(16);
        continue;
      }
      if (s.vul && !nearX && standingStar < 0 && onFloor) {
        // Tau bajó lejos y Kerana está en las nubes: se acerca.
        await move(tcx - s.px, 6);
      } else if (s.vul && !nearX && standingStar >= 0) {
        // Sobre la estrella, hacia el lado de Tau sin caerse.
        const st = s.stars[standingStar];
        const x = Math.max(st.cx - STAR_W / 2 + 4, Math.min(st.cx + STAR_W / 2 - 4, tcx));
        await move(x - s.px, 3);
      } else {
        await move(0);
      }
    } else {
      // Fases 1 y 2: por las nubes; al lado de Tau (en la 2, debajo, para cuando baje cansado).
      const side = s.px <= tcx ? -1 : 1;
      let target = tcx + side * (s.rw / 2 + 10);
      const lo = s.left + 10;
      const hi = s.right - 10;
      if (target < lo || target > hi) target = tcx - side * (s.rw / 2 + 10);
      target = Math.max(lo, Math.min(hi, target));
      if (!onFloor && s.ground) target = s.px + (s.px < (s.left + s.right) / 2 ? 40 : -40); // sobre una estrella: bajar
      const dx = target - s.px;
      if (Math.abs(dx) > 6) await move(dx, 4);
      else {
        await move(0);
        await face(tcx >= s.px ? 1 : -1, s);
      }
    }
    if ((inX || nearX) && inY && Date.now() - lastSwing > 320) {
      await face(tcx >= s.px ? 1 : -1, s);
      lastSwing = Date.now();
      await tap('x', 40);
    }
    await sleep(16);
  }

  /** Va a las nubes bajo la estrella y salta derecho hacia arriba (atraviesa la plataforma de un sentido). */
  async function goUnderAndJump(g) {
    const w = s;
    const onFloorNow = w.ground && w.py > w.floorY - 4;
    if (!onFloorNow) {
      // Sobre otra estrella: bajar por el borde hacia la meta.
      if (w.ground) await move(g.cx - w.px, 2);
      return;
    }
    if (Math.abs(w.px - g.cx) > 6) {
      await move(g.cx - w.px, 3);
      return;
    }
    if (Date.now() - lastJump < 500) return;
    lastJump = Date.now();
    await move(0);
    const rise = w.floorY - g.top;
    await page.keyboard.down('Space');
    await sleep(300);
    if (rise > 3 * TILE + 8) {
      await page.keyboard.up('Space');
      await sleep(20);
      await page.keyboard.down('Space');
    }
    await sleep(250);
    await page.keyboard.up('Space');
    // Cae sobre la estrella: se queda quieto encima.
    for (let i = 0; i < 30; i++) {
      const v = await snap();
      if (v.ground) break;
      if (Math.abs(v.px - g.cx) > 8) await move(g.cx - v.px, 3);
      else await move(0);
      await sleep(25);
    }
    await move(0);
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
    if (rec[i].hp < rec[i - 1].hp) hits.push({ t: sec(rec[i].t), hp: rec[i].hp, fase: rec[i - 1].ph + 1, ataque: rec[i - 1].atk });
  }
  // Cuánto dura cada fase: de su primer cuadro al primero de la siguiente (o al sellado).
  const phases = [0, 1, 2].map((ph) => {
    const rows = rec.filter((r) => r.ph === ph && r.st !== 'waiting');
    if (!rows.length) return { fase: ph + 1, seg: 0, golpes: 0, ventanas: 0 };
    const next = rec.find((r) => r.t > rows[0].t && (r.ph > ph || r.st === 'defeated'));
    const end = next ? next.t : rows[rows.length - 1].t;
    let windows = 0;
    for (let i = 1; i < rec.length; i++) if (rec[i].ph === ph && rec[i].vul && !rec[i - 1].vul) windows++;
    return { fase: ph + 1, seg: +((end - rows[0].t) / 1000).toFixed(1), golpes: hits.filter((h) => h.fase === ph + 1).length, ventanas: windows };
  });
  const end = rec[rec.length - 1];
  return { label, defeated: end?.st === 'defeated', hpFinal: end?.hp, seg: end ? +sec(end.t) : 0, hits, phases, errors };
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) {
    console.warn('tau: no encontré Chrome/Chromium (definí CHROME_PATH).');
    process.exit(1);
  }
  if (!existsSync(join(DIST, 'index.html'))) throw new Error(`Falta ${DIST}: corré "npm run build" antes.`);
  mkdirSync(OUT, { recursive: true });
  const server = await preview({ root: ROOT, build: { outDir: DIST }, preview: { port: 4176, strictPort: false, open: false }, logLevel: 'warn' });
  const base = server.resolvedUrls.local[0];
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'] });
  let ok = true;
  try {
    for (let i = 1; i <= FIGHTS; i++) {
      const run = await runFight(browser, base, `${LABEL}-${i}`);
      console.log(`\n── ${run.label}: ${run.defeated ? 'sellado' : 'NO sellado'} en ${run.seg} s (vida final ${run.hpFinal})`);
      console.log(run.hits.map((h) => `  ${h.t.padStart(6)} s → ${String(h.hp).padStart(2)}  fase ${h.fase}  ${h.ataque}`).join('\n'));
      console.log('por fase:', JSON.stringify(run.phases));
      if (run.errors.length) console.log('errores de consola:', run.errors);
      const pass = run.defeated && run.errors.length === 0;
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
