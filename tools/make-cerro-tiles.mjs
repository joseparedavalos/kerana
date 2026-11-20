// S109: el tileset de cerro (l1). Desde S110 lo escribe tools/make-terrain-tiles.mjs, que sirve para cada bioma con arte
// por código; esto queda para `npm run cerro-tiles` y las notas viejas. Uso: node tools/make-cerro-tiles.mjs [--preview]
process.argv.splice(2, 0, 'cerro');
await import('./make-terrain-tiles.mjs');
