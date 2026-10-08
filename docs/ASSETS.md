# Assets de Kerana: especificación y checklist

Este documento dice **qué** arte y sonido necesita el juego, **cómo** generarlo o conseguirlo y **dónde** va cada archivo. El juego funciona con placeholders desde el primer día: el arte se puede ir sumando en cualquier momento.

---

## 1. Reglas generales

- **Escala:** vista lógica de 640 × 360 unidades; tiles de 16 × 16. `detail` = píxeles de arte por unidad del mundo: **Kerana y los jefes, 2**; enemigos chicos y tiles, 1 (ver §2.3 y GDD §9.2).
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
3. **Escala por hoja, no por frame:** mide la altura del frame de pie (`ref` en `sprite.json`) y la lleva a `height` (en píxeles de textura; Kerana: 92 px con detail 2 = 46 unidades). Así Kerana mide lo mismo aunque Grok haya generado cada hoja a distinta escala.
4. **Alinea los pies:** el borde inferior de cada frame va a la última fila del frame de salida (sin temblor). En X alinea la **cintura** (promedio de la banda del 35 al 50 % de la altura), así la estela del sable no empuja el cuerpo; `"anchor": "cell"` usa el centro de la celda.
5. Reduce con "moda" (cada píxel toma el color más frecuente de su bloque): colores nítidos sin borrones. Informa el tamaño aparente del "píxel" del arte; con `"snapPixel": true` usa ese tamaño como escala exacta (solo si todas las hojas lo comparten).
6. Empaqueta todo en `public/assets/sprites/<personaje>.png` (grilla de frames iguales, se carga como spritesheet) + `.json` con las animaciones `<personaje>_<animación>`, que `PreloadScene` registra solo. Imprime un resumen (frames, escala, tamaño final).
7. Subcarpetas por parte: `raw/<id>/<parte>/` → `sprites/<id>_<parte>.png`. `raw/backgrounds/*.png` → `backgrounds/` a 360 px de alto; `raw/portraits/*.png` → `portraits/` a 96 × 96 (recorte central).
8. **Props e íconos (S13d):** `raw/props/*.png` → `props/<nombre>.png` y `raw/hud/*.png|jpg` → `ui/<nombre>.png`. Una imagen por archivo (sin hojas): quita el fondo, borra el borde de color del contorno, recorta al dibujo y escala por moda a `size × detail` píxeles (ver abajo).

Solo usa `pngjs` y `jpeg-js` (JavaScript puro): funciona igual en la nube y en Windows. Tarda unos segundos con las hojas de Grok.

### 2.3 Ajustes: `raw/<personaje>/sprite.json`
Ejemplo real (`raw/kerana/sprite.json`). Los índices empiezan en **0** (el frame 1 de la hoja es el 0):

