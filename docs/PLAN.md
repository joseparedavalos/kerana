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

**Nuevo reparto tras S4** (quedan US$68, semáforo rojo). Reemplaza las metas de arriba para lo que falta:

| Sesión | Contenido | Meta (US$) |
|---|---|---|
| S3 | Pipeline de sprites + Kerana real | 7 |
| S6 a S12 | Niveles 1 a 7 con sus jefes | 45 (≈ 6,50 cada una) |
| S13 | Integración de arte **y música** (absorbe el audio de S5) | 6 |
| Reserva | Correcciones | 10 |
| **Total** | | **68** |

S5, S14 y S15 dejan de ser sesiones aparte: la música pasa a S13 y la QA la hace Jose jugando (checklist de S15).

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
| S3 | 2026-09-24 | Opus 5.5 | 68 | 65 | 3 | 35 | Verde |
| S4 | 2026-09-24 | Sonnet 5 | 78 | 68 | 10 | 32 | Rojo |
| S5 | | | | | | | |
| S6 | 2026-09-24 | Opus 5.5 | 65 | 60 | 5 | 40 | Verde |
| S6b | 2026-09-24 | Opus 5.5 | 60 | 58 | 2 | 42 | Verde |
| S7 | 2026-09-27 | Opus 5.5 | 58 | 53 | 5 | 47 | Verde |
| S8 | 2026-09-27 | Opus 5.5 | 53 | 50 | 3 | 50 | Verde |
| S9 | 2026-09-27 | Opus 5.5 | 50 | 44 | 6 | 56 | Verde |
| S10 | | | | | | | |
| S11 | | | | | | | |
| S12 | | | | | | | |
| S13 | | | | | | | |
| S14 | | | | | | | |
| S15 | | | | | | | |

**Semáforo de S6:** con el reparto tras S4, la meta acumulada es 32 (gastado hasta S4) + 7 (S3) + 6,50 (S6) = 45,50; lo gastado es 40 → **Verde**. (S6b no estaba en el reparto: sale de la Reserva.)

**Semáforo de S6b:** costó 2 (de la Reserva, que queda en 8). Acumulado 42 contra una meta de 45,50 → **Verde**.

**Semáforo de S7:** meta acumulada 32 + 7 (S3) + 6,50 (S6) + 6,50 (S7) = 52; gastado 47 → **Verde**.

**Semáforo de S8:** meta acumulada 52 + 6,50 (S8) = 58,50; gastado 50 → **Verde**.

**Semáforo de S9:** meta acumulada 58,50 + 6,50 (S9) = 65; gastado 56 → **Verde**.

**Modelo:** desde S3, todas las sesiones usan **Opus 5.5** (S3 costó US$3 contra una meta de 7).

---

## 7. Estado de las sesiones (lo actualiza Claude)

| Sesión | Estado | PR | Notas breves |
|---|---|---|---|
| S1 | Hecha (fusionada) | PR #1 (`claude/bold-pascal-n2lmlt`) | Proyecto base, nivel de prueba, Kerana placeholder con coyote/buffer, smoke OK |
| S2 | Hecha | rama `claude/youthful-allen-ebzwov` | Ataque, vida, fuegos, peligros con daño, Walker/Charger/Flyer, pickups, HUD y ZzFX. Smoke OK |
| S3 | Hecha | rama `claude/blissful-heisenberg-0wtc7o` | `npm run sprites` (pngjs), Kerana animada (idle/parpadeo, run, jump, fall, aterrizaje, attack, hurt por código), hitbox al cuerpo, brillo de carga listo. Build, tests y smoke OK |
| S4 | Hecha (se saltó S3) | rama `claude/practical-carson-4q13pz` | Título, prólogo/final, mapa del mundo (fondo liso), guardado, i18n, diálogos de liberación, pausa/opciones, nivel completado, créditos, fuente con guaraní. Ver notas abajo. Build, tests y smoke OK |
| S5 | Eliminada (música → S13; táctil recortado) | | |
| S6 | Hecha | rama `claude/eloquent-fermi-bek28y` | Nivel 1 Paraguarí (ASCII), `teju_i` y `mbopi`, estalactitas, `Breakable` (liana y roca agrietada), base de jefes (`BossBrain`, `Boss`, `BossArena`, `LiberationSequence`, barra), Teju Jagua completo, tajo cargado. Build, tests y smoke OK |
| S6b | Hecha | rama `claude/practical-curie-03v7dy` | Kerana con doble detalle: lienzo 1280 × 720 con zoom 2 (`setupView`), `detail` en el pipeline, Kerana a 128 × 128 con detail 2. Jugabilidad sin cambios. Build, tests y smoke OK |
| S7 | Hecha | rama `claude/laughing-newton-nqj2z9` | Nivel 2 Ñeembucú (ASCII), camalotes (`Sinking`), agua baja (`ShallowWater`), `jakare` (Lurker), `nakurutu` (Diver), `mboi` (Walker), Mbói Tu'i con 3 fases, don +1 corazón. Build, tests y smoke OK |
| S8 | Hecha | rama `claude/awesome-carson-qhwqjn` | Nivel 3 Misiones (ASCII), `WindZone` con aviso, `nandu` (Charger), `karakara` (Diver), hipnosis (`StatusEffects`), Moñái con 3 fases (descenso, pulso, robo del corazón), salto doble. Arreglos previos: postes de l2 a 3 tiles y arena que no se recierra tras caer. Build, tests y smoke OK |
| S9 | Hecha | rama `claude/elegant-hypatia-1ryhow` | Nivel 4 Capiatá (ASCII), `SleepFog` (sueño de siesta), tejas (`FallingHazard kind=teja`), `jagua` (Charger que ladra), `abejas` (Swarm con partículas), Jasy Jatere (chispas, fase invisible con pistas, enjambres, carrera por el bastón), dash intangible. Build, tests y smoke OK |
| S10 | Hecha | rama `claude/pensive-hopper-ogtwls` | Nivel 5 Canindeyú (ASCII, 280 × 45, vertical), hongos que rebotan (`Bouncer`, `M`), ramas que se quiebran (`Crumble`, `R`), `kuati` (Jumper), `kai` (Thrower con frutas), `mboi_colgante` (Lurker colgante), Kurupi con pies al revés (llamado, huellas invertidas y pisotón, engaño en tres), +1 corazón. Build, tests y smoke OK |
| S11 | Pendiente | | |
| S12 | Pendiente | | |
| S13 | Pendiente | | |
| S14 | Eliminada (ajustes en la Reserva) | | |
| S15 | Eliminada (QA: Jose jugando) | | |

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

