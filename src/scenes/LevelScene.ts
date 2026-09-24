import Phaser from 'phaser';
import { tilesetKey } from '../assets/manifest';
import { DEBUG } from '../config/debug';
import { FONT_FAMILY } from '../config/fonts';
import { GAMEPLAY } from '../config/gameplay';
import { liberationDialogue } from '../data/dialogues';
import { getLevel } from '../data/levels';
import type { BossId, LevelDef, LevelId } from '../data/types';
import { createBoss, type Boss, type BossContext } from '../entities/bosses';
import { createEnemy } from '../entities/enemies';
import type { EnemyBase } from '../entities/enemies/EnemyBase';
import { FallingHazard } from '../entities/hazards/FallingHazard';
import { Player } from '../entities/Player';
import { Pickup, type PickupKind } from '../entities/pickups/Pickup';
import type { PlayerStateName } from '../entities/PlayerMotor';
import { t } from '../i18n';
import { AudioManager } from '../systems/AudioManager';
import { BossArena } from '../systems/BossArena';
import { CameraController } from '../systems/CameraController';
import { DialogueBox } from '../systems/DialogueBox';
import { EventBus, GameEvents } from '../systems/EventBus';
import { InputManager } from '../systems/InputManager';
import { playLiberation } from '../systems/LiberationSequence';
import { SaveManager } from '../systems/SaveManager';
import type { SfxKey } from '../systems/sfxPresets';
import { ensurePlaceholder } from '../utils/placeholder';

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
const LIANA_COLOR = 0x3f7a3a;
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
    this.arenaRect = undefined;
    this.arenaBossId = undefined;
    this.arena = undefined;
    this.boss = undefined;
    this.fighting = false;
    this.cutscene = false;
  }

  create(): void {
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
    this.buildMap();
    const spawn = this.buildObjects();
    if (DEBUG.boss) this.spawnAtLastCheckpoint(spawn);

    const save = SaveManager.current;
    this.player = new Player(this, spawn.x, spawn.y, {
      assist: save.settings.assist,
      maxHearts: save.maxHearts,
      chargedSlash: DEBUG.giftsAll || save.gifts.includes('charged_slash'),
      god: DEBUG.god,
    });
    this.safeGround.copy(spawn);
    this.checkpointPos.copy(spawn);
    ensurePlaceholder(this, 'mainumby_placeholder', 8, 8);
    this.mainumby = this.add.image(spawn.x, spawn.y - 40, 'mainumby_placeholder').setDepth(15);
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
      this.debugText = this.add
        .text(4, this.scale.height - 4, '', { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#F2C14E' })
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
    this.updateMainumby();

    const body = this.player.body;
    this.playerRect.setTo(body.x, body.y, body.width, body.height);

    if (body.top > this.map.heightInPixels + GAMEPLAY.respawn.pitMargin) this.respawn('pit');
    else if (this.tileAt('Water', body.center.x, body.center.y)) this.respawn('water');
    else if (this.touchesHazard(body)) this.respawn('hazard');
    else this.trackSafeGround(body);

    this.updateFallingHazards(delta);
    this.updateBreakables();
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
      spawnFalling: (x) => {
        if (this.fighting) this.spawnFalling(x, rect.top, true);
      },
      sfx: (key: SfxKey) => AudioManager.play(key),
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
        if (result.defeated) {
          this.startLiberation();
          return;
        }
        this.hitStop(GAMEPLAY.hitStop.onHitMs);
      }
    }
    if (boss.hurtsPlayer(this.playerRect)) this.hurtPlayer(boss.markPosition(this.tmpVec).x);
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
  }

  private startLiberation(): void {
    const boss = this.boss!;
    this.cutscene = true;
    this.fighting = false;
    this.clearOneShotHazards();
    EventBus.emit(GameEvents.bossBarHide);
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

  private spawnFalling(x: number, ceilingY: number, oneShot: boolean, warnMs?: number): void {
    const groundY = this.surfaceBelow(x, ceilingY) ?? this.map.heightInPixels;
    this.fallingHazards.push(
      new FallingHazard(this, x, ceilingY, groundY, this.dust, { oneShot, warnMs, onShatter: () => AudioManager.play('rockBreak') }),
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

  /** Daño por contacto de un peligro o ataque de jefe (1 corazón). */
  private hurtPlayer(fromX: number): void {
    const applied = this.player.takeDamage(GAMEPLAY.damage.enemyContact, fromX);
    if (!applied) return;
    AudioManager.play('hurt');
    this.hitStop(GAMEPLAY.hitStop.onHurtMs);
    this.shake(80, 0.006);
    EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
    if (this.player.health.isDead) this.koRespawn();
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
          this.checkpoints.push({ id, sprite, zone, active: false, lit: false });
          break;
        }
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
          this.enemies.push(createEnemy(this, kind, x, y, facing));
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
          this.spawnFalling(x, y - tile, false, warnMs);
          break;
        }
        case 'BossArena': {
          this.arenaRect = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 0), Number(obj.height ?? 0));
          const boss = objectProp(obj, 'boss');
          this.arenaBossId = (typeof boss === 'string' ? boss : this.def.boss ?? undefined) as BossId | undefined;
          break;
        }
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
    };
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
    const applied = this.player.takeDamage(GAMEPLAY.damage[reason], this.player.x);
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
      if (enemy.purified) continue;
      enemy.updateBehavior(deltaMs, this.player.x - enemy.x, this.player.y - enemy.y);
    }
  }

  private onAttackHit(_hitbox: unknown, enemyObj: unknown): void {
    const enemy = enemyObj as EnemyBase;
    if (enemy.purified || this.player.hasHitThisSwing(enemy)) return;
    this.player.markHitThisSwing(enemy);
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
    this.hurtPlayer(enemy.x);
  }

  private onPickupOverlap(_playerObj: unknown, pickupObj: unknown): void {
    const pickup = pickupObj as Pickup;
    switch (pickup.kind) {
      case 'guavira':
        if (this.player.heal(GAMEPLAY.pickups.guaviraHeal) > 0) AudioManager.play('heal');
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
    else if ((state === 'idle' || state === 'run') && this.lastPlayerState === 'fall') AudioManager.play('land');
    else if (state === 'attack') AudioManager.play(this.player.motor.chargedSwing ? 'chargedSlash' : 'slash');
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
  return (obj as EnemyBase).def?.archetype !== 'flyer';
}
