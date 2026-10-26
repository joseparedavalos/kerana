# Pendientes para publicar

El plan completo está en [docs/SESIONES.md](SESIONES.md).
Revisado el 26 de octubre de 2026 en S55, contra lo que ya está en `main` hasta S54 (pull request 109).

Primero itch.io, gratis y en navegador. Después Google Play, con el feedback de itch.io. Steam más adelante (S34 y S35, 16 de octubre).

## Hecho

- El prólogo se salta y dice por qué se levanta Kerana. Hay figuras. Ella mira a la derecha y Tau queda a su altura.
- Si hay partida, el título ofrece Continuar y Nueva partida.
- Los carteles del nivel 1 enseñan una sola cosa.
- Kerana libera con una frase. Tau se sella, no se libera.
- El sable tiene arco, chispas y sacudida. El tajo cargado se siente distinto. La sacudida se apaga en Opciones.
- La chipa reemplaza a la pluma. El guardado no se borra.
- Al terminar un nivel se ven el hijo, el don y las chipas, con un botón grande de Siguiente.
- El tajo cargado, el salto doble y el dash están desde el primer nivel. El corazón nuevo sigue creciendo.
- El corazón cura. El tereré, la guampa de cuero, da la inmunidad. Lo que cae en la pelea de Mbói Tu'ĩ también es un corazón.
- Los hongos tienen sombrero, manchas y tallo.
- Los botones del celular se mueven y se agrandan. Varios dedos a la vez. El ataque automático está apagado.
- En el nivel 1 el piso es una franja. Hay musgo en la ladera y no hay plantas en la cueva. El cántaro y las piedras se sacaron.
- Las cabezas de Teju Jagua son del mismo marrón que el lomo.
- El diálogo muestra la cara de Kerana, dentro del cuadro.
- Al reaparecer, la cámara llega con ella.
- El detalle del escenario de los niveles 1 a 5 está hecho. No choca y no cambia el salto. La canoa se sacó: no se entendía. La tabla está en [docs/SESIONES.md](SESIONES.md).
- El piso se redibujó, solo el dibujo. Pasto con hojas de alto distinto donde hay tierra, piedra en la cueva, revoque en el pueblo y adoquín en la ciudad. Se pisa igual.
- Las vacas quedan de este tamaño. Agrandarlas un poco ensucia el pixel.
- La documentación está al día (S34): plan Pro y Opus 5.5 sin presupuesto en dólares, capturas del antes y el después para lo visual, una viñeta por documento en `CLAUDE.md` y el orden de publicación.
- El GDD dice el orden de publicación correcto: itch.io, después Google Play, después Steam (S35). `CLAUDE.md` y la línea «Futuro» del GDD, también (S36).
- Las tres chipas del nivel abren el paso a la antesala (S36). Una cortina de raíces con una tablita que muestra cuántas lleva Kerana; Mainumby dice cuántas faltan; con las tres se entregan y el paso se abre. Desde la pausa se puede volver a buscar las que faltan. Las partidas viejas con el hijo ya libre encuentran el paso abierto. La chipa A de l2 y la C de l3 piden ahora un desvío de verdad. El ascensor de la chipa C de l7 va y viene: si se iba sin Kerana, la chipa se perdía.

- Hay música (S37): diez piezas generadas por código (título, mapa, cada nivel y Yvága) y una variante tensa para cada jefe. Fundidos, más baja en los diálogos, pausa sin foco y arranque con el primer toque. Volumen de música y de efectos por separado en Opciones. Todo aviso de jefe suena, y suenan la puerta de las chipas, los disparadores, las rejas, las plataformas, las lianas, la roca que pide el tajo cargado, la red de seguridad, el salto doble y los menús.
- «Nivel completado» responde siempre (S38). Desde el 13 de octubre, la segunda vez que aparecía sin recargar la página (después de l2) no hacía caso al clic ni a las teclas y el juego quedaba trabado. Los textos de los menús responden al clic en todo su ancho (antes, la mitad derecha de los largos no). El smoke prueba los botones con el ratón.

