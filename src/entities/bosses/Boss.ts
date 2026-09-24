import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/gameplay';
import type { BossDef } from '../../data/bosses';
import { EventBus, GameEvents } from '../../systems/EventBus';
import type { SfxKey } from '../../systems/sfxPresets';
import { BossBrain, type BossTransition } from './BossBrain';

/** Lo que el jefe necesita del nivel, sin conocer a LevelScene (GDD §11.5). */
export interface BossContext {
  /** Arena en píxeles (rectángulo `BossArena` del mapa). */
  arena: Phaser.Geom.Rectangle;
  /** Superficie del suelo de la arena (y de los pies). */
  floorY: number;
  /** Superficie de las repisas laterales, si hay. */
  ledgeY: number | null;
  /** Pies de Kerana. */
  playerX(): number;
  playerY(): number;
  /** Deja caer una estalactita de un solo uso en x (con su aviso). */
  spawnFalling(x: number): void;
  sfx(key: SfxKey): void;
  shake(ms: number, intensity: number): void;
  /** Modo asistido: avisos más largos (GDD §4.7). */
  assist: boolean;
}

export interface BossHitResult {
  hit: boolean;
  defeated: boolean;
}

const NO_HIT: BossHitResult = { hit: false, defeated: false };

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
    this.brain = new BossBrain(def, { telegraphScale: ctx.assist ? GAMEPLAY.boss.assistTelegraphScale : 1 });
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
