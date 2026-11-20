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

## 6. Un bioma por código (cerro, S109; estero, S110; pueblo, S112) y el detalle sobre un tileset real (campo, S111)

Cuando no hay materiales del generador, el tileset se puede dibujar por código. Cerro (l1) es así desde S109 y el estero (l2) desde S110. Desde S110 el script sirve por bioma: `npm run terrain-tiles -- <bioma>` (sin bioma, todos; `npm run cerro-tiles` sigue andando) corre `tools/make-terrain-tiles.mjs`, que toma el arte de `tools/lib/<bioma>-art.mjs` (cada uno exporta `buildTileset` y `buildDetail`) y lo común de `tools/lib/tile-art.mjs` (el azar con semilla, la grilla con su paleta, las bandas de las variantes y el armado de las dos hojas). Cerro, por ejemplo: `tools/lib/cerro-art.mjs` escribe `public/assets/tiles/cerro.png` con el layout de siempre y la hoja de detalle `public/assets/tiles/detalle/cerro.png` con su `.json`. Todo sale de una semilla: correr el script dos veces da los mismos bytes, y `tests/cerroTiles.test.ts` falla si el PNG del repo no es el que da el script. No usa `raw/tiles/cerro/` (esos materiales son de montana, l6) ni pasa por `npm run tileset`.

Lo que salió de las rondas, para el próximo bioma:

1. **La paleta se mide en el fondo del nivel** y se arma en rampas de 5 o 6 tonos (las de cerro y de dónde sale cada una están al principio de `cerro-art.mjs`). Lo de adelante va más oscuro y más contrastado que lo mismo en el fondo.
2. **El empalme se garantiza, no se busca.** La roca base es periódica de 16 px en las dos direcciones. Las capas inclinadas tienen pendiente 1:2 y una cada 8 filas: con 16 px de casilla es la única combinación inclinada que repite. Cada tratamiento de borde (el pasto arriba, las muescas y grietas de los costados, la sombra de abajo, las esquinas gastadas) depende solo de la posición dentro de la casilla y es periódico a lo largo de su lado. El test compara las bandas de 2 px de cada lado sólido con las de la casilla de referencia (la que tiene el mismo aire arriba y abajo, o a los costados, y sólido a los dos lados del empalme).
3. **Las variantes cambian solo el centro** (de 2 a 13). El anillo de 2 px es el de la casilla que reemplazan, y el test lo comprueba. Van en la hoja de detalle, no en el tileset: las 28 casillas no se tocan.
4. **Lo que se repite en muchas celdas, de bajo contraste.** Una piedra con contorno en una variante del relleno aparece idéntica cada 15 celdas y se ve la repetición. En las variantes van manchas más claras u oscuras con forma de nube (nada de damero: sale un rombo), poros, vetas y grietas finas. Los objetos (piedras, cantos rodados, capas, raíces) van en calcomanías, pocas por pantalla y espejadas al azar (las capas no: siguen la pendiente de la base).
5. **Formas que no engañen.** El liquen en estrella se lee como un destello que se junta: va chato, más ancho que alto. Los cristales, raros y apagados dentro de la cueva (si no, son íconos en fila). Las piedras, polígonos convexos con una cara de arriba plana y biseles (por sectores salen muescas; como elipse, esferas). Las capas se desvanecen tramadas en las puntas (afinadas parecen lápices).
6. **El volumen por profundidad, en pasos chicos.** El tinte de una casilla es uno solo: con más de un 3 % entre dos filas se ven los bloques de 16 px. `tests/terrainDetail.test.ts` no deja pasar más.
7. **Mirar en el juego, no solo la hoja.** La hoja ampliada engaña: la repetición y la grilla se ven en una captura del nivel entero (método de S20) y en un recorte ×2.
8. **El costo, medido en la misma página.** Una sola textura para todo el terreno (la hoja va pegada debajo del tileset al cargar: con dos, alternadas en una capa, ≈ 3 % de FPS en el celular emulado). Cada calcomanía es un cuadro más encima de la roca: cuantas menos, mejor (l1 lleva 692). Hornearlas en la casilla de roca fue peor con render por software (textura grande, casillas dispersas). Entre corridas de navegador el ruido es de ±5 %: se compara en la misma página, alternando el estado nuevo con uno que dibuja lo mismo que `main` (notas de S109).

