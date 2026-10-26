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
- `greenEdge: true` borra el borde verde que deja el Chroma key, solo en los píxeles del contorno (Tau), en 3 pasadas; un número (`"greenEdge": 5`) da esas pasadas (borde más grueso). También va por hoja (`sheets.<hoja>.greenEdge`). No lo uses en personajes verdes de verdad (Mainumby, Mbói Tu'i, Kurupi, Jasy Jatere, teju'i, mbói, mbói colgante, jakare).
- `sheets.<hoja>.align`: `"top"` lleva lo más alto del dibujo a la primera fila del frame (en vez de los pies a la última; póra, mbói colgante); `"cell"` conserva la posición del dibujo dentro de su celda: todos los cuadros de la hoja usan la misma ancla, el centro de abajo de la unión de sus cajas (aleteo de Mainumby, que sube y baja en la hoja).
- `sheets.<hoja>.ignore: true` deja la hoja afuera (no se procesa): para una hoja que vino mal y hay que regenerar, mientras sus animaciones salen de otra con `source` (cabeza de Moñái, S43).
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
  - **Props por bioma (S46):** cada subcarpeta `raw/props/<carpeta>/` es un atlas: `props/<carpeta>.png` + `.json` (formato JSON Hash de Phaser, un frame por prop). Los archivos sueltos de `raw/props/` (cartel, fogata, farol) siguen como antes. En el `sprite.json` de la carpeta: `size.<nombre>` como arriba (con un `note` para comentar), `sheets.<nombre>.ignore: true` deja un PNG afuera y `sheets.<nombre>.hang: true` lo cuelga del techo. S47: `sheets.<nombre>.sink: N` lo hunde N unidades bajo la línea del suelo (detrás del piso), `waterOnly: true` marca los que solo van sobre agua, y `flow`, `splash` y `mist` animan el agua (ver §6.1). Todo eso viaja en el frame del atlas (`propFrameData`). El nombre es el del archivo sin `prop_` ni `_transparent`. `edge: "chroma"` borra solo el magenta puro del Chroma key (verde casi nulo), sin tocar el rosa del lapacho ni el violeta de los cristales; los props de Grok de S46 traían una franja de 3 a 8 px en la base, por eso van 8 pasadas. S50: `edge` puede ser una lista (`["chroma", "white"]`); `white` borra el fleco blanco o gris neutro de los PNG «_transparent» de `l5_suelo`; `sheets.<nombre>.edge` y `edgePasses` cambian el borde de un solo prop. Inventario y tamaños en §6.1; cómo se colocan, GDD §11.7.1.
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
| Moñái | `raw/monai/head/` | `The head of a giant reddish-orange serpent with a lighter cream belly, hypnotic glowing yellow eyes, no horns, no neck, side view facing left, 2D boss part sprite, 16-bit pixel art` | Idle (boca cerrada, lengua, parpadeo) · Attack (fauces que abren y aguantan) · Daze (ojo cerrado) | Solo la cabeza (S43): cuerpo y cuernos van por código. **Fondo transparente de verdad** (el damero pintado no sirve) |
| Jasy Jatere | `raw/jasy_jatere/` | `A small mischievous forest spirit child with golden blond hair and very pale skin, holding a shiny golden staff in his right hand, playful sly smile, simple light clothes, side view facing left, small 2D boss sprite, 16-bit pixel art` | Idle · Run · Attack (chispas con el bastón) · Hurt | Variante `raw/jasy_jatere/nostaff/`: el mismo niño sin bastón, sorprendido y a punto de llorar |
| Kurupi | `raw/kurupi/` | `A short stocky forest creature with dark skin, wiry wild hair and beard, a big mouth with a mischievous grin, glowing yellow eyes, feet turned backwards, wearing a simple leaf loincloth, side view facing left, 2D boss sprite, 16-bit pixel art` | Idle · Run · Attack (pisotón o silbido) · Hurt | Si eliges la versión 100 % Colmán, quita `feet turned backwards` |
| Ao Ao | `raw/ao_ao/` | `A ferocious beast with a thick shaggy sheep-like woolly body, a fierce bear-like head, huge fangs and claws, glowing red eyes, charging on four legs, side view facing left, large 2D boss sprite, 16-bit pixel art` | Run (4 patas) · Idle · Attack (erguido en dos patas, zarpazo) · Hurt | |
| Luisón | `raw/luison/` | `A gaunt dog-headed night creature with a long row of sharp teeth, small ears, a dry emaciated body, limbs half human and half claws, pale glowing eyes, hunched posture, side view facing left, 2D final boss sprite, 16-bit pixel art` | Idle · Run · Attack (lanzar) · Hurt | Pose extra "aullando sobre una lápida" |
| Tau (jefe final) | `raw/tau/disguise/` y `raw/tau/true/` | Disfraz: `A handsome young man with long dark hair holding a wooden flute, elegant but sinister smile, side view facing left, 2D boss sprite, 16-bit pixel art` · Forma real: `A shadowy evil spirit made of dark violet smoke with glowing red eyes and long smoky claws, side view facing left, large 2D boss, 16-bit pixel art` | Idle · Attack (flauta / garras de humo) · Hurt | Dos carpetas: `raw/tau/disguise/` (el joven de la flauta, fases 1 y 2, detail 2) y `raw/tau/true/` (humo violeta con ojos rojos, fase 3, detail 2). Hasta que existan, placeholder por código en `Tau.ts` |

