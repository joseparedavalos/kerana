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

// Farol de las calles de Asunción (GDD §6.7): arte de raw/props (o poste por código); se enciende al tocarlo y alumbra.
// Luisón lo puede apagar con su aullido (fase 2); Kerana lo vuelve a encender tocándolo.
// S32: también es un disparador (como un Switch): con `target` da energía a una reja o a una plataforma mientras está
// encendido; con `ms` se apaga solo (parpadea antes) y se vuelve a encender tocándolo. El sable y la onda del tajo
// cargado también lo encienden (la onda, de lejos). Apagado deja ver una brasa, para encontrarlo en la oscuridad.
export class Lantern {
  readonly zone: Phaser.Geom.Rectangle;
  readonly motor: SwitchMotor;
  /** Último disparo de la onda que lo tocó (cada onda cuenta una vez). */
  lastWaveShot = -1;
  /** Con arte: el farol entero (apagado/encendido). */
  private readonly art?: Phaser.GameObjects.Image;
  private readonly glass?: Phaser.GameObjects.Rectangle;
  private readonly glow?: Phaser.GameObjects.Arc;
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
  ) {
    const h = CFG.postHeight;
    this.motor = new SwitchMotor({ timerMs, warnMs: GAMEPLAY.switches.warnMs });
    if (hasArt(scene, ART_OFF) && hasArt(scene, ART_ON)) {
      this.art = scene.add.image(x, feetY, ART_OFF).setOrigin(0.5, 1).setScale(1 / ART_DETAIL).setDepth(1);
    } else {
      scene.add.rectangle(x, feetY, 3, h, POST_COLOR).setOrigin(0.5, 1).setDepth(1);
      this.glass = scene.add.rectangle(x, feetY - h, 8, 9, GLASS_OFF).setOrigin(0.5, 1).setDepth(2).setStrokeStyle(1, POST_COLOR);
      this.glow = darkness.glow(scene.add.circle(x, feetY - h - 4, 3, GLASS_ON).setDepth(3).setVisible(false));
    }
    this.ember = darkness.glow(scene.add.circle(x, feetY - h - 4, CFG.emberRadius, CFG.color, CFG.emberAlpha).setDepth(3));
    this.light = darkness.addLight(x, feetY - h - 4, CFG.radius, CFG.color, CFG.intensity, false);
    this.zone = new Phaser.Geom.Rectangle(x - CFG.touchWidth / 2, feetY - CFG.touchHeight, CFG.touchWidth, CFG.touchHeight);
    if (lit) this.motor.hit();
    this.setLit(lit);
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
    this.art?.setTexture(on ? ART_ON : ART_OFF);
    // Encendido no recibe la luz de la escena: se ve con su propio brillo.
    const shown = this.art ?? this.glass;
    if (!shown) return;
    if (on) this.darkness.glow(shown);
    else this.darkness.unglow(shown);
  }
}