Lo que agregó el estero (S110), en cuatro rondas:

9. **La textura cruza los bordes.** Si cada variante pone sus terrones solo en el centro, el anillo de 2 px queda liso en todas las casillas y se ve una grilla de cuadros con algo adentro. La base reparte sus marcas con vuelta (cruzan el borde de la casilla); las variantes llevan, enteras, las de la base que tocan el anillo, y suman las suyas en el centro, cada una con su semilla. Si todas las variantes usan la semilla de la base, los terrones caen en el mismo lugar en cada celda: también es grilla.
10. **Una capa por fila fija es un tejido.** Dos líneas por casilla a la misma altura hacen guiones regulares en toda la pared (parece ladrillo o punto de tejido). En el barro la base lleva una sola veta tenue; las capas de verdad son lentes de arcilla largas (calcomanías de 2 y 3 casillas y algunas variantes), que no se repiten.
11. **El agua en tres casillas.** Superficie (20, con la línea de luz), cuerpo (21) y fondo (en la hoja, `water.deep`, debajo de un cuerpo): el color baja en franjas que se mezclan con píxeles sueltos en sus bordes y entre casillas, sin damero. Las rayas pintadas del reflejo se repiten en hilera cada 16 px: casi ninguna; el calor del atardecer lo pone un brillo por código que corre por la superficie (`WaterGlints`, `waterGlints` en `levels.ts`).
12. **El fondo bajo el agua no lleva pasto.** El piso que tiene agua arriba usa otra variante (`submerged` en el JSON, siempre): limo y algas oscuras. Si no, se ve una raya de pasto verde al pie de cada charco.
13. **La roca que se rompe, del mismo material.** Con la luz de las grietas en la hoja (`glow`: casilla → casilla con solo las grietas), `BreakableLook` deja ver la casilla 22 del mapa (o su variante) y hace latir encima esa luz, en vez del bloque gris. Sin `glow` (l1), el dibujo de siempre.

Lo que agregó campo (S111), el primero con el tileset de arte real, en nueve rondas:

14. **El tileset real no se rehace: se lo reconstruye.** Campo se montó en S56 con los materiales del generador (`npm run tileset`) y no se toca. Las 16 casillas del autotile son la tierra de la 15 con el pasto de la 14 arriba (filas 0 a 6) y el borde oscuro de S56 (× 0,5 afuera, × 0,75 la siguiente, el menor en las esquinas, redondeando como `Math.round`). `campoCell` hace exactamente eso y da `campo.png` byte a byte (`tests/campoTiles.test.ts`): una variante es la misma regla con otra tierra cuyo anillo de 2 px es el de la 15, y los cuatro lados quedan idénticos. Un bioma así no exporta `buildTileset`: `make-terrain-tiles` escribe solo la hoja de detalle y dice el md5 del PNG, que el test compara con el de `main`.
15. **Otra tierra con los mismos píxeles.** El centro de cada variante es la 15 corrida, espejada o traspuesta (el grano del arte real en otro orden); la primera y la última fila y columna del centro se mezclan al azar con la base, para que no se lea un cuadro. Encima, rasgos de bajo contraste: el moteado rojo (hematita) y ocre (goethita) de la laterita, manchas húmedas y secas, poros, granitos de cuarzo, motas de hierro. Con contraste de más, una mancha se reconoce cuando dos celdas vecinas sacan la misma variante (pasa en ≈ 8 % de los pares, en todos los niveles): mejor más variantes (16) y más suaves.
16. **Grilla RGBA para arte real.** `RgbaGrid` (en `tile-art.mjs`) guarda píxeles directos, sin paleta: el arte real tiene cientos de colores. `buildDetailSheet` y `blit` la aceptan igual que la `Grid` de rampas.
17. **Piedras sobre tierra de su mismo tono.** Una piedra oscura sin contorno se lee como un pozo o un bicho; chica y con contorno alrededor, como un anillo. Las de 6 px o más: polígono con contorno, la cara de arriba clara y grande, el costado derecho más oscuro, poros, la tierra que las tapa abajo y su sombra. Las de 3 a 5 px, dibujadas a mano, sin contorno arriba. El cuarzo, nunca un punto suelto (se lee como un destello): astillas de 5 px o más, con su sombra.
18. **Las capas de suelo, difusas.** Con filo oscuro y canto claro, una capa de laterita se lee como un palito pegado; como tierra teñida (alfa, bordes tramados, el moteado ocre abajo), es parte del suelo.