**Notas para la próxima sesión (S3 → S6):**
- **Pipeline:** `tools/sprites.mjs` (CLI) + `tools/lib/sprite-pipeline.mjs` (lógica pura, con tests en `tests/spritePipeline.test.ts`). Solo `pngjs`, ya estaba en devDependencies. Detalles de uso en ASSETS §2.2–2.3. Escala **por hoja** con su frame de pie (`ref`): las 4 hojas de Kerana quedan a 46 px aunque `attack` venía a 877 px y las otras a ≈ 715. Alinea pies abajo y la **cintura** en X (la estela del tajo no corre el cuerpo).
- **Tamaño aparente de píxel:** se detecta y se informa, pero las hojas de Grok no traen una grilla limpia (sale 1), así que la reducción es por "moda" de color. `snapPixel` queda disponible para arte pixel verdadero.
- **Animaciones** (`raw/kerana/sprite.json`, índices desde 0): `idle` 2–5 en loop con `blink` 6–8 al azar (`GAMEPLAY.playerFx.blinkMinMs/MaxMs`); `run` 2–10; `jump` 5–6 (sin la preparación agachada); `fall` 7–8; `land` 9 solo al aterrizar quieta; `attack` 5–8 a 14 fps (≈ 280 ms = `GAMEPLAY.attack.totalMs`); `hurt` = frame 7 de `jump` + destello rojo/blanco por tinte FILL + parpadeo de invulnerabilidad + retroceso (lo que ya existía).
- **Hitbox:** 16 × 42 (antes 40), centrada y apoyada en el borde inferior del frame de 64 × 64 (`Player` usa `setOffset`). Si falta el sprite, vuelve el rectángulo provisional con el mismo código.
- **Para S6 (tajo cargado):** `Player.setChargeGlow(fracción)` enciende un Glow oro (`GAMEPLAY.playerFx.chargeGlow*`); falta el estado `charge` en `PlayerMotor` y llamar a `setChargeGlow` con el tiempo mantenido / 600 ms. No hay animación `charge` propia: usa `idle` + brillo (GDD §3.5).
- **Assets faltantes:** hoja de `hurt` (no hace falta), `heart_full`, `heart_empty`, `sign`, `checkpoint` (placeholders). Fondos y retratos no se procesaron (el pipeline ya los soporta: `raw/backgrounds/`, `raw/portraits/`).
- **Presupuesto:** reparto nuevo en §6.1 (S6–S12 ≈ US$6,50 cada una). Recortados también los puntos 4, 5 y 6 del GDD §12.2 (tercera fase de jefes 3–6, táctil, parallax de 3 capas). El resto de S5 que no es música (mando, textos de ayuda por dispositivo, sacudida/destellos/velocidad del texto en `LevelScene`) no tiene sesión: hacerlo en la Reserva si sobra.

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

### S5: Controles y audio [ELIMINADA tras S4: la música pasa a S13; el táctil está recortado (GDD §12.2 punto 5)]
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

