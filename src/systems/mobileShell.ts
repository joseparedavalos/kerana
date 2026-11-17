import type Phaser from 'phaser';
import { FONT_FAMILY } from '../config/fonts';
import { t } from '../i18n';

// Lo que el celular necesita alrededor del juego (S90): el aviso de girar el teléfono y la pantalla completa.
// Es DOM, no una escena: en vertical el lienzo (Scale.FIT) queda de un tercio del alto y un aviso adentro no se leería.

const ICON_PX = 132;
const INK = '#f2eee3';
const GOLD = '#f2c14e';

let shown = false;

/**
 * Pantalla táctil de verdad: el puntero principal es el dedo. Una notebook con pantalla táctil (puntero principal
 * fino) y `?touch=1` en la PC no cuentan: en escritorio el aviso no aparece nunca.
 */
export function isTouchScreen(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return navigator.maxTouchPoints > 0 && !window.matchMedia('(any-pointer: fine)').matches;
}

/** El aviso de girar está en pantalla y el juego, detenido detrás. */
export function rotatePromptShown(): boolean {
  return shown;
}

/**
 * En táctil y en vertical tapa todo con «Girá el teléfono» y duerme el bucle del juego; al girar a horizontal se va
 * y el juego sigue donde estaba.
 */
export function installRotatePrompt(game: Phaser.Game): void {
  if (!isTouchScreen()) return;
  let overlay: HTMLDivElement | null = null;
  let label: HTMLDivElement | null = null;

  const build = (): HTMLDivElement => {
    const root = document.createElement('div');
    root.id = 'rotate-prompt';
    root.setAttribute('role', 'alert');
    root.style.cssText =
      'position:fixed;inset:0;z-index:1000;display:none;flex-direction:column;align-items:center;justify-content:center;' +
      `gap:20px;background:#1b1a2e;color:${GOLD};font-family:${FONT_FAMILY};font-size:22px;text-align:center;touch-action:none;`;
    const canvas = document.createElement('canvas');
    const ratio = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    canvas.width = ICON_PX * ratio;
    canvas.height = ICON_PX * ratio;
    canvas.style.width = `${ICON_PX}px`;
    canvas.style.height = `${ICON_PX}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      drawRotateIcon(ctx, ICON_PX);
    }
    label = document.createElement('div');
    root.append(canvas, label);
    document.body.appendChild(root);
    return root;
  };

  // Duerme el bucle recién cuando terminó la carga: así, quien abre el juego en vertical lo encuentra listo al girar,
  // y el texto ya sale en el idioma del guardado (se lee en Boot).
  const sleepWhenLoaded = (): void => {
    if (!shown) return;
    const scenes = game.scene;
    if (scenes.isActive('Boot') || scenes.isActive('Preload') || scenes.getScenes(true).length === 0) return;
    game.events.off('poststep', sleepWhenLoaded);
    if (label) label.textContent = t('rotate.title');
    game.loop.sleep();
  };

  const apply = (): void => {
    const portrait = window.innerHeight > window.innerWidth;
    if (portrait === shown) return;
    shown = portrait;
    overlay ??= build();
    // El idioma puede haber cambiado en Opciones desde la última vez.
    if (label) label.textContent = t('rotate.title');
    overlay.style.display = portrait ? 'flex' : 'none';
    game.events.off('poststep', sleepWhenLoaded);
    if (portrait) {
      game.events.on('poststep', sleepWhenLoaded);
    } else if (game.isRunning && !game.loop.running) {
      // Sin esto, el primer cuadro al volver traería todo el tiempo que estuvo dormido.
      game.loop.resetDelta();
      game.loop.wake();
      game.scale.refresh();
    }
  };

  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  window.matchMedia('(orientation: portrait)').addEventListener?.('change', apply);
  apply();
}

/** Un teléfono de pie, una flecha curva y el teléfono acostado. */
function drawRotateIcon(ctx: CanvasRenderingContext2D, size: number): void {
  const u = size / 44;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const phone = (x: number, y: number, w: number, h: number, color: string, alpha: number): void => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.roundRect(x * u, y * u, w * u, h * u, 2.5 * u);
    ctx.stroke();
    // El botón de abajo (o del costado, acostado).
    ctx.beginPath();
    if (h > w) ctx.arc((x + w / 2) * u, (y + h - 2.6) * u, 0.9 * u, 0, Math.PI * 2);
    else ctx.arc((x + w - 2.6) * u, (y + h / 2) * u, 0.9 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  phone(5, 4, 14, 25, INK, 0.45);
  phone(14, 26, 25, 14, GOLD, 1);
  // Flecha de un cuarto de vuelta, del teléfono de pie al acostado.
  ctx.strokeStyle = GOLD;
  ctx.fillStyle = GOLD;
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.arc(21 * u, 22 * u, 13 * u, -Math.PI / 2 + 0.25, -0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(33.2 * u, 22 * u);
  ctx.lineTo(29.6 * u, 16.2 * u);
  ctx.lineTo(36.6 * u, 15.6 * u);
  ctx.closePath();
  ctx.fill();
}

let armed = false;

/**
 * Pide pantalla completa con el próximo toque (S90). Se arma en la pantalla de título. Escucha `touchend` nativo:
 * el navegador solo acepta el pedido dentro del gesto, y con el dedo eso es al levantarlo. Con el ratón no hace nada.
 * Entra toda la página (no solo el lienzo): Scale.FIT se acomoda como en cualquier cambio de tamaño de la ventana, y
 * el aviso de girar sigue encima. Donde no se puede (Safari de iPhone) no pasa nada.
 */
export function armFullscreenOnTouch(): void {
  if (armed || typeof window === 'undefined') return;
  armed = true;
  const onTouchEnd = (): void => {
    window.removeEventListener('touchend', onTouchEnd, true);
    armed = false;
    void enterFullscreen();
  };
  window.addEventListener('touchend', onTouchEnd, true);
}

type FullscreenRoot = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

// iPhone Safari no tiene requestFullscreen para elementos que no son video: el pedido falla en silencio.
// Ahí se usa una pantalla completa por CSS (posición fija a todo el viewport) que es lo más cerca que se puede.
const PSEUDO_CLASS = 'kerana-pseudo-fullscreen';

function supportsFullscreen(): boolean {
  const doc = document as Document & { webkitFullscreenEnabled?: boolean };
  return doc.fullscreenEnabled === true || doc.webkitFullscreenEnabled === true;
}

function isFullscreen(): boolean {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || document.documentElement.classList.contains(PSEUDO_CLASS));
}

function setPseudo(on: boolean): void {
  document.documentElement.classList.toggle(PSEUDO_CLASS, on);
  if (!document.getElementById('kerana-pseudo-style')) {
    const style = document.createElement('style');
    style.id = 'kerana-pseudo-style';
    style.textContent =
      `.${PSEUDO_CLASS}, .${PSEUDO_CLASS} body { position: fixed; inset: 0; width: 100%; height: 100dvh; overflow: hidden; }` +
      `.${PSEUDO_CLASS} #game, .${PSEUDO_CLASS} canvas { width: 100%; height: 100%; }`;
    document.head.appendChild(style);
  }
  // Empuja la barra del navegador fuera de la vista en horizontal.
  window.scrollTo(0, 1);
}

