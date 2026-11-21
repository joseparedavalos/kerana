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
    /**
     * El borde de abajo del tajo queda a esta distancia de los pies (px).
     * Sin esto el tajo normal terminaba 12 px sobre el suelo y no tocaba al teju (10) ni al mbói (8).
     */
    groundGap: 2,
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
    /** Al chocar con el terreno (Ground) se apaga en este tiempo (ms). */
    wallFadeMs: 120,
    /** Color de la media luna con que se dibuja (S80; su forma, en `chargeFx.crescent`). */
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
    // S22: bloque frágil ("%", tajo normal) y aspecto propio de cada clase, distinto del terreno.
    /** Golpes normales que aguanta un bloque frágil. */
    brittleHits: 1,
    /** Roca agrietada (pide el tajo cargado): piedra gris azulada con grietas que brillan con la luz del tajo. */
    rockColor: 0x6e7487,
    rockEdgeColor: 0xa3a9bd,
    rockCrackColor: 0x24263a,
    rockGlowColor: 0xf2c14e,
    /** El brillo de las grietas late entre estas opacidades, con este período (ms). */
    rockGlowAlphaMin: 0.3,
    rockGlowAlphaMax: 0.95,
    rockGlowPulseMs: 900,
    /** Bloque frágil (tajo normal): fardo de totora seca, paja clara con hebras y una atadura. */
    brittleColor: 0xd2ab62,
    brittleStrandColor: 0x8e6a32,
    brittleTieColor: 0xf0deaa,
    /** Liana: hojas claras y ataduras del mismo color que el fardo (se corta con el tajo normal). */
    lianaLeafColor: 0x7cc25a,
    /** Lo que estaba apoyado encima de un rompible cae hasta el suelo a esta velocidad (px/s). */
    dropSpeed: 240,
    /** Holgura (px) para decidir qué está apoyado sobre la cara de arriba. */
    restTolerancePx: 6,
  },

  /** Partículas del tajo normal (S22): unas pocas chispas en el arco del sable, discretas. */
  slashFx: {
    /** Chispas por tajo, repartidas en el arco. */
    count: 9,
    /** Radio del arco (px) desde el centro del cuerpo y ángulos de inicio y fin (grados; 0 = adelante, negativo = arriba). */
    radius: 22,
    arcFromDeg: -70,
    arcToDeg: 45,
    lifespanMs: 220,
    /** Velocidad hacia afuera (px/s) y tamaño de cada chispa (escala sobre 3 px). */
    speed: 80,
    scale: 1.2,
    alpha: 0.85,
    tint: 0xfff4d6,
  },

  /**
   * Estela del dash (S83): siluetas de Kerana que quedan atrás y se apagan, y un polvo al arrancar.
   * Sin brillo (Glow): lo único que brilla es el dorado del tajo cargado.
   */
  dashFx: {
    /** Deja una copia cada tantos ms mientras dura el dash (la primera, al arrancar). */
    everyMs: 40,
    /** Copias vivas a la vez como máximo: si hace falta otra, se reusa la más vieja. */
    maxGhosts: 4,
    /** Opacidad con la que nace cada copia; baja a 0 en `fadeMs` y la copia se apaga. */
    alpha: 0.5,
    fadeMs: 200,
    /** Tinte de las copias y del polvo. `tintFill`: la copia es una silueta plana de ese color (si no, multiplica). */
    tint: 0xcfe3f2,
    tintFill: true,
    /** Polvo de salida: partículas a los pies, hacia el lado contrario al del dash. */
    dust: {
      count: 6,
      lifespanMs: 180,
      /** Velocidad (px/s), escala sobre 3 px (empieza y baja a 0) y opacidad inicial. */
      speedMin: 40,
      speedMax: 90,
      scale: 0.8,
      alpha: 0.8,
      /** Abanico (± grados) alrededor de la dirección de atrás, y cuánto se levanta del suelo (grados). */
      spreadDeg: 25,
      liftDeg: 15,
    },
  },

  /** Peso del golpe (sesión 2). La usabilidad del tajo cargado no cambia. La sacudida respeta Opciones. */
  juice: {
    /** Sacudida del tajo normal y del cargado (ms, intensidad de Phaser). */
    slashShakeMs: 70,
    slashShake: 0.004,
    chargedShakeMs: 90,
    chargedShake: 0.006,
    /** Polvo al tocar el suelo después de caer. */
    landDust: 6,
  },

  /**
   * Cómo se ve el tajo cargado (S80, GDD §9.7). Solo dibujo: cuánto hay que mantener, el daño y la onda
   * (velocidad, alcance, daño) siguen en `chargedSlash` y `lightWave`. Principio: pocos elementos y grandes.
   */
  chargeFx: {
    /** Carga: hebras finas de luz que entran desde afuera hacia el filo y se acortan al acercarse. */
    strands: {
      /** Cuántas puede haber a la vez. */
      max: 8,
      /** Nace una cada tantos ms: al empezar a verse la carga y al completarla (se interpola: cada vez más seguido). */
      everyStartMs: 110,
      everyEndMs: 40,
      /** Distancia desde la que entra la cabeza (unidades) y lo que tarda en llegar al filo (ms), a paso parejo. */
      fromDistance: 22,
      travelMs: 220,
      /** Largo al nacer (unidades): se acorta en proporción a lo que le falta, hasta 0 en el filo. */
      length: 14,
      /** Grosor (unidades) y color (se suma al fondo: mezcla aditiva). */
      width: 1.5,
      color: 0xffd877,
      /** Opacidad de la cabeza al nacer y al llegar (nace tenue lejos y se aclara en el filo), y de la cola respecto de la cabeza. */
      alphaFrom: 0.45,
      alphaTo: 1,
      tailAlpha: 0.5,
      /** De dónde entran (grados, mirando a la derecha; 0 = adelante, −90 = arriba): nunca de atrás, a través del cuerpo. */
      arcFromDeg: -125,
      arcToDeg: 50,
      /** Tramo del sable donde caen: de esta fracción del largo (0 = mango) a la punta. */
      bladeFrom: 0.35,
    },
    /** El filo se calienta mientras carga: opacidad máxima de la luz sobre el sable antes de estar listo. */
    bladeChargingAlpha: 0.3,
    /** Listo: el filo queda encendido y quieto (luz sobre el sable y Glow solo alrededor del sable, no del cuerpo). */
    bladeReadyAlpha: 0.8,
    bladeColor: 0xfff2c0,
    bladeGlowColor: 0xf2c14e,
    bladeGlowStrength: 2,
    /**
     * Destello de «listo» en la punta: estrella de cuatro puntas (unidades) que se apaga en seco (ms), y el filo en
     * blanco un instante (ms). Con «Destellos: no» en Opciones (GDD §4) no sale ninguno de los dos: el filo se enciende igual.
     */
    readyStarSize: 22,
    readyStarMs: 120,
    readyStarColor: 0xffffff,
    readyWhiteMs: 70,
    /**
     * Cómo se encuentra el sable en el dibujo de Kerana (la luz se dibuja sobre esos píxeles, cuadro a cuadro):
     * dorado (rojo alto, azul casi nulo) o su brillo (verde alto, rojo muy sobre azul). La piel y el vestido no pasan.
     */
    bladeMask: {
      minAlpha: 128,
      minRed: 220,
      goldMaxBlue: 50,
      goldMinGreen: 130,
      shineMinGreen: 200,
      shineMinRedOverBlue: 85,
      minPixels: 20,
    },
    /** El pecho (unidades sobre los pies): la punta del sable es lo más lejos de acá. */
    pivotHeight: 24,
    /** Sin sable en el cuadro (o sin sprite): punto del filo respecto de los pies, mirando a la derecha (unidades). */
    fallbackTip: { x: 14, y: -40 },
    fallbackBase: { x: 4, y: -22 },
    /**
     * Descarga: la onda de luz (`lightWave`) se dibuja como una media luna con la panza hacia adelante y los cuernos
     * hacia atrás. Alto, panza (cuánto se curva) y grosor en el centro (unidades); `edge` es la línea clara del borde
     * de adelante. El color del cuerpo y del halo es `lightWave.color`.
     */
    crescent: {
      height: 30,
      bulge: 8,
      thickness: 6,
      edge: 1.5,
      edgeColor: 0xfff6d8,
      /** Opacidad del cuerpo, y del halo que lo rodea (`halo` unidades más ancho por cada lado). */
      bodyAlpha: 0.85,
      halo: 1.5,
      haloAlpha: 0.35,
      /** Opacidad de toda la media luna (la onda además se desvanece al final de su alcance). */
      alpha: 0.95,
      /** Sale del filo chica y se estira: escala inicial (alto y ancho) y en cuánto llega a su tamaño (ms). */
      startScaleY: 0.3,
      startScaleX: 0.5,
      stretchMs: 110,
    },
    /** Chispas de la descarga: pocas y grandes (estrellitas como la de «listo»), hacia adelante en un abanico. */
    sparks: {
      count: 4,
      size: 7,
      speedMin: 50,
      speedMax: 120,
      spreadDeg: 40,
      lifespanMs: 320,
      color: 0xfff2c0,
    },
  },

  /** Base común de jefes (GDD §11.5). */
  boss: {
    /** S91: tiles desde el borde izquierdo de la arena donde se empieza a buscar su entrada (el punto de regreso al trabarse). */
    arenaEntryTiles: 2,
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
    /** Luz de Arasy de la arena en modo asistido (GDD §4.7): tiles desde el borde izquierdo de la arena. */
    assistLuzOffsetTiles: 4,
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
    /** Cabeza (hitbox y placeholder, en unidades). S12d: el doble que antes (30 × 18). */
    headWidth: 60,
    headHeight: 36,
    /**
     * Grosor del cuello en la base (unidades; junto a la cabeza es `neckTipScale` × esto). S20: de 14 a 18 para que no
     * se vean como hilos al lado de la cabeza. Si se engrosan mucho tapan la arena y a Kerana: probar de a 2.
     */
    neckWidth: 18,
    /**
     * Tamaño del cuerpo (lomo, patas y cola) respecto del dibujo de S13d (1 = como era). S20: 0,65 devuelve suelo para
     * esquivar. Los anclajes de los cuellos, la cola y las cabezas en reposo y dormidas se recalculan solos.
     */
    bodySize: 0.65,
    /**
     * Abanico de cabezas en reposo: separación horizontal, subida hacia el centro, altura de las cabezas de las puntas
     * sobre la cima del lomo y separación de los cuellos en el lomo (esta, a tamaño 1: se multiplica por `bodySize`).
     */
    fanSpacing: 72,
    fanRise: 12,
    fanLift: 25,
    neckSpacing: 36,
    /** Los cuellos nacen tantas unidades por debajo de la superficie del lomo (a tamaño 1). */
    neckRootInset: 6,
    /**
     * Cabezas dormidas: se apoyan sobre el lomo, repartidas en `sleepSpread` × el semiancho del lomo por cada lugar del
     * abanico, y hundidas `sleepSink` × su alto (que no queden flotando).
     */
    sleepSpread: 0.28,
    sleepSink: 0.3,
    /** Dónde se engancha el cuello: unidades detrás del centro de la cabeza (el dibujo es más angosto que la hitbox). */
    neckAttachX: 10,
    /** Ojos que brillan: posición respecto del centro de la cabeza (hacia el hocico) y escala. */
    eyeOffsetX: 2,
    eyeOffsetY: 0,
    eyeScale: 1,
    /** Distancia que recorre la mordida (fracción del ancho de la arena). */
    biteReach: 0.62,
    /** Velocidad del coletazo por el suelo (px/s) y tamaño de la onda (la hitbox; la cresta dibujada mide lo mismo). */
    tailWaveSpeed: 260,
    tailWaveWidth: 26,
    tailWaveHeight: 12,
    /**
     * Dibujo del coletazo (S20, sin tocar la hitbox): estela de tierra detrás de la cresta (unidades), polvo que va
     * soltando (cada tantos ms) y cuánto se ondula la cresta (fracción del alto, ciclo en ms).
     */
    tailWaveTrail: 34,
    tailWaveDustMs: 45,
    tailWaveWobble: 0.12,
    tailWaveWobbleMs: 260,
    /**
     * Aviso del coletazo (S20; el tiempo sigue en bosses.ts): el suelo tiembla por el recorrido de la onda. Un frente de
     * polvo y piedritas sale del borde donde nace la onda y llega al otro borde en `tailWarnSweep` del aviso; suelta
     * polvo cada `tailWarnDustMs`. Grieta del suelo: alto y temblor (unidades). Sacudida de cámara suave.
     */
    tailWarnSweep: 0.7,
    tailWarnDustMs: 40,
    tailWarnCrackHeight: 2,
    tailWarnCrackJitter: 1.5,
    tailWarnShake: 0.0025,
    /** Estalactitas que caen después de cada coletazo en la fase 2 (mínimo y máximo). */
    stalactitesMin: 3,
    stalactitesMax: 4,
    /** Altura (px sobre el suelo) de las cabezas vulnerables tras el fuego. */
    fireRecoverHeadHeight: 36,
    /**
     * Llamarada (S21, solo dibujo: la zona de daño sigue siendo el tercio de la arena). El cuerpo naranja de la llama
     * mide exactamente la zona (sus bordes se agitan hacia adentro hasta `fireCoreJitter` unidades, nunca hacia
     * afuera); lo que desborda es tenue (`fireSpill` unidades a cada lado, alfa `fireSpillAlpha`). Dos chorros
     * amarillos salen de los hocicos (`fireMouthX/Y` desde la punta del hocico) y se abren hasta `fireJetSpread` del
     * ancho de la zona al llegar al suelo. `fireFlickerMs`: ciclo de las lenguas del borde.
     */
    fireMouthX: 8,
    fireMouthY: 8,
    fireJetSpread: 0.5,
    fireCoreAlpha: 0.85,
    fireCoreJitter: 3,
    fireSpill: 12,
    fireSpillAlpha: 0.28,
    fireFlickerMs: 180,
    /**
     * Efectos de la llamarada: pavesas cada `fireEmberMs`; aire que tiembla a los costados (`fireHazeAlpha`; 0 lo
     * apaga); suelo iluminado `fireFloorGlow` unidades más allá de la zona (alfa `fireFloorGlowAlpha`). Sacudida de
     * cámara mientras sopla (`fireShake`, 0 la apaga).
     */
    fireEmberMs: 30,
    fireHazeAlpha: 0.14,
    fireFloorGlow: 18,
    fireFloorGlowAlpha: 0.3,
    fireShake: 0.0015,
    /**
     * Aviso del fuego (S21; el tiempo sigue en bosses.ts): además del humo en los hocicos, el suelo de la zona se tiñe
     * desde abajo de las cabezas hasta los bordes en `fireWarnSweep` del aviso (alfa máx. `fireWarnFloorAlpha`), el
     * aire de la zona brilla cada vez más (`fireWarnColumnAlpha`, con los bordes marcados), un resplandor de
     * `fireWarnGlow` unidades sube del suelo teñido y sube calor cada `fireWarnHeatMs`.
     */
    fireWarnSweep: 0.6,
    fireWarnFloorAlpha: 0.85,
    fireWarnColumnAlpha: 0.3,
    fireWarnGlow: 28,
    fireWarnHeatMs: 45,
    /**
     * Cabeza expuesta (S20; ventana del fuego y de la mordida, sin cambiar su duración): halo dorado detrás que late y
     * estrellitas de mareo que giran encima. Se apaga sola cuando se cierra la ventana. Halo: margen alrededor de la
     * cabeza (unidades), latido (ms) y alfa mínimo/máximo. Estrellas: cantidad, radio de la órbita y vuelta (ms).
     */
    exposedHaloMargin: 10,
    exposedPulseMs: 450,
    exposedHaloAlphaMin: 0.35,
    exposedHaloAlphaMax: 0.85,
    exposedStars: 3,
    exposedStarOrbit: 15,
    exposedStarSpinMs: 900,
    /**
     * Forma de los cuellos (solo dibujo; S101 los dibuja como tubos en tejuJaguaArt.ts): Bézier del lomo a la cabeza
     * con grosor `neckWidth` en la base y `neckTipScale` × eso junto a la cabeza. Punto de control: `neckCurveLean` del
     * camino en x hacia la cabeza y `neckCurveRise` unidades por encima del extremo más alto (más = más arqueado).
     */
    neckTipScale: 0.55,
    neckCurveLean: 0.2,
    neckCurveRise: 28,
    /**
     * Lomo: montículo de `bodyWidth` de ancho cuya cima queda `bodyTop` unidades sobre el centro del cuerpo; `bodyDepth`
     * es el semieje vertical del óvalo. Es el anclaje de los cuellos y de las cabezas dormidas: el dibujo (S101) sigue
     * ese óvalo por arriba y debajo arma el lagarto agazapado.
     */
    bodyWidth: 320,
    bodyTop: 55,
    bodyDepth: 95,
    /**
     * Tinte de las cabezas: el dibujo es gris y este valor lo deja en el marrón del lomo. S101: la paleta del cuerpo
     * sale de la cabeza así teñida.
     */
    headColor: 0x7b6d5d,
  },

  /**
   * Teju Jagua, solo el dibujo (S101; tejuJaguaArt.ts y la parte visual de TejuJagua.ts). Nada de esto toca la pelea:
   * hitboxes, tiempos, ventanas y anclajes siguen en `tejuJagua` y en bosses.ts. La paleta se midió en la cabeza teñida
   * (pelo y hocico) y en el fondo de la caverna (roca azul violeta, cristales cian y el oro del fondo).
   */
  tejuJaguaLook: {
    /** Rampas por material, de la sombra a la luz. `skin[0]` y `outline` son el contorno. */
    palette: {
      outline: 0x090807,
      skin: [0x0d0b0a, 0x1a1611, 0x28221a, 0x372f25, 0x483e31, 0x5c5040, 0x736553],
      belly: [0x1e1912, 0x372e22, 0x524633, 0x6e6046, 0x8b7a5b, 0xa69472],
      bone: [0x1a1714, 0x3a332a, 0x5a5145, 0x7e7463, 0xa59a86, 0xc6bba4],
      moss: [0x141a12, 0x1f2a19, 0x2c3a22, 0x3e4e2c, 0x55663a],
      /** Borde frío de los cristales (arriba y atrás) y rebote cálido del oro (desde el centro del fondo, bajo). */
      cold: [0x1f2d35, 0x2f4a55, 0x45707b, 0x6a9fa8, 0x9fd0d6],
      warm: [0x352818, 0x56432a, 0x7c6537, 0xa58b4c, 0xcfb26a],
      scar: [0x3b2e2a, 0x5c4840, 0x7a645a, 0x957f74],
      /** Pelo de la crin: el gris de la cabeza multiplicado por `tejuJagua.headColor`. */
      fur: [0x110f0d, 0x221e1a, 0x332c25, 0x4c4239, 0x5c5145, 0x6b5f50, 0x796a5a],
      /** Ojos: brasa, núcleo y el rojo de la furia (el resplandor se suma a la escena). */
      eye: 0xff6a24,
      eyeHot: 0xffe08a,
      eyeFury: 0xff3a14,
      mouth: 0xff8a2a,
    },
    /**
     * Luz del cuerpo pintado: relleno tenue desde adelante (dirección x, y hacia arriba, z hacia la cámara), borde frío
     * de los cristales (arriba, a cada costado: el x va del lado de cada punto) y rebote cálido del oro (arriba y detrás
     * del centro: el x apunta al centro, y manda en el medio del lomo). `from`/`to`: dónde empieza y satura cada luz.
     * `floorShade`: alto (unidades) de la sombra propia contra el suelo. `dither`: cuánto se mezclan los tonos vecinos.
     */
    light: {
      fill: [-0.45, 0.65, 0.6],
      ambient: 0.08,
      diffuse: 1.05,
      cold: [0.45, 0.75, -0.5],
      coldFrom: 0.32,
      coldTo: 0.8,
      coldStrength: 3.4,
      warm: [0.5, 0.55, -0.7],
      warmFrom: 0.25,
      warmTo: 0.75,
      warmStrength: 3.4,
      /** Hasta dónde le pega el oro a los cuellos (fracción del semiancho del lomo, desde el centro). */
      warmReach: 0.45,
      floorShade: 34,
      dither: 0.75,
      /** Tonos de la rampa que recorre la luz de relleno (menos = cuerpo más oscuro). */
      toneSpan: 4.6,
    },
    /**
     * Escamas (celdas de Voronoi, no un sello repetido): tamaño en el lomo y en los flancos bajos, en las patas,
     * cuánto abomban y el ancho de la grieta entre escamas (unidades).
     */
    scales: { large: 6.4, small: 2.5, leg: 2.3, bulge: 0.6, crevice: 0.45 },
    /** Musgo en lo que mira hacia arriba: umbral del ruido (más alto = menos musgo) y escala del ruido (unidades). */
    moss: { threshold: 0.66, scale: 7 },
    /**
     * Respiración: cuadros pintados del cuerpo (sube `scale` de su alto al inspirar; las patas quedan clavadas),
     * período y cuánto se acelera con la furia (fracción a seis cabezas dormidas).
     */
    breath: { frames: 3, scale: 0.014, periodMs: 2600, furyFaster: 0.45 },
    /**
     * Cuellos: tramos del tubo, ensanche en el collar, paso de las placas (fracción del grosor) y de las del vientre
     * (unidades), hasta dónde llega la cresta y desde dónde empieza la crin (fracción del cuello, 0 = lomo), largo
     * de las púas y de la crin (unidades). Ondulación: amplitud (unidades) y período (ms) despierta y dormida; la onda
     * viaja de la base a la cabeza. `lagMs`: cuánto tarda la curva en seguir a la cabeza.
     * Aviso de la mordida (sin cambiar su tiempo): el cuello se recoge (`gatherRise` más alto, `gatherCoil` de S,
     * `gatherPull` hacia el lomo) y la cabeza se echa atrás `recoil` unidades. Dormida: el cuello cuelga `droopSag`.
     */
    neck: {
      segments: 11,
      flare: 0.4,
      plateStep: 0.75,
      ventralStep: 10,
      spikeTo: 0.58,
      spikeLen: [4.5, 2],
      maneFrom: 0.6,
      maneLen: [3, 12],
      waveAmp: 1.6,
      waveMs: 2300,
      sleepWaveAmp: 0.5,
      sleepWaveMs: 4200,
      lagMs: 140,
      gatherRise: 26,
      gatherCoil: 5,
      gatherPull: 0.35,
      recoil: 4,
      droopSag: 10,
    },
    /**
     * Collar de placas donde cada cuello nace del lomo: medidas de la textura (unidades) y cuánto sube sobre la raíz.
     */
    collar: { width: 34, height: 24, lift: 1.5 },
    /**
     * Cabezas (solo el dibujo; la hitbox no se mueve): se mecen (unidades y ms), parpadean (cada tanto, ms) y gruñen
     * (cada tanto, cuánto dura y temblor). Dormidas: se inclinan `sleepDroopDeg`, respiran lento y cierran la boca
     * (cuadro `sleepFrame` de la hoja); en el rugido la abren (`roarFrame`). `furyFaster`: la furia acelera el gruñido.
     */
    head: {
      swayX: 1.2,
      swayY: 1.6,
      swayMsX: 1900,
      swayMsY: 1500,
      blinkEvery: [1800, 4800],
      blinkMs: 110,
      growlEvery: [3200, 7000],
      growlMs: 520,
      growlJitter: 0.6,
      furyFaster: 0.55,
      sleepDroopDeg: 10,
      sleepBreathAmp: 0.8,
      sleepBreathMs: 3600,
      sleepFrame: 4,
      roarFrame: 1,
    },
    /**
     * Ojos: intensidad en reposo y cuánto sube con la furia; en un aviso, al máximo. Resplandor: lado (unidades), escala
     * mínima y máxima y alfa máximo. Latido del aviso (ms; con «Destellos: no» no late, queda fijo).
     */
    eyes: { base: 0.35, fury: 0.5, glowSize: 10, glowScale: [0.7, 1.7], glowAlpha: 0.85, glarePulseMs: 160 },
    /**
     * Brasas en el hocico: en el aviso del fuego (cada tanto, ms, al principio y al final del aviso) y con la furia,
     * desde `furyFrom` (fracción de cabezas dormidas). Resplandor de la boca: escala máxima (× el lado del de los ojos).
     */
    embers: { warnEvery: [140, 35], furyFrom: 0.3, furyEvery: [700, 160], mouthScale: 2.4 },
    /**
     * Cola: tubo de `baseWidth` a `tipWidth` (unidades). Poses (base, control 1, control 2, punta; unidades desde el
     * centro del cuerpo en el suelo, y hacia arriba): en reposo, tensa (aviso del coletazo) y dando el golpe. Se mece
     * (`swayAmp` x e y, período en ms), tiembla tensa (unidades, Hz) y sigue su pose en `follow` ms (reposo, tensa, golpe).
     * `slamHoldMs`: cuánto queda pegada al suelo antes de volver.
     */
    tail: {
      baseWidth: 24,
      tipWidth: 1.6,
      rest: [30, 34, 130, 26, 166, 4, 198, 24],
      tense: [30, 36, 140, 62, 178, 104, 136, 112],
      slam: [30, 32, 136, 10, 182, 1, 216, 2],
      swayAmp: [5, 4],
      swayMs: 1800,
      tremble: 0.9,
      trembleHz: 22,
      follow: [160, 70, 25],
      slamHoldMs: 500,
    },
    /** Golpe: el cuerpo entero se sacude (ms, unidades, Hz) y la cabeza golpeada se echa atrás (unidades). */
    hit: { shakeMs: 280, shakeAmp: 1.6, shakeHz: 18, recoil: 4 },
    /**
     * Presentación (mismo tiempo que antes): antes de la pelea el cuerpo es una silueta (`darkMul` multiplica sus
     * colores; el borde frío se ve con alfa `rimStart`), los ojos se encienden de a pares y al final la luz lo revela en
     * `revealMs` con un resplandor del oro (alfa `glowAlpha`; con «Destellos: no» no sale) y un rugido (sacudida, ms e
     * intensidad, y las cabezas se alzan `roarLift` unidades).
     */
    intro: { darkMul: 0x1a1c26, rimStart: 0.3, revealMs: 500, glowAlpha: 0.45, roarShakeMs: 450, roarShake: 0.01, roarLift: 3, roarMs: 700 },
    /** Sombras en el suelo: la del cuerpo (ancho, alto en unidades, alfa) y la de cada cabeza cerca del suelo. */
    shadow: { width: 300, height: 16, alpha: 0.6, headWidth: 44, headRange: 40, headAlpha: 0.5 },
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
    /**
     * Sale del agua (S41, solo dibujo). Etapas del aviso como fracción del aviso del picotazo: hasta `emergeCalmEnd`
     * el agua se calma, hasta `emergeReedsEnd` se abren los juncos y en el resto gira el remolino.
     */
    emergeCalmEnd: 0.3,
    emergeReedsEnd: 0.6,
    /** Graznido y escupitajo: el agua avisa estos ms y después sube la cabeza (300 ms; cabe en el aviso de 600). */
    emergeLeadMs: 280,
    /** Presentación: el agua del centro avisa estos ms antes de que salga por primera vez. */
    introWarnMs: 700,
    /** Fase 3: aviso en el charco del islote antes de que salgan las vueltas del cuerpo, y cuánto tardan en subir (ms). */
    coilWarnMs: 700,
    coilRiseMs: 350,
    /** Juncos por lado de cada punto: distancia al punto, separación y alto (unidades), y cuánto se abren (grados). */
    reedsPerSide: 4,
    reedInner: 13,
    reedGap: 3.5,
    reedHeight: 20,
    reedLeanDeg: 38,
    /** Vaivén de los juncos en reposo (grados y período en ms) y suavizado al volver (por frame a 60 fps). */
    reedSwayDeg: 4,
    reedSwayMs: 1800,
    reedLerp: 0.08,
    /** Remolino: radio (unidades; asoma a los lados del camalote, de 3 tiles) y vueltas por segundo. */
    whirlRadius: 30,
    whirlTurnsPerS: 1.6,
    /** Ondas al salir y al hundirse: radio máximo (unidades), duración, cuántas y separación (ms). */
    rippleRadius: 36,
    rippleMs: 900,
    ripplesOnEmerge: 3,
    rippleGapMs: 140,
    /** Gotas del chapuzón al salir. */
    splashDrops: 10,
    /** Semiancho del agua de cada punto (los pozos miden 5 tiles): las ondas no pasan de ahí. */
    pitHalf: 38,
    /** Charco del islote donde se enrosca en la fase 3: semiancho (unidades). */
    puddleHalf: 34,
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
    /**
     * Arte por código (S26, monaiArt.ts). En una copa, el cuerpo se enrosca en el tronco: los primeros `neckSegments`
     * bajan de la cabeza a la copa y el resto da vueltas alrededor del tronco (radio y bajada por segmento, px);
     * `coilSettleMs`: cuánto tarda en enroscarse al llegar. Las vueltas de atrás del tronco se dibujan más oscuras.
     */
    neckSegments: 2,
    coilRadius: 10,
    coilPitch: 3,
    coilSettleMs: 150,
    /** Al caer o embestir, la cabeza se inclina hacia donde va, hasta este ángulo (grados; 0 = siempre derecha). */
    diveTiltMaxDeg: 30,
    /**
     * Sprite de la cabeza (S43, `monai_head`, frame de 76 × 68 a detail 2): punto del frame (fracciones) que va en el
     * centro de la zona de daño. La cabeza cerrada ocupa x 8-69 e y 0-40 del frame (≈ 30 × 20 unidades), así que con
     * (0,5; 0,3) cubre la zona de 26 × 18 y sobra un poco de hocico y de nuca. Moverlo corre el dibujo, no la zona.
     */
    headSpriteOrigin: [0.5, 0.3],
    /**
     * Largo de los cuernos (S43), fracción del largo de S26 (1 = como antes, hasta 10 unidades sobre el cráneo). La
     * referencia del Museo Mitológico Ramón Elías los tiene cortos, apenas despuntando del cráneo: 0,4.
     */
    hornLength: 0.4,
    /**
     * Árboles de la arena (S26): copa irregular de racimos de hojas, ancho (px) y alto sobre y bajo la línea de la copa
     * (la plataforma "="); cada árbol varía hasta ± la mitad de `treeVariation`.
     */
    crownWidth: 104,
    crownAbove: 30,
    crownBelow: 18,
    treeVariation: 0.2,
    /**
     * S67: los árboles de la arena son el prop `l3_arboles/shade_tree_green` (si falta el atlas, vuelven los de código).
     * Uno por tronco de `treeTiles`, de izquierda a derecha: escala (RECETA-NIVEL §19: 0,6 a 0,8), espejo y tinte
     * (multiplica rojo, verde y azul del dibujo; >1 aclara ese canal). Los tres se ven juntos: cada uno es distinto.
     */
    treeProp: 'l3_arboles/shade_tree_green',
    treeLooks: [
      { scale: 0.8, flip: false, tint: null },
      { scale: 0.6, flip: true, tint: null },
      { scale: 0.7, flip: false, tint: [1.06, 1, 0.86] },
    ] as readonly { scale: number; flip: boolean; tint: readonly [number, number, number] | null }[],
    /**
     * Medidas del dibujo de `shade_tree_green` (245 × 240 px), en fracciones del frame sin espejar. El tronco recto va
     * de la última hoja (y 168) a donde se abre hacia las raíces (y 200), centrado en x 120,7 y con 50 px de ancho.
     */
    treeArt: { trunkCenterX: 0.4927, trunkHalfWidth: 0.102, trunkTopY: 0.7, trunkBottomY: 0.833 },
    /** S67: la cabeza posada queda con su centro a esto (unidades) sobre el borde de arriba de la copa dibujada. */
    perchAboveCrown: 3,
    /** S67: con el árbol del atlas, las vueltas van a esta distancia (unidades) del borde del tronco recto. */
    coilClearance: 4,
    /**
     * S67: la barra "=" de cada árbol se ve como una rama que cruza la copa: tiles de ancho (tools/levels/l3.txt), cuánto
     * sobresale de cada lado, grosor (unidades; tapa el tile de la plataforma) y colores de la corteza del dibujo.
     */
    branchTiles: 5,
    branchOverhang: 2,
    branchThickness: 8,
    branchColors: { outline: 0x2a1c12, dark: 0x4a3626, base: 0x66503e, light: 0x806450, highlight: 0x9a7c62 },
    /**
     * Colores de la serpiente (S42): naranja rojizo con vientre claro y cuernos grises, como el Moñái del Museo
     * Mitológico Ramón Elías (verde se leía como dragón oriental). El naranja es más claro y saturado que la tierra
     * de l3 (≈ #a8472c) y el borde oscuro lo separa de ella; sobre el cielo y las copas verdes, contrasta solo.
     */
    palette: {
      outline: 0x3a1608,
      body: 0xe2732c,
      shade: 0xb04f1e,
      light: 0xf6a85e,
      belly: 0xf6dcae,
      spot: 0x8a3414,
      /** Vueltas detrás del tronco: más oscuras. */
      back: 0x8f3c18,
      backOutline: 0x240d05,
      eye: 0xf2e04e,
      mouth: 0x5e1420,
      fang: 0xf4f0e0,
      horn: 0xb4b1aa,
      hornBand: 0x7d7a74,
      star: 0xffe27a,
    },
    // ── S44: balance de Moñái (la pelea era para el suelo falso de antes de S26). Al lado, el valor viejo. ──
    /**
     * Confusión: el pulso ya no solo invierte izquierda y derecha; además Kerana **no puede atacar** mientras dura (el
     * tajo no sale y no se carga). Así, si el pulso la toca, pierde la ventana de después y esquiva el próximo descenso
     * con los controles al revés. Se sale sacudiéndose: cada vez que aprieta atacar, la confusión se acorta
     * `confusionShakeCutMs`. Se evita escondiéndose detrás de un tronco o lejos del anillo. Solo Moñái: la melodía de
     * Tau sigue con la hipnosis de siempre (`hypnosis.durationMs`, solo invierte).
     */
    confusionMs: 4500, // antes 3000 (hipnosis compartida, solo invertía)
    confusionShakeCutMs: 400, // nuevo: ≈ 11 intentos de tajo la quitan entera
    /** Señal en Kerana: brillo de color que cambia (Glow) y una espiral que gira, más grande que la de Tau; se achica al pasarse o al sacudirse. */
    confusionGlowStrength: 3, // nuevo
    confusionGlowCycleMs: 600, // nuevo: cuánto dura cada color del brillo
    confusionIconPx: 40, // nuevo: lado de la espiral (la de Tau mide 20)
    confusionIconLine: 3, // nuevo: grosor de su trazo (px)
    /**
     * Ventanas para golpearle (ms; antes cabía toda la tanda en una). Con un tajo cada 280 ms, ≈ 600 ms dan para dos
     * golpes si Kerana ya está al lado y para uno si llega justo. Las usa `src/data/bosses.ts` como `recoverMs`.
     */
    dazeMs: 650, // antes 1500 (aturdida tras el descenso, fases 1 y 2)
    dazeFastMs: 600, // antes 1300 (aturdida tras el descenso rápido, fase 3)
    afterPulseMs: 600, // antes 1000 (en el suelo después del pulso)
    tailMs: 800, // antes 1200 (la cola expuesta tras el robo)
    /**
     * Cuerpo que estorba: en el suelo (aturdida o junto a un tronco para el pulso), los primeros `guardSegments` se
     * levantan en una joroba detrás de la nuca (`guardWidth` de largo y `guardHeight` de alto, px) que **lastima al
     * tocarla**; el resto queda chato en el suelo y no lastima. La cabeza se alcanza de frente o saltando la joroba
     * (≈ 35 px de alto con el grosor: el salto, ≈ 63, la pasa de sobra). La joroba se arma `guardArmMs` después de llegar al suelo y tarda
     * `guardSettleMs` en levantarse. Antes (hasta S43) el cuerpo no lastimaba y los primeros segmentos también eran blanco.
     */
    guardSegments: 6, // nuevo
    guardWidth: 36, // nuevo
    guardHeight: 26, // nuevo
    guardArmMs: 250, // nuevo
    guardSettleMs: 120, // nuevo
    /** El tajo al cuerpo cuenta como golpe (antes true: se le pegaba a cualquier parte; ahora solo a la cabeza). */
    bodyIsTarget: false, // antes true
    // ── S65: el último golpe entra. Al lado, el valor viejo. ──
    /**
     * Las zonas que **reciben** el tajo (la cabeza y la cola) crecen hacia arriba esta cantidad (px); la que lastima a
     * Kerana no cambia. El tajo de Kerana de pie va de 12 a 30 px sobre sus pies, y lo que Moñái deja tirado en el suelo
     * quedaba más abajo: la cabeza aturdida se tocaba por 6 px (un tajo desde 6 px de alto ya no entraba) y la cola de la
     * ventana del robo, nunca (su zona empezaba medio píxel por debajo del tajo). Con 12, la cabeza se alcanza de pie y
     * desde un saltito de hasta 18 px, y la cola de pie y hasta 11 px.
     */
    strikeRise: 12, // antes 0
    // ── S66: la cabeza siempre es blanco. Al lado, el valor viejo. ──
    /**
     * En la ventana del robo (fase 3) la cabeza también recibe el tajo; la cola, además, devuelve el corazón robado.
     * Antes solo valía la cola: la cabeza quedaba en el suelo delante de Kerana y el tajo no le hacía nada. El robo pesa
     * 2 de 4 en la fase 3, así que la mitad de las ventanas no aceptaban un golpe a la cabeza (medido en S66: el tajo
     * solapaba la cabeza con 4, 3 y 2 de vida y no restaba).
     */
    headInTailWindow: true, // antes false
  },
  /**
   * Moñái, solo el dibujo (S102; monaiPaint.ts, monaiBody.ts y la parte visual de Monai.ts). Nada de esto toca la
   * pelea: hitboxes, tiempos, ventanas, la cuerda de segmentos y el enroscado siguen en `monai` y en monaiLogic.ts.
   * La paleta se midió en la hoja de la cabeza (raw/monai/head) y en el fondo de l3 (cielo, campo, copas, tierra).
   */
  monaiLook: {
    /** Rampas de la sombra a la luz. `skin` y `cream` salen de la cabeza (#d74212 es su naranja de base). */
    palette: {
      outline: 0x180a06,
      skin: [0x2a0b04, 0x4f0d02, 0x7d2108, 0xad310c, 0xd74212, 0xf2662d, 0xfb9450],
      cream: [0x4a1e0e, 0x7a4424, 0xad7241, 0xd29b65, 0xe7a459, 0xf8c286, 0xfcc88e],
      /** Cuernos: nácar del gris al marfil (el tinte iridiscente va encima). */
      horn: [0x1c1418, 0x3e3438, 0x6a5e62, 0x9a8f8e, 0xc8bfb6, 0xe9e2d4, 0xfbf7ee],
      tongue: [0x3a0a14, 0x8e1a34, 0xc42a4a, 0xf06080],
      heart: [0x3a0a0a, 0x8a1a20, 0xc82a30, 0xe85048, 0xff9a8a],
      star: [0x7a5a10, 0xffe27a, 0xfffbe0],
      /** Sombra del cuerpo en el tronco y en el piso (el violeta oscuro de la sombra de la caída). */
      shadow: 0x1b1a2e,
      /** Hojas que caen de la copa (los verdes de las copas de l3). */
      leaf: [0x15290f, 0x2f5f22, 0x4f8a35],
    },
    /**
     * Cuerpo (una tira pintada una vez, de la nuca a la punta de la cola). `length` y `halfHeight` en unidades;
     * `profile`: radio a cada fracción del largo (de la nuca, escondida bajo la cabeza, a la punta); el último tramo
     * se cierra en punta con `tipPower`. El radio de la cuerda de segmentos (`monai.segmentRadius`) no cambia.
     */
    body: {
      length: 108,
      halfHeight: 8,
      profile: [
        [0, 5.4],
        [0.08, 6.2],
        [0.24, 7],
        [0.42, 6.6],
        [0.86, 3.1],
        [1, 0],
      ] as readonly (readonly [number, number])[],
      tipPower: 0.75,
    },
    /**
     * Luz de la piel: dirección en el corte del cuerpo (`across` < 0 = desde el lomo) y hacia el frente; umbrales de
     * cada tono (de 0 a 1) y cuánto tramado hay en los bordes de los tonos. `rim`: el brillo del borde del lomo.
     */
    light: { across: -0.55, out: 0.85, thresholds: [0.12, 0.34, 0.6, 0.95, 1.1] as readonly number[], dither: 0.08, rim: -0.8 },
    /** Vientre: dónde empieza (fracción del radio, 1 = el borde de abajo), placas cada `plate` unidades. */
    belly: { start: 0.3, plate: 2.2 },
    /** Escamas del flanco: filas entre el lomo y el vientre y largo de cada escama (unidades, a radio 7). */
    scales: { rows: 4, length: 2.4 },
    /**
     * Rombos del lomo: centro y medio alto (fracción del radio, < 0 = hacia el lomo; `dorsalHalf` en la vista de lomo),
     * largo y separación según el radio, y la primera a esta distancia de la nuca (unidades). Manchas chicas en el flanco,
     * entre rombos (de lomo, una a cada lado, a `blotch.dorsal` del centro).
     */
    pattern: { center: -0.4, halfHeight: 0.5, dorsalHalf: 0.62, lengthK: 0.6, lengthAdd: 1.4, periodK: 1.4, periodAdd: 3.2, start: 12, blotch: { center: 0.16, dorsal: 0.66, size: 0.42 } },
    /** Vueltas de atrás del tronco: luz que les llega y mezcla con la sombra. */
    back: { light: 0.45, mix: 0.3 },
    /** Puntos de la tira dibujada (más = curvas más suaves). */
    points: 48,
    /**
     * Lomo arriba: el lado del lomo se elige desde la nuca (el de la cabeza) y se da vuelta solo cuando apunta hacia
     * abajo más que esto (0 = siempre arriba; 1 = nunca se da vuelta).
     */
    flipThreshold: 0.35,
    /** La normal se promedia con estos vecinos para decidir el lado del lomo. */
    flipReach: 3,
    /**
     * En las curvas cerradas el lado de adentro se aprieta hasta esta fracción del radio de la curva (si no, la tira se
     * dobla y asoma una punta hacia afuera), nunca a menos de `innerMin` del grosor. La columna suavizada deja los codos
     * del cuello con radio de sobra: solo se aprietan las vueltas cerradas de la cola.
     */
    innerLimit: 0.85,
    innerMin: 0.15,
    /** Suavizado de la columna (vueltas y peso): redondea los codos entre segmentos. */
    smooth: { iterations: 3, weight: 0.45 },
    /** Vueltas del enroscado: el cuerpo se oscurece hacia los costados del tronco (tinte en el borde de la vuelta). */
    coilShade: { side: 0xa07a70, power: 0.8 },
    /**
     * Nuca: dónde arranca la tira bajo la cabeza (unidades desde el centro de la zona de daño, mirando a la izquierda),
     * reposo y mareo / fauces abiertas.
     */
    nape: { idle: [10, 3] as readonly [number, number], attack: [6, 3] as readonly [number, number] },
    /** La punta de la cola sigue de largo detrás del último segmento (unidades). */
    tailTip: 6,
    /**
     * Onda que recorre el cuerpo de la cabeza a la cola: largo (unidades), período (ms) y amplitud (unidades) volando,
     * colgando de la copa y en el suelo; crece desde la nuca en `rampIn` unidades. En el enroscado, en vez de moverse, el
     * cuerpo se hincha (`swell`, fracción del grosor). Por fase (furia), el período se divide por `phaseSpeed`.
     */
    wave: { length: 46, periodMs: 1500, fly: 2.6, perched: 1.6, ground: 0.6, rampIn: 16, swell: 0.07, phaseSpeed: [1, 1.3, 1.65] as readonly number[], settleMs: 220 },
    /** Respiración: período (ms) y cuánto engorda el pecho (fracción del grosor); mareada, más lenta. */
    breath: { periodMs: 2600, amount: 0.04, dazedPeriodMs: 4200 },
    /** Brillo del dibujo del lomo en cada fase (furia): alfa del tinte dorado sobre los rombos. */
    furyGlow: { color: 0xffe08a, alpha: [0, 0.45, 0.8] as readonly number[], shimmerMs: 2200 },
    /**
     * Pulso de hipnosis: la iridiscencia corre por el lomo de la nuca a la cola (largo de la ola, unidades, y
     * velocidad, unidades por segundo; alfa del tinte). En el aviso, más lenta y suave; al lanzarse, rápida.
     */
    hypnoWave: { width: 22, speedWarn: 70, speedFire: 260, alphaWarn: 0.8, alphaFire: 1, cycleMs: 700 },
    /** Golpe: la sacudida baja por el cuerpo (ms en llegar a la cola, amplitud y largo de la onda, unidades). */
    hit: { travelMs: 360, amplitude: 3.2, width: 7, wobble: 7, flashAlpha: 1, flashColor: 0xfff4e0 },
    /** Mareo: la cabeza cuelga (grados) y la onda se apaga. */
    daze: { droopDeg: 9 },
    /** Cuernos: ciclo del color iridiscente (ms) en reposo y brillando, alfa del brillo, cuadros del reflejo que corre. */
    horns: { cycleMs: 2400, glowCycleMs: 520, sheenAlpha: 0.5, glowSheenAlpha: 0.95, sheenFrames: 8, sheenMs: 90, glowRadius: 11, glowAlpha: 0.75 },
    /** Lengua bífida: cada cuánto sale (ms, entre mín. y máx.) y cuánto dura cada salida. */
    tongue: { minMs: 2200, maxMs: 4800, flickMs: 420, at: [-14, 3.6] as readonly [number, number] },
    /** Sombras: en el tronco (desplazamiento y alfa) y en el piso (alfa, alto en que se apaga, grosor). */
    shadow: { trunkDx: 1.5, trunkDy: 3, trunkAlpha: 0.42, groundAlpha: 0.34, groundFade: 30, groundHalf: 2.2 },
    /**
     * Aviso de la caída: anillo que se cierra sobre la sombra (escala de inicio y fin) y que destella al quedar fija;
     * hojas que caen de la copa a esta fracción del aviso; el hocico se inclina hacia abajo hasta `peekDeg` grados.
     */
    descentWarn: { ringFrom: 1.9, ringTo: 1, ringAlpha: 0.8, leavesAt: 0.45, leaves: 6, peekDeg: 14 },
    /** Aviso del robo: brillo del ojo, sacudida de la cola; al embestir, rayas de velocidad. */
    stealWarn: { eyeAt: [-7, -3.8] as readonly [number, number], eyeColor: 0xff5a7a, tailRattle: 2.2, streaks: 4 },
    /**
     * Corazón robado en la cola: latido (ms), brillo y cuánto sube sobre la punta; la punta de la cola se levanta
     * `curl` unidades para sostenerlo (en sus últimas `curlLength`).
     */
    heart: { beatMs: 520, glowAlpha: 0.7, rise: 5, curl: 5, curlLength: 16, sparkMs: 700 },
  },
  /**
   * Ñandú (S26): tamaño del dibujo y del cuerpo respecto de la hoja (64 × 64 a detalle 2). Con 1, el ave medía 32 de
   * alto y se leía como un pollito al lado de Kerana (42). Con 1,6 el cuerpo de 16 × 26 queda en 26 × 42: tan alto
   * como Kerana, y el salto (63 px) lo sigue pasando con margen.
   */
  nandu: {
    scale: 1.6,
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
    /**
     * S118: en el cielo (zonas sin pasto, `grass=false`: Yvága), además de las rayas, jirones de nube que corren con la
     * ráfaga (windWispPaint.ts): tamaños (unidades), paleta (cola, cabeza), alfa del borde y del cuerpo, velocidad (px/s),
     * vida (ms) y probabilidad por frame en el aviso y en la ráfaga.
     */
    wisps: {
      sizes: [
        [48, 7],
        [36, 6],
        [62, 8],
      ] as ReadonlyArray<readonly [number, number]>,
      palette: [0xb7aae2, 0xfbf8ff],
      alphas: [0.5, 0.85],
      speed: 160,
      lifeMs: 1300,
      chanceWarn: 0.06,
      chanceGust: 0.2,
    },
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
    /** "Zzz" sobre Kerana (px). Cómo se ve la niebla: `sleepFogLook`. */
    iconOffsetY: 50,
  },
  /**
   * Bruma de la siesta (S103): solo el dibujo de las zonas `SleepFog` (la zona, el sueño y sus tiempos están en `sleep`).
   * Bocanadas pintadas una vez (tramado de Bayer, luz del sol arriba a la izquierda) en dos capas: la de atrás, detrás
   * de Kerana y de los enemigos; el velo, delante y tenue. Unidades del mundo; los tiempos en ms.
   */
  sleepFogLook: {
    /** Lavanda cálida, de la sombra a la luz (lejos del rosa del lapacho, #a36e74–#d7b0b3), y el borde con sol. */
    palette: [0xa39cc2, 0xbab3d8, 0xcfc9e8, 0xe0dcf1, 0xedeaf6],
    rim: 0xfdf6e8,
    /** Polvo con sol: del oro del bastón al blanco caliente. */
    dust: [0xc49532, 0xfbd233, 0xfcfedb],
    /** Bocanadas: [ancho, alto] de cada tamaño y cuántas formas por tamaño. */
    puffSizes: [
      [28, 16],
      [18, 11],
    ],
    shapesPerSize: 3,
    /** Escalones de alfa del tramado dentro de cada bocanada (0..1) y dónde empiezan (densidad 0..1). */
    puffAlphas: [0.3, 0.5, 0.72],
    puffSteps: [0.1, 0.32, 0.58],
    /**
     * Grilla de la capa de atrás y del velo (unidades entre bocanadas) y el sacudón de cada una. Lo que cuesta es cuánto
     * se superponen (cada píxel translúcido se pinta una vez por bocanada): S103 la abrió para no bajar los FPS.
     */
    backGap: [30, 20],
    frontGap: [40, 26],
    jitter: 3.5,
    /** Alfa máximo de cada capa (al centro de la zona) y lo que queda en el borde. */
    backAlpha: 0.5,
    frontAlpha: 0.26,
    edgeAlpha: 0.08,
    /**
     * Borde: la densidad sube de 0 (`edgeOut` afuera de la zona) a 1 (`edgeIn` adentro); el centro suma `centerBoost`.
     * El piso de la zona no se desvanece: la bruma se apoya en la calle.
     */
    edgeOut: 4,
    edgeIn: 10,
    centerBoost: 0.3,
    /**
     * Masa: la capa continua de cada zona, pintada una vez (densidad de la zona cortada en jirones). `massCell`: tamaño
     * de los jirones (unidades); `massWisps`: cuánto los corta el ruido (0 liso, 1 jirones sueltos); `massDensity`: su
     * peso; `massAlpha`: su opacidad (respira con el resto).
     */
    massCell: 14,
    massWisps: 0.65,
    massDensity: 0.95,
    massAlpha: 0.75,
    /** La masa se mece de lado (unidades). */
    massSway: 1.5,
    /** Las bocanadas de atrás van solo donde la densidad pasa de esto (adentro: el borde lo hace la masa). */
    backMinDensity: 0.4,
    /** Remolino: radio (unidades) y vuelta (ms) de cada bocanada; aplastado en vertical. */
    swirlRadius: [2, 5.5],
    swirlMs: [7000, 13000],
    swirlFlatten: 0.45,
    /** Respiración de toda la bruma: período (ms), cuánto baja el alfa y cuánto sube (unidades). */
    breathMs: 4200,
    breathAlpha: 0.22,
    breathRise: 1.2,
    /** Polvo dorado: uno cada tantas unidades² (entre `dustMin` y `dustMax` por zona), subida (u/s), vaivén (u) y titileo (ms). */
    dustPerArea: 520,
    dustMin: 7,
    dustMax: 16,
    dustRise: [2.5, 6],
    dustSway: 4,
    dustTwinkleMs: [900, 1900],
    /** Profundidades: atrás de Kerana (0), velo y polvo delante (Foreground es 10). */
    backDepth: -0.5,
    frontDepth: 11,
    dustDepth: 11.1,
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
  /**
   * Dibujo de las chispas de Jasy Jatere (S103): estrellas de siesta. Solo cómo se ven: daño, cantidad, abanico,
   * velocidad, vida y el camino que daña siguen en `jasyJatere` y en bosses.ts. Unidades del mundo; tiempos en ms.
   */
  jasyJatereLook: {
    /** Oro del bastón medido en la hoja (de la sombra a la luz) y el núcleo blanco caliente. */
    gold: [0x5a3002, 0x945400, 0xc49532, 0xfbd233, 0xfcfedb],
    core: 0xffffff,
    /** Halo aditivo: se suma al fondo, así que es un oro tibio y no blanco. */
    halo: 0xc8a060,
    /** Bastón en alto y suelto, pintado como el de la hoja: madera, enredadera y cabeza de oro. */
    wood: [0x2a1704, 0x4c2a04, 0x7b5325, 0xc08b3e],
    vine: [0x0e2a00, 0x2f5a12],
    /** Punta del bastón (donde junta la luz): unidades desde el centro hacia arriba. */
    staffTip: 10.5,
    star: {
      /** Radios en múltiplos de `jasyJatere.sparkRadius`: puntas, puntas al destellar, cuerpo y núcleo. */
      spike: 1.6,
      flareSpike: 2.3,
      body: 0.55,
      core: 0.22,
      /** Forma de astroide (|x|^q + |y|^q ≤ 1: más chico, puntas más finas) y cuadros de giro (cubren 90°). */
      sharpness: 0.55,
      frames: 8,
      /** Giro (grados por segundo): destella cada vez que las puntas pasan por los ejes. */
      spinDegPerS: 330,
      /** Con «Destellos: no», gira más lento y no destella. */
      calmSpinDegPerS: 120,
      /** Vaivén a cada lado del camino que daña (unidades) y su período (ms). */
      wobble: 1.2,
      wobbleMs: 260,
      /** Halo: radio (unidades), alfa y cuánto crece al destellar. */
      haloRadius: 9,
      haloAlpha: 0.5,
      haloFlareScale: 1.3,
      /** Al salir: del extremo del bastón al camino que daña en este tiempo (ms). */
      launchBlendMs: 90,
      /** Al final de la vida se achica en estos ms antes de reventar. */
      fadeMs: 180,
    },
    /**
     * Estela: una mota cada `gap` unidades con el ritmo de tamaños `pattern` (2 grande, 1 chica); vida y caída (u/s).
     * `ghosts`: copias de la estrella que la siguen pegadas (a cuántas unidades, escala y alfa): la cola del cometa.
     * Van por distancia y no por cuadros, así la cola mide lo mismo a cualquier FPS.
     */
    trail: {
      gap: 5,
      pattern: [2, 1, 1],
      lifeMs: 300,
      drift: 4,
      fall: 14,
      ghosts: [
        { back: 3.5, scale: 0.68, alpha: 0.6 },
        { back: 7, scale: 0.42, alpha: 0.34 },
      ],
    },
    /** Estallido: motas, velocidad (u/s), vida, frenado por segundo, caída y el destello (vida y escala). */
    burst: { motes: 8, speed: [26, 62], lifeMs: 480, drag: 2.6, fall: 46, flashMs: 160, flashScale: [0.5, 1.4] },
    /** Aviso: anillos de motas que se cierran sobre la punta (motas por anillo, radio, viaje, uno cada) y el brillo que crece. */
    gather: { motes: 6, radius: 26, travelMs: 300, everyMs: 130, glowScale: [0.2, 1.1], glowAlpha: [0.2, 0.9], starScale: [0.25, 0.8] },
    /** Motas en vuelo a la vez (pool). */
    motePool: 96,
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
  /**
   * Kurupi corriendo rápido (S104): siluetas que quedan atrás y lo que levantan sus pies, en el 'active' de la
   * embestida y de la carrera al revés. Solo el dibujo: tiempos, daño, hitbox, dirección y huellas siguen en `kurupi`
   * y en bosses.ts. Sin Glow ni destellos (con «Destellos: no» se ve igual).
   */
  kurupiTrail: {
    /** Siluetas, como `dashFx`: una cada `everyMs` (la primera al arrancar), a lo sumo `maxGhosts` vivas. */
    everyMs: 70,
    maxGhosts: 5,
    /** Opacidad con la que nace cada silueta; baja a 0 en `fadeMs`. */
    alpha: 0.45,
    fadeMs: 280,
    /**
     * Degradé de la silueta [arriba, abajo], medido en su hoja (el 10 % más claro de cada familia): el musgo de la
     * cabeza y la barba (#8c7c1d) y el marrón del pelaje (#7c4a24). Silueta plana (`tintFill`).
     */
    tint: [0x8c7c1d, 0x7c4a24],
    tintFill: true,
    /** Px que tiene que avanzar desde la silueta anterior para dejar otra: arranca despacio y no se amontonan. */
    minGapPx: 12,
    /** Lo que levanta: una patada cada `everyPx` de carrera, solo a más de `minSpeed` px/s; a lo sumo `maxPerFrame`. */
    kick: {
      everyPx: 20,
      minSpeed: 140,
      maxPerFrame: 2,
      /** Cada patada levanta un terrón; cada `leafEvery` patadas, también una hoja. */
      leafEvery: 2,
      /** Salen de los pies: px detrás del centro (del lado contrario a la carrera) y px sobre el suelo. */
      backPx: 5,
      upPx: 3,
      /** Abanico (± grados) alrededor de atrás y cuánto sube sobre el suelo (grados). */
      spreadDeg: 14,
      liftDeg: 62,
    },
    /** Al frenar: el último puñado, desde la punta del pie de adelante (`frontPx`) hacia donde corría, bajo y abierto. */
    brake: { dirt: 6, leaves: 3, frontPx: 9, spreadDeg: 26, liftDeg: 30 },
    /**
     * Terrones: velocidad (px/s), gravedad, vida (ms) y cuántos vivos a la vez deja la carrera (`max`; el emisor
     * admite además los de la frenada). Es `maxAliveParticles`: recicla los muertos (`maxParticles` cuenta también
     * los muertos y, al llegar, el emisor no larga nunca más).
     */
    dirt: { speedMin: 120, speedMax: 200, gravityY: 640, lifespanMin: 360, lifespanMax: 520, max: 18 },
    /** Hojas: caen más despacio y aletean (cuadros por segundo del aleteo, sin girar el pixel art); `max`, como en los terrones. */
    leaf: { speedMin: 80, speedMax: 130, gravityY: 170, lifespanMin: 620, lifespanMax: 900, max: 10, flutterFps: 12 },
    /**
     * Colores medidos en la arena de l5: la tierra del tileset de selva (#474230, #3e3a2a), el pasto claro de su
     * borde (#297743) y los helechos y matas del fondo junto al suelo (#688048, #6f7a40 y #586830, de los más claros:
     * los oscuros no se ven contra la selva).
     */
    dirtColors: [0x474230, 0x474230, 0x3e3a2a],
    leafColors: [0x688048, 0x6f7a40, 0x586830, 0x297743],
    /** Píxeles de arte por unidad de las hojas y los terrones: los de Kurupi (igual de nítidos que él). */
    detail: 2,
    /** Lo que baja más de tantos px bajo el suelo de la arena se apaga (se mete en la tierra, no la atraviesa). */
    sinkPx: 1,
  },
  /**
   * La fruta del ka'i (S115): un fruto de pindó pintado en `kaiFruitArt.ts`. Solo el dibujo: la trayectoria, la
   * gravedad, el golpe (`projectileHits`, un punto), el daño, los tiempos y el pool siguen en `enemies.ts` y `Thrower.ts`.
   */
  kaiFruit: {
    /** Píxeles de arte por unidad (los del ka'i). */
    detail: 2,
    /** Giros por segundo en el aire (cuadros de `SPIN_FRAMES`): gira hacia donde va. */
    spinFps: 14,
    /** En el aviso, la fruta en la mano: unidades hacia adelante del centro y sobre los pies (la mano del dibujo). */
    hand: { forward: 4.5, rise: 8.5 },
    /** En la mano, el cabito hacia adelante (cuadro de `SPIN_FRAMES` mirando a la derecha; a la izquierda, el espejo). */
    heldFrame: 2,
    /** En el aviso, la fruta sube un poco (se la prepara para tirar): unidades de más al final del aviso. */
    windupLift: 2,
    /** Profundidad de la fruta (la del círculo de antes) y de lo que salpica. */
    depth: 7,
    /** Pulpa que salpica al reventar. */
    pulp: { count: 9, speedMin: 40, speedMax: 115, gravity: 520, lifeMin: 260, lifeMax: 520, max: 30 },
    /** El reventón: dos cuadros, ms de cada uno. */
    popFrameMs: 55,
    /** La semilla: rebota y se apaga. */
    seed: {
      launchVy: -95,
      launchVx: 38,
      gravity: 640,
      restitution: 0.42,
      friction: 0.6,
      restSpeed: 30,
      lifeMs: 1100,
      fadeMs: 360,
      fadeSteps: 3,
      /** Hasta cuántos px por debajo busca el piso al reventar; sin piso, cae y se apaga. */
      maxDropPx: 96,
    },
  },
  /**
   * La onda del pisotón de Kurupi (S114): la tierra que revienta el suelo. Solo el dibujo: la hitbox (`waveWidth` ×
   * `waveHeight`, con la base en el suelo), la velocidad, la vida y el daño siguen en `kurupi` y en bosses.ts. El arte
   * (cresta, grietas, terrones, raíces, hojas y polvo) se pinta una vez en `kurupiWaveArt.ts`, con los colores medidos
   * del piso de selva y de las hojas de Kurupi. Lo que sale por distancia y no por cuadros: lo mismo a cualquier FPS.
   */
  kurupiWave: {
    /** Cuadros por segundo de la cresta (la tierra que se revuelve) y de su derrumbe cuando la onda se apaga. */
    crestFps: 14,
    collapseFps: 16,
    /** Profundidades: grietas (como las huellas), polvo (detrás de la cresta), cresta (la del rectángulo de antes) y lo que salta. */
    depth: { crack: 3, dust: 5.9, crest: 6, debris: 8 },
    /**
     * Grietas: una cada `everyPx` de avance, detrás de la cresta (se empalman: miden 16 px). Se cierran en tres pasos
     * (`stageMs`, ms de cada uno) y se apagan. A lo sumo `max` a la vez: si faltan, se recicla la más vieja.
     */
    crack: { everyPx: 14, stageMs: [320, 260, 200] as readonly number[], max: 40 },
    /** Lo que salta: un terrón cada `everyPx` de avance; cada `leafEvery` terrones, también una hoja; cada `rootEvery`, una raíz. */
    debris: { everyPx: 7, leafEvery: 3, rootEvery: 5, maxPerFrame: 3 },
    /** Terrones y raíces: velocidad (px/s), abanico (grados; -90 es arriba), gravedad, vida (ms) y cuántos vivos a la vez. */
    clod: { speedMin: 50, speedMax: 120, angle: [-150, -30] as readonly number[], gravityY: 520, lifespanMin: 380, lifespanMax: 560, max: 32 },
    root: { speedMin: 60, speedMax: 110, gravityY: 460, lifespanMin: 420, lifespanMax: 600, max: 8 },
    /** Hojas (las de Kurupi y las de la hojarasca): caen más despacio y aletean (cuadros por segundo, sin girar el pixel art). */
    leaf: { speedMin: 40, speedMax: 90, gravityY: 170, lifespanMin: 650, lifespanMax: 950, max: 16, flutterFps: 12 },
    /** Polvo: un puñado cada `everyPx`, detrás de la cresta; sube y se deshace en tramado (cuadros por segundo), sin fundido. */
    dust: { everyPx: 9, speedX: 14, speedYMin: -26, speedYMax: -10, fps: 12, max: 16 },
    /** Al reventar (el pisotón) y al apagarse la onda: cuántos de cada uno salen de golpe. */
    burst: { clods: 6, leaves: 2, roots: 1, dust: 3 },
    end: { clods: 4, dust: 2 },
    /** Lo que baja más de tantos px bajo el suelo se apaga (se mete en la tierra). */
    sinkPx: 1,
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
    /** Tronco del pindó por código (S31), solo si falta el atlas `l6_roca`. */
    trunkWidth: 5,
    /**
     * S78: el karanda'y (`l6_roca/karanday_palm`). La escala sale del alto del pindó: el pie del tronco, `sink` bajo el
     * piso, y la franja más ancha de la copa (`crownY`, fracción del alto del dibujo desde arriba) en el centro de la
     * barra. La barra tapa la plataforma `=`: `barRaise` sobre su borde de arriba, `barOverhang` de más a cada lado.
     */
    art: {
      prop: 'l6_roca/karanday_palm',
      crownY: 0.24,
      sink: 1,
      barRaise: 1,
      barThickness: 7,
      barOverhang: 2,
      /** Píxeles de la textura de la barra por unidad (como el arte de los jefes). */
      barDetail: 2,
      barGrain: 18,
      /** Colores del faldón de hojas secas del dibujo. */
      barColors: { outline: 0x2a1a0c, dark: 0x5a3c18, base: 0x8a6230, light: 0xa87a3c, highlight: 0xc4964e },
    },
  },

  /**
   * Persecución de Ao Ao (GDD §6.6, S31; `src/systems/chaseLogic.ts`). En un `rect ChaseZone` la cámara avanza sola y
   * Ao Ao corre en el borde izquierdo. Quedarse cerca del borde avisa (franja roja, aullido, Ao Ao se adelanta);
   * tocarlo cuesta `damage.chase` y devuelve a Kerana al último pindó del tramo (o a la largada, si todavía ninguno).
   * En lo alto de un pindó el borde se detiene. Kerana corre a `player.runSpeed` (150).
   */
  chase: {
    /** Velocidad del borde (px/s) si el `rect ChaseZone` no trae `speed`. */
    speed: 72,
    /** Kerana puede adelantarse hasta esta fracción de la vista; más allá, el borde la sigue (ve 16 tiles por delante). */
    aheadFrac: 0.6,
    /** Franja de aviso desde el borde (px): parada, ≈ 1,5 s antes de que la alcance. */
    warnPx: 112,
    /** La alcanza cuando el lado izquierdo del cuerpo llega a esta distancia del borde (px). */
    catchPx: 0,
    /** Al volver a un pindó, el borde queda esta distancia detrás de él (px). */
    restartLeadPx: 240,
    /** Ao Ao: centro del cuerpo respecto del borde (px) al correr y al avisar (se adelanta, con la boca abierta). */
    aoAoOffsetPx: 6,
    aoAoLungePx: 34,
    /** Suavizado de la posición de Ao Ao (0 a 1 por frame): en x y en y (sigue el terreno de su columna). */
    aoAoLerp: 0.18,
    aoAoYLerp: 0.35,
    /** En el refugio va y viene en el borde: amplitud (px) y período (ms por radián). */
    aoAoPacePx: 10,
    aoAoPaceMs: 260,
    /** Polvo a sus pies mientras corre: en promedio una partícula cada tanto (ms). */
    aoAoDustEveryMs: 120,
    /** Aullidos durante el aviso y en el refugio (ms entre aullidos). */
    howlEveryMs: 1600,
    /** Sacudón al largar (el sobresalto). */
    startShakeMs: 320,
    startShakeIntensity: 0.008,
    /** Franja roja del aviso: ancho (px de la vista), color y opacidad máxima. */
    warnBandPx: 90,
    warnColor: 0xb8322a,
    warnAlpha: 0.55,
    /** Latido de la franja (ms por radián). */
    warnPulseMs: 120,
    /** Al terminar, Ao Ao se vuelve por donde vino a esta velocidad (px/s) y se desvanece (ms). */
    leaveSpeed: 120,
    leaveFadeMs: 1400,
  },

  /**
   * Cascada (S31, el salto de l6; S116, el dibujo nuevo, `src/entities/waterfallArt.ts`): decoración por código delante
   * de Kerana, sin choque. Detrás puede haber una cornisa: la lámina es translúcida para que se adivine.
   */
  waterfall: {
    /** Profundidad de la lámina de atrás; la de adelante, la cresta, la poza y la espuma van 1 y 2 más arriba. */
    depth: 10,
    /** Velocidad de caída de cada lámina (px/s): la de atrás, el cuerpo; la de adelante, los hilos claros. */
    backSpeed: 70,
    frontSpeed: 150,
    /** Filas en que la cresta y las láminas se pisan (la cresta se desvanece encima de ellas). */
    lipOverlap: 5,
    /** Fuera de cámara (con este margen, en unidades) no se emite ni se anima nada más que las láminas. */
    cullMargin: 48,
    art: {
      /**
       * Seis tonos de agua y el brillo. Medidos en el prop l6_agua/waterfall (`#323e4c`, `#6b6e7d`, `#909cb2`, `#a5b4c9`,
       * `#c1cddd`, `#effdff`) y en la bruma de l6_far.jpg (`#485164`, `#6a7084`), más fríos: la tormenta.
       */
      ramp: [0x2f3b4c, 0x46566b, 0x627691, 0x8698b2, 0xaabbd0, 0xd2deeb, 0xeef8ff],
      /** Opacidad de cada tono en la lámina de atrás: los hondos más transparentes (se ve la roca detrás). */
      backAlpha: [0.34, 0.42, 0.5, 0.58, 0.66, 0.76],
      /** Alto de las láminas (se repiten hacia abajo). */
      period: 96,
      /** Rendijas por cada 16 de ancho, su largo y su opacidad. */
      slitsPerTile: 5,
      slitLength: [8, 22],
      slitAlpha: 0.16,
      /** Hilos claros por cada 16 de ancho (atrás y adelante) y su largo. */
      backThreadsPerTile: 9,
      frontThreadsPerTile: 4,
      threadLength: [8, 26],
      /** Opacidad de los hilos de adelante: el cuerpo del hilo y su cabeza (el brillo). */
      frontAlpha: [0.55, 0.9],
      /** La cresta: alto de su textura, cuánto sube sobre el borde de arriba del chorro y cuánto empieza antes (sobre la roca). */
      lipHeight: 20,
      lipRise: 3,
      lipLead: 5,
      lipDrop: 5,
    },
    /** Brillos que bajan por la cresta: cuántos, ancho, cuánto bajan (unidades), vida (ms) y opacidad. */
    glints: { count: 5, width: 2, travel: 7, lifeMs: 700, alpha: 0.9 },
    /**
     * Donde el chorro cruza un piso: alto de la franja de espuma, cuánto se mete en el piso, opacidad, gotas por segundo,
     * qué parte de ellas lleva rocío y qué parte de las manchas de espuma va ahí (el resto, en la poza).
     */
    ledge: { foamHeight: 4, foamSink: 2, foamAlpha: 0.75, dropsPerSec: 22, mistShare: 0.3, foamShare: 0.5 },
    /** La poza al pie: alto y cuánto se pasa del chorro a cada lado. */
    pool: { height: 12, overhang: 14 },
    /** Ondas en la poza: cuántas a la vez, tamaño de la textura, escala de y hasta, vida (ms) y opacidad. */
    ripples: { count: 4, width: 22, height: 5, scale: [0.4, 1.7], lifeMs: 1500, alpha: 0.8 },
    /** Manchas de espuma al pie: cuántas, tamaño, vida (ms), cuánto suben y opacidad. */
    foam: { count: 10, width: 7, height: 4, lifeMs: 900, rise: 4, alpha: 0.85 },
    /** Gotas que saltan al pie: por segundo, velocidad hacia arriba (de y hasta, px/s), hacia los lados, gravedad y vida (ms). */
    drops: { perSec: 18, speedY: [-110, -45], speedX: 45, gravity: 320, lifeMs: 520 },
    /** Nube de rocío: bocanadas por segundo, tamaño, velocidades, escala de y hasta, opacidad y vida (ms). */
    mist: { perSec: 5, width: 20, height: 12, speedY: [-18, -6], speedX: 10, scale: [0.7, 1.9], alpha: 0.6, lifeMs: 2400 },
  },

  /** Vacas sueltas de Capiatá (extra del nivel 4): caminan despacio, mugen y sirven de plataforma. */
  cow: {
    width: 30,
    /** Con el sprite, el lomo queda ≈ 20 unidades sobre los pies: el cuerpo (height − 4) llega ahí. */
    height: 24,
    speed: 14,
    patrolDistance: 56,
    /** Mugido: cada cuánto, al azar entre estos valores (ms); solo si está en pantalla. */
    mooMinMs: 4000,
    mooMaxMs: 9000,
    /** Pausa al llegar a cada punta de la patrulla (ms). */
    turnPauseMs: 1200,
  },

  /**
   * Vaca guasu (S27): la vaca suelta en grande, en el potrero escondido de l4. Es la misma vaca (no daña, camina sola
   * y se la usa de plataforma de un solo sentido) con sus propios valores; la común (`cow`) no cambia. Cruza el potrero
   * de espinas con Kerana en el lomo.
   */
  bigCow: {
    /** Tamaño respecto de la vaca común (dibujo y cuerpo). Con 2,4 el lomo queda 48 px (3 filas) sobre los pies. */
    scale: 2.4,
    /** Velocidad (px/s): la de la común por la escala (14 × 2,4 ≈ 34), los mismos pasos pero más largos. */
    speed: 34,
    /** Media patrulla (px): va y viene ± esto desde donde nace. En l4, del henil (a 1 tile) al ras de la repisa del premio. */
    patrolDistance: 68,
    /** Pausa en cada punta (ms): el momento de subirse o bajarse. */
    turnPauseMs: 1200,
    /** Mugido (más grave que el de la común): cada cuánto, al azar entre estos valores (ms); solo si está en pantalla. */
    mooMinMs: 3000,
    mooMaxMs: 6000,
  },

  // ── S18: piezas de motor (plataformas móviles, disparadores, variantes de hongo) ──────────────
  // Valores nuevos; ninguno cambia un valor anterior. Los mapas pueden pisarlos por objeto.

  /** Plataforma móvil (`Mover`): va y viene entre su origen y `dx`/`dy` tiles. */
  mover: {
    /** Velocidad por defecto (px/s) si el mapa no trae `speed`. */
    speed: 40,
    /** Espera en cada extremo por defecto (ms) si el mapa no trae `waitMs`. */
    waitMs: 600,
    /** Alto del cuerpo (px): una plataforma de una fila ocupa la parte de arriba del tile, como el `=`. */
    thickness: 8,
    /** Tolerancia (px) entre los pies y la cara de arriba para contar que algo viaja encima. */
    rideTolerancePx: 3,
    /** Filas de arte de las casillas 16 a 18 del tileset (la plataforma fija dibuja solo estas). */
    artRows: 6,
    /**
     * La móvil mide `thickness` (8): las filas que sobran bajo el arte repiten la última fila del tileset
     * oscurecida con este negro (0 a 1). Tapa el cuerpo entero y la deja un poco más gruesa que la fija.
     */
    undersideShade: 0.45,
    /** Sin tileset (o la versión sólida): rectángulo liso de estos colores. */
    color: 0x8a6a48,
    edgeColor: 0xc9a67a,
    /**
     * S118: aspecto propio por bioma (moverLook.ts); los que no están se ven como siempre. Cielo (Yvága): una losa de
     * piedra flotante de la hoja de detalle (`mover` en `detalle/cielo.json`, 12 filas de arte: la cara, el cascajo y sus
     * dientes) con un brillo suave debajo, que respira despacio (quieto con «Destellos» apagado).
     */
    looks: {
      cielo: {
        source: 'detail' as const,
        artRows: 12,
        glow: {
          pad: 6,
          height: 16,
          colors: [0xd8f4ff, 0x9fd8f0, 0x8a86d8, 0x6a4fb0],
          alphas: [0.16, 0.3, 0.46],
          steps: [0.08, 0.3, 0.55],
        },
        breathMs: 2600,
        breath: 0.35,
      },
    },
  },

  /** Disparador (`Switch`): piedra que se enciende con el sable o con la onda de luz. */
  switches: {
    /** Tamaño de la piedra (px), dentro de su tile. */
    size: 10,
    /** Temporizado: últimos ms en que avisa que se va a apagar (parpadeo). */
    warnMs: 1500,
    /** Parpadeo del aviso (Hz). */
    warnBlinkHz: 6,
    /**
     * La luz de la onda sigue hasta su alcance aunque la onda choque con una pared (Ground):
     * enciende un Switch del otro lado, pero no daña nada más allá (enemigos y jefes, como antes).
     */
    waveThroughWalls: true,
    colorOff: 0x4a5a6e,
    colorOn: 0xf2c14e,
  },

  /** Reja que abre un Switch (`Gate`). */
  gate: {
    /** Lo que tarda en subir o bajar (ms). */
    moveMs: 300,
    /** Abierta, los barrotes quedan recogidos arriba a esta fracción del alto. */
    openScale: 0.12,
    color: 0x3a3a48,
  },

  /** El paso de la ofrenda (S36): cortina de raíces antes de la antesala; la abren las tres chipas del nivel. */
  offering: {
    /** Frente a la puerta: hasta esta distancia (px) a su izquierda Mainumby habla y se entrega la ofrenda. */
    nearPx: 40,
    /** Desde que empieza la ofrenda hasta que se abre (ms): las chipas vuelan y la tablita brilla. */
    offerMs: 1500,
    flyMs: 450,
    flyStaggerMs: 160,
    /** Lo que tardan las raíces en recogerse (ms) y la fracción del alto que queda arriba. */
    retractMs: 600,
    openScale: 0.06,
    /** Tablita: a esta altura sobre el piso (px, a los ojos de Kerana), íconos de este tamaño y separación. */
    plaqueHeightPx: 34,
    plaqueRisePx: 24,
    slotSize: 10,
    slotSpacing: 12,
    lineAbovePx: 12,
    boardColor: 0x7a5636,
    boardEdge: 0x3a2616,
    rootColor: 0x4a3220,
    rootLight: 0x7a5a38,
    leafColor: 0x4f7a34,
    /** La cortina se dibuja este tanto (px) más ancha que el paso a cada lado. */
    rootPadPx: 4,
    rootWavePx: 9,
    rootWaveAmp: 1.4,
    leafEveryPx: 18,
  },

  /** Variantes del hongo (`Bouncer kind=once|sleep`); el rebote es el mismo (`jungle.bounceVelocity`). */
  bouncerVariants: {
    /** De un solo uso: tiempo desinflado antes de volver (ms). */
    onceRespawnMs: 3000,
    /** Colores del sombrero desinflado y del dormido. */
    deflatedColor: 0x8a6a5a,
    asleepColor: 0x6a6a8a,
  },

  /** Oscuridad (GDD §4.8, §6.7): iluminación de Phaser 4. Colores de ambiente en 0xRRGGBB. */
  darkness: {
    /** Noche con luna entre nubes (el nivel entero). */
    ambientNight: 0x4a4e6e,
    /** Dentro de una DarkZone o durante el apagón de Luisón. */
    ambientDark: 0x1c1c30,
    /** Después de liberar a Luisón (las velas encendidas). */
    ambientCandles: 0x7a6a5a,
    /** Cuánto tarda el ambiente en pasar de un valor a otro (ms). */
    fadeMs: 600,
    /** Halo de Kerana: radio (px), color e intensidad. */
    haloRadius: 96,
    haloColor: 0xf2e2b8,
    haloIntensity: 1.6,
    /** Altura (z) de las luces sobre el plano. */
    lightZ: 40,
    /** El póra sin luz se ve así de transparente (y el sable lo atraviesa). */
    unlitPoraAlpha: 0.35,
  },

  /** Faroles (GDD §6.7): se encienden al tocarlos; dan luz. Los checkpoints de los niveles oscuros también alumbran. */
  lantern: {
    radius: 88,
    color: 0xf2c14e,
    intensity: 1.8,
    /** Zona para encenderlo (px, centrada en el poste). */
    touchWidth: 20,
    touchHeight: 40,
    postHeight: 34,
    /** S32: brasa del farol apagado (radio en px y alfa), para encontrarlo en la oscuridad. */
    emberRadius: 2,
    emberAlpha: 0.55,
    /**
     * S33: aplique de pared (`mount=wall`): el farol cuelga de un brazo corto, sin poste. `sconceArm` = del muro al
     * centro del farol (px); `sconceBrace` = alto de la escuadra sobre el brazo; `sconceLift` = cuánto puede subir el
     * brazo (px) para encontrar muro firme (sobre una reja). Solo dibujo: la zona para tocarlo y la luz no se mueven.
     */
    sconceArm: 8,
    sconceBrace: 6,
    sconceLift: 24,
    /** S33: nicho (`mount=niche`, farol dentro de un muro que se ve desde fuera): hueco en arco, ancho y alto en px. */
    nicheWidth: 14,
    nicheHeight: 26,
  },

  /**
   * Parpadeo de la fogata del checkpoint encendida (arte fire_on): estira la llama `amplitude` (fracción de la escala)
   * con dos ondas (rad/s) y la entibia hasta `tintDip` (fracción menos de verde y azul).
   */
  checkpointFire: {
    amplitude: 0.05,
    speedA: 9,
    speedB: 15.5,
    tintDip: 0.12,
  },

  /** Velas que se encienden al liberar a Luisón (GDD §6.7). */
  candles: {
    count: 10,
    /** Cuántas llevan luz propia (Phaser limita las luces a la vez). */
    lights: 4,
    radius: 70,
    color: 0xf2a84e,
    intensity: 1.4,
    /** Tiempo entre una vela y la siguiente (ms). */
    gapMs: 120,
  },

  /** Luisón (GDD §6.7): 18 golpes, 3 fases de 6. Lugares en tiles desde el borde izquierdo de la arena (ver l7.txt). */
  luison: {
    width: 24,
    height: 34,
    /** Fase 2 (luna llena): crece y gana velocidad. */
    grownScale: 1.3,
    grownSpeedScale: 1.35,
    /** Techos de los mausoleos (centro, en tiles) y su altura sobre el suelo (tiles). */
    roofTiles: [4.5, 36.5],
    roofHeightTiles: 3,
    /** Suelo libre entre los mausoleos (bordes, en tiles): la embestida va de uno a otro. */
    floorTiles: [8, 33],
    /** Lápida del centro (tile) y su alto (px). */
    tombTile: 20,
    tombHeight: 18,
    startTile: 28,
    /**
     * Huesos (S89; antes terrones, de ahí los nombres `clod*`): cuántos por ataque, espera entre uno y otro (ms),
     * gravedad (px/s²), vuelo (ms) y radio del golpe (px).
     */
    clodsPerThrow: 3,
    clodGapMs: 260,
    clodGravity: 520,
    clodFlightMs: 850,
    clodRadius: 4,
    /** El dibujo del hueso (S89): largo y grosor de la caña (px), radio de los nudos, colores y giro en el aire (°/s). */
    boneLengthPx: 10,
    boneShaftPx: 2,
    boneKnobRadius: 1.5,
    boneColor: 0xf2eee3,
    boneOutlineColor: 0x2a2228,
    boneSpinDegPerSec: 540,
    /** Póra que llama el aullido y máximo a la vez. */
    poraPerHowl: 2,
    maxPora: 3,
    /** Embestida: margen a los mausoleos (px) y caminata entre ataques (px/s). */
    edgeMarginPx: 6,
    walkSpeed: 45,
    /** Salto a los techos (ms). */
    leapMs: 450,
    /**
     * Ojos en la oscuridad (S89): dos puntos de `eyeColor` con un brillo alrededor, solo durante el apagón y solo
     * mientras el halo de Kerana no lo alumbra (alumbrado, el sprite ya tiene sus ojos). `eyeDotPx` (lado del punto) y
     * `eyeGlowRadius` en px; `eyeGlowAlpha` es el alfa del brillo; `eyePulseScale`, cuánto crecen en el aviso.
     * Se apagan de `eyeLitFadePx` px antes del borde del halo hasta el borde (`darkness.haloRadius`).
     */
    eyeColor: 0xf2e24e,
    eyeDotPx: 2,
    eyeGlowRadius: 2.5,
    eyeGlowAlpha: 0.35,
    eyePulseScale: 1.6,
    eyeLitFadePx: 24,
    /** Sombra de Tau detrás (fase 3): alfa y cuánto sobresale (px). */
    tauShadowAlpha: 0.55,
    tauShadowPadPx: 14,
  },

  /** Tau, jefe final en Yvága (GDD §7). Lugares en tiles, relativos a la arena (tools/levels/yvaga.txt). */
  tau: {
    /** Disfraz (joven de la flauta) y forma real (humo), en px. */
    width: 16,
    height: 32,
    trueWidth: 44,
    trueHeight: 36,
    /**
     * Tamaño por fase (S94): × sobre el de la fase 1, para el sprite, el cuerpo que recibe el tajo y de dónde salen
     * las notas, el anillo, los rayos y los ojos. Solo enteros: cada píxel del arte queda como un bloque parejo.
     * Cambia al empezar la fase, tapado por el estallido de humo.
     */
    phaseScale: [1, 2, 3] as readonly number[],
    /** Las siete estrellas: borde izquierdo (tile) y fila de la plataforma (3 tiles de ancho). */
    starTiles: [
      [3, 20],
      [9, 17],
      [15, 14],
      [21, 17],
      [27, 14],
      [31, 17],
      [35, 20],
    ] as ReadonlyArray<readonly [number, number]>,
    starWidthTiles: 3,
    /** Fase 1: dónde se para en las nubes (tiles) y cuánto tarda en cambiar de lado (ms). */
    floorTiles: [6, 34],
    blinkMs: 350,
    /** Notas de la flauta: cuántas por ataque, velocidad (px/s) y radio (px). */
    notesPerAttack: 4,
    noteSpeed: 110,
    noteRadius: 3,
    noteColor: 0x9fe0ff,
    /** Melodía: anillo que hipnotiza (radio máximo y grosor en px). */
    melodyRadius: 120,
    melodyBandPx: 10,
    /** Fases 2 y 3: altura a la que flota (tiles sobre el suelo). */
    floatTiles: 11,
    floatMs: 500,
    /** Eco de Teju Jagua: rocas que caen (cuántas y separación en tiles). */
    echoRocks: 4,
    echoRockGapTiles: 3,
    /** Eco de Mbói Tu'i: empujón del graznido (px/s, ms) y barrida de la sombra por las nubes (px de alto). */
    squawkPush: 130,
    squawkMs: 450,
    sweepHeight: 14,
    /** Eco de Jasy Jatere: enjambres por ataque. */
    echoSwarms: 1,
    /** Fase 3: humo sobre las nubes (tiles de alto), rayos rojos y el rayo de la estrella. */
    smokeTiles: 2,
    smokeColor: 0x6a2e8f,
    boltsPerAttack: 3,
    boltSpeed: 170,
    boltColor: 0xe04848,
    eyeColor: 0xe04848,
    beamColor: 0xfff2c0,
    /**
     * Fase 3 (S94): Tau flota y baja siempre por encima de las siete estrellas. `trueClearPx`: lo que deja libre sobre
     * cada plataforma (Kerana parada mide ≈ 32 de alto). Flotando, sobre la más alta; el rayo de la estrella encendida
     * lo baja sobre ella, lo más bajo que se pueda sin tapar otra, y montado `pullOverlapPx` px sobre la encendida
     * como mínimo, para que Kerana le llegue saltando.
     */
    trueClearPx: 44,
    pullOverlapPx: 24,
    /** Estrella encendida: brillo y escala. */
    starLitScale: 1.5,
    /**
     * S118: el dibujo de las siete estrellas (tauStarPaint.ts, TauStars.ts): estrellas de cristal en pixel art a
     * `detail` píxeles por unidad (radio `outer`, entrada `inner`, en unidades: las de la estrella de código de antes),
     * con su halo, un destello que titila cada `twinkle.periodMs` (desfasado por estrella) y, la que la fase 3 enciende,
     * dorada, con un halo grande que respira y rayos que giran. Solo el dibujo: dónde están y cuándo se encienden, igual.
     * Con «Destellos» apagado, quietas.
     */
    starLook: {
      detail: 2,
      outer: 7,
      inner: 3,
      /** Del contorno a la luz: cristal lila (en reposo) y dorado (la encendida). */
      idle: [0x2b2260, 0x5a52a8, 0x8f88d8, 0xc4c0f2, 0xeae9ff, 0xffffff],
      lit: [0x6a3a12, 0xc27c22, 0xf2c14e, 0xffe08a, 0xfff4cc, 0xffffff],
      haloIdle: { radius: 10, colors: [0x6c62c8, 0xd8d4ff], alphas: [0.12, 0.2, 0.3], alpha: [0.45, 0.75] },
      haloLit: { radius: 20, colors: [0xb86a1e, 0xfff0b0], alphas: [0.1, 0.24, 0.45], alpha: [0.8, 1] },
      idleBreathMs: 900,
      litBreathMs: 260,
      glint: { arm: 5, color: 0xffffff, at: [-2.5, -3] },
      twinkle: { periodMs: [2200, 3600], offsetMs: 1370, flashMs: 420 },
      rays: { length: 22, color: 0xfff0b8, spinMs: 9000 },
    },
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
    /** S99: el panal cuelga del terreno sólido que haya hasta estas filas arriba; si no hay, se apoya en el piso. */
    hiveCeilingRows: 3,
    /** De una plataforma de un sentido cuelga de su dibujo, no del tile: alto del borde (6 de 16 px en pueblo y cielo). */
    hivePlatformLip: 6,
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
    /**
     * Piso de la cámara (S92, `rect CameraFloor` del mapa): velocidad (px/s) con la que la vista sube hasta él cuando
     * Kerana entra en su zona (la antesala de Yvága: la vista sube a encuadrar la arena en vez de saltar al trabarse).
     */
    floorSpeed: 300,
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
    /** Daño al salir de un encierro con la red de seguridad (S23): como una caída a un pozo. */
    trap: 1,
    /** Ao Ao alcanza a Kerana en la persecución (S31): como una caída a un pozo. */
    chase: 1,
  },

  /**
   * Red de seguridad contra encierros (S23, `src/systems/trapLogic.ts`). Al cargar el nivel se marcan los pisos
   * de los que Kerana no puede salir con lo que tiene (sin salto doble, por ejemplo); si queda en uno, pasado este
   * tiempo vuelve al último suelo firme y le cuesta `damage.trap`. No hace falta saber que existe: se dispara sola.
   */
  trap: {
    /** Espera desde que Kerana pisa un encierro hasta que la red la saca (ms). Da para recoger el premio y probar a salir. */
    waitMs: 4000,
  },

  /**
   * Ñakurutu guasu (S23): el ñakurutu de siempre en grande, guardián de un camino oculto de l2. Es un encuentro, no un
   * jefe: sin barra ni arena. Avisa largo (temblor, blanco y graznido), se lanza, queda aturdido en el suelo y vuelve
   * despacio; se lo vence a golpes o se pasa por debajo mientras vuelve.
   */
  guardian: {
    /** Golpes que aguanta (el tajo cargado cuenta `chargedSlash.damage`). */
    hp: 5,
    /** Corazones que quita al tocarla (el ñakurutu común quita `damage.enemyContact`). */
    contactDamage: 2,
    /** Tamaño respecto del ñakurutu común (dibujo y cuerpo). */
    scale: 2.6,
    /** Distancia (px) a la que se lanza si Kerana está más abajo. */
    detectRadius: 128,
    /** Aviso antes de lanzarse (ms): tiempo para alejarse o prepararse. El común avisa 500. */
    telegraphMs: 1100,
    /** Velocidad de la picada y de la vuelta a su rama (px/s). */
    diveSpeed: 200,
    returnSpeed: 55,
    /** Tope de la picada (ms). */
    diveMaxMs: 1400,
    /** Aturdido en el suelo tras la picada (ms): la ventana para pegarle o pasar. */
    restMs: 1000,
    /** Espera en la rama antes de poder lanzarse otra vez (ms). */
    cooldownMs: 1600,
  },

  /**
   * Jakare guasu (S24): el jakare en grande de la zona de ritmo de l2. No espera a Kerana: asoma cada vez que llega
   * la balsa que tiene al lado (se sincroniza solo con la plataforma cuya punta le queda más cerca), siempre igual,
   * para que desde la balsa anterior se lea el ritmo: burbujas mientras la balsa llega, afuera al juntarse las balsas,
   * abajo el resto. Muerde el hueco y la primera baldosa de la balsa de llegada. El jakare común no cambia.
   */
  bigJakare: {
    /** Tamaño del dibujo y del cuerpo (el cuerpo de 25 × 16 queda en 45 × 29: el hueco y una baldosa de la balsa). */
    scale: 1.8,
    /** Golpes que aguanta (solo afuera; el tajo cargado cuenta `chargedSlash.damage`). */
    hp: 6,
    /** Burbujas antes de asomar (ms): empiezan mientras la balsa todavía está llegando. */
    warnMs: 1000,
    /** Afuera desde que llega la balsa (ms): el resto de su espera es la ventana para saltar. */
    exposedMs: 1000,
    /** Cuánto sale del agua el cuerpo (px): cabeza y lomo; el resto queda bajo el agua. El común sale 8. */
    emergeHeight: 20,
  },

  /**
   * Payesero (S62, GDD §5.3): el hechicero que lanza payé. Quieto en su sitio, mira a Kerana y, si ella entra en su
   * alcance, carga el hechizo (el aura sube: es el aviso) y lo lanza desde la punta de la mano. Todo esto se afina
   * jugando, no calculando. Kerana corre a 150 px/s; un tile son 16 px.
   */
  payesero: {
    /** Golpes que aguanta (el tajo cargado cuenta `chargedSlash.damage`). */
    hp: 3,
    /** Alcance (px, distancia en línea recta a Kerana): fuera de él no ataca. ≈ 9 tiles. */
    range: 150,
    /** Hasta dónde la sigue con la mirada (px): gira cuando ella le pasa al otro lado, aunque esté fuera de alcance. */
    watchRadius: 240,
    /** Carga del hechizo (ms): el aura sube y levanta el mbaraka. Es el aviso del ataque. */
    chargeMs: 900,
    /** Espera después de lanzar hasta poder cargar otro (ms). */
    cooldownMs: 2400,
    /** Punta de la mano en el cuadro del ataque, desde los pies (unidades): hacia adelante y hacia arriba. */
    hand: { forward: 26, rise: 46 },
    /** Mitad del cuerpo de Kerana: el payé apunta al pecho, no a los pies (px). */
    targetLift: 20,
    /** Cada cuántos px mira si hay roca entre la mano y Kerana (sin camino libre no carga). */
    losStep: 8,
    paye: {
      /** Velocidad (px/s). Lento a propósito: ≈ 40 % de la carrera de Kerana. */
      speed: 60,
      /** Cuánto tiempo corrige el rumbo hacia Kerana desde que sale (ms). Después sigue recto. */
      homingMs: 1200,
      /** Cuánto gira por segundo mientras corrige (grados). Más alto = más difícil de esquivar. */
      turnRateDeg: 90,
      /** Cuánto vive (ms): al cumplirlo se deshace en humo. 5 s a 60 px/s ≈ 19 tiles. */
      lifeMs: 5000,
      /** Radio que lastima a Kerana (px): el núcleo del cometa, no la estela. */
      hitRadius: 3.5,
      /** Radio que corta el sable (px): más generoso que el que lastima, para premiar el tajo. */
      cutRadius: 6,
      /** Cuántos puede tener en el aire a la vez. */
      pool: 2,
      /** Núcleo del cometa en el PNG (fracción del ancho desde la cabeza; la estela va detrás). */
      coreX: 0.13,
      /** Respaldo sin el PNG: radio y color del círculo. */
      fallbackRadius: 4,
      fallbackColor: 0x9b4dff,
      /** Humo al deshacerse (cortado, contra una pared o al caducar): duración (ms). */
      puffMs: 260,
    },
    /** Aura violeta por código (filtro Glow sobre la silueta): no está en el sprite porque cambia de estado. */
    aura: {
      color: 0xa45cff,
      /** En reposo: tenue y constante. */
      idleStrength: 2,
      /** Al final de la carga (sube desde el reposo durante `chargeMs`, con un latido). */
      chargeStrength: 5,
      /** Latido de la carga (Hz) y cuánto oscila (fracción de la fuerza). */
      chargePulseHz: 6,
      chargePulse: 0.2,
      /** Después de lanzar vuelve al reposo en este tiempo (ms). */
      settleMs: 400,
    },
    /**
     * Purificación de un humano (GDD §4.1): humo violeta que sube, destello cálido, el aura se apaga y se desvanece.
     * Nada de chispas ni de agrandarse: un humano que se disuelve se lee como que murió.
     */
    purify: {
      smokeCount: 12,
      smokeColor: 0x7a3fb0,
      smokeAlpha: 0.7,
      /** Lado (px) de cada bocanada al salir, cuánto crece y cada cuánto sale la siguiente (ms). */
      smokeSize: 14,
      smokeGrow: 2.2,
      smokeStaggerMs: 45,
      /** Cuánto sube (px) y en cuánto tiempo (ms). */
      smokeRise: 44,
      smokeMs: 1500,
      /** Destello cálido en el pecho: color, lado máximo (px) y duración (ms). */
      flashColor: 0xffd27a,
      flashSize: 70,
      flashMs: 420,
      /** Lado (px) de la textura suave del humo y del destello (se escala). */
      softSize: 32,
      /** El aura se apaga en este tiempo (ms). */
      auraOffMs: 600,
      /** Se desvanece después de `fadeDelayMs` en `fadeMs` (ms). */
      fadeDelayMs: 600,
      fadeMs: 1400,
    },
  },

  /**
   * Karaí Vosá (S70; guardián fijo desde S72): el viejo de la bolsa, un hombre maldito por Tau. Quieto y siempre a la
   * vista, cuida un lugar de paso. Cuando Kerana entra en su radio levanta la cuchara (el aviso), pega un cucharazo
   * corto delante y se recupera. No camina ni persigue. Tocarlo no lastima: solo el cucharazo.
   */
  karaiVosa: {
    /** Golpes que aguanta. */
    hp: 2,
    /** Distancia horizontal (px) a la que empieza el aviso: 4 tiles. */
    detectRadius: 64,
    /** Diferencia de altura (px) hasta la que la ve: más de 2,5 tiles arriba o abajo, no golpea. */
    detectHeight: 40,
    /** Distancia (px) a la que gira para mirarla, quieto. */
    watchRadius: 128,
    /**
     * No la ve a través de lo sólido (un fardo, un muro): la línea va de su pecho al de ella, a `eyeHeight` px sobre los
     * pies, y se mira cada `losStep` px. Así no golpea el fardo mientras Kerana lo rompe del otro lado.
     */
    eyeHeight: 24,
    losStep: 4,
    /** Aviso (ms): levanta la cuchara al hombro (cuadros 0 a 4 de `attack`). */
    telegraphMs: 600,
    /** El cucharazo (ms): baja la cuchara al suelo (cuadros 5 a 7). Lastima una vez por golpe. */
    activeMs: 300,
    /** Se recupera (ms), con la cuchara abajo (cuadros 8 y 9): la ventana para pasar o pegarle. */
    recoverMs: 900,
    /** Cuadros de `attack` (primero y último) de cada tiempo; se reparten parejos en su duración. */
    frames: { telegraph: [0, 4], active: [5, 7], recover: [8, 9] } as const,
    /**
     * Zona del cucharazo delante del cuerpo (px): `reach` desde el borde del cuerpo (la cuchara del dibujo llega a
     * 15-17 del borde; algo más por el arco del golpe) y `height` desde los pies.
     */
    strike: { reach: 20, height: 36 },
  },

  /**
   * Jaguarú (S77): el Señor de las cavernas de l6, guardián del tiempo. Quieto siempre y con su propio reloj: no mira a
   * Kerana ni reacciona a que se acerque. Con los ojos cerrados (`restMs`) es inofensivo; abre los ojos (el aviso),
   * tira una dentellada (lo único que lastima, una vez por ciclo) y los cierra. Tocarle el cuerpo no lastima.
   * Ojos cerrados 2 s y abiertos 2 s (aviso + dentellada + cerrarlos). El arquetipo es el Guardián con reloj.
   */
  jaguaru: {
    /** Golpes que aguanta. */
    hp: 3,
    /** Ojos cerrados (ms): la hoja `idle`, el tiempo para pasar. */
    restMs: 2000,
    /** Abre los ojos (ms), el aviso: cuadros 0 a 3 de `attack`. Con Kerana a la vista, fija la mira (S117). */
    telegraphMs: 800,
    /** El rayo (ms; hasta S116, la dentellada): cuadros 4 y 5, las fauces abiertas. Lastima una vez por ciclo. */
    activeMs: 500,
    /** Cierra los ojos (ms): los cuadros del aviso al revés (3 a 0). Ya no lastima. */
    recoverMs: 700,
    /** Dónde arranca el ciclo (ms ya pasados de ojos cerrados). */
    startMs: 0,
    /** Cuadros de `attack` (primero y último) de cada tiempo; el de cerrar los ojos va al revés. */
    frames: { telegraph: [0, 3], active: [4, 5], recover: [3, 0] } as const,
    /**
     * El rayo de los ojos (S117; reemplaza a la dentellada). Al abrir los ojos, si Kerana está adelante (no gira), a la
     * vista (contra Ground, con los fardos) y en el alcance, fija la mira donde está ella; en el golpe dispara por esa
     * línea, que sigue hasta lo sólido. Lógica en `jaguaruLaser.ts`; el dibujo en `jaguaruLaserArt.ts` y `JaguaruLaserFx.ts`.
     */
    laser: {
      /** Alcance para fijar la mira (px), de los ojos al centro de Kerana: 10 tiles. */
      range: 160,
      /** Largo máximo del rayo si no choca con nada (px): 20 tiles. */
      maxLength: 320,
      /** Paso (px) para ver a Kerana y para buscar dónde se corta el rayo. */
      losStep: 2,
      /** Medio grosor del rayo que lastima (px), sumado al cuerpo de Kerana (el núcleo y el cuerpo claro del dibujo). */
      hitHalfWidth: 2,
      /** Cuánto adelante de los ojos tiene que estar Kerana (px): detrás de los ojos (o debajo de la cabeza), no dispara. */
      minAhead: 0,
      /** Corazones que saca. Pasa por el mismo camino que el daño de 1 (inmunidad, Luz de Arasy, god y retroceso). */
      damage: 2,
      /**
       * De dónde sale (px desde los pies, hacia donde mira y hacia arriba): el centro de los ojos de la cara en los
       * cuadros 4 y 5 (en el cuadro de 200 × 88 a 2 por unidad: (28, 31) desde la esquina de arriba a la izquierda).
       */
      muzzle: { forward: 36, up: 28.5 },
      /** Dibujo (pixel art; texturas generadas una vez por partida). */
      art: {
        /**
         * La rampa de los ojos, medida en el sprite (cuadros 1 a 5 de `attack`, 1405 píxeles a 4 del centro de cada ojo,
         * en siete tramos de luminancia), de hondo a claro, y el núcleo blanco caliente (blanco con un tinte rosado).
         */
        ramp: [0x400b6c, 0x560f8a, 0x6b0ea5, 0x7a11b6, 0xc353df, 0xfb94fc, 0xfeacfe, 0xfff4ff],
        /** Píxeles de textura por unidad (como Kerana y los enemigos). */
        detail: 2,
        /** El cuadro de la hoja `attack` (px de textura) y dónde van los pies (abajo al centro). */
        frame: [200, 88] as const,
        /**
         * Los ojos de cada cuadro de `attack` (px del cuadro, mirando a la izquierda como la hoja), medidos (los núcleos
         * claros de cada ojo): 5 en el cuadro 0, 7 en el 1 al 3 (tres pares en la cara y el del lomo), 4 o 5 en el golpe.
         */
        eyes: [
          [[23, 37.5], [32.5, 37], [22, 44.5], [31.5, 45], [57, 22]],
          [[22.5, 40], [21.5, 46], [34, 39], [34.5, 46], [43, 38], [43, 45.5], [60.5, 22]],
          [[23.5, 39.5], [23, 46.5], [36, 38.5], [36, 45.5], [45, 37.5], [45, 45], [60, 21.5]],
          [[28.5, 30.5], [27.5, 36.5], [41, 29], [41.5, 36], [49.5, 27.5], [49.5, 35.5], [65, 17]],
          [[23.5, 25.5], [32.5, 28], [28, 34], [58, 21.5]],
          [[23.5, 30], [32.5, 31.5], [29, 38], [20.5, 35], [58, 21.5]],
        ] as readonly (readonly (readonly [number, number])[])[],
        /** Cuántos de cada lista son de la cara (el resto, el del lomo): de ahí sale la mira. */
        faceEyes: [4, 6, 6, 6, 3, 4] as const,
        /** El cuerpo del rayo: largo y alto de la textura (px de textura; el alto, impar) y variantes del borde. */
        beamLength: 48,
        beamHeight: 15,
        beamVariants: 4,
        /** Probabilidad de las tres filas de afuera por columna (de adentro hacia afuera): el borde que vibra. */
        edgeChance: [0.85, 0.55, 0.25],
        streaks: 7,
        streakLength: [3, 9] as const,
        /** El halo aditivo: alto (px de textura) y opacidad del centro. */
        haloHeight: 31,
        haloAlpha: 0.55,
        /** La mira: largo del dibujo que se repite y del pulso claro (px de textura). */
        aimLength: 24,
        aimPulse: 3,
        glowRadius: 5,
        flashRadius: 12,
        flashCore: 2.5,
        ringRadius: 15,
        ringWidth: 3,
        smokeRadius: 6,
        /** El humo de la roca quemada: gris violáceo, entre la tierra de l6 y el pelo del Jaguarú; el borde y el centro. */
        smokeColor: 0x4c3f4e,
        smokeCore: 0xa8979f,
        smokeAlpha: 0.75,
      },
      /** Cómo se mueve el dibujo. */
      fx: {
        /** Profundidad del rayo, la mira y lo que salta (delante de Kerana, detrás de la cascada y del Foreground). */
        depth: 7,
        /** El brillo de los ojos en el aviso: opacidad y escala del principio al final, y el pulso (Hz). */
        eyeAlpha: [0.3, 1] as const,
        eyeScale: [0.45, 1.05] as const,
        eyePulseHz: 7,
        /** El halo de la cara en el aviso (escala y opacidad del principio al final). */
        faceScale: [1.1, 2.4] as const,
        faceAlpha: [0.12, 0.5] as const,
        /** Al cerrar los ojos, el brillo se apaga en esta parte del tiempo de cerrar (0-1). */
        eyeFadeOut: 0.45,
        /** Partículas que se juntan en los ojos: cada cuánto (ms) al principio y al final, de dónde (radio, px) y vida. */
        gatherEveryMs: [35, 8] as const,
        gatherRadius: [12, 26] as const,
        gatherLifeMs: [260, 380] as const,
        /** La mira: opacidad del principio al final, cuánto titila, cada cuánto (ms) y velocidad del pulso (px/s). */
        aimAlpha: [0.3, 0.75] as const,
        aimFlicker: 0.45,
        aimFlickerMs: 45,
        aimSpeed: 140,
        /** En la última parte del aviso la mira parpadea (0-1 del aviso). */
        aimBlinkFrom: 0.8,
        aimBlinkMs: 60,
        /** El rayo: en qué parte del golpe se ensancha y en cuál se afina y se apaga (0-1), y el grosor al apagarse. */
        growUntil: 0.1,
        thinFrom: 0.68,
        thinTo: 0.12,
        /** Cada cuánto cambia la variante del borde (ms) y cuánto vibra el grosor (±). */
        vibrateMs: 40,
        vibrate: 0.12,
        /** Cuánto corre el dibujo del rayo (px/s, hacia afuera) y cuánto titila el halo (±). */
        flowSpeed: 260,
        haloFlicker: 0.2,
        /** Cuánta luz pierde el rayo a lo largo (0-1, a su largo máximo): en el aire se disipa. */
        farFade: 1,
        /** El destello de los ojos al disparar (ms y escala del principio al final). */
        flashMs: 150,
        flashScale: [0.35, 1.5] as const,
        /** La bola de luz en los ojos mientras dispara. */
        orbScale: 2.4,
        /** Chispas a lo largo del rayo: cada cuánto (ms), velocidad (px/s) y vida (ms). */
        sparkEveryMs: 12,
        sparkSpeed: [12, 40] as const,
        sparkLifeMs: [160, 320] as const,
        /** Donde se corta contra lo sólido: chispas (cada cuánto, velocidad, abanico en grados, gravedad, vida). */
        cutEveryMs: 14,
        cutSpeed: [50, 130] as const,
        cutSpread: 70,
        cutGravity: 380,
        cutLifeMs: [180, 360] as const,
        /** El punto caliente en la pared (escala) y el humo (cada cuánto, cuánto sube, cuánto se aparta de la pared, cuánto crece, vida). */
        hotScale: 2.4,
        smokeEveryMs: 45,
        smokeRise: [24, 42] as const,
        smokeDrift: 14,
        smokeGrow: [0.7, 2.6] as const,
        smokeLifeMs: 900,
        /** Cada bocanada, distinta: tamaño y vida (× los de arriba; también el ritmo) y cuánto se corre al nacer (px). */
        smokeSize: [0.7, 1.35] as const,
        smokeLife: [0.7, 1.15] as const,
        smokeJitter: 2.5,
        smokePool: 8,
        /** El estallido sobre Kerana: el anillo (ms, escala), el destello y las chispas. */
        burstMs: 280,
        burstScale: [0.3, 2.2] as const,
        burstSparks: 22,
        /** Sin destellos (Opciones): opacidad del destello y del estallido, y la mira sin titilar. */
        calmFlashAlpha: 0.35,
      },
    },
  },

  /**
   * Yaguareté avá (S76): el hombre jaguar de l5, maldito por Tau. Espera en una copa; cuando Kerana entra en su radio se
   * agazapa (el aviso), corre hacia ella y, si está del otro lado de un hueco, se planta en el borde y salta UNA vez.
   * Cae expuesto: quieto y sin lastimar al tocarlo, la ventana para pegarle o pasarlo. Nunca baja de su suelo: en un
   * borde sin dónde caer, o con Kerana sobre una plataforma que se mueve, frena. Es un Charger con salto (PounceMotor).
   */
  yaguareteAva: {
    /** Golpes que aguanta. */
    hp: 3,
    /** Distancia horizontal (px) a la que empieza el aviso: 12 tiles (la ve desde el otro lado del hueco). */
    detectRadius: 192,
    /** Diferencia de altura (px) hasta la que la ve: en otra copa más arriba o más abajo, no. */
    detectHeight: 24,
    /** Agazapado antes de correr (ms): el aviso (cuadros 0 y 1 de `run`, la cabeza baja). */
    telegraphMs: 600,
    /** Carrera (px/s): algo más rápido que Kerana (150). Tope de seguridad de la carrera (ms). */
    runSpeed: 170,
    runMaxMs: 1600,
    /** Plantado en el borde antes de saltar (ms): cuadro 1 de `attack`. */
    gatherMs: 180,
    /** Salto: velocidad vertical (px/s; sube ≈ 37 px) y tope de la horizontal (px/s). En el aire, cuadros 2 y 3. */
    leapVelocity: -300,
    leapMaxSpeed: 260,
    /** Hueco más ancho que salta (px): 4 tiles. El salto largo del dosel (12) no. */
    maxGapPx: 64,
    /** Cuánto pasa del borde de enfrente al caer (px), además de su ancho. */
    landMarginPx: 8,
    /**
     * No la ataca si detrás de ella, a menos de `ledgeGuardPx`, su suelo termina en un borde sin dónde caer (una caída o
     * una pared; un hueco que se salta no cuenta): el golpe la empuja ≈ 60 px y la tiraría. 4,5 tiles.
     */
    ledgeGuardPx: 72,
    /** Cuánto mira hacia delante buscando el borde (px) y cada cuánto (px). */
    lookPx: 24,
    scanStep: 4,
    /** Expuesto al caer (ms): cuadros 4 y 5 de `attack`, repartidos. */
    recoverMs: 1100,
    /** Enfriamiento antes de volver a ver a Kerana (ms). */
    cooldownMs: 900,
    /** Cuadros de cada tiempo: el aviso (de `run`), el borde, la subida y la bajada, y la caída (de `attack`). */
    frames: { telegraph: [0, 1], gather: 1, rise: 2, fall: 3, recover: [4, 5] } as const,
    /** Distancia (px) a la que gira para mirarla, quieto. */
    watchRadius: 224,
  },

  pickups: {
    /** Corazones que cura un guavirá (GDD §4.3). */
    guaviraHeal: 1,
  },

  hud: {
    /** Plumas coleccionables por nivel (GDD §4.4). */
    featherMax: 3,
    /** Pluma del contador en color: con 'all' cuando están todas las del nivel; con 'any', desde la primera (si no, gris). */
    featherColorWhen: 'all' as 'all' | 'any',
  },

  fireflies: {
    /** Luciérnagas decorativas que insinúan un secreto (rect Fireflies): sin colisión ni contador. */
    perTile: 1,
    radius: 1.5,
    color: 0xf4f18c,
    /** Vaivén (px) y duración del parpadeo (ms). */
    drift: 3,
    blinkMs: 900,
    depth: 12,
  },

  backdrop: {
    /** Fondo del nivel fijo a la cámara (sin repetir): cuánto se agranda sobre la vista para poder desplazarse. */
    /**
     * S118: el cielo vivo de Yvága (`skyDrift` en levels.ts; SkyDrift.ts, skyDriftLogic.ts, skyDriftPaint.ts). Tres capas
     * de nubes con su parallax (el fondo recorre ≈ 0,19 de lo que sube la cámara; lo jugable, 1), cuánto corren de
     * costado (unidades/s), cada cuánto hay una (unidades de la capa) y su alfa. Las formas (unidades), una paleta por
     * altura (de abajo, el mar de nubes; del medio, el violeta; de la noche, casi del color del cielo) y cuántas quedan
     * de cada altura. Tres escalones de alfa con el borde tramado, como la bruma de S103. La estrella fugaz, la de la
     * portada: cada 10 a 20 s, en la franja de noche del fondo (hasta `nightBottom` px de arte de `bg_yvaga_subida`).
     */
    skyDrift: {
      depth: -19.4,
      seed: 118,
      layers: [
        { parallax: 0.32, drift: -2.2, spacing: 64, alpha: 0.55 },
        { parallax: 0.5, drift: 4, spacing: 92, alpha: 0.72 },
        { parallax: 0.72, drift: -6.5, spacing: 150, alpha: 0.85 },
      ],
      /** Formas por altura: en la noche, tiras finas; en el violeta, bancos medianos; en el atardecer, tiras largas y chatas; abajo, bancos con lomo. */
      sizes: {
        high: [
          [190, 9],
          [130, 7],
          [240, 11],
        ],
        mid: [
          [150, 20],
          [104, 16],
          [196, 24],
        ],
        dusk: [
          [220, 14],
          [160, 11],
          [280, 16],
        ],
        low: [
          [150, 30],
          [110, 24],
          [196, 36],
        ],
      } as Readonly<Record<'low' | 'dusk' | 'mid' | 'high', ReadonlyArray<readonly [number, number]>>>,
      /** Cuánto se estiran los lóbulos a lo ancho (sobre su alto). */
      stretch: { high: 3.2, mid: 1.9, dusk: 3, low: 1.6 },
      /**
       * Paletas (de la sombra a la luz), medidas en el fondo donde va cada una: la noche (#171135 … #322259), el violeta
       * (#594082 … #aa6b9f), el atardecer (#a56aa1 … #fabcac) y el mar de nubes (#464084 … #cd93bc); un poco más claras
       * (están delante y les da la luz).
       */
      palettes: {
        high: [0x251c4e, 0x2d2358, 0x362963, 0x40306d, 0x4c3a78],
        mid: [0x4d3879, 0x5d4385, 0x6f4e8f, 0x835a98, 0x9a68a2, 0xb277aa],
        dusk: [0xa26ba3, 0xb977a7, 0xcd85a9, 0xdf94ab, 0xeda6af, 0xf8bdb5],
        low: [0x51478f, 0x62539b, 0x7563a7, 0x8b70b1, 0xa580b9, 0xc493c1],
      },
      alphas: [0.3, 0.55, 0.8],
      steps: [0.16, 0.4, 0.68],
      /** Qué hay detrás (filas de la imagen de 1132 unidades): la noche, el violeta, el atardecer y, hasta el pie, el mar de nubes. */
      bands: [
        [430, 'high'],
        [620, 'mid'],
        [800, 'dusk'],
        [99999, 'low'],
      ] as ReadonlyArray<readonly [number, 'low' | 'dusk' | 'mid' | 'high']>,
      density: { low: 0.9, dusk: 0.8, mid: 0.6, high: 0.3 },
      shooting: { everyMs: [10000, 20000] as const, durationMs: 800, travel: 150, angle: 0.42, minBand: 70, nightBottom: 900 },
    },
    overscale: 1.12,
    /** Fracción del margen sobrante que recorre de punta a punta del nivel (1 = todo el margen; parallax lento). */
    panRange: 1,
    /**
     * Desplazamiento vertical (S28): fracción del recorrido vertical de la cámara que recorre el fondo. Abajo del
     * nivel queda el encuadre de siempre (`shiftY`); al subir, el fondo baja (más cielo). La imagen se agranda hacia
     * arriba lo justo para no destaparse. 0 = fijo en vertical, como antes.
     */
    panYRange: 0.15,
    /**
     * Relleno del fondo (S29): la imagen ya no se agranda con el alto del nivel; la franja que destapa arriba al bajar
     * la cubre el color medio de sus primeras filas. Filas de la imagen que se promedian.
     */
    fillSampleRows: 4,
    /** Alto (unidades) del fundido sobre el borde de arriba de la imagen, para que no se vea la costura con el relleno. */
    fillEdgeHeight: 24,
    /**
     * Relleno por columnas (S59): el color del borde se toma en `fillColumns` tramos a lo ancho de la imagen (en l5, el
     * dosel oscuro a los costados y la neblina clara al medio), cada uno ensanchado `fillBlur` px de arte.
     */
    fillColumns: 64,
    fillBlur: 16,
    /**
     * Lluvia pintada en el fondo (S59; l5, `rain` en levels.ts). Las rayas se separan del dibujo y caen en fotogramas
     * de la misma imagen (como el agua de S47), detrás de todo el nivel (Kerana, los enemigos y el terreno, delante).
     */
    rain: {
      /** Velocidad de caída en unidades por segundo (la vista mide 360 de alto): más alto = más rápida. */
      speed: 70,
      /** Opacidad de las rayas que caen (0-1): más bajo = menos densa (la imagen limpia se ve más). */
      alpha: 0.75,
      /**
       * Cuánto bajan las rayas en un ciclo (px de arte) y en cuántos fotogramas: el paso es period / frames px.
       * Cada fotograma es la imagen entera (≈ 3,7 MB): más fotogramas = más suave y más memoria.
       */
      period: 32,
      frames: 8,
      /** Qué es una raya: contraste con sus vecinas, lo liso de los costados y cuántos vecinos verticales la siguen (ambientLogic.ts). */
      contrast: 6,
      smooth: 20,
      run: 3,
    },
    /**
     * Niebla pintada en el fondo (S59; l7, `mist` en levels.ts): una copia de la niebla de la franja corre de costado,
     * despacio, sobre la quieta.
     */
    mist: {
      /** Velocidad en unidades por segundo (hacia la derecha; negativa, a la izquierda). */
      speed: 4,
      /** Opacidad de la copia que corre (0-1). */
      alpha: 0.55,
      /** Qué es niebla: canal más claro mínimo y cuánto más azul que rojo (ambientLogic.ts). */
      minBright: 60,
      minBlue: 16,
      /** Filas de arte en las que la copia se desvanece arriba y abajo de la franja. */
      feather: 10,
    },
    /**
     * El dosel de l5 (S60; `canopy` en levels.ts), en el relleno de arriba de la imagen. S113: dibujado de nuevo en
     * píxeles gruesos (los del fondo pintado), horneado una vez en la textura del relleno: copas en cuatro capas con hojas,
     * ramas con bromelias y orquídeas, lianas, rayos y una banda de niebla tramados (no cuestan nada: ya se dibujaba el
     * relleno), y abajo el borde de la imagen espejado que se deshace tramado (sin costura ni el fundido de S29). Lo único
     * que se mueve son los jirones de niebla, también tramados. Los colores, medidos en l5_far.jpg: `CANOPY_PALETTE`.
     */
    canopy: {
      /** Píxeles de arte por píxel del dosel: el «píxel» del fondo pintado mide ≈ 3. */
      pixel: 3,
      /** Hasta dónde suben las copas (fracción del alto del relleno): lejanas (sobre el claro), del medio y de adelante (a los costados). */
      farHeight: 0.62,
      midHeight: 0.85,
      nearHeight: 0.62,
      /** El dosel que cuelga del borde de arriba: cuánto baja sobre lo claro y sobre lo oscuro (fracción del alto). */
      fringeMin: 0.12,
      fringeMax: 0.42,
      /** Ramas que salen de cada costado, lianas cada 100 px de arte de ancho y epífitas (bromelias, helechos, orquídeas) por rama. */
      branches: 2,
      lianas: 1.6,
      epiphytes: 3,
      /** Rayos de luz entre las hojas, quietos y tramados: cuántos, ancho (px de arte), inclinación (grados; positivo = baja hacia la izquierda), fuerza (0-1) y color. */
      rays: { count: 4, width: 30, tiltDeg: 12, strength: 0.3, color: '#e9efc0' },
      /** Banda de niebla quieta y tramada: centro y alto (fracciones del alto del relleno), opacidad (0-1) y color. */
      haze: { at: 0.58, height: 0.16, alpha: 0.4, color: '#a9bc9a' },
      /** Alto (px de arte) de la franja de abajo que copia el borde de la imagen y se deshace tramada hacia arriba. */
      blend: 36,
      /** Qué columna del borde es dosel: oscuridad frente al color de arriba, de `darkLo` (nada) a `darkHi` (todo). */
      darkLo: 0.45,
      darkHi: 0.75,
      /** Semilla del azar (cambiarla da otras copas, otras ramas, otros rayos y otra niebla). */
      seed: 5,
      /**
       * Jirones de niebla que cruzan despacio (S60), tramados (S113: sin borde borroso). `at`: dónde va el centro de la
       * banda (fracción del alto del relleno, 0 = arriba); `puffs` jirones de `width` × `height` unidades repartidos a lo
       * ancho; velocidad en unidades por segundo (positiva, a la derecha) y opacidad (0-1).
       */
      mistColor: '#e2ebd6',
      mist: [
        { at: 0.36, puffs: 2, width: 150, height: 26, speed: 5, alpha: 0.2 },
        { at: 0.72, puffs: 2, width: 170, height: 30, speed: 9, alpha: 0.18 },
      ],
    },
    /** Terreno como repisa (`terrainShell` en levels.ts): opacidad de la última fila antes del fondo. */
    terrainFadeAlpha: 0.55,
    /**
     * El sol de l2 (S96; `sun` en levels.ts): un halo aditivo que respira sobre el sol de la imagen y destellos que
     * titilan en la columna de reflejo del agua. Se pegan a la imagen; con «Destellos» apagado no se dibujan.
     */
    sun: {
      /** Ciclo del halo (ms): de su mínimo a su máximo y de vuelta. */
      periodMs: 5000,
      /** Radio del halo (px de arte de la imagen) en su mínimo y en su máximo. El disco del sol mide ≈ 15 de radio. */
      radiusMin: 34,
      radiusMax: 46,
      /** Opacidad del halo (aditivo) en su mínimo y en su máximo. */
      alphaMin: 0.1,
      alphaMax: 0.22,
      /** Color del halo. */
      color: '#ffb45a',
      /** Dónde pesa el halo: fracción del radio con el brillo más alto (más adentro, la mitad: no lava el disco). */
      ringAt: 0.35,
      glints: {
        /** Cuántos destellos a la vez como máximo (el pool). */
        count: 5,
        /** Ancho (px de arte; 1 de alto). */
        widthMin: 2,
        widthMax: 6,
        /** Cuánto dura encendido cada uno (ms; sube y baja). */
        lifeMinMs: 220,
        lifeMaxMs: 520,
        /** Pausa apagado antes de aparecer en otro lugar (ms). */
        gapMinMs: 150,
        gapMaxMs: 900,
        /** Opacidad en el pico. */
        alpha: 0.9,
        /** Color (dorado claro). */
        color: '#fff2b8',
        /** Píxel del reflejo donde puede caer un destello: rojo y verde de la imagen por encima de esto (0-255). */
        minRed: 235,
        minGreen: 170,
      },
    },
    /**
     * El cielo y la llanura de l3 (S98; `skyLife` en levels.ts, px de arte medidos en la imagen): bandadas que cruzan
     * a la altura de las nubes bajas y sombras de nubes que corren por la llanura. Pegadas a la imagen.
     */
    skyLife: {
      birds: {
        /** Espera entre una bandada y la siguiente (ms, al azar), contada desde que la anterior salió de la imagen. */
        gapMinMs: 15000,
        gapMaxMs: 30000,
        /** Espera hasta la primera bandada del nivel (ms, al azar). */
        firstMinMs: 4000,
        firstMaxMs: 9000,
        /** Pájaros por bandada (el pool tiene `countMax`). */
        countMin: 3,
        countMax: 7,
        /** Cuánto tarda en cruzar la imagen de lado a lado (ms, al azar). */
        crossMinMs: 20000,
        crossMaxMs: 30000,
        /** Tamaño de la silueta (px de arte de ancho; hay dibujo para 3, 4 y 5). */
        sizeMin: 3,
        sizeMax: 5,
        /** V suelta: cada fila del ala, cuánto más atrás y más afuera (px de arte), y el azar de cada uno. */
        spacingX: 8,
        spacingY: 3,
        jitter: 1.5,
        /** Ciclo de aleteo (ms; dos cuadros) y vaivén vertical (px de arte y ms). */
        flapMs: 360,
        bob: 1.2,
        bobMs: 1800,
        /** Cuánto sale afuera de la imagen antes de entrar y después de salir (px de arte). */
        margin: 40,
        /** Color de la silueta y su opacidad. */
        color: '#2b2f3a',
        alpha: 0.85,
      },
      /** Sombras de nubes: ancho y alto (px de arte), centro (fracción de la franja de llanura), velocidad (px/s), reparto. */
      shadows: [
        { width: 360, height: 70, at: 0.5, speed: 9, offset: 0 },
        { width: 280, height: 56, at: 0.42, speed: 11, offset: 0.4 },
        { width: 420, height: 76, at: 0.55, speed: 7, offset: 0.72 },
      ],
      /** Color de las sombras y su opacidad en el centro (los bordes se desvanecen a 0). */
      shadowColor: '#14200c',
      shadowAlpha: 0.12,
      /**
       * Loros que van a dormir (S108, l1; `skyLife.flock: 'parrots'` en levels.ts): la misma bandada con otra silueta
       * (cola larga), más chica, más rápida y aleteando ligero. Mismas claves que `birds`. La primera sale poco después
       * de que la vista sale de la cueva inicial (no desde que empieza el nivel).
       */
      parrots: {
        gapMinMs: 20000,
        gapMaxMs: 40000,
        firstMinMs: 1500,
        firstMaxMs: 3000,
        countMin: 3,
        countMax: 6,
        crossMinMs: 13000,
        crossMaxMs: 17000,
        /** Silueta (px de arte de ancho; hay dibujo para 7 y 9). */
        sizeMin: 7,
        sizeMax: 9,
        /** De a pares más que en V: poca separación por fila y mucho azar. */
        spacingX: 9,
        spacingY: 2,
        jitter: 3,
        flapMs: 150,
        bob: 1.6,
        bobMs: 1300,
        margin: 40,
        color: '#2a2030',
        alpha: 0.9,
      },
    },
    /**
     * El atardecer de l1 (S108; `dusk` en levels.ts, px de arte medidos en `bg_l1_far`): rayos que salen de detrás de
     * las sierras y bruma en los valles del bosque. Pegado a la imagen, detrás de todo lo jugable y tapado por el fondo
     * de cueva donde se ve la cueva. Lo que tapa la base de los rayos y el pie de la bruma es la misma imagen recortada.
     */
    dusk: {
      /** Qué es cielo en la imagen (para que nada se dibuje sobre él): rojo sobre azul y brillo mínimos (0-255). */
      skyRedOverBlue: 18,
      skyMinLum: 175,
      /** Rayos: el sol ya se puso detrás de las sierras. Se suman a lo de atrás (ADD). */
      rays: {
        color: '#ffc68c',
        /** Opacidad en su mínimo y en su máximo (sutiles: el cielo no se aclara). */
        alphaMin: 0.06,
        alphaMax: 0.15,
        /** Ancho en su mínimo y en su máximo (fracción del ancho de cada rayo). */
        widthMin: 0.8,
        widthMax: 1.15,
        /** Ancho de la base (fracción del ancho de arriba): salen angostos de detrás de la sierra y se abren. */
        base: 0.07,
        /** Dónde brilla más cada rayo (fracción del largo desde la fuente): justo arriba de la sierra. */
        peakAt: 0.14,
        /**
         * Cada rayo: ángulo (grados desde la vertical; negativo, a la izquierda), largo y ancho arriba (px de arte),
         * ciclo de respirar (ms) y su desfase (0-1).
         */
        list: [
          { angle: -38, length: 320, width: 74, periodMs: 7400, phase: 0.1 },
          { angle: -6, length: 350, width: 86, periodMs: 9200, phase: 0.55 },
          { angle: 27, length: 330, width: 80, periodMs: 8000, phase: 0.3 },
        ],
        /** La sierra recortada que tapa la base: cuánto a cada lado de la fuente y cuánto debajo (px de arte). */
        coverHalfWidth: 150,
        coverBelow: 8,
      },
      /**
       * Bruma en los valles: jirones tramados (Bayer, como la niebla de la siesta) que se deslizan por cada valle, con el
       * pie tapado por la loma de adelante (la imagen recortada). `layers`: de la más lejana a la más cercana.
       */
      mist: {
        color: '#e8d8ea',
        /**
         * Un píxel del tramado, en px de la imagen: el arte de l1_far tiene píxeles de ≈ 2,5 px (período de su grilla).
         * Con 1 el tramado sale más fino que el dibujo y parece una malla.
         */
        texel: 2.5,
        /** Escalones de opacidad del tramado y desde qué densidad (0-1) empieza cada uno. */
        alphas: [0.18, 0.34, 0.54] as readonly number[],
        steps: [0.14, 0.38, 0.64] as readonly number[],
        /** Cuánto mezcla el tramado los escalones (0 = bordes lisos). */
        dither: 0.22,
        /** Formas de jirón distintas por capa (se eligen al azar). */
        shapes: 5,
        /** Cuánto queda debajo de la cresta (tapado) y cuánto deja libre bajo el cielo (px de arte). */
        pad: 3,
        skyMargin: 6,
        /** Fundido en las puntas de cada valle (px de arte). */
        fade: 48,
        /** Cuánto varía la opacidad de un jirón a otro (fracción). */
        alphaVary: 0.35,
        layers: [
          /** Al pie de las sierras: lo que más se ve en el primer tramo. `speed`: px de arte por segundo. */
          { width: 120, height: 30, gap: 124, speed: 2.2, alpha: 1 },
          { width: 140, height: 34, gap: 160, speed: 3, alpha: 0.9 },
          { width: 150, height: 36, gap: 190, speed: 3.8, alpha: 0.8 },
        ],
        seed: 11,
      },
    },
    /**
     * La cueva de l1 con vida (S108; `caveLife` en levels.ts, px de arte medidos en `bg_l1_cave`): murciélagos lejos,
     * cristales que laten, chispas sobre el oro, gotas y polvo. Solo donde se ve el fondo de cueva (zonas `Cave`).
     */
    caveLife: {
      /** Murciélagos de fondo: más chicos y más oscuros que los mbopi, y detrás de todo. */
      bats: {
        gapMinMs: 15000,
        gapMaxMs: 30000,
        firstMinMs: 2500,
        firstMaxMs: 5000,
        countMin: 3,
        countMax: 6,
        /** Cuánto tarda el grupo en cruzar la imagen (ms). */
        crossMinMs: 9000,
        crossMaxMs: 13000,
        /** Zigzag: alto (px de arte) y ciclo (ms) de cada uno; aleteo (ms por cuadro, tres cuadros). */
        zigAmp: 7,
        zigMinMs: 520,
        zigMaxMs: 900,
        flapMs: 70,
        /** Desorden del grupo (px de arte, adelante-atrás y arriba-abajo) y cuánto sale de la imagen. */
        spreadX: 70,
        spreadY: 26,
        margin: 30,
        /** Px de la imagen por píxel del dibujo: 9 × 4 a 1,5 son ≈ 18 × 8 px de pantalla (un mbopi mide ≈ 50). */
        scale: 1.5,
        color: '#06050b',
        alpha: 0.92,
      },
      crystals: {
        /** Qué píxel es cristal: violeta (azul sobre rojo y verde) o cian (verde y azul sobre rojo). */
        violetBlueOver: 42,
        violetMinBlue: 120,
        cyanOver: 40,
        cyanMinGreen: 110,
        /** El cristal mismo, sumado sobre sí (su color): opacidad en el mínimo y en el máximo, y su ciclo (ms). */
        alphaMin: 0.08,
        alphaMax: 0.34,
        periodMinMs: 3400,
        periodMaxMs: 5600,
        /** Halo suave alrededor: tamaño (múltiplo del grupo) y opacidad en el mínimo y en el máximo. */
        haloScale: 1.6,
        haloMin: 0.05,
        haloMax: 0.14,
        violet: '#a88cff',
        cyan: '#7ff0ff',
        /** Destello de vez en cuando: espera entre destellos (ms, uno a la vez), vida (ms) y cuánto sube el cristal. */
        flashGapMinMs: 1600,
        flashGapMaxMs: 3800,
        flashMs: 380,
        flashBoost: 0.4,
      },
      gold: {
        /** Píxel de oro: rojo + verde − 2 × azul por encima de esto. */
        minYellow: 70,
        count: 4,
        /** Cuántas salen con la estrella grande (5 px) en vez de la chica (3 px). */
        bigShare: 0.35,
        lifeMinMs: 260,
        lifeMaxMs: 620,
        gapMinMs: 180,
        gapMaxMs: 1200,
        color: '#fff2bf',
        alpha: 0.95,
      },
      drops: {
        /** Aceleración (px de arte/s²), lo que tarda en formarse en la punta y la espera hasta la siguiente (ms). */
        gravity: 900,
        formMs: 900,
        gapMinMs: 2200,
        gapMaxMs: 6500,
        color: '#cfe4ff',
        alpha: 0.75,
        /** Brillo al llegar abajo (ms y opacidad). */
        splashMs: 220,
        splashAlpha: 0.8,
      },
      dust: {
        count: 14,
        lifeMinMs: 7000,
        lifeMaxMs: 13000,
        /** Deriva (px de arte/s) y vaivén (px de arte y ms). */
        speed: 2.4,
        sway: 3,
        swayMs: 7000,
        alphaMax: 0.38,
        color: '#b4c2de',
      },
      /** Fundido de lo chico en el borde del recorte de la cueva (unidades). */
      edgeFade: 12,
    },
    /** Borde de la cueva (l1): ancho del degradado oscuro donde se juntan el cielo y la cueva (unidades; ≈ 2 tiles). */
    caveEdgeWidth: 32,
    /** Opacidad del degradado en su centro (0-1). */
    caveEdgeAlpha: 0.9,
    /** Color del degradado del borde de la cueva. */
    caveEdgeColor: '#0b0a14',
    /** Profundidad: detrás de todo el nivel. */
    depth: -20,
    /**
     * Roca (capa Ground) dentro de las zonas `Cave`: tinte que multiplica la textura (casi negro azulado, la textura
     * apenas se ve) para que la roca enmarque el fondo de cueva. 0xffffff = sin cambio.
     */
    caveRockTint: 0x343a58,
    /**
     * Fondo de tierra (S68, S69, S71; `earthBackdrop: true` en levels.ts): dentro de la tierra maciza, detrás de la
     * repisa, va la baldosa del suelo rodeado por los cuatro lados (`fillTile`, la casilla 15 del autotile), sin tinte,
     * sin giro y en la grilla del terreno: no se distingue de la tierra de alrededor y no se ve el cielo.
     */
    earth: {
      fillTile: 15,
      /** Justo encima del fondo lejano (-20) y detrás de todo lo demás (props hundidos, jefes, tiles). */
      depth: -19,
    },
    /**
     * Detalle del terreno (S109; `terrainDetail` en levels.ts: l1 y, desde S110, l2): variantes del relleno y de los bordes
     * elegidas por celda con la semilla del nivel, y una capa de calcomanías sobre Ground según la profundidad de la
     * celda (a cuántos tiles está el aire, en las 8 direcciones). Las probabilidades son por celda (0-1).
     */
    terrainDetail: {
      /** Celdas de relleno (15) con una variante en vez de la base; bordes con variante (14, 11, 7 y 13). */
      fillChance: 0.8,
      edgeChance: 0.6,
      /** Hasta dónde se cuenta la profundidad (más hondo da igual). */
      maxDepth: 8,
      /** Piso: raíces largas bajo el pasto (solo en el llano, dos casillas hacia abajo) y raicillas. */
      rootsChance: 0.12,
      rootletChance: 0.1,
      /** El pasto de una esquina de arriba que sale hacia el aire de al lado. */
      overhangChance: 0.85,
      /** Las de más de una casilla (canto rodado, capa) solo con todas sus celdas a esta profundidad o más. */
      multiMinDepth: 2,
      /** Vetas de cristal: celdas a `reach` tiles o menos del aire de una cueva y hasta `maxDepth` de hondo. */
      crystal: { reach: 2, minDepth: 2, maxDepth: 3, chance: 0.05 },
      /** Las vetas de cristal dentro de una zona `Cave` no llevan el tinte de la roca, sino este (brillan apagadas). */
      crystalCaveTint: 0x9c9cc4,
      /** Por franja de profundidad: probabilidad de que la celda lleve algo y peso de cada tipo. */
      bands: [
        { minDepth: 1, maxDepth: 1, chance: 0.06, kinds: { lichen: 3, crack: 1, pebble: 1 } },
        { minDepth: 2, maxDepth: 2, chance: 0.06, kinds: { pebble: 2, lichen: 2, stone: 1 } },
        { minDepth: 3, maxDepth: 4, chance: 0.06, kinds: { boulder: 2, strata: 2, stone: 1, pebble: 1 } },
        { minDepth: 5, maxDepth: 99, chance: 0.06, kinds: { boulder: 2, strata: 3, stone: 1 } },
      ],
      /**
       * Volumen: cuánto se oscurece la roca según la profundidad (índice = profundidad; más hondo usa el último). Se
       * multiplica en Ground, en el fondo de tierra y en las calcomanías, en pasos chicos para que no se lea una caja.
       */
      depthShade: [1, 1, 0.98, 0.96, 0.94, 0.92, 0.9],
      /** S110: el agua del estero, superficie (20) y cuerpo (21), con otra casilla de la hoja en esta fracción. */
      waterChance: 0.6,
      /**
       * S110: lo que cambia en cada hoja (`terrainDetail.sheet` en levels.ts); lo que no se nombra es lo de arriba (cerro).
       * Estero (l2): sin cristales (no hay cuevas); en el barro, caracoles, palitos, piedritas, lentes de arcilla y raíces.
       */
      sheets: {
        // S110: con 6 % por celda (355 calcomanías) l2 bajaba ≈ 5 % de FPS en el celular emulado; con esto, ≈ 270.
        estero: {
          rootsChance: 0.11,
          rootletChance: 0.09,
          bands: [
            { minDepth: 1, maxDepth: 1, chance: 0.045, kinds: { shell: 2, twig: 1, pebble: 1 } },
            { minDepth: 2, maxDepth: 2, chance: 0.045, kinds: { shell: 2, twig: 2, pebble: 1 } },
            { minDepth: 3, maxDepth: 4, chance: 0.045, kinds: { clay: 3, root: 2, shell: 1, twig: 1 } },
            { minDepth: 5, maxDepth: 99, chance: 0.045, kinds: { clay: 3, root: 2, shell: 1 } },
          ],
          /** El barro se oscurece más hacia adentro que la roca (las masas del estero son anchas), en pasos de 3 %. */
          depthShade: [1, 1, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82],
        },
        /**
         * S111: campo (l3), sobre el tileset real de S56. Sin cristales (no hay cuevas) ni pasto en las esquinas (nada sobre
         * el aire). Cerca del borde, cantitos de cuarzo, grava de itakurú y alguna galería de hormigas; más adentro, capas
         * de laterita y piedras de itakurú, sueltas o en concreciones de 2 × 2.
         */
        campo: {
          /** Los bordes con variante, más que en cerro: el piso del campo (la 14, cinco variantes) es lo que más se ve. */
          edgeChance: 0.75,
          overhangChance: 0,
          crystal: { reach: 2, minDepth: 2, maxDepth: 3, chance: 0 },
          rootsChance: 0.11,
          rootletChance: 0.09,
          bands: [
            { minDepth: 1, maxDepth: 1, chance: 0.05, kinds: { pebble: 2, quartz: 1 } },
            { minDepth: 2, maxDepth: 2, chance: 0.055, kinds: { pebble: 2, itakuru: 2, quartz: 2, ants: 1 } },
            { minDepth: 3, maxDepth: 4, chance: 0.055, kinds: { laterite: 4, itakuru: 2, ironstone: 1, ants: 1, quartz: 1 } },
            { minDepth: 5, maxDepth: 99, chance: 0.055, kinds: { laterite: 4, ironstone: 2, itakuru: 1 } },
          ],
          /** La tierra se oscurece hacia adentro como el barro (las masas del campo son anchas), en pasos de 3 %. */
          depthShade: [1, 1, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82],
        },
        /**
         * S112: pueblo (l4, Capiatá). El mapa se reparte en calle y casas (`town`, `townZones`): cada zona lleva sus
         * casillas de la hoja y sus calcomanías (`zoneDecals`). Sin cristales ni pasto en las esquinas.
         */
        pueblo: {
          edgeChance: 0.75,
          overhangChance: 0,
          crystal: { reach: 2, minDepth: 2, maxDepth: 3, chance: 0 },
          town: {
            /** Un piso elevado de la calle (de ladrillo) a 10 filas del fondo o menos: el patio, la terraza, la galería. */
            streetRows: 10,
            /** Un piso con terreno arriba a 10 filas o menos es de adentro (el zaguán, la galería): ladrillo. */
            interiorReach: 10,
            /** El zócalo de cada casa que da a la calle. */
            socle: { 'wall.ochre': 2, 'wall.blue': 1, wall: 1 },
          },
          zoneDecals: {
            /** La cal de las casas: grietas, humedad, revoque caído, remiendos, hierros; en el techo, pétalos y yuyos. */
            wall: {
              floorChance: 0.3,
              floor: { roofPetals: 4, roofTuft: 1, eaveStain: 2 },
              bands: [
                { minDepth: 1, maxDepth: 1, chance: 0.14, kinds: { crack: 1, damp: 3, iron: 1, retouch: 2 } },
                { minDepth: 2, maxDepth: 3, chance: 0.16, kinds: { adobe: 2, crack: 1, damp: 3, longCrack: 1, patch: 1, iron: 1, retouch: 2 } },
                { minDepth: 4, maxDepth: 99, chance: 0.16, kinds: { adobe: 2, damp: 3, crack: 1, longCrack: 1, patch: 1, retouch: 2 } },
              ],
            },
            'wall.ochre': { floorChance: 0, floor: {}, bands: [{ minDepth: 0, maxDepth: 99, chance: 0.3, kinds: { footMoss: 2, rising: 1 } }] },
            'wall.blue': { floorChance: 0, floor: {}, bands: [{ minDepth: 0, maxDepth: 99, chance: 0.3, kinds: { footMoss: 2, rising: 1 } }] },
            'wall.brick': { floorChance: 0, floor: {}, bands: [] },
            'street.cobble': { floorChance: 0.18, floor: { streetPetals: 2, streetWeed: 1 }, bands: [] },
            'street.brick': { floorChance: 0.15, floor: { streetPetals: 2, streetWeed: 1 }, bands: [] },
            /** La tierra bajo la calle: el relleno de cascotes cerca del piso; más abajo, piedras, raíces, ladrillos viejos y capas. */
            'street.earth': {
              floorChance: 0,
              floor: {},
              bands: [
                { minDepth: 1, maxDepth: 2, chance: 0.08, kinds: { rubble: 3, pebble: 2, shard: 1, stone: 1 } },
                { minDepth: 3, maxDepth: 4, chance: 0.08, kinds: { stone: 3, root: 3, shard: 1, oldBricks: 2, layer: 3 } },
                { minDepth: 5, maxDepth: 99, chance: 0.08, kinds: { stone: 3, oldBricks: 2, root: 2, layer: 3 } },
              ],
            },
          },
          /** La cal y la tierra se oscurecen hacia adentro en pasos de 1,5 % (en la cal blanca, 3 % ya dibuja los cuadros). */
          depthShade: [1, 1, 0.985, 0.97, 0.955, 0.94, 0.925, 0.91],
        },
        /**
         * S113: selva (l5, el monte de Canindeyú). Sin cristales (no hay cuevas). Bajo el piso, raíces que bajan del humus;
         * en las esquinas, el musgo y un helechito que salen al aire; bajo las salientes, raicillas que cuelgan. Cerca del
         * borde, hojas enterradas, piedritas, semillas y bichos; más adentro, raíces gruesas que cruzan varias celdas,
         * piedras mojadas con musgo y capas de laterita.
         */
        selva: {
          edgeChance: 0.75,
          overhangChance: 0.6,
          hangChance: 0.55,
          crystal: { reach: 2, minDepth: 2, maxDepth: 3, chance: 0 },
          rootsChance: 0.16,
          rootletChance: 0.14,
          bands: [
            { minDepth: 1, maxDepth: 1, chance: 0.12, kinds: { leaf: 2, pebble: 2, seed: 1, bug: 1, stone: 1 } },
            { minDepth: 2, maxDepth: 2, chance: 0.15, kinds: { stone: 2, leaf: 2, seed: 2, bug: 2, root: 3, pebble: 1, patch: 2 } },
            { minDepth: 3, maxDepth: 4, chance: 0.16, kinds: { root: 4, stone: 3, laterite: 2, bug: 1, seed: 1, leaf: 1, patch: 3, log: 1 } },
            { minDepth: 5, maxDepth: 99, chance: 0.15, kinds: { root: 3, laterite: 2, stone: 3, seed: 1, patch: 3, log: 1 } },
          ],
          /** La tierra se oscurece hacia adentro como el barro del estero (las masas del monte son anchas), en pasos de 3 %. */
          depthShade: [1, 1, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82],
        },
        /**
         * S116: montana (l6, el cerro guaireño), sobre su tileset real. Sin cristales (no hay cuevas) ni pasto en las
         * esquinas (el borde es una línea fina). Cerca del aire, liquen en la roca, grava y cantitos de cuarzo; más
         * adentro, capas de arenisca con estratificación cruzada, juntas entre capas, bloques sueltos y vetas de hierro.
         */
        montana: {
          edgeChance: 0.75,
          overhangChance: 0,
          crystal: { reach: 2, minDepth: 2, maxDepth: 3, chance: 0 },
          rootsChance: 0.11,
          rootletChance: 0.09,
          bands: [
            { minDepth: 1, maxDepth: 1, chance: 0.05, kinds: { lichen: 3, pebble: 1, quartz: 1 } },
            { minDepth: 2, maxDepth: 2, chance: 0.055, kinds: { lichen: 2, pebble: 2, quartz: 1, iron: 1, block: 1 } },
            { minDepth: 3, maxDepth: 4, chance: 0.045, kinds: { sandstone: 3, seam: 2, iron: 2, block: 2, boulder: 1, quartz: 1 } },
            // El corazón de las masas es enorme (6300 celdas en l6) y va oscuro: menos, para no pasar de ≈ 650 en el nivel.
            { minDepth: 5, maxDepth: 99, chance: 0.02, kinds: { sandstone: 3, seam: 3, boulder: 1, iron: 2, block: 1 } },
          ],
          /** Las masas del cerro son anchas y hondas (la cumbre 1 tiene 24 de ancho y 50 de alto): se cuenta más hondo. */
          maxDepth: 10,
          /**
           * La tierra se oscurece hacia adentro en pasos de 3 % y, desde la profundidad 7, de 2 % (en masas tan grandes los
           * contornos de la profundidad son cuadrados: con pasos grandes hasta el fondo se leían anillos), hasta 0,76.
           */
          depthShade: [1, 1, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82, 0.8, 0.78, 0.76],
        },
        /**
         * S118: cielo (Yvága), ruinas de piedra clara con musgo. Casi todo son islas de una fila: el piso (aire arriba)
         * lleva el detalle de la cara del sillar (musgo que baja, enredaderas, flores, grietas, desportillados y alguna
         * runa gastada). Debajo de cada isla, la quilla de roca con dientes y raíces (`keel`); en un pasaje de menos de 4
         * filas, la corta. El piso de la arena (x 0-43, filas 18-25) es la zona `terrace`: losas, friso y sillares.
         */
        cielo: {
          edgeChance: 0.8,
          overhangChance: 0,
          rootsChance: 0,
          rootletChance: 0,
          crystal: { reach: 2, minDepth: 2, maxDepth: 3, chance: 0 },
          keel: { chance: 1, clear: 4, shortClear: 1, deep: { chance: 0.4, clear: 6, reach: 3 } },
          regions: { rest: 'island', rects: [{ zone: 'terrace', x: 0, y: 18, w: 44, h: 8 }] },
          zoneDecals: {
            island: {
              floorChance: 0.34,
              floor: { mossFace: 4, vine: 2, bloom: 3, fern: 2, crack: 2, chip: 2, rune: 1 },
              bands: [{ minDepth: 1, maxDepth: 99, chance: 0.12, kinds: { crack: 2, chip: 2, rune: 1 } }],
            },
            terrace: {
              floorChance: 0.2,
              floor: { terraceMoss: 2, terraceCrack: 1 },
              bands: [{ minDepth: 1, maxDepth: 99, chance: 0.14, kinds: { crack: 2, chip: 2, rune: 2 } }],
            },
          },
          /** Las masas son finas (una o dos filas; la base y la terraza, tres): el oscurecido casi no se ve, en pasos de 2 %. */
          depthShade: [1, 1, 0.98, 0.96, 0.94],
        },
      },
    },
    /**
     * S110: el brillo que corre por la superficie del agua (`waterGlints` en levels.ts, l2): trazos de luz de 1 px que
     * aparecen sobre la línea de luz del agua a la vista, corren despacio y se apagan, como el reflejo del sol en el
     * fondo (S96). Un pool fijo; con «Destellos» apagado no se dibujan.
     */
    waterGlints: {
      /** Cuántos a la vez como máximo (el pool). */
      count: 14,
      /** Largo (px; 1 de alto). */
      widthMin: 3,
      widthMax: 8,
      /** Cuánto dura encendido cada uno (ms; sube y baja). */
      lifeMinMs: 900,
      lifeMaxMs: 2200,
      /** Pausa apagado antes de aparecer en otro lugar (ms). */
      gapMinMs: 200,
      gapMaxMs: 1600,
      /** Cuánto corre a lo largo de la superficie (px/s; a un lado o al otro). */
      speedMin: 2,
      speedMax: 7,
      /** Opacidad en el pico. */
      alpha: 0.9,
      /** Color (dorado claro del sol). */
      color: '#ffd9a0',
      /** Filas (px desde el borde de arriba de la casilla de superficie) donde puede caer: la línea de luz y el reflejo. */
      rows: [1, 2, 4, 6],
      /** Profundidad de dibujo: encima de las capas de tiles (0) y debajo de las piezas y los personajes. */
      depth: 0.5,
    },
  },

  /**
   * Sprites de los jefes y de Mainumby (S13b). `origin`: punto del frame (fracciones) que coincide con la
   * posición del placeholder; `offset` en unidades (mirando a la izquierda). La hitbox no cambia.
   */
  sprites: {
    tejuHead: { origin: [0.48, 0.62] },
    mboiTui: { origin: [0.31, 0.33] },
    jasyJatere: { staffColumns: [0, 0.3], surpriseOffsetY: 10 },
    aoAo: { idleTimeScale: 0.35 },
    /**
     * Luisón (S89): dónde está el ojo en cada cuadro de cada animación, en píxeles de la hoja (mirando a la izquierda,
     * desde la esquina de arriba a la izquierda del cuadro de 104 × 72). El segundo punto (el ojo de atrás) va
     * `eyeGapPx` píxeles de hoja más adelante. Si se agrega una animación, se agrega su fila acá.
     */
    luison: {
      eyes: {
        luison_idle: [
          [20, 17],
          [21, 11],
          [22, 7],
          [21, 8],
          [20, 14],
          [20, 19],
          [20, 21],
          [20, 18],
        ],
      } as Record<string, readonly (readonly [number, number])[]>,
      eyeGapPx: 5,
    },
    tauTrue: { origin: [0.49, 0.54] },
    /**
     * Mainumby: la animación de la hoja (`mainumby_fly`), vaivén vertical y leve inclinación hacia donde se mueve.
     * Inclinación: grados por unidad/s de velocidad horizontal, con tope `tiltMaxDeg` y suavizado `tiltLerp`.
     * Brillo: degradado radial por código (alfa `glowAlpha` en el centro → 0 en el borde) de radio `glowRadius`.
     */
    mainumby: {
      bobAmplitude: 3.5,
      bobMs: 900,
      glowColor: 0xffd76a,
      glowAlpha: 0.45,
      glowRadius: 16,
      /** Tamaño de la textura del brillo (px; se escala a `glowRadius`). */
      glowTextureSize: 64,
      tiltPerSpeed: 0.12,
      tiltMaxDeg: 14,
      tiltLerp: 0.15,
    },
    /**
     * Enemigos (S13c). El sprite va sobre el placeholder (la hitbox no cambia).
     * Aviso (Charger, Diver, Thrower, Jumper): temblor en x de `warnShakeAmplitude` unidades a `warnShakeHz`.
     */
    enemies: {
      warnShakeAmplitude: 1,
      warnShakeHz: 22,
      /** Póra: alfa propio (se multiplica por `darkness.unlitPoraAlpha` en la oscuridad). */
      poraAlpha: 0.8,
      /** Mbopi: aleteo por código, aplastando el dibujo en y hasta `mbopiSquashY` a `mbopiFlapFps`. */
      mbopiFlapFps: 14,
      mbopiSquashY: 0.7,
      /**
       * Mbói colgante: la plataforma `=` de la selva solo pinta los 6 px de arriba del tile.
       * El punto del mapa está en el tile de abajo; sin esto la cola queda 10 px bajo el dibujo.
       */
      mboiHangLipPx: 10,
      /** Ojos del jagua hũ con sprite: unidades hacia adelante y sobre los pies, y tamaño. */
      jaguaHuEyes: { forward: 9, rise: 13, width: 3, height: 2 },
    },
  },
  /**
   * Audio (S37, GDD §10.4). La música se genera con ZzFX (src/data/music.ts) y cada pista se normaliza a
   * `musicRms` antes de sonar: las diez quedan parejas. `musicGain` la deja por debajo de los efectos, que avisan.
   */
  /**
   * Props por bioma (S46). El tamaño de cada prop NO va acá: está en raw/props/<carpeta>/sprite.json (`size`, en
   * unidades; Kerana ≈ 46, un tile 16) y se hornea con `npm run sprites` para que el pixel art quede nítido.
   * Acá va lo que no es tamaño: el `scale` de la línea `prop` del mapa multiplica ese tamaño (1 = el de sprite.json).
   */
  props: {
    /** Profundidad de los props normales: detrás de Kerana y de los enemigos, delante del fondo y del terreno. */
    depth: 0,
    /** Profundidad de los props con `front`: delante de Kerana, como la capa Foreground. */
    frontDepth: 10,
    /** Lado (unidades) del placeholder de un prop que no está en su atlas. */
    placeholderSize: 16,
    /** Vitrina (rect PropShowcase): aire entre props (unidades) y entre carpetas. */
    showcaseGap: 20,
    showcaseGroupGap: 48,
    /** Alto (unidades) de los rótulos de la vitrina sobre cada prop, y separación entre sus tres alturas alternadas. */
    showcaseLabelSize: 6,
    showcaseLabelStagger: 8,
    /**
     * Props hundidos (S47, `sheets.<nombre>.sink` en sprite.json): se dibujan a esta profundidad, detrás del terreno
     * (0) y delante del fondo (-20), para que la parte bajo la línea del suelo quede tapada por el piso o el agua.
     */
    sunkDepth: -1,
    /** Vitrina: lámina de agua (unidades de alto) bajo los props que solo van sobre agua (`waterOnly`). */
    showcaseWaterHeight: 6,
    /**
     * Agua animada de los props de l6_agua (S47; `flow`, `splash` y `mist` en raw/props/l6_agua/sprite.json). Solo
     * se mueven los píxeles de agua: la roca y el musgo quedan quietos. Si el agua corre muy rápido deja de leerse.
     */
    water: {
      /** Velocidad del agua que cae (cascada, hilo de agua), en unidades por segundo. */
      fallSpeed: 24,
      /** Velocidad de la lámina de agua (pozo bajo), en unidades por segundo: casi quieta. */
      sheetSpeed: 4,
      /** Cuánto corre el dibujo en un ciclo (px de arte) y en cuántos fotogramas: el paso es period / frames px. */
      period: 24,
      frames: 12,
      /** Qué píxel es agua: canal más claro mínimo (0 a 255) y cuánto puede quedar el azul por debajo del rojo y del verde. */
      minBright: 110,
      blueSlack: 4,
      /** Gotas donde el agua golpea abajo (las partículas de salpicadura de S22): cada cuánto (ms) y cuántas. */
      dropsEveryMs: 260,
      dropsPerBurst: 2,
      /** Rocío (mist_spray): cuánto sube (unidades) en cada ciclo, cuánto dura (ms) y su opacidad mínima y máxima. */
      mistRise: 6,
      mistCycleMs: 3200,
      mistAlphaMin: 0.45,
      mistAlphaMax: 0.95,
    },
  },
  audio: {
    /** Volumen final de la música (con Opciones al 100 %), sobre la pista ya normalizada. */
    musicGain: 0.04,
    /** Intensidad (RMS) a la que se lleva cada pista; los picos se redondean por encima de `musicCeiling`. */
    musicRms: 0.25,
    musicCeiling: 0.85,
    /** Muestras por segundo de la música: la mitad que los efectos alcanza y se genera el doble de rápido. */
    musicSampleRate: 22050,
    /** Fundidos (ms) al entrar y al salir una pista. */
    fadeInMs: 1500,
    fadeOutMs: 900,
    /** Con un diálogo abierto la música baja a esta fracción, en `duckMs`. */
    duckFactor: 0.35,
    duckMs: 250,
    /** Pistas generadas que se guardan en memoria (unos 2 MB cada una). */
    cacheTracks: 4,
    /**
     * Pasos de Kerana (S106): grabaciones de Impact Sounds según el suelo (`BIOME_FOOTSTEPS` en `src/data/sfxSamples.ts`).
     * Suenan al apoyar un pie en la animación de correr.
     */
    footsteps: {
      /** Sonoridad respecto del aterrizaje de ZzFX (`land`), en dB: los pasos van por debajo de todo lo demás. */
      db: -9,
      /** Al aterrizar suena también un paso del suelo, a esto respecto de `db` (los dos pies a la vez). */
      landDb: 2,
      /** Variación al azar en cada paso: velocidad (± fracción) y volumen (± dB). */
      pitchJitter: 0.08,
      volumeJitterDb: 2.5,
      /**
       * Cuadros de `kerana_run` (1 a 9, como los cuenta Phaser) en que un pie toca el suelo. Medido en
       * `raw/kerana/run_10x1.png`: en el 3 vuelve a pisar después del cuadro en el aire y en el 7 entra el otro pie.
       */
      contactFrames: [3, 7],
      /** Sin la hoja de Kerana (el rectángulo provisorio), un paso cada tanto mientras corre (ms). */
      fallbackStepMs: 330,
    },
  },

  /**
   * Portada (S105): solo el dibujo. Logo y subtítulo en pixel art (1 píxel por unidad, 2 del lienzo), el ñandutí, el
   * titilar de Eichu sobre las estrellas pintadas en `bg_yvaga_far`, la bruma, la estrella fugaz, Kerana con Mainumby,
   * la entrada y el menú. Unidades del mundo (640 × 360); tiempos en ms; colores 0xrrggbb.
   */
  titleLook: {
    /** Velo oscuro sobre el fondo (alfa) y el degradé de abajo que sostiene el menú (desde `vignetteTop` hasta el pie). */
    skyDim: 0.32,
    vignetteTop: 262,
    vignetteColor: 0x0b0818,
    vignetteAlpha: 0.72,
    logo: {
      /** Esquina de arriba a la izquierda se calcula para centrar en `centerX`; `top` es la fila de arriba de las letras. */
      centerX: 320,
      top: 164,
      /** Alto de las mayúsculas (píxeles = unidades): el tamaño del logo. Las letras se arman para cualquier alto. */
      cap: 38,
      /** Cinco tonos de arriba (oro claro) a abajo (ámbar); el brillo de 1 píxel de los bordes de arriba. */
      gradient: [0xfff1b5, 0xffd66b, 0xf6b540, 0xe48e2a, 0xbe661d],
      highlight: 0xfffbea,
      /** Fila de abajo de cada trazo, un tono más honda (da cuerpo a la letra). */
      underside: 0x9c4f1a,
      outline: 0x2b1030,
      shadow: 0x14071c,
      shadowAlpha: 0.85,
      /** Sombra desplazada (píxeles) de las letras grandes y del subtítulo. */
      shadowOffset: [2, 3],
      subShadowOffset: [1, 2],
      /** Del pie del logo al tope del subtítulo. */
      subtitleGap: 4,
    },
    /** Destello que cruza las letras en diagonal: cada `shineEveryMs` (al azar entre los dos), en `shineMs`. */
    shine: {
      everyMs: [5000, 7000],
      durationMs: 650,
      /** Inclinación (píxeles de corrimiento por fila), ancho del núcleo y del borde, y el segundo hilo detrás. */
      slant: 0.55,
      core: 1.6,
      edge: 3.4,
      trailGap: 6.5,
      trail: 0.9,
      /** Paso (píxeles) entre cuadros pintados. */
      step: 5,
      coreColor: 0xfffef4,
      edgeColor: 0xfff1c2,
      /** Chispazo de cuatro puntas en la punta de arriba de la última letra cuando el destello sale (ms) y su corrimiento. */
      sparkleMs: 420,
      sparkleAt: [-1, 0],
    },
    /** Ñandutí: roseta al centro y franja a los costados, en hilo dorado (2 píxeles por unidad). */
    nanduti: {
      gapBelow: 6,
      radius: 26,
      spokes: 24,
      rings: [6, 12, 18, 25],
      wing: 150,
      thread: 0xe2b452,
      knot: 0xfff0b4,
      deep: 0xa8772e,
      alpha: 0.92,
    },
    /** Titilar de Eichu: estrellita de cuatro puntas encima de cada estrella pintada (centros medidos en la imagen). */
    eichu: {
      /** [x, y] en unidades: las siete del fondo (la octava la tapa el parche de S13, `tools/backgrounds.mjs`). */
      stars: [
        [268.4, 140.9],
        [281.8, 105.9],
        [303.2, 130.6],
        [315.3, 91.7],
        [335.3, 115.7],
        [350.9, 144.1],
        [365.2, 107.5],
      ],
      /** Largo de las puntas (píxeles a 2 por unidad) del cuadro más chico al más grande. */
      arms: [2, 4, 6, 8, 10, 13],
      periodMs: [2300, 3700],
      alpha: 0.9,
      /** Halo suave que acompaña al encenderse (radio en unidades y alfa máximo) y lo que queda al titilar. */
      haloRadius: 9,
      haloAlpha: 0.38,
      haloRest: 0.08,
      haloColor: 0xffd76a,
      /** Con los destellos apagados, el titilar no pasa de este cuadro. */
      calmMaxFrame: 2,
    },
    /** Bruma: dos capas que se deslizan sobre el mar de nubes, de ancho 640 y repetibles. */
    fog: {
      layers: [
        { top: 238, height: 72, speed: 3.2, alpha: 0.6, seed: 3, depth: -4 },
        { top: 292, height: 68, speed: 7.5, alpha: 0.75, seed: 11, depth: 2.5 },
      ],
      palette: [0x6f5f99, 0x8f7fba, 0xb3a3d6, 0xd4c8ec],
      alphas: [0.18, 0.34, 0.52],
      steps: [0.14, 0.38, 0.66],
      /** Alto (píxeles) del borde de arriba: de nada a la masa llena. */
      edge: 24,
    },
    /** Estrella fugaz: cada `everyMs` (al azar entre los dos), lejos del logo, en una de las dos cajas [x, y, ancho, alto]. */
    shootingStar: {
      everyMs: [8000, 15000],
      durationMs: 700,
      travel: 130,
      boxes: [
        [24, 14, 170, 60],
        [440, 14, 170, 60],
      ],
      length: 46,
      head: 0xffffff,
      tail: [0xfff4d4, 0xbfd0ff, 0x7f8fd8],
    },
    /** Kerana (escala entera: 2 píxeles de arte por píxel del lienzo) y Mainumby, que revolotea a su lado. */
    kerana: { x: 104, feetY: 352, artPx: 2 },
    mainumby: { offsetX: 44, offsetY: -96, radiusX: 8, radiusY: 5, periodMs: 3400, bobMs: 900, bob: 2 },
    /** Entrada (desde negro): cada estrella se enciende a `starStartMs + i * starStepMs`; todo listo a `totalMs`. */
    intro: {
      starStartMs: 120,
      starStepMs: 75,
      starPopMs: 360,
      blackFade: [600, 1150],
      logoIn: [820, 1120],
      shineAtMs: 980,
      subIn: [1000, 1300],
      menuIn: [1200, 1500],
      totalMs: 1500,
    },
    /** Menú: dos filas centradas; la estrellita del elegido pulsa (ms). */
    menu: {
      rows: [292, 322],
      columnGap: 74,
      fontPx: 12,
      color: '#F2EEE3',
      selected: '#F2C14E',
      stroke: '#1a0c22',
      strokePx: 3,
      starGap: 6,
      /** Radio de la estrellita en sus dos cuadros (late entre los dos). */
      starArms: [3.5, 4.5],
      pulseMs: 1100,
    },
  },

  /** Botones del celular (S90). Unidades del mundo, sobre el tamaño de fábrica (se multiplican por la escala del botón). */
  touch: {
    /** Media zona muerta de la zona de moverse: a menos de esto del medio entre las dos flechas, Kerana no camina. */
    moveDeadZone: 6,
    /** Separación entre las dos flechas, borde a borde. */
    moveGap: 10,
    /** Margen de toque alrededor de cada botón (el de pausa tiene menos para no comerse el nivel). */
    slop: 28,
    pauseSlop: 6,
  },
} as const;

export type GameplayConfig = typeof GAMEPLAY;
export type PlayerConfig = { readonly [K in keyof GameplayConfig['player']]: number };