**Teju Jagua por código (S13d, S20):** el lomo, las patas, la cola y los cuellos se dibujan en `tejuJaguaArt.ts`. S20: el cuerpo se dibuja a `bodySize` (0,65) del tamaño de S13d, ya achicado en la textura (con `pixelArt` no se escala la imagen); cuellos de 18 de grosor; las cabezas dormidas se apoyan sobre el lomo. La onda del coletazo es una textura de tierra (cresta del tamaño de la hitbox con piedritas y polvo, estela de lomitas detrás) con polvo y piedritas en partículas; el aviso levanta polvo y abre una grieta que tiembla por el recorrido de la onda. Cabeza expuesta: halo dorado que late detrás y tres estrellitas de mareo encima (texturas `teju_jagua_halo` y `teju_jagua_star`, por código). S21: el aliento de fuego se dibuja en un `Graphics` cada frame (`FlameArt` en `tejuJaguaArt.ts`): cuerpo naranja del tamaño exacto de la zona de daño, chorros amarillos con núcleo casi blanco que salen de los hocicos y se abren al bajar, lenguas que fluyen hacia el suelo, desborde rojizo tenue a los costados, suelo iluminado, hebras de aire que tiembla y pavesas en partículas. Aviso: el suelo de la zona se tiñe desde abajo de las cabezas hasta los bordes, el aire de la zona brilla con los bordes marcados y sube calor; el humo de los hocicos sigue. Sin texturas nuevas.

**Mbói Tu'i: el agua y el cuerpo enroscado por código (S41):** `src/entities/bosses/mboiTuiArt.ts`. La cabeza y el cuello siguen siendo el sprite `mboi_tui` (recortado en la superficie). En cada punto donde sale (los tres pozos y un charco en el islote central) hay juncos con totora a los dos lados, y el agua en reposo tiene rayitas de luz que corren. El aviso del picotazo pasa en tres etapas: el agua se calma (se apagan las rayitas y queda un espejo liso), los juncos se abren hacia afuera y gira un remolino aplastado con el centro oscuro. Al salir y al hundirse: gotas en partículas y ondas que se abren. El graznido y el escupitajo tienen la misma secuencia, más corta, antes de que suba la cabeza. El óvalo verde de la fase 3 ya no está: el islote tiene un charco con borde de barro, el charco avisa igual y salen tres vueltas del cuerpo (un tubo con borde, el lomo con brillo, el vientre dorado y escamas), más apagadas que la cabeza y detrás de Kerana: no hacen daño. Todo en `Graphics` dibujado cada frame, sin texturas nuevas.

**Moñái: cabeza en sprite (S43), el resto por código (S26):** la cabeza es `monai_head` (`raw/monai/head/`, frame de 76 × 68 a detail 2, cabeza cerrada de ≈ 30 × 20 unidades) con tres animaciones: `idle` (reposo), `attack` (las fauces abren y quedan abiertas mientras hace daño: fotogramas 1 a 6 de la hoja de 10, sin repetir) y `daze` (ojo cerrado, aturdida en el suelo). El punto del frame que va en el centro de la zona de daño (26 × 18, sin cambios) es `GAMEPLAY.monai.headSpriteOrigin`. **Pendiente:** `idle_8x1.png` vino sin transparencia (el damero está pintado en los píxeles) y se ignora (`"ignore": true`); mientras tanto el reposo es el fotograma 0 de `attack`, con la boca cerrada. Si falta el sprite, la cabeza dibujada por código de S26 sigue de respaldo (`monai_head_drawn*`). `src/entities/bosses/monaiArt.ts`, con el criterio de Teju Jagua (texturas al doble de detalle, `ART_K` = 2): cuernos (`monai_horns`, grises con anillos: es lo que se tiñe iridiscente en el aviso del pulso; cortos desde S43, `GAMEPLAY.monai.hornLength`). **Colores (S42):** naranja rojizo con vientre claro y cuernos grises, como el Moñái del Museo Mitológico Ramón Elías (el verde se leía como dragón oriental); la paleta está en `GAMEPLAY.monai.palette`. Cuerpo dibujado cada frame en un `Graphics`: tubo que se afina hacia la cola con borde, vientre crema, manchas y brillo; en una copa se enrosca en el tronco y la vuelta de atrás va en otro `Graphics` detrás del tronco. Estrellitas de mareo, halo de los cuernos, destello del golpe, giro de la cabeza e inclinación al caer, por código. El sprite verde colgante (`raw/monai/idle_8x1.png`, 72 × 128) se borró en S43 (sin uso desde S26), con su salida en `public/` y su entrada en el manifest. Árboles de su arena, en el mismo archivo: tronco (`monai_tree_trunk_<i>`) y copa (`monai_tree_crown_<i>`) por árbol, con variación por semilla.

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

Hoy el diálogo no usa esos archivos. La cara de Kerana se recorta de su sprite y entra en un cuadro de 64. Un retrato pintado puede reemplazarla después, sin cambiar el texto.

```
16-bit pixel art portrait, head and shoulders, facing right, [descripción],
plain dark blue background (#1B1A2E), no text
```
Lista (en `raw/portraits/`): `kerana_neutral`, `kerana_sad`, `kerana_determined`, `mainumby`, los siete hijos **ya liberados** (expresión serena, con un brillo suave): `teju_jagua`, `mboi_tui`, `monai`, `jasy_jatere`, `kurupi`, `ao_ao`, `luison`, y `tau` (sombra).

