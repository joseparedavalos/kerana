import Phaser from 'phaser';
import { hasArt } from '../assets/art';
import { ART_DETAIL } from '../assets/manifest';
import { GAMEPLAY } from '../config/gameplay';
import { SwitchMotor, type SwitchState } from './SwitchMotor';

const CFG = GAMEPLAY.switches;
/** S58: arte de raw/piezas/interruptor.jpg, una piedra con un ñandutí sobre un poste (apagada y encendida). */
const ART_OFF = 'piece_switch_off';
const ART_ON = 'piece_switch_on';
/** Centro de la piedra en el arte (fila desde arriba; el arte mide 30 filas): ahí va el halo. */
const ART_STONE_ROW = 10;

// Disparador (S18): piedra que se enciende con el sable o con la onda de luz del tajo cargado.
// Apagada: gris azulada. Encendida: dorada con brillo. A punto de apagarse: parpadea.
export class Switch {
  readonly motor: SwitchMotor;
  /** Tile que ocupa: lo que tiene que tocar el sable o la luz. */
  readonly zone: Phaser.Geom.Rectangle;
  private readonly stone?: Phaser.GameObjects.Rectangle;
  private readonly art?: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Arc;
  private blinkMs = 0;
  /** Último disparo de la onda que la tocó (cada onda cuenta una vez). */
  lastWaveShot = -1;

  constructor(
    scene: Phaser.Scene,
    tile: Phaser.Geom.Rectangle,
    readonly targetId: string,
    timerMs: number,
  ) {
    this.zone = tile;
    this.motor = new SwitchMotor({ timerMs, warnMs: CFG.warnMs });
    const cx = tile.centerX;
    if (hasArt(scene, ART_OFF) && hasArt(scene, ART_ON)) {
      this.art = scene.add.image(cx, tile.bottom, ART_OFF).setOrigin(0.5, 1).setScale(1 / ART_DETAIL).setDepth(3);
      const cy = tile.bottom - this.art.displayHeight + ART_STONE_ROW / ART_DETAIL;
      this.halo = scene.add.circle(cx, cy, CFG.size, CFG.colorOn, 0.25).setDepth(2).setVisible(false);
    } else {
      const cy = tile.bottom - CFG.size / 2 - 2;
      this.halo = scene.add.circle(cx, cy, CFG.size, CFG.colorOn, 0.25).setDepth(2).setVisible(false);
      this.stone = scene.add.rectangle(cx, cy, CFG.size, CFG.size, CFG.colorOff).setAngle(45).setDepth(3);
      this.stone.setStrokeStyle(1, 0x1b1a2e);
      // Pie de la piedra.
      scene.add.rectangle(cx, tile.bottom, 4, 3, 0x5a4a3a).setOrigin(0.5, 1).setDepth(2);
    }
    this.applyState('off');
  }

  get state(): SwitchState {
    return this.motor.state;
  }

  /** Golpe del sable o de la luz. Devuelve true si cambió de estado (para el sonido). */
  hit(): boolean {
    const changed = this.motor.hit();
    this.applyState(this.motor.state);
    if (changed) {
      const target = (this.art ?? this.stone)!;
      const base = target.scale;
      target.scene.tweens.add({ targets: target, scale: { from: base * 1.4, to: base }, duration: 200, ease: 'Back.easeOut' });
    }
    return changed;
  }

  update(deltaMs: number): void {
    const before = this.motor.state;
    const state = this.motor.step(deltaMs);
    if (state !== before) this.applyState(state);
    if (state === 'closing') {
      // Aviso: parpadea entre encendida y apagada.
      this.blinkMs += deltaMs;
      const on = Math.floor((this.blinkMs / 1000) * CFG.warnBlinkHz * 2) % 2 === 0;
      this.light(on);
      this.halo.setVisible(on);
    }
  }

  /** Piedra encendida o apagada (arte o rombo por código). */
  private light(on: boolean): void {
    this.art?.setTexture(on ? ART_ON : ART_OFF);
    this.stone?.setFillStyle(on ? CFG.colorOn : CFG.colorOff);
  }

  private applyState(state: SwitchState): void {
    this.blinkMs = 0;
    const on = state !== 'off';
    this.light(on);
    this.halo.setVisible(on);
  }
}
