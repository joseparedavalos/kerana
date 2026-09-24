# Plan de producción: Kerana con US$100 de crédito

Este plan divide el juego en **15 sesiones de Claude Code en la nube** más una reserva. Cada sesión es una tarea cerrada que termina en un Pull Request (PR).

- Las secciones **"Para ti (Jose)"** explican qué haces tú.
- La sección **"Sesiones"** es la especificación que sigue Claude.

---

## 1. Estrategia en una mirada

- **Una sesión = una fila de este plan = un PR.** El prompt es corto porque todo el detalle está aquí.
- **Modelo:** Sonnet 5 por defecto. Según los precios oficiales por millón de tokens, Opus 5.5 cuesta el doble (US$4 de entrada y US$20 de salida, frente a US$2 y US$10 de Sonnet 5). Opus 5.5 conviene como mucho para S1 (la arquitectura) o para un bug que Sonnet no resuelva.
- **Mide después de cada sesión** y aplica el semáforo (§6).
- **Lo que no cuesta crédito lo haces tú:** ajustar valores en `gameplay.ts`, pulir mapas en Tiled, generar arte en Grok y escribir diálogos.
- **El crédito no aplica a "Projects" ni a "Routines".** Usa sesiones normales en claude.ai/code.
- **Sesiones de una en una, nunca en paralelo:** dos sesiones tocando los mismos archivos generan conflictos.

---

## 2. Para ti (Jose): preparación (sin gastar crédito)

- [ ] **Cuenta de GitHub** (si no tienes): github.com.
- [ ] **Repositorio:** botón **New** → nombre `kerana` → **Public** → **sin** README, .gitignore ni licencia → **Create repository**.
- [ ] **Subir este kit:** en la página del repo vacío, clic en **"uploading an existing file"**. Arrastra el **contenido** de la carpeta del kit: `CLAUDE.md`, `README.md` y la carpeta `docs` completa. Abajo, **Commit changes**.
- [ ] **Conectar Claude:** en la ventana del crédito, **Connect** (o entra a claude.ai/code) → instala la **Claude GitHub App** → elige **Only select repositories** → `kerana`.
- [ ] **Entorno:** si te lo pide, crea el entorno con los valores por defecto (red **Trusted**; sin variables ni script). Trusted ya permite npm, Google Fonts y GitHub, que es todo lo que necesita el proyecto.
- [ ] **En tu PC:** Node.js LTS (nodejs.org), Git (probablemente ya lo tienes, porque Claude Code lo usa) y Tiled (mapeditor.org). Cursor ya lo tienes.
- [ ] **Arte (puede ir en paralelo con S1 y S2):** genera a Kerana en Grok (`docs/ASSETS.md` §3.2) y guarda las hojas como `raw/kerana/idle_5x2.png`, etc. Súbelas **antes de S3**.

---

## 3. Para ti: el ciclo de cada sesión

1. **Comprueba que el PR anterior esté fusionado.** Cada sesión parte de `main`; si no fusionaste, la nueva sesión no verá los cambios anteriores.
2. **Inicia la sesión:** claude.ai/code → repo `kerana` → modelo (**Sonnet 5**; Opus 5.5 opcional en S1) → si aparece el selector de modo, elige que acepte ediciones automáticamente → prompt:
   ```
   Ejecuta la sesión S1 de docs/PLAN.md.
   ```
   (Cambia el número. Si hace falta, agrega una línea: "Para Kurupi usa la versión 100 % Colmán".)
3. **Espera.** Puedes cerrar el navegador; la sesión sigue sola. Si ves que se desvía, detenla y corrige con una instrucción precisa.
4. **Crea el PR** desde la sesión (botón **Create PR**, o pídele "crea el PR").
5. **Revisa en GitHub:** pestaña **Files changed** para mirar y **Conversation** para leer el resumen y "cómo probarlo". Luego **Merge pull request** → **Confirm merge**.
6. **Prueba:** en 1 o 2 minutos el juego se actualiza en tu enlace de GitHub Pages (§4); o localmente (§5) para ajustar valores con recarga instantánea.
7. **Anota el crédito** en el registro (§6.3): puedes editar este archivo desde GitHub con el ícono del lápiz.

### 3.1 Cómo pedir un arreglo (barato)
Si vuelves horas después, **abre una sesión nueva y corta** en lugar de continuar una larga: al reanudar una sesión larga se vuelve a procesar todo su historial.

```
Arregla este problema, tocando solo lo necesario:
- Dónde: nivel 3, jefe Moñái (URL: ?level=3&boss=1)
- Qué hice: salté hacia la copa derecha durante la fase 2
- Qué esperaba: que el tronco bloqueara el pulso de hipnosis
- Qué pasó: el pulso me alcanzó igual
Build y tests deben pasar. Crea el PR.
```

### 3.2 Consejos de ahorro

- Da todo de entrada; no charles con la sesión mientras trabaja.
- Si el cambio es un número (velocidad, tiempo, daño), hazlo tú en `src/config/gameplay.ts`.
- Si una sesión se queda sin assets, sigue con placeholders: el arte se integra en S13.

---