- La red de seguridad saca a Kerana del hueco del premio de l2 aunque no rompa el fardo (S39). Hasta S38 la red daba por rotos todos los rompibles y ese hueco no contaba como encierro: Jose quedó atrapado sin salida. Ahora mira lo que está sano y lo que ya se rompió, y recalcula cada vez que algo se abre. «Volver a buscar chipas» está en la pausa desde el inicio del nivel, mientras falte alguna chipa, no solo frente a la puerta. «Reiniciar desde el fuego» de la pausa se llama ahora «Volver al último fuego»: es lo que hace (no reinicia el nivel) y alguien atascado la encuentra.
- La pestaña del navegador dice «Kerana · Pokõi ñemoñare» (S40), igual que el título del juego. Desde el 13 de octubre decía solo «Kerana»; «Kerana: Pokõi Mbyja», el subtítulo viejo, quedó en las versiones publicadas antes de ese día.
- Mbói Tu'ĩ sale del agua (S41): el agua se calma, se abren los juncos y gira un remolino antes de que salga; al salir, chapuzón y ondas. En la fase 3 sale de un charco del islote, ya no de un óvalo verde. El marco del cuadro de diálogo ya no cruza en diagonal.
- Moñái es naranja rojizo, con vientre claro y cuernos grises (S42), como el del Museo Mitológico Ramón Elías: verde se leía como dragón oriental. Misma forma y misma pelea.
- La cabeza de Moñái es el sprite de Grok (S43): boca cerrada en reposo, fauces que se abren al caer y ojo cerrado cuando queda aturdida. Los cuernos son cortos, apenas despuntan, y siguen brillando en el aviso del pulso. Misma pelea.
- Moñái es más exigente (S44): el pulso confunde (controles al revés y sin tajo; se sale sacudiéndose con atacar, y Kerana brilla con una espiral grande encima), las ventanas para pegarle son más cortas (dan uno o dos golpes) y su cuerpo en el suelo levanta una joroba que lastima, así que hay que buscarle la cabeza de frente. La vida no cambió.
- Hay una receta para encargar el sprite de un jefe (S45): [docs/RECETA-SPRITES.md](RECETA-SPRITES.md), con el flujo, los datos que hay que pedir antes de generar, las reglas de formato y qué le falta a cada jefe.
- Los props de escenario de los niveles 1 a 6 están listos para usar (S46): 99 props en doce atlas, uno por carpeta de `raw/props/`, a un tamaño pensado contra Kerana y el tile. Se colocan con una línea `prop` en el mapa ASCII (GDD §11.7.1) y se ven todos en la vitrina: `?debug=1&level=vitrina&boss=1`. Todavía no hay ninguno en los niveles.
- Los props de la vitrina se asientan y el agua de l6 corre (S47): el charco, las raíces, las piedras y la tierra agrietada se hunden en el piso en vez de flotar; el camalote y el irupé, en el agua (van solo sobre agua). La cascada, el hilo de agua y el pozo corren, saltan gotas abajo y el rocío sube. El puesto de mercado de l4 se sacó.
- Los árboles y los props de borde irregular se ven plantados (S48): se hunden un poco en el piso y los árboles grandes llevan matas de pasto al pie, para no comerse las raíces. Los dos peñascos sin agua de l6 se sacaron.
- El tacurú de la ladera de l1 lleva pasto seco al pie, y las estalagmitas, la roca con veta y los cristales de la cueva, cascotes (S49): en la cueva no hay plantas. Las ondas marrones de l2 se sacaron.
- Los props de base curva que tocaban el suelo solo en el centro llevan matas, hojarasca o piedras sueltas de su bioma en los extremos (S50): la roca musgosa de l1, las piedras semienterradas de l3, la hojarasca y los helechos de l5, el charco de la cueva (cascotes) y los peñascos en capas de l6. El pozo y las cajas de l4, objetos de pueblo, solo se hundieron más. El fleco blanco de los helechos y del resto de `l5_suelo`, del charco y de los cristales grandes se limpia en el pipeline (borde `white`).
- El nivel 1 está decorado con props (S51): 35, de `l1_cueva` bajo tierra (sin plantas) y de `l1_ladera` afuera, sin estorbar plataformas, peligros, piezas ni enemigos. Un test lo comprueba en cada nivel que tenga props. La receta para los demás niveles está en [docs/RECETA-NIVEL.md](RECETA-NIVEL.md) §19.
- El tacurú de la cima de l1 está a pleno sol (S52): estaba bajo el fondo de cueva, que se dibuja por columnas. Los niveles 2 y 3 están decorados con props: 15 en cada uno, en las orillas quietas y los llanos, con las balsas, el viento, las copas y las zonas de ritmo a la vista. El camalote de adorno no se usa (es el que se hunde) y el irupé va solo sobre agua. La receta tiene lo aprendido con el agua y el campo abierto (§19.6).
- Los niveles 4, 5 y 6 están decorados con props (S53): 11 en l4, siempre junto a un muro, bajo un portal o en un patio (el pueblo vacío de la siesta); 9 en l5, abajo, sin nada que cuelgue ni que parezca una rama o un escalón; 9 en l6, de roca, sin cascadas de adorno (la única es la del secreto). La galería de las tejas, la persecución, el compás y los lugares secretos quedan limpios.
- El nivel 7 está decorado con props (S54): 12, todos junto a un farol o un fuego, porque es de noche y traen luz de farol pintada. En la calle, fachadas pegadas a los muros (un balcón sobre el zaguán, la casa del andamio con puerta, tejadito y contraventana, el tendedero en el patio de la casona) y una carreta en la plaza; en el camposanto, cipreses, flores secas, una cruz de hierro, yuyos y un banco. La calle y el camposanto no se mezclan, la ronda del farolero queda limpia y ningún prop tapa un farol. Hay dos clases nuevas de prop: de fachada (sobre un muro, a cualquier altura) y entre dos puntos (`prop X1-X2,Y`: el tendedero y el toldo), en GDD §11.7.1.

