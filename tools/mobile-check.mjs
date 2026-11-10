// S90: el juego en un teléfono emulado (táctil, sin teclado) en el build, con dedos simulados (CDP, varios a la vez).
// Comprueba el aviso de girar, la pantalla completa, la zona de moverse, dos dedos a la vez, «Botones» desde la pausa,
// que en el editor cada pieza se arrastra y se agranda, que el cambio sigue al recargar y que en escritorio no cambia nada.
// `debug=1` se usa solo para LEER el estado. Capturas en tmp/mobile/.
// Uso: npm run build && npm run mobile
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tmp', 'mobile');
const PORTRAIT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const LANDSCAPE = { ...PORTRAIT, width: 844, height: 390, isLandscape: true };
const SAVE_KEY = 'kerana.save.v1';
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

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) {
    console.warn('mobile: no encontré Chrome/Chromium (definí CHROME_PATH). Se omite la prueba.');
    return;
  }
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) throw new Error('Falta dist/: corré "npm run build" antes.');
  mkdirSync(OUT, { recursive: true });
  const server = await preview({ root: ROOT, preview: { port: 4183, strictPort: false, open: false }, logLevel: 'warn' });
  const base = server.resolvedUrls.local[0];
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const check = (cond, msg) => {
    if (cond) console.log(`✓ ${msg}`);
    else {
      console.log(`✗ ${msg}`);
      errors.push(`check: ${msg}`);
    }
  };

  async function open(path, viewport) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    page.on('console', (m) => m.type() === 'error' && errors.push(`[${path}] ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`[${path}] ${e.message}`));
    await page.goto(base + path.replace(/^\//, ''), { waitUntil: 'load' });
    return page;
  }
  const waitFor = async (page, fn, arg, maxMs = 20000) => {
    for (let t = 0; t < maxMs; t += 100) {
      if (await page.evaluate(fn, arg)) return true;
      await sleep(100);
    }
    return false;
  };
  const sceneActive = (page, key) => page.evaluate((k) => window.__KERANA_GAME__.scene.isActive(k), key);
  const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) });
  /** Unidades del mundo (640 × 360) → píxeles de la página. */
  const toPage = (page, x, y) =>
    page.evaluate(
      (wx, wy) => {
        const r = document.querySelector('canvas').getBoundingClientRect();
        return { x: r.left + (wx / 640) * r.width, y: r.top + (wy / 360) * r.height };
      },
      x,
      y,
    );
  /** Dedos: `fingers` es la lista completa de los que siguen apoyados, en unidades del mundo. */
  async function touch(page, cdp, type, fingers) {
    const touchPoints = [];
    for (const f of fingers) {
      const p = await toPage(page, f.x, f.y);
      touchPoints.push({ x: p.x, y: p.y, id: f.id });
    }
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  }
  /**
   * Levanta un dedo y deja los demás apoyados. CDP no sabe hacerlo (touchEnd levanta todos, y un touchMove con menos
   * dedos no suelta ninguno), así que el `touchend` se arma en la página con los dedos que quedan. Después hay que
   * cerrar con un touchEnd de CDP.
   */
  async function liftAllBut(page, fingers) {
    const points = [];
    for (const f of fingers) points.push({ id: f.id, ...(await toPage(page, f.x, f.y)) });
    await page.evaluate((pts) => {
      const target = document.querySelector('canvas');
      const touches = pts.map((p) => new Touch({ identifier: p.id, target, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y }));
      target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: [] }));
    }, points);
  }
  async function tap(page, cdp, x, y) {
    await touch(page, cdp, 'touchStart', [{ id: 0, x, y }]);
    await sleep(80);
    await touch(page, cdp, 'touchEnd', []);
    await sleep(250);
  }
  const canvasRatio = (page) =>
    page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { ratio: r.width / r.height, w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight };
    });
  const promptState = (page) =>
    page.evaluate(() => {
      const el = document.getElementById('rotate-prompt');
      const game = window.__KERANA_GAME__;
      return { shown: !!el && getComputedStyle(el).display !== 'none', text: el?.textContent ?? '', running: game.loop.running, frame: game.loop.frame };
    });

  try {
    // 1) Título en vertical: el aviso tapa todo y el juego no avanza.
    const title = await open('/?lang=es', PORTRAIT);
    const titleCdp = await title.createCDPSession();
    await waitFor(title, () => window.__KERANA_GAME__?.isRunning && !window.__KERANA_GAME__.loop.running);
    check(await title.evaluate(() => window.__KERANA_GAME__.scene.isActive('Title')), 'abierto en vertical, carga hasta el título y ahí se detiene');
    const up1 = await promptState(title);
    await sleep(500);
    const up2 = await promptState(title);
    check(up1.shown && up1.text === 'Girá el teléfono', `en vertical aparece el aviso («${up1.text}»)`);
    check(!up2.running && up2.frame === up1.frame, `en vertical el juego está detenido (cuadro ${up1.frame} → ${up2.frame})`);
    await shot(title, 'aviso-vertical');
    // Al girar se va solo y el juego sigue.
    await title.setViewport(LANDSCAPE);
    await waitFor(title, () => window.__KERANA_GAME__.scene.isActive('Title'));
    await sleep(600);
    const side1 = await promptState(title);
    await sleep(400);
    const side2 = await promptState(title);
    check(!side1.shown && side2.running && side2.frame > side1.frame, `en horizontal el aviso se va y el juego sigue (cuadro ${side1.frame} → ${side2.frame})`);
    const fit0 = await canvasRatio(title);
    check(Math.abs(fit0.ratio - 16 / 9) < 0.01 && fit0.h <= fit0.vh + 1, `en horizontal el lienzo es 16:9 y entra (${fit0.w.toFixed(0)} × ${fit0.h.toFixed(0)} en ${fit0.vw} × ${fit0.vh})`);

    // 2) Pantalla completa con el primer toque del título.
    await tap(title, titleCdp, 320, 150);
    await sleep(800);
    const full = await title.evaluate(() => ({ on: !!document.fullscreenElement, root: document.fullscreenElement === document.documentElement, lock: screen.orientation?.type ?? '' }));
    check(full.on && full.root, `el primer toque del título pide pantalla completa (orientación: ${full.lock})`);
    const fit1 = await canvasRatio(title);
    check(Math.abs(fit1.ratio - 16 / 9) < 0.01, `en pantalla completa el lienzo sigue 16:9 (${fit1.w.toFixed(0)} × ${fit1.h.toFixed(0)})`);
    await title.evaluate(() => document.exitFullscreen?.().catch(() => undefined));
    await sleep(800);
    const fit2 = await canvasRatio(title);
    const alive1 = await promptState(title);
    await sleep(300);
    const alive2 = await promptState(title);
    check(Math.abs(fit2.ratio - 16 / 9) < 0.01 && fit2.h <= fit2.vh + 1 && alive2.frame > alive1.frame, `al salir de la pantalla completa el juego sigue y no se deforma (${fit2.w.toFixed(0)} × ${fit2.h.toFixed(0)})`);
    // Donde el navegador no la tiene (Safari de iPhone): sin error.
    const noFs = await browser.newPage();
    await noFs.setViewport(LANDSCAPE);
    const noFsErrors = [];
    noFs.on('console', (m) => m.type() === 'error' && noFsErrors.push(m.text()));
    noFs.on('pageerror', (e) => noFsErrors.push(e.message));
    await noFs.evaluateOnNewDocument(() => {
      delete Element.prototype.requestFullscreen;
      delete Element.prototype.webkitRequestFullscreen;
      delete Element.prototype.webkitRequestFullScreen;
    });
    await noFs.goto(base, { waitUntil: 'load' });
    await waitFor(noFs, () => window.__KERANA_GAME__?.scene.isActive('Title'));
    await sleep(400);
    await tap(noFs, await noFs.createCDPSession(), 320, 150);
    await sleep(600);
    const gone = await noFs.evaluate(() => ({ fs: !!document.fullscreenElement, story: window.__KERANA_GAME__.scene.isActive('Story') }));
    check(!gone.fs && noFsErrors.length === 0, `sin pantalla completa en el navegador (Safari de iPhone) no pasa nada y no hay errores (${noFsErrors.length})`);
    // Y si el navegador la rechaza (promesa rechazada), tampoco.
    const deny = await browser.newPage();
    await deny.setViewport(LANDSCAPE);
    const denyErrors = [];
    deny.on('console', (m) => m.type() === 'error' && denyErrors.push(m.text()));
    deny.on('pageerror', (e) => denyErrors.push(e.message));
    await deny.evaluateOnNewDocument(() => {
      Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('Fullscreen request denied'));
    });
    await deny.goto(base, { waitUntil: 'load' });
    await waitFor(deny, () => window.__KERANA_GAME__?.scene.isActive('Title'));
    await sleep(400);
    await tap(deny, await deny.createCDPSession(), 320, 150);
    await sleep(600);
    check(denyErrors.length === 0, `si el navegador rechaza la pantalla completa, no hay errores (${denyErrors.length})`);
    await noFs.close();
    await deny.close();
    await title.close();

    // 3) Nivel 1 en horizontal: la zona de moverse.
    const page = await open('/?debug=1&level=1&god=1', LANDSCAPE);
    const cdp = await page.createCDPSession();
    await waitFor(page, () => window.__KERANA_READY__ === true);
    await sleep(1200);
    const player = () =>
      page.evaluate(() => {
        const p = window.__KERANA_DEBUG__.player;
        return { x: p.x, y: p.y, vx: p.body.velocity.x, vy: p.body.velocity.y, ground: p.body.blocked.down };
      });
    const layout = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').settings?.touchLayout ?? null, SAVE_KEY);
    const MOVE = { x: 63, y: 324 };
    await shot(page, 'l1-horizontal-botones');
    const p0 = await player();
    await touch(page, cdp, 'touchStart', [{ id: 0, x: MOVE.x + 27, y: MOVE.y }]);
    await sleep(700);
    const p1 = await player();
    await shot(page, 'l1-caminando-derecha');
    check(p1.x > p0.x + 10 && p1.vx > 0, `un dedo en la mitad derecha de la zona: camina a la derecha (x ${p0.x.toFixed(0)} → ${p1.x.toFixed(0)})`);
    // Desliza a la izquierda sin levantar, en pasos, como un dedo.
    for (let x = MOVE.x + 27; x >= MOVE.x - 27; x -= 9) {
      await touch(page, cdp, 'touchMove', [{ id: 0, x, y: MOVE.y }]);
      await sleep(16);
    }
    // El headless va lento: se espera a que haya desandado, hasta 4 s.
    let p2 = await player();
    for (let t = 0; t < 4000 && !(p2.x < p1.x - 10 && p2.vx < 0); t += 100) {
      await sleep(100);
      p2 = await player();
    }
    check(p2.x < p1.x - 10 && p2.vx < 0, `desliza a la izquierda sin levantar: camina a la izquierda (x ${p1.x.toFixed(0)} → ${p2.x.toFixed(0)})`);
    // Vuelve a la derecha y, saliéndose un poco de la zona, sigue.
    await touch(page, cdp, 'touchMove', [{ id: 0, x: MOVE.x + 30, y: MOVE.y }]);
    await sleep(500);
    await touch(page, cdp, 'touchMove', [{ id: 0, x: MOVE.x + 120, y: MOVE.y - 40 }]);
    await sleep(500);
    const p3 = await player();
    check(p3.vx > 0, `de vuelta a la derecha sin levantar, aunque el dedo se salga de la zona (vx ${p3.vx.toFixed(0)})`);
    // Zona muerta: el dedo al medio, quieta.
    await touch(page, cdp, 'touchMove', [{ id: 0, x: MOVE.x + 2, y: MOVE.y }]);
    await sleep(700);
    const p4 = await player();
    check(Math.abs(p4.vx) < 1, `con el dedo en el medio entre las flechas, quieta (vx ${p4.vx.toFixed(0)})`);
    // Dos dedos: camina y salta a la vez.
    await touch(page, cdp, 'touchMove', [{ id: 0, x: MOVE.x + 27, y: MOVE.y }]);
    await sleep(300);
    const JUMP = { x: 600, y: 320 };
    await touch(page, cdp, 'touchStart', [{ id: 0, x: MOVE.x + 27, y: MOVE.y }, { id: 1, x: JUMP.x, y: JUMP.y }]);
    let air = null;
    for (let i = 0; i < 20 && !air; i++) {
      await sleep(30);
      const p = await player();
      if (!p.ground && p.vx > 0) air = p;
    }
    await shot(page, 'l1-dos-dedos');
    check(!!air, `con dos dedos camina y salta a la vez (vx ${air?.vx.toFixed(0)}, vy ${air?.vy.toFixed(0)})`);
    // Se levanta el del salto: sigue caminando. Se levanta el otro: para.
    const state = () => page.evaluate(() => ['left', 'right', 'jump', 'attack', 'dash'].filter((a) => window.__KERANA_DEBUG__.scene.inputs.isDown(a)).join('+'));
    await liftAllBut(page, [{ id: 0, x: MOVE.x + 27, y: MOVE.y }]);
    await sleep(900);
    const p5 = await player();
    const s5 = await state();
    await touch(page, cdp, 'touchEnd', []);
    await sleep(600);
    const p6 = await player();
    check(s5 === 'right' && p5.vx > 0 && Math.abs(p6.vx) < 1 && (await state()) === '', `al levantar el dedo del salto sigue caminando («${s5}»), y al levantar el otro para (vx ${p5.vx.toFixed(0)} → ${p6.vx.toFixed(0)})`);
    // Tajo y dash con un segundo dedo mientras el primero camina.
    const walk = { id: 0, x: MOVE.x - 27, y: MOVE.y };
    await touch(page, cdp, 'touchStart', [walk]);
    await touch(page, cdp, 'touchStart', [walk, { id: 1, x: 543, y: 314 }]);
    await sleep(150);
    const sAttack = await state();
    await liftAllBut(page, [walk]);
    await sleep(150);
    const sWalk = await state();
    await touch(page, cdp, 'touchEnd', []);
    await sleep(150);
    await touch(page, cdp, 'touchStart', [walk]);
    await touch(page, cdp, 'touchStart', [walk, { id: 1, x: 582, y: 263 }]);
    await sleep(150);
    const sDash = await state();
    await touch(page, cdp, 'touchEnd', []);
    check(sAttack === 'left+attack' && sWalk === 'left' && sDash === 'left+dash', `un segundo dedo en tajo o en dash funciona mientras el primero camina (${sAttack} · ${sWalk} · ${sDash})`);
    await sleep(500);

    // 4) Pausa → Botones.
    await tap(page, cdp, 624, 16);
    await waitFor(page, () => window.__KERANA_GAME__.scene.isActive('Pause'));
    const pauseItems = () => page.evaluate(() => window.__KERANA_GAME__.scene.getScene('Pause').texts.map((t) => ({ text: t.text, x: t.x, y: t.y })));
    const items = await pauseItems();
    const buttonsItem = items.find((i) => i.text === 'Botones');
    check(!!buttonsItem, `en táctil la pausa ofrece «Botones» (${items.map((i) => i.text).join(' · ')})`);
    await sleep(300);
    await shot(page, 'pausa-botones');
    await tap(page, cdp, buttonsItem.x, buttonsItem.y);
    await waitFor(page, () => window.__KERANA_GAME__.scene.isActive('Buttons'));
    check(await sceneActive(page, 'Buttons'), 'tocar «Botones» abre el editor');
    await sleep(300);
    await shot(page, 'editor-antes');
    const edit = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__KERANA_GAME__.scene.getScene('Buttons').layout)));
    // Cada pieza: se arrastra (de fábrica, sin tocar antes ninguna otra) y se agranda con +.
    const drags = { move: [40, -60], jump: [-30, -50], attack: [-40, -40], dash: [-60, -20], pause: [-40, 30] };
    for (const id of Object.keys(drags)) {
      const before = (await edit())[id];
      const [dx, dy] = drags[id];
      // La zona se agarra de una flecha, no del medio.
      const grab = id === 'move' ? { x: before.x - 27, y: before.y } : { x: before.x, y: before.y };
      await touch(page, cdp, 'touchStart', [{ id: 0, ...grab }]);
      await sleep(60);
      for (let s = 1; s <= 5; s++) {
        await touch(page, cdp, 'touchMove', [{ id: 0, x: grab.x + (dx * s) / 5, y: grab.y + (dy * s) / 5 }]);
        await sleep(30);
      }
      await touch(page, cdp, 'touchEnd', []);
      await sleep(120);
      const moved = (await edit())[id];
      const okMove = Math.abs(moved.x - before.x - dx) < 1.5 && Math.abs(moved.y - before.y - dy) < 1.5;
      await tap(page, cdp, 210, 338);
      const grown = (await edit())[id];
      check(okMove && grown.scale > moved.scale, `editor: «${id}» se arrastra (${before.x.toFixed(0)},${before.y.toFixed(0)} → ${moved.x.toFixed(0)},${moved.y.toFixed(0)}) y se agranda (${moved.scale} → ${grown.scale})`);
    }
    // − achica el último elegido.
    const beforeMinus = (await edit()).pause;
    await tap(page, cdp, 170, 338);
    check((await edit()).pause.scale < beforeMinus.scale, 'editor: − achica');
    await shot(page, 'editor-despues');
    const wanted = await edit();
    // Listo: guarda y vuelve a la pausa.
    await tap(page, cdp, 430, 338);
    await waitFor(page, () => window.__KERANA_GAME__.scene.isActive('Pause'));
    check((await sceneActive(page, 'Pause')) && !(await sceneActive(page, 'Buttons')), 'al cerrar el editor vuelve a la pausa');
    const saved = await layout();
    check(JSON.stringify(saved) === JSON.stringify(wanted), `el guardado tiene la posición nueva (move ${saved?.move?.x.toFixed(0)},${saved?.move?.y.toFixed(0)} × ${saved?.move?.scale})`);
    // Continuar: los botones del nivel están en el sitio nuevo y la zona movida funciona.
    const cont = (await pauseItems()).find((i) => i.text === 'Continuar');
    await tap(page, cdp, cont.x, cont.y);
    await waitFor(page, () => !window.__KERANA_GAME__.scene.isActive('Pause') && window.__KERANA_GAME__.scene.isActive('Level'));
    await sleep(400);
    const q0 = await player();
    await touch(page, cdp, 'touchStart', [{ id: 0, x: wanted.move.x + 27 * wanted.move.scale, y: wanted.move.y }]);
    await sleep(600);
    const q1 = await player();
    await touch(page, cdp, 'touchEnd', []);
    check(q1.x > q0.x + 8, `de vuelta en el nivel, la zona movida y agrandada responde en su sitio nuevo (x ${q0.x.toFixed(0)} → ${q1.x.toFixed(0)})`);
    await shot(page, 'l1-botones-movidos');
    // Recarga: la posición sigue ahí.
    await page.reload({ waitUntil: 'load' });
    await waitFor(page, () => window.__KERANA_READY__ === true);
    await sleep(800);
    const after = await layout();
    const drawn = await page.evaluate(() => {
      const ui = window.__KERANA_GAME__.scene.getScene('UI');
      return ui.children.list.filter((o) => o.type === 'Arc' && o.depth === 1000).map((o) => [Math.round(o.x), Math.round(o.y)]);
    });
    const leftArrow = [Math.round(wanted.move.x - 27 * wanted.move.scale), Math.round(wanted.move.y)];
    check(JSON.stringify(after) === JSON.stringify(wanted) && drawn.some((d) => d[0] === leftArrow[0] && d[1] === leftArrow[1]), `al recargar la posición sigue ahí (flecha izquierda dibujada en ${leftArrow.join(',')})`);

    // 5) Un guardado viejo, con left y right por separado.
    await page.evaluate((k) => {
      const save = JSON.parse(localStorage.getItem(k));
      save.settings.touchLayout = { left: { x: 120, y: 250, scale: 1.3 }, right: { x: 190.2, y: 250, scale: 1.3 }, jump: { x: 560, y: 280, scale: 1.15 }, attack: { x: 480, y: 300, scale: 1 }, dash: { x: 560, y: 200, scale: 1 }, pause: { x: 600, y: 30, scale: 1 } };
      localStorage.setItem(k, JSON.stringify(save));
    }, SAVE_KEY);
    await page.reload({ waitUntil: 'load' });
    await waitFor(page, () => window.__KERANA_READY__ === true);
    await sleep(800);
    const arcs = await page.evaluate(() => {
      const ui = window.__KERANA_GAME__.scene.getScene('UI');
      return ui.children.list.filter((o) => o.type === 'Arc' && o.depth === 1000).map((o) => [Math.round(o.x * 10) / 10, Math.round(o.y)]);
    });
    check(arcs.some((a) => Math.abs(a[0] - 120) < 0.2 && a[1] === 250) && arcs.some((a) => Math.abs(a[0] - 190.2) < 0.2 && a[1] === 250) && arcs.some((a) => a[0] === 560 && a[1] === 280), `un guardado viejo (left y right separados) se migra sin perder la posición (${JSON.stringify(arcs)})`);
    await shot(page, 'l1-guardado-viejo');
    // Girar en medio del nivel: se detiene y, al volver, sigue donde estaba.
    const r0 = await player();
    await page.setViewport(PORTRAIT);
    await sleep(700);
    const mid = await promptState(page);
    await shot(page, 'aviso-vertical-en-nivel');
    await page.setViewport(LANDSCAPE);
    await sleep(700);
    const back = await promptState(page);
    const r1 = await player();
    check(mid.shown && !mid.running && !back.shown && back.running && Math.abs(r1.x - r0.x) < 1, `girar en medio del nivel lo detiene, y al volver sigue donde estaba (x ${r0.x.toFixed(0)} → ${r1.x.toFixed(0)})`);
    await page.close();

    // 6) En inglés.
    const en = await open('/?lang=en', PORTRAIT);
    await waitFor(en, () => window.__KERANA_GAME__?.isRunning && !window.__KERANA_GAME__.loop.running);
    check((await promptState(en)).text === 'Rotate your phone', 'el aviso está en inglés con lang=en');
    await en.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
    await en.close();

    // 7) Escritorio: ventana más alta que ancha, sin aviso; la pausa, sin «Botones».
    const desk = await open('/?debug=1&level=1&god=1', { width: 600, height: 900 });
    await waitFor(desk, () => window.__KERANA_READY__ === true);
    await sleep(500);
    const deskPrompt = await desk.evaluate(() => ({ el: !!document.getElementById('rotate-prompt'), running: window.__KERANA_GAME__.loop.running }));
    await desk.keyboard.press('Escape');
    await waitFor(desk, () => window.__KERANA_GAME__.scene.isActive('Pause'));
    const deskItems = await desk.evaluate(() => window.__KERANA_GAME__.scene.getScene('Pause').texts.map((t) => t.text));
    check(!deskPrompt.el && deskPrompt.running && !deskItems.includes('Botones'), `en escritorio no hay aviso ni «Botones» en la pausa (${deskItems.join(' · ')})`);
    await desk.close();
  } finally {
    await browser.close();
    await server.close();
  }
  if (errors.length) {
    console.error(`\nmobile: ${errors.length} problema(s):\n${errors.join('\n')}`);
    process.exit(1);
  }
  console.log(`\nmobile: todo bien. Capturas en ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
