import Phaser from 'phaser';
import { tilesetKey } from '../assets/manifest';
import { DEBUG } from '../config/debug';
import { FONT_FAMILY } from '../config/fonts';
import { GAMEPLAY } from '../config/gameplay';
import { liberationDialogue } from '../data/dialogues';
import { getLevel } from '../data/levels';
import type { LevelDef, LevelId } from '../data/types';
import { createEnemy } from '../entities/enemies';
import type { EnemyBase } from '../entities/enemies/EnemyBase';
import { Player } from '../entities/Player';
import { Pickup, type PickupKind } from '../entities/pickups/Pickup';
import type { PlayerStateName } from '../entities/PlayerMotor';
import { t } from '../i18n';
import { AudioManager } from '../systems/AudioManager';
import { CameraController } from '../systems/CameraController';
import { DialogueBox } from '../systems/DialogueBox';
import { EventBus, GameEvents } from '../systems/EventBus';
import { InputManager } from '../systems/InputManager';
import { SaveManager } from '../systems/SaveManager';
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
    this.buildMap();
    const spawn = this.buildObjects();

    this.player = new Player(this, spawn.x, spawn.y, SaveManager.current.settings.assist);
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
      window.__KERANA_DEBUG__ = { scene: this, player: this.player, safeGround: this.safeGround };
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

  private updateLevelExit(): void {
    if (this.levelExitZone && Phaser.Geom.Rectangle.Overlaps(this.levelExitZone, this.playerRect)) this.completeLevel();
  }

  /** Fin de nivel (GDD §8.8): diálogo de liberación si hay jefe, guardado y pantalla de nivel completado. */
  private completeLevel(): void {
    if (this.completing) return;
    this.completing = true;
    this.physics.world.pause();
    SaveManager.setFeatherCount(this.def.id, this.feathers);
    const finish = (): void => {
      if (this.def.order > 0) SaveManager.completeLevel(this.def);
      this.scene.start('LevelComplete', { level: this.def });
    };
    const lines = liberationDialogue(this.def.id);
    if (lines.length > 0) this.dialogueBox.show(lines, finish);
    else finish();
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
    this.cameras.main.flash(300, 0, 0, 0);
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
    enemy.hit(GAMEPLAY.attack.damage, this.player.motor.facing);
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
    const applied = this.player.takeDamage(GAMEPLAY.damage.enemyContact, enemy.x);
    if (!applied) return;
    AudioManager.play('hurt');
    this.hitStop(GAMEPLAY.hitStop.onHurtMs);
    this.cameras.main.shake(80, 0.006);
    EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
    if (this.player.health.isDead) this.koRespawn();
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
    else if (state === 'attack') AudioManager.play('slash');
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