## Ahora

1. Escuchar la música (Jose) y ajustarla en `src/data/music.ts`: Claude no puede oír. Volumen y fundidos en `GAMEPLAY.audio`. Faltan el remate de la liberación (hoy calla la música) y el tema del final (hoy suena el del título).
2. Nivel 6, el detalle del escenario: laja con pasto en el borde, una palma y unas rocas. Sin choque. Después el 7: losa y vela, una cruz y un ramo seco. l6 ya lleva props (S53): esto es el dibujo del piso, aparte.
3. Jugar las veintiuna chipas como jugador nuevo, ahora que son obligatorias (S36): que cada una se encuentre sin saber dónde está, y que la puerta de la ofrenda se entienda a la primera. La lista de qué pide cada una está en las notas de S36 (`docs/PLAN.md`).
4. El smoke no siempre pasa tres veces seguidas en el contenedor (S37): con el juego a menos de ≈ 10 FPS el piloto se traba en el paso 1 de l2 (también sin música) y alguna vez en la copa 3 de l3. En S48 fallaron en l3 los mismos 2 chequeos (paso 42, x 279) en la rama y en `main`. En S49, una corrida de la rama se trabó en el paso 1 de l2 y la siguiente pasó entera (`main`, entera). No es del juego: es el piloto, afinado para 10-12 FPS. Detalle en las notas de S37. En S51 (una corrida, 184 de 190): l2 trabado en el paso 38, l7 sin dos guavirá, y l1 sin la tercera chipa (paso 14 trabado; también le pasó al build de `main` en una vuelta suelta del piloto). En S52, el piloto de l3 se trabó en el paso 42 (la copa 3) en 3 de 8 vueltas, con y sin props (2 de 5 con `main`), y el smoke se trabó una vez en el paso 1 de l2 (6 vueltas sueltas con el mismo mapa pasaron enteras). En S54, el smoke se trabó otra vez en el paso 1 de l2; 4 vueltas sueltas intercaladas (`main` y la rama) pasaron enteras.
5. El tirón de la red de seguridad al romper algo en l5 (S39, sin arreglar). Desde S39 la red se recalcula entera cada vez que algo se abre (un rompible, un hongo dormido, la ofrenda). Medido en el headless, en el cuadro en que se rompe algo: en S39, l5 48 a 75 ms (el recálculo solo: 40 a 134, mediana 50), l7 24 a 38, l2 7 a 9. **Confirmado en S40:** l5, romper 27 a 53 ms (mediana 32; el recálculo solo, mediana 29), l7 12 a 25, l2 6 a 12; con la CPU frenada ×4, como un celular modesto, l5 tarda 107 a 200 ms (mediana 122). Sin el recálculo, romper tarda menos de 1 ms (1,3 con la CPU frenada). En l5 son 2 o 3 cuadros perdidos a 60 FPS en una PC y 6 a 12 en un celular: se nota como un tirón. No cambia la física (Arcade recupera los pasos), solo se ve. Cómo evitarlo, de lo más simple a lo más fino: (a) repartir el recálculo en varios cuadros o hacerlo en un Web Worker, usando el mapa viejo mientras tanto (la red espera 4 s: unos cuadros de atraso no importan); (b) recalcular solo lo que puede cambiar: los tramos marcados, los que aparecen donde estaba lo que se abrió y los que pasaban por encima de él (romper un fardo saca un piso que alguien podía usar de escalón, así que no alcanza con mirar solo los marcados).
6. Publicar en itch.io (los pasos, abajo).
7. Google Play, con el feedback de itch.io (los pasos, abajo).
8. Regenerar `raw/monai/head/idle_8x1.png` (Jose) con fondo transparente de verdad: vino con el damero pintado en los píxeles y el pipeline no puede quitarlo. Mientras tanto Moñái en reposo usa un fotograma quieto de la mordida. Cuando llegue, en `raw/monai/head/sprite.json`: `sheets.idle` pasa de `{ "ignore": true }` a `{ "align": "top", "anchor": "cell" }`, la animación `idle` pasa a `{ "fps": 8, "loop": true }` (sin `source` ni `list`), y `npm run sprites`. Cómo generarla, en [docs/RECETA-SPRITES.md](RECETA-SPRITES.md) (sección 3).
9. Jugar la pelea de Moñái de S44 (Jose) y ajustar el bloque S44 de `GAMEPLAY.monai`: la ventana (0,65 s), la confusión (4,5 s y 0,4 s por sacudida) y la joroba. Si la joroba no se lee como peligrosa, darle un dibujo propio mientras lastima (notas de S44).
10. Recorrer l1 a l7 con los props de S51 a S54 (Jose, `?debug=1&level=1` a `7`) y decir qué sobra, qué falta o qué estorba: se mueven en `tools/levels/lN.txt` (líneas `prop`) y `npm run maps`. Falta decidir si reemplazan a los props viejos (`kind=tacuru`, `fence`, `chair`, `hammock`, `trunk`, `liana`…) y al borde de las baldosas 23 y 24. Sigue valiendo revisar en la vitrina (`?debug=1&level=vitrina&boss=1`) el tamaño (`size`), el hundido (`sink`), las matas y cascotes (`tufts`) y el agua de l6 (`GAMEPLAY.props.water`). El camalote y el irupé van solo sobre agua. En l5 no se usaron las lianas, las raíces aéreas, la rama gruesa ni el follaje del dosel (se leen como ramas o como la cortina de la ofrenda: RECETA-NIVEL §19.8); si Jose las quiere, habría que redibujarlas para que no parezcan pisables. En l7 (S54) no se usaron el toldo enrollado (se lee como los toldos que rebotan), el adoquinado (murete o trampilla), el portal con cajas, el mausoleo (los del nivel se pisan), el portón (parece una reja), la urna, la losa y la cruz torcida (RECETA-NIVEL §19.10). Mirar en l7: si el farolito pintado de la carreta de la plaza hace dudar de si es un farol (se puede sacar o mover), y si la cruz de hierro (cruz patada) se lee como cruz de tumba.
11. Regenerar `raw/props/l6_roca/prop_deep_crack.png` (Jose): viene cortado arriba y abajo y queda afuera (`sheets.deep_crack.ignore` en su `sprite.json`; al llegar el nuevo, se saca el `ignore`). Revisar también, sin apuro: los tacurús de `l3_pastizal` con los nombres al revés (`small` es el alto) y las puntas violetas de `l2_tierra/prop_dry_grass_clump.png`. Si Jose quiere ondas en l2, regenerar `l2_agua/prop_water_ripples.png` (fuera con `ignore` desde S49: salieron marrones). Quedan puntos blancos sueltos en el contorno de la roca de `l6_agua/waterfall`, `thin_stream` y `wet_rock` (S50): el borde `white` se comería el agua y la espuma, así que si molestan al colocarlos, regenerar. Detalle en ASSETS §6.1.
12. El peso del juego subió 2,37 MB con los props (S46; `dist` 11,03 MB tras S53: colocar los de l1 a l6 sumó 20 KB, solo los mapas; 11,36 MB tras S54: los dos atlas de l7, 272 KB, y los mapas de l7 y de la vitrina). Si molesta para itch.io o Google Play: cargar solo los atlas del nivel que se juega, o comprimir los PNG.
13. Los props de roca de l6 se ven más encendidos que el nivel (S53): traen pintada una luz de tarde cálida y saturada, y el cielo de l6 es de tormenta. Son los 7 de `l6_roca` colocados, en todo el nivel, no en un sitio: moverlos no lo arregla. Una sesión aparte podría teñir los props según la luz del sitio (por nivel o por zona, como el tinte del fondo). En l4 y l5 no pasa, y el único prop bajo techo en sombra (la roca del paso bajo la peña de l6) se movió.
14. Encargar los tilesets de los ocho biomas (Jose). Las medidas, el orden de los 26 tiles, el autotile, la paleta de cada bioma sacada de los fondos y qué probar primero están en las notas de S55 (`docs/PLAN.md`). Lo que más importa: el PNG mide exactamente 64 × 112 px (4 columnas × 7 filas de 16 px) y va a `public/assets/tiles/<bioma>.png` con el mismo nombre. Reemplazar un PNG entero borra el piso redibujado del 16 de octubre y el borde de las baldosas 23 y 24 de ese bioma (siguen en git, commit `cc72245`). Nada avisa si el orden está mal: el juego se ve mal y se juega igual. ASSETS §6 dice que un `raw/tiles/<bioma>.json` puede reordenar un tileset: ese paso no existe en el pipeline, el PNG tiene que venir ya en orden.

