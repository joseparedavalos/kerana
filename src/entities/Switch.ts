import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { SwitchMotor, type SwitchState } from './SwitchMotor';

const CFG = GAMEPLAY.switches;

// Disparador (S18): piedra que se enciende con el sable o con la onda de luz del tajo cargado.
// Apagada: gris azulada. Encendida: dorada con brillo. A punto de apagarse: parpadea.
export class Switch {
  readonly motor: SwitchMotor;
  /** Tile que ocupa: lo que tiene que tocar el sable o la luz. */
  readonly zone: Phaser.Geom.Rectangle;
  private readonly stone: Phaser.GameObjects.Rectangle;
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
    const cy = tile.bottom - CFG.size / 2 - 2;
    this.halo = scene.add.circle(cx, cy, CFG.size, CFG.colorOn, 0.25).setDepth(2).setVisible(false);
    this.stone = scene.add.rectangle(cx, cy, CFG.size, CFG.size, CFG.colorOff).setAngle(45).setDepth(3);
    this.stone.setStrokeStyle(1, 0x1b1a2e);
    // Pie de la piedra.
    scene.add.rectangle(cx, tile.bottom, 4, 3, 0x5a4a3a).setOrigin(0.5, 1).setDepth(2);
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
      const scene = this.stone.scene;
      scene.tweens.add({ targets: this.stone, scale: { from: 1.4, to: 1 }, duration: 200, ease: 'Back.easeOut' });
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
      this.stone.setFillStyle(on ? CFG.colorOn : CFG.colorOff);
      this.halo.setVisible(on);
    }
  }

  private applyState(state: SwitchState): void {
    this.blinkMs = 0;
    const on = state !== 'off';
    this.stone.setFillStyle(on ? CFG.colorOn : CFG.colorOff);
    this.halo.setVisible(on);
  }
}