---

## 5. Fondos por nivel (parallax) [Núcleo; MVP: solo la capa lejana]

- Por nivel: `raw/backgrounds/l<N>_far.png`, `l<N>_mid.png` y `l<N>_near.png`. El pipeline los escala a 360 px de alto → `public/assets/backgrounds/`.
- **Desde S12e / S13a:** `raw/backgrounds/*.jpg` o `*.png` (1792 × 1008) → `npm run backgrounds` → `backgrounds/*.jpg` (calidad 85) a 1280 × 720, dibujados a escala 0,5 (doble detalle). No van en el manifest: cada nivel carga los suyos al empezar (`queueBackgrounds`) y StoryScene los del final. Fijos a la cámara, un poco agrandados y con parallax lento según el avance (no se repiten); `shiftY` en `levels.ts` los sube o baja. l1 tiene además `l1_cave`, que se ve solo dentro de las zonas `rect Cave` (degradado oscuro en la boca). **Desde S28** también se desplazan en vertical: abajo del nivel queda el encuadre de `shiftY` y al subir el fondo baja (`GAMEPLAY.backdrop.panYRange` = 0,15 del recorrido vertical de la cámara; la imagen se agranda hacia arriba lo justo). Un fondo nuevo para un nivel alto conviene que tenga cielo de sobra arriba. **Desde S29** la escala no depende del alto del nivel (la imagen no se agranda para el desplazamiento vertical): la franja que se destapa arriba la cubre el color medio de las filas de arriba de la imagen, con un fundido sobre el borde (solo se dibuja cuando hay franja) (`GAMEPLAY.backdrop.fillSampleRows`, `fillEdgeHeight`). Conviene que el borde de arriba de un fondo nuevo sea un cielo parejo.
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

## 6. Tilesets [Núcleo; campo ya tiene el suyo (S56), los otros siete siguen con el placeholder pintado]

- **Campo (l3) se monta con un script desde S56:** `npm run tileset -- campo` arma `public/assets/tiles/campo.png` con los materiales de `raw/tiles/campo/` (tierra, franja de pasto, agua, mata, flores, piedras y karaguatá, en JPG del generador) y sus ajustes en `raw/tiles/campo/tileset.json`. Las casillas 0 a 15 se construyen con la regla de los vecinos. La receta, qué pedirle al generador y qué revisar: [docs/RECETA-TILESET.md](RECETA-TILESET.md). El PNG anterior (el piso del 16 de octubre) está en `raw/tiles/anteriores/campo-2026-10-16.png`.
- Tiles de 16 × 16. Un PNG por bioma en `public/assets/tiles/<bioma>.png`: `cerro`, `estero`, `campo`, `pueblo`, `selva`, `montana`, `ciudad`, `cielo` (Yvága: nubes y estrellas).
- **Contenido mínimo:** suelo (relleno y bordes) · plataforma de un solo sentido (izquierda, centro, derecha) · peligro (espinas o karaguatá) · agua (superficie y fondo, donde haga falta) · variante agrietada · decoración (pasto, flores, piedras).
- **Terreno como repisa (S28):** en los niveles con `terrainShell` en `levels.ts` (hoy l1 a l6, con 3) la capa `Ground` se dibuja solo hasta 3 tiles del aire más cercano (en las 8 direcciones); la tercera fila va tenue (`GAMEPLAY.backdrop.terrainFadeAlpha`) y más adentro no se dibuja: se ve el fondo. Las colisiones no cambian. **Desde S29** el piso que llega al borde de abajo del mapa se dibuja entero, salvo en l1 (`solidFloor: false`): ahí también es una franja. l7 y Yvága no usan repisa. Un tileset nuevo no necesita relleno profundo, pero sí bordes que se lean con el fondo detrás. En la cueva de l1 no hay plantas: la piedra es gris y el musgo queda en la ladera.
- **Piso redibujado (16 de octubre de 2026):** las baldosas 0 a 15 de cada bioma (campo, hasta S56) ya no son una franja plana. Tierra (estero, campo, selva, montana): hojas de alto distinto arriba y manchas en el cuerpo. Cerro: piedra. Pueblo: revoque con tapa. Ciudad: adoquín. Cielo: suave. De la 16 en adelante no se tocó. No correr `tools/make-placeholder-tiles.mjs`: las pisa, y también la decoración de las baldosas 23 a 25.
- **Adorno del escenario (16 de octubre, sin choque):** `props/nest.png` (nido, nivel 2), `props/tacuru.png` y `props/fence.png` (nivel 3), `props/chair.png` y `props/hammock.png` (nivel 4), `props/trunk.png` y `props/liana.png` (nivel 5; la liana cuelga y no se corta). La canoa se sacó. El borde (pasto, junco, flor, baldosa, alero, raíz, hoja) vive en las baldosas 23 y 24, en la celda de aire sobre el piso.
- **Rompibles (S22):** la roca agrietada (`B`, tajo cargado), el fardo frágil (`%`, tajo normal) y las ataduras y hojas de la liana se dibujan por código encima del tile (`src/entities/BreakableLook.ts`, colores en `GAMEPLAY.breakable`): piedra gris azulada con grietas que laten en el dorado de la onda, y paja clara con hebras y atadura. La "variante agrietada" del tileset queda tapada. Si algún día hay arte, que mantenga la regla: la roca se ve como piedra con luz adentro y el fardo como paja; las dos distintas del suelo del bioma.
- **Orden para autotile (opcional pero recomendado):** las 16 variantes del suelo en una grilla de 4 × 4 al inicio del tileset. Para cada tile, se suman los vecinos que también son suelo: arriba = 1, derecha = 2, abajo = 4, izquierda = 8. La suma es la posición en la grilla (fila = suma ÷ 4, columna = resto). Ejemplo: superficie con suelo a los lados y debajo = 2 + 4 + 8 = 14. No hay paso que reordene un tileset hecho en otro orden: el PNG tiene que venir en este, o salir de `tools/build-tileset.mjs`, que ya lo arma así.
- **De dónde sacarlos:**
  - **Kenney** (kenney.nl): licencia CC0, libre para cualquier uso.
  - **itch.io** y **OpenGameArt**: revisa la licencia de cada pack (uso comercial, atribución).
  - **IA:** suele fallar en que los tiles empalmen. Por eso no se le piden tiles sino materiales (una textura que repite, la franja del borde, los dibujos sueltos) y el script arma los tiles (S56, RECETA-TILESET).
  - **Cambio de paleta:** un tileset base recoloreado por bioma (el pipeline puede hacerlo). Es la forma más barata de tener 7 biomas coherentes.

