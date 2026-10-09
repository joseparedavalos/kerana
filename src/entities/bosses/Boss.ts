import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import type { BossDef } from '../../data/bosses';
import { EventBus, GameEvents } from '../../systems/EventBus';
import type { SfxKey } from '../../systems/sfxPresets';
import type { FallingKind } from '../hazards/FallingHazard';
import { BossBrain, type BossTransition } from './BossBrain';

/** Lo que el jefe necesita del nivel, sin conocer a LevelScene (GDD §11.5). */
export interface BossContext {
  /** Arena en píxeles (rectángulo `BossArena` del mapa). */
  arena: Phaser.Geom.Rectangle;
  /** Superficie del suelo de la arena (y de los pies). */
  floorY: number;
  /**
   * Suelo firme bajo el centro de la arena sin contar las plataformas de un solo sentido (S26). En la arena de Moñái
   * `floorY` da con la copa del medio ("=" a 3 tiles del suelo); los jefes que caminan el suelo usan este.
   */
  groundY: number;
  /** Superficie de las repisas laterales, si hay. */
  ledgeY: number | null;
  /** Pies de Kerana. */
  playerX(): number;
  playerY(): number;
  /** Deja caer una estalactita (o una roca del cerro) de un solo uso en x (con su aviso). */
  spawnFalling(x: number, kind?: FallingKind): void;
  /** Empuja a Kerana horizontalmente (px/s) durante `ms` (graznido de Mbói Tu'i). */
  pushPlayer(vx: number, ms: number): void;
  /** Los camalotes de la arena se hunden y reaparecen solos (fase 3 de Mbói Tu'i). */
  setArenaPlatformsCycling(on: boolean): void;
  /** Deja caer una flor que cura en x (fase 3 de Mbói Tu'i). */
  spawnHealFlower(x: number): void;
  /** Hipnotiza a Kerana (controles invertidos, pulso de Moñái). */
  hypnotizePlayer(): void;
  /** 1 de daño a Kerana; true si se aplicó y sigue en pie (robo del corazón de Moñái). */
  damagePlayer(fromX: number): boolean;
  /** Cura a Kerana (corazón recuperado de la cola de Moñái). */
  healPlayer(amount: number): void;
  /** Suelta un enjambre de abejas que persigue a Kerana (Jasy Jatere). */
  spawnSwarm(x: number, y: number): void;
  /** Llama un enemigo común a la arena (kuati o ka'i de Kurupi, crías de Ao Ao); respeta el máximo a la vez. */
  spawnMinion(kind: string, x: number, y: number, max?: number): void;
  /** Kerana está parada en lo alto de un pindó (refugio de Ao Ao, GDD §6.6). */
  playerOnRefuge(): boolean;
  /** Apagón de Luisón (GDD §6.7): los faroles de la arena se apagan y la arena queda a oscuras. */
  setBlackout(on: boolean): void;
  /** Brilla con luz propia en un nivel oscuro (ojos, terrones); sin oscuridad no hace nada. */
  glow<T extends Phaser.GameObjects.GameObject>(obj: T): T;
  sfx(key: SfxKey): void;
  /** Sonido con paneo estéreo según dónde está `x` en la pantalla (silbido de Jasy Jatere). */
  sfxAt(key: SfxKey, x: number): void;
  shake(ms: number, intensity: number): void;
  /** Modo asistido: avisos más largos (GDD §4.7). */
  assist: boolean;
}

export interface BossHitResult {
  hit: boolean;
  defeated: boolean;
}

const NO_HIT: BossHitResult = { hit: false, defeated: false };

/** Escala de los avisos de jefe según el modo asistido (GDD §4.7): un solo lugar para los ocho jefes. */
export function assistTelegraphScale(assist: boolean): number {
  return assist ? GAMEPLAY.boss.assistTelegraphScale : 1;
}

// Base de todos los jefes: cerebro (BossBrain), barra de vida por EventBus y ganchos para cada jefe.
export abstract class Boss {
  readonly brain: BossBrain;
  private readonly result: BossHitResult = { hit: false, defeated: false };
  /** Cambia en cada reinicio: invalida la presentación si la pelea se reinició a mitad. */
  private run = 0;

  constructor(
    protected readonly scene: Phaser.Scene,
    readonly def: BossDef,
    protected readonly ctx: BossContext,
  ) {
    this.brain = new BossBrain(def, { telegraphScale: assistTelegraphScale(ctx.assist) });
  }

  /** Modo asistido cambiado en plena partida: vale desde el próximo aviso. */
  setAssist(on: boolean): void {
    this.brain.telegraphScale = assistTelegraphScale(on);
  }

  /** Presentación y comienzo de la pelea. */
  begin(): void {
    const run = ++this.run;
    this.playIntro(() => {
      if (run !== this.run) return;
      EventBus.emit(GameEvents.bossBarShow, this.def.nameKey, this.def.epithetKey);
      EventBus.emit(GameEvents.bossHpChanged, this.brain.hpFraction);
      this.brain.start();
    });
  }

  update(deltaMs: number): void {
    const t = this.brain.step(deltaMs);
    if (t) this.onTransition(t);
    this.updateVisuals(deltaMs);
  }

  /** Golpe de Kerana con su tajo (`rect` en el mundo). */
  tryHit(rect: Phaser.Geom.Rectangle, damage: number): BossHitResult {
    if (this.brain.state === 'defeated') return NO_HIT;
    const applied = this.applyHit(rect, damage);
    if (applied <= 0) return NO_HIT;
    const phaseBefore = this.brain.phase;
    const { defeated } = this.brain.damage(applied);
    EventBus.emit(GameEvents.bossHpChanged, this.brain.hpFraction);
    if (!defeated && this.brain.phase !== phaseBefore) this.onPhaseChanged(this.brain.phase);
    this.result.hit = true;
    this.result.defeated = defeated;
    if (defeated) this.onDefeated();
    return this.result;
  }

  /** Vence al jefe sin un golpe (Kerana ganó la carrera por el bastón de Jasy Jatere). */
  protected defeatNow(): void {
    if (this.brain.state === 'defeated') return;
    this.brain.damage(this.brain.hp);
    EventBus.emit(GameEvents.bossHpChanged, this.brain.hpFraction);
    this.onDefeated();
  }

  /** Reinicia la pelea (Kerana cayó dentro de la arena). */
  resetFight(): void {
    this.run++;
    this.brain.reset();
    this.resetVisuals();
    EventBus.emit(GameEvents.bossBarHide);
  }

  /** ¿Algún ataque activo toca a Kerana? */
  abstract hurtsPlayer(playerRect: Phaser.Geom.Rectangle): boolean;
  /** Dónde está la marca de Tau (para la secuencia de liberación). */
  abstract markPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2;
  /** Desvanece al jefe mientras sube como luz. */
  abstract fadeOut(ms: number): void;
  protected abstract playIntro(onDone: () => void): void;
  protected abstract onTransition(t: BossTransition): void;
  /** Aplica el golpe a la parte vulnerable; devuelve el daño aplicado (0 = no pegó). */
  protected abstract applyHit(rect: Phaser.Geom.Rectangle, damage: number): number;
  protected abstract updateVisuals(deltaMs: number): void;
  protected abstract resetVisuals(): void;
  protected onPhaseChanged(_phase: number): void {}
  protected onDefeated(): void {}
}