```json
{
  "detail": 2,
  "frame": [128, 128],
  "height": 92,
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
- `detail` (1 por defecto): píxeles de textura por unidad del mundo; se copia al `.json` de salida y el juego dibuja el sprite a escala 1/detail. `frame` y `height` van en píxeles de textura. **Regla:** Kerana, los jefes y los enemigos, `detail: 2` (el doble de detalle); tiles, `detail: 1`. Hitbox, ataque y efectos no cambian: se miden en unidades del mundo (`gameplay.ts`).
- `sheets.<hoja>.ref`: frame de pie que define la escala de esa hoja; `anchor`: `"waist"` (por defecto) o `"cell"`.
- `frames: [desde, hasta]` usa solo parte de la hoja; `list: [..]` elige frames sueltos; `source` saca la animación de otra hoja; `skip: true` no la registra.
- Kerana usa: `idle` (con `blink` ocasional), `run`, `jump` (sin la preparación agachada: salto inmediato), `fall`, `land` (breve, al aterrizar quieta), `attack` (≈ 280 ms) y `hurt`. El destello de daño, el parpadeo de invulnerabilidad y el brillo de carga se hacen por código (`src/entities/Player.ts`, valores en `GAMEPLAY.playerFx`).
- `greenEdge: true` borra el borde verde que deja el Chroma key, solo en los píxeles del contorno (Tau), en 3 pasadas; un número (`"greenEdge": 5`) da esas pasadas (borde más grueso). También va por hoja (`sheets.<hoja>.greenEdge`). No lo uses en personajes verdes de verdad (Mainumby, Mbói Tu'i, Moñái, Kurupi, Jasy Jatere, teju'i, mbói, mbói colgante, jakare).
- `sheets.<hoja>.align`: `"top"` lleva lo más alto del dibujo a la primera fila del frame (en vez de los pies a la última; póra, mbói colgante); `"cell"` conserva la posición del dibujo dentro de su celda: todos los cuadros de la hoja usan la misma ancla, el centro de abajo de la unión de sus cajas (aleteo de Mainumby, que sube y baja en la hoja).
- `sheets.<hoja>.cropBottom: n` borra las `n` filas de abajo de cada celda (píxeles de origen) antes de medir: quita una rama o un suelo dibujado bajo el personaje (ñakurutu).
- **Jefes y Mainumby (S13b):** cada uno con su `sprite.json` (detail 2, `height` = la altura de su placeholder). Si `frame` cambia, actualizá `CHARACTER_SPRITES` en `src/assets/manifest.ts`. En el juego, `SpriteSkin` (`src/systems/SpriteSkin.ts`) dibuja el sprite encima del placeholder, que deja de verse pero sigue llevando la lógica y la hitbox; el encuadre (`origin`) está en `GAMEPLAY.sprites`.
- **Enemigos y vaca (S13c):** una hoja por enemigo (`<id>_walk`, `_run`, `_idle` o `_hang`), detail 2, frame en `ENEMY_SPRITES` (`manifest.ts`). `EnemyBase` y `Cow` se visten con `SpriteSkin` (`sourceFacesRight: true`: las hojas miran a la izquierda); quietos, los de walk/run muestran el cuadro 0. Sin sprite: abejas y los de prueba (walker, charger, flyer).
- `greenEdgeMargin` (por defecto 30): cuánto más verde que rojo y azul tiene que ser un píxel del contorno para borrarlo. Más bajo toma también los verdes oliva que deja el Chroma key al mezclarse con el contorno (vaca: `"greenEdge": 6, "greenEdgeMargin": 12`; el pasto de la boca queda más fino).
- **Props e íconos (S13d):** `raw/props/sprite.json` y `raw/hud/sprite.json`:

```json
{ "detail": 2, "edge": "cyan", "edgePasses": 2, "coverage": 0.4,
  "size": { "sign": { "height": 22 }, "fire_off": { "width": 20 }, "default": { "height": 12 } } }