### 6.1 Props por bioma (S46)

Jose los generó en Grok, sueltos y con fondo transparente, en doce carpetas de `raw/props/` (S46) y dos más para l7 (S54). `npm run sprites` hace un atlas por carpeta (`public/assets/props/<carpeta>.png` + `.json`); el juego los carga todos al inicio (`PROP_ATLASES` en `manifest.ts`). Se colocan con la línea `prop` del mapa ASCII (GDD §11.7.1). Vitrina: `?debug=1&level=vitrina&boss=1`.

**Un atlas por carpeta**, y no uno por nivel ni uno general: la carpeta es la unidad que Jose genera y regenera (rehacer un prop toca un solo atlas), cada carpeta es un bioma que se puede cargar solo en su nivel si el peso empieza a importar, y todos entran en 1024 px de ancho (cualquier celular). Uno general pasaría de 1024 × 2000 px; uno por nivel mezclaría dos carpetas sin ganar nada.

**Tamaños.** Vienen a la resolución del modelo (lienzos de 1408 × 1408, el dibujo de 200 a 1300 px): sin escalar, un tacurú mediría 700 px, quince Keranas. El pipeline los lleva al tamaño del juego con `size.<nombre>` (`height` o `width`, en unidades; Kerana mide ≈ 46 y un tile 16) y los dibuja con `detail` 2. Esos valores, comentados con `note`, están en el `sprite.json` de cada carpeta: para ajustar uno, cambiá el número y corré `npm run sprites`. La regla que se usó: lo bajo (pasto, piedras, charcos) de 10 a 24; matas, rocas, postes, tacurú, muebles de 24 a 44 (menos que Kerana); lo que Kerana mira hacia arriba (juncal, puesto, pozo, escalera, postes de muelle) de 48 a 64; árboles y peñascos de 96 a 144 (de 2 a 3 Keranas; la pindó es la más alta, 144). Lo ancho y bajo (canoa, troncos, cercos, hojarasca) va por `width`, de 40 a 128.

Tamaño en el juego (ancho × alto, en unidades) y peso del atlas:

