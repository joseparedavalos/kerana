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

async function enterFullscreen(): Promise<void> {
  try {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    if (doc.fullscreenElement || doc.webkitFullscreenElement) return;
    const root = document.documentElement as FullscreenRoot;
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
    else return;
    // Solo se puede fijar la orientación estando en pantalla completa, y no en todos los navegadores.
    const orientation = window.screen?.orientation as LockableOrientation | undefined;
    if (orientation?.lock) await orientation.lock('landscape');
  } catch {
    // El navegador no lo permite: se sigue jugando en la ventana.
  }
}