## itch.io

Sin resolver todavía:

- Subir el build de navegador (el mismo `dist/` de GitHub Pages).
- Página del juego.
- Capturas.
- Descripción.

## Google Play

Sin resolver todavía:

- **Prueba cerrada obligatoria:** 12 testers durante 14 días continuos, para cuentas personales creadas después del 13 de noviembre de 2023. Conviene arrancarla temprano: el plazo corre solo mientras se trabaja en otra cosa.
- Cuenta de desarrollador: US$25, pago único, con verificación de identidad.
- Empaquetado para Android.
- Política de privacidad.
- Clasificación de contenido.
- Íconos y capturas.

## Para cuando vayamos a Steam

- Demo de unos 30–40 minutos (nivel 1 y un pedazo del 2) que termine con «Wishlist el juego completo».
- Logros y mejores tiempos en el mapa. El guardado ya los tiene. No se muestran.
- Cápsula, trailer que abra con gameplay, control y Steam Deck.
- Portugués.

## Ideas sin fecha

Sin sesión asignada. No son pendientes para publicar.

- **Expansión del Chaco, después de publicar.** Dos niveles nuevos en el Chaco paraguayo (espinal seco, quebracho, el Impenetrable), con Pombero y Malavisión como jefes. Es una campaña aparte que se juega después de vencer a Tau, no parte de la historia de los siete hijos: la línea principal cierra con Tau. En una expansión el jugador ya sabe jugar, así que puede exigir desde el primer minuto, sin la obligación de enseñar que tuvo l1.

## No entra

- Acortar niveles.
- Energía, anuncios, cofres al azar y rachas diarias.
- Cambiar cómo se carga el tajo.
- Portugués antes de terminar el juego en el Paraguay.
- Pasar el juego a Unity para mejorar el piso. Phaser alcanza: la diferencia es el dibujo.
- El estilo pintado con curvas. Kerana sigue en pixel art de 16 píxeles.