| Carpeta | Atlas (px) | Peso | Props |
|---|---|---|---|
| `l1_cueva` | 688 × 100 | 82 KB | ceiling_roots 31,5 × 40 (cuelga), crystal_cluster_large 57 × 48, crystal_cluster_medium 35 × 28, crystal_cluster_small 20 × 16, gold_ore_vein 38,5 × 32, stalactites 35,5 × 48 (cuelga), stalagmites 39,5 × 40, stone_rubble_pile 29 × 16, water_puddle_drips 48 × 20,5 |
| `l1_ladera` | 517 × 84 | 52 KB | exposed_tree_roots 72 × 24, loose_stones_boulders 35,5 × 20, moss_grey_rock 36 × 40, short_dry_grass 17,5 × 10, spiky_bromeliad 25 × 28, tall_dry_grass 29,5 × 32, termite_mound 35 × 36 |
| `l2_agua` | 943 × 116 | 108 KB | canoe 72 × 19,5, marsh_grass 64 × 17, reeds_large 99 × 48, reeds_small 44 × 32, rotting_log 64 × 12,5, water_hyacinth 36,5 × 28, water_lilies 40 × 29,5, wooden_posts 43 × 56 (water_ripples, fuera desde S49) |
| `l2_tierra` | 665 × 292 | 99 KB | driftwood 56 × 19,5, dry_grass_clump 24 × 24, fallen_fronds 56 × 26, fence_post 26 × 40, pindo_palm 74 × 144, sandy_mounds 40 × 18,5, thorny_scrub 48,5 × 36 |
| `l3_arboles` | 978 × 350 | 364 KB | corral_rail 64 × 21,5, dead_tree_termite 94 × 112, fallen_logs 48 × 19,5, lapacho_pink 134 × 128, lapacho_yellow 133,5 × 128, shade_tree_green 122,5 × 120, stone_trough 56 × 18, wooden_gate 29,5 × 44 |
| `l3_pastizal` | 693 × 108 | 83 KB | bromeliad_spiky 28,5 × 28, cracked_earth_patch 64 × 31,5, fence_post_wire 6,5 × 40, grass_tuft_bent 26 × 28, grass_tuft_upright 26,5 × 32, scrub_bush_thorny 38,5 × 32, stones_halfburied 48 × 23, termite_mound_large 29 × 36, termite_mound_small 28,5 × 52, wildflowers_clump 40 × 19 |
| `l4_calle` | 723 × 84 | 87 KB | clay_water_jars 45,5 × 24, hand_water_pump 39 × 40, hitching_post 8,5 × 32, low_whitewashed_wall 64 × 20, terracotta_tile_stacks 35,5 × 32, wooden_bench_wall 48 × 20,5, wooden_cart 64 × 31,5, wooden_crates_baskets 48 × 30 |
| `l4_patio` | 1012 × 260 | 194 KB | banana_plant 74,5 × 96, clothesline 96 × 45,5, hammock 80 × 40, mango_tree 111 × 128, potted_plants 34,5 × 32, stone_well 42 × 56, watering_can 20,5 × 16, wooden_chair 16,5 × 28, wooden_ladder 21 × 56 |
| `l5_altura` | 957 × 243 | 248 KB | aerial_roots 96 × 63 (cuelga), branch_platform 96 × 22,5, bromeliads 80 × 23, canopy 128 × 63,5, hollow_trunk 52 × 96, lianas_hanging 96 × 34 (cuelga), orchids 64 × 17, vines_trunk 19,5 × 96 |
| `l5_suelo` | 916 × 221 | 161 KB | bracket_fungi 36 × 64, buttress_roots 114 × 96, ferns 50 × 40, leaf_litter 64 × 28, rotting_logs 72 × 36,5, saplings 34 × 80, stream_bed 80 × 11,5, undergrowth 80 × 24,5 |
| `l6_agua` | 821 × 228 | 219 KB | mist_spray 43 × 64, mossy_trunk 80 × 29,5, shallow_pool 72 × 25, thin_stream 61,5 × 112, waterfall 96 × 112, wet_rock 51 × 56 |
| `l6_roca` | 961 × 258 | 206 KB | balanced_boulders 78 × 64, crevice_grasses 80 × 49,5, lichen_moss 80 × 47, rock_ledge 72 × 30, sandstone_outcrop 80 × 47, scree_pile 72 × 34, windbent_tree 83,5 × 96 |
| `l7_calle` (S54) | 968 × 116 | 151 KB | clothesline_balconies 64 × 24 (entre dos puntos), market_awning_rolled 64 × 48,5 (entre dos puntos), shuttered_windows 32,5 × 48 (fachada), stacked_crates_doorway 37,5 × 56 (fachada), stone_kerb_cobblestone 64 × 15, tiled_rooftop_chimney 80 × 44,5 (fachada), wooden_door_studs 37,5 × 56 (fachada), wooden_handcart 56 × 35, wrought_iron_grille_balcony 38,5 × 56 (fachada) |
| `l7_camposanto` (S54) | 780 × 228 | 121 KB | cemetery_gate 46,5 × 64, cypress_tree 31,5 × 112, dried_flowers 40 × 20,5, grave_slab 48 × 14,5, iron_cross 26 × 28, iron_cross_leaning 26 × 28, mausoleum 57,5 × 64, overgrown_weeds 40 × 33, stone_bench 48 × 16, stone_urn 15,5 × 32 |

**Ajustes de S47** (después de que Jose recorrió la vitrina):

- **Hundidos.** Lo ancho y plano dibujado desde arriba parecía levitar: su borde de abajo no se apoya en nada. `sheets.<nombre>.sink` (unidades, con `note`) los dibuja esa cantidad bajo la línea del suelo, a la profundidad `GAMEPLAY.props.sunkDepth` (−1: detrás del piso y del agua, delante del fondo), así que el borde queda enterrado. Valores: `l1_cueva/water_puddle_drips` 6, `l1_ladera/exposed_tree_roots` 6, `l1_ladera/loose_stones_boulders` 4, `l3_pastizal/cracked_earth_patch` 10. Para ajustar: cambiá el número y corré `npm run sprites`. El `scale` de la línea `prop` también multiplica el hundido.
- **Solo sobre agua.** `l2_agua/water_hyacinth` y `l2_agua/water_lilies` flotan de verdad en el estero: están bien dibujados. Llevan `sink` 7 y `waterOnly`: **colocalos solo sobre agua, nunca sobre tierra firme**. En la vitrina se muestran con una lámina de agua (`GAMEPLAY.props.showcaseWaterHeight`) para que se vean como en el estero.
- **Agua animada de `l6_agua`**, por código y sin arte nuevo (`src/assets/waterFlow.ts` y `flowAnim` en `propArt.ts`). `waterfall`, `thin_stream` y la lámina de `shallow_pool` llevan `flow` (`dir`: `down` o `side`; `region`: la parte del dibujo con agua, en fracciones). Dentro de la región solo se mueven los píxeles claros y azulados; la roca (oscura) y el musgo (verde) quedan quietos. Al cargar se arman 12 fotogramas en los que el agua corre hacia abajo (o de costado), mezclados para que el ciclo no salte. `splash` (`[x0, x1, y]` en fracciones) es la franja donde el agua golpea: ahí saltan gotas con las partículas de salpicadura de S22. `mist_spray` lleva `mist`: sube despacio y cambia de opacidad. Velocidades y ritmos en `GAMEPLAY.props.water` (comentados). El agua de `l2_agua` no se anima.
- **Fuera:** `l4_calle/market_stall_awning` (Jose lo descartó en la vitrina): `sheets.market_stall_awning.ignore`, sin borrar el PNG de `raw/`.