async function enterFullscreen(): Promise<void> {
  if (isFullscreen()) {
    exitFullscreen();
    return;
  }
  const root = document.documentElement as FullscreenRoot;
  try {
    if (supportsFullscreen()) {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
      const orientation = window.screen?.orientation as LockableOrientation | undefined;
      if (orientation?.lock) await orientation.lock('landscape');
      return;
    }
  } catch {
    // Sigue al respaldo.
  }
  setPseudo(true);
}

function exitFullscreen(): void {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
  if (doc.fullscreenElement && doc.exitFullscreen) void doc.exitFullscreen();
  else if (doc.webkitExitFullscreen) void doc.webkitExitFullscreen();
  setPseudo(false);
}

/**
 * Botón visible de pantalla completa en táctil (S90 no alcanzaba: en iPhone el pedido automático falla y no había
 * forma de reintentar). Toca para entrar, toca de nuevo para salir.
 */
export function installFullscreenButton(): void {
  if (!isTouchScreen() || document.getElementById('kerana-fullscreen')) return;
  const btn = document.createElement('button');
  btn.id = 'kerana-fullscreen';
  btn.type = 'button';
  btn.textContent = '⛶';
  btn.setAttribute('aria-label', 'Pantalla completa');
  btn.style.cssText =
    'position:fixed;top:8px;left:8px;z-index:900;width:40px;height:40px;border-radius:20px;border:2px solid #f2eee3;' +
    'background:rgba(27,26,46,0.6);color:#f2eee3;font-size:20px;line-height:1;touch-action:manipulation;';
  const go = (event: Event): void => {
    event.stopPropagation();
    void enterFullscreen();
  };
  btn.addEventListener('touchend', go);
  btn.addEventListener('click', go);
  document.body.appendChild(btn);
}
