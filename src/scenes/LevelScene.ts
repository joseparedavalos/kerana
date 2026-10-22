import Phaser from 'phaser';
import { artOrPlaceholder, hasArt } from '../assets/art';
import { addProp, propLook, propNames } from '../assets/propArt';
import { layoutShowcase } from '../assets/propLayout';
import { ART_DETAIL, PROP_ATLASES, tilesetKey } from '../assets/manifest';
import { DEBUG } from '../config/debug';
import { FONT_FAMILY } from '../config/fonts';
import { GAMEPLAY } from '../config/gameplay';
import { liberationDialogue } from '../data/dialogues';
import { getLevel, WORLD_LEVELS } from '../data/levels';
import { bossTrack, levelTrack } from '../data/music';
import { endingSlides } from '../data/story';
import type { BossId, LevelDef, LevelId } from '../data/types';
import { createBoss, type Boss, type BossContext } from '../entities/bosses';
import { onRefuge, refugeUnder, type Refuge } from '../entities/bosses/aoAoLogic';
import { panFor } from '../entities/bosses/jasyLogic';
import { Cow } from '../entities/Cow';
import { createEnemy } from '../entities/enemies';
import { Diver } from '../entities/enemies/Diver';
import { Lurker } from '../entities/enemies/Lurker';
import { rhythmFromMovers } from '../entities/enemies/LurkerMotor';
import type { EnemyBase } from '../entities/enemies/EnemyBase';
import { drawBreakables, needsChargedSlash, parseBreakableKind, type BreakableKind } from '../entities/BreakableLook';
import { Bouncer } from '../entities/hazards/Bouncer';
import { parseBouncerKind } from '../entities/hazards/BouncerMotor';
import { Crumble } from '../entities/hazards/Crumble';
import { FallingHazard, type FallingKind } from '../entities/hazards/FallingHazard';
import { Sinking } from '../entities/hazards/Sinking';
import { WindZone } from '../entities/hazards/WindZone';
import { Lantern, type LanternMount } from '../entities/Lantern';
import { LightWaveMotor } from '../entities/LightWaveMotor';
import { Gate } from '../entities/Gate';
import { OfferingDoor } from '../entities/OfferingDoor';
import { Mover } from '../entities/Mover';
import type { MoverMode } from '../entities/MoverMotor';
import { Switch } from '../entities/Switch';
import { SwitchBoard, swordStrikes, waveStrikes } from '../entities/SwitchMotor';
import { Player } from '../entities/Player';
import { Pickup, type PickupKind } from '../entities/pickups/Pickup';
import type { PlayerStateName } from '../entities/PlayerMotor';
import { t } from '../i18n';
import { AudioManager } from '../systems/AudioManager';
import { BossArena } from '../systems/BossArena';
import { breakableGroups, restsOn } from '../systems/breakableLogic';
import { canReturnForChipas, chipaReturnTarget, OfferingMotor, offeringLineKey, offeringStartsOpen, type ChipaReturnPoint } from '../systems/offeringLogic';
import { findTraps, trapGridFromMap, trapReach, TrapWatch, type TrapObject } from '../systems/trapLogic';
import { CameraController } from '../systems/CameraController';
import { Chase } from '../systems/Chase';
import { Waterfall } from '../entities/Waterfall';
import { Darkness, type LevelLight } from '../systems/Darkness';
import { DialogueBox } from '../systems/DialogueBox';
import { EventBus, GameEvents } from '../systems/EventBus';
import { InputManager } from '../systems/InputManager';
import { TouchControls } from '../systems/TouchControls';
import { playLiberation } from '../systems/LiberationSequence';
import { SaveManager } from '../systems/SaveManager';
import type { SfxKey } from '../systems/sfxPresets';
import { ensurePlaceholder } from '../utils/placeholder';
import { fixedOffset, setupView, VIEW } from '../systems/View';
import { addYvagaSky } from '../systems/Backdrops';
import { cowPatrol } from '../systems/cowLogic';
import { isFloorTile, terrainAlpha, terrainDepths, terrainFloor } from '../systems/terrainLogic';
import { LevelBackdrop } from '../systems/LevelBackdrop';
import { hasSprite, spriteDetail } from '../systems/SpriteSkin';
import { queueBackgrounds } from '../assets/backgrounds';

type RespawnReason = 'pit' | 'water' | 'hazard' | 'trap' | 'chase';
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

/**
 * Roca agrietada (tiles de `Ground`, pide el tajo cargado), bloque frágil (tiles de `Ground`, tajo normal, S22)
 * o liana (objeto propio, tajo normal). Los de la misma clase que se tocan forman un bloque y caen juntos.
 */
interface Breakable {
  zone: Phaser.Geom.Rectangle;
  kind: BreakableKind;
  needsCharge: boolean;
  hitsLeft: number;
  /** Liana: rectángulo con cuerpo estático. Roca y fardo: undefined (son tiles). */
  block?: Phaser.GameObjects.Rectangle;
  /** El bloque entero (incluye a este) y su dibujo; se arman en `linkBreakables`. */
  group: Breakable[];
  look: Phaser.GameObjects.GameObject[];
  broken: boolean;
}