**Ajustes de S48** (Jose recorrió la vitrina otra vez): que se vean plantados en el suelo, no posados encima.

- **Borde de abajo irregular**, con el fondo asomando entre bulto y bulto: se hunden con `sink`, comentado en cada `sprite.json`. `l1_cueva/crystal_cluster_large` 4, `l2_tierra/fallen_fronds` 7, `l2_tierra/sandy_mounds` 3, `l3_pastizal/termite_mound_small` y `termite_mound_large` 3.
- **Árboles con raíces abiertas**, que se apoyaban en las puntas: se hunden poco, para no comerse las raíces (`l3_arboles/lapacho_pink`, `lapacho_yellow`, `shade_tree_green` y `dead_tree_termite` 3; `l4_patio/mango_tree` y `l5_suelo/buttress_roots` 4), y llevan **matas al pie**: `sheets.<nombre>.tufts`, una lista de props de pasto que ya existen y que el juego coloca solos junto al tronco (`prop`, `x` en fracción del ancho del dibujo, `scale`, `sink` y `flip`). Se dibujan delante del árbol y detrás de Kerana; siguen al árbol si va espejado, escalado o con `front`. Lapachos y árbol de sombra: `l3_pastizal/grass_tuft_bent` en las puntas de las raíces y `l1_ladera/short_dry_grass` al medio; árbol seco: los mismos dos; mango: `l3_pastizal/wildflowers_clump` y pasto corto; raíces tablares: `l5_suelo/ferns` a los costados y `undergrowth` al medio. Para cambiar una mata (por ejemplo, si el pasto seco de l3 no es del bioma donde se coloca el árbol), se edita el `sprite.json` y se corre `npm run sprites`. Se prefirió a dibujar pasto por código: es solo datos, el pasto tiene el estilo del resto del arte y no hay colores que elegir por bioma.
- **Fuera:** `l6_agua/ferns_rock` y `l6_agua/moss_cushions` (`ignore`): eran el peñasco de `waterfall` y `thin_stream` sin el chorro, así que no se animaban y repetían la roca.

**Ajustes de S49** (Jose recorrió la vitrina otra vez): el mismo borde irregular en l1.

- **`l1_ladera/termite_mound`:** `sink` 3 y matas de pasto seco de su carpeta al pie (`tufts`): `short_dry_grass` en los dos costados y `tall_dry_grass` chico a la izquierda. La boca del medio queda libre.
- **`l1_cueva`: cascotes, no pasto** (en la cueva de l1 no hay plantas). `tufts` sirve igual con cualquier prop: acá es `l1_cueva/stone_rubble_pile` a escala 0,3 a 0,45. `stalagmites` `sink` 5 (son puntas que se estrechan hacia arriba: hundir la base no se lleva nada) y tres cascotes; `gold_ore_vein` (roca redonda, los costados se levantan) y `crystal_cluster_medium`, `sink` 3 y dos cascotes; `crystal_cluster_small` y `stone_rubble_pile`, `sink` 2, sin cascotes. Las raíces y las estalactitas cuelgan, el charco ya estaba hundido (S47) y `crystal_cluster_large` quedó como en S48.
- **Fuera:** `l2_agua/water_ripples` (`ignore`): las ondas salieron marrones y no se leían como agua.

**Ajustes de S50** (Jose recorrió la vitrina otra vez; última ronda antes de colocarlos): props de base curva o irregular que tocaban el suelo solo en el centro, con los extremos al aire. Hundirlos más no servía: había que enterrar medio prop.