Lo que agregó el pueblo (S112), el primero con dos materiales, en nueve rondas más la final:

19. **Dos materiales con un solo autotile: zonas medidas en el mapa.** El autotile no distingue una calle de un techo (las dos son la 14). `townZones` (`terrainDetailLogic.ts`) lo mide: la calle es la tierra que llega al borde de abajo desde la línea del piso (la fila más común donde empieza el tramo sólido que llega abajo: la 37 en l4); su piso al aire libre es empedrado y bajo techo, ladrillo; bajo una casa, cimiento. Lo demás son casas: tejas arriba, ladrillo si es un piso de adentro o un piso elevado de la calle (el patio, la terraza, la galería: un piso con aire arriba, a 10 filas del fondo o menos, de dos o más de ancho); el zócalo donde la casa se apoya en la calle, uno por casa. Cada celda de una zona lleva siempre una casilla de su zona (`zones` en el JSON): la calle nunca queda con la cal. Las calcomanías también van por zona (`zoneDecals`). La primera regla (la calle desde su propio piso, hasta 10 filas arriba) dejaba los muelles de la galería como pilares de tierra: mejor la línea del piso y lo elevado como mampostería.
20. **Las zonas se tocan en una línea que se lee.** Entre la casa y la calle no hace falta que las bandas coincidan: el zócalo (abajo de la casa) y el cimiento (arriba de la calle) se pintan para encontrarse siempre de a pares, y el empalme es la línea donde la pared se apoya. A los costados, cada zona empalma consigo misma (el test lo comprueba zona por zona).
21. **En un material liso, al revés que en el barro (punto 9).** En la cal, las marcas de la base que cruzan el borde se repiten iguales en todas las variantes y se ve una pared acolchada (un bulto cada 16 px). Con la cal lisa en el anillo de 2 px y todo lo demás en el centro, distinto en cada variante, no se ve ninguna grilla: el material es parejo.
22. **Medios tonos para las manchas.** Entre dos tonos de la rampa de la cal hay ≈ 17 niveles: una mancha de un tono se ve como un parche. Una rampa aparte de dos medios tonos (`calm`, `earthm`) da manchas que se notan apenas, como el encalado. Los bordes, con trama ordenada (Bayer 4 × 4) y no con ruido: el ruido suelto hace puntitos; la trama, un borde suave.
23. **En la cal, el oscurecido en pasos de 1,5 %.** Sobre un blanco, 3 % por fila ya dibuja los cuadros de 16 px (en la roca de l1 no se ve). Y nada que se lea como letra: una grieta que vuelve sobre sí misma es una «S»; una cáscara clara con su sombra, una «⊏»; un aro de 4 px, un «9». Las grietas bajan, con un quiebre de lado de vez en cuando.

Lo que agregó la selva (S113), con el dosel de arriba, en siete rondas más la final:

