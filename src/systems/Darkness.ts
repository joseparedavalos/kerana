import Phaser from 'phaser';
import { GAMEPLAY } from '../config/gameplay';
import { ambientTarget, inAnyArea, isLit, lerpColor, type Area, type LightSource } from './lightLogic';

const CFG = GAMEPLAY.darkness;

interface LitObject {
  setLighting?: (enable: boolean) => unknown;
}

/** Una luz del nivel: la fuente lógica (para saber qué está iluminado) y su luz de Phaser (si hay WebGL). */
export interface LevelLight {
  source: LightSource;
  light?: Phaser.GameObjects.Light;
  intensity: number;
}

// Oscuridad del nivel 7 (GDD §4.8, §6.7): iluminación de Phaser 4 (`setLighting`), halo sobre Kerana,
// zonas oscuras, faroles y el apagón de Luisón. Sin WebGL no hay luces, pero la lógica (qué está iluminado) sigue igual.
export class Darkness {
  private readonly webgl: boolean;
  private readonly sources: LightSource[] = [];
  private readonly zones: Area[] = [];
  private readonly halo: LevelLight;
  private ambient: number = CFG.ambientNight;
  private fromAmbient: number = CFG.ambientNight;
  private toAmbient: number = CFG.ambientNight;
  private fadeMs = 0;
  blackout = false;
  candles = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.webgl = scene.sys.renderer.type === Phaser.WEBGL;
    if (this.webgl) {
      scene.lights.enable().setAmbientColor(this.ambient);
      // Todo lo que se agregue al nivel desde ahora recibe luz (menos los textos, que siempre se leen).
      scene.sys.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.sys.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this));
    } else {
      console.warn('[OSCURIDAD] Sin WebGL: el nivel se ve sin iluminación.');
    }
    this.halo = this.addLight(0, 0, CFG.haloRadius, CFG.haloColor, CFG.haloIntensity);
  }

  private onAdded(obj: Phaser.GameObjects.GameObject): void {
    if (obj instanceof Phaser.GameObjects.Text) return;
    (obj as LitObject).setLighting?.(true);
  }

  /** Brilla con luz propia (ojos, llamas): no lo afecta la oscuridad. */
  glow<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    (obj as LitObject).setLighting?.(false);
    return obj;
  }

  /** Vuelve a recibir la luz de la escena (farol apagado). */
  unglow<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    if (this.webgl) (obj as LitObject).setLighting?.(true);
    return obj;
  }

  addLight(x: number, y: number, radius: number, color: number, intensity: number, on = true): LevelLight {
    const entry: LevelLight = { source: { x, y, radius, on }, intensity };
    if (this.webgl) entry.light = this.scene.lights.addLight(x, y, radius, color, on ? intensity : 0, CFG.lightZ);
    this.sources.push(entry.source);
    return entry;
  }

  setOn(entry: LevelLight, on: boolean): void {
    entry.source.on = on;
    entry.light?.setIntensity(on ? entry.intensity : 0);
  }

  addZone(zone: Area): void {
    this.zones.push(zone);
  }

  /** ¿(x, y) está iluminado por el halo de Kerana, un farol o una vela? */
  isLit(x: number, y: number): boolean {
    return isLit(x, y, this.sources);
  }

  /** Color ambiente actual (el fondo del nivel, que no recibe luz, se tiñe con él). */
  get ambientColor(): number {
    return this.ambient;
  }

  /** El halo sigue a Kerana; el ambiente se funde hacia el que corresponde. */
  update(playerX: number, playerY: number, deltaMs: number): void {
    this.halo.source.x = playerX;
    this.halo.source.y = playerY;
    this.halo.light?.setPosition(playerX, playerY);
    const target = ambientTarget(inAnyArea(playerX, playerY, this.zones), this.blackout, this.candles, {
      night: CFG.ambientNight,
      dark: CFG.ambientDark,
      candles: CFG.ambientCandles,
    });
    if (target !== this.toAmbient) {
      this.fromAmbient = this.ambient;
      this.toAmbient = target;
      this.fadeMs = 0;
    }
    if (this.ambient !== this.toAmbient) {
      this.fadeMs += deltaMs;
      this.ambient = lerpColor(this.fromAmbient, this.toAmbient, this.fadeMs / CFG.fadeMs);
      if (this.webgl) this.scene.lights.setAmbientColor(this.ambient);
    }
  }
}