**Notas para la próxima sesión (S6 → S7):**
- **Mapa:** `tools/levels/l1.txt` (240 × 34) → `map_l1`. A: cueva alta (x 0–45) con liana que tapa la salida (`rect Breakable … kind=liana`, basta un tajo normal); pluma 1 sobre la entrada (desde la roca de x 50). B: ladera (x 45–105) con escalón de 3 tiles, mbopi, Luz de Arasy y pasillo de 4 teju'i; pluma 2 en un bolsillo tras 3 rocas `B` (tajo cargado). Checkpoint 1 en x 112. C: descenso en escalones (x 116–175) con estalactitas (`point FallingHazard`), karaguatá en los bordes y pluma 3 en una cornisa `=` a 6 tiles (salto doble). Antesala x 176–199 (fuego, guavirá, cartel). Arena x 200–239 con repisas `=` a 3 tiles del suelo.
- **Base de jefes** (reutilizable en S7–S12): `src/data/bosses.ts` (fases con `untilHpRatio`, `idleMs` y ataques con pesos; `punishable: false` = sin ventana), `src/entities/bosses/BossBrain.ts` (lógica pura, con tests), `Boss.ts` (barra por `EventBus`, `tryHit`, `resetFight`; cada jefe implementa `playIntro`, `onTransition`, `applyHit`, `hurtsPlayer`, `markPosition`, `fadeOut`), `index.ts` (`createBoss`), `src/systems/BossArena.ts` (cámara fija y muro de rocas **a la izquierda** de la arena) y `src/systems/LiberationSequence.ts`. Un jefe nuevo = datos en `bosses.ts` + un archivo en `bosses/` + un `case` en `createBoss`.
- **Reinicio:** si Kerana cae (0 corazones) dentro de la arena, la pelea se reinicia entera y reaparece en la antesala; al volver a entrar arranca de nuevo la presentación.
- **Teju Jagua:** 14 de vida (7 cabezas × 2). Mordida (apunta a donde estaba Kerana, a ras del suelo o de la repisa si está arriba; queda clavada 1,5 s), coletazo (onda por el suelo; en fase 2 suelta 3–4 estalactitas), fuego (1–2 cabezas sobre el tercio de Kerana; bajan cansadas 1 s). Solo se le pega en la ventana. Cuerpo = elipse oscura; cabezas = placeholder gris teñido de arcoíris (si existe la textura `teju_jagua_head` la usa, pero **no está en el manifiesto**: al procesar `raw/teju_jagua/head/`, agregar la entrada). Todos los tiempos en `bosses.ts` y `GAMEPLAY.tejuJagua`.
- **Tajo cargado:** `PlayerMotor.chargeEnabled` (don guardado o `?gifts=all`); mantener atacar ≥ 600 ms y soltar. Brillo oro desde 200 ms (`GAMEPLAY.chargedSlash.glowFromMs`). 3 de daño, hitbox 40 × 28, rompe rocas `B` (quita los tiles de `Ground`).
- **Ahora sí se aplican del guardado:** `maxHearts` a Kerana, el don del tajo cargado, y `?god=1` (sin daño). La sacudida y los destellos respetan Opciones en todo lo nuevo (y en el daño de Kerana); el resto de S5 sigue pendiente.
- **Plumas:** siguen con conteo simple (`setFeatherCount`); el ASCII ya les pone `index` 0–2, así que pasar a `collectFeather(levelId, index)` es chico si hace falta.
- **Smoke:** ahora recorre Título → Mapa → nivel 1 → `__KERANA_DEBUG__.defeatBoss()` → liberación → Nivel completado → Mapa, comprueba el guardado, y abre `?level=1&boss=1&god=1` para entrar a la arena y ver atacar al jefe.
- **Sin probar a mano (Jose):** la dificultad de los saltos del mapa (pluma 1, escalón alto), la legibilidad de los avisos y si el fuego de un tercio se esquiva cómodo. Todo se ajusta en `gameplay.ts`, `bosses.ts` y `l1.txt` (+ `npm run maps`).
- **No hecho (anotado):** mbopi no "sale de las grietas" (vuela en onda desde su lugar); sin Luz de Arasy extra en la arena para el modo asistido (GDD §4.7); la música que se oscurece en la caverna va con S13.
- **Assets faltantes:** `raw/teju_jagua/head/` (cabeza), `raw/backgrounds/l1_boss_body.png` (silueta), sprites de `teju_i` y `mbopi`, estalactita, liana y roca agrietada (placeholders por código).

### S6b: Kerana con doble detalle (fuera del plan original; sale de la Reserva)
Kerana se dibuja con el doble de detalle sin tocar la jugabilidad: el mundo sigue en 640 × 360 unidades (tiles, física, mapas y `gameplay.ts` iguales).

**Notas para la próxima sesión (S6b → S7):**
- **Vista:** el lienzo es de 1280 × 720 (`src/main.ts`). Cada escena llama a `setupView(this)` al principio de `create()` (Preload, en `preload()`; Level, `setupView(this, false)` porque la cámara sigue a Kerana). Para medidas de pantalla usá `VIEW` (640 × 360), **no** `this.scale` (ahora da 1280 × 720). Toda escena nueva debe llamar a `setupView`.
- **Objetos fijos a la cámara:** con zoom, un objeto con `setScrollFactor(0)` debe sumar `fixedOffset(cam)` a su posición (lo hacen el texto de depuración de `LevelScene`, `DialogueBox` y el cartel de `LiberationSequence`). El HUD vive en `UIScene` con su propia cámara, sin cambios.
- **`detail`:** campo de `sprite.json` (1 por defecto) que el pipeline copia al `.json` de salida. `Player` lo lee de `kerana_anims` y se dibuja a escala 1/detail; el cuerpo de Arcade se pasa en píxeles de textura (× detail) y el Glow (Luz de Arasy y carga) usa `scale = detail`, así hitbox, tajo y brillos miden lo mismo que antes. El placeholder sigue con detail 1. `PLAYER_FRAME` = 128 en `manifest.ts`.
- **Jefes (S7 en adelante):** usar `detail: 2` en su `sprite.json` y dibujar a escala 1/detail como Kerana (hoy Teju Jagua es placeholder por código, no cambia). Enemigos chicos y tiles: `detail: 1`.
- **Sin probar a mano (Jose):** que Kerana se vea nítida en pantallas chicas (el zoom FIT puede reducir el lienzo por debajo de 1280 × 720).