## 4. Para ti: publicar en GitHub Pages (una sola vez, después de S1)

1. En el repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Vuelve al repo: **Add file → Create new file**. Como nombre escribe exactamente `.github/workflows/deploy.yml` (las barras crean las carpetas).
3. Abre `docs/setup/deploy.yml` en otra pestaña, copia todo su contenido y pégalo. **Commit changes**.
4. Pestaña **Actions**: espera el círculo verde (1 o 2 minutos).
5. Tu juego queda en `https://<tu-usuario>.github.io/kerana/`. Pégalo en el README.

¿Por qué a mano? El permiso de Claude para modificar workflows de GitHub puede faltar y hacer fallar el push completo de una sesión. Por eso `CLAUDE.md` le prohíbe tocar `.github/workflows/`.

---

## 5. Para ti: traer los cambios a tu PC (Cursor)

- **La primera vez:** Cursor → **Clone Repository** → pega la URL del repo → elige una carpeta → ábrela. En la terminal:
  ```
  npm install
  npm run dev
  ```
  Abre la dirección que aparece (normalmente `http://localhost:5173`).
- **Cada vez que fusiones un PR:** en Cursor, panel de control de código fuente → **Pull**. Si cambió `package.json`, vuelve a correr `npm install`. Luego `npm run dev`.
- **Para ir directo a algo:** `http://localhost:5173/?level=1&boss=1&gifts=all` (GDD §11.11).
- **Para subir tus sprites:** cópialos a `raw/<personaje>/` en tu carpeta local → commit → **Sync/Push**. O desde la web: **Add file → Upload files**, arrastrando la carpeta `raw`.
- **Regla:** no edites en `main` los mismos archivos que está tocando una sesión en curso.

---

## 6. Presupuesto

### 6.1 Metas por sesión (estimaciones gruesas; se recalibran después de S1 y S2)

| Sesión | Contenido | Meta (US$) | Meta acumulada |
|---|---|---|---|
| S1 | Cimientos jugables | 8 | 8 |
| S2 | Combate, vida y objetos | 6 | 14 |
| S3 | Pipeline de sprites + Kerana real | 5 | 19 |
| S4 | Estructura del juego | 6 | 25 |
| S5 | Controles y audio | 4 | 29 |
| S6 | Nivel 1 + Teju Jagua + base de jefes | 7 | 36 |
| S7 | Nivel 2 + Mbói Tu'i | 6 | 42 |
| S8 | Nivel 3 + Moñái | 6 | 48 |
| S9 | Nivel 4 + Jasy Jatere | 6 | 54 |
| S10 | Nivel 5 + Kurupi | 6 | 60 |
| S11 | Nivel 6 + Ao Ao | 6 | 66 |
| S12 | Nivel 7 + Luisón + final | 7 | 73 |
| S13 | Integración de arte y música | 5 | 78 |
| S14 | Pulido de sensación | 5 | 83 |
| S15 | QA y cierre | 5 | 88 |
| Reserva | Arreglos o Extras | 12 | 100 |

### 6.2 Semáforo
Compara lo **gastado acumulado** con la **meta acumulada**:

- **Verde** (igual o por debajo de la meta): seguir.
- **Amarillo** (hasta 20 % por encima): aplicar los recortes 1 a 3 del GDD §12.2.
- **Rojo** (más de 20 % por encima): recortes 1 a 6; fusionar S14 con S15; los arreglos pequeños, a mano en Cursor.

### 6.3 Registro (lo llenas tú)

| Sesión | Fecha | Modelo | Crédito antes | Crédito después | Costo | Acumulado | Semáforo |
|---|---|---|---|---|---|---|---|
| S1 | 2026-09-24 | Opus 5.5 | 100 | 95 | 5 | 5 | Verde |
| S2 | 2026-09-24 | Sonnet 5 | 95 | 78 | 17 | 22 | Rojo |
| S3 | | | | | | | |
| S4 | | | | | | | |
| S5 | | | | | | | |
| S6 | | | | | | | |
| S7 | | | | | | | |
| S8 | | | | | | | |
| S9 | | | | | | | |
| S10 | | | | | | | |
| S11 | | | | | | | |
| S12 | | | | | | | |
| S13 | | | | | | | |
| S14 | | | | | | | |
| S15 | | | | | | | |

---

## 7. Estado de las sesiones (lo actualiza Claude)

| Sesión | Estado | PR | Notas breves |
|---|---|---|---|
| S1 | Hecha (fusionada) | PR #1 (`claude/bold-pascal-n2lmlt`) | Proyecto base, nivel de prueba, Kerana placeholder con coyote/buffer, smoke OK |
| S2 | Hecha | rama `claude/youthful-allen-ebzwov` | Ataque, vida, fuegos, peligros con daño, Walker/Charger/Flyer, pickups, HUD y ZzFX. Smoke OK |
| S3 | Pendiente (sin assets de Kerana en `raw/`) | | |
| S4 | Hecha (se saltó S3) | rama `claude/practical-carson-4q13pz` | Título, prólogo/final, mapa del mundo (fondo liso), guardado, i18n, diálogos de liberación, pausa/opciones, nivel completado, créditos, fuente con guaraní. Ver notas abajo. Build, tests y smoke OK |
| S5 | Pendiente | | |
| S6 | Pendiente | | |
| S7 | Pendiente | | |
| S8 | Pendiente | | |
| S9 | Pendiente | | |
| S10 | Pendiente | | |
| S11 | Pendiente | | |
| S12 | Pendiente | | |
| S13 | Pendiente | | |
| S14 | Pendiente | | |
| S15 | Pendiente | | |

