# Tilesets de l6 y l7

La nota de cómo se armaron está en docs/ASSETS.md, sección 6, «Piso de l6 y l7».

No correr `npm run tileset -- cerro` ni `npm run tileset -- ciudad`: faltan `especiales.jpg` y `espinas.jpg`, y el nivel 6 no lee `cerro.png`. Lee `public/assets/tiles/montana.png`. El nivel 7 lee `public/assets/tiles/ciudad.png`.

## Ciudad: no correr el script con este `tileset.json` (S88, 10 de noviembre de 2026)

`raw/tiles/ciudad/tileset.json` copia la receta de campo: el borde de arriba sale de una franja de `grass.rows` = 7 filas de `pasto.jpg`. En ciudad `pasto.jpg` es una vela sobre fondo blanco, no una franja de pasto: el fondo se vuelve aire y las casillas de borde (0, 2, 4, 6, 8, 10, 12, 14) quedan con las 7 primeras filas transparentes. La colisión está en el borde del tile, así que todo flota 7 px sobre el empedrado. Pasó en el commit `075e526` («Espinas de l7»).

`public/assets/tiles/ciudad.png` está armado a mano: casillas 0 a 18 del commit `030971f` (el piso aprobado) y casillas 19 a 27 de `075e526` (la 19 es la reja oxidada de `espinas.jpg`). Para cambiar una casilla, se copia esa casilla sobre el PNG; no se regenera la hoja entera.

`tests/tilesetTopEdge.test.ts` falla si un tileset deja más de 3 filas vacías arriba de una casilla de borde.
