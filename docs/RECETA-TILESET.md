# Receta: montar el tileset de un bioma

Salió del tileset de campo (l3, S56): Jose generó los materiales con un generador de imágenes y un script los convirtió en `public/assets/tiles/campo.png`. Sirve para los otros siete biomas (`cerro`, `estero`, `pueblo`, `selva`, `montana`, `ciudad`, `cielo`).

El formato del tileset (64 × 112 px, el orden de las 28 casillas, el autotile) está en ASSETS §6 y en las notas de S55 (`docs/PLAN.md`). Esta receta dice qué pedir, qué hace el script y qué revisar.

---

## 1. La idea

Al generador no se le piden tiles: les cuesta empalmar y no respetan una grilla de 16 px. Se le piden **materiales**: una textura que repite, una franja con el borde de arriba y los dibujos sueltos. Las 16 casillas del autotile no se dibujan: el script las arma con la tierra y el borde según qué vecinos tiene cada una.

## 2. Qué pedirle al generador

Cuatro imágenes en `raw/tiles/<bioma>/`. El tamaño da igual: el script las reduce. Lo que importa es el contenido:

| Archivo | Qué es | Cómo pedirlo |
|---|---|---|
| `tierra.jpg` | El relleno del suelo | Una textura de pixel art que **repita sin costura** en las dos direcciones, sin piedras grandes ni manchas fuertes: solo grano. Plana, sin luz de un lado. |
| `pasto.jpg` | El borde de arriba | Una franja horizontal: el borde de arriba (pasto, musgo, nieve…) sobre la misma tierra, con **fondo blanco liso** encima. Que el borde sea de un solo alto y repita a lo ancho. |
| `especiales.jpg` | Agua y decoración | **Cinco dibujos en fila**, de izquierda a derecha y separados: agua con ola (superficie), agua honda, una mata, flores, piedras. Fondo blanco liso. Las dos aguas, cuadradas y llenas hasta el borde. |
| `espinas.jpg` | El peligro | La planta o el objeto que lastima (karaguatá en campo), entero, apoyado abajo, sobre fondo blanco liso. |

Reglas para los prompts:

- **Fondo blanco liso, nunca el damero de «transparencia».** El de campo vino con el damero gris pintado. El script lo quita igual (sección 3), pero el blanco liso es más seguro.
- Si el generador deja elegir, **PNG** con transparencia. JPG funciona: el script quita el fondo.
- El orden de `especiales` es fijo; si viene en otro, se cambia `specials.order` en `tileset.json`. Si el bioma no tiene agua (hoy solo la usan l2 y `test`), igual van las dos aguas: el script espera cinco dibujos.
- La paleta de cada bioma, sacada de su fondo, está en las notas de S55. Pegala en el prompt: el suelo tiene que leerse contra el fondo.
- Pixel art de verdad, sin degradés ni antialias: se reduce a 16 px y lo fino se pierde.

## 3. Qué hace el script

`npm run tileset -- <bioma>` (o `node tools/build-tileset.mjs <bioma> --preview`). Lee `raw/tiles/<bioma>/tileset.json` y escribe `public/assets/tiles/<bioma>.png`; con `--preview`, también `tmp/tiles/<bioma>-x8.png`, ampliado y con un damero detrás. Las funciones están en `tools/lib/tileset-build.mjs` y las prueba `tests/tilesetBuild.test.ts`.

1. **Quita el fondo** (`backdropMask`): marca como fondo los píxeles claros y grises (los tres canales ≥ 190 y una diferencia entre ellos ≤ 28) que estén **unidos al borde de la imagen**. Es un relleno desde afuera, así que el blanco que queda adentro de un dibujo (la espuma, una flor blanca) se respeta. El damero y las manchas tenues que deja el generador son claros y grises: salen también.
2. **Reduce sin interpolar** (`reduceBlocks`): cada píxel nuevo es un bloque de la imagen grande, y su color es el **medoide** de los píxeles del dibujo del bloque, el píxel real más cercano a la mediana. No mezcla colores: todo color del tileset está en el original, y el ruido del JPG no pasa. Si el dibujo cubre menos de la mitad del bloque, el píxel queda transparente.
3. **Elige el bloque que mejor se repite** (`seamlessWindow`): de la tierra reducida, prueba todas las ventanas de 16 × 16 (dando la vuelta por los bordes, porque la textura no tiene costura) y se queda con la que menos diferencia tiene entre su última columna y la primera y entre su última fila y la primera. Con `speck` castiga los granos sueltos (al repetirse cada 16 px forman una grilla de puntos) y con `blob`, las manchas de 4 × 4. Para el borde y el agua hace lo mismo, solo a lo ancho.
4. **El borde de arriba**: la franja de `pasto` desde la punta más alta, `rows` filas. Cada píxel es aire, pasto o tierra (verde ≥ 0,68 × rojo es pasto: hay que cambiar `hueRatio` si el borde no es amarillo o verde), y donde es tierra va la tierra del bloque, para que empalme.
5. **El autotile** (`autotileCell`): las 16 casillas parten del mismo bloque de tierra. La máscara suma los vecinos que también son suelo (arriba 1, derecha 2, abajo 4, izquierda 8; el borde del mapa cuenta como suelo):
   - sin suelo arriba, va el borde de arriba (las puntas dejan ver el fondo);
   - sin suelo a un costado o abajo, ese lado se oscurece: la columna o fila de afuera × `edge.outer` (0,5) y la siguiente × `edge.inner` (0,75); el borde de arriba tapa el oscurecido en las esquinas;
   - la 15, con suelo en los cuatro lados, es el bloque liso.
   Las esquinas de adentro (suelo arriba y al costado, aire en la diagonal) no se distinguen: el autotile de 4 vecinos no las ve, y quedan lisas.
