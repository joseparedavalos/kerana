import Phaser from 'phaser';
import { tilesetKey } from '../assets/manifest';
import { DEBUG } from '../config/debug';
import { FONT_FAMILY } from '../config/fonts';
import { GAMEPLAY } from '../config/gameplay';
import { liberationDialogue } from '../data/dialogues';
import { getLevel } from '../data/levels';
import type { BossId, LevelDef, LevelId } from '../data/types';
import { createBoss, type Boss, type BossContext } from '../entities/bosses';
import { onRefuge, type Refuge } from '../entities/bosses/aoAoLogic';
import { panFor } from '../entities/bosses/jasyLogic';
import { Cow } from '../entities/Cow';
import { createEnemy } from '../entities/enemies';
import type { EnemyBase } from '../entities/enemies/EnemyBase';
import { Bouncer } from '../entities/hazards/Bouncer';
import { Crumble } from '../entities/hazards/Crumble';
import { FallingHazard, type FallingKind } from '../entities/hazards/FallingHazard';
import { Sinking } from '../entities/hazards/Sinking';
import { WindZone } from '../entities/hazards/WindZone';
import { Lantern } from '../entities/Lantern';
import { LightWaveMotor } from '../entities/LightWaveMotor';
import { Player } from '../entities/Player';
import { Pickup, type PickupKind } from '../entities/pickups/Pickup';
import type { PlayerStateName } from '../entities/PlayerMotor';
import { t } from '../i18n';
import { AudioManager } from '../systems/AudioManager';
import { BossArena } from '../systems/BossArena';
import { CameraController } from '../systems/CameraController';
import { Darkness, type LevelLight } from '../systems/Darkness';
import { DialogueBox } from '../systems/DialogueBox';
import { EventBus, GameEvents } from '../systems/EventBus';
import { InputManager } from '../systems/InputManager';
import { playLiberation } from '../systems/LiberationSequence';
import { SaveManager } from '../systems/SaveManager';
import type { SfxKey } from '../systems/sfxPresets';
import { ensurePlaceholder } from '../utils/placeholder';
import { fixedOffset, setupView, VIEW } from '../systems/View';

type RespawnReason = 'pit' | 'water' | 'hazard';
const TILE_LAYERS = ['Background', 'Ground', 'Platforms', 'Hazards', 'Water', 'Foreground'] as const;
type TileLayerName = (typeof TILE_LAYERS)[number];

interface Checkpoint {
  id: number;
  sprite: Phaser.GameObjects.Sprite;
  zone: Phaser.Geom.Rectangle;
  active: boolean;
  /** Ya se encendió alguna vez (da +1 corazón la primera vez, GDD §4.2). */
  lit: boolean;
  /** En los niveles oscuros el fuego también alumbra (GDD §6.7). */
  light?: LevelLight;
}

interface Sign {
  zone: Phaser.Geom.Rectangle;
  text: Phaser.GameObjects.Text;
}

/** Roca agrietada (tiles de `Ground`, pide el tajo cargado) o liana (objeto propio, basta el tajo normal). */
interface Breakable {
  zone: Phaser.Geom.Rectangle;
  needsCharge: boolean;
  hitsLeft: number;
  /** Liana: rectángulo con cuerpo estático. Roca: undefined (son tiles). */
  block?: Phaser.GameObjects.Rectangle;
  broken: boolean;
}

const FX_PARTICLE = 'fx_particle';
const SHALLOW_COLOR = 0x5aa6b8;
const FOG_COLOR = 0xc8b8e6;
const LIANA_COLOR = 0x3f7a3a;
const PINDO_TRUNK_COLOR = 0x7a6248;
const PINDO_LEAF_COLOR = 0x4f8a3a;
const SIGN_RANGE = 20;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: '10px',
  color: '#F2EEE3',
  backgroundColor: '#1B1A2ECC',
  padding: { x: 4, y: 3 },
  wordWrap: { width: 200 },
  align: 'center',
};

// Clase de un objeto de Tiled: viene en `type` o en `class` según la versión.
export function objectClass(obj: Phaser.Types.Tilemaps.TiledObject): string {
  return obj.type || (obj as { class?: string }).class || '';
}

function objectProp(obj: Phaser.Types.Tilemaps.TiledObject, name: string): unknown {
  const props = obj.properties as { name: string; value: unknown }[] | undefined;
  return props?.find((p) => p.name === name)?.value;
}

// Nivel genérico: mapa, colisiones por capa, combate, vida, objetos y reaparición.
export class LevelScene extends Phaser.Scene {
  private def!: LevelDef;
  private map!: Phaser.Tilemaps.Tilemap;
  private layers: Partial<Record<TileLayerName, Phaser.Tilemaps.TilemapLayer>> = {};
  private player!: Player;
  private inputs!: InputManager;
  private cameraCtl!: CameraController;
  private enemies: EnemyBase[] = [];
  private pickups: Pickup[] = [];
  private checkpoints: Checkpoint[] = [];
  private signs: Sign[] = [];
  private feathers = 0;
  private lastPlayerState: PlayerStateName = 'idle';
  private wasImmune = false;
  private readonly safeGround = new Phaser.Math.Vector2();
  private readonly checkpointPos = new Phaser.Math.Vector2();
  private readonly playerRect = new Phaser.Geom.Rectangle();
  private debugText?: Phaser.GameObjects.Text;
  private levelExitZone?: Phaser.Geom.Rectangle;
  private dialogueBox!: DialogueBox;
  private mainumby?: Phaser.GameObjects.Image;
  private completing = false;
  private breakables: Breakable[] = [];
  private fallingHazards: FallingHazard[] = [];
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splashes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splashMs = 0;
  private sinkers: Sinking[] = [];
  /** Zonas de agua baja (GDD §4.8): frenan la carrera. */
  private shallowZones: Phaser.Geom.Rectangle[] = [];
  /** Zonas de viento (GDD §4.8, §6.3). */
  private windZones: WindZone[] = [];
  /** Espiral sobre Kerana mientras está hipnotizada (GDD §4.8). */
  private hypnosisIcon?: Phaser.GameObjects.Image;
  /** Niebla del sueño (GDD §4.8, §6.4). */
  private fogZones: Phaser.Geom.Rectangle[] = [];
  /** "Zzz" sobre Kerana: bostezo (tenue) y dormida. */
  private sleepIcon?: Phaser.GameObjects.Text;
  /** Enemigos que llamó el jefe: enjambres, kuati, ka'i (se limpian al reiniciar la pelea). */
  private bossMinions: EnemyBase[] = [];
  /** Hongos que rebotan y ramas que se quiebran (GDD §6.5). */
  private bouncers: Bouncer[] = [];
  private crumbles: Crumble[] = [];
  /** Copas de pindó (GDD §6.6): refugio de Ao Ao. */
  private refuges: Refuge[] = [];
  /** Vacas sueltas de Capiatá: plataformas que caminan. */
  private cows: Cow[] = [];
  private cowGroup?: Phaser.Physics.Arcade.Group;
  /** Oscuridad del nivel 7 (GDD §4.8): solo en los niveles con `dark`. */
  private darkness?: Darkness;
  /** Faroles que se encienden al tocarlos (GDD §6.7). */
  private lanterns: Lantern[] = [];
  /** Onda de luz del tajo cargado (una sola en pantalla). */
  private readonly lightWave = new LightWaveMotor(GAMEPLAY.lightWave);
  /** La onda choca solo con la capa Ground (las plataformas de un sentido no la frenan). */
  private readonly waveProbe = (x: number, y: number): boolean => this.tileAt('Ground', x, y);
  private lightWaveSprite?: Phaser.GameObjects.Rectangle;
  private readonly waveRect = new Phaser.Geom.Rectangle();
  private readonly enemyRect = new Phaser.Geom.Rectangle();
  private arenaRect?: Phaser.Geom.Rectangle;
  private arenaBossId?: BossId;
  private arena?: BossArena;
  private boss?: Boss;
  /** Pelea en curso (después de cerrar la arena). */
  private fighting = false;
  /** Escena de liberación: el jugador no controla a Kerana. */
  private cutscene = false;