### Notas de juego de Jose
(Escribe aquí lo que sientes al jugar: "el salto flota demasiado", "el jefe 2 es muy difícil en la fase 3". S14 las aplica.)

-

---

## 8. Sesiones (especificación para Claude)

Cada sesión: lee lo indicado, cumple las tareas, verifica los criterios, actualiza §7 y escribe sus "Notas para la próxima sesión".

### S1: Cimientos jugables
**Lee:** `CLAUDE.md`; GDD §3.3, §3.4, §3.5, §11.1 a §11.8, §11.11, §11.12 y §11.14.

**Requisitos:** ninguno.

**Tareas:**

1. Proyecto con Vite + TypeScript estricto + Phaser 4 + Vitest. `vite.config.ts` con `base: './'`. Scripts `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test`, `maps`, `sprites` (por ahora un stub que avisa "pendiente S3") y `smoke`. `.gitignore` (node_modules, dist, tmp). `CREDITS.md` con su encabezado.
2. `index.html` con `<div id="game">` y fondo #1B1A2E; `src/main.ts` con la configuración del GDD §11.3.
3. `src/config/gameplay.ts` con **todos** los valores del GDD §3.4.
4. `tools/make-placeholder-tiles.mjs`: genera `public/assets/tiles/<bioma>.png` para los 7 biomas, y el nivel de prueba usa `cerro` (un color por bioma; suelo en el orden de autotile de ASSETS §6; plataforma, peligro, agua y variante agrietada).
5. `tools/build-maps.mjs` con su parser (ASCII → Tiled JSON, GDD §11.7), incluidos autotile y las líneas de cabecera `rect` y `point`. `tools/levels/test.txt`: nivel de prueba de unos 120 × 30 tiles con suelo, plataformas de un solo sentido, un pozo, espinas, agua profunda, 2 checkpoints y 2 carteles.
6. Escenas: Boot, Preload (con `manifest.ts` y placeholders, §11.8), Title mínima (logo en texto y "Pulsá Enter"), Level (carga el mapa, colisiones por capa, plataformas de un solo sentido; pozo y agua devuelven al último suelo firme) y UI (corazones como placeholder).
7. `InputManager` (teclado; acciones abstractas) y `EventBus`.
8. `Player` con máquina de estados: `idle`, `run`, `jump`, `fall`, con coyote time, buffer, salto variable y caída limitada. Visual provisional: rectángulo de 16 × 40 con un "ojo" que muestre hacia dónde mira.
9. `CameraController`: seguimiento con lerp, zona muerta, anticipación y límites del mapa.
10. Parámetros de URL de depuración (§11.11) y `window.__KERANA_READY__`.
11. Tests: transiciones básicas de la máquina de estados; coyote y buffer (lógica pura con tiempos simulados); parser ASCII.
12. README: cómo correr en local y cómo usar los parámetros de depuración.
13. Intentar `npm run smoke` con Puppeteer (como máximo 2 intentos de instalación).

**Criterios de aceptación:** `npm run build` y `npm test` pasan · Título → Enter → nivel de prueba · correr y saltar responden bien · caer al pozo devuelve al último suelo firme · sin errores en consola · `?debug=1` muestra hitboxes y el estado de Kerana.

**Fuera de alcance:** combate, enemigos, objetos, arte real, menús completos, audio.

**Qué prueba Jose:** publicar en Pages (§4), jugar el nivel de prueba, ajustar `gameplay.ts` en Cursor y escribir sus sensaciones en "Notas de juego".

