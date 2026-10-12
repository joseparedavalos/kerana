import Phaser from 'phaser';
import { hasArt } from '../assets/art';
import { ART_DETAIL } from '../assets/manifest';
import { GAMEPLAY } from '../config/gameplay';
import type { Darkness, LevelLight } from '../systems/Darkness';
import { SwitchMotor } from './SwitchMotor';

const CFG = GAMEPLAY.lantern;
const POST_COLOR = 0x2a2a36;
const GLASS_OFF = 0x3a3a48;
const GLASS_ON = 0xf2d77e;
const ART_OFF = 'prop_lantern_off';
const ART_ON = 'prop_lantern_on';
/** S33: cuadro con la cabeza del farol (sin el poste): filas de arte de la 0 a la HEAD_ROWS - 1. */
const HEAD_FRAME = 'head';
const HEAD_ROWS = 34;
/** Centro del vidrio en la cabeza del farol (fila de arte). */
const GLASS_ROW = 20;
/** Brazo del aplique: hierro (como el poste) con un filo claro arriba, para que se lea contra el muro y el cielo. */
const BRACKET_COLOR = POST_COLOR;
const BRACKET_EDGE = 0x8a8a9c;
const NICHE_DARK = 0x0d0c16;
const NICHE_LIT = 0x8a6428;
const NICHE_RIM = 0x4a4858;

/**
 * Cómo está montado (S33): de pie con poste (en la calle, con suelo debajo), aplique de pared (cuelga de un brazo
 * corto, el muro a `side`: 1 a la derecha, -1 a la izquierda; `wallX` es la cara del muro y `armY` la altura del brazo)
 * o nicho (un hueco en el muro, como una ventana iluminada, para un farol dentro de un edificio que se ve desde fuera).
 */
export type LanternMount = { kind: 'post' } | { kind: 'wall'; wallX: number; side: 1 | -1; armY: number } | { kind: 'niche' };

