# Tilesets de l6 y l7

La nota de cómo se armaron está en docs/ASSETS.md, sección 6, «Piso de l6 y l7».

No correr `npm run tileset -- cerro` ni `npm run tileset -- ciudad`: faltan `especiales.jpg` y `espinas.jpg`, y el nivel 6 no lee `cerro.png`. Lee `public/assets/tiles/montana.png`. El nivel 7 lee `public/assets/tiles/ciudad.png`.