**Notas para la próxima sesión (S1 → S2):**
- **Versiones:** Phaser 4.2.1, Vite 8, Vitest 5, TypeScript 5.9 (no la 7). `pngjs` para imágenes y `puppeteer-core` para la prueba de humo (sin descarga de navegador: busca Chrome/Chromium o `CHROME_PATH`).
- **Lógica de Kerana separada:** `src/entities/PlayerMotor.ts` es lógica pura (estado, coyote, buffer, salto variable, caída limitada) y `Player.ts` la conecta con Arcade. S2 debería sumar `attack`, `charge` y `hurt` al motor y probarlos igual en `tests/playerMotor.test.ts`.
- **Caídas sin daño todavía:** pozo, agua y espinas llaman a `LevelScene.respawn(reason)` y emiten `player:respawned`; S2 debe restar el corazón ahí. `checkpointPos` ya se guarda al tocar un fuego (para el KO de S2).
- **Suelo firme:** solo se guarda si ambos pies pisan suelo o plataforma y no hay espinas a un tile de distancia.
- **Assets sin 404:** un plugin de Vite (`virtual:kerana-assets`) lista `public/assets`; `PreloadScene` no pide lo que no existe y crea el placeholder directamente (`[ASSET FALTANTE]`). Si agregás arte con `npm run dev` abierto, recargá la página.
- **Tileset placeholder:** 4 columnas × 7 filas; índices en `tools/lib/tileset-layout.mjs` (0–15 autotile, 16–18 plataforma, 19 espinas, 20–21 agua, 22 agrietada, 23–25 decoración). Un tileset real debe respetar ese orden o traer su traducción (S3/S13).
- **Mapas:** los puntos (`P`, `C`, carteles, `point`…) se ubican en el centro horizontal y el borde inferior del tile (los pies). Los enemigos salen con `facing: 'left'` y `patrol: 64` por defecto (configurables en `buildTiledMap`). El mapa de prueba incluye `rect LevelExit` (lo usará S4).
- **`__KERANA_READY__`** se define cuando `LevelScene` está lista. En modo `debug=1` se expone `window.__KERANA_DEBUG__` (escena, jugadora, suelo firme) para la prueba de humo.
- **Parámetros `boss`, `gifts` y `god`** ya se leen (`src/config/debug.ts`) pero todavía no tienen efecto.
- **Pendiente para Jose:** copiar `docs/setup/deploy.yml` a `.github/workflows/` (§4). Assets faltantes: `heart_full`, `heart_empty`, `sign`, `checkpoint` (placeholders por código).

### S2: Combate, vida y objetos
**Lee:** GDD §3.6, §4.1 a §4.3, §5.1, §5.2, §9.7 y §10.3.

**Requisitos:** S1 fusionada.

**Tareas:**

1. Ataque con el sable: hitbox independiente, activa en la ventana del GDD §3.4, en suelo y aire.
2. Vida: 4 corazones, daño, invulnerabilidad con parpadeo, retroceso y hit-stop. Con 0 corazones, "Kerana cae" y reaparece en el último fuego con vida completa.
3. Fuegos (checkpoints): se encienden, guardan la posición y dan +1 corazón la primera vez.
4. Peligros: espinas (1 de daño y retroceso); pozo y agua (1 de daño y reaparición en el último suelo firme).
5. Enemigos: clase base + arquetipos Walker, Charger y Flyer (GDD §5.2), con datos en `src/data/enemies.ts` y placeholders de color por arquetipo. Purificación al vencerlos (§4.1).
6. Pickups: guavirá (cura); Luz de Arasy (8 s de inmunidad con el **filtro Glow de Phaser 4**, tinte plateado, parpadeo final y purificación al contacto); pluma (se cuenta en el HUD).
7. HUD: corazones, plumas (0/3) e icono con barra de la Luz de Arasy (placeholders dibujados por código).
8. `AudioManager` mínimo + ZzFX: salto, aterrizaje, tajo, golpe, purificación, daño, curación, Luz de Arasy, pluma y fuego.
9. Ampliar `tools/levels/test.txt` con enemigos, objetos y peligros.
10. Tests: daño, curación, inmunidad e invulnerabilidad; máquina de estados del Charger.

**Criterios:** se puede pelear con los tres arquetipos · la Luz de Arasy funciona y se ve · morir devuelve al fuego · sin errores en consola.

**Fuera de alcance:** jefes, dones, menús, mando, táctil.