- **Matas o cascotes en los extremos** (`tufts`, del material del bioma de cada carpeta) y hundido poco (1 o 2, para que el prop quede a `sunkDepth` y las matas, que también se hunden, se dibujen delante y no detrás): `l1_ladera/moss_grey_rock` (`sink` 2, `short_dry_grass` a los dos lados), `l3_pastizal/stones_halfburied` (`sink` 1, `grass_tuft_bent` a 0,35), `l5_suelo/leaf_litter` (`sink` 1, `ferns` a 0,25), `l5_suelo/ferns` (`sink` 1, `leaf_litter` a 0,3) y `l1_cueva/water_puddle_drips` (sigue en `sink` 6; `stone_rubble_pile` a 0,35). Con el mismo síntoma, encontrados midiendo el borde de abajo de todos los props: los peñascos en capas de `l6_roca` (`sandstone_outcrop`, `crevice_grasses`, `lichen_moss` y `windbent_tree`, que está parado sobre la misma roca): `sink` 1 y piedras sueltas de su carpeta (`scree_pile` a 0,25) a los dos lados; `scree_pile`, `sink` 3 (es pedregal: perder la base no se lleva nada).
- **Una mata no lleva matas propias** (`asTuft` en `addProp`): `ferns` y `leaf_litter` se usan uno al pie del otro, y sin eso la recursión no terminaba.
- **Pueblo, sin vegetación:** `l4_patio/stone_well` (`sink` 4) y `l4_calle/wooden_crates_baskets` (`sink` 2,5) solo se hunden más. Una caja con matas creciendo a los lados se ve abandonada, y la calle de l4 es tierra pisada y adoquín.
- **Fleco blanco:** los PNG «_transparent» de `l5_suelo` (`ferns`, `buttress_roots`, `bracket_fungi`, `rotting_logs`, `undergrowth`; `saplings` apenas) traían un contorno blanco o gris claro, resto del fondo blanco de la exportación: el mismo defecto que el magenta de S46. Borde nuevo `white` (blanco y gris neutros: los tres canales a menos de 30 entre sí y todos sobre 140), y `edge` acepta una lista: `l5_suelo` usa `["chroma", "white"]`. No toca la madera encalada de la carreta ni el crema de los hongos (cálidos) ni el agua (azulada). Además, `sheets.<nombre>.edge` y `edgePasses` reemplazan los de la carpeta para un solo prop: `l1_cueva/water_puddle_drips` (contorno blanco alrededor de la piedra, 16 pasadas porque la franja es más gruesa) y `l1_cueva/crystal_cluster_large` (puntos blancos en el contorno; los cristales son violetas y azules y no se tocan). Los demás atlas salen idénticos byte a byte.
- **Fleco blanco que queda:** `l6_agua/waterfall`, `thin_stream` y `wet_rock` tienen algunos puntos blancos sueltos en el contorno de la roca, pero el agua y la espuma, blancas de verdad, también tocan el borde: el borde `white` se las comería. Se dejaron como están; si molestan al colocarlos, regenerarlos o limpiar a mano en `raw/` (copia aparte).

**Props de l7 (S54).** Jose subió `l7_calle` (9) y `l7_camposanto` (10): PNG sueltos con fondo transparente; los de la calle en lienzos de 1408 × 1408, los del camposanto recortados al dibujo. Varios traían el fleco de magenta puro en el borde (hasta 1500 píxeles en la puerta): el borde `chroma` con 8 pasadas, como las doce carpetas de S46, lo limpia entero (cero píxeles magenta en el borde de los dos atlas). Los blancos que quedan en el contorno del camposanto son la piedra encalada del mausoleo, no fleco. Tamaños con la regla de S46: la puerta, el portal y el balcón, 56 de alto (más que Kerana); la contraventana, 48; el tejado, 80 de ancho; el ciprés, 112 de alto (árbol); el mausoleo y el portón, 64; cruces y urna, 28 a 32; lo bajo (flores, losa, banco), 40 a 48 de ancho. Peso: `dist` 11 028 704 → 11 358 233 bytes (+322 KB: los dos atlas, 272 KB, y el mapa de l7 y el de la vitrina).

- **Tres clases de prop** (GDD §11.7.1): **de suelo**, como siempre (la carreta, el adoquinado y todo el camposanto); **de fachada**, `sheets.<nombre>.wall` (la puerta, el balcón, la contraventana, el portal con cajas y el tejado): se pegan a la cara de un muro (los tiles `#`), a la altura que se elija, y no se apoyan en el piso; **entre dos puntos**, `sheets.<nombre>.span` y la línea `prop X1-X2,Y` (el tendedero, de un muro al otro, y el toldo, con el poste al suelo y la punta contra un muro): el tramo da la escala.
- **Pintan su propio farol:** el tendedero (en el balcón de la izquierda), el toldo (en el poste) y la carreta (colgado adelante). Son chicos al lado de un farol del juego (32 de alto, en su poste), pero brillan: no van junto a un farol que sea un disparador (RECETA-NIVEL §19.10).
- **Vitrina:** `vitrina.txt` pasó de 688 a 800 tiles de ancho (`rect PropShowcase` hasta x 791; la salida, a x 795) para que entren las dos carpetas.

**Para regenerar o revisar (S46):**

- `l6_roca/prop_deep_crack.png`: el dibujo llega al borde de arriba y de abajo del lienzo (está cortado). Queda afuera con `sheets.deep_crack.ignore`. Cuando llegue el nuevo, se saca el `ignore` y se corre `npm run sprites`.
- `l3_pastizal`: `termite_mound_small` es más alto que `termite_mound_large` (¿nombres al revés?). Hoy `small` mide 52 de alto y `large` 36.
- `l2_tierra/prop_dry_grass_clump.png`: las puntas tienen un violeta que parece resto del magenta, mezclado con el dibujo (el pipeline no lo puede separar). Se ve poco a este tamaño; si molesta, regenerar.
- `l2_agua/prop_water_ripples.png`: las ondas son marrones y violetas, no se leen como agua sobre el fondo del estero. Fuera con `ignore` desde S49; si se regenera, se saca el `ignore`.
- Las doce carpetas traen transparencia real (ninguna con el damero pintado) y lienzos razonables (de 228 a 1792 px). `l3_pastizal` y `l5_altura` vienen recortados al dibujo; las demás, en lienzos de 1408 × 1408.

---

## 7. Interfaz [MVP con placeholders por código]