  constructor() {
    super('Level');
  }

  init(data: { levelId?: LevelId }): void {
    this.def = getLevel(data.levelId ?? 'test');
    this.layers = {};
    this.checkpoints = [];
    this.signs = [];
    this.enemies = [];
    this.pickups = [];
    this.feathers = 0;
    this.lastPlayerState = 'idle';
    this.levelExitZone = undefined;
    this.completing = false;
    this.breakables = [];
    this.fallingHazards = [];
    this.sinkers = [];
    this.shallowZones = [];
    this.windZones = [];
    this.hypnosisIcon = undefined;
    this.fogZones = [];
    this.sleepIcon = undefined;
    this.bossMinions = [];
    this.bouncers = [];
    this.crumbles = [];
    this.refuges = [];
    this.cows = [];
    this.cowGroup = undefined;
    this.darkness = undefined;
    this.lanterns = [];
    this.lightWave.stop();
    this.lightWaveSprite = undefined;
    this.arenaRect = undefined;
    this.arenaBossId = undefined;
    this.arena = undefined;
    this.boss = undefined;
    this.fighting = false;
    this.cutscene = false;
  }

  create(): void {
    // Zoom antes de crear la caja de diálogo y el texto de depuración (usan fixedOffset).
    setupView(this, false);
    if (!this.cache.tilemap.exists(this.def.mapKey)) {
      console.warn(`[ASSET FALTANTE] ${this.def.mapKey}: corré "npm run maps".`);
      this.scene.start(this.def.order > 0 ? 'Map' : 'Title');
      return;
    }
    this.inputs = new InputManager(this);
    this.enemies = [];
    this.pickups = [];
    this.dialogueBox = new DialogueBox(this);
    this.makeFxParticle();
    this.dust = this.add
      .particles(0, 0, FX_PARTICLE, {
        speedY: { min: 20, max: 60 },
        speedX: { min: -20, max: 20 },
        lifespan: 500,
        alpha: { start: 0.8, end: 0 },
        tint: 0xb5aa9c,
        emitting: false,
      })
      .setDepth(6);
    this.splashes = this.add
      .particles(0, 0, FX_PARTICLE, {
        speedY: { min: -70, max: -30 },
        speedX: { min: -30, max: 30 },
        gravityY: 300,
        lifespan: 350,
        alpha: { start: 0.9, end: 0 },
        tint: 0xd8f0f0,
        emitting: false,
      })
      .setDepth(12);
    // Antes del mapa: todo lo que se cree desde acá recibe la luz (los textos y la caja de diálogo, no).
    if (this.def.dark) this.darkness = new Darkness(this);
    this.buildMap();
    const spawn = this.buildObjects();
    if (DEBUG.boss) this.spawnAtLastCheckpoint(spawn);

    const save = SaveManager.current;
    this.player = new Player(this, spawn.x, spawn.y, {
      assist: save.settings.assist,
      maxHearts: save.maxHearts,
      chargedSlash: DEBUG.giftsAll || save.gifts.includes('charged_slash'),
      doubleJump: DEBUG.giftsAll || save.gifts.includes('double_jump'),
      dash: DEBUG.giftsAll || save.gifts.includes('dash'),
      god: DEBUG.god,
    });
    this.safeGround.copy(spawn);
    this.checkpointPos.copy(spawn);
    ensurePlaceholder(this, 'mainumby_placeholder', 8, 8);
    this.mainumby = this.add.image(spawn.x, spawn.y - 40, 'mainumby_placeholder').setDepth(15);
    this.hypnosisIcon = this.add.image(spawn.x, spawn.y, this.makeSpiralTexture()).setDepth(16).setVisible(false);
    this.sleepIcon = this.add
      .text(spawn.x, spawn.y, t('status.zzz'), { fontFamily: FONT_FAMILY, fontSize: '10px', color: '#F2EEE3' })
      .setOrigin(0.5, 1)
      .setDepth(16)
      .setVisible(false);
    const { Ground, Platforms, Foreground } = this.layers;
    if (Ground) {
      this.physics.add.collider(this.player, Ground);
      this.physics.add.collider(this.enemies, Ground, undefined, (enemy) => isGroundedEnemy(enemy), this);
    }
    if (Platforms) {
      this.physics.add.collider(this.player, Platforms);
      this.physics.add.collider(this.enemies, Platforms, undefined, (enemy) => isGroundedEnemy(enemy), this);
    }
    Foreground?.setDepth(10);

    this.physics.add.overlap(this.player.getAttackHitbox(), this.enemies, this.onAttackHit, undefined, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerTouchEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.pickups, this.onPickupOverlap, undefined, this);
    for (const sinker of this.sinkers) this.physics.add.collider(this.player, sinker.raft);
    for (const b of this.bouncers) this.physics.add.collider(this.player, b.cap);
    for (const c of this.crumbles) {
      this.physics.add.collider(this.player, c.branch);
      this.physics.add.collider(this.enemies, c.branch, undefined, (enemy) => isGroundedEnemy(enemy), this);
    }
    if (this.cows.length > 0) {
      this.cowGroup = this.physics.add.group();
      for (const cow of this.cows) this.addCowToGroup(cow);
      this.physics.add.collider(this.player, this.cowGroup);
    }
    const lw = GAMEPLAY.lightWave;
    this.lightWaveSprite = this.add.rectangle(0, 0, lw.width, lw.height, lw.color, 0.85).setDepth(12).setVisible(false);
    this.darkness?.glow(this.lightWaveSprite);
    for (const b of this.breakables) {
      if (!b.block) continue;
      this.physics.add.collider(this.player, b.block);
      this.physics.add.collider(this.enemies, b.block);
    }
    this.setupBoss();

    this.cameraCtl = new CameraController(this.cameras.main, this.player, {
      width: this.map.widthInPixels,
      height: this.map.heightInPixels,
    });

    // El registro es el estado inicial: UI puede arrancar después de que estos eventos ya se emitieron.
    this.registry.set('hearts', { current: this.player.health.current, max: this.player.health.max });
    this.registry.set('feathers', { current: this.feathers, max: GAMEPLAY.hud.featherMax });
    this.scene.launch('UI');
    EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
    EventBus.emit(GameEvents.feathersChanged, this.feathers, GAMEPLAY.hud.featherMax);
    EventBus.emit(GameEvents.luzArasyChanged, false, 0);

    if (DEBUG.debug) {
      const hud = fixedOffset(this.cameras.main);
      this.debugText = this.add
        .text(hud.x + 4, hud.y + VIEW.height - 4, '', { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#F2C14E' })
        .setOrigin(0, 1)
        .setScrollFactor(0)
        .setDepth(100);
      window.__KERANA_DEBUG__ = {
        scene: this,
        player: this.player,
        safeGround: this.safeGround,
        // Para la prueba de humo: gana la pelea de un golpe y lanza la liberación.
        defeatBoss: () => this.debugDefeatBoss(),
      };
    }
    EventBus.on(GameEvents.restartFromCheckpoint, this.restartFromCheckpoint, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('UI');
      EventBus.off(GameEvents.restartFromCheckpoint, this.restartFromCheckpoint, this);
    });

    EventBus.emit(GameEvents.levelReady, this.def.id);
    window.__KERANA_READY__ = true;
  }

  override update(_time: number, delta: number): void {
    this.inputs.update();

    if (this.dialogueBox.active) {
      this.dialogueBox.update(delta, this.inputs.justPressed('jump') || this.inputs.justPressed('attack'));
      return;
    }
    if (this.cutscene) return;
    if (this.inputs.justPressed('pause')) {
      this.openPause();
      return;
    }

    this.player.tick(delta, this.inputs);
    this.reportPlayerStateSfx();
    this.cameraCtl.update(this.player.motor.facing);
    this.updateEnemies(delta);
    for (const cow of this.cows) cow.tick(delta);
    this.updateMainumby();

    const body = this.player.body;
    this.playerRect.setTo(body.x, body.y, body.width, body.height);

    if (body.top > this.map.heightInPixels + GAMEPLAY.respawn.pitMargin) this.respawn('pit');
    else if (this.tileAt('Water', body.center.x, body.center.y)) this.respawn('water');
    else if (!this.player.isIntangible && this.touchesHazard(body)) this.respawn('hazard');
    else this.trackSafeGround(body);

    this.updateWater(delta, body);
    this.updateJungle(delta, body);
    this.updateProjectiles();
    this.updateWind(delta, body);
    this.updateHypnosisIcon(delta);
    this.updateSleep(body);
    this.updateFallingHazards(delta);
    this.updateBreakables();
    this.updateLightWave(delta);
    this.updateDarkness(delta);
    this.updateBoss(delta);
    this.updateCheckpoints();
    this.updateSigns();
    this.updateLuzArasyHud();
    this.updateLevelExit();
    if (this.debugText) this.updateDebugText();
  }

  private openPause(): void {
    this.scene.pause();
    this.scene.launch('Pause', { levelId: this.def.id });
  }

  private restartFromCheckpoint(): void {
    this.player.respawnAt(this.checkpointPos.x, this.checkpointPos.y);
  }

  /** Mainumby sigue a Kerana con un retraso suave, flotando sobre su hombro (GDD §4.5). */
  private updateMainumby(): void {
    if (!this.mainumby) return;
    const targetX = this.player.x - this.player.motor.facing * 14;
    const targetY = this.player.y - 44;
    this.mainumby.x += (targetX - this.mainumby.x) * 0.08;
    this.mainumby.y += (targetY - this.mainumby.y) * 0.08;
  }

  // ── Jefe (GDD §6.0, §11.5) ────────────────────────────────────────────────

  private setupBoss(): void {
    if (!this.arenaRect || !this.arenaBossId) return;
    const rect = this.arenaRect;
    const floorY = this.surfaceBelow(rect.centerX, rect.top) ?? rect.bottom;
    const ledgeProbe = this.surfaceBelow(rect.left + this.map.tileWidth * 5.5, rect.top);
    const ledgeY = ledgeProbe !== null && ledgeProbe < floorY - 8 ? ledgeProbe : null;
    const ctx: BossContext = {
      arena: rect,
      floorY,
      ledgeY,
      playerX: () => this.player.x,
      playerY: () => this.player.y,
      spawnFalling: (x, kind) => {
        if (this.fighting) this.spawnFalling(x, rect.top, true, undefined, kind);
      },
      pushPlayer: (vx, ms) => this.player.motor.push(vx, ms),
      hypnotizePlayer: () => this.hypnotizePlayer(),
      damagePlayer: (fromX) => this.hurtPlayer(fromX) && !this.player.health.isDead,
      healPlayer: (amount) => {
        if (this.player.heal(amount) > 0) EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
      },
      setArenaPlatformsCycling: (on) => this.setArenaPlatformsCycling(on),
      spawnHealFlower: (x) => this.spawnHealFlower(x, rect.top),
      spawnSwarm: (x, y) => this.spawnBossMinion('abejas', x, y, GAMEPLAY.jasyJatere.maxSwarms),
      spawnMinion: (kind, x, y, max) => this.spawnBossMinion(kind, x, y, max ?? GAMEPLAY.kurupi.maxMinions),
      playerOnRefuge: () => this.playerOnRefuge(),
      setBlackout: (on) => this.setBlackout(on, rect),
      glow: (obj) => this.darkness?.glow(obj) ?? obj,
      sfx: (key: SfxKey) => AudioManager.play(key),
      sfxAt: (key: SfxKey, x: number) => {
        const view = this.cameras.main.worldView;
        AudioManager.play(key, panFor(x, view.centerX, view.width / 2));
      },
      shake: (ms, intensity) => this.shake(ms, intensity),
      assist: SaveManager.current.settings.assist,
    };
    const boss = createBoss(this, this.arenaBossId, ctx);
    if (!boss) return;
    this.boss = boss;
    this.arena = new BossArena(this, rect, floorY, this.player);
  }

  private updateBoss(deltaMs: number): void {
    const boss = this.boss;
    const arena = this.arena;
    if (!boss || !arena) return;
    if (!this.fighting) {
      if (boss.brain.state !== 'defeated' && arena.shouldLock(this.playerRect)) this.startBossFight();
      return;
    }
    boss.update(deltaMs);
    if (this.player.motor.attackHitboxActive && !this.player.hasHitThisSwing(boss)) {
      const result = boss.tryHit(this.player.attackRect, this.player.attackDamage);
      if (result.hit) {
        this.player.markHitThisSwing(boss);
        // El tajo cargado de cerca ya hizo su daño: la onda que sale con él no suma otro golpe.
        if (this.player.motor.chargedSwing) this.lightWave.tryHit(boss);
        if (result.defeated) {
          this.startLiberation();
          return;
        }
        this.hitStop(GAMEPLAY.hitStop.onHitMs);
      }
    }
    if (boss.hurtsPlayer(this.playerRect)) this.hurtPlayer(boss.markPosition(this.tmpVec).x);
    // Vencido sin golpe final (Kerana ganó la carrera por el bastón de Jasy Jatere).
    if (this.fighting && boss.brain.state === 'defeated') this.startLiberation();
  }

  private readonly tmpVec = new Phaser.Math.Vector2();

  private startBossFight(): void {
    this.fighting = true;
    this.arena!.lock(this.cameras.main);
    AudioManager.play('arenaLock');
    this.shake(GAMEPLAY.boss.lockShakeMs, GAMEPLAY.boss.lockShakeIntensity);
    this.boss!.begin();
  }

  /** Kerana cayó durante la pelea: todo vuelve a empezar desde la antesala. */
  private resetBossFight(): void {
    if (!this.fighting) return;
    this.fighting = false;
    this.boss?.resetFight();
    this.arena?.unlock(this.cameras.main, this.map.widthInPixels, this.map.heightInPixels);
    this.clearOneShotHazards();
    this.clearFlowers();
    this.clearBossMinions();
  }

  private startLiberation(): void {
    const boss = this.boss!;
    this.cutscene = true;
    this.fighting = false;
    this.clearOneShotHazards();
    this.clearFlowers();
    this.clearBossMinions();
    EventBus.emit(GameEvents.bossBarHide);
    this.lightCandles();
    const gift = this.def.gift;
    const giftText = gift ? `${t('liberation.gift', { gift: t(`gift.${gift}`) })}\n${t(`gift_hint.${gift}`)}` : null;
    playLiberation({
      scene: this,
      boss,
      giftText,
      flashes: SaveManager.current.settings.flashes,
      showDialogue: (done) => {
        const lines = liberationDialogue(this.def.id);
        if (lines.length > 0) this.dialogueBox.show(lines, done);
        else done();
      },
      onDone: () => this.finishLevel(),
    });
  }

  private debugDefeatBoss(): void {
    const boss = this.boss;
    if (!boss) return;
    if (!this.fighting) {
      this.player.body.reset(this.arena!.rect.centerX, this.arena!.rect.bottom - 64);
      this.startBossFight();
    }
    boss.brain.damage(boss.brain.hp);
    this.startLiberation();
  }

  // ── Oscuridad, faroles y velas (GDD §4.8, §6.7) ──────────────────────────

  /** Halo de Kerana, faroles que se encienden al tocarlos y póra que solo se pueden golpear iluminados. */
  private updateDarkness(deltaMs: number): void {
    const darkness = this.darkness;
    if (!darkness) return;
    darkness.update(this.player.x, this.player.y - this.player.body.height / 2, deltaMs);
    for (const lantern of this.lanterns) {
      if (lantern.lit || !Phaser.Geom.Rectangle.Overlaps(lantern.zone, this.playerRect)) continue;
      lantern.setLit(true);
      AudioManager.play('lantern');
    }
    for (const enemy of this.enemies) {
      if (!enemy.def.needsLight || enemy.purified || !enemy.active) continue;
      enemy.lit = darkness.isLit(enemy.x, enemy.y - enemy.def.height / 2);
    }
  }

  /** Apagón de Luisón: la arena queda a oscuras y sus faroles se apagan (Kerana los vuelve a encender). */
  private setBlackout(on: boolean, arena: Phaser.Geom.Rectangle): void {
    const darkness = this.darkness;
    if (!darkness) return;
    darkness.blackout = on;
    if (!on) return;
    for (const lantern of this.lanterns) if (lantern.lit && arena.contains(lantern.zone.centerX, lantern.zone.bottom - 1)) lantern.setLit(false);
  }

  /** Al liberar a Luisón, las velas del cementerio se encienden solas, una tras otra. */
  private lightCandles(): void {
    const darkness = this.darkness;
    const rect = this.arenaRect;
    if (!darkness || !rect) return;
    darkness.blackout = false;
    darkness.candles = true;
    const cfg = GAMEPLAY.candles;
    const tile = this.map.tileWidth;
    const lightEvery = Math.max(1, Math.round(cfg.count / cfg.lights));
    for (let i = 0; i < cfg.count; i++) {
      const x = rect.left + tile * 2 + ((rect.width - tile * 4) * i) / Math.max(1, cfg.count - 1);
      const y = this.surfaceBelow(x, rect.top) ?? rect.bottom;
      this.time.delayedCall(i * cfg.gapMs, () => {
        darkness.glow(this.add.rectangle(x, y, 3, 6, 0xf2eee3).setOrigin(0.5, 1).setDepth(3));
        const flame = darkness.glow(this.add.ellipse(x, y - 7, 3, 5, cfg.color).setDepth(3));
        this.tweens.add({ targets: flame, scaleY: 1.3, duration: 180, yoyo: true, repeat: -1, delay: i * 37 });
        if (i % lightEvery === 0) darkness.addLight(x, y - 10, cfg.radius, cfg.color, cfg.intensity);
        if (i % 3 === 0) AudioManager.play('lantern');
      });
    }
  }

  /** Lo que brilla solo en la oscuridad (ojos del jagua hũ). */
  private glowEnemyParts(enemy: EnemyBase): void {
    if (!this.darkness) return;
    for (const part of enemy.glowParts) this.darkness.glow(part);
  }

  // ── Pindó, vacas y onda de luz ────────────────────────────────────────────

  /** Pindó (GDD §6.6): tronco y hojas por código; la copa (plataforma `=` del mapa) es refugio. */
  private addPindo(zone: Phaser.Geom.Rectangle): void {
    this.refuges.push({ left: zone.left, right: zone.right, top: zone.top });
    const trunk = GAMEPLAY.pindo.trunkWidth;
    this.add.rectangle(zone.centerX - trunk / 2, zone.top, trunk, zone.height, PINDO_TRUNK_COLOR).setOrigin(0, 0).setDepth(1);
    for (const dx of [-1, 1]) {
      this.add.ellipse(zone.centerX + dx * zone.width * 0.35, zone.top - 2, zone.width * 0.8, 6, PINDO_LEAF_COLOR).setDepth(2).setAngle(dx * 15);
    }
  }

  private playerOnRefuge(): boolean {
    if (this.refuges.length === 0) return false;
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    return onRefuge(body.center.x, body.bottom, grounded, this.refuges, GAMEPLAY.pindo.feetTolerancePx);
  }

  private makeCow(x: number, feetY: number, facing: 1 | -1): Cow {
    return new Cow(this, x, feetY, facing, (cow) => {
      const view = this.cameras.main.worldView;
      if (view.contains(cow.x, cow.y - 4)) AudioManager.play('moo', panFor(cow.x, view.centerX, view.width / 2));
    });
  }

  private addCowToGroup(cow: Cow): void {
    // El grupo pisa las propiedades del cuerpo: se vuelven a poner.
    this.cowGroup?.add(cow);
    cow.body.setAllowGravity(false).setImmovable(true);
    cow.body.checkCollision.down = false;
    cow.body.checkCollision.left = false;
    cow.body.checkCollision.right = false;
  }

  /** La vaca embrujada purificada queda como una vaca tranquila más. */
  private cowFromEnemy(enemy: EnemyBase): void {
    const cow = this.makeCow(enemy.x, enemy.y, enemy.facing);
    cow.setAlpha(0);
    this.tweens.add({ targets: cow, alpha: 1, duration: 400, delay: 200 });
    this.cows.push(cow);
    this.addCowToGroup(cow);
  }

  /** Al soltar el tajo cargado sale una onda dorada hacia adelante. */
  private fireLightWave(): void {
    const facing = this.player.motor.facing;
    const x = this.player.x + facing * GAMEPLAY.lightWave.offsetPx;
    const y = this.player.y - this.player.body.height / 2;
    if (!this.lightWave.fire(x, y, facing)) return;
    AudioManager.play('lightWave');
  }

  /** La onda purifica enemigos comunes, rompe rocas agrietadas y daña al jefe solo en su ventana. */
  private updateLightWave(deltaMs: number): void {
    const wave = this.lightWave;
    const sprite = this.lightWaveSprite;
    if (!sprite) return;
    wave.step(deltaMs, this.waveProbe);
    sprite.setVisible(wave.active);
    if (!wave.active) return;
    const lw = GAMEPLAY.lightWave;
    sprite.setPosition(wave.x, wave.y).setAlpha(wave.alpha * 0.85);
    // Chocó con una pared: solo se apaga, no toca nada del otro lado.
    if (!wave.canHit) return;
    const rect = this.waveRect.setTo(wave.x - lw.width / 2, wave.y - lw.height / 2, lw.width, lw.height);
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.purified) continue;
      const eb = enemy.body;
      if (!Phaser.Geom.Rectangle.Overlaps(rect, this.enemyRect.setTo(eb.x, eb.y, eb.width, eb.height))) continue;
      if (!wave.tryHit(enemy)) continue;
      enemy.purify();
      AudioManager.play('purify');
    }
    for (const b of this.breakables) {
      if (b.broken || !b.needsCharge || !Phaser.Geom.Rectangle.Overlaps(b.zone, rect)) continue;
      if (wave.tryHit(b)) this.breakBreakable(b);
    }
    const boss = this.boss;
    if (boss && this.fighting && boss.brain.state !== 'defeated') {
      const damage = wave.bossDamage(boss.brain.vulnerable);
      if (damage > 0 && !wave.hasHit(boss)) {
        const result = boss.tryHit(rect, damage);
        if (result.hit) {
          wave.tryHit(boss);
          if (result.defeated) this.startLiberation();
        }
      }
    }
  }

  /** Superficie (y) del primer tile sólido o plataforma debajo de (x, fromY), o null. */
  private surfaceBelow(x: number, fromY: number): number | null {
    const tile = this.map.tileHeight;
    for (let y = fromY + tile / 2; y < this.map.heightInPixels; y += tile) {
      if (this.isSolidAt(x, y)) return Math.floor(y / tile) * tile;
    }
    return null;
  }

  private spawnAtLastCheckpoint(spawn: Phaser.Math.Vector2): void {
    let last: Checkpoint | undefined;
    for (const cp of this.checkpoints) if (!last || cp.id > last.id) last = cp;
    if (last) spawn.set(last.zone.centerX, last.zone.bottom);
  }

  // ── Estalactitas y rocas ──────────────────────────────────────────────────

  private spawnFalling(x: number, ceilingY: number, oneShot: boolean, warnMs?: number, kind: FallingKind = 'stalactite'): void {
    const groundY = this.surfaceBelow(x, ceilingY) ?? this.map.heightInPixels;
    const onWarn = kind === 'teja' ? () => AudioManager.play('creak') : undefined;
    this.fallingHazards.push(
      new FallingHazard(this, x, ceilingY, groundY, this.dust, { oneShot, warnMs, kind, onWarn, onShatter: () => AudioManager.play('rockBreak') }),
    );
  }

  private updateFallingHazards(deltaMs: number): void {
    let removed = false;
    for (const hazard of this.fallingHazards) {
      if (hazard.update(deltaMs, this.player.x, this.playerRect)) this.hurtPlayer(hazard.sprite.x);
      if (hazard.state === 'gone') removed = true;
    }
    if (removed) this.fallingHazards = this.fallingHazards.filter((h) => h.state !== 'gone');
  }

  private clearOneShotHazards(): void {
    for (const hazard of this.fallingHazards) if (hazard.state !== 'gone' && this.arenaRect?.contains(hazard.sprite.x, hazard.sprite.y + 1)) hazard.destroy();
    this.fallingHazards = this.fallingHazards.filter((h) => h.state !== 'gone');
  }

  // ── Agua y camalotes (GDD §4.8, §6.2) ─────────────────────────────────────

  /** Camalotes que se hunden al pisarlos; agua baja que frena y salpica. */
  private updateWater(deltaMs: number, body: Phaser.Physics.Arcade.Body): void {
    for (const sinker of this.sinkers) sinker.update(deltaMs, sinker.isStoodOn(body));
    const grounded = body.blocked.down || body.touching.down;
    const feetY = body.bottom - 1;
    const inShallow = this.shallowZones.some((z) => z.contains(body.center.x, feetY));
    this.player.motor.speedMultiplier = inShallow && grounded ? GAMEPLAY.water.shallowSpeedFactor : 1;
    if (!inShallow || !grounded || Math.abs(body.velocity.x) < GAMEPLAY.player.idleSpeedThreshold) return;
    this.splashMs -= deltaMs;
    if (this.splashMs > 0) return;
    this.splashMs = GAMEPLAY.water.splashEveryMs;
    this.splashes.emitParticleAt(body.center.x, body.bottom - 2, 3);
    AudioManager.play('splash');
  }

  // ── Viento e hipnosis (GDD §4.8, §6.3) ────────────────────────────────────

  /** Las ráfagas suman velocidad horizontal mientras Kerana está dentro de la zona. */
  private updateWind(deltaMs: number, body: Phaser.Physics.Arcade.Body): void {
    let vx = 0;
    for (const zone of this.windZones) {
      zone.update(deltaMs);
      vx += zone.pushFor(body.center.x, body.center.y);
    }
    this.player.motor.windVx = vx;
  }

  private onWindPhase(zone: WindZone): void {
    const view = this.cameras.main.worldView;
    if (Phaser.Geom.Rectangle.Overlaps(view, zone.zone)) AudioManager.play('wind');
  }

  private hypnotizePlayer(): void {
    if (DEBUG.god) return;
    if (this.player.status.applyHypnosis(GAMEPLAY.hypnosis.durationMs)) AudioManager.play('hypnosis');
  }

  private updateHypnosisIcon(deltaMs: number): void {
    const icon = this.hypnosisIcon;
    if (!icon) return;
    const on = this.player.status.hypnotized;
    icon.setVisible(on);
    if (!on) return;
    icon.setPosition(this.player.x, this.player.y - GAMEPLAY.hypnosis.iconOffsetY);
    icon.angle += (GAMEPLAY.hypnosis.iconSpinDegPerS * deltaMs) / 1000;
    // Tinte iridiscente que va cambiando (el aviso no depende solo del color: la espiral gira).
    icon.setTint(Phaser.Display.Color.HSVToRGB((this.time.now / 1500) % 1, 0.6, 1).color);
  }

  /** Espiral blanca por código (placeholder del icono de hipnosis). */
  private makeSpiralTexture(): string {
    const key = 'fx_spiral';
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.lineStyle(2, 0xffffff);
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const r = 1 + a * 1.1;
      const x = 10 + Math.cos(a) * r;
      const y = 10 + Math.sin(a) * r;
      if (a === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
    g.generateTexture(key, 20, 20);
    g.destroy();
    return key;
  }

  // ── Sueño de siesta y abejas (GDD §4.8, §6.4) ─────────────────────────────

  /** Niebla del sueño: quieta adentro, Kerana bosteza y se duerme. */
  private updateSleep(body: Phaser.Physics.Arcade.Body): void {
    this.player.inSleepFog = this.fogZones.some((z) => z.contains(body.center.x, body.center.y));
    const event = this.player.sleepEvent;
    if (event === 'yawn') AudioManager.play('yawn');
    const icon = this.sleepIcon;
    if (!icon) return;
    const status = this.player.status;
    const on = status.asleep || status.drowsy;
    icon.setVisible(on);
    if (!on) return;
    const bob = Math.sin(this.time.now / 250) * 2;
    icon.setPosition(this.player.x + 6, this.player.y - GAMEPLAY.sleep.iconOffsetY + bob).setAlpha(status.asleep ? 1 : 0.45);
  }

  /** Nubes lilas que van y vienen dentro de la zona (placeholder de la niebla). */
  private addFog(zone: Phaser.Geom.Rectangle): void {
    this.fogZones.push(zone);
    const tile = this.map.tileWidth;
    for (let x = zone.left; x < zone.right; x += tile * 2) {
      for (let y = zone.top + tile / 2; y < zone.bottom; y += tile * 1.5) {
        const puff = this.add.ellipse(x + tile, y, tile * 3, tile * 1.6, FOG_COLOR, GAMEPLAY.sleep.fogAlpha).setDepth(11);
        this.tweens.add({
          targets: puff,
          x: x + tile + Phaser.Math.Between(-6, 6),
          alpha: GAMEPLAY.sleep.fogAlpha * 0.5,
          duration: GAMEPLAY.sleep.fogDriftMs + Phaser.Math.Between(0, 800),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  /**
   * Enemigo que llama el jefe (enjambre de Jasy Jatere, kuati y ka'i de Kurupi). Los enjambres
   * persiguen enseguida y se van al dispersarse. `max`: cuántos llamados puede haber vivos a la vez.
   */
  private spawnBossMinion(kind: string, x: number, y: number, max: number): void {
    if (!this.fighting) return;
    this.pruneEnemies();
    this.bossMinions = this.bossMinions.filter((e) => e.active && !e.purified);
    if (this.bossMinions.length >= max) return;
    const facing: 1 | -1 = this.player.x >= x ? 1 : -1;
    const minion = createEnemy(this, kind, x, y, facing, true);
    this.glowEnemyParts(minion);
    // En el lugar: el overlap guarda la referencia a este arreglo.
    this.enemies.push(minion);
    this.bossMinions.push(minion);
  }

  private clearBossMinions(): void {
    for (const minion of this.bossMinions) if (minion.active && !minion.purified) minion.purify();
    this.bossMinions = [];
  }

  // ── Selva: hongos, ramas y frutas (GDD §6.5) ─────────────────────────────

  /** Hongos que rebotan al pisarlos; ramas que crujen y se quiebran. */
  private updateJungle(deltaMs: number, body: Phaser.Physics.Arcade.Body): void {
    for (const b of this.bouncers) {
      if (!b.isStoodOn(body)) continue;
      this.player.motor.bounce(GAMEPLAY.jungle.bounceVelocity);
      b.squash();
      AudioManager.play('bounce');
    }
    for (const c of this.crumbles) c.update(deltaMs, c.isStoodOn(body));
  }

  /** Frutas de los ka'i (y otros proyectiles de enemigos) que tocan a Kerana. */
  private updateProjectiles(): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      if (enemy.projectileHits(this.playerRect)) this.hurtPlayer(enemy.x);
    }
  }

  /** Quita del arreglo los enemigos ya destruidos (en el lugar: los overlaps guardan la referencia). */
  private pruneEnemies(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) if (!this.enemies[i].active) this.enemies.splice(i, 1);
  }

  /** Fase 3 de Mbói Tu'i: los camalotes de la arena se hunden y reaparecen solos, desfasados. */
  private setArenaPlatformsCycling(on: boolean): void {
    const rect = this.arenaRect;
    if (!rect) return;
    let i = 0;
    for (const sinker of this.sinkers) {
      if (!rect.contains(sinker.zone.centerX, sinker.zone.centerY)) continue;
      if (on) sinker.motor.setAutoCycle(true, i++ * GAMEPLAY.mboiTui.platformCycleOffsetMs);
      else sinker.reset();
    }
  }

  /** Flor (yvoty) que cae despacio y cura (fase 3 de Mbói Tu'i). */
  private spawnHealFlower(x: number, topY: number): void {
    const alive = this.pickups.filter((p) => p.kind === 'yvoty' && p.active && p.body.enable).length;
    if (alive >= GAMEPLAY.mboiTui.flowerMax) return;
    const groundY = this.surfaceBelow(x, topY) ?? this.map.heightInPixels;
    const flower = new Pickup(this, x, topY + this.map.tileHeight, 'yvoty');
    this.tweens.killTweensOf(flower);
    this.tweens.add({ targets: flower, y: groundY, duration: GAMEPLAY.mboiTui.flowerFallMs, ease: 'Sine.easeOut' });
    this.pickups.push(flower);
  }

  private clearFlowers(): void {
    // En el lugar: el overlap de los objetos guarda la referencia a este arreglo.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (p.kind !== 'yvoty' && p.active) continue;
      if (p.active) p.destroy();
      this.pickups.splice(i, 1);
    }
  }

  /** El tajo rompe lianas; las rocas agrietadas solo con el tajo cargado (GDD §3.7). */
  private updateBreakables(): void {
    if (!this.player.motor.attackHitboxActive) return;
    const rect = this.player.attackRect;
    for (const b of this.breakables) {
      if (b.broken || this.player.hasHitThisSwing(b) || !Phaser.Geom.Rectangle.Overlaps(b.zone, rect)) continue;
      this.player.markHitThisSwing(b);
      if (b.needsCharge && !this.player.motor.chargedSwing) {
        AudioManager.play('hit');
        continue;
      }
      b.hitsLeft -= 1;
      if (b.hitsLeft > 0) {
        AudioManager.play('hit');
        continue;
      }
      this.breakBreakable(b);
    }
  }

  private breakBreakable(b: Breakable): void {
    b.broken = true;
    if (b.block) {
      b.block.destroy();
    } else {
      const ground = this.layers.Ground;
      const tile = this.map.tileWidth;
      for (let y = b.zone.top; y < b.zone.bottom; y += tile) {
        for (let x = b.zone.left; x < b.zone.right; x += tile) ground?.removeTileAtWorldXY(x + 1, y + 1);
      }
    }
    this.dust.emitParticleAt(b.zone.centerX, b.zone.centerY, 10);
    AudioManager.play('rockBreak');
    this.shake(80, 0.004);
  }

  /** Daño por contacto de un peligro o ataque de jefe (1 corazón). Devuelve si se aplicó. */
  private hurtPlayer(fromX: number): boolean {
    const applied = this.player.takeDamage(GAMEPLAY.damage.enemyContact, fromX);
    if (!applied) return false;
    AudioManager.play('hurt');
    this.hitStop(GAMEPLAY.hitStop.onHurtMs);
    this.shake(80, 0.006);
    EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
    if (this.player.health.isDead) this.koRespawn();
    return true;
  }

  /** Sacudida de cámara si las opciones lo permiten (GDD §4.9). */
  private shake(ms: number, intensity: number): void {
    if (SaveManager.current.settings.shake) this.cameras.main.shake(ms, intensity);
  }

  private makeFxParticle(): void {
    if (this.textures.exists(FX_PARTICLE)) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff).fillRect(0, 0, 3, 3);
    g.generateTexture(FX_PARTICLE, 3, 3);
    g.destroy();
  }

  private updateLevelExit(): void {
    if (this.levelExitZone && Phaser.Geom.Rectangle.Overlaps(this.levelExitZone, this.playerRect)) this.completeLevel();
  }

  /** Fin de nivel (GDD §8.8): diálogo de liberación si hay jefe, guardado y pantalla de nivel completado. */
  private completeLevel(): void {
    if (this.completing) return;
    this.completing = true;
    this.physics.world.pause();
    const lines = liberationDialogue(this.def.id);
    if (lines.length > 0) this.dialogueBox.show(lines, () => this.finishLevel());
    else this.finishLevel();
  }

  /** Guarda (plumas, jefe liberado, don) y pasa a la pantalla de nivel completado. */
  private finishLevel(): void {
    this.completing = true;
    SaveManager.setFeatherCount(this.def.id, this.feathers);
    if (this.def.order > 0) SaveManager.completeLevel(this.def);
    this.scene.start('LevelComplete', { level: this.def });
  }

  private updateLuzArasyHud(): void {
    const active = this.player.isImmune;
    if (active) EventBus.emit(GameEvents.luzArasyChanged, true, this.player.luzArasyFraction);
    else if (this.wasImmune) EventBus.emit(GameEvents.luzArasyChanged, false, 0);
    this.wasImmune = active;
  }

  private buildMap(): void {
    this.map = this.make.tilemap({ key: this.def.mapKey });
    const tsName = this.map.tilesets[0]?.name ?? this.def.biome;
    const tileset = this.map.addTilesetImage(tsName, tilesetKey(this.def.biome));
    if (!tileset) throw new Error(`Tileset no encontrado: ${tsName}`);
    for (const name of TILE_LAYERS) {
      if (this.map.getLayerIndex(name) === null) continue;
      const layer = this.map.createLayer(name, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer | null;
      if (layer) this.layers[name] = layer;
    }
    this.layers.Ground?.setCollisionByExclusion([-1]);
    const platforms = this.layers.Platforms;
    if (platforms) {
      platforms.setCollisionByExclusion([-1]);
      // Un solo sentido: solo colisionan desde arriba.
      platforms.forEachTile((tile) => {
        if (tile.index !== -1) tile.setCollision(false, false, true, false);
      });
    }
    // Sin borde inferior: se puede caer al pozo.
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.physics.world.setBoundsCollision(true, true, false, false);
  }

  /** Crea checkpoints, carteles, enemigos y objetos; devuelve el punto de inicio (pies). */
  private buildObjects(): Phaser.Math.Vector2 {
    const spawn = new Phaser.Math.Vector2(32, 32);
    const objects = this.map.getObjectLayer('Objects')?.objects ?? [];
    for (const obj of objects) {
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      switch (objectClass(obj)) {
        case 'PlayerSpawn':
          spawn.set(x, y);
          break;
        case 'Checkpoint': {
          const sprite = this.add.sprite(x, y, 'checkpoint', 0).setOrigin(0.5, 1);
          const id = Number(objectProp(obj, 'id') ?? this.checkpoints.length);
          const zone = new Phaser.Geom.Rectangle(x - 8, y - 24, 16, 24);
          const lc = GAMEPLAY.lantern;
          const light = this.darkness?.addLight(x, y - 12, lc.radius, lc.color, lc.intensity, false);
          this.checkpoints.push({ id, sprite, zone, active: false, lit: false, light });
          break;
        }
        case 'Lantern':
          if (this.darkness) this.lanterns.push(new Lantern(this, x, y, this.darkness, objectProp(obj, 'lit') === true));
          break;
        case 'DarkZone':
          this.darkness?.addZone({ x, y, width: Number(obj.width ?? 16), height: Number(obj.height ?? 16) });
          break;
        case 'Sign': {
          this.add.image(x, y, 'sign').setOrigin(0.5, 1);
          const text = this.add
            .text(x, y - 48, t(String(objectProp(obj, 'textKey') ?? ''), this.keyVars()), TEXT_STYLE)
            .setOrigin(0.5, 1)
            .setDepth(20)
            .setVisible(false);
          const zone = new Phaser.Geom.Rectangle(x - SIGN_RANGE, y - 32, SIGN_RANGE * 2, 32);
          this.signs.push({ zone, text });
          break;
        }
        case 'Enemy': {
          const kind = String(objectProp(obj, 'kind') ?? 'walker');
          const facing: 1 | -1 = objectProp(obj, 'facing') === 'right' ? 1 : -1;
          if (kind === 'vaca') {
            this.cows.push(this.makeCow(x, y, facing));
            break;
          }
          const enemy = createEnemy(this, kind, x, y, facing);
          this.glowEnemyParts(enemy);
          if (enemy.def.purifiesInto === 'vaca') enemy.onPurified = (e) => this.cowFromEnemy(e);
          this.enemies.push(enemy);
          break;
        }
        case 'Pindo': {
          const w = Number(obj.width ?? 16);
          const h = Number(obj.height ?? 16);
          this.addPindo(new Phaser.Geom.Rectangle(x, y, w, h));
          break;
        }
        case 'Pickup': {
          const kind = String(objectProp(obj, 'kind') ?? 'guavira') as PickupKind;
          this.pickups.push(new Pickup(this, x, y, kind));
          break;
        }
        case 'Breakable': {
          const zone = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          const isLiana = objectProp(obj, 'kind') === 'liana';
          const b: Breakable = { zone, needsCharge: !isLiana, hitsLeft: isLiana ? GAMEPLAY.breakable.lianaHits : 1, broken: false };
          if (isLiana) {
            b.block = this.add.rectangle(zone.x + zone.width / 2 - 3, zone.y, 6, zone.height, LIANA_COLOR).setOrigin(0, 0).setDepth(3);
            this.physics.add.existing(b.block, true);
          }
          this.breakables.push(b);
          break;
        }
        case 'FallingHazard': {
          // El punto marca el tile que cuelga del techo: la estalactita empieza en su borde superior.
          const tile = this.map.tileHeight;
          const warnMs = Number(objectProp(obj, 'delayMs') ?? GAMEPLAY.fallingHazard.warnMs);
          const rawKind = objectProp(obj, 'kind');
          const kind: FallingKind = rawKind === 'teja' || rawKind === 'roca' ? rawKind : 'stalactite';
          this.spawnFalling(x, y - tile, false, warnMs, kind);
          break;
        }
        case 'BossArena': {
          this.arenaRect = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 0), Number(obj.height ?? 0));
          const boss = objectProp(obj, 'boss');
          this.arenaBossId = (typeof boss === 'string' ? boss : this.def.boss ?? undefined) as BossId | undefined;
          break;
        }
        case 'Sinking': {
          const zone = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          this.sinkers.push(new Sinking(this, zone, (state) => state === 'sunk' && AudioManager.play('sink')));
          break;
        }
        case 'ShallowWater': {
          const zone = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          const depth = GAMEPLAY.water.shallowDepthPx;
          this.add.rectangle(zone.x, zone.bottom - depth, zone.width, depth, SHALLOW_COLOR, 0.55).setOrigin(0, 0).setDepth(11);
          this.shallowZones.push(zone);
          break;
        }
        case 'WindZone': {
          const zone = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          const dir: 1 | -1 = Number(objectProp(obj, 'dir') ?? 1) < 0 ? -1 : 1;
          const speed = Number(objectProp(obj, 'speed') ?? GAMEPLAY.wind.speed);
          const offsetMs = Number(objectProp(obj, 'offsetMs') ?? 0);
          this.windZones.push(new WindZone(this, zone, dir, speed, offsetMs, (phase, z) => phase === 'gust' && this.onWindPhase(z)));
          break;
        }
        case 'Bouncer':
          this.bouncers.push(new Bouncer(this, new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16))));
          break;
        case 'Crumble': {
          const zone = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          this.crumbles.push(new Crumble(this, zone, (state) => state !== 'solid' && AudioManager.play(state === 'cracking' ? 'creak' : 'rockBreak')));
          break;
        }
        case 'Fireflies':
          this.addFireflies(new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16)));
          break;
        case 'SleepFog':
          this.addFog(new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16)));
          break;
        case 'LevelExit': {
          const w = Number(obj.width ?? 0);
          const h = Number(obj.height ?? 0);
          this.levelExitZone = new Phaser.Geom.Rectangle(x, y, w, h);
          break;
        }
        default:
          // Jefes y zonas especiales llegan en sesiones posteriores.
          break;
      }
    }
    return spawn;
  }

  private keyVars(): Record<string, string> {
    return {
      left: this.inputs.label('left'),
      right: this.inputs.label('right'),
      jump: this.inputs.label('jump'),
      attack: this.inputs.label('attack'),
      dash: this.inputs.label('dash'),
    };
  }

  /** Hilera de luciérnagas que parpadean (decorativas): insinúan un secreto cerca. */
  private addFireflies(zone: Phaser.Geom.Rectangle): void {
    const fc = GAMEPLAY.fireflies;
    const count = Math.max(1, Math.round((zone.width / this.map.tileWidth) * fc.perTile));
    for (let i = 0; i < count; i++) {
      const fx = zone.x + ((i + 0.5) / count) * zone.width;
      const fy = zone.y + Math.random() * zone.height;
      const dot = this.add.circle(fx, fy, fc.radius, fc.color).setDepth(fc.depth);
      this.darkness?.glow(dot);
      this.tweens.add({
        targets: dot,
        alpha: { from: 1, to: 0.15 },
        y: fy - fc.drift,
        duration: fc.blinkMs,
        delay: Math.random() * fc.blinkMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private tileAt(layer: TileLayerName, x: number, y: number): boolean {
    const tile = this.layers[layer]?.getTileAtWorldXY(x, y);
    return !!tile && tile.index !== -1;
  }

  private isSolidAt(x: number, y: number): boolean {
    return this.tileAt('Ground', x, y) || this.tileAt('Platforms', x, y);
  }

  private touchesHazard(body: Phaser.Physics.Arcade.Body): boolean {
    const inset = 3;
    const feetY = body.bottom - 2;
    return (
      this.tileAt('Hazards', body.left + inset, feetY) ||
      this.tileAt('Hazards', body.right - inset, feetY) ||
      this.tileAt('Hazards', body.center.x, body.center.y)
    );
  }

  /** Guarda la posición si Kerana pisa suelo firme con ambos pies y sin peligros al lado. */
  private trackSafeGround(body: Phaser.Physics.Arcade.Body): void {
    if (!body.blocked.down) return;
    const tile = this.map.tileWidth;
    const below = body.bottom + 1;
    const feetY = body.bottom - 2;
    if (!this.isSolidAt(body.left + 1, below) || !this.isSolidAt(body.right - 1, below)) return;
    if (this.tileAt('Hazards', body.left - tile, feetY) || this.tileAt('Hazards', body.right + tile, feetY)) return;
    this.safeGround.set(body.center.x, body.bottom);
  }

  private respawn(reason: RespawnReason): void {
    const applied = this.player.takeDamage(GAMEPLAY.damage[reason], this.player.x, reason !== 'hazard');
    if (applied) {
      AudioManager.play('hurt');
      this.hitStop(GAMEPLAY.hitStop.onHurtMs);
    }
    if (this.player.health.isDead) this.koRespawn();
    else this.player.respawnAt(this.safeGround.x, this.safeGround.y);
    EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
    EventBus.emit(GameEvents.playerRespawned, reason);
  }

  /** 0 corazones (GDD §3.6): "Kerana cae" y reaparece en el último fuego con vida completa. */
  private koRespawn(): void {
    this.resetBossFight();
    if (SaveManager.current.settings.flashes) this.cameras.main.flash(300, 0, 0, 0);
    this.player.koRespawn(this.checkpointPos.x, this.checkpointPos.y);
  }

  private updateEnemies(deltaMs: number): void {
    for (const enemy of this.enemies) {
      if (enemy.purified || !enemy.active) continue;
      enemy.updateBehavior(deltaMs, this.player.x - enemy.x, this.player.y - enemy.y);
    }
  }

  private onAttackHit(_hitbox: unknown, enemyObj: unknown): void {
    const enemy = enemyObj as EnemyBase;
    if (enemy.purified || this.player.hasHitThisSwing(enemy)) return;
    this.player.markHitThisSwing(enemy);
    // En la oscuridad el sable atraviesa al póra.
    if (!enemy.vulnerable) return;
    enemy.hit(this.player.attackDamage, this.player.motor.facing);
    this.hitStop(GAMEPLAY.hitStop.onHitMs);
    AudioManager.play(enemy.purified ? 'purify' : 'hit');
  }

  private onPlayerTouchEnemy(_playerObj: unknown, enemyObj: unknown): void {
    const enemy = enemyObj as EnemyBase;
    if (enemy.purified) return;
    if (this.player.isImmune) {
      enemy.purify();
      AudioManager.play('purify');
      return;
    }
    if (enemy.touchHurts) this.hurtPlayer(enemy.x);
  }

  private onPickupOverlap(_playerObj: unknown, pickupObj: unknown): void {
    const pickup = pickupObj as Pickup;
    switch (pickup.kind) {
      case 'guavira':
        if (this.player.heal(GAMEPLAY.pickups.guaviraHeal) > 0) AudioManager.play('heal');
        EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
        break;
      case 'yvoty':
        if (this.player.heal(GAMEPLAY.mboiTui.flowerHeal) > 0) AudioManager.play('heal');
        EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
        break;
      case 'luz_arasy':
        this.player.activateLuzArasy();
        AudioManager.play('luzArasy');
        break;
      case 'pluma':
        this.feathers = Math.min(GAMEPLAY.hud.featherMax, this.feathers + 1);
        EventBus.emit(GameEvents.feathersChanged, this.feathers, GAMEPLAY.hud.featherMax);
        AudioManager.play('feather');
        break;
    }
    pickup.collect();
  }

  private updateCheckpoints(): void {
    for (const cp of this.checkpoints) {
      if (cp.active || !Phaser.Geom.Rectangle.Overlaps(cp.zone, this.playerRect)) continue;
      for (const other of this.checkpoints) {
        other.active = false;
        other.sprite.setFrame(other.lit ? 4 : 0);
      }
      cp.active = true;
      cp.sprite.setFrame(4);
      if (cp.light && this.darkness) {
        this.darkness.setOn(cp.light, true);
        this.darkness.glow(cp.sprite);
      }
      this.checkpointPos.set(cp.zone.centerX, cp.zone.bottom);
      if (!cp.lit) {
        cp.lit = true;
        if (this.player.heal(1) > 0) EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
      }
      AudioManager.play('fire');
      EventBus.emit(GameEvents.checkpointActivated, cp.id);
    }
  }

  private updateSigns(): void {
    for (const sign of this.signs) sign.text.setVisible(Phaser.Geom.Rectangle.Overlaps(sign.zone, this.playerRect));
  }

  /** Congela la acción un instante para dar peso al golpe (GDD §4.1). */
  private hitStop(ms: number): void {
    this.physics.world.pause();
    this.time.delayedCall(ms, () => this.physics.world.resume());
  }

  private reportPlayerStateSfx(): void {
    const state = this.player.motor.state;
    if (state === this.lastPlayerState) return;
    if (state === 'jump') AudioManager.play('jump');
    else if (state === 'dash') AudioManager.play('dash');
    else if ((state === 'idle' || state === 'run') && this.lastPlayerState === 'fall') AudioManager.play('land');
    else if (state === 'attack') {
      const charged = this.player.motor.chargedSwing;
      AudioManager.play(charged ? 'chargedSlash' : 'slash');
      if (charged) this.fireLightWave();
    }
    this.lastPlayerState = state;
  }

  private updateDebugText(): void {
    const body = this.player.body;
    this.debugText?.setText([
      t('debug.fps', { fps: Math.round(this.game.loop.actualFps) }),
      t('debug.state', { state: this.player.motor.state }),
      t('debug.velocity', { vx: Math.round(body.velocity.x), vy: Math.round(body.velocity.y) }),
      t('debug.ground', { ground: `${Math.round(this.safeGround.x)}, ${Math.round(this.safeGround.y)}` }),
      t('debug.hearts', { current: this.player.health.current, max: this.player.health.max }),
    ]);
  }
}

function isGroundedEnemy(obj: unknown): boolean {
  return (obj as EnemyBase).collidesWithGround ?? true;
}