6. **La plataforma** (16 a 18, `platformCell`): solo las `platform.rows` filas de arriba (6): `grassRows` filas del borde, la tierra debajo, la fila de abajo y los extremos oscurecidos y las esquinas de abajo de los extremos recortadas. El resto, transparente.
7. **Los especiales**: separa los dibujos por columnas vacías (`findDrawings`; si no son cinco, para con un error). Las aguas se reducen a 24 px de ancho, se elige la ventana de 16 que mejor repite a lo ancho y llevan alfa `waterAlpha` (200). En la superficie, todo lo que está debajo de la primera tinta de cada columna es agua: la espuma de la cresta toca el fondo y el relleno se la comería. La mata, las flores, las piedras (23 a 25) y las espinas (19) se reducen sin deformarse hasta entrar en su `maxWidth` × `maxHeight`, centradas y apoyadas abajo.
8. **La 22** (roca agrietada) queda vacía: la tapa `BreakableLook`. 26 y 27, sin uso.

`tileset.json` de campo, con lo que se probó:

```json
{
  "dirt": { "file": "tierra.jpg", "scale": 12, "speck": 60, "blob": 16 },
  "grass": { "file": "pasto.jpg", "scaleX": 10, "scaleY": 22, "rows": 7, "fringe": 560 },
  "edge": { "outer": 0.5, "inner": 0.75 },
  "platform": { "rows": 6, "grassRows": 3 },
  "specials": { "file": "especiales.jpg", "order": ["waterSurface", "waterDeep", "grass", "flowers", "stones"] },
  "hazard": { "file": "espinas.jpg", "maxWidth": 16, "maxHeight": 14 },
  "decor": { "grass": { "maxWidth": 12, "maxHeight": 9 }, "flowers": { "maxWidth": 14, "maxHeight": 9 }, "stones": { "maxWidth": 12, "maxHeight": 7 } },
  "waterAlpha": 200
}
```

- `scale` es cuántos píxeles de la imagen hacen uno del tile. En la tierra conviene uno cerca del tamaño del «píxel» del dibujo (12 en campo: 1152 px de ancho → 96).
- En el borde, `scaleX` más chico que `scaleY`: con la misma escala, las hojas finas se pierden y la punta sale lisa. `fringe` (suma de los tres canales) saca el fleco claro que deja el JPG alrededor de las puntas.
- Para otro bioma, copiá este archivo y cambiá lo que haga falta: el script no tiene nada de campo adentro.

## 4. Antes de pisar el PNG

El PNG de hoy puede tener trabajo a mano (el piso del 16 de octubre, el borde de las baldosas 23 y 24). Guardá una copia en `raw/tiles/anteriores/<bioma>-<fecha>.png` antes de correr el script. Para volver atrás: `cp raw/tiles/anteriores/<bioma>-<fecha>.png public/assets/tiles/<bioma>.png` (o `git checkout <commit> -- public/assets/tiles/<bioma>.png`). No hace falta `npm run maps`: los mapas apuntan al PNG por el nombre.

## 5. Qué revisar

Nada en el juego avisa si un tileset está mal: se ve mal y se juega igual. El test `tests/tilesetBuild.test.ts` solo comprueba que los ocho PNG midan 64 × 112.

1. **La vista previa** (`tmp/tiles/<bioma>-x8.png`): las 16 del autotile con el borde de arriba en las 8 que tienen aire arriba (0, 2, 4, 6, 8, 10, 12 y 14), los costados oscuros donde toca, la 15 lisa; la plataforma en 6 px; el agua semitransparente; la decoración con el fondo transparente, sin fleco blanco.
2. **El relleno repetido**: armá un mosaico de 6 × 4 de la casilla 15 y mirá si se ve una grilla (un grano claro, una mancha). Si se ve, subí `speck` o `blob`, o pedí una tierra más pareja.
3. **Capturas del nivel** con el método de S20 (Kerana teletransportada, `game.loop.sleep()`), antes y después, en varios tramos: un llano, un pozo, una columna de un tile, un techo, una zanja con espinas, plataformas, la cueva si hay. Que no haya costuras entre tiles, que el borde de arriba aparezca solo arriba y que el relleno no lleve bordes sueltos en medio del terreno. Ampliá un recorte (×3, sin suavizar) para ver los píxeles.
4. **Que el peligro se lea como peligro** y no como la decoración: en campo, el karaguatá es oscuro y la mata es verde clara.
5. **El tamaño**: 64 × 112 exactos (lo dice el script al terminar y lo comprueba el test).