const FX_PARTICLE = 'fx_particle';
const SHALLOW_COLOR = 0x5aa6b8;
const FOG_COLOR = 0xc8b8e6;
const LIANA_COLOR = 0x3f7a3a;
const PINDO_TRUNK_COLOR = 0x7a6248;
const PINDO_LEAF_COLOR = 0x4f8a3a;
const SIGN_RANGE = 40;
/** Placeholders si falta el arte de raw/props: cartel (16 × 16) y fuego (16 × 24, cuadro 0 apagado y 4 encendido). */
const SIGN_PLACEHOLDER = 16;
const FIRE_PLACEHOLDER = 'checkpoint';
const FIRE_OFF = 'prop_fire_off';
const FIRE_ON = 'prop_fire_on';
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
  private touchControls?: TouchControls;
  private cameraCtl!: CameraController;
  private enemies: EnemyBase[] = [];
  private pickups: Pickup[] = [];
  private checkpoints: Checkpoint[] = [];
  private signs: Sign[] = [];
  private feathers = 0;
  /** Luz de Arasy de la arena (solo en modo asistido, GDD §4.7) y si ya se usó en este intento. */
  private arenaLuz?: Pickup;
  private arenaLuzUsed = false;
  private lastPlayerState: PlayerStateName = 'idle';
  private lastAirJumped = false;
  private wasImmune = false;
  private readonly safeGround = new Phaser.Math.Vector2();
  /** Red de seguridad (S23): 1 = piso encerrado (celda de los pies); el reloj corre mientras Kerana está en uno. */
  private trapCells?: Uint8Array;
  private readonly trapWatch = new TrapWatch();
  /** Objetos del mapa para recalcular los encierros cuando algo se abre (S39), y la raya roja de `?debug=1`. */
  private trapObjects: TrapObject[] = [];
  private trapGfx?: Phaser.GameObjects.Graphics;
  private readonly checkpointPos = new Phaser.Math.Vector2();
  private readonly playerRect = new Phaser.Geom.Rectangle();
  private debugText?: Phaser.GameObjects.Text;
  private levelExitZone?: Phaser.Geom.Rectangle;
  private dialogueBox!: DialogueBox;
  private mainumby?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  /** Brillo dorado detrás de Mainumby (solo con el sprite real). */
  private mainumbyGlow?: Phaser.GameObjects.Image;
  /** Posición de Mainumby sin el vaivén del vuelo. */
  private readonly mainumbyPos = new Phaser.Math.Vector2();
  private completing = false;
  private breakables: Breakable[] = [];
  private fallingHazards: FallingHazard[] = [];
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splashes!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Chispas del tajo normal y del cargado, y si ya salieron en este tajo. */
  private slashSparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private chargedSparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private slashSparked = false;
  private dashTrailMs = 0;
  private splashMs = 0;
  private sinkers: Sinking[] = [];
  /** Zonas de agua baja (GDD §4.8): frenan la carrera. */
  private shallowZones: Phaser.Geom.Rectangle[] = [];
  /** Zonas de viento (GDD §4.8, §6.3). */
  private windZones: WindZone[] = [];
  /** Espiral sobre Kerana mientras está hipnotizada (GDD §4.8). */
  private hypnosisIcon?: Phaser.GameObjects.Image;
  /** Espiral grande de la confusión de Moñái (S44). */
  private confusionSpiral?: Phaser.GameObjects.Graphics;
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
  /** Persecución de Ao Ao (S31): el tramo del mapa (`rect ChaseZone`), su controlador y la largada (adónde vuelve antes del primer pindó). */
  private chaseZone?: { rect: Phaser.Geom.Rectangle; speed: number };
  private chase?: Chase;
  private readonly chaseStart = new Phaser.Math.Vector2();
  /** Cascadas (S31): decoración delante de Kerana. */
  private waterfalls: Waterfall[] = [];
  /** Vacas sueltas de Capiatá: plataformas que caminan. */
  private cows: Cow[] = [];
  private cowGroup?: Phaser.Physics.Arcade.Group;
  /** Plataformas móviles, rejas y disparadores (S18). */
  private movers: Mover[] = [];
  private gates: Gate[] = [];
  /** S36: el paso de la ofrenda (cortina de raíces antes de la antesala) y adónde se vuelve a buscar cada chipa. */
  private offering?: { door: OfferingDoor; motor: OfferingMotor };
  private chipaReturns: ChipaReturnPoint[] = [];
  private switches: Switch[] = [];
  private switchBoard = new SwitchBoard();
  /** Cuerpos que pueden viajar sobre una plataforma móvil o una vaca (se arma en cada frame, sin asignar). */
  private readonly riderBodies: Phaser.Physics.Arcade.Body[] = [];
  private readonly gateBlockers: Phaser.Geom.Rectangle[] = [];
  /** Switch golpeados en este frame (arreglo reutilizado). */
  private readonly struck: Switch[] = [];
  private readonly struckLanterns: Lantern[] = [];
  /** Oscuridad del nivel 7 (GDD §4.8): solo en los niveles con `dark`. */
  private darkness?: Darkness;
  private backdrop!: LevelBackdrop;
  /** Faroles que se encienden al tocarlos (GDD §6.7). */
  private lanterns: Lantern[] = [];
  /** Onda de luz del tajo cargado (una sola en pantalla). */
  private readonly lightWave = new LightWaveMotor(GAMEPLAY.lightWave);
  /** La onda choca solo con la capa Ground (las plataformas de un sentido no la frenan). */
  // Los rompibles son tiles de Ground pero no frenan la onda: ella los rompe (S22).
  private readonly waveProbe = (x: number, y: number): boolean => this.tileAt('Ground', x, y) && !this.breakableAt(x, y);
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
    // Las plumas ya guardadas cuentan desde el principio: las recogidas no vuelven a aparecer.
    this.feathers = SaveManager.featherCount(this.def.id);
    this.arenaLuz = undefined;
    this.arenaLuzUsed = false;
    this.lastPlayerState = 'idle';
    this.lastAirJumped = false;
    this.levelExitZone = undefined;
    this.completing = false;
    this.breakables = [];
    this.fallingHazards = [];
    this.sinkers = [];
    this.shallowZones = [];
    this.windZones = [];
    this.hypnosisIcon = undefined;
    this.confusionSpiral = undefined;
    this.fogZones = [];
    this.sleepIcon = undefined;
    this.bossMinions = [];
    this.bouncers = [];
    this.crumbles = [];
    this.refuges = [];
    this.chaseZone = undefined;
    this.chase = undefined;
    this.waterfalls = [];
    this.cows = [];
    this.cowGroup = undefined;
    this.movers = [];
    this.gates = [];
    this.offering = undefined;
    this.chipaReturns = [];
    this.switches = [];
    this.switchBoard = new SwitchBoard();
    this.darkness = undefined;
    this.lanterns = [];
    this.lightWave.stop();
    this.lightWave.reachActive = false;
    this.lightWaveSprite = undefined;
    this.arenaRect = undefined;
    this.arenaBossId = undefined;
    this.arena = undefined;
    this.boss = undefined;
    this.fighting = false;
    this.cutscene = false;
  }

  /** Solo los fondos de este nivel (el resto de los assets ya cargó en Preload). */
  preload(): void {
    queueBackgrounds(this, [this.def.backgrounds.far, this.def.backgrounds.cave]);
  }

  create(): void {
    // Zoom antes de crear la caja de diálogo y el texto de depuración (usan fixedOffset).
    setupView(this, false);
    if (!this.cache.tilemap.exists(this.def.mapKey)) {
      console.warn(`[ASSET FALTANTE] ${this.def.mapKey}: corré "npm run maps".`);
      this.scene.start(this.def.order > 0 ? 'Map' : 'Title');
      return;
    }
    AudioManager.music(levelTrack(this.def.id));
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
    const sfx = GAMEPLAY.slashFx;
    this.slashSparks = this.add
      .particles(0, 0, FX_PARTICLE, {
        speed: { min: sfx.speed * 0.4, max: sfx.speed },
        lifespan: sfx.lifespanMs,
        scale: { start: sfx.scale, end: 0 },
        alpha: { start: sfx.alpha, end: 0 },
        tint: sfx.tint,
        emitting: false,
      })
      .setDepth(12);
    const juice = GAMEPLAY.juice;
    this.chargedSparks = this.add
      .particles(0, 0, FX_PARTICLE, {
        speed: { min: juice.chargedSpeed * 0.4, max: juice.chargedSpeed },
        lifespan: juice.chargedLifespanMs,
        scale: { start: juice.chargedScale, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xf2c14e, 0xfff2c0],
        emitting: false,
      })
      .setDepth(13);
    this.slashSparked = false;
    // Antes del mapa: todo lo que se cree desde acá recibe la luz (los textos y la caja de diálogo, no).
    if (this.def.dark) this.darkness = new Darkness(this);
    this.buildMap();
    this.backdrop = new LevelBackdrop(this, this.def.backgrounds, this.map.widthInPixels, this.map.heightInPixels);
    // El fondo no recibe la luz del nivel oscuro: se tiñe con el ambiente (la oscuridad sigue por encima).
    for (const img of this.backdrop.images) this.darkness?.glow(img);
    if (this.def.finale && !this.backdrop.hasImage) addYvagaSky(this, this.map.widthInPixels, this.map.heightInPixels);
    const spawn = this.buildObjects();
    this.linkBreakables();
    this.syncRhythmLurkers();
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
    this.findTraps();
    this.mainumbyPos.set(spawn.x, spawn.y - 40);
    if (hasSprite(this, 'mainumby', 'mainumby_fly')) {
      // Sprite real (mira a la derecha) aleteando, con un brillo dorado suave por código detrás.
      const look = GAMEPLAY.sprites.mainumby;
      this.mainumbyGlow = this.add
        .image(spawn.x, spawn.y - 40, ensureSoftGlow(this, look.glowTextureSize, look.glowColor))
        .setDisplaySize(look.glowRadius * 2, look.glowRadius * 2)
        .setAlpha(look.glowAlpha)
        .setDepth(14);
      const bird = this.add.sprite(spawn.x, spawn.y - 40, 'mainumby').setScale(1 / spriteDetail(this, 'mainumby')).setDepth(15);
      bird.play('mainumby_fly');
      this.mainumby = bird;
      this.darkness?.glow(this.mainumby);
      this.darkness?.glow(this.mainumbyGlow);
    } else {
      ensurePlaceholder(this, 'mainumby_placeholder', 8, 8);
      this.mainumby = this.add.image(spawn.x, spawn.y - 40, 'mainumby_placeholder').setDepth(15);
    }
    this.hypnosisIcon = this.add.image(spawn.x, spawn.y, this.makeSpiralTexture()).setDepth(16).setVisible(false);
    this.confusionSpiral = this.add.graphics().setDepth(16);
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
    // Ni los enemigos ni los pickups son piso: Arcade enciende `touching.down` también en un overlap, así que el
    // contacto se atiende en el processCallback y se corta ahí (false), antes de que Arcade marque el contacto (S28, S30).
    this.physics.add.overlap(this.player, this.enemies, undefined, (p, e) => {
      this.onPlayerTouchEnemy(p, e);
      return false;
    }, this);
    this.physics.add.overlap(this.player, this.pickups, undefined, (p, pk) => {
      this.onPickupOverlap(p, pk);
      return false;
    }, this);
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
    for (const m of this.movers) {
      this.physics.add.collider(this.player, m.block);
      this.physics.add.collider(this.enemies, m.block, undefined, (enemy) => isGroundedEnemy(enemy), this);
    }
    for (const g of this.gates) {
      this.physics.add.collider(this.player, g.block);
      this.physics.add.collider(this.enemies, g.block, undefined, (enemy) => isGroundedEnemy(enemy), this);
    }
    if (this.offering) {
      this.physics.add.collider(this.player, this.offering.door.block);
      this.physics.add.collider(this.enemies, this.offering.door.block, undefined, (enemy) => isGroundedEnemy(enemy), this);
    }
    for (const id of this.switchBoard.missingTargets()) console.warn(`[SWITCH] no hay reja ni Mover con id "${id}".`);
    this.switchBoard.update();
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
    if (this.chaseZone) {
      this.chase = new Chase(this, this.chaseZone.rect, this.chaseZone.speed, this.refuges, {
        camera: this.cameras.main,
        cameraCtl: this.cameraCtl,
        surfaceBelow: (x, fromY) => this.surfaceBelow(x, fromY),
        dust: this.dust,
        shake: (ms, intensity) => this.shake(ms, intensity),
        mapWidth: this.map.widthInPixels,
      });
    }

    // El registro es el estado inicial: UI puede arrancar después de que estos eventos ya se emitieron.
    this.registry.set('hearts', { current: this.player.health.current, max: this.player.health.max });
    this.registry.set('feathers', { current: this.feathers, max: GAMEPLAY.hud.featherMax });
    this.scene.launch('UI');
    this.touchControls = new TouchControls(this.scene.get('UI') as Phaser.Scene, this.inputs);
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
    EventBus.on(GameEvents.returnForChipas, this.returnForChipas, this);
    this.registry.set('chipaReturn', false);
    // Al volver de la pausa (y de Opciones) se relee el modo asistido: se puede cambiar en cualquier momento.
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      AudioManager.duck(false);
      this.touchControls?.destroy();
      this.scene.stop('UI');
      SaveManager.persist();
      EventBus.off(GameEvents.restartFromCheckpoint, this.restartFromCheckpoint, this);
      EventBus.off(GameEvents.returnForChipas, this.returnForChipas, this);
      this.registry.set('chipaReturn', false);
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    });

    EventBus.emit(GameEvents.levelReady, this.def.id);
    window.__KERANA_READY__ = true;
  }

  override update(_time: number, delta: number): void {
    if (!this.dialogueBox?.active && !this.cutscene) this.tryAutoAttack();
    this.inputs.update();
    this.backdrop.update(this.darkness?.ambientColor);
    SaveManager.addPlayTime(delta);

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
    this.updateSlashFx();
    this.updateDashTrail(delta);
    this.cameraCtl.update(this.player.motor.facing);
    if (this.updateChase(delta)) return;
    this.updateEnemies(delta);
    this.updateCarriers(delta);
    this.updateMainumby(delta);

    const body = this.player.body;
    this.playerRect.setTo(body.x, body.y, body.width, body.height);
    this.updateSwitches(delta);

    if (body.top > this.map.heightInPixels + GAMEPLAY.respawn.pitMargin) this.respawn('pit');
    else if (this.tileAt('Water', body.center.x, body.center.y)) this.respawn('water');
    else if (!this.player.isIntangible && this.touchesHazard(body)) this.respawn('hazard');
    else {
      this.updateTrap(delta, body);
      this.trackSafeGround(body);
    }

    this.updateWater(delta, body);
    this.updateJungle(delta, body);
    this.updateProjectiles();
    this.updateWind(delta, body);
    for (const w of this.waterfalls) w.update(delta);
    this.updateHypnosisIcon(delta);
    this.updateSleep(body);
    this.updateFallingHazards(delta);
    this.updateBreakables();
    this.updateStrikes();
    this.updateLightWave(delta);
    this.updateDarkness(delta);
    this.updateBoss(delta);
    this.updateCheckpoints();
    this.flickerCheckpoints();
    this.updateSigns();
    this.updateOffering(delta);
    this.updateLuzArasyHud();
    this.updateLevelExit();
    if (this.debugText) this.updateDebugText();
  }

  private openPause(): void {
    this.touchControls?.setHidden(true);
    this.scene.pause();
    this.scene.launch('Pause', { levelId: this.def.id });
  }

  /** Al volver de la pausa se relee el modo asistido y, si cambió, el lugar de los botones. */
  private onResume(): void {
    this.applyAssist();
    this.touchControls?.relayout();
    this.touchControls?.setHidden(false);
  }

  /** Un tajo cuando el sable ya llegaría. No se mantiene, así que no carga. */
  private tryAutoAttack(): void {
    if (!SaveManager.current.settings.autoAttack) return;
    if (!this.player?.active || !this.player.motor.readyForAutoSwing) return;
    if (this.inputs.isDown('attack')) return;
    if (!this.enemyInReach()) return;
    this.inputs.pulse('attack');
  }

  /** El mismo rectángulo que usa el sable normal, antes de que salga. */
  private enemyInReach(): boolean {
    const body = this.player.body;
    const facing = this.player.motor.facing;
    const w = GAMEPLAY.attack.hitboxWidth;
    const h = GAMEPLAY.attack.hitboxHeight;
    const cx = this.player.x + facing * (body.width / 2 + w / 2);
    const cy = this.player.y - body.height / 2;
    const left = cx - w / 2;
    const right = cx + w / 2;
    const top = cy - h / 2;
    const bottom = cy + h / 2;
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.purified) continue;
      const b = enemy.body;
      if (b.right < left || b.left > right || b.bottom < top || b.top > bottom) continue;
      return true;
    }
    return false;
  }

  private restartFromCheckpoint(): void {
    this.chase?.reset();
    this.player.respawnAt(this.checkpointPos.x, this.checkpointPos.y);
    this.cameraCtl.snap();
  }

  /**
   * Persecución (S31): avanza el borde y, si Ao Ao alcanza a Kerana, la hace volver (como una caída: `respawn`).
   * Devuelve true si este frame terminó en una vuelta (el resto del update espera al siguiente).
   */
  private updateChase(deltaMs: number): boolean {
    const chase = this.chase;
    if (!chase) return false;
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    const refuge = refugeUnder(body.center.x, body.bottom, grounded, this.refuges, GAMEPLAY.pindo.feetTolerancePx);
    const event = chase.update(deltaMs, body, refuge);
    // La largada: adónde vuelve si la alcanza antes del primer pindó. El último suelo firme, pero siempre antes de la
    // línea (si no, volvería a largar en el mismo cuadro, sin respiro).
    if (event === 'started') {
      this.chaseStart.copy(this.safeGround);
      const before = chase.zone.left - this.map.tileWidth * 1.5;
      const y = this.chaseStart.x > before ? this.surfaceBelow(before, this.chaseStart.y - this.map.tileHeight * 4) : null;
      if (y !== null) this.chaseStart.set(before, y);
    }
    if (event !== 'caught') return false;
    this.respawn('chase');
    return true;
  }

  /** Adónde vuelve Kerana tras una caída: el último suelo firme o, en la persecución, el último pindó o la largada. */
  private respawnSpot(): Phaser.Math.Vector2 {
    if (!this.chase?.active) return this.safeGround;
    const x = this.chase.restart();
    const refuge = x === null ? undefined : this.chase.refuges.find((r) => (r.left + r.right) / 2 === x);
    if (x !== null && refuge) this.safeGround.set(x, refuge.top);
    else this.safeGround.copy(this.chaseStart);
    return this.safeGround;
  }

  /** Mainumby sigue a Kerana con un retraso suave, flotando sobre su hombro (GDD §4.5). */
  private updateMainumby(delta: number): void {
    if (!this.mainumby) return;
    const targetX = this.player.x - this.player.motor.facing * 14;
    const targetY = this.player.y - 44;
    const pos = this.mainumbyPos;
    const dx = (targetX - pos.x) * 0.08;
    pos.x += dx;
    pos.y += (targetY - pos.y) * 0.08;
    if (!this.mainumbyGlow) {
      this.mainumby.setPosition(pos.x, pos.y);
      return;
    }
    // Flota (el aleteo es la animación de la hoja), se inclina hacia donde se mueve y mira hacia donde mira Kerana.
    const look = GAMEPLAY.sprites.mainumby;
    const bob = Math.sin((this.time.now / look.bobMs) * Math.PI * 2) * look.bobAmplitude;
    const speed = delta > 0 ? dx / (delta / 1000) : 0;
    const tilt = Phaser.Math.Clamp(speed * look.tiltPerSpeed, -look.tiltMaxDeg, look.tiltMaxDeg);
    this.mainumby.angle += (tilt - this.mainumby.angle) * look.tiltLerp;
    this.mainumby.setPosition(pos.x, pos.y + bob).setFlipX(this.player.motor.facing < 0);
    this.mainumbyGlow.setPosition(pos.x, pos.y + bob);
  }

  // ── Jefe (GDD §6.0, §11.5) ────────────────────────────────────────────────

  private setupBoss(): void {
    if (!this.arenaRect || !this.arenaBossId) return;
    const rect = this.arenaRect;
    const floorY = this.surfaceBelow(rect.centerX, rect.top) ?? rect.bottom;
    const groundY = this.surfaceBelow(rect.centerX, rect.top, true) ?? rect.bottom;
    const ledgeProbe = this.surfaceBelow(rect.left + this.map.tileWidth * 5.5, rect.top);
    const ledgeY = ledgeProbe !== null && ledgeProbe < floorY - 8 ? ledgeProbe : null;
    const ctx: BossContext = {
      arena: rect,
      floorY,
      groundY,
      ledgeY,
      playerX: () => this.player.x,
      playerY: () => this.player.y,
      spawnFalling: (x, kind) => {
        if (this.fighting) this.spawnFalling(x, rect.top, true, undefined, kind);
      },
      pushPlayer: (vx, ms) => this.player.motor.push(vx, ms),
      hypnotizePlayer: () => this.hypnotizePlayer(),
      confusePlayer: () => this.confusePlayer(),
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
      placeBelowPlayer: (objs) => {
        // Misma profundidad que Kerana y antes que ella en la lista: el orden estable deja a Kerana encima.
        for (const obj of objs) {
          obj.setDepth(this.player.depth);
          this.children.moveBelow(obj, this.player);
        }
      },
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
        this.impactSparks(boss.markPosition(this.tmpVec));
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
    AudioManager.music(bossTrack(this.def.id));
    this.shake(GAMEPLAY.boss.lockShakeMs, GAMEPLAY.boss.lockShakeIntensity);
    this.boss!.begin();
    this.syncArenaLuz();
  }

  /** Modo asistido en caliente (GDD §4.7): corazones, avisos de jefe y Luz de Arasy de la arena. */
  private applyAssist(): void {
    const assist = SaveManager.current.settings.assist;
    this.player.setAssist(assist);
    EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
    this.boss?.setAssist(assist);
    this.syncArenaLuz();
  }

  /** Una Luz de Arasy en la arena mientras dura la pelea, solo con el modo asistido; una por intento. */
  private syncArenaLuz(): void {
    const want = this.fighting && SaveManager.current.settings.assist && !this.arenaLuzUsed;
    if (want && !this.arenaLuz && this.arenaRect) {
      const tile = this.map.tileWidth;
      const x = this.arenaRect.left + tile * (GAMEPLAY.boss.assistLuzOffsetTiles + 0.5);
      const y = this.surfaceBelow(x, this.arenaRect.top) ?? this.arenaRect.bottom;
      this.arenaLuz = new Pickup(this, x, y, 'luz_arasy');
      this.pickups.push(this.arenaLuz);
    } else if (!want && this.arenaLuz) {
      this.removeArenaLuz();
    }
  }

  private removeArenaLuz(): void {
    const luz = this.arenaLuz;
    if (!luz) return;
    this.arenaLuz = undefined;
    // En el lugar: el overlap guarda la referencia a este arreglo.
    const i = this.pickups.indexOf(luz);
    if (i >= 0) this.pickups.splice(i, 1);
    if (luz.active && luz.body.enable) luz.destroy();
  }

  /** Kerana cayó durante la pelea: todo vuelve a empezar desde la antesala. */
  private resetBossFight(): void {
    if (!this.fighting) return;
    this.fighting = false;
    AudioManager.music(levelTrack(this.def.id));
    this.boss?.resetFight();
    this.arena?.unlock(this.cameras.main, this.map.widthInPixels, this.map.heightInPixels);
    this.clearOneShotHazards();
    this.clearFlowers();
    this.clearBossMinions();
    // El próximo intento vuelve a tener su Luz de Arasy.
    this.arenaLuzUsed = false;
    this.removeArenaLuz();
  }

  private startLiberation(): void {
    const boss = this.boss!;
    this.cutscene = true;
    this.fighting = false;
    // Silencio para que el arpegio de la liberación se oiga solo; "Nivel completado" trae la del mapa.
    AudioManager.music(null);
    this.clearOneShotHazards();
    this.clearFlowers();
    this.clearBossMinions();
    this.removeArenaLuz();
    EventBus.emit(GameEvents.bossBarHide);
    this.lightCandles();
    const gift = this.def.gift === 'heart_up' ? this.def.gift : null;
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
      lantern.update(deltaMs);
      if (!Phaser.Geom.Rectangle.Overlaps(lantern.zone, this.playerRect)) continue;
      // S32: tocarlo lo enciende y, si es temporizado, mantiene su cuenta mientras Kerana está al lado.
      this.lightLantern(lantern);
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
    for (const lantern of this.lanterns) if (lantern.lit && arena.contains(lantern.zone.centerX, lantern.zone.bottom - 1)) lantern.putOut();
    this.switchBoard.update();
  }

  /** Enciende un farol (al tocarlo, con el sable o con la onda) y pasa la energía a lo que maneja (S32). */
  private lightLantern(lantern: Lantern, struck = false): void {
    if (struck ? lantern.strike() : lantern.touch()) AudioManager.play('lantern');
    if (lantern.targetId !== undefined) this.switchBoard.update();
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

  /**
   * Vaca suelta; `guasu` (S27): la vaca grande del potrero de l4, con sus valores y un mugido más grave. `patrol`
   * (S29): patrulla propia, más corta, para la vaca que deja la vaca embrujada en un piso angosto.
   */
  private makeCow(x: number, feetY: number, facing: 1 | -1, guasu = false, patrol?: number): Cow {
    const moo = guasu ? 'mooGuasu' : 'moo';
    const base = guasu ? GAMEPLAY.bigCow : GAMEPLAY.cow;
    const cfg = patrol === undefined ? base : { ...base, patrolDistance: patrol };
    return new Cow(
      this,
      x,
      feetY,
      facing,
      (cow) => {
        const view = this.cameras.main.worldView;
        if (view.contains(cow.x, cow.y - 4)) AudioManager.play(moo, panFor(cow.x, view.centerX, view.width / 2));
      },
      cfg,
    );
  }

  private addCowToGroup(cow: Cow): void {
    // El grupo pisa las propiedades del cuerpo: se vuelven a poner.
    this.cowGroup?.add(cow);
    Cow.setupBody(cow.body);
  }

  // ── Plataformas móviles, rejas y disparadores (S18) ──────────────────────

  /** Vacas y plataformas móviles: se mueven y llevan a Kerana y a los enemigos que estén encima. */
  private updateCarriers(deltaMs: number): void {
    if (this.cows.length === 0 && this.movers.length === 0) return;
    const riders = this.riderBodies;
    riders.length = 0;
    riders.push(this.player.body);
    for (const enemy of this.enemies) if (enemy.active && !enemy.purified && isGroundedEnemy(enemy)) riders.push(enemy.body);
    for (const cow of this.cows) cow.tick(deltaMs, riders);
    const view = this.cameras.main.worldView;
    for (const m of this.movers) {
      const wasMoving = m.motor.moving;
      m.update(deltaMs, riders);
      // Arranque de una plataforma que espera un disparador o que se manda sola una vez (las de vaivén, no: sonarían siempre).
      if (!wasMoving && m.motor.moving && m.motor.mode !== 'loop' && Phaser.Geom.Rectangle.Overlaps(view, m.zone)) AudioManager.play('moverStart');
    }
  }

  /** Disparadores: tiempo de los temporizados, energía a sus objetivos y rejas que esperan para cerrarse. */
  private updateSwitches(deltaMs: number): void {
    if (this.switches.length === 0 && this.gates.length === 0 && this.lanterns.length === 0) return;
    for (const sw of this.switches) {
      const before = sw.state;
      sw.update(deltaMs);
      if (sw.state === 'closing' && before !== 'closing') AudioManager.play('switchWarn');
    }
    this.switchBoard.update();
    const blockers = this.gateBlockers;
    blockers.length = 0;
    blockers.push(this.playerRect);
    for (const g of this.gates) {
      const wasOpen = g.isOpen;
      g.update(blockers);
      this.gateSound(g, wasOpen);
    }
  }

  private hitSwitch(sw: Switch): void {
    if (sw.hit()) AudioManager.play('switchOn');
    const open = this.gates.map((g) => g.isOpen);
    this.switchBoard.update();
    this.gates.forEach((g, i) => this.gateSound(g, open[i]));
  }

  /** La reja suena al abrirse y al cerrarse, si se ve. */
  private gateSound(gate: Gate, wasOpen: boolean): void {
    if (gate.isOpen === wasOpen || !Phaser.Geom.Rectangle.Overlaps(this.cameras.main.worldView, gate.zone)) return;
    AudioManager.play(gate.isOpen ? 'gateOpen' : 'gateClose');
  }

  /** El sable enciende los Switch y despierta (solo cargado) a los hongos dormidos. */
  private updateStrikes(): void {
    if (!this.player.motor.attackHitboxActive) return;
    const rect = this.player.attackRect;
    for (const sw of swordStrikes(this.switches, rect, this.player.swingHits, this.struck)) this.hitSwitch(sw);
    for (const lantern of swordStrikes(this.lanterns, rect, this.player.swingHits, this.struckLanterns)) this.lightLantern(lantern, true);
    for (const b of this.bouncers) {
      if (b.motor.state !== 'asleep' || this.player.hasHitThisSwing(b) || !Phaser.Geom.Rectangle.Overlaps(b.zone, rect)) continue;
      this.player.markHitThisSwing(b);
      const woke = b.strike(this.player.motor.chargedSwing);
      AudioManager.play(woke ? 'bounce' : 'hit');
      if (woke) this.updateTraps();
    }
  }

  /** La luz de la onda enciende los Switch; con `waveThroughWalls`, también los que están tras una pared. */
  private waveHitsSwitches(): void {
    if (this.switches.length === 0 && this.lanterns.length === 0) return;
    const lw = GAMEPLAY.lightWave;
    for (const sw of waveStrikes(this.switches, this.lightWave, lw.width, lw.height, GAMEPLAY.switches.waveThroughWalls, this.struck)) this.hitSwitch(sw);
    // S32: la luz de la onda enciende los faroles de lejos (también tras una pared).
    for (const lantern of waveStrikes(this.lanterns, this.lightWave, lw.width, lw.height, GAMEPLAY.switches.waveThroughWalls, this.struckLanterns)) this.lightLantern(lantern, true);
  }

  /**
   * La vaca embrujada purificada queda como una vaca tranquila más. S29: si se purificó junto a un borde (el pretil
   * o el fardo de la terraza de l4), la patrulla se corre (o se acorta) lo justo para no salirse del piso y caminar
   * en el aire.
   */
  private cowFromEnemy(enemy: EnemyBase): void {
    const ground = this.layers.Ground;
    const tile = this.map.tileWidth;
    const row = Math.round(enemy.y / tile);
    const solid = (col: number, r: number) => (ground?.getTileAt(col, r)?.index ?? -1) !== -1;
    const fit = cowPatrol(enemy.x, GAMEPLAY.cow.width / 2, GAMEPLAY.cow.patrolDistance, tile, (col) => solid(col, row) && !solid(col, row - 1));
    const cow = this.makeCow(fit.x, enemy.y, enemy.facing, false, fit.patrol);
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
    this.waveHitsSwitches();
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
    // La onda rompe cualquier rompible que toque (también los fardos y las lianas).
    for (const b of this.breakables) {
      if (b.broken || !Phaser.Geom.Rectangle.Overlaps(b.zone, rect)) continue;
      if (wave.tryHit(b)) this.breakBreakable(b);
    }
    for (const b of this.bouncers) {
      if (b.motor.state !== 'asleep' || !Phaser.Geom.Rectangle.Overlaps(b.zone, rect)) continue;
      if (!wave.tryHit(b) || !b.strike(true)) continue;
      AudioManager.play('bounce');
      this.updateTraps();
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
  /** Primera superficie bajo (x, fromY); con `groundOnly`, sin contar las plataformas de un solo sentido. */
  private surfaceBelow(x: number, fromY: number, groundOnly = false): number | null {
    const tile = this.map.tileHeight;
    for (let y = fromY + tile / 2; y < this.map.heightInPixels; y += tile) {
      if (groundOnly ? this.tileAt('Ground', x, y) : this.isSolidAt(x, y)) return Math.floor(y / tile) * tile;
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

  private confusePlayer(): void {
    if (DEBUG.god) return;
    const cfg = GAMEPLAY.monai;
    if (this.player.status.applyConfusion(cfg.confusionMs, cfg.confusionShakeCutMs)) AudioManager.play('hypnosis');
  }

  private updateHypnosisIcon(deltaMs: number): void {
    const icon = this.hypnosisIcon;
    if (!icon) return;
    const status = this.player.status;
    const on = status.hypnotized;
    // Confundida (Moñái, S44): en vez del icono, una espiral grande dibujada (se achica al pasarse o al sacudirse).
    icon.setVisible(on && !status.confused);
    this.drawConfusionSpiral(status.confused ? status.hypnosisFraction : 0);
    if (!on) return;
    icon.setPosition(this.player.x, this.player.y - GAMEPLAY.hypnosis.iconOffsetY);
    icon.angle += (GAMEPLAY.hypnosis.iconSpinDegPerS * deltaMs) / 1000;
    // Tinte iridiscente que va cambiando (el aviso no depende solo del color: la espiral gira).
    icon.setTint(Phaser.Display.Color.HSVToRGB((this.time.now / 1500) % 1, 0.6, 1).color);
  }

  /**
   * Espiral de la confusión (S44): se dibuja girada cada cuadro (una textura grande girada se recorta en el render).
   * `fraction` 0 la borra; 1 es el tamaño entero.
   */
  private drawConfusionSpiral(fraction: number): void {
    const g = this.confusionSpiral;
    if (!g) return;
    g.clear();
    if (fraction <= 0) return;
    const cfg = GAMEPLAY.monai;
    const radius = (cfg.confusionIconPx / 2) * (0.5 + 0.5 * fraction);
    const turns = Math.PI * 5;
    const spin = Phaser.Math.DegToRad((this.time.now / 1000) * GAMEPLAY.hypnosis.iconSpinDegPerS);
    const cx = this.player.x;
    const cy = this.player.y - GAMEPLAY.hypnosis.iconOffsetY - (cfg.confusionIconPx - 20) / 2;
    g.lineStyle(cfg.confusionIconLine, Phaser.Display.Color.HSVToRGB((this.time.now / 1500) % 1, 0.6, 1).color);
    g.beginPath();
    for (let a = 0; a <= turns; a += 0.2) {
      const r = (a / turns) * radius;
      const x = cx + Math.cos(a + spin) * r;
      const y = cy + Math.sin(a + spin) * r;
      if (a === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
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
      b.update(deltaMs);
      if (!b.canBounce || !b.isStoodOn(body)) continue;
      this.player.bounce(GAMEPLAY.jungle.bounceVelocity);
      b.bounced();
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
        AudioManager.play('blocked');
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

  /**
   * Jakare guasu (S24): cada Lurker con ritmo se sincroniza con la plataforma `loop` cuya punta (el origen o el otro
   * extremo) le queda más cerca: sale cuando ella llega a esa punta y después una vez por vuelta. Sin una plataforma a
   * 2 tiles, espera a Kerana como un jakare común.
   */
  private syncRhythmLurkers(): void {
    const movers = this.movers.map((m) => ({ x: m.zone.x, y: m.zone.y, width: m.zone.width, spec: m.motor.spec }));
    for (const enemy of this.enemies) {
      if (!(enemy instanceof Lurker) || !enemy.def.rhythm) continue;
      const r = rhythmFromMovers(enemy.spawnX, enemy.spawnY, movers, 2 * this.map.tileWidth);
      if (r) enemy.setRhythm(r.periodMs, r.exposedAtMs);
    }
  }

  /** Arma los bloques (S22): los rompibles de la misma clase que se tocan caen juntos y se dibujan como uno. */
  private linkBreakables(): void {
    const ids = breakableGroups(this.breakables.map((b) => ({ x: b.zone.x, y: b.zone.y, width: b.zone.width, height: b.zone.height, kind: b.kind })));
    const groups = new Map<number, Breakable[]>();
    this.breakables.forEach((b, i) => {
      const g = groups.get(ids[i]) ?? [];
      g.push(b);
      groups.set(ids[i], g);
    });
    for (const g of groups.values()) {
      const look = drawBreakables(this, g[0].kind, g.map((b) => b.zone));
      for (const b of g) {
        b.group = g;
        b.look = look;
      }
    }
  }

  /** ¿Hay un rompible sin romper en (x, y)? */
  private breakableAt(x: number, y: number): boolean {
    return this.breakables.some((b) => !b.broken && b.zone.contains(x, y));
  }

  /** Rompe el bloque entero; lo que estaba apoyado encima cae al suelo (S22). */
  private breakBreakable(hit: Breakable): void {
    const ground = this.layers.Ground;
    const tile = this.map.tileWidth;
    for (const b of hit.group) {
      if (b.broken) continue;
      b.broken = true;
      if (b.block) {
        b.block.destroy();
      } else {
        for (let y = b.zone.top; y < b.zone.bottom; y += tile) {
          for (let x = b.zone.left; x < b.zone.right; x += tile) ground?.removeTileAtWorldXY(x + 1, y + 1);
        }
      }
      this.dust.emitParticleAt(b.zone.centerX, b.zone.centerY, b.block ? 10 : 4);
    }
    for (const obj of hit.look) obj.destroy();
    hit.look.length = 0;
    this.dropPickupsFrom(hit.group);
    this.updateTraps();
    AudioManager.play(hit.kind === 'liana' ? 'vineSnap' : 'rockBreak');
    this.shake(80, 0.004);
  }

  /** Lo que descansaba sobre la cara de arriba de un bloque roto cae hasta la superficie de abajo. */
  private dropPickupsFrom(group: Breakable[]): void {
    const cfg = GAMEPLAY.breakable;
    for (const p of this.pickups) {
      if (!p.active) continue;
      const under = group.find((b) => restsOn(p.x, p.baseY, { x: b.zone.x, y: b.zone.y, width: b.zone.width, height: b.zone.height, kind: b.kind }, cfg.restTolerancePx));
      if (!under) continue;
      const floor = this.surfaceBelow(p.x, under.zone.top);
      if (floor !== null) p.dropTo(floor, cfg.dropSpeed);
    }
  }

  /** Daño por contacto de un peligro, un enemigo o un ataque de jefe (1 corazón si no se dice otra cosa). Devuelve si se aplicó. */
  private hurtPlayer(fromX: number, amount: number = GAMEPLAY.damage.enemyContact): boolean {
    const applied = this.player.takeDamage(amount, fromX);
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
    if (this.def.finale) {
      // Tau sellado (GDD §7): el mapa recupera sus colores y sigue el final verdadero.
      SaveManager.completeLevel(this.def);
      const feathers = WORLD_LEVELS.reduce((n, l) => n + SaveManager.getFeathers(l.id).filter(Boolean).length, 0);
      const slides = endingSlides(feathers, WORLD_LEVELS.length * GAMEPLAY.hud.featherMax);
      this.scene.start('Story', { slides, nextScene: 'Credits' });
      return;
    }
    if (this.def.order > 0) SaveManager.completeLevel(this.def);
    this.scene.start('LevelComplete', { level: this.def });
  }

  private updateLuzArasyHud(): void {
    const active = this.player.isImmune;
    if (active) EventBus.emit(GameEvents.luzArasyChanged, true, this.player.luzArasyFraction);
    else if (this.wasImmune) {
      EventBus.emit(GameEvents.luzArasyChanged, false, 0);
      AudioManager.play('luzArasyEnd');
    }
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
    if (this.def.terrainShell) this.drawTerrainAsLedges(this.def.terrainShell);
    // Sin borde inferior: se puede caer al pozo.
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.physics.world.setBoundsCollision(true, true, false, false);
  }

  /** Terreno como repisa (S28): los tiles de Ground hondos no se dibujan y se ve el fondo. Solo dibujo. */
  private drawTerrainAsLedges(tiles: number): void {
    const ground = this.layers.Ground;
    if (!ground) return;
    const { width, height } = this.map;
    const solid = (x: number, y: number) => (ground.getTileAt(x, y)?.index ?? -1) !== -1;
    const depth = terrainDepths(solid, width, height, tiles);
    const floor = terrainFloor(solid, width, height);
    const keepFloor = this.def.solidFloor !== false;
    ground.forEachTile((tile) => {
      if (tile.index === -1 || (keepFloor && isFloorTile(floor, tile.x, tile.y))) return;
      const alpha = terrainAlpha(depth[tile.y * width + tile.x], tiles, GAMEPLAY.backdrop.terrainFadeAlpha);
      if (alpha <= 0) tile.setVisible(false);
      else tile.setAlpha(alpha);
    });
  }

  /** Crea checkpoints, carteles, enemigos y objetos; devuelve el punto de inicio (pies). */
  private buildObjects(): Phaser.Math.Vector2 {
    const spawn = new Phaser.Math.Vector2(32, 32);
    const objects = this.map.getObjectLayer('Objects')?.objects ?? [];
    let featherOrder = 0;
    for (const obj of objects) {
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      switch (objectClass(obj)) {
        case 'PlayerSpawn':
          spawn.set(x, y);
          break;
        case 'Checkpoint': {
          const sprite = this.makeCheckpointSprite(x, y);
          const id = Number(objectProp(obj, 'id') ?? this.checkpoints.length);
          const zone = new Phaser.Geom.Rectangle(x - 8, y - 24, 16, 24);
          const lc = GAMEPLAY.lantern;
          const light = this.darkness?.addLight(x, y - 12, lc.radius, lc.color, lc.intensity, false);
          this.checkpoints.push({ id, sprite, zone, active: false, lit: false, light });
          break;
        }
        case 'Lantern': {
          if (!this.darkness) break;
          // S32: un farol con `target` es un disparador (como un Switch); con `ms`, se apaga solo.
          const target = objectProp(obj, 'target');
          const mount = this.lanternMount(obj, x, y);
          const lantern = new Lantern(this, x, y, this.darkness, objectProp(obj, 'lit') === true, Number(objectProp(obj, 'ms') ?? 0), target === undefined ? undefined : String(target), mount);
          this.lanterns.push(lantern);
          if (lantern.targetId !== undefined) this.switchBoard.addSwitch(lantern.targetId, lantern.motor);
          break;
        }
        case 'Cave':
          this.addCave(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          break;
        case 'PropShowcase':
          this.addPropShowcase(new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 0), Number(obj.height ?? 0)));
          break;
        case 'DarkZone':
          this.darkness?.addZone({ x, y, width: Number(obj.width ?? 16), height: Number(obj.height ?? 16) });
          break;
        case 'Prop': {
          // Props por bioma (S46): "prop X,Y carpeta/nombre" del mapa ASCII (GDD §11.7.1).
          const art = objectProp(obj, 'art');
          if (art !== undefined) {
            addProp(this, x, y, String(art), this.map.tileHeight, {
              scale: Number(objectProp(obj, 'scale') ?? 1),
              flip: objectProp(obj, 'flip') === true,
              front: objectProp(obj, 'front') === true,
              drops: this.splashes,
            });
            break;
          }
          const kind = String(objectProp(obj, 'kind') ?? '');
          const spec =
            kind === 'nest' ? { key: 'prop_nest' as const, w: 18, h: 14 }
            : kind === 'tacuru' ? { key: 'prop_tacuru' as const, w: 20, h: 24 }
            : kind === 'fence' ? { key: 'prop_fence' as const, w: 48, h: 18 }
            : kind === 'chair' ? { key: 'prop_chair' as const, w: 18, h: 22 }
            : kind === 'hammock' ? { key: 'prop_hammock' as const, w: 48, h: 20 }
            : kind === 'trunk' ? { key: 'prop_trunk' as const, w: 32, h: 12 }
            : kind === 'liana' ? { key: 'prop_liana' as const, w: 16, h: 32 }
            : null;
          if (!spec) break;
          const look = artOrPlaceholder(this, spec.key, kind, spec.w, spec.h);
          const image = this.add.image(x, y, look.key).setScale(look.scale);
          // La liana cuelga del techo. El resto se apoya en el piso.
          image.setOrigin(0.5, kind === 'liana' ? 0 : 1);
          break;
        }
        case 'Sign': {
          const look = artOrPlaceholder(this, 'prop_sign', 'sign', SIGN_PLACEHOLDER, SIGN_PLACEHOLDER);
          this.add.image(x, y, look.key).setOrigin(0.5, 1).setScale(look.scale);
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
          if (kind === 'vaca' || kind === 'vaca_guasu') {
            this.cows.push(this.makeCow(x, y, facing, kind === 'vaca_guasu'));
            break;
          }
          const enemy = createEnemy(this, kind, x, y, facing);
          // El ñakurutu y el karakara solo pican con el camino libre (S24): les frena el suelo y las plataformas.
          if (enemy instanceof Diver) {
            enemy.solidAt = (px, py) => this.isSolidAt(px, py);
            enemy.tileSize = this.map.tileWidth;
          }
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
        case 'ChaseZone': {
          const rect = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          this.chaseZone = { rect, speed: Number(objectProp(obj, 'speed') ?? GAMEPLAY.chase.speed) };
          break;
        }
        case 'Waterfall':
          this.waterfalls.push(new Waterfall(this, new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16)), FX_PARTICLE));
          break;
        case 'Pickup': {
          const kind = String(objectProp(obj, 'kind') ?? 'guavira') as PickupKind;
          if (kind === 'pluma') {
            // Índice del ASCII; si falta (mapa editado a mano), el orden en que aparece.
            const index = Number(objectProp(obj, 'index') ?? featherOrder);
            featherOrder++;
            // Ya guardada: no se crea (GDD §4.6, las plumas recogidas quedan guardadas).
            if (SaveManager.hasFeather(this.def.id, index)) break;
            this.pickups.push(new Pickup(this, x, y, kind, index));
            break;
          }
          this.pickups.push(new Pickup(this, x, y, kind));
          break;
        }
        case 'Breakable': {
          const zone = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          const kind = parseBreakableKind(objectProp(obj, 'kind'));
          const isLiana = kind === 'liana';
          const hitsLeft = isLiana ? GAMEPLAY.breakable.lianaHits : kind === 'brittle' ? GAMEPLAY.breakable.brittleHits : 1;
          const b: Breakable = { zone, kind, needsCharge: needsChargedSlash(kind), hitsLeft, group: [], look: [], broken: false };
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
        case 'Bouncer': {
          const zone = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          this.bouncers.push(new Bouncer(this, zone, parseBouncerKind(objectProp(obj, 'kind')), this.def.biome === 'ciudad' ? 'awning' : 'mushroom'));
          break;
        }
        case 'Mover': {
          // dx/dy en tiles; velocidad, espera y modo por objeto o de GAMEPLAY.mover.
          const zone = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          const tile = this.map.tileWidth;
          const rawMode = objectProp(obj, 'mode');
          const mode: MoverMode = rawMode === 'run' || rawMode === 'toggle' ? rawMode : 'loop';
          const mover = new Mover(
            this,
            zone,
            {
              dx: Number(objectProp(obj, 'dx') ?? 0) * tile,
              dy: Number(objectProp(obj, 'dy') ?? 0) * tile,
              speed: Number(objectProp(obj, 'speed') ?? GAMEPLAY.mover.speed),
              waitMs: Number(objectProp(obj, 'waitMs') ?? GAMEPLAY.mover.waitMs),
              mode,
            },
            objectProp(obj, 'solid') === true,
          );
          this.movers.push(mover);
          const id = objectProp(obj, 'id');
          if (id !== undefined) this.switchBoard.addTarget(String(id), mover);
          break;
        }
        case 'Gate': {
          const gate = new Gate(this, new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16)));
          this.gates.push(gate);
          const id = objectProp(obj, 'id');
          if (id !== undefined) this.switchBoard.addTarget(String(id), gate);
          break;
        }
        case 'Offering': {
          // S36: abierta de entrada si el hijo de este nivel ya está libre (partidas de antes de la ofrenda).
          const rect = new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16));
          const open = offeringStartsOpen(this.def.boss, SaveManager.current.freed);
          // `front`: fila de los pies frente a la puerta, si se llega desde más alto que su pie (l4, l6, l7).
          const front = objectProp(obj, 'front');
          const frontY = front === undefined ? rect.bottom : (Number(front) + 1) * this.map.tileHeight;
          const door = new OfferingDoor(this, rect, GAMEPLAY.hud.featherMax, open, TEXT_STYLE, frontY);
          door.setCarried(this.feathers);
          for (const part of door.plaqueParts) this.darkness?.glow(part);
          this.offering = { door, motor: new OfferingMotor(open) };
          break;
        }
        case 'ChipaReturn':
          this.chipaReturns.push({ chipa: Number(objectProp(obj, 'chipa') ?? 0), x, y });
          break;
        case 'Switch': {
          const target = String(objectProp(obj, 'target') ?? '');
          const sw = new Switch(this, new Phaser.Geom.Rectangle(x, y, Number(obj.width ?? 16), Number(obj.height ?? 16)), target, Number(objectProp(obj, 'ms') ?? 0));
          this.switches.push(sw);
          this.switchBoard.addSwitch(target, sw.motor);
          break;
        }
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

  /**
   * S33: cómo está montado un farol (`mount=post|wall|niche`; el aplique, con `wall=right|left`, el lado del muro).
   * El aplique busca la cara del muro (el tile del farol, si es muro, o el de al lado) y sube el brazo hasta que la
   * placa y la escuadra queden sobre muro firme (no sobre una reja). Solo dibujo: la zona y la luz no cambian.
   */
  private lanternMount(obj: Phaser.Types.Tilemaps.TiledObject, x: number, feetY: number): LanternMount {
    const kind = objectProp(obj, 'mount');
    if (kind === 'niche') return { kind: 'niche' };
    if (kind !== 'wall') return { kind: 'post' };
    const T = this.map.tileWidth;
    const side = objectProp(obj, 'wall') === 'left' ? -1 : 1;
    const lc = GAMEPLAY.lantern;
    let armY = feetY - lc.postHeight;
    const col = Math.floor(x / T);
    const inWall = this.tileAt('Ground', x, armY);
    const wallX = (side > 0 ? (inWall ? col : col + 1) : inWall ? col + 1 : col) * T;
    const probe = wallX + side * 2;
    const firm = (y: number) => this.tileAt('Ground', probe, y + 3) && this.tileAt('Ground', probe, y - lc.sconceBrace - 2);
    for (let lift = 0; lift < lc.sconceLift && !firm(armY); lift++) armY--;
    return { kind: 'wall', wallX, side, armY };
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

  /**
   * Red de seguridad (S23): marca los pisos de los que Kerana no puede salir con lo que tiene. Se calcula al cargar el
   * nivel, con la geometría del mapa y un modelo que exagera su alcance (ver `trapLogic.ts`), y otra vez cada vez que
   * algo se abre (S39: un rompible roto, un hongo dormido despierto, la ofrenda abierta).
   */
  private findTraps(): void {
    // La escena se reutiliza entre niveles (S24): sin esto quedaban las celdas y el reloj del nivel anterior.
    this.trapCells = undefined;
    this.trapWatch.reset();
    // La raya del nivel anterior se fue con la escena.
    this.trapGfx = undefined;
    this.trapObjects = (this.map.getObjectLayer('Objects')?.objects ?? []).map((o) => ({
      cls: objectClass(o),
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width ?? 0,
      height: o.height ?? 0,
      props: Object.fromEntries(((o.properties ?? []) as { name: string; value: unknown }[]).map((p) => [p.name, p.value])),
    }));
    this.updateTraps();
  }

  /** ¿Kerana ya abrió este objeto? Rompibles rotos, hongos dormidos despiertos, la ofrenda abierta. */
  private trapOpened(o: TrapObject): boolean {
    const at = (zone: Phaser.Geom.Rectangle) => zone.x === o.x && zone.y === o.y;
    if (o.cls === 'Breakable') return this.breakables.some((b) => b.broken && at(b.zone));
    if (o.cls === 'Bouncer') return this.bouncers.some((b) => b.motor.state !== 'asleep' && at(b.zone));
    if (o.cls === 'Offering') return this.offering?.motor.state === 'open';
    return false;
  }

  /** Recalcula los pisos encerrados con lo que está abierto ahora. El reloj sigue: lo corta pisar un piso libre. */
  private updateTraps(): void {
    const map = this.map;
    const layer = (name: TileLayerName) => (x: number, y: number) => {
      const tile = this.layers[name]?.getTileAt(x, y);
      return !!tile && tile.index !== -1;
    };
    const grid = trapGridFromMap({
      width: map.width,
      height: map.height,
      tile: map.tileWidth,
      // Los rompibles van por `opened`: el tile de uno roto ya no está, el de uno sano sí (y la liana no es tile).
      ground: layer('Ground'),
      platforms: layer('Platforms'),
      hazards: layer('Hazards'),
      water: layer('Water'),
      objects: this.trapObjects,
      cowReachPx: GAMEPLAY.cow.patrolDistance + 2 * map.tileWidth,
      opened: (o) => this.trapOpened(o),
    });
    const p = GAMEPLAY.player;
    // Alcance con la física del juego (S24): paso fijo de Arcade, no la fórmula continua (ver `trapReach`).
    const result = findTraps(
      grid,
      trapReach({
        gravity: GAMEPLAY.gravity,
        stepHz: this.physics.world.fps,
        tile: map.tileHeight,
        jumpVelocity: p.jumpVelocity,
        doubleJumpVelocity: this.player.motor.doubleJumpEnabled ? p.doubleJumpVelocity : undefined,
        bounceVelocity: GAMEPLAY.jungle.bounceVelocity,
        mushroomHeight: GAMEPLAY.jungle.mushroomHeight,
        bodyHeight: p.bodyHeight,
      }),
    );
    this.trapGfx?.destroy();
    this.trapGfx = undefined;
    this.trapCells = result.trappedSpans.length === 0 ? undefined : result.trapped;
    if (!this.trapCells || !DEBUG.debug) return;
    // Con ?debug=1, una raya roja sobre cada piso encerrado.
    const gfx = (this.trapGfx = this.add.graphics().setDepth(30));
    gfx.lineStyle(2, 0xd94040, 0.9);
    for (const n of result.trappedSpans) {
      const sp = result.spans[n];
      const y = (sp.y + 1) * map.tileHeight - 1;
      gfx.lineBetween(sp.x0 * map.tileWidth, y, (sp.x1 + 1) * map.tileWidth, y);
    }
  }

  /** Celda de los pies si es un piso encerrado (mira el centro y, si está sobre el vacío, cada pie). */
  private trappedUnder(body: Phaser.Physics.Arcade.Body): boolean {
    const cells = this.trapCells;
    if (!cells) return false;
    const tile = this.map.tileWidth;
    const w = this.map.width;
    const y = Math.floor((body.bottom - 1) / this.map.tileHeight);
    if (y < 0 || y >= this.map.height) return false;
    const at = (px: number) => cells[y * w + Phaser.Math.Clamp(Math.floor(px / tile), 0, w - 1)] === 1;
    return at(body.center.x) || (at(body.left + 1) && at(body.right - 1));
  }

  /**
   * Red de seguridad (S23): el tiempo corre desde que Kerana pisa un encierro y sigue mientras salta, camina o ataca
   * adentro; se corta apenas pisa un piso que no lo es (`TrapWatch`). Al cumplirse `GAMEPLAY.trap.waitMs`, vuelve al
   * último suelo firme.
   */
  private updateTrap(deltaMs: number, body: Phaser.Physics.Arcade.Body): void {
    if (!this.trapCells) return;
    if (this.trapWatch.step(deltaMs, body.blocked.down, this.trappedUnder(body), GAMEPLAY.trap.waitMs)) this.respawn('trap');
  }

  /**
   * Guarda la posición si Kerana pisa suelo firme con ambos pies y sin peligros al lado (nunca en un encierro).
   * S36: ni durante el dash (es intangible: cruzando las espinas de la chipa C de l4 guardaba un punto encima de ellas,
   * y la caída siguiente la dejaba reapareciendo sobre las espinas) ni con el cuerpo sobre una espina.
   */
  private trackSafeGround(body: Phaser.Physics.Arcade.Body): void {
    if (!body.blocked.down || this.trapWatch.active || this.player.isIntangible) return;
    const tile = this.map.tileWidth;
    const below = body.bottom + 1;
    const feetY = body.bottom - 2;
    if (!this.isSolidAt(body.left + 1, below) || !this.isSolidAt(body.right - 1, below)) return;
    if (this.tileAt('Hazards', body.left - tile, feetY) || this.tileAt('Hazards', body.right + tile, feetY)) return;
    if (this.tileAt('Hazards', body.left + 1, feetY) || this.tileAt('Hazards', body.right - 1, feetY)) return;
    this.safeGround.set(body.center.x, body.bottom);
  }

  private respawn(reason: RespawnReason): void {
    const applied = this.player.takeDamage(GAMEPLAY.damage[reason], this.player.x, reason !== 'hazard');
    if (applied) {
      AudioManager.play('hurt');
      this.hitStop(GAMEPLAY.hitStop.onHurtMs);
    }
    // La red de seguridad avisa que fue ella la que sacó a Kerana del encierro.
    if (reason === 'trap') AudioManager.play('rescue');
    if (this.player.health.isDead) this.koRespawn();
    else {
      const spot = this.respawnSpot();
      this.player.respawnAt(spot.x, spot.y);
    }
    this.cameraCtl.snap();
    EventBus.emit(GameEvents.heartsChanged, this.player.health.current, this.player.health.max);
    EventBus.emit(GameEvents.playerRespawned, reason);
  }

  /** 0 corazones (GDD §3.6): "Kerana cae" y reaparece en el último fuego con vida completa. */
  private koRespawn(): void {
    this.resetBossFight();
    this.chase?.reset();
    if (SaveManager.current.settings.flashes) this.cameras.main.flash(300, 0, 0, 0);
    this.player.koRespawn(this.checkpointPos.x, this.checkpointPos.y);
    this.cameraCtl.snap();
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
    this.impactSparks(enemy.body.center);
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
    if (enemy.touchHurts) this.hurtPlayer(enemy.x, enemy.def.contactDamage);
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
        if (pickup === this.arenaLuz) {
          this.arenaLuzUsed = true;
          this.arenaLuz = undefined;
        }
        this.player.activateLuzArasy();
        AudioManager.play('luzArasy');
        break;
      case 'pluma':
        // Se guarda al tocarla (GDD §4.6); el conteo sale del guardado, así nunca baja ni cuenta dos veces.
        SaveManager.collectFeather(this.def.id, pickup.index);
        this.feathers = SaveManager.featherCount(this.def.id);
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
        this.setFire(other, other.lit);
      }
      cp.active = true;
      this.setFire(cp, true);
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

  /** Fuego del checkpoint: fire_off sin activar, fire_on encendido (o los cuadros 0 y 4 del placeholder). */
  private makeCheckpointSprite(x: number, y: number): Phaser.GameObjects.Sprite {
    if (hasArt(this, FIRE_OFF) && hasArt(this, FIRE_ON)) {
      return this.add.sprite(x, y, FIRE_OFF).setOrigin(0.5, 1).setScale(1 / ART_DETAIL);
    }
    ensurePlaceholder(this, FIRE_PLACEHOLDER, 16, 24, 8);
    return this.add.sprite(x, y, FIRE_PLACEHOLDER, 0).setOrigin(0.5, 1);
  }

  private setFire(cp: Checkpoint, on: boolean): void {
    if (cp.sprite.texture.key === FIRE_PLACEHOLDER) cp.sprite.setFrame(on ? 4 : 0);
    else cp.sprite.setTexture(on ? FIRE_ON : FIRE_OFF);
  }

  /** Parpadeo de la llama por código: la fogata encendida se estira y se entibia un poco (GAMEPLAY.checkpointFire). */
  private flickerCheckpoints(): void {
    const f = GAMEPLAY.checkpointFire;
    const now = this.time.now / 1000;
    for (const cp of this.checkpoints) {
      if (!cp.lit || cp.sprite.texture.key !== FIRE_ON) continue;
      const phase = cp.sprite.x * 0.37;
      const wave = 0.6 * Math.sin(now * f.speedA + phase) + 0.4 * Math.sin(now * f.speedB + phase * 1.7);
      const base = 1 / ART_DETAIL;
      cp.sprite.setScale(base * (1 - f.amplitude * 0.5 * wave), base * (1 + f.amplitude * wave));
      const warm = Math.round(255 * (1 - f.tintDip * (0.5 + 0.5 * wave)));
      cp.sprite.setTint(Phaser.Display.Color.GetColor(255, warm, Math.round(warm * 0.92)));
    }
  }

  /**
   * Vitrina de props por bioma (S46, rect PropShowcase): todos los props de los atlas, agrupados por carpeta, a
   * su tamaño de sprite.json. Los que se apoyan van al piso del rect; los que cuelgan, a su techo. Cada uno lleva
   * su nombre ("carpeta/nombre" es un identificador, no un texto traducible) y cada carpeta un rótulo.
   */
  private addPropShowcase(rect: Phaser.Geom.Rectangle): void {
    const cfg = GAMEPLAY.props;
    const groups = PROP_ATLASES.map((folder) => ({
      folder,
      items: propNames(this, folder).map((name) => {
        const id = `${folder}/${name}`;
        const look = propLook(this, id);
        const frame = this.textures.getFrame(look.key, look.frame);
        return { id, width: frame.width * look.scale, height: frame.height * look.scale, hang: look.hang, waterOnly: look.waterOnly };
      }),
    }));
    const layout = layoutShowcase(groups, rect.left + cfg.showcaseGroupGap, cfg.showcaseGap, cfg.showcaseGroupGap);
    if (layout.right > rect.right) console.warn(`[vitrina] los props llegan a x=${Math.round(layout.right)}; el rect termina en ${rect.right}`);
    const labelStyle = { ...TEXT_STYLE, fontSize: `${cfg.showcaseLabelSize}px`, padding: { x: 1, y: 1 }, wordWrap: undefined };
    const tile = this.map.tileHeight;
    layout.items.forEach((item, i) => {
      addProp(this, item.x, item.hang ? rect.top + tile : rect.bottom, item.id, tile, { drops: this.splashes });
      // S47: los que solo van sobre agua (camalote, irupé) se muestran con su base dentro de una lámina de agua.
      if (item.waterOnly) {
        const h = cfg.showcaseWaterHeight;
        this.add.rectangle(item.x, rect.bottom, item.width + cfg.showcaseGap, h, SHALLOW_COLOR, 0.55).setOrigin(0.5, 1).setDepth(11);
      }
      const stagger = (i % 3) * cfg.showcaseLabelStagger;
      const labelY = item.hang ? rect.top + item.height + 2 + stagger : rect.bottom - item.height - 2 - stagger;
      this.add
        .text(item.x, labelY, item.id.split('/')[1]!, labelStyle)
        .setOrigin(0.5, item.hang ? 0 : 1)
        .setDepth(20);
    });
    for (const [g, { folder, x }] of layout.groups.entries()) {
      const tallest = Math.max(0, ...layout.items.filter((it) => it.group === g && !it.hang).map((it) => it.height));
      this.add
        .text(x, rect.bottom - tallest - cfg.showcaseLabelStagger * 4, t('vitrina.props.group', { id: folder }), TEXT_STYLE)
        .setOrigin(0, 1)
        .setDepth(20);
    }
  }

  /** Zona de cueva: el fondo de cueva (LevelBackdrop) y la roca oscura (GAMEPLAY.backdrop.caveRockTint). */
  private addCave(x: number, y: number, width: number, height: number): void {
    this.backdrop.addCave({ x, y, width, height });
    const tile = this.map.tileWidth;
    const tx = Math.floor(x / tile);
    const ty = Math.floor(y / tile);
    this.layers.Ground?.setTint(GAMEPLAY.backdrop.caveRockTint, tx, ty, Math.ceil(width / tile), Math.ceil(height / tile));
  }

  private updateSigns(): void {
    for (const sign of this.signs) sign.text.setVisible(Phaser.Geom.Rectangle.Overlaps(sign.zone, this.playerRect));
  }

  /**
   * El paso de la ofrenda (S36): frente a la puerta cerrada, Mainumby dice cuántas chipas lleva Kerana; con las tres,
   * las entrega y las raíces se recogen. La pausa ofrece volver a buscar las que faltan (`returnForChipas`).
   */
  private updateOffering(deltaMs: number): void {
    const offering = this.offering;
    if (!offering) return;
    const { door, motor } = offering;
    const cfg = GAMEPLAY.offering;
    const body = this.player.body;
    const zone = door.zone;
    const near = body.right >= zone.left - cfg.nearPx && body.left <= zone.right && body.bottom > zone.top && body.top < zone.bottom;
    const event = motor.step(deltaMs, near, this.feathers, GAMEPLAY.hud.featherMax, cfg.offerMs);
    if (event === 'offer') {
      door.playOffering(body.center.x, body.center.y);
      AudioManager.play('feather');
    } else if (event === 'opened') {
      door.open();
      this.updateTraps();
      AudioManager.play('offeringOpen');
      AudioManager.play('leaves');
    }
    const talking = motor.state === 'offering' || (near && motor.state === 'closed');
    if (talking) {
      const key = offeringLineKey(motor.state, this.feathers);
      const text = key === 'offering.open' ? t(key) : `${t(key, { current: this.feathers })}\n${t('offering.back')}`;
      if (door.line.text !== text) door.line.setText(text);
    }
    door.line.setVisible(talking);
    const can = canReturnForChipas(motor, chipaReturnTarget(this.chipaReturns, SaveManager.getFeathers(this.def.id)));
    if (this.registry.get('chipaReturn') !== can) this.registry.set('chipaReturn', can);
  }

  /**
   * Desde la pausa (S36): Kerana reaparece donde empieza el tramo de la primera chipa que falta (el fuego de antes o el
   * inicio), con ese fuego como checkpoint. Las chipas ya recogidas no reaparecen: solo hay que ir a buscar las otras.
   */
  private returnForChipas(): void {
    const target = chipaReturnTarget(this.chipaReturns, SaveManager.getFeathers(this.def.id));
    if (!target) return;
    this.chase?.reset();
    for (const cp of this.checkpoints) {
      cp.active = Math.abs(cp.zone.centerX - target.x) < 1 && Math.abs(cp.zone.bottom - target.y) < 1;
      this.setFire(cp, cp.active || cp.lit);
    }
    this.checkpointPos.set(target.x, target.y);
    this.safeGround.set(target.x, target.y);
    this.trapWatch.reset();
    this.player.respawnAt(target.x, target.y);
    this.cameraCtl.snap();
  }

  /** Congela la acción un instante para dar peso al golpe (GDD §4.1). */
  private hitStop(ms: number): void {
    this.physics.world.pause();
    this.time.delayedCall(ms, () => this.physics.world.resume());
  }

  private reportPlayerStateSfx(): void {
    const state = this.player.motor.state;
    // El salto doble no cambia de estado: se oye por su cuenta.
    const airJumped = this.player.motor.airJumped;
    if (airJumped && !this.lastAirJumped) AudioManager.play('doubleJump');
    this.lastAirJumped = airJumped;
    if (state === this.lastPlayerState) return;
    if (state === 'jump') AudioManager.play('jump');
    else if (state === 'dash') AudioManager.play('dash');
    else if ((state === 'idle' || state === 'run') && this.lastPlayerState === 'fall') {
      AudioManager.play('land');
      const body = this.player.body;
      this.dust.emitParticleAt(body.center.x, body.bottom, GAMEPLAY.juice.landDust);
    } else if (state === 'attack') {
      const charged = this.player.motor.chargedSwing;
      AudioManager.play(charged ? 'chargedSlash' : 'slash');
      if (charged) this.fireLightWave();
    }
    this.lastPlayerState = state;
  }

  /** Chispas del sable: blancas y pocas en el tajo normal, doradas y más en el cargado. */
  private updateSlashFx(): void {
    const motor = this.player.motor;
    if (!motor.attackHitboxActive) {
      this.slashSparked = false;
      return;
    }
    if (this.slashSparked) return;
    this.slashSparked = true;
    const c = this.player.body.center;
    const juice = GAMEPLAY.juice;
    if (motor.chargedSwing) {
      this.chargedSparks.explode(juice.chargedCount, c.x + motor.facing * 16, c.y);
      const ring = this.add.circle(c.x + motor.facing * 16, c.y, 6, 0xf2c14e, 0.7).setDepth(12);
      this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 180, onComplete: () => ring.destroy() });
      this.shake(juice.chargedShakeMs, juice.chargedShake);
      return;
    }
    const cfg = GAMEPLAY.slashFx;
    this.slashStreak(c.x, c.y, motor.facing, cfg);
    for (let i = 0; i < cfg.count; i++) {
      const deg = cfg.arcFromDeg + ((cfg.arcToDeg - cfg.arcFromDeg) * i) / Math.max(1, cfg.count - 1);
      const a = Phaser.Math.DegToRad(deg);
      this.slashSparks.emitParticleAt(c.x + Math.cos(a) * cfg.radius * motor.facing, c.y + Math.sin(a) * cfg.radius, 1);
    }
    this.shake(juice.slashShakeMs, juice.slashShake);
  }

  /** Arco blanco del tajo normal. El cargado usa el anillo dorado, no esto. */
  private slashStreak(x: number, y: number, facing: number, cfg: typeof GAMEPLAY.slashFx): void {
    const g = this.add.graphics().setDepth(12);
    g.lineStyle(4, 0xfff6d8, 1);
    g.beginPath();
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const deg = cfg.arcFromDeg + ((cfg.arcToDeg - cfg.arcFromDeg) * i) / steps;
      const a = Phaser.Math.DegToRad(deg);
      const px = x + Math.cos(a) * (cfg.radius + 4) * facing;
      const py = y + Math.sin(a) * (cfg.radius + 4);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
  }

  /** Polvo detrás de Kerana mientras hace dash. */
  private updateDashTrail(deltaMs: number): void {
    if (!this.player.motor.dashing) {
      this.dashTrailMs = 0;
      return;
    }
    this.dashTrailMs += deltaMs;
    if (this.dashTrailMs < GAMEPLAY.juice.dashEveryMs) return;
    this.dashTrailMs = 0;
    const body = this.player.body;
    this.dust.emitParticleAt(body.center.x - this.player.motor.facing * 10, body.center.y, 1);
  }

  /** Chispas en el punto del golpe, para que no sea solo perder vida. */
  private impactSparks(at: Phaser.Math.Vector2): void {
    this.slashSparks.emitParticleAt(at.x, at.y, 4);
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

/** Brillo suave por código: degradado radial de `color` (alfa 1 en el centro → 0 en el borde), sin borde marcado. */
function ensureSoftGlow(scene: Phaser.Scene, size: number, color: number): string {
  const key = `soft_glow_${color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return key;
  const ctx = tex.getContext();
  const r = size / 2;
  const rgb = `${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}`;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${rgb}, 1)`);
  grad.addColorStop(0.5, `rgba(${rgb}, 0.45)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return key;
}