**Notas para la próxima sesión (S2 → S3):**
- **Motor de Kerana:** `PlayerMotor` ahora tiene estados `attack` y `hurt` además de los de S1 (no se sumó `charge`: es el don del nivel 1, S6). `attackHitboxActive` marca la ventana de golpe (GDD §3.4); `triggerHurt(ms)` la aturde con control reducido, el retroceso lo aplica quien llama (`Player.takeDamage`).
- **Vida:** `src/systems/Health.ts` es lógica pura (corazones, invulnerabilidad). El máximo real hoy es 4 (`GAMEPLAY.hearts.start`); el tope de 7 (`GAMEPLAY.hearts.max`) recién se usa cuando entren los dones de corazón (S7/S10/S11) — si alguna sesión suma un don de corazón, hay que subir `player.health.max` ahí, no acá.
- **Enemigos:** arquetipos `Walker`, `Charger` (con `ChargerMotor`, lógica pura y testeada aparte) y `Flyer` en `src/entities/enemies/`, con datos en `src/data/enemies.ts`. Los IDs con nombre real (`teju_i`, `mbopi`…) los define cada sesión de nivel; por ahora los `kind` del ASCII son `walker`/`charger`/`flyer` directamente.
- **`enemies` y `pickups` son arrays, no `Phaser.Physics.Arcade.Group`:** un Group vuelve a aplicar sus valores por defecto (incluido `allowGravity: true`) a cualquier sprite que se le agregue con `.add()`, así que un Flyer o un Pickup con `setAllowGravity(false)` terminaba cayendo igual. `physics.add.overlap`/`collider` aceptan arrays de sprites sin ese problema. Si una sesión futura necesita pooling real, usar `group.createMultiple()` (crear los sprites *desde* el grupo) en vez de crear aparte y hacer `.add()`.
- **Objetos del ASCII:** `tools/lib/ascii-map.mjs` ya emitía `Enemy` (letras a-z vía `enemy x=kind`) y `Pickup` (`G` guavirá, `L` Luz de Arasy, `F` pluma, máx. 3) desde S1; esta sesión los consume en `LevelScene.buildObjects()`. `B` (`Breakable`) sigue sin actor: lo necesita el tajo cargado (don de Teju Jagua, S6).
- **Pozos y agua bajo el suelo transitable:** en `tools/levels/test.txt` hay un pozo angosto en cols 31-35 (fila 25) y una pileta de agua en cols 56-66; si agregás objetos ahí, revisá primero la fila de abajo (`#` sólido vs `.`/`~`) para no poner nada sobre un hueco.
- **AudioManager:** `src/systems/AudioManager.ts` usa la librería `zzfx` (dependencia npm agregada, es la que pide el GDD §11.1/§10.3) vía `import()` dinámico, así el `new AudioContext` de ZzFX no se ejecuta hasta el primer sonido. Presets en `src/systems/sfxPresets.ts`, provisionales: Jose puede afinarlos en https://killedbyapixel.github.io/ZzFX/ y pegar el array nuevo. Falta el desbloqueo de audio en el primer toque (S5) y la música (S5 también).
- **HUD:** corazones, plumas (`0/3`) y una barra de la Luz de Arasy, todo dibujado por código. `UIScene` lee `registry.get('hearts'|'feathers')` al arrancar por si el evento inicial de `LevelScene` se emitió antes de que `UI` terminara su `create()` (pasa porque `scene.launch('UI')` no es síncrono).
- **Checkpoints:** ahora quedan "encendidos" visualmente aunque se toque otro después (antes volvían a apagarse); +1 corazón la primera vez que se encienden.
- **Pendiente para Jose:** nada nuevo de assets (siguen los mismos placeholders faltantes de S1); si tenés las hojas de Kerana en `raw/kerana/`, esta es la sesión de corte para S3.

### S3: Pipeline de sprites y Kerana real
**Lee:** ASSETS §2, §3.1 y §3.2; GDD §3.5, §9.2 y §9.4.

**Requisitos:** hojas de Grok en `raw/kerana/`. **Si no están, haz S4 y deja S3 para después** (anótalo en §7).

**Tareas:**

1. `tools/sprites.mjs` según ASSETS §2.2: quita el fondo (alfa o magenta), corta según `CxR` del nombre, recorta, alinea la línea base, escala a la caja del personaje (GDD §9.2, o `sprite.json`), detecta el tamaño aparente de píxel cuando aplique, empaqueta PNG + JSON e imprime un resumen (frames por animación y tamaño final). Debe funcionar en la nube y en Windows sin compilar nada.
2. Soporte para subcarpetas por parte (`raw/<id>/<parte>/`), `raw/backgrounds/` (escala a 360 px de alto) y `raw/portraits/` (96 × 96).
3. Kerana: animaciones `idle`, `run`, `jump`, `fall`, `attack` y `hurt` conectadas a la máquina de estados; volteo según la dirección; hitbox ajustada al cuerpo, no al frame.
4. Efectos por código sobre el sprite real: parpadeo de invulnerabilidad y brillo de carga (listo para S6).
5. Documentar en ASSETS §2 cualquier detalle nuevo de uso.
6. Tests del pipeline con una hoja sintética generada dentro del propio test.

**Criterios:** `npm run sprites` funciona · Kerana animada sin temblor en los pies · hitbox correcta · build y tests pasan.

**Qué prueba Jose:** si una animación se ve mal, ajusta `raw/kerana/sprite.json` o regenera esa hoja en Grok y corre `npm run sprites` en su PC (sin gastar crédito).

**Notas para la próxima sesión:** —

### S4: Estructura del juego
**Lee:** GDD §2.4, §2.6, §4.4 a §4.7, §8, §11.9 y §11.10; ASSETS §7 (mapa del mundo) y §8 (fuentes).

**Requisitos:** S2 fusionada (S3 no es requisito).

**Tareas:**

1. `src/data/levels.ts`: los 7 niveles más `test` (nombres, subtítulos, bioma, jefe, don y nodo del mapa según las coordenadas del GDD §8.4).
2. `StoryScene` con el prólogo (§2.4) y el final (§2.6), cargados desde `src/data/story.ts`.
3. `WorldMapScene`: nodos, estados, estrellas por nivel liberado y panel del nodo. Fondo: si es rápido, contorno del Paraguay desde Natural Earth (dominio público, repositorio en GitHub) con los nodos proyectados; si no, fondo liso.
4. Título completo: Nueva partida · Continuar · Opciones · Créditos.
5. `SaveManager` (§11.9) con tests: guardar, cargar, datos corruptos y migración.
6. i18n en español para todo lo existente, con test de claves.
7. `DialogueBox` (retrato provisional, nombre, texto letra por letra y avance) y `src/data/dialogues.ts` con todos los diálogos de liberación del GDD §6.
8. Pausa (Continuar · Reiniciar desde el fuego · Opciones · Salir al mapa) y Opciones (§8.6), incluido el modo asistido (§4.7).
9. Pantalla de nivel completado y créditos (con `CREDITS.md` y las fuentes culturales del GDD §14).
10. Mainumby compañero (placeholder o sprite, si existe) y carteles `Sign` con burbuja que no pausa el juego.
11. Fuentes con cobertura de guaraní: verificar los glifos (por ejemplo con fonttools) con la frase de prueba de ASSETS §8.