### S7: Nivel 2 Ñeembucú + Mbói Tu'i
**Lee:** GDD §6.2, §4.8 (agua baja) y §5.3 (jakare, nakurutu, mboi).

**Tareas:** `l2.txt` según §6.2 · camalotes (`Sinking`), agua baja (zona que ralentiza) y agua profunda · enemigos `jakare` (Lurker), `nakurutu` (Diver) y `mboi` (Walker) · Mbói Tu'i con sus 3 fases (emerger y picotazo, graznido con anillos y empuje, escupitajo, enroscado con flores que curan) · efecto del graznido · don: +1 corazón · tests de `Sinking` y del Lurker.

**Criterios:** como en S6, para el nivel 2.

**Notas para la próxima sesión (S7 → S8):**
- **Mapa:** `tools/levels/l2.txt` (280 × 24) → `map_l2`. Superficie en la fila 17; `~` = agua profunda (devuelve al último suelo firme con 1 de daño, como antes). A: orilla (x 0–59) con dos cadenas de camalotes; pluma 1 sobre el último camalote de la segunda cadena. B: juncales (x 60–139) con juncos `=`; pluma 2 en un junco bajo junto a un jakare. Checkpoint 1 en x 120. C: noche (x 140–219), ñakurutu en postes, Luz de Arasy antes de la cadena más larga (x 176–199); pluma 3 en una repisa a 8 tiles de un escalón alto (x 216, pide el paso de la siesta: **inalcanzable hasta S9**, a propósito). Antesala x 220–239. Arena x 240–279: islotes A (240–247), B (253–260) y C (266–273), camalotes entre ellos y laguna a la derecha.
- **Nuevo en el ASCII:** `S` = camalote (los `S` seguidos forman un objeto `Sinking` y llevan agua debajo). Agua baja: `rect ShallowWater` (una fila sobre el suelo). El parser tiene test.
- **Camalotes:** `SinkingMotor` (lógica pura, con tests) + `entities/hazards/Sinking.ts` (cuerpo estático de un solo sentido; el dibujo tiembla y baja, el cuerpo no). Tiempos en `GAMEPLAY.water` (1,2 s y 3 s según el GDD).
- **Agua baja:** `PlayerMotor.speedMultiplier` (lo fija `LevelScene` en cada frame; × 0,6) y salpicaduras. **Empuje:** `PlayerMotor.push(vx, ms)` (lo usa el graznido); sirve para el viento de S8 (`WindZone`).
- **Enemigos:** `Lurker` (`LurkerMotor` con tests: oculto → burbujas → afuera → cooldown; solo se lo golpea afuera) y `Diver` (poste → aviso → picada hacia donde estaba Kerana → vuelve; en S8 sirve tal cual para `karakara`). `EnemyBase.collidesWithGround` reemplaza el chequeo por arquetipo.
- **Mbói Tu'i** (`bosses/MboiTui.ts`, datos en `bosses.ts`, sensación en `GAMEPLAY.mboiTui`): 12 de vida (3 fases de 4). Picotazo (burbujas 1 s en uno de 3 puntos → arco hacia Kerana → pico clavado 1,5 s), graznido (erizado 0,8 s → 2 anillos que **empujan sin dañar** → cae agotado hacia Kerana 1 s), escupitajo (cuello hinchado 0,6 s → 3 bolas en arco, sin ventana). Fase 3: se enrosca en el islote central, picotazo largo desde ahí, graznido doble, camalotes de la arena en ciclo automático desfasado y flores (`yvoty`) que curan 1 (máx. 2 a la vez). Los puntos de emergencia están en tiles desde el borde de la arena (`emergeTiles`, `coilTile`): si se cambia la arena en `l2.txt`, ajustarlos.
- **`BossContext`** suma `pushPlayer`, `setArenaPlatformsCycling` y `spawnHealFlower` (Teju Jagua no los usa).
- **Don:** +1 corazón ya lo aplicaba `SaveManager.completeLevel`; el smoke comprueba que queda en 5.
- **Smoke:** suma `?level=2&boss=1&god=1`: antesala, cierre de la arena, ataques, fase 3 forzada (ciclo de camalotes y flores) y liberación con guardado.
- **Sin probar a mano (Jose):** si las cadenas de camalotes se cruzan cómodas (huecos de 2 tiles), el alcance del tajo al jakare desde la orilla, si los anillos se saltan bien y si el picotazo largo de la fase 3 es justo. Todo en `gameplay.ts`, `bosses.ts`, `enemies.ts` y `l2.txt` (+ `npm run maps`).
- **No hecho (anotado):** el jefe es placeholder por código (cabeza de loro, cuello y anillos); el cielo del atardecer que se vuelve noche y las ranas que se callan van con S13 (fondos y música). `mboi` es Walker simple (el colgante es de N5).
- **Assets faltantes:** cabeza y cuerpo de Mbói Tu'i, sprites de `jakare`, `nakurutu` y `mboi`, camalote, flor `yvoty`, tileset real de `estero`.