// Farol de las calles de Asunción (GDD §6.7): arte de raw/props (o poste por código); se enciende al tocarlo y alumbra.
// Luisón lo puede apagar con su aullido (fase 2); Kerana lo vuelve a encender tocándolo.
// S32: también es un disparador (como un Switch): con `target` da energía a una reja o a una plataforma mientras está
// encendido; con `ms` se apaga solo (parpadea antes) y se vuelve a encender tocándolo. El sable y la onda del tajo
// cargado también lo encienden (la onda, de lejos). Apagado deja ver una brasa, para encontrarlo en la oscuridad.
// S33: además del farol de pie, el aplique de pared y el nicho (`LanternMount`). Solo cambia el dibujo: la zona para
// tocarlo, la luz y todo lo demás quedan igual que en el de pie.
export class Lantern {
  readonly zone: Phaser.Geom.Rectangle;
  readonly motor: SwitchMotor;
  /** Último disparo de la onda que lo tocó (cada onda cuenta una vez). */
  lastWaveShot = -1;
  /** Con arte: el farol entero (apagado/encendido). */
  private readonly art?: Phaser.GameObjects.Image;
  private readonly glass?: Phaser.GameObjects.Rectangle;
  private readonly glow?: Phaser.GameObjects.Arc;
  /** Nicho: el hueco del muro, oscuro apagado y cálido encendido. */
  private readonly niche?: Phaser.GameObjects.Graphics;
  private readonly nicheAt?: { x: number; sill: number };
  private readonly ember: Phaser.GameObjects.Arc;
  private readonly light: LevelLight;
  private blinkMs = 0;
  lit = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    feetY: number,
    private readonly darkness: Darkness,
    lit = false,
    timerMs = 0,
    readonly targetId?: string,
    mount: LanternMount = { kind: 'post' },
  ) {
    const h = CFG.postHeight;
    this.motor = new SwitchMotor({ timerMs, warnMs: GAMEPLAY.switches.warnMs });
    const withArt = hasArt(scene, ART_OFF) && hasArt(scene, ART_ON);
    // Centro del vidrio: donde va la brasa (en el de pie, como antes).
    let glassX = x;
    let glassY = feetY - h - 4;
    if (mount.kind === 'post') {
      if (withArt) {
        this.art = scene.add.image(x, feetY, ART_OFF).setOrigin(0.5, 1).setScale(1 / ART_DETAIL).setDepth(1);
      } else {
        scene.add.rectangle(x, feetY, 3, h, POST_COLOR).setOrigin(0.5, 1).setDepth(1);
        this.glass = scene.add.rectangle(x, feetY - h, 8, 9, GLASS_OFF).setOrigin(0.5, 1).setDepth(2).setStrokeStyle(1, POST_COLOR);
        this.glow = darkness.glow(scene.add.circle(x, feetY - h - 4, 3, GLASS_ON).setDepth(3).setVisible(false));
      }
    } else {
      // Aplique: cuelga de un brazo con escuadra; nicho: apoyado en el alféizar del hueco.
      let headTop: number;
      if (mount.kind === 'wall') {
        glassX = mount.wallX - mount.side * CFG.sconceArm;
        headTop = mount.armY + 2;
        Lantern.drawBracket(scene, mount, glassX);
      } else {
        const sill = feetY - 2;
        this.niche = Lantern.drawNiche(scene, x, sill);
        this.nicheAt = { x, sill };
        headTop = sill - (withArt ? HEAD_ROWS / ART_DETAIL : 12);
      }
      if (withArt) {
        for (const key of [ART_OFF, ART_ON]) {
          const tex = scene.textures.get(key);
          if (!tex.has(HEAD_FRAME)) tex.add(HEAD_FRAME, 0, 0, 0, tex.getSourceImage().width, HEAD_ROWS);
        }
        this.art = scene.add.image(glassX, headTop, ART_OFF, HEAD_FRAME).setOrigin(0.5, 0).setScale(1 / ART_DETAIL).setDepth(1);
        glassY = headTop + GLASS_ROW / ART_DETAIL;
      } else {
        scene.add.rectangle(glassX, headTop, 6, 3, POST_COLOR).setOrigin(0.5, 0).setDepth(1);
        this.glass = scene.add.rectangle(glassX, headTop + 3, 8, 9, GLASS_OFF).setOrigin(0.5, 0).setDepth(2).setStrokeStyle(1, POST_COLOR);
        glassY = headTop + 7;
        this.glow = darkness.glow(scene.add.circle(glassX, glassY, 3, GLASS_ON).setDepth(3).setVisible(false));
      }
    }
    this.ember = darkness.glow(scene.add.circle(glassX, glassY, CFG.emberRadius, CFG.color, CFG.emberAlpha).setDepth(3));
    this.light = darkness.addLight(x, feetY - h - 4, CFG.radius, CFG.color, CFG.intensity, false);
    this.zone = new Phaser.Geom.Rectangle(x - CFG.touchWidth / 2, feetY - CFG.touchHeight, CFG.touchWidth, CFG.touchHeight);
    if (lit) this.motor.hit();
    this.setLit(lit);
  }

  /** Brazo del aplique: placa en el muro, brazo horizontal, escuadra encima y el gancho del que cuelga el farol. */
  private static drawBracket(scene: Phaser.Scene, mount: Extract<LanternMount, { kind: 'wall' }>, lampX: number): void {
    const { wallX, side, armY } = mount;
    const tip = lampX - side * 2;
    const g = scene.add.graphics().setDepth(1);
    g.fillStyle(BRACKET_COLOR, 1);
    g.fillRect(side > 0 ? wallX - 2 : wallX, armY - CFG.sconceBrace - 2, 2, CFG.sconceBrace + 5);
    g.fillRect(Math.min(wallX, tip), armY - 1, Math.abs(wallX - tip), 2);
    g.lineStyle(1.5, BRACKET_COLOR, 1);
    g.lineBetween(wallX, armY - CFG.sconceBrace, (wallX + lampX) / 2, armY);
    g.lineBetween(lampX, armY, lampX, armY + 2);
    g.fillStyle(BRACKET_EDGE, 1);
    g.fillRect(Math.min(wallX, tip), armY - 1.5, Math.abs(wallX - tip), 0.5);
  }

  /** Nicho: hueco en arco con marco de piedra y alféizar. Devuelve el fondo, que se pinta cálido al encenderse. */
  private static drawNiche(scene: Phaser.Scene, x: number, sill: number): Phaser.GameObjects.Graphics {
    const w = CFG.nicheWidth;
    const hgt = CFG.nicheHeight;
    const r = w / 2;
    const rim = scene.add.graphics().setDepth(1);
    rim.fillStyle(NICHE_RIM, 1);
    rim.fillRect(x - r - 1.5, sill - hgt + r, w + 3, hgt - r + 1);
    rim.fillCircle(x, sill - hgt + r, r + 1.5);
    rim.fillRect(x - r - 2.5, sill, w + 5, 2);
    return scene.add.graphics().setDepth(1);
  }

  /** Pinta el fondo del nicho: oscuro apagado, cálido encendido. */
  private paintNiche(on: boolean): void {
    if (!this.niche || !this.nicheAt) return;
    const { x, sill } = this.nicheAt;
    const w = CFG.nicheWidth;
    const r = w / 2;
    const top = sill - CFG.nicheHeight + r;
    this.niche.clear().fillStyle(on ? NICHE_LIT : NICHE_DARK, 1);
    this.niche.fillRect(x - r, top, w, sill - top);
    this.niche.fillCircle(x, top, r);
  }

  /** Kerana lo toca: si está apagado, se enciende (el temporizado empieza su cuenta). True si se encendió. */
  touch(): boolean {
    if (this.lit) return false;
    this.motor.hit();
    this.setLit(true);
    return true;
  }

  /** El sable o la onda: lo enciende, y al temporizado le vuelve a empezar la cuenta. True si se encendió. */
  strike(): boolean {
    if (!this.lit) return this.touch();
    this.motor.hit();
    this.blinkMs = 0;
    this.darkness.setOn(this.light, true);
    this.glow?.setVisible(true);
    return false;
  }

  /** Lo apaga el aullido de Luisón: sin energía hasta que lo vuelvan a encender. */
  putOut(): void {
    this.motor.reset();
    this.setLit(false);
  }

  /** Temporizado: cuenta, parpadea al final y se apaga solo. */
  update(deltaMs: number): void {
    if (this.motor.permanent || !this.lit) return;
    const state = this.motor.step(deltaMs);
    if (state === 'off') {
      this.setLit(false);
      return;
    }
    if (state === 'closing') {
      this.blinkMs += deltaMs;
      const on = Math.floor((this.blinkMs / 1000) * GAMEPLAY.switches.warnBlinkHz * 2) % 2 === 0;
      this.darkness.setOn(this.light, on);
      this.glow?.setVisible(on);
    }
  }

  setLit(on: boolean): void {
    this.lit = on;
    this.blinkMs = 0;
    this.darkness.setOn(this.light, on);
    this.glow?.setVisible(on);
    this.ember.setVisible(!on);
    this.glass?.setFillStyle(on ? GLASS_ON : GLASS_OFF);
    this.art?.setTexture(on ? ART_ON : ART_OFF, this.art.frame.name);
    this.paintNiche(on);
    // Encendido no recibe la luz de la escena: se ve con su propio brillo (el nicho, como una ventana iluminada).
    for (const shown of [this.art ?? this.glass, this.niche]) {
      if (!shown) continue;
      if (on) this.darkness.glow(shown);
      else this.darkness.unglow(shown);
    }
  }
}