**Criterios:** flujo completo Título → Prólogo → Mapa → nivel de prueba → Nivel completado → Mapa · el guardado sobrevive a recargar la página · los textos con ẽ y ỹ se ven bien.

**Notas para la próxima sesión (S4 → S5):**
- **Semáforo rojo desde S2** (§6.3): se recortaron los puntos 1 a 3 del GDD §12.2 (jefe secreto Tau, traducción al inglés, persecución del Ao Ao — queda solo la arena) y se marcaron `[RECORTADO]` ahí mismo. El resto de la lista (puntos 4 a 9) sigue disponible si hace falta seguir recortando.
- **S3 se saltó** (no había hojas en `raw/kerana/`): Kerana sigue con el placeholder de S1. Cuando lleguen los assets, corré S3 antes o después de S5/S6, no importa el orden.
- **Nodo 1 = mapa de prueba:** `src/data/levels.ts` define `l1`..`l7` con sus datos reales (GDD §6, §8.4), pero como `l1.txt` todavía no existe, `l1.mapKey` apunta a `map_test` (el mismo nivel de prueba de S1/S2). Cuando S6 genere `tools/levels/l1.txt` y corra `npm run maps`, cambiá `l1.mapKey` a `'map_l1'` y listo; `l2`..`l7` ya apuntan a sus `map_lN` futuros (todavía no cargan: `WorldMapScene` los muestra bloqueados hasta que `unlockedLevel` los alcance).
- **Diálogo de liberación conectado de una vez:** el `rect LevelExit` del mapa de prueba dispara `LevelScene.completeLevel()`, que si `def.boss` existe muestra el diálogo de `src/data/dialogues.ts` (`DialogueBox`) y recién después guarda (`SaveManager.completeLevel`) y pasa a `LevelComplete`. Como `l1` ya tiene jefe (`teju_jagua`) aunque el mapa sea el de prueba, el diálogo de Teju Jagua se ve completo desde ya (podés probarlo con Mapa → nodo 1 → llegar a `x=114..118,y=22..26` en tiles). Los niveles 2 a 7 heredan el mismo mecanismo sin cambios cuando tengan mapa propio.
- **Plumas: conteo simple, no por índice.** `SaveManager.setFeatherCount(levelId, n)` guarda "n plumas de 3", no cuáles. Alcanza para que el panel del mapa muestre progreso, pero no es fiel si el jugador junta plumas distintas en visitas distintas. Cuando los niveles reales (S6+) marquen cada pluma con un `id` en el ASCII, cambiar a `SaveManager.collectFeather(levelId, index)` (ya existe, con su test).
- **Modo asistido (§4.7):** conectado el efecto en `Player` (constructor recibe `assist`): +3 corazones al entrar, invulnerabilidad de 2 s y Luz de Arasy de 12 s. **No** conectado todavía: dones desde el inicio, avisos de jefe 30 % más largos (no hay jefes aún) ni la Luz de Arasy extra en cada arena. La sacudida de cámara y los destellos (Opciones) están guardados en `SaveManager` pero **`LevelScene` todavía no los respeta** (sigue llamando `cameras.main.shake/flash` siempre) — es la tarea 5 de S5, tal cual dice el GDD.
- **Dones y corazones guardados, pero no aplicados a Kerana:** `SaveManager.current.maxHearts` y `.gifts` se actualizan al completar un nivel, pero `LevelScene` todavía arranca a Kerana con `GAMEPLAY.hearts.start` (+ bono de asistido) sin mirar el guardado, y no hay salto doble/dash/tajo cargado en `PlayerMotor` todavía. Aplicar el guardado a `Player` (máximo de corazones real) es sencillo y se puede hacer en cualquier sesión desde ahora; los dones de habilidad en sí llegan con S6 (tajo cargado), S8 (salto doble) y S9 (dash).
- **Tipografía:** se usó **Noto Sans Mono** (Google Fonts, licencia OFL) para todo el texto en vez de una fuente pixel dedicada + una legible (ASSETS §8 sugiere las dos). Se verificó con `fonttools` (`getBestCmap`) que cubre la frase de prueba completa, incluidas ẽ y ỹ; se ve en Créditos. Si el autor consigue una fuente pixel con esa misma cobertura, cambiar `FONT_FAMILY` en `src/config/fonts.ts` y los archivos en `public/assets/fonts/`.
- **`window.__KERANA_GAME__`** ahora expone la instancia de Phaser.Game (además de `__KERANA_READY__` y `__KERANA_DEBUG__`), para que `tools/smoke.mjs` pueda comprobar qué escena está activa (`scene.isActive('Map')`, etc.) sin depender de capturas.
- **Idioma:** `en.ts` sigue sin existir (recortado, GDD §12.2 punto 2); la opción de idioma en Opciones guarda `'en'` si se elige, pero `t()` solo tiene tabla en español, así que por ahora no cambia nada visible.
- **Pendiente para Jose:** nada nuevo de assets obligatorios. Si querés un logo real para el Título o una ilustración para el mapa (GDD §8.4/ASSETS §7), van en S13; mientras tanto el mapa usa fondo liso con nodos (se salteó el contorno de Natural Earth a pedido, para no gastar crédito en eso).