24. **Lo que cruza el anillo, suave; lo marcado, en el centro.** En la tierra colorada, los terrones claros y las motas de la base que tocaban el anillo de 2 px salían en todas las variantes y dibujaban una grilla de puntitos cada 16 px (y una piedrita gris al lado de una ocre parecían ojos). La base cruza el borde solo con manchones en medio tono (`earthm`) y poros; lo que se ve (un terrón con luz, un grano claro, una fibra de raíz) va en el centro, distinto en cada variante.
25. **La hojarasca son hojas, no rayas.** Tallos de helecho verticales y matas que cuelgan delante del humus, a la misma altura en cada casilla, se leen como un zigzag («NNNN») a lo largo del piso. Hojas caídas de seis formas (ocres, marrones, rojizas y alguna verde), de atrás para adelante, y cojines de musgo; los helechitos, una fronda chica que se arquea. Las variantes del piso salen de una semilla: en el anillo, la hojarasca de la base (con sus hojas enteras); en el centro, otro filo, otro humus, otras hojas.
26. **Humus arriba, tierra colorada abajo, tramado.** El humus casi negro bajo las hojas (filas 4 a 12, el borde de abajo ondulado) pasa a la tierra con un tramado de tres filas; una línea recta entre los dos se lee como dos materiales pegados.
27. **Una raíz se afina.** Una raíz pareja con las puntas cortadas es un tablón o un palito; con la luz arriba, la sombra abajo, algún bulto y las puntas que adelgazan hasta una raicilla, es raíz. Del color del suelo con su luz, no más clara que la tierra (de lejos parecía madera).
28. **Lo que cuelga va en el aire.** Las raicillas que cuelgan bajo una saliente son calcomanías en la celda de aire de abajo (`hang`, `hangChance`), solo donde hay 4 filas de aire debajo: en un pasaje bajo (el túnel de raíces de l5 tiene 3) estorbarían.
29. **En una pared alta, nada claro en los costados de la base.** Una punta de raíz o un hongo de repisa naranja en el borde de la 7 o la 13 se repite cada 16 px y se lee como una tacha: en la base, oscuros y de a uno; los que se ven, en las variantes.
30. **La piedra que se apila sigue.** La roca del tajo de l5 es de 2 × 4: con el musgo en una franja arriba de cada celda se veían cuatro ladrillos. Las grietas salen por los bordes en el mismo lugar del otro lado (columnas 5 y 11, fila 6) y el musgo va en manchones: es una sola piedra.
31. **El dosel, en píxeles del fondo.** Arriba de la imagen (el relleno de S29), las copas se dibujan en píxeles de 3 px de arte (el «píxel» del fondo pintado) con matitas de luz arriba y sombra abajo, en capas (lejanas en la niebla, del medio más claras, de adelante oscuras, el dosel que cuelga), con ramas, bromelias, orquídeas, lianas, rayos y una banda de niebla; lo tramado, solo en los bordes (con ruido en grumos: el Bayer parejo en un área grande se ve como una rejilla). La franja de abajo copia el borde de la imagen (sin la lluvia) espejado y se deshace en grumos: no hay costura ni el fundido borroso de S29. `canopyFill` en `ambientLogic.ts`, `GAMEPLAY.backdrop.canopy`.

Para usarlo en otro nivel o bioma: un `tools/lib/<bioma>-art.mjs` con `buildTileset` y `buildDetail`, su línea en `BIOMES` de `tools/make-terrain-tiles.mjs`, una hoja con el mismo formato de `.json` (`fill`, `edges`, `decals`; si hace falta, `water`, `submerged`, `glow` y `zones`), su entrada en `TERRAIN_DETAIL_SHEETS` (`src/assets/manifest.ts`) y `terrainDetail: { sheet, seed }` en `levels.ts`. Las probabilidades, en `GAMEPLAY.backdrop.terrainDetail`; lo que cambie esa hoja (las franjas de calcomanías, el oscurecido), en su `sheets.<hoja>`, que pisa lo común.
