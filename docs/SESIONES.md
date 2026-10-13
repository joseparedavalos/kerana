# Plan de sesiones: de acá a Google Play

Fecha: 13 de octubre de 2026. Primero Google Play. Steam después, con el feedback de la tienda.

Esto es un plan. No se aplica nada de acá hasta que se diga.

## Decisiones cerradas

- Los niveles se quedan largos. No se acortan a 10–15 minutos.
- No hay energía, anuncios, cofres al azar ni rachas diarias.
- Las plumas pasan a ser chipa. El sprite ya está generado. La pluma se siente nativa americana.
- El ataque automático, si entra, va apagado en Opciones.
- Portugués, demo, logros, mejores tiempos visibles, control, Deck, cápsula y trailer quedan para Steam.

## Qué ya está

- El prólogo se salta. En el celular hay un Saltar arriba a la derecha.
- Si hay partida, el título ofrece Continuar y Nueva partida.
- Los carteles del nivel 1 dicen una sola cosa.
- La pantalla de nivel completado ya muestra el hijo, el don y las plumas, pero solo como texto, y solo vuelve al mapa.
- El guardado ya tiene `bestTimes` por nivel. No se muestra.
- Hay opción de sacudida de cámara. El sable tiene unas chispas. El polvo de la carrera y las abejas ya son partículas.
- El mapa muestra una estrella en el nodo completado y las plumas en el panel, no bajo el nodo.

## Sesiones para Google Play

Cada sesión es un pull request. Se hace de a una, sobre `main`.

### Sesión 1. Diálogos de liberación — hecho

Kerana dice una sola frase y el hijo sube como estrella. No hay charla.

- «Estás libre de la maldición, [nombre].» En inglés: «You are free of the curse, [name].»
- Tau no se libera. Kerana dice: «Dormí, Tau. Y no despiertes.»
- El prólogo dice por qué se levanta: Tau sigue usando a sus hijos, y Angatupyry le enciende la luz para ir a buscarlos. Sin político.

La pista del próximo jefe no está en el diálogo. Queda para más adelante, si hace falta.

### Sesión 2. Partículas y peso — hecho

El tajo normal suelta chispas blancas y una sacudida corta. El cargado suelta un destello dorado, más chispas y una sacudida más fuerte. La forma de cargarlo no cambió.

- Polvo al aterrizar y estela en el dash.
- Al golpear, chispas en el enemigo. El empujón y el destello blanco ya estaban.
- Los sonidos de tajo, tajo cargado, caída y dash ya estaban.
- La sacudida se apaga en Opciones.

### Sesión 3. Chipa en lugar de pluma — hecho

La chipa de José reemplaza a la pluma en el nivel, en el contador y bajo cada nodo del mapa. El guardado sigue llamándose `feathers`, así que las partidas no se borran. El final de las 21 se mantiene.

### Sesión 4. Pantalla de nivel completado

Depende de la sesión 3.

- El hijo liberado, el don y las chipas se ven juntos, no solo como tres líneas.
- Botón grande de Siguiente, además de Volver al mapa.
- Siguiente entra al próximo nivel desbloqueado. En el último, sigue a Yvága como ahora.
- Deja lugar para sumar otras zonas del Paraguay más adelante, sin rehacer la pantalla.

### Sesión 5. Controles del celular

- Poder mover y agrandar los botones, y que se guarden.
- Ataque automático cerca del enemigo, en Opciones, apagado de fábrica.
- El botón de pausa no tapa el juego.

No cambia las reglas. Solo cómo se toca.

### Sesión 6. Ficha de Google Play

- Ícono que se lea en chiquito: Kerana y el sable.
- 5 capturas: título, un nivel, un jefe, el mapa, la pantalla de completado.
- Descripción corta: «Plataformas pixel art. Liberá a los siete hijos de Kerana en el Paraguay.»
- Edad, privacidad, y que se juega sin internet.

Esto se arma cuando las sesiones 1 a 5 ya se sienten bien.

## Después de publicar

Cuando haya feedback de Google Play:

| Sesión | Qué |
|---|---|
| 7 | Demo de Steam: nivel 1 y un pedazo del 2, con Wishlist al final |
| 8 | Logros y mejores tiempos en el mapa, para el speedrun |
| 9 | Control, Steam Deck, cápsula y trailer |
| 10 | Portugués |

## Qué no entra

- Acortar niveles.
- Energía, anuncios, cofres al azar, rachas diarias.
- Cambiar la usabilidad del tajo cargado.
- Portugués antes de terminar el juego.
