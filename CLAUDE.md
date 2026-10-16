# CLAUDE.md · Kerana

Juego de plataformas 2D para navegador inspirado en la mitología guaraní (Paraguay).
Stack: **Phaser 4 + Vite + TypeScript**, publicado en GitHub Pages.
El autor (Jose) trabaja con un **presupuesto fijo de crédito**: cada sesión tiene que rendir.

## Documentos (fuente de verdad)

- `docs/GDD.md`, secciones «Decisiones del 13 de octubre de 2026» y «Decisiones del 16 de octubre de 2026»: pisan los capítulos viejos del GDD.
- `docs/SESIONES.md` y `docs/PENDIENTES.md`: qué está hecho y qué sigue. Empieza por ahí si la tarea es de ahora. Lo de hoy está fechado el 16 de octubre.
- `docs/PLAN.md`: historial de las sesiones S1 en adelante. No es la lista de lo que falta.
- `docs/ASSETS.md`: sprites, tiles, fondos y audio.
- Si una decisión del 13 o del 16 de octubre y un capítulo viejo se contradicen, manda la decisión. Si el código ya la cumple, no la reviertas para obedecer el capítulo viejo.
- No regeneres `public/assets/tiles/*.png` con `tools/make-placeholder-tiles.mjs`. Pisa el piso nuevo y la decoración del borde.

## Cómo trabajar en una sesión

1. Lee tu sesión en `docs/PLAN.md` y las "Notas para la próxima sesión" de la sesión anterior.
2. Haz **exactamente ese alcance**. Lo que no quepa, anótalo; no lo improvises.
3. Antes de terminar, deben pasar `npm run build` y `npm test`.
4. Actualiza `docs/PLAN.md`: marca la sesión en la tabla de estado y escribe "Notas para la próxima sesión" (decisiones, pendientes, assets faltantes).
5. Commits pequeños en español (`feat: salto con coyote time`). Descripción del PR en español: qué cambió, **cómo probarlo** (URL con parámetros de depuración) y qué falta.

## Reglas de presupuesto

- No explores todo el repo: usa la estructura de abajo y lee solo lo necesario.
- No reescribas módulos que funcionan, salvo que la sesión lo pida.
- No agregues dependencias fuera del stack del GDD (§11.1) sin justificarlo en el PR.
- Si una herramienta no se instala o algo bloquea después de 2 intentos, documéntalo y verifica de otra forma.
- Si un problema se resuelve cambiando datos (`config/`, `data/`), prefiere eso a cambiar lógica.
- No escribas JSON de Tiled a mano: los niveles se escriben en ASCII (`tools/levels/*.txt`) y se generan con `npm run maps` (GDD §11.7).
- Verifica solo con `npm run build`, `npm test` y `npm run smoke`. Nada de pruebas manuales con navegador ni capturas de pantalla, salvo que el smoke falle (ahí sí, para diagnosticar).
- No leas ni explores archivos que no vas a modificar.
- Omití lo opcional salvo que la sesión lo pida explícitamente: por ejemplo, el mapa del mundo lleva fondo liso (sin Natural Earth) hasta que haya una ilustración real (GDD §8.4/ASSETS §7).
- Si algo no crítico falla o queda incompleto, anótalo en "Notas para la próxima sesión" en vez de perseguirlo.

## Comandos

- `npm run dev`: servidor local (Vite)
- `npm run build`: `tsc --noEmit` + `vite build` (debe pasar siempre)
- `npm test`: Vitest (lógica pura)
- `npm run maps`: `tools/levels/*.txt` → `public/assets/maps/*.json`
- `npm run sprites`: `raw/` → `public/assets/sprites/` (ver `docs/ASSETS.md`)
- `npm run smoke`: prueba de humo con navegador headless (si está disponible)
- `npm run preview`: sirve `dist/`

## Phaser 4 (¡no es Phaser 3!)

- Antes de usar una API que no domines, consulta `node_modules/phaser/skills/` (skills oficiales de Phaser 4, si vienen en el paquete) y los tipos en `node_modules/phaser/types/phaser.d.ts`.
- Cambios que rompen código escrito "a lo Phaser 3":
  - FX y máscaras → sistema unificado de **filters** (Glow, Blur, Mask…).
  - `setTintFill()` → `setTint()` + `setTintMode()`.
  - `Geom.Point` → `Vector2`. `BitmapMask` → filtro Mask. Pipelines → render nodes. `Mesh` y `Plane` eliminados.
  - Iluminación: `sprite.setLighting(true)`.
- Escenas, Arcade Physics, tilemaps, input, tweens y audio funcionan como en v3 en lo esencial.

## Estructura

```
src/main.ts               config de Phaser (GDD §11.3)
src/config/gameplay.ts    TODOS los parámetros de sensación (GDD §3.4)
src/data/                 levels, enemies, bosses, dialogues, story
src/i18n/                 es.ts, en.ts (completos), lang.ts, index.ts → t('clave')
src/assets/manifest.ts    lista única de assets
src/scenes/               Boot, Preload, Title, Story, WorldMap, Level, UI, Pause, Credits
src/entities/             Player, enemies/, bosses/ (un archivo por jefe), pickups/, hazards/
src/systems/              Save, Audio, Input, Dialogue, Camera, StatusEffects, EventBus
tools/                    sprites.mjs, build-maps.mjs, make-placeholder-tiles.mjs, levels/*.txt
public/assets/            sprites, tiles, maps, backgrounds, portraits, ui, fonts, audio
raw/                      originales del autor (NO editar)
tests/                    Vitest
```

