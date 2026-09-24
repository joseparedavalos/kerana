# Assets de Kerana: especificación y checklist

Este documento dice **qué** arte y sonido necesita el juego, **cómo** generarlo o conseguirlo y **dónde** va cada archivo. El juego funciona con placeholders desde el primer día: el arte se puede ir sumando en cualquier momento.

---

## 1. Reglas generales

- **Escala única:** 1 píxel del arte = 1 píxel del juego (resolución interna 640 × 360; tiles de 16 × 16). Tamaños finales en GDD §9.2.
- **Formato:** PNG con transparencia. Música en MP3.
- **Nombres:** minúsculas, sin tildes ni ñ, con guion bajo (`teju_jagua`, `luz_arasy`).
- **Carpetas:**
  - `raw/`: tus originales tal como salen de Grok u otra herramienta. **No se editan.**
  - `public/assets/`: lo que carga el juego (lo genera el pipeline o lo copias ya listo).
- **Licencias:** todo asset de terceros se anota en `CREDITS.md` (autor, URL, licencia). Revisa también los términos de uso comercial de las herramientas de IA que uses **[Revisar]**.

---

## 2. Pipeline de sprites (`npm run sprites`)
Lo construye Claude en la sesión S3. Convierte las hojas de Grok en sprites listos para el juego.

### 2.1 Cómo entregar los archivos
Guarda cada hoja (la imagen **SHEET** de Grok) así:

```
raw/<personaje>/<animación>_<columnas>x<filas>.png
```
Ejemplos:

```
raw/kerana/idle_5x2.png      ← 5 columnas × 2 filas = 10 frames
raw/kerana/run_5x2.png
raw/kerana/jump_5x2.png
raw/kerana/attack_5x2.png
raw/kerana/hurt_5x1.png
```
Para jefes con partes separadas, usa una subcarpeta por parte: `raw/teju_jagua/head/idle_5x2.png` → sprite `teju_jagua_head`.

### 2.2 Qué hace el pipeline