```
  - `size.<nombre>` (o `size.default`): `height` o `width` en **unidades del mundo** (la textura mide eso × `detail`; el juego la dibuja a 1/detail, `ART_DETAIL` en `manifest.ts`).
  - `edge`: color del borde del Chroma key a borrar del contorno (`"cyan"` en los props de Grok con fondo transparente, `"magenta"` en los JPG), en `edgePasses` pasadas. `tolerance`: distancia al magenta para el fondo (90 por defecto; los JPG lo dejan desparejo: 140). `coverage`: cobertura mínima de cada bloque al reducir (0,5 por defecto; más baja conserva contornos finos en diagonal, como el corazón vacío).
  - En el juego: `ART_IMAGES` en `manifest.ts` (`ui_*`, `prop_*`) y `artOrPlaceholder` (`src/assets/art.ts`): si falta un archivo, cada uso dibuja su placeholder.
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
| Tau (jefe final) | `raw/tau/disguise/` y `raw/tau/true/` | Disfraz: `A handsome young man with long dark hair holding a wooden flute, elegant but sinister smile, side view facing left, 2D boss sprite, 16-bit pixel art` · Forma real: `A shadowy evil spirit made of dark violet smoke with glowing red eyes and long smoky claws, side view facing left, large 2D boss, 16-bit pixel art` | Idle · Attack (flauta / garras de humo) · Hurt | Dos carpetas: `raw/tau/disguise/` (el joven de la flauta, fases 1 y 2, detail 2) y `raw/tau/true/` (humo violeta con ojos rojos, fase 3, detail 2). Hasta que existan, placeholder por código en `Tau.ts` |

**Teju Jagua por código (S13d, S20):** el lomo, las patas, la cola y los cuellos se dibujan en `tejuJaguaArt.ts`. S20: el cuerpo se dibuja a `bodySize` (0,65) del tamaño de S13d, ya achicado en la textura (con `pixelArt` no se escala la imagen); cuellos de 18 de grosor; las cabezas dormidas se apoyan sobre el lomo. La onda del coletazo es una textura de tierra (cresta del tamaño de la hitbox con piedritas y polvo, estela de lomitas detrás) con polvo y piedritas en partículas; el aviso levanta polvo y abre una grieta que tiembla por el recorrido de la onda. Cabeza expuesta: halo dorado que late detrás y tres estrellitas de mareo encima (texturas `teju_jagua_halo` y `teju_jagua_star`, por código). S21: el aliento de fuego se dibuja en un `Graphics` cada frame (`FlameArt` en `tejuJaguaArt.ts`): cuerpo naranja del tamaño exacto de la zona de daño, chorros amarillos con núcleo casi blanco que salen de los hocicos y se abren al bajar, lenguas que fluyen hacia el suelo, desborde rojizo tenue a los costados, suelo iluminado, hebras de aire que tiembla y pavesas en partículas. Aviso: el suelo de la zona se tiñe desde abajo de las cabezas hasta los bordes, el aire de la zona brilla con los bordes marcados y sube calor; el humo de los hocicos sigue. Sin texturas nuevas.

**Moñái por código (S26):** `src/entities/bosses/monaiArt.ts`, con el criterio de Teju Jagua (texturas al doble de detalle, `ART_K` = 2). Cabeza de perfil mirando a la izquierda en tres texturas (`monai_head`, `monai_head_open` con fauces y colmillos mientras hace daño, `monai_head_daze` con el ojo cerrado) que llenan la zona de daño (26 × 18); cuernos aparte (`monai_horns`, color hueso con anillos: es lo que se tiñe iridiscente). Cuerpo dibujado cada frame en un `Graphics`: tubo que se afina hacia la cola con borde, vientre crema, manchas y brillo; en una copa se enrosca en el tronco y la vuelta de atrás va en otro `Graphics` detrás del tronco. Estrellitas de mareo y halo de los cuernos, por código. **El sprite `raw/monai/` (colgando, 72 × 128) ya no se usa**: obligaba a prolongar el cuello con una columna recta hasta fuera de la pantalla. Si se genera otro, que sea horizontal (cabeza sola o con un poco de cuello). Árboles de su arena, en el mismo archivo: tronco (`monai_tree_trunk_<i>`) y copa (`monai_tree_crown_<i>`) por árbol, con variación por semilla.

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
| `nandu` | `raw/nandu/` | `A greater rhea running` | Run | 64 × 64 (en el juego × 1,6, `GAMEPLAY.nandu.scale`, S26: del alto de Kerana) | S8 |
| `karakara` | `raw/karakara/` | `A southern crested caracara bird` | Idle (vuelo) · Attack (picada) | 48 × 48 | S8 |
| `jagua` | `raw/jagua/` | `A scruffy but lovable street dog` | Run · Attack (ladrido) | 64 × 64 | S9 |
| `kuati` | `raw/kuati/` | `A coati with a ringed tail` | Run · Jump | 48 × 48 | S10 |
| `kai` | `raw/kai/` | `A small brown capuchin monkey holding a fruit` | Idle · Attack (lanzar) | 48 × 48 | S10 |
| `taitetu` | `raw/taitetu/` | `A collared peccary` | Run | 64 × 64 | S11 |
| `ao_ao_cria` | `raw/ao_ao_cria/` | `A small woolly sheep-like cub with tiny fangs` | Run | 48 × 48 | S11 |
| `vaca` | `raw/vaca/` | `A calm skinny Paraguayan street cow, white with brown patches, small curved horns, walking slowly with its head low` | Walk · Idle (mugido, cabeza en alto) | 64 × 48 | S11 (extra N4) |
| `vaca_embrujada` | `raw/vaca_embrujada/` | `The same white and brown street cow but bewitched: glowing violet spiral mark on its forehead, red eyes, lowered horns, charging` | Run (embestida) · Attack (rasca el suelo) | 64 × 48 | S11 (extra N4) |
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
- **Desde S12e / S13a:** `raw/backgrounds/*.jpg` o `*.png` (1792 × 1008) → `npm run backgrounds` → `backgrounds/*.jpg` (calidad 85) a 1280 × 720, dibujados a escala 0,5 (doble detalle). No van en el manifest: cada nivel carga los suyos al empezar (`queueBackgrounds`) y StoryScene los del final. Fijos a la cámara, un poco agrandados y con parallax lento según el avance (no se repiten); `shiftY` en `levels.ts` los sube o baja. l1 tiene además `l1_cave`, que se ve solo dentro de las zonas `rect Cave` (degradado oscuro en la boca).
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

| Yvága (arena de Tau) | `night sky above the clouds just before dawn, deep indigo fading to violet, soft cloud floor, the seven stars of the Pleiades shining, faint golden light on the horizon` → `backgrounds/yvaga_far.png` (640 × 360) |

**Final (GDD §6.8, §7):** `backgrounds/final.png` (640 × 360): `dawn of the new year in Paraguay, a young Guarani woman with long dark hair sitting peacefully beside a small spring among green hills, a hummingbird near her shoulder, the seven stars of the Pleiades fading in the pink sky, 16-bit pixel art, no text`. Se muestra detrás de las dos últimas diapositivas del final. Si falta, `systems/Backdrops.ts` dibuja un amanecer por código (igual con `yvaga_far`).

**Desde S13a:** `final_asuncion.jpg` (Asunción sanada) va en `story.final.healed`; `final.jpg` (sin estrellas) en `story.final.spring` y en la de las plumas. Eichu (las siete estrellas, con la forma de las Pléyades) se dibuja por código encima de `final` y sobre el cielo de noche de `story.ending.1` y `story.ending.2` (`addEichu`, posición en `data/story.ts`).

**Arena de Teju Jagua:** además, `raw/backgrounds/l1_boss_body.png`, con la silueta del cuerpo enorme en la penumbra: `a colossal lizard body in a dark cave full of gold and crystals, seen from the side, heads hidden in shadow, 16-bit pixel art`.

---

## 6. Tilesets [Núcleo; mientras tanto, placeholders por código]

- Tiles de 16 × 16. Un PNG por bioma en `public/assets/tiles/<bioma>.png`: `cerro`, `estero`, `campo`, `pueblo`, `selva`, `montana`, `ciudad`, `cielo` (Yvága: nubes y estrellas).
- **Contenido mínimo:** suelo (relleno y bordes) · plataforma de un solo sentido (izquierda, centro, derecha) · peligro (espinas o karaguatá) · agua (superficie y fondo, donde haga falta) · variante agrietada · decoración (pasto, flores, piedras).
- **Rompibles (S22):** la roca agrietada (`B`, tajo cargado), el fardo frágil (`%`, tajo normal) y las ataduras y hojas de la liana se dibujan por código encima del tile (`src/entities/BreakableLook.ts`, colores en `GAMEPLAY.breakable`): piedra gris azulada con grietas que laten en el dorado de la onda, y paja clara con hebras y atadura. La "variante agrietada" del tileset queda tapada. Si algún día hay arte, que mantenga la regla: la roca se ve como piedra con luz adentro y el fardo como paja; las dos distintas del suelo del bioma.
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
| Corazón lleno y vacío | `raw/hud/heart_full.jpg`, `heart_empty.jpg` → `ui/` | 12 de alto (S13d ☑) |
| Pluma (HUD y pickup, color y gris) | `raw/hud/feather.jpg`, `feather_empty.jpg` → `ui/` | 12 de alto (S13d ☑) |
| Guavirá y Luz de Arasy (HUD y pickups) | `raw/hud/guavira.jpg`, `luz_arasy.jpg` → `ui/` | 12 de alto (S13d ☑) |
| Pickup yvoty | — (placeholder) | 12 × 12 |
| Fogata apagada y encendida (el parpadeo es por código) | `raw/props/fire_off.png`, `fire_on.png` → `props/` | 20 de ancho (S13d ☑) |
| Farol apagado y encendido | `raw/props/lantern_off.png`, `lantern_on.png` → `props/` | 32 de alto (S13d ☑) |
| Cartel | `raw/props/sign.png` → `props/` | 22 de alto (S13d ☑) |
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
| Enemigos (16) y vaca: teju_i, mbopi, jakare, nakurutu, mboi, mboi_colgante, nandu, karakara, jagua, kuati, kai, vaca, vaca_embrujada, taitetu, ao_ao_cria, pora, jagua_hu | MVP | S13c | ☑ (una animación por enemigo; sin poses de ataque ni daño) |
| Mainumby aleteando (`fly_8x1`) | Núcleo | S13c | ☑ |
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
| Iconos y props de interfaz | Núcleo | S13 | ◐ (S13d: corazones, plumas, guavirá, Luz de Arasy, cartel, fogata y faroles; faltan yvoty, marco de diálogo, barra del jefe y marca de Tau) |
| Teju Jagua: cuerpo y cuellos | MVP | S13d | ☑ (por código: lomo de lagarto, cola y cuellos de escamas; S20: cuerpo más chico, onda del coletazo y señal de cabeza expuesta) |
| Música de niveles (7), liberación y final | Núcleo | S13 | ☐ |
| Tau (disfraz y forma real) + `yvaga_far.png` y `final.png` | MVP | S12c | ☐ |

Si un asset no está listo cuando llega su sesión, **no pasa nada**: Claude usa un placeholder y lo anota. Se integra después (S13).
