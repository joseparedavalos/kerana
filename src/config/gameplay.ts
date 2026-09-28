// Parámetros de sensación (GDD §3.4). Jose: ajustá estos valores libremente.
// Unidades: píxeles del juego (base 640 × 360), px/s, px/s² y milisegundos.

export const GAMEPLAY = {
  /** Gravedad del mundo (px/s²). */
  gravity: 1200,

  player: {
    /** Velocidad máxima al correr (px/s). ≈ 9 tiles por segundo. */
    runSpeed: 150,
    /** Aceleración en el suelo (px/s²). */
    groundAccel: 1600,
    /** Frenado en el suelo (px/s²). */
    groundDecel: 2000,
    /** Multiplicador de aceleración y frenado en el aire. */
    airControl: 0.8,
    /** Velocidad inicial del salto (px/s, negativa = hacia arriba). Altura ≈ 67 px. */
    jumpVelocity: -400,
    /** Al soltar saltar mientras sube, la velocidad vertical se multiplica por esto. */
    jumpCutMultiplier: 0.45,
    /** Velocidad máxima de caída (px/s). */
    maxFallSpeed: 420,
    /** Coyote time: margen para saltar después de dejar un borde (ms). */
    coyoteMs: 90,
    /** Buffer de salto: margen para pulsar saltar antes de aterrizar (ms). */
    jumpBufferMs: 110,
    /** Salto doble (don 3), px/s. */
    doubleJumpVelocity: -340,
    /** Por debajo de esta velocidad horizontal (px/s) se considera quieta. */
    idleSpeedThreshold: 5,
    /** Paso máximo de simulación (ms) para evitar saltos enormes al cambiar de pestaña. */
    maxStepMs: 50,
    /** Hitbox de Kerana (px): el cuerpo, no el frame de 64 × 64. Los pies coinciden con el borde inferior del frame. */
    bodyWidth: 16,
    bodyHeight: 42,
  },

  /** Paso de la siesta (don 4, GDD §3.3): impulso horizontal intangible, uno por vuelo. */
  dash: {
    speed: 320,
    durationMs: 160,
    /** Espera desde que termina un dash hasta poder hacer otro (ms). */
    cooldownMs: 500,
    /** Transparencia de Kerana mientras es intangible. */
    alpha: 0.45,
  },

  attack: {
    hitboxWidth: 26,
    hitboxHeight: 18,
    /** El golpe se activa desde el frame 2 y dura 90 ms. */
    activeFromFrame: 2,
    activeMs: 90,
    totalMs: 280,
    damage: 1,
    knockback: 120,
  },

  chargedSlash: {
    /** Tiempo manteniendo atacar para que el tajo salga cargado (ms). */
    holdMs: 600,
    /** El brillo de carga empieza a verse después de esto (ms), para no confundirlo con un tajo normal. */
    glowFromMs: 200,
    hitboxWidth: 40,
    hitboxHeight: 28,
    damage: 3,
  },

  /** Onda de luz del tajo cargado: sale hacia adelante al soltarlo, avanza y se desvanece (una a la vez). */
  lightWave: {
    /** Velocidad (px/s) y alcance (px, ≈ 6 tiles). */
    speed: 240,
    rangePx: 96,
    width: 14,
    height: 26,
    /** Sale a esta distancia del centro de Kerana (px). */
    offsetPx: 14,
    /** Se desvanece en el último tramo (fracción del alcance). */
    fadeFrom: 0.6,
    /** Daño a un jefe, solo en su ventana vulnerable (el tajo cargado de cerca hace `chargedSlash.damage`). */
    bossDamage: 1,
    color: 0xf2c14e,
  },

  /** Estalactitas y otros objetos que caen (GDD §6.1): aviso de polvo y caída. */
  fallingHazard: {
    /** Distancia horizontal (px) a la que Kerana dispara la estalactita. */
    triggerRangeX: 28,
    /** Aviso por defecto si el mapa no trae `delayMs`. */
    warnMs: 800,
    gravity: 900,
    maxFallSpeed: 520,
    /** Tiempo hasta que vuelve a colgar del techo (ms). */
    respawnMs: 3000,
    width: 10,
    height: 16,
    /** Tejas del nivel 4 (GDD §6.4): más anchas y bajas que una estalactita. */
    tejaWidth: 14,
    tejaHeight: 7,
    /** Rocas del cerro (GDD §6.6): redondas, con sombra en el suelo como aviso. */
    rocaSize: 14,
    /** Temblor durante el aviso (px). */
    shakePx: 1,
  },

  /** Rocas agrietadas y lianas (objeto Breakable). */
  breakable: {
    /** Golpes normales que aguanta una liana. */
    lianaHits: 1,
  },

  /** Base común de jefes (GDD §11.5). */
  boss: {
    /** Cámara lenta del último golpe (ms, tiempo real) y factor de velocidad. */
    slowMoMs: 500,
    slowMoScale: 0.25,
    /** Estallido de la marca de Tau y ascenso del hijo liberado (ms). */
    markBurstMs: 700,
    ascendMs: 1400,
    /** Cartel "Don obtenido" (ms). */
    giftBannerMs: 2200,
    /** Avisos más largos en modo asistido (GDD §4.7). */
    assistTelegraphScale: 1.3,
    /** Parpadeo del jefe al recibir un golpe (ms). */
    hitFlashMs: 80,
    /** Sacudida al cerrar la arena. */
    lockShakeMs: 250,
    lockShakeIntensity: 0.008,
  },

  /** Teju Jagua (GDD §6.1). Los tiempos de cada ataque están en src/data/bosses.ts. */
  tejuJagua: {
    /** Presentación: un par de ojos cada tantos ms. */
    introEyeMs: 260,
    headWidth: 30,
    headHeight: 18,
    neckWidth: 7,
    /** Distancia que recorre la mordida (fracción del ancho de la arena). */
    biteReach: 0.62,
    /** Velocidad del coletazo por el suelo (px/s) y tamaño de la onda. */
    tailWaveSpeed: 260,
    tailWaveWidth: 26,
    tailWaveHeight: 12,
    /** Estalactitas que caen después de cada coletazo en la fase 2 (mínimo y máximo). */
    stalactitesMin: 3,
    stalactitesMax: 4,
    /** Altura (px sobre el suelo) de las cabezas vulnerables tras el fuego. */
    fireRecoverHeadHeight: 26,
  },

  /** Mbói Tu'i (GDD §6.2). Los tiempos de cada ataque están en src/data/bosses.ts. */
  mboiTui: {
    /** Puntos donde emerge (tiles desde el borde izquierdo de la arena; ver tools/levels/l2.txt). */
    emergeTiles: [10.5, 23.5, 36.5],
    /** Islote central donde se enrosca en la fase 3 (tile desde el borde izquierdo de la arena). */
    coilTile: 17,
    headWidth: 28,
    headHeight: 20,
    neckWidth: 9,
    /** Altura de la cabeza sobre el agua al emerger (px). */
    riseHeight: 40,
    /** Alcance del picotazo desde el punto donde emerge (px). */
    peckReach: 96,
    /** En la fase 3 pica desde el islote central: el cuello se estira más (px). */
    coiledPeckReach: 210,
    /** Altura del arco del picotazo (px). */
    peckArc: 36,
    /** Tras el graznido, la cabeza cae agotada hacia Kerana (px). */
    slumpReach: 40,
    /** Anillos del graznido: tamaño, velocidad (px/s), separación (ms) y empuje. */
    ringWidth: 14,
    ringHeight: 26,
    ringSpeed: 150,
    ringGapMs: 450,
    ringsPerSquawk: 2,
    pushSpeed: 260,
    pushMs: 220,
    /** Escupitajo: bolas por ataque, velocidad vertical inicial, gravedad y separación horizontal. */
    spitBalls: 3,
    spitVy: -260,
    spitGravity: 600,
    spitSpreadVx: 40,
    spitRadius: 5,
    /** Fase 3: una flor que cura cada tanto (ms), cuántas a la vez y cuánto tarda en caer. */
    flowerEveryMs: 4000,
    flowerMax: 2,
    flowerFallMs: 2600,
    flowerHeal: 1,
    /** Desfase del ciclo automático entre camalotes de la arena (ms). */
    platformCycleOffsetMs: 900,
  },

  /** Camalotes y agua (GDD §4.8, §6.2). */
  monai: {
    /** Árboles de la arena: centro del tronco en tiles desde el borde izquierdo (ver tools/levels/l3.txt). */
    treeTiles: [8.5, 20.5, 32.5],
    /** Altura de las copas sobre el suelo (tiles) y medio ancho del tronco (px). */
    canopyTiles: 3,
    trunkHalfWidth: 6,
    headWidth: 26,
    headHeight: 18,
    /** Cuerpo de serpiente: segmentos, separación (px) y radio del primero. */
    segments: 14,
    segmentGap: 7,
    segmentRadius: 7,
    /** Escondido en la copa: cuánto asoma sobre ella (px). */
    perchRise: 14,
    /** La sombra sigue a Kerana hasta esta fracción del aviso y después queda fija. */
    shadowTrackFraction: 0.7,
    shadowWidth: 40,
    /** Pulso de hipnosis: alcance (px, GDD §6.3), grosor del anillo que la toca (px) y separación del tronco. */
    pulseRadius: 200,
    pulseBand: 18,
    pulseTrunkOffsetTiles: 1.5,
    /** Robo: la embestida sigue de largo después de Kerana (px). */
    stealOvershoot: 40,
    /** Cola (hitbox en la ventana del robo). */
    tailWidth: 22,
    tailHeight: 16,
    /** Vuelo entre copas (ms). */
    flyMs: 500,
  },
  wind: {
    /** Ciclo de cada zona (ms): calma, aviso (pasto inclinado y partículas, GDD §4.8) y ráfaga. */
    calmMs: 2200,
    warnMs: 1000,
    gustMs: 2000,
    /** Empuje por defecto (px/s) que se suma a la carrera (runSpeed es 150). */
    speed: 90,
    /** Pasto: separación y alto de las matas (px); inclinación en el aviso y en la ráfaga (grados). */
    grassSpacing: 12,
    grassHeight: 7,
    warnLeanDeg: 15,
    gustLeanDeg: 40,
    /** Partículas de viento: velocidad (px/s), vida (ms) y probabilidad por frame. */
    streakSpeed: 220,
    streakLifeMs: 500,
    streakChanceWarn: 0.15,
    streakChanceGust: 0.5,
  },
  hypnosis: {
    /** Controles invertidos (ms), GDD §4.8. */
    durationMs: 3000,
    /** Icono de espiral sobre Kerana: altura (px) y giro (grados por segundo). */
    iconOffsetY: 52,
    iconSpinDegPerS: 360,
  },
  /** Sueño de siesta (GDD §4.8): quieta dentro de la niebla → bostezo → se duerme. */
  sleep: {
    /** Quieta este tiempo dentro de la niebla y se duerme (ms). */
    stillToSleepMs: 2000,
    /** Bostezo de aviso (ms de quietud). */
    yawnAtMs: 1200,
    /** Dormida (ms). */
    sleepMs: 1500,
    /** Cada botón pulsado dormida acorta el sueño en esto (ms). */
    pressCutMs: 250,
    /** "Zzz" sobre Kerana (px) y niebla: opacidad y deriva (ms por vaivén). */
    iconOffsetY: 50,
    fogAlpha: 0.28,
    fogDriftMs: 2600,
  },
  /** Jasy Jatere (GDD §6.4). Los tiempos de cada ataque están en src/data/bosses.ts. */
  jasyJatere: {
    /** Lugares a los que salta: tiles desde el borde izquierdo de la arena y altura sobre el suelo (tiles). Ver l4.txt. */
    spots: [
      { tx: 4, ty: 3 },
      { tx: 9, ty: 0 },
      { tx: 18, ty: 6 },
      { tx: 30, ty: 0 },
      { tx: 37, ty: 3 },
    ],
    width: 14,
    height: 34,
    /** Salto entre lugares (ms) y altura del arco (px). */
    hopMs: 520,
    hopArc: 40,
    /** Chispas doradas: cuántas, apertura del abanico (grados), velocidad (px/s), vida (ms) y radio (px). */
    sparks: 3,
    sparkSpreadDeg: 22,
    sparkSpeed: 170,
    sparkLifeMs: 1600,
    sparkRadius: 4,
    /** Invisible: opacidad del brillo tenue y tiempo visible tras cada golpe (ms). */
    invisibleAlpha: 0.1,
    revealMs: 2000,
    /** Pistas: silbido (ms entre uno y otro), notas musicales (ms) y huellas de polvo (px entre huellas, cuántas). */
    whistleEveryMs: 1400,
    noteEveryMs: 380,
    footprintGapPx: 14,
    footprintMax: 10,
    footprintFadeMs: 1400,
    /** Emboscada: corre hasta pasar a Kerana por esto (px) y se acerca a esta distancia antes del aviso (px). */
    ambushOvershoot: 36,
    ambushApproach: 90,
    /** Enjambres que puede tener a la vez. */
    maxSwarms: 2,
    /** Carrera por el bastón: vuelo (ms), lo que tarda él en recuperarlo (ms) y tamaño del bastón (px). */
    staffFlyMs: 900,
    raceMs: 3000,
    staffWidth: 6,
    staffHeight: 24,
  },
  /** Kurupi (GDD §6.5, pies al revés). Los tiempos de cada ataque están en src/data/bosses.ts. */
  kurupi: {
    width: 26,
    height: 44,
    /** Lugares del suelo (tiles desde el borde izquierdo de la arena) para caminar y para las copias. Ver l5.txt. */
    floorSpots: [6, 20, 34],
    /** Ramas altas donde aparecen los ka'i (tiles desde el borde izquierdo y altura sobre el suelo). */
    kaiSpots: [
      { tx: 10.5, ty: 6 },
      { tx: 30.5, ty: 6 },
    ],
    /** Los kuati del llamado aparecen a esta distancia de los bordes (tiles). */
    edgeSpawnTiles: 2,
    /** Llamado de la selva: kuati por llamado; probabilidad de que venga un ka'i en vez de kuati. */
    callKuati: 2,
    callKaiChance: 0.35,
    /** Enemigos llamados vivos a la vez (el llamado no suma más). */
    maxMinions: 3,
    /** Caminata entre ataques (px/s) y embestida corta de la fase 1 (px). */
    walkSpeed: 60,
    chargeDistance: 150,
    /** Carrera al revés (fase 2) y de las copias (fase 3): hasta esta distancia del borde (px). */
    runEdgeMarginPx: 24,
    /** Huellas: px entre huellas, cuántas y cuánto tardan en borrarse (ms). */
    footprintGapPx: 14,
    footprintMax: 14,
    footprintFadeMs: 1800,
    /** Pisotón: ondas de hojas por el suelo (velocidad px/s, alto px, vida ms). */
    waveSpeed: 150,
    waveHeight: 10,
    waveWidth: 18,
    waveLifeMs: 1700,
    /** Copias (fase 3): parpadeo al aparecer (ms por destello) y opacidad. */
    copyBlinkMs: 90,
    copyAlpha: 0.9,
  },
  /** Ao Ao (GDD §6.6). Los tiempos de cada ataque están en src/data/bosses.ts. */
  aoAo: {
    width: 44,
    height: 30,
    /** Erguido en dos patas (fase 2): alto del cuerpo. */
    rearHeight: 46,
    /** Rocas grandes de la arena (tiles desde el borde izquierdo al centro de la roca, y medio ancho en px). Ver l6.txt. */
    rockTiles: [12, 28],
    rockHalfWidthPx: 16,
    /** Pindó de la arena (tiles desde el borde izquierdo al centro): da vueltas al pie aullando. */
    pindoTiles: [3.5, 36.5],
    /** Lugar de inicio (tiles desde el borde izquierdo). */
    startTile: 20,
    /** Embestida: margen a los bordes de la arena (px); caminata entre ataques (px/s). */
    edgeMarginPx: 20,
    walkSpeed: 50,
    /** Zarpazo: alcance delante del cuerpo (px) y alto (px). */
    clawReachPx: 34,
    clawHeight: 40,
    /** Crías por aullido (fase 2 y 3) y máximo vivas a la vez. */
    cubsPerHowl: [2, 3],
    maxCubs: 3,
    /** Los cachorros aparecen a esta distancia de los bordes (tiles). */
    edgeSpawnTiles: 2,
    /** Fase 3: rocas que caen del cerro por ataque (con sombra 0,8 s). */
    rocksPerFall: 3,
    rockFallGapMs: 250,
    /** Refugio: aullido mientras Kerana está en el pindó (ms entre aullidos) y velocidad de las vueltas (px/s). */
    refugeHowlEveryMs: 1800,
    refugeCircleSpeed: 45,
    /** Cuánto se aleja al dar vueltas al pie del pindó (px). */
    refugeCirclePx: 28,
  },

  /** Pindó (GDD §6.6): refugio. Kerana está a salvo parada en la copa. */
  pindo: {
    /** Tolerancia vertical entre los pies y la copa (px). */
    feetTolerancePx: 3,
    trunkWidth: 5,
  },

  /** Vacas sueltas de Capiatá (extra del nivel 4): caminan despacio, mugen y sirven de plataforma. */
  cow: {
    width: 30,
    height: 18,
    speed: 14,
    patrolDistance: 56,
    /** Mugido: cada cuánto, al azar entre estos valores (ms); solo si está en pantalla. */
    mooMinMs: 4000,
    mooMaxMs: 9000,
    /** Pausa al llegar a cada punta de la patrulla (ms). */
    turnPauseMs: 1200,
  },

  /** Enjambre de abejas (GDD §5.2 Swarm): se dibuja con partículas. */
  swarm: {
    /** Partículas: cada cuánto sale una (ms), vida (ms) y dispersión (px). */
    particleEveryMs: 35,
    particleLifeMs: 420,
    spreadPx: 9,
    /** Oscilación del enjambre mientras persigue (px y Hz). */
    wobblePx: 10,
    wobbleHz: 2.2,
  },
  water: {
    /** Velocidad de carrera en agua baja (× runSpeed). */
    shallowSpeedFactor: 0.6,
    /** Alto del agua baja que se dibuja sobre los pies (px). */
    shallowDepthPx: 6,
    /** Salpicaduras al correr en agua baja (ms entre una y otra). */
    splashEveryMs: 120,
    /** Camalote: se hunde tras pisarlo, reaparece y ciclo automático (fase 3 del jefe). */
    sinkDelayMs: 1200,
    respawnMs: 3000,
    cycleFloatMs: 2400,
    /** Grosor del camalote (px) y cuánto baja al hundirse. */
    raftHeight: 6,
    sinkDepthPx: 10,
  },

  /** Selva (GDD §6.5): hongos que rebotan y ramas que se quiebran. */
  jungle: {
    /** Velocidad del rebote del hongo (px/s, negativa = arriba). ≈ 7,5 tiles de altura. */
    bounceVelocity: -540,
    /** Alto del sombrero del hongo (px) y aplastamiento visual al rebotar. */
    mushroomHeight: 10,
    squashMs: 140,
    /** Rama que se quiebra: aviso (crujido) desde que se pisa (ms) y tiempo hasta reaparecer (ms). */
    crumbleDelayMs: 600,
    crumbleRespawnMs: 3000,
    /** Grosor de la rama (px), temblor del aviso (px) y caída al quebrarse (px). */
    branchHeight: 6,
    crumbleShakePx: 1,
    crumbleFallPx: 40,
  },

  hurt: {
    invulnerableMs: 1000,
    invulnerableAssistMs: 2000,
    blinkHz: 10,
    knockbackX: 160,
    knockbackY: -220,
    /** Control reducido tras el daño (GDD §3.5). */
    reducedControlMs: 250,
  },

  /** Efectos por código sobre el sprite de Kerana (GDD §9.4). */
  playerFx: {
    /** Parpadeo ocasional de ojos en idle: espera al azar entre estos dos valores (ms). */
    blinkMinMs: 2500,
    blinkMaxMs: 6000,
    /** Destello al recibir daño: duración total y cambio rojo/blanco (ms). */
    hurtFlashMs: 240,
    hurtFlashPeriodMs: 60,
    hurtFlashRed: 0xff3030,
    hurtFlashWhite: 0xffffff,
    /** Brillo de carga del tajo cargado (S6): color oro y fuerza máxima del Glow. */
    chargeGlowColor: 0xf2c14e,
    chargeGlowStrength: 4,
  },

  hitStop: {
    onHitMs: 50,
    onHurtMs: 80,
  },

  luzArasy: {
    durationMs: 8000,
    durationAssistMs: 12000,
    blinkLastMs: 2000,
  },

  hearts: {
    start: 4,
    max: 7,
    assistBonus: 3,
  },

  camera: {
    /** Suavizado del seguimiento (0 a 1; 1 = sin suavizado). */
    lerp: 0.12,
    deadzoneWidth: 60,
    deadzoneHeight: 40,
    /** Anticipación hacia donde mira Kerana (px). */
    lookahead: 40,
    /** Suavizado del cambio de anticipación al girar (0 a 1 por frame). */
    lookaheadLerp: 0.05,
  },

  respawn: {
    /** Parpadeo al reaparecer tras caer a un pozo o al agua (ms). */
    flashMs: 400,
    /** Margen (px) bajo el mapa para considerar que cayó al pozo. */
    pitMargin: 32,
  },

  damage: {
    /** Daño al tocar un enemigo (GDD §3.6). */
    enemyContact: 1,
    /** Daño al tocar espinas (GDD §4.3). */
    hazard: 1,
    /** Daño al caer a un pozo (GDD §3.6). */
    pit: 1,
    /** Daño al caer al agua honda (GDD §3.6). */
    water: 1,
  },

  pickups: {
    /** Corazones que cura un guavirá (GDD §4.3). */
    guaviraHeal: 1,
  },

  hud: {
    /** Plumas coleccionables por nivel (GDD §4.4). */
    featherMax: 3,
  },
} as const;

export type GameplayConfig = typeof GAMEPLAY;
export type PlayerConfig = { readonly [K in keyof GameplayConfig['player']]: number };
