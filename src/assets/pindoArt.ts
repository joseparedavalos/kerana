import type Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { propAtlasKey } from './manifest';
import { parsePropId } from './propLayout';

/**
 * El pindó de l6 (S78): el karanda'y del atlas `l6_roca` y una barra que cruza la copa y tapa la plataforma `=`.
 * Solo dibujo: la plataforma (posición y tamaño) es la del mapa. Si falta el atlas, devuelve false y la escena
 * dibuja el pindó por código (el de S31).
 */
export function addPindoArt(
  scene: Phaser.Scene,
  zone: { centerX: number; top: number; bottom: number; width: number },
): boolean {
  const cfg = GAMEPLAY.pindo.art;
  const parsed = parsePropId(cfg.prop);
  const key = parsed ? propAtlasKey(parsed.folder) : '';
  if (!parsed || !scene.textures.exists(key) || !scene.textures.get(key).has(parsed.name)) {
    console.warn(`[ASSET FALTANTE] prop ${cfg.prop}`);
    return false;
  }
  const detail = (scene.textures.get(key).customData as { meta?: { detail?: number } } | undefined)?.meta?.detail ?? 1;
  const frameHeight = scene.textures.getFrame(key, parsed.name).height / detail;
  // La barra (centro) queda en la franja más ancha de la copa; el pie del tronco, hundido en el piso.
  const barTop = zone.top - cfg.barRaise;
  const barCenter = barTop + cfg.barThickness / 2;
  const foot = zone.bottom + cfg.sink;
  const scale = (foot - barCenter) / ((1 - cfg.crownY) * frameHeight);
  scene.add
    .image(zone.centerX, foot, key, parsed.name)
    .setOrigin(0.5, 1)
    .setScale(scale / detail)
    .setDepth(GAMEPLAY.props.sunkDepth);
  const bar = ensurePindoBar(scene, zone.width + cfg.barOverhang * 2);
  // Delante de la capa Platforms (creada antes) y, a la misma profundidad que Kerana, debajo de ella (Kerana se
  // crea después de los objetos del mapa).
  scene.add.image(zone.centerX, barTop, bar).setOrigin(0.5, 0).setScale(1 / cfg.barDetail).setDepth(GAMEPLAY.props.depth);
  return true;
}

/**
 * Barra de la copa: hojas secas atadas (los colores del faldón marrón del dibujo), con borde oscuro, luz arriba,
 * sombra abajo y vetas a lo largo; puntas redondeadas. Una textura por ancho.
 */
function ensurePindoBar(scene: Phaser.Scene, width: number): string {
  const cfg = GAMEPLAY.pindo.art;
  const key = `pindo_bar_${width}`;
  if (scene.textures.exists(key)) return key;
  const k = cfg.barDetail;
  const w = width;
  const h = cfg.barThickness;
  const r = h / 2;
  const c = cfg.barColors;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(c.outline).fillRoundedRect(0, 0, w * k, h * k, r * k);
  g.fillStyle(c.base).fillRoundedRect(1 * k, 1 * k, (w - 2) * k, (h - 2) * k, (r - 1) * k);
  g.fillStyle(c.light).fillRect(r * k, 1 * k, (w - 2 * r) * k, 1.5 * k);
  g.fillStyle(c.highlight).fillRect((r + 2) * k, 1 * k, (w - 2 * r - 4) * k, 0.5 * k);
  g.fillStyle(c.dark).fillRect(r * k, (h - 2.5) * k, (w - 2 * r) * k, 1.5 * k);
  // Vetas: rayitas oscuras y claras a lo largo, en un orden fijo (sin azar: igual en cada partida).
  for (let j = 0; j < cfg.barGrain; j++) {
    const x = 3 + ((j * 37) % 100) / 100 * (w - 10);
    const y = 2.5 + ((j * 53) % 100) / 100 * (h - 5);
    g.fillStyle(j % 2 === 0 ? c.dark : c.light).fillRect(x * k, y * k, (3 + (j % 3) * 2) * k, 0.5 * k);
  }
  g.generateTexture(key, Math.ceil(w * k), Math.ceil(h * k));
  g.destroy();
  return key;
}
