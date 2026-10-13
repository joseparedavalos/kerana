# Plan de sesiones: de acá a Google Play

Fecha: 13 de octubre de 2026. Revisado esa misma noche, con lo que ya está en `main`.
Primero Google Play. Steam después, con el feedback de la tienda.

## Decisiones cerradas

- Los niveles se quedan largos. No se acortan a 10–15 minutos.
- No hay energía, anuncios, cofres al azar ni rachas diarias.
- Las plumas pasan a ser chipa. El guardado sigue llamándose `feathers`, así que las partidas no se borran. La pluma se siente nativa americana.
- El ataque automático va apagado en Opciones. Solo pega cuando el sable ya llegaría.
- El tajo cargado, el salto doble y el dash están desde el primer nivel. El corazón nuevo sigue creciendo al liberar a Mbói Tu'ĩ, Kurupí y Ao Ao.
- El corazón cura. El tereré, la guampa de cuero, da la inmunidad. No es un cuerno.
- Portugués, demo, logros, mejores tiempos visibles, control, Deck, cápsula y trailer quedan para Steam.

## Sesiones para Google Play

Cada sesión fue un pull request sobre `main`.

### Sesión 1. Diálogos de liberación — hecho

Kerana dice una sola frase y el hijo sube como estrella. No hay charla.

- «Estás libre de la maldición, [nombre].» En inglés: «You are free of the curse, [name].»
- Tau no se libera. Kerana dice: «Dormí, Tau. Y no despiertes.»
- El prólogo dice por qué se levanta: Tau sigue usando a sus hijos, y Angatupyry le enciende la luz para ir a buscarlos. Sin político.
- En el prólogo hay figuras. Kerana mira a la derecha. Tau queda a su altura.

La pista del próximo jefe no está en el diálogo. Queda para más adelante, si hace falta.

El prólogo se salta. En el celular hay un Saltar arriba a la derecha. Si hay partida, el título ofrece Continuar y Nueva partida.

### Sesión 2. Partículas y peso — hecho

El tajo normal suelta chispas blancas, un arco visible y una sacudida corta. El cargado suelta un destello dorado, más chispas y una sacudida más fuerte. La forma de cargarlo no cambió.

- Polvo al aterrizar y estela en el dash.
- Al golpear, chispas en el enemigo. El empujón y el destello blanco ya estaban.
- Los sonidos de tajo, tajo cargado, caída y dash ya estaban.
- La sacudida se apaga en Opciones.

### Sesión 3. Chipa en lugar de pluma — hecho

La chipa de José reemplaza a la pluma en el nivel, en el contador y bajo cada nodo del mapa. El final de las 21 se mantiene.

### Sesión 4. Pantalla de nivel completado — hecho

El hijo liberado y las chipas se ven juntos. El corazón nuevo se anuncia, porque ese sí crece. El botón grande Siguiente entra al próximo nivel. En el último sigue a Yvága. Volver al mapa queda aparte.

Los carteles del nivel 1 dicen una sola cosa: el botón y el verbo.

### Sesión 5. Controles del celular — hecho

En Opciones, Mover botones: se arrastran y se agrandan, y quedan guardados. El ataque automático está apagado de fábrica. La pausa es chica, en la esquina, y se esconde mientras el menú está abierto. Varios dedos funcionan a la vez, también en el iPhone. El salto y el sable no cambian.

## Lo que se sumó el mismo día

No estaba en las cinco sesiones. También está en `main`.

- Hongos con sombrero, manchas y tallo.
- Nivel 1, el piso: se probaron un cántaro y unas piedras. Parecían un tacho. Se sacaron. En la ladera hay musgo. En la cueva no hay plantas. El piso es una franja de tres baldosas y detrás se ve el cerro o la cueva. Se pisa igual. En los niveles 2 a 6 los bloques también son una cáscara, pero el piso que llega abajo del mapa se dibuja entero. El 7 y Yvága no.
- Teju Jagua: las siete cabezas son del mismo marrón que el lomo. Los ojos siguen encendidos. No van de colores.
- Al liberar, el cuadro muestra la cara de Kerana, recortada del sprite que ya está en el juego. Mira hacia el texto. Cabe entera: cara, vincha y hombros. No es un retrato pintado.
- Al caer, la cámara llega con ella. Al caminar sigue suave.

## Detalle del escenario

Un nivel por vez, antes de la ficha de la tienda. Nada de esto choca ni cambia el salto. Primero el borde del piso, después dos objetos sueltos.

| Nivel | Lugar | Borde | Objetos | Estado |
|---|---|---|---|---|
| 1 | Paraguarí, cueva | musgo en la ladera; en la cueva, piedra gris; el piso es una franja | ninguno: el cántaro y las piedras no se entendían | hecho |
| 2 | Ñeembucú, estero | pasto y juncos | canoa y nido | pendiente |
| 3 | Misiones, campo | pasto y una flor | tacurú y alambrado | pendiente |
| 4 | Capiatá, pueblo | baldosa y alero | hamaca y silla | pendiente |
| 5 | Canindeyú, selva | raíz y hoja | liana y tronco | pendiente |
| 6 | Guairá, cerro | laja con pasto | palma y rocas | pendiente |
| 7 | Asunción, noche | losa y vela | cruz y ramo seco | pendiente |

### Sesión 6. Ficha de Google Play — pendiente

- Ícono que se lea en chiquito: Kerana y el sable.
- 5 capturas: título, un nivel, un jefe, el mapa, la pantalla de completado.
- Descripción corta: «Plataformas pixel art. Liberá a los siete hijos de Kerana en el Paraguay.»
- Edad, privacidad, y que se juega sin internet.

Esto se arma cuando el detalle de los niveles 2 a 7 ya se siente bien, o cuando José diga que alcanza con el 1.

## Después de publicar

Cuando haya feedback de Google Play:

| Sesión | Qué | Estado |
|---|---|---|
| 7 | Demo de Steam: nivel 1 y un pedazo del 2, con Wishlist al final | pendiente |
| 8 | Logros y mejores tiempos en el mapa, para el speedrun | pendiente |
| 9 | Control, Steam Deck, cápsula y trailer | pendiente |
| 10 | Portugués | pendiente |

El guardado ya tiene `bestTimes` por nivel. No se muestra. Queda para la sesión 8.

## Qué no entra

- Acortar niveles.
- Energía, anuncios, cofres al azar, rachas diarias.
- Cambiar la usabilidad del tajo cargado.
- Portugués antes de terminar el juego.
- La cámara lenta y la violencia de Katana Zero. Kerana libera, no mata.
- La dificultad seguida de Celeste. En el teléfono un salto justo está bien. Diez seguidos, no.

## Pull request que sigue abierto

El [pull request #73](https://github.com/joseparedavalos/kerana/pull/73) saca un verde que todavía está pintado en la piedra del nivel 1. La cueva ya se ve bien sin plantas. Si sigue viéndose gris, ese PR se cierra sin mergear. Si aparece una línea verde en la roca, se mergea.