### S5: Controles y audio
**Lee:** GDD §3.2, §4.9 y §10.

**Requisitos:** S4 fusionada.

**Tareas:**

1. `InputManager`: mando (gamepad de Phaser) y táctil (botones virtuales solo en pantallas táctiles, multitáctil, tamaño cómodo). El botón de dash aparece solo si está desbloqueado.
2. Los textos de ayuda muestran las teclas del dispositivo en uso.
3. `AudioManager` completo: música con fundido, pausa al perder el foco y desbloqueo con el primer toque en móvil. Carga `title`, `level` y `boss` si existen.
4. Completar los efectos genéricos del GDD §10.3 con ZzFX (los de cada jefe van en su sesión).
5. Conectar las opciones de accesibilidad: sacudida, destellos y velocidad del texto.

**Criterios:** se juega completo con mando y en el móvil (probado en Pages) · sin errores de audio en móvil.

**Notas para la próxima sesión:** —

### S6: Nivel 1 Paraguarí + Teju Jagua (+ base de jefes)
**Lee:** GDD §6.0, §6.1, §3.7 y §5.3 (teju_i, mbopi); ASSETS §3.4 (Teju Jagua) y §5 (silueta del cuerpo).

**Requisitos:** S4 fusionada.

**Tareas:**

1. `tools/levels/l1.txt` según §6.1: secciones, fuegos, 3 plumas con sus requisitos, Luz de Arasy, guavirá y carteles de Mainumby para el tutorial.
2. Nuevos elementos: estalactitas (`FallingHazard` con aviso) y `Breakable`.
3. Enemigos `teju_i` (Walker) y `mbopi` (Flyer), con sprites si existen.
4. **Base de jefes** (GDD §11.5): fases por umbral, cola de ataques con pesos, telegraph y vulnerable, barra de jefe, bloqueo de arena (`BossArena`), reinicio de la pelea al caer y `LiberationSequence` común (cámara lenta, marca que estalla, diálogo, ascenso, estrella en el mapa y don).
5. Teju Jagua completo (§6.1): 7 cabezas con tinte arcoíris, mordida, coletazo, fuego, estalactitas y cabezas que "se duermen".
6. Don: tajo cargado (mantener y soltar; rompe `Breakable`).
7. Efectos de sonido del jefe (ZzFX).
8. Tests: umbrales de fase y selección de ataques; don desbloqueado y guardado.

**Criterios:** el nivel 1 se juega de principio a fin · `?level=1&boss=1` va directo al jefe · todos los ataques se pueden evitar · al ganar, el mapa muestra la primera estrella.

**Notas para la próxima sesión:** —

### S7: Nivel 2 Ñeembucú + Mbói Tu'i
**Lee:** GDD §6.2, §4.8 (agua baja) y §5.3 (jakare, nakurutu, mboi).

**Tareas:** `l2.txt` según §6.2 · camalotes (`Sinking`), agua baja (zona que ralentiza) y agua profunda · enemigos `jakare` (Lurker), `nakurutu` (Diver) y `mboi` (Walker) · Mbói Tu'i con sus 3 fases (emerger y picotazo, graznido con anillos y empuje, escupitajo, enroscado con flores que curan) · efecto del graznido · don: +1 corazón · tests de `Sinking` y del Lurker.

**Criterios:** como en S6, para el nivel 2.

**Notas para la próxima sesión:** —

### S8: Nivel 3 Misiones + Moñái
**Lee:** GDD §6.3, §4.8 (hipnosis, viento) y §5.3 (nandu, karakara).

**Tareas:** `l3.txt` · `WindZone` con aviso visual · `nandu` (Charger) y `karakara` (Diver) · `StatusEffects`: hipnosis (controles invertidos 3 s, icono y sonido) · Moñái con 3 fases (descenso con sombra; pulso que los troncos bloquean; robo de un corazón que se recupera golpeando la cola) · don: salto doble · tests de la hipnosis y del robo o recuperación del corazón.

**Criterios:** como en S6, para el nivel 3.

**Notas para la próxima sesión:** —

### S9: Nivel 4 Capiatá + Jasy Jatere
**Lee:** GDD §6.4, §4.8 (sueño de siesta) y §5.3 (jagua, abejas).

**Tareas:** `l4.txt` · `SleepFog` · tejas como `FallingHazard` · `jagua` (Charger) y `abejas` (Swarm con partículas) · Jasy Jatere: invisibilidad (casi transparente, con pistas: silbido con paneo estéreo, notas musicales, huellas de polvo), enjambres, bastón que vuela y carrera por recuperarlo · don: dash intangible (Paso de la siesta) · tests del sueño y del dash.