### S8: Nivel 3 Misiones + Moñái
**Lee:** GDD §6.3, §4.8 (hipnosis, viento) y §5.3 (nandu, karakara).

**Tareas:** `l3.txt` · `WindZone` con aviso visual · `nandu` (Charger) y `karakara` (Diver) · `StatusEffects`: hipnosis (controles invertidos 3 s, icono y sonido) · Moñái con 3 fases (descenso con sombra; pulso que los troncos bloquean; robo de un corazón que se recupera golpeando la cola) · don: salto doble · tests de la hipnosis y del robo o recuperación del corazón.

**Criterios:** como en S6, para el nivel 3.

**Notas para la próxima sesión (S8 → S9):**
- **Arreglos antes de S8:** en `l2.txt` los postes de x 146 y 172 bajaron a 3 tiles (ñakurutu encima); regla nueva en CLAUDE.md (nada que se salte mide más de 3 tiles, salvo otro camino). La arena ya no se vuelve a cerrar en el frame del reinicio: `src/systems/ArenaGate.ts` (lógica pura, test `arenaGate.test.ts`) solo cierra de nuevo después de que Kerana estuvo afuera.
- **Mapa:** `tools/levels/l3.txt` (300 × 24) → `map_l3`. Suelo en la fila 17. A: pastizal (x 0–69) con tacurúes de 1–2 tiles y ñandúes; pluma 1 en una copa a 6 tiles (x 35–39, **pide salto doble**: volver después). B: ráfagas (x 70–149), Luz de Arasy en x 100, karaguatá, pluma 2 dentro del tacurú agrietado (x 124–130, pared de 3 `B`; tajo cargado). Checkpoint 1 en x 150. C: islas de monte (x 150–229) con pozos de 3 tiles y copas; pluma 3 al final de 4 copas con viento en contra (x 196–217, `speed=70`). Antesala x 230–259. Arena x 260–299: copas `=` a 3 tiles del suelo, centradas en los tiles 8,5 / 20,5 / 32,5 de la arena (`GAMEPLAY.monai.treeTiles`: si se cambia la arena, ajustarlos).
- **Viento:** `rect WindZone x y w h dir=±1 [speed] [offsetMs]` en el ASCII. `WindCycle` (lógica pura, con test) = calma → aviso 1 s (pasto que se inclina y partículas) → ráfaga. Empuja con `PlayerMotor.windVx` (se suma a la velocidad deseada; lo fija `LevelScene` en cada frame). Tiempos en `GAMEPLAY.wind`. Sirve para N6.
- **Hipnosis:** `src/systems/StatusEffects.ts` (lógica pura, con tests): invierte izquierda/derecha 3 s (`GAMEPLAY.hypnosis`); `Player.status` la aplica al leer las acciones y se limpia al reaparecer. Espiral que gira sobre Kerana con tinte iridiscente y sonido `hypnosis`. No se tiñe a Kerana (chocaba con el destello de daño y la Luz de Arasy).
- **Moñái** (`bosses/Monai.ts`, datos en `bosses.ts`, sensación en `GAMEPLAY.monai`, lógica en `monaiLogic.ts` con tests): 12 de vida (3 fases de 4). Descenso (vuela a la copa más cercana a Kerana, sombra que la sigue el 70 % del aviso, picada; aturdido 1,5 s: se le pega en la cabeza o el cuerpo). Pulso (baja junto a un tronco, cuernos iridiscentes 1 s, anillo de 200 px que hipnotiza; lo tapa un tronco si Kerana está detrás y por debajo de la copa; ventana 1 s). Robo (se enrosca y tiembla 0,7 s, embestida en diagonal; si acierta quita 1 corazón que brilla en la cola, uno a la vez; la cola queda expuesta 1,2 s y golpearla lo devuelve). Al vencerlo devuelve el corazón. Troncos y follaje dibujados por el jefe.
- **`BossContext`** suma `hypnotizePlayer`, `damagePlayer` (true si se aplicó y Kerana sigue en pie) y `healPlayer`. `hurtPlayer` de `LevelScene` ahora devuelve si se aplicó.
- **Salto doble:** `PlayerMotor.doubleJumpEnabled` (don guardado o `?gifts=all`); una vez por vuelo, `GAMEPLAY.player.doubleJumpVelocity`. Con tests.
- **Enemigos:** `nandu` (Charger, 2 de vida) y `karakara` (Diver en el aire), solo datos en `enemies.ts`.
- **Smoke:** suma `?level=3&boss=1&god=1`: antesala, cierre, ataques, fase 3 forzada y liberación con salto doble guardado.
- **Sin probar a mano (Jose):** saltos con viento en contra (copas de la pluma 3 con huecos de 2), si el pulso se esquiva cómodo detrás de los troncos, el tamaño de la cola al golpearla, y que la copa de la pluma 1 sea inalcanzable sin salto doble (6 tiles; el tacurú más cercano está a 7). Todo en `gameplay.ts`, `bosses.ts`, `enemies.ts` y `l3.txt` (+ `npm run maps`).
- **No hecho (anotado):** Kerana no se tiñe al estar hipnotizada (solo icono y sonido); las copas de los niveles no tienen tronco dibujado (solo en la arena); el jefe es placeholder por código.
- **Assets faltantes:** cabeza y cuerpo de Moñái, sprites de `nandu` y `karakara`, tacurú, pasto, tileset real de `campo` (hoy placeholder de color).