1. Quita el fondo (transparente o magenta #FF00FF si usaste Chroma key).
2. Corta la hoja según `<columnas>x<filas>`.
3. **Escala por hoja, no por frame:** mide la altura del frame de pie (`ref` en `sprite.json`) y la lleva a `height` (Kerana: 46 px). Así Kerana mide lo mismo aunque Grok haya generado cada hoja a distinta escala.
4. **Alinea los pies:** el borde inferior de cada frame va a la última fila del frame de salida (sin temblor). En X alinea la **cintura** (promedio de la banda del 35 al 50 % de la altura), así la estela del sable no empuja el cuerpo; `"anchor": "cell"` usa el centro de la celda.
5. Reduce con "moda" (cada píxel toma el color más frecuente de su bloque): colores nítidos sin borrones. Informa el tamaño aparente del "píxel" del arte; con `"snapPixel": true` usa ese tamaño como escala exacta (solo si todas las hojas lo comparten).
6. Empaqueta todo en `public/assets/sprites/<personaje>.png` (grilla de frames iguales, se carga como spritesheet) + `.json` con las animaciones `<personaje>_<animación>`, que `PreloadScene` registra solo. Imprime un resumen (frames, escala, tamaño final).
7. Subcarpetas por parte: `raw/<id>/<parte>/` → `sprites/<id>_<parte>.png`. `raw/backgrounds/*.png` → `backgrounds/` a 360 px de alto; `raw/portraits/*.png` → `portraits/` a 96 × 96 (recorte central).

Solo usa `pngjs` (JavaScript puro): funciona igual en la nube y en Windows. Tarda unos segundos con las hojas de Grok.

### 2.3 Ajustes: `raw/<personaje>/sprite.json`
Ejemplo real (`raw/kerana/sprite.json`). Los índices empiezan en **0** (el frame 1 de la hoja es el 0):

```json
{
  "frame": [64, 64],
  "height": 46,
  "sheets": { "idle": { "ref": 1 }, "run": { "ref": 0 }, "jump": { "ref": 0 }, "attack": { "ref": 0 } },
  "anims": {
    "idle":   { "frames": [1, 4], "fps": 6, "loop": true },
    "blink":  { "source": "idle", "frames": [5, 7], "fps": 10 },
    "run":    { "frames": [1, 9], "fps": 12, "loop": true },
    "jump":   { "frames": [4, 5], "fps": 10 },
    "fall":   { "source": "jump", "frames": [6, 7], "fps": 8, "loop": true },
    "land":   { "source": "jump", "frames": [8, 8], "fps": 12 },
    "attack": { "frames": [4, 7], "fps": 14 },
    "hurt":   { "source": "jump", "list": [6], "fps": 1 }
  }
}
```
- `sheets.<hoja>.ref`: frame de pie que define la escala de esa hoja; `anchor`: `"waist"` (por defecto) o `"cell"`.
- `frames: [desde, hasta]` usa solo parte de la hoja; `list: [..]` elige frames sueltos; `source` saca la animación de otra hoja; `skip: true` no la registra.
- Kerana usa: `idle` (con `blink` ocasional), `run`, `jump` (sin la preparación agachada: salto inmediato), `fall`, `land` (breve, al aterrizar quieta), `attack` (≈ 280 ms) y `hurt`. El destello de daño, el parpadeo de invulnerabilidad y el brillo de carga se hacen por código (`src/entities/Player.ts`, valores en `GAMEPLAY.playerFx`).
- Si cambiás algo, corré `npm run sprites` y recargá el juego.

---

## 3. Personajes con Grok ("Character Sprite")

### 3.1 Configuración (siempre igual)

- **Art style:** Pixel Art, siempre el mismo para todo el juego.
- **Background:** Transparent. Si los bordes salen sucios, usa **Chroma key** (magenta).
- **Reference image:** genera primero el **Idle** de cada personaje y úsalo como referencia para sus otras animaciones.
- **Notes** (pega esto en todos):
  ```
  Keep the exact same character design, colors and proportions in every frame.
  Character centered, feet on the same baseline in every frame.
  No ground shadow, no background, no text, no watermark.
  ```
- **Descarga** la imagen **SHEET**, cuenta columnas × filas y nómbrala según §2.1.

### 3.2 Kerana (`raw/kerana/`) [MVP]
**Character:**

Diseño aprobado (GDD §3.1): guaraní del Paraguay, sin plumas ni pintura facial, pelo negro lacio y largo, vincha tejida café y beige, tipoi beige crema con guarda café, collar de semillas blancas y cafés, descalza, sable dorado.

```
A young Guaraní woman from Paraguay, heroine of a 2D platformer, warm light tan
skin (#D4A07A), round face with dark almond-shaped eyes and typical Indigenous
South American Guaraní features, long straight silky black hair falling down her
back (smooth, not braided, not curly), a woven headband with a small brown and
beige geometric pattern, a simple loose sleeveless tipoi dress in natural undyed
cream-beige cotton (#E8D8BE) with a thin brown geometric border (#8B5A3C) at the
hem, reaching the knees, a necklace of small white and brown seeds, a simple
bracelet, barefoot, holding a curved saber whose blade glows with warm golden
light, brave and kind expression, side view facing right, full body, clean
readable silhouette, earthy limited color palette, 16-bit pixel art
```
**Agrega a Notes:**

```
Not a North American Native costume: no war bonnet, no buckskin fringe, no totem motifs.
```
**Animaciones:** Idle · Run · Jump · Attack. `hurt` no necesita hoja: se hace por código (destello rojo/blanco, parpadeo y retroceso sobre un frame de `jump`, ver §2.3).

### 3.3 Mainumby (`raw/mainumby/`) [Núcleo]

```
A tiny hummingbird with iridescent green and turquoise feathers and a soft golden
glow, hovering with blurred wings, side view facing right, cute 2D game companion,
very small, 16-bit pixel art
```
**Animaciones:** Idle (vuelo en el sitio).

### 3.4 Jefes
Todos **miran a la izquierda**. Agrega a Notes: `Spooky but not gory: no blood.`

| Jefe | Carpeta | Character (prompt) | Animaciones | Notas |
|---|---|---|---|---|
| Teju Jagua | `raw/teju_jagua/head/` | `The head of a fierce dog with glowing fire-red eyes, attached to a long thick green scaly lizard neck, emerging from darkness, side view facing left, 2D boss part sprite, 16-bit pixel art` | Idle · Attack (mordida) · Hurt | Solo la cabeza con cuello: el juego la tiñe de 7 colores. El cuerpo es una silueta de fondo (§5) |
| Mbói Tu'i | `raw/mboi_tui/` | `A giant serpent with the head of a parrot, huge hooked beak, blood-red forked tongue, green and yellow feathers on the head, veined green scales, rising out of swamp water with only head and upper body visible, side view facing left, 2D boss sprite, 16-bit pixel art` | Idle · Attack · Hurt | Pose extra "graznando con el pico abierto" (genérala como Attack con otra descripción) |
| Moñái | `raw/monai/` | `A giant green serpent with two long straight iridescent horns like antennae, hypnotic glowing eyes, hanging from a tree branch, side view facing left, 2D boss sprite, 16-bit pixel art` | Idle (colgando) · Attack (caída) · Hurt | |
| Jasy Jatere | `raw/jasy_jatere/` | `A small mischievous forest spirit child with golden blond hair and very pale skin, holding a shiny golden staff in his right hand, playful sly smile, simple light clothes, side view facing left, small 2D boss sprite, 16-bit pixel art` | Idle · Run · Attack (chispas con el bastón) · Hurt | Variante `raw/jasy_jatere/nostaff/`: el mismo niño sin bastón, sorprendido y a punto de llorar |
| Kurupi | `raw/kurupi/` | `A short stocky forest creature with dark skin, wiry wild hair and beard, a big mouth with a mischievous grin, glowing yellow eyes, feet turned backwards, wearing a simple leaf loincloth, side view facing left, 2D boss sprite, 16-bit pixel art` | Idle · Run · Attack (pisotón o silbido) · Hurt | Si eliges la versión 100 % Colmán, quita `feet turned backwards` |
| Ao Ao | `raw/ao_ao/` | `A ferocious beast with a thick shaggy sheep-like woolly body, a fierce bear-like head, huge fangs and claws, glowing red eyes, charging on four legs, side view facing left, large 2D boss sprite, 16-bit pixel art` | Run (4 patas) · Idle · Attack (erguido en dos patas, zarpazo) · Hurt | |
| Luisón | `raw/luison/` | `A gaunt dog-headed night creature with a long row of sharp teeth, small ears, a dry emaciated body, limbs half human and half claws, pale glowing eyes, hunched posture, side view facing left, 2D final boss sprite, 16-bit pixel art` | Idle · Run · Attack (lanzar) · Hurt | Pose extra "aullando sobre una lápida" |
| Tau [Extra] | `raw/tau/` | Disfraz: `A handsome young man with long dark hair holding a wooden flute, elegant but sinister smile, side view facing left, 2D boss sprite, 16-bit pixel art` · Forma real: `A shadowy evil spirit made of dark violet smoke with glowing red eyes and long smoky claws, side view facing left, large 2D boss, 16-bit pixel art` | Idle · Attack · Hurt | Dos carpetas: `disguise/` y `true/` |

### 3.5 Enemigos
Agrega al final de cada prompt:

```
, marked by a curse: a glowing violet spiral mark on its body and faint violet eyes,
side view facing left, small 2D platformer enemy, 16-bit pixel art
```

| Id | Carpeta | Descripción (inicio del prompt) | Animaciones | Frame | Se necesita en |
|---|---|---|---|---|---|
| `teju_i` | `raw/teju_i/` | `A small green and brown lizard` | Walk | 32 × 32 | S6 |
| `mbopi` | `raw/mbopi/` | `A small dark brown bat with spread wings` | Idle (vuelo) | 32 × 32 | S6 |
| `jakare` | `raw/jakare/` | `A yacare caiman` | Walk · Attack (mordida) | 64 × 32 | S7 |
| `nakurutu` | `raw/nakurutu/` | `A great horned owl` | Idle (posado) · Attack (picada) | 48 × 48 | S7 |
| `mboi` | `raw/mboi/` | `A small green snake` | Walk | 48 × 48 | S7 |
| `nandu` | `raw/nandu/` | `A greater rhea running` | Run | 64 × 64 | S8 |
| `karakara` | `raw/karakara/` | `A southern crested caracara bird` | Idle (vuelo) · Attack (picada) | 48 × 48 | S8 |
| `jagua` | `raw/jagua/` | `A scruffy but lovable street dog` | Run · Attack (ladrido) | 64 × 64 | S9 |
| `kuati` | `raw/kuati/` | `A coati with a ringed tail` | Run · Jump | 48 × 48 | S10 |
| `kai` | `raw/kai/` | `A small brown capuchin monkey holding a fruit` | Idle · Attack (lanzar) | 48 × 48 | S10 |
| `taitetu` | `raw/taitetu/` | `A collared peccary` | Run | 64 × 64 | S11 |
| `ao_ao_cria` | `raw/ao_ao_cria/` | `A small woolly sheep-like cub with tiny fangs` | Run | 48 × 48 | S11 |
| `pora` | `raw/pora/` | `A translucent pale green ghost with a sad face and a wispy tail` | Idle (flotando) | 48 × 48 | S12 |
| `jagua_hu` | `raw/jagua_hu/` | `A black dog with glowing eyes` | Run | 64 × 64 | S12 |
| `abejas` | — | Hechas con partículas por código | — | — | S9 |

---

## 4. Retratos de diálogo [Núcleo]
Con Grok Imagine normal (no el template de sprites). Tamaño final 96 × 96 (el pipeline reduce).

```
16-bit pixel art portrait, head and shoulders, facing right, [descripción],
plain dark blue background (#1B1A2E), no text
```
Lista (en `raw/portraits/`): `kerana_neutral`, `kerana_sad`, `kerana_determined`, `mainumby`, los siete hijos **ya liberados** (expresión serena, con un brillo suave): `teju_jagua`, `mboi_tui`, `monai`, `jasy_jatere`, `kurupi`, `ao_ao`, `luison`, y `tau` (sombra).

---

## 5. Fondos por nivel (parallax) [Núcleo; MVP: solo la capa lejana]

- Por nivel: `raw/backgrounds/l<N>_far.png`, `l<N>_mid.png` y `l<N>_near.png`. El pipeline los escala a 360 px de alto → `public/assets/backgrounds/`.
- **Capa lejana** (cielo y horizonte), prompt base:
  ```
  16-bit pixel art side-scrolling game background, wide panoramic, [escena],
  no characters, no text
  ```
- **Capas media y cercana:** la misma escena, "only silhouettes of [elementos], on a flat magenta background (#FF00FF)".

| Nivel | Escena de la capa lejana |
|---|---|
| 1 | `dawn sky with pink and violet clouds over green forested hills of Paraguarí, Paraguay, distant rounded mountains` |
| 2 | `sunset over the wetlands of Ñeembucú, Paraguay, water reflections, reeds, water hyacinths with lilac flowers, orange sky` |
| 3 | `noon over open grasslands of Misiones, Paraguay, golden grass, red earth, termite mounds, clumps of forest, intense blue sky` |
| 4 | `siesta time in an old colonial town in Paraguay, whitewashed houses with red tile roofs and verandas, a pink lapacho tree in bloom, harsh midday sun, empty street` |
| 5 | `dense Atlantic rainforest of eastern Paraguay in the rain, giant trees, lianas, mist, filtered green light` |
| 6 | `stormy dusk over the Ybytyruzú mountains of Guairá, Paraguay, rocky ridges, highland grass, pindó palm trees, lightning` |
| 7 | `midnight in an old historic cemetery in Asunción, Paraguay, marble mausoleums and stone angels, full moon behind clouds, fog` |

**Arena de Teju Jagua:** además, `raw/backgrounds/l1_boss_body.png`, con la silueta del cuerpo enorme en la penumbra: `a colossal lizard body in a dark cave full of gold and crystals, seen from the side, heads hidden in shadow, 16-bit pixel art`.

---

## 6. Tilesets [Núcleo; mientras tanto, placeholders por código]

- Tiles de 16 × 16. Un PNG por bioma en `public/assets/tiles/<bioma>.png`: `cerro`, `estero`, `campo`, `pueblo`, `selva`, `montana`, `ciudad`.
- **Contenido mínimo:** suelo (relleno y bordes) · plataforma de un solo sentido (izquierda, centro, derecha) · peligro (espinas o karaguatá) · agua (superficie y fondo, donde haga falta) · variante agrietada · decoración (pasto, flores, piedras).
- **Orden para autotile (opcional pero recomendado):** las 16 variantes del suelo en una grilla de 4 × 4 al inicio del tileset. Para cada tile, se suman los vecinos que también son suelo: arriba = 1, derecha = 2, abajo = 4, izquierda = 8. La suma es la posición en la grilla (fila = suma ÷ 4, columna = resto). Ejemplo: superficie con suelo a los lados y debajo = 2 + 4 + 8 = 14. Si tu tileset viene en otro orden, un pequeño `raw/tiles/<bioma>.json` puede traducir posiciones y el pipeline lo reordena.
- **De dónde sacarlos:**
  - **Kenney** (kenney.nl): licencia CC0, libre para cualquier uso.
  - **itch.io** y **OpenGameArt**: revisa la licencia de cada pack (uso comercial, atribución).
  - **IA:** suele fallar en que los tiles empalmen; mejor úsala para decoración.
  - **Cambio de paleta:** un tileset base recoloreado por bioma (el pipeline puede hacerlo). Es la forma más barata de tener 7 biomas coherentes.

---

## 7. Interfaz [MVP con placeholders por código]

| Asset | Archivo | Tamaño |
|---|---|---|
| Corazón lleno y vacío | `ui/heart_full.png`, `ui/heart_empty.png` | 12 × 12 |
| Pluma (HUD, color y gris) | `ui/feather.png`, `ui/feather_empty.png` | 12 × 12 |
| Icono Luz de Arasy | `ui/luz_arasy_icon.png` | 16 × 16 |
| Pickups (animados, 4 frames) | `sprites/pickups.png`: guavirá, luz_arasy, pluma, yvoty | 16 × 16 |
| Fuego apagado y encendido (4 frames) | `sprites/checkpoint.png` | 16 × 24 |
| Farol apagado y encendido | `sprites/lantern.png` | 16 × 32 |
| Camalote, hongo, rama, teja | `sprites/props.png` | 48 × 16 · 32 × 16 · 48 × 8 · 16 × 8 |
| Marca de Tau (efecto) | `ui/tau_mark.png` | 16 × 16 |
| Marco de diálogo (9-slice) y barra de jefe | `ui/dialog_frame.png`, `ui/boss_bar.png` | — |
| Botones táctiles (saltar, atacar, dash, pausa) y cruceta | `ui/touch_*.png` | 32 × 32 · 64 × 64 |
| Logo "KERANA" + subtítulo | `ui/logo.png` | ≈ 320 × 96 |
| Mapa del mundo | `ui/world_map.png` | 640 × 360 |

**Mapa del mundo:** el contorno del Paraguay puede salir de datos de **Natural Earth** (dominio público; su repositorio está en GitHub) y los nodos se ubican con las coordenadas del GDD §8.4. Encima puedes pintar o generar un estilo "pergamino".

---

## 8. Tipografía [MVP]

- Una fuente pixel para títulos e interfaz y, si hace falta, otra más legible para diálogos.
- **Debe mostrar:** ñ, á é í ó ú, ã ẽ ĩ õ ũ ỹ y el puso ('). Frase de prueba: *"Mbói Tu'i, Yvy Marane'ỹ, ñe'ẽ, Ñeembucú, Paraguarí"*.
- Licencia OFL. Archivos en `public/assets/fonts/`.

---

## 9. Audio

- **Música** (`public/assets/audio/music/*.mp3`, 128 kbps):
  - MVP: `title.mp3`, `level.mp3` (genérica), `boss.mp3`.
  - Núcleo: `l1.mp3` a `l7.mp3`, `liberation.mp3` (5 a 8 s), `ending.mp3`.
  - Dirección musical en GDD §10.1.
- **De dónde sacarla:** bibliotecas libres de derechos (revisa uso comercial y atribución), generadores de música con IA (revisa la licencia del plan que uses), o un músico local: un arpa paraguaya real le daría mucha identidad.
- **Efectos:** al principio, generados por código con ZzFX (sin archivos). Para reemplazarlos: Kenney (packs de audio CC0) o freesound.org (revisa la licencia de cada sonido).

---

## 10. Checklist

| Asset | Prioridad | Se necesita en | Estado |
|---|---|---|---|
| Kerana: Idle, Run, Jump, Attack, Hurt | MVP | S3 | ☐ |
| Mainumby | Núcleo | S4 | ☐ |
| Fuentes (con prueba de caracteres) | MVP | S4 | ☐ |
| 3 pistas de música (title, level, boss) | MVP | S5 | ☐ |
| Teju Jagua (cabeza) + silueta del cuerpo | MVP | S6 | ☐ |
| teju_i, mbopi | MVP | S6 | ☐ |
| Mbói Tu'i + jakare, nakurutu, mboi | MVP | S7 | ☐ |
| Moñái + nandu, karakara | MVP | S8 | ☐ |
| Jasy Jatere (+ sin bastón) + jagua | MVP | S9 | ☐ |
| Kurupi + kuati, kai | MVP | S10 | ☐ |
| Ao Ao + taitetu, ao_ao_cria | MVP | S11 | ☐ |
| Luisón + pora, jagua_hu | MVP | S12 | ☐ |
| Tilesets (7 biomas) | Núcleo | S13 | ☐ |
| Fondos: capa lejana (7) | MVP | S13 | ☐ |
| Fondos: capas media y cercana (14) | Núcleo | S13 | ☐ |
| Retratos (13) | Núcleo | S13 | ☐ |
| Logo y mapa del mundo | Núcleo | S13 | ☐ |
| Iconos y props de interfaz | Núcleo | S13 | ☐ |
| Música de niveles (7), liberación y final | Núcleo | S13 | ☐ |
| Tau (disfraz y forma real) | Extra | Reserva | ☐ |

Si un asset no está listo cuando llega su sesión, **no pasa nada**: Claude usa un placeholder y lo anota. Se integra después (S13).