## Convenciones de código

- TypeScript estricto. **Identificadores en inglés; comentarios breves en español.**
- Nada de números mágicos: todo número de sensación va en `src/config/gameplay.ts`.
- Datos (niveles, enemigos, jefes, diálogos) en `src/data/`. Ningún texto visible escrito en las escenas: siempre `t('clave')`.
- Toda clave nueva va en `src/i18n/es.ts` **y** en `src/i18n/en.ts` (el build falla si falta en inglés; el test compara claves y `{marcadores}`). Los nombres guaraníes no se traducen.
- Máquinas de estado explícitas para Kerana, enemigos y jefes.
- El jugador lee **acciones** de `InputManager` (left, right, jump, attack, dash, pause), nunca teclas directas.
- Comunicación Level ↔ UI con `EventBus`, sin referencias cruzadas entre escenas.
- Pools para proyectiles y partículas; nada de asignar objetos en cada frame.
- IDs sin tildes ni ñ: `teju_jagua`, `mboi_tui`, `monai`, `jasy_jatere`, `kurupi`, `ao_ao`, `luison`, `tau`; enemigos según GDD §5.3.

## Mapas (GDD §11.7)

- Fuente ASCII en `tools/levels/<id>.txt` → `npm run maps` → Tiled JSON en `public/assets/maps/`.
- Tiled: tiles de 16 px, capas en CSV, **tilesets incrustados**, rutas de imagen relativas.
- Capas: `Background`, `Ground`, `Platforms` (un solo sentido), `Hazards`, `Water`, `Foreground` y el grupo de objetos `Objects`.
- La clase de un objeto puede venir en `type` o en `class`: lee ambos.
- Nada que haya que saltar (postes, muros, escalones) puede medir más de 3 tiles, salvo que el nivel ofrezca otro camino: el salto llega a unos 4.
- Si `levels.ts` dice `mapSource: 'tiled'`, el autor editó ese mapa en Tiled: **no lo regeneres desde el ASCII**.

## Assets

- **Vista y detalle:** el mundo es de 640 × 360 unidades y el lienzo de 1280 × 720 (zoom 2 con `setupView`, `src/systems/View.ts`; usa `VIEW`, no `this.scale`). `detail` en `sprite.json` = píxeles de arte por unidad: **Kerana, los jefes y los enemigos, 2**; tiles, 1. Hitboxes y efectos, siempre en unidades del mundo (GDD §9.2, §11.3; ASSETS §2).
- `raw/` son originales (exportaciones de Grok): nunca los edites; procésalos con `npm run sprites`.
- Si un asset no existe todavía, `PreloadScene` genera un placeholder y avisa en consola con `[ASSET FALTANTE] clave`. El juego nunca se rompe por un asset ausente.
- Lista los assets faltantes en la descripción del PR.
- Todo asset de terceros se registra en `CREDITS.md` (autor, URL, licencia).

## Depuración
Parámetros de URL (en dev o con `?debug=1`): `debug=1` (hitboxes, FPS, estado de Kerana), `level=test|1..7`, `boss=1` (empieza en la antesala del jefe), `gifts=all`, `god=1`. `lang=en|es` funciona siempre (sin `debug=1`) y se guarda.
El juego define `window.__KERANA_READY__ = true` cuando la primera escena jugable está lista.

## Git y GitHub

- **Nunca crees ni modifiques archivos en `.github/workflows/`.** El autor los gestiona; el token de la sesión puede no tener permiso de workflows y el push completo fallaría.
- Commitea `package-lock.json`. No commitees `node_modules/`, `dist/` ni capturas temporales (`tmp/`).
- Una sesión = una rama = un PR.

## Verificación

- Vitest para lógica pura (máquinas de estado, daño, guardado, umbrales de fase, parser ASCII, claves i18n).
- Si hay Chrome o Chromium headless (por ejemplo vía Puppeteer), `npm run smoke`: abre el build, espera `__KERANA_READY__` y falla si hay errores en consola. Puedes guardar capturas en `tmp/screenshots/` y revisarlas. Si el navegador no se instala en 2 intentos, sigue sin él.
- Claude no puede "sentir" el juego: deja los valores de sensación en `gameplay.ts` para que el autor los ajuste.

## Contenido

- Público de 10 años en adelante. Sin gore ni contenido sexual. Los enemigos no mueren: se purifican (la marca de Tau se rompe).
- Representación respetuosa de la cultura guaraní (GDD §2.8). Los diálogos usan voseo paraguayo (GDD §2.7).

## Compact instructions
Al compactar, conserva: la sesión en curso de `docs/PLAN.md` y sus criterios de aceptación, los archivos modificados, las decisiones tomadas y los pendientes.