**Criterios:** como en S6, para el nivel 4 · se puede ganar solo guiándose por las pistas.

**Notas para la próxima sesión:** —

### S10: Nivel 5 Canindeyú + Kurupi
**Lee:** GDD §6.5 y §5.3 (kuati, kai, mboi colgante).

**Antes de empezar:** revisa en "Notas de juego" y en el prompt si Jose eligió los pies al revés o la versión 100 % Colmán (§6.5). Si no dice nada, usa los pies al revés.

**Tareas:** `l5.txt` (nivel vertical) · `Bouncer` y `Crumble` · `kuati` (Jumper), `kai` (Thrower) y `mboi` colgante (Lurker) · Kurupi con 3 fases (llamado de animales; huellas invertidas o estampida; copias o lianas) · don: +1 corazón · tests de `Crumble` y del Thrower.

**Criterios:** como en S6, para el nivel 5.

**Notas para la próxima sesión:** —

### S11: Nivel 6 Guairá + Ao Ao
**Lee:** GDD §6.6 y §5.3 (taitetu, ao_ao_cria).

**Tareas:** `l6.txt` · `taitetu` (Charger en manada) y `ao_ao_cria` (Jumper) · **[RECORTADO desde S4, GDD §12.2 punto 3: semáforo rojo, ver §6.3]** `ChaseZone` (la cámara avanza sola y `Pindo` detiene el avance mientras Kerana está arriba): no la implementes, usá directo la alternativa del GDD §6.6 (un tramo normal con la manada patrullando) · Ao Ao con 3 fases; el pindó de la arena es zona segura · don: +1 corazón · tests del refugio en el pindó.

**Criterios:** como en S6, para el nivel 6.

**Notas para la próxima sesión:** —

### S12: Nivel 7 Asunción + Luisón + final
**Lee:** GDD §6.7, §6.8, §2.6 y §4.8 (oscuridad).

**Tareas:** `l7.txt` · `DarkZone` con la iluminación de Phaser 4 (`setLighting`, luz sobre Kerana) · `Lantern` como fuego y fuente de luz · `pora` (vulnerable solo iluminado) y `jagua_hu` · Luisón con 3 fases (terrones y aullido sobre la lápida; apagón y embestida anunciada por los ojos; sombra de Tau) · velas que se encienden al liberarlo · final con `StoryScene` y créditos · tests de la vulnerabilidad según la luz.

**Criterios:** el juego completo se puede terminar de principio a fin · el final se muestra según las plumas (§2.6).

**Notas para la próxima sesión:** —

### S13: Integración de arte y música
**Lee:** ASSETS (completo); GDD §9 y §10.2.

**Tareas:** correr el pipeline con todo lo que haya en `raw/` · tilesets reales (autotile o mapeo) · fondos parallax por nivel · retratos en los diálogos · logo, mapa del mundo e iconos · música por nivel · actualizar `CREDITS.md` · marcar en la checklist de ASSETS §10 lo integrado y lo que falta.

**Criterios:** nada se rompe con assets parciales · build y tests pasan.

**Notas para la próxima sesión:** —

### S14: Pulido de sensación
**Lee:** GDD §4.1, §9.7 y §10.3; "Notas de juego de Jose" (§7).

**Tareas:** aplicar las notas de juego · ajuste fino de hit-stop y sacudidas · partículas (polvo, salpicaduras, chispas) · transiciones entre escenas y tarjetas de título de nivel · balance de jefes según las notas · rendimiento en móvil (pools, partículas).

**Notas para la próxima sesión:** —

### S15: QA y cierre
**Tareas:** recorrer la checklist de QA (abajo) con la prueba de humo y revisión de código · corregir bugs · README final con el enlace de juego · verificar el tamaño total y el tiempo de carga · lista de pendientes para la reserva.

**Checklist de QA** (también sirve para que Jose pruebe):

- [ ] Cada nivel se completa con los dones que se tienen al llegar.
- [ ] Todas las plumas son alcanzables con los dones que indica el GDD.
- [ ] Cada ataque de jefe tiene aviso visible **y** sonoro.
- [ ] "Reiniciar desde el fuego" funciona en todos los niveles.
- [ ] El guardado sobrevive a recargar la página.
- [ ] El modo asistido funciona.
- [ ] Mando y táctil funcionan en todos los menús.
- [ ] Ningún error en la consola.
- [ ] 60 fps en PC; fluido en un móvil de gama media.
- [ ] Ningún texto sin i18n; ninguna clave ⟦faltante⟧.
- [ ] `CREDITS.md` completo.

### Reserva
Arreglos pendientes y, si queda crédito, Extras en este orden: jefe secreto Tau (GDD §7) → inglés → mejores tiempos → pogo.

**Jefe secreto Tau e inglés están `[RECORTADOS]` desde S4** (semáforo rojo, GDD §12.2 puntos 1 y 2, ver §6.3): no se hacen salvo que sobre crédito en la Reserva y Jose lo pida explícitamente.