### S9: Nivel 4 Capiatá + Jasy Jatere
**Lee:** GDD §6.4, §4.8 (sueño de siesta) y §5.3 (jagua, abejas).

**Tareas:** `l4.txt` · `SleepFog` · tejas como `FallingHazard` · `jagua` (Charger) y `abejas` (Swarm con partículas) · Jasy Jatere: invisibilidad (casi transparente, con pistas: silbido con paneo estéreo, notas musicales, huellas de polvo), enjambres, bastón que vuela y carrera por recuperarlo · don: dash intangible (Paso de la siesta) · tests del sueño y del dash.

**Criterios:** como en S6, para el nivel 4 · se puede ganar solo guiándose por las pistas.

**Notas para la próxima sesión (S9 → S10):**
- **Mapa:** `tools/levels/l4.txt` (270 × 24) → `map_l4`. Suelo en la fila 17. A: calle (x 0–69) con corredores `=` en la fila 14 y techos en la 11; pluma 1 en el campanario (x 53–55, fila 6: **pide salto doble**). B: patios (x 70–139) con niebla, panales y Luz de Arasy; pluma 2 en un túnel bajo la calle (pozo x 118–119 con escalón, espinas x 121–122, pluma x 125): el túnel mide 3 tiles, no se puede saltar las espinas, **pide dash** (volver después). Checkpoint 1 en x 140. C: techos (x 140–209) con 4 tejas; pluma 3 en el patio escondido detrás de `H` (x 194–201). Antesala x 210–229. Arena x 230–269: techos a los lados (fila 14), bancos (fila 16), ramas del lapacho (filas 14 y 11) y niebla en dos partes. La columna central (x 250) queda libre a propósito: `setupBoss` mide el suelo ahí. Los lugares del jefe están en `GAMEPLAY.jasyJatere.spots` (tiles desde el borde de la arena): si se cambia la arena, ajustarlos.
- **Nuevo en el ASCII:** `H` = tile en la capa `Foreground` (se dibuja delante y no choca); `rect SleepFog`; `point FallingHazard ... kind=teja`. El parser tiene test.
- **Sueño de siesta:** `StatusEffects.stepSleep` (lógica pura, `tests/sleep.test.ts`): quieta (ningún botón mantenido) 2 s en la niebla → bostezo a los 1,2 s (sonido y "Zzz" tenue) → dormida 1,5 s sin controles; cada botón pulsado resta 250 ms; el daño la despierta. Todo en `GAMEPLAY.sleep`. Con `?god=1` no se duerme.
- **Dash (Paso de la siesta):** `PlayerMotor.dashEnabled` (don guardado o `?gifts=all`), acción `dash` (C, L o Shift). 320 px/s × 160 ms, sin gravedad mientras dura, uno por vuelo, enfriamiento de 500 ms después de terminar. Intangible: no recibe daño de enemigos, jefes ni espinas; pozos y agua honda sí dañan. Kerana se ve translúcida (`GAMEPLAY.dash.alpha`); usa la animación de correr (falta la propia). Tests en `playerMotor.test.ts`.
- **Enemigos:** `jagua` (Charger con `warnSfx: 'bark'`: ladra al empezar el aviso) y `abejas` (arquetipo nuevo `swarm`: `SwarmMotor` con tests + `Swarm.ts`; cuerpo invisible que siguen las partículas; panal junto al punto del mapa; solo pica mientras persigue, `EnemyBase.touchHurts`).
- **Jasy Jatere** (`bosses/JasyJatere.ts`, datos en `bosses.ts`, sensación en `GAMEPLAY.jasyJatere`, lógica en `jasyLogic.ts` con tests): 9 de vida (3 fases de 3). Fase 1: salta entre techos, rama y suelo; bastón en alto 0,6 s → 3 chispas en abanico; se burla 1,2 s (ventana). Fase 2: invisible (alpha 0,1 con tinte dorado); pistas: silbido con paneo estéreo cada 1,4 s (`AudioManager.play(key, pan)` + `BossContext.sfxAt`), notas musicales, huellas de polvo en el suelo, la risa en cada ventana; emboscada (destello del bastón 0,4 s, visible aunque él no → corre hasta pasar a Kerana → ventana 1,3 s) y enjambres (zumbido, máx. 2, `BossContext.spawnSwarm`). Cada golpe lo deja visible 2 s. Fase 3: más rápido y suma chispas. El golpe que lo dejaría en 0 lo deja en 1 y suelta el bastón (`lethalClamp`): vuela al lugar más lejos de Kerana; si ella lo toca antes de 3 s, gana (`Boss.defeatNow`, que `LevelScene` detecta tras `update`); si no, él lo recupera y vuelve a esconderse con 1 golpe más.
- **Test de avisos:** `bossBrain.test.ts` ahora pide ≥ 0,4 s (antes 0,5) porque el GDD fija 0,4 s para el destello del bastón.
- **Smoke:** suma `?level=4&boss=1&god=1` (antesala, cierre, fase invisible, carrera ganada, liberación con dash guardado). Arreglos del smoke que fallaban por tiempo en máquinas lentas (ya fallaban en `main`): la caminata al islote de Mbói Tu'i espera a que se cierre la arena, y el final de la liberación acepta "Nivel completado" o el mapa (el `Space` del bucle podía saltarlo).
- **Sin probar a mano (Jose):** si el túnel del dash se cruza cómodo (espinas de 2 tiles, dash de ≈ 3), si la niebla duerme demasiado seguido, si el silbido se oye bien a la izquierda/derecha con auriculares, si la fase invisible es justa sin mirar el brillo tenue, el alcance de las chispas y la distancia de la carrera. Todo en `gameplay.ts`, `bosses.ts`, `enemies.ts` y `l4.txt` (+ `npm run maps`).
- **No hecho (anotado):** la abuela dormida de la antesala [Extra]; el calor que ondula el aire y el sol vertical (van con S13, fondos); el jefe y los perros son placeholder por código; el dash no tiene estela ni animación propia.
- **Assets faltantes:** sprites de Jasy Jatere y su bastón, `jagua`, panal, teja, niebla, "Zzz", tileset real de `pueblo` (hoy placeholder de color), animación de dash de Kerana.