| Asset | Archivo | Tamaño |
|---|---|---|
| Corazón lleno y vacío | `ui/heart_full.png`, `ui/heart_empty.png` | 12 de alto. El pickup `guavira` también se dibuja con el corazón lleno: cura |
| Chipa (HUD y pickup, color y gris) | `ui/chipa.png`, `ui/chipa_empty.png` | 12 de alto. En el mapa y en el guardado sigue siendo `pluma` / `feathers` |
| Tereré (inmunidad) | `ui/terere.png` | La guampa de cuero. El id del pickup sigue siendo `luz_arasy` |
| Pickup yvoty | — (placeholder) | 12 × 12 |
| Fogata apagada y encendida (el parpadeo es por código) | `raw/props/fire_off.png`, `fire_on.png` → `props/` | 20 de ancho (S13d ☑) |
| Farol apagado y encendido | `raw/props/lantern_off.png`, `lantern_on.png` → `props/` | 32 de alto (S13d ☑). S33: tres montajes con el mismo arte: de pie (entero), aplique de pared (`mount=wall`: solo la cabeza, filas 0-33 del arte, colgada de un brazo dibujado por código) y nicho (`mount=niche`: la cabeza en un hueco en arco dibujado por código, cálido al encenderse) |
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

- **Música, hoy (S37): generada por código con ZzFX, sin archivos.** Diez piezas en `src/data/music.ts`: título («Canto de Eichu»), mapa, `l1` a `l7` y Yvága (la pelea con Tau incluida). Cada jefe usa una variante tensa de la pista de su nivel (`l1_boss`…), que el código arma sola. Pesan unos 18 KB de código (6 KB comprimidos) y no hay licencias que revisar. Se generan al entrar a la escena (≈ 0,3 s, en un Web Worker para no trabar el juego) y se guardan en memoria las últimas cuatro.
  - Para cambiar una pieza: notas, instrumentos y tempo en `src/data/music.ts` (el formato de los patrones está en `src/systems/musicLogic.ts`). Volúmenes y fundidos en `GAMEPLAY.audio`. Cada pista se normaliza sola: las diez suenan parejas.
- **Música, más adelante:** si llegan grabaciones (`public/assets/audio/music/*.mp3`, 128 kbps), el `AudioManager` las puede tomar en lugar de la pista generada sin tocar las escenas; las escenas piden una clave (`title`, `map`, `l1`…, `l1_boss`…). Falta todavía: la liberación (5 a 8 s; hoy es el efecto `liberation`) y el tema del final y los créditos (hoy, el del título).
  - Dirección musical en GDD §10.1.
- **De dónde sacar grabaciones:** bibliotecas libres de derechos (revisa uso comercial y atribución), generadores de música con IA (revisa la licencia del plan que uses), o un músico local: un arpa paraguaya real le daría mucha identidad.
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
| 3 pistas de música (title, level, boss) | MVP | S5 | ☑ (S37: por código; título, una por nivel y variante de jefe) |
| Teju Jagua (cabeza) + silueta del cuerpo | MVP | S6 | ☑ cabeza en sprite (S13b); **por código:** cuerpo, cuellos y cola (S13d, S20) |
| teju_i, mbopi | MVP | S6 | ☑ (S13c) |
| Mbói Tu'i + jakare, nakurutu, mboi | MVP | S7 | ☑ cabeza y cuello en sprite (S13b); **por código:** agua, juncos y vueltas del cuerpo (S41) |
| Moñái + nandu, karakara | MVP | S8 | ◐ cabeza en sprite (S43); **por código:** cuerpo de 14 segmentos, cuernos, estrellitas y árboles (S26); falta regenerar `idle_8x1.png` con transparencia |
| Jasy Jatere (+ sin bastón) + jagua | MVP | S9 | ☑ sprite (S13b) |
| Kurupi + kuati, kai | MVP | S10 | ☑ sprite (S13b) |
| Ao Ao + taitetu, ao_ao_cria | MVP | S11 | ☑ sprite (S13b) |
| Luisón + pora, jagua_hu | MVP | S12 | ☑ sprite (S13b) |
| Tilesets (8 biomas; campo hecho en S56, RECETA-TILESET) | Núcleo | S13 | ☐ |
| Fondos: capa lejana (7) | MVP | S13 | ☐ |
| Fondos: capas media y cercana (14) | Núcleo | S13 | ☐ |
| Retratos (13) | Núcleo | S13 | ☐ (hoy la cara de Kerana sale de su sprite; estos retratos pintados no están) |
| Logo y mapa del mundo | Núcleo | S13 | ☐ |
| Iconos y props de interfaz | Núcleo | S13 | ◐ (corazones, chipa, tereré, cartel, fogata y faroles; faltan yvoty, marco de diálogo, barra del jefe y marca de Tau) |
| Teju Jagua: cuerpo y cuellos | MVP | S13d | ☑ (por código: lomo de lagarto, cola y cuellos de escamas; S20: cuerpo más chico, onda del coletazo y señal de cabeza expuesta) |
| Música de niveles (7), liberación y final | Núcleo | S13 | ◐ (S37: los siete niveles y Yvága, por código; faltan la liberación y el tema del final) |
| Tau (disfraz y forma real) + `yvaga_far.png` y `final.png` | MVP | S12c | ☑ sprite (S13b) y fondos |

Si un asset no está listo cuando llega su sesión, **no pasa nada**: Claude usa un placeholder y lo anota. Se integra después (S13).