### S10: Nivel 5 Canindeyú + Kurupi
**Lee:** GDD §6.5 y §5.3 (kuati, kai, mboi colgante).

**Antes de empezar:** revisa en "Notas de juego" y en el prompt si Jose eligió los pies al revés o la versión 100 % Colmán (§6.5). Si no dice nada, usa los pies al revés.

**Tareas:** `l5.txt` (nivel vertical) · `Bouncer` y `Crumble` · `kuati` (Jumper), `kai` (Thrower) y `mboi` colgante (Lurker) · Kurupi con 3 fases (llamado de animales; huellas invertidas o estampida; copias o lianas) · don: +1 corazón · tests de `Crumble` y del Thrower.

**Criterios:** como en S6, para el nivel 5.

**Notas para la próxima sesión (S10 → S11):**
- **Versión elegida:** pies al revés (ni las Notas de juego ni el prompt pedían la versión 100 % Colmán). La estampida y las lianas no están hechas.
- **Mapa:** `tools/levels/l5.txt` (280 × 45, el más vertical) → `map_l5`. A: sotobosque (x 0–59, suelo en la fila 41) con hongos y kuati; tronco de 3 tiles en x 23–24; pluma 1 sobre la cadena de 3 hongos (x 36–48, fila 20). B: la subida (x 60–139) por 8 escalones de 3 tiles (ramas `=` fijas y `R` que se quiebran), karaguatá abajo (x 66–119: caer devuelve al último suelo firme con 1 de daño), mbói colgantes bajo las ramas de x 88 y 114, ka'i en x 99 y 128, Luz de Arasy en x 76. Pluma 2 en el hueco del tronco (x 94–104: túnel de 3 tiles con espinas de 2, **pide dash**); al tronco se sube con el hongo de x 89. Checkpoint 1 en x 138 (fila 14). C: el dosel (x 142–209), copas con huecos de 4, 6, 8, 6 y 5 tiles (salto doble y dash) y pozo abajo; mbói colgante en x 166, ka'i en x 180, kuati en x 188. Pluma 3 en la rama escondida detrás de la cortina `H` (x 199–208, filas 7–11). Antesala x 210–239 (suelo en la fila 20, checkpoint 2 en x 224). Arena x 240–279: ramas bajas `=` en la fila 17 (x 243–248, 253–257, 263–267, 272–277) y altas en la 14 (x 248–252, 268–272); la columna central (x 258–262) queda libre para medir el suelo. Lugares del jefe en `GAMEPLAY.kurupi.floorSpots` y `kaiSpots` (tiles desde el borde de la arena): si se cambia la arena, ajustarlos.
- **Nuevo en el ASCII:** `M` = hongo que rebota (objeto `Bouncer`), `R` = rama que se quiebra (objeto `Crumble`); los seguidos de una fila forman un solo objeto. El parser tiene test.
- **Hongos:** `entities/hazards/Bouncer.ts` (sombrero de un solo sentido). Rebota al caer encima **o al llegar caminando por el suelo**. `PlayerMotor.bounce(vy)` (se aplica en el paso siguiente, recupera el salto doble y el dash). `GAMEPLAY.jungle.bounceVelocity` = −540 (≈ 8 tiles). **Arreglo:** `Player` fijaba `setMaxVelocityY(maxFallSpeed)`, que en Arcade también limita la subida; ahora es el máximo entre la caída y el rebote (la caída la sigue limitando el motor en cada paso).
- **Ramas:** `CrumbleMotor` (lógica pura, `tests/crumble.test.ts`) + `Crumble.ts`: cruje 0,6 s (tiembla, se aclara, sonido `creak`), cae y reaparece a los 3 s. Todo en `GAMEPLAY.jungle`. Los kuati también se paran en ellas.
- **Enemigos:** arquetipos nuevos `jumper` (`JumperMotor` con tests + `Jumper.ts`: espera, se agacha y salta hacia Kerana) y `thrower` (`ThrowerMotor` con tests + `Thrower.ts`: aviso, fruta en arco con pool de 3; `arcVelocity` calcula el tiro para caer donde está Kerana). `EnemyBase.projectileHits(rect)` lo revisa `LevelScene.updateProjectiles`. `Lurker` con `hangs: true` (id `mboi_colgante`): el punto va en el tile bajo una rama; hojas verdes como aviso y baja colgado. Sirven para N6 (`ao_ao_cria` es Jumper).
- **Kurupi** (`bosses/Kurupi.ts`, datos en `bosses.ts`, sensación en `GAMEPLAY.kurupi`, lógica en `kurupiLogic.ts` con tests): 12 de vida (3 fases de 4). Fase 1: llamado (pose de silbido 0,8 s → 2 kuati por los bordes o 1 ka'i en una rama alta; ventana 1,2 s) y embestida corta (raspa 0,6 s, sin ventana). Fase 2: carrera al revés (mira hacia el otro lado de Kerana y corre hacia ella hasta el borde, huellas con los dedos al revés; sin ventana) y pisotón (se agacha 0,7 s → 2 ondas de hojas por el suelo; ventana 1 s); el llamado sigue. Fase 3: engaño (se divide en los 3 lugares del suelo, las copias parpadean 0,9 s, los tres corren al revés, **solo el verdadero deja huellas**; ventana 1 s tras la embestida). Golpear una copia la deshace en hojas y aparece un ka'i en la rama alta de ese lado. En las ramas bajas Kerana está a salvo de las carreras y las ondas. Máximo de enemigos llamados a la vez: `GAMEPLAY.kurupi.maxMinions` (3).
- **`BossContext`** suma `spawnMinion(kind, x, y)`. En `LevelScene`, `bossSwarms` pasó a `bossMinions` (enjambres de Jasy Jatere y animales de Kurupi; se purifican al reiniciar o ganar).
- **Don:** +1 corazón (6 en total) con `SaveManager.completeLevel`; el smoke lo comprueba.
- **Smoke:** suma `?level=5&boss=1&god=1` (antesala, cierre, ataques, engaño con 2 copias, liberación con 6 corazones) y `?level=5` (el primer hongo hace rebotar a Kerana). Arreglos por tiempo en máquinas lentas: caminar hasta que la arena se cierre (niveles 1, 3, 4 y 5, como ya hacía el 2) y mantener Pausa hasta que aparezca el mapa al saltar el prólogo. **Ojo:** el smoke sirve `dist/`: correr `npm run build` antes.
- **Sin probar a mano (Jose):** la altura del rebote (llegar a la pluma 1 y a la copa del tronco), si los escalones de la subida se sienten justos con las ramas que se quiebran, los huecos del dosel (sobre todo el de 8 tiles, x 164–171), si las frutas de los ka'i se esquivan, el alcance de la bajada de los mbói, si la carrera al revés se lee a tiempo y si las huellas alcanzan para encontrar al verdadero en la fase 3. Todo en `gameplay.ts`, `bosses.ts`, `enemies.ts` y `l5.txt` (+ `npm run maps`).
- **No hecho (anotado):** lluvia, niebla y luz verde filtrada (van con S13, fondos y efectos); raíces grandes en la arena (solo ramas); el jefe, los animales, los hongos y las ramas son placeholder por código; las copias no tienen sonido propio al correr.
- **Assets faltantes:** sprites de Kurupi, `kuati`, `kai`, `mboi` colgante, fruta, hongo, rama, cortina de lianas y tileset real de `selva` (hoy placeholder de color).

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

**Tareas:** `AudioManager` con música (fundido, pausa al perder el foco, desbloqueo con el primer toque en móvil; ex tarea 3 de S5) · correr el pipeline con todo lo que haya en `raw/` · tilesets reales (autotile o mapeo) · fondos parallax por nivel · retratos en los diálogos · logo, mapa del mundo e iconos · música por nivel · actualizar `CREDITS.md` · marcar en la checklist de ASSETS §10 lo integrado y lo que falta.

**Criterios:** nada se rompe con assets parciales · build y tests pasan.

**Notas para la próxima sesión:** —

### S14: Pulido de sensación [ELIMINADA tras S4: Jose ajusta `gameplay.ts`; arreglos puntuales en la Reserva]
**Lee:** GDD §4.1, §9.7 y §10.3; "Notas de juego de Jose" (§7).

**Tareas:** aplicar las notas de juego · ajuste fino de hit-stop y sacudidas · partículas (polvo, salpicaduras, chispas) · transiciones entre escenas y tarjetas de título de nivel · balance de jefes según las notas · rendimiento en móvil (pools, partículas).

**Notas para la próxima sesión:** —

### S15: QA y cierre [ELIMINADA tras S4: Jose hace la QA jugando con esta checklist]
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
