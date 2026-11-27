# Música en archivo (S119)

Cada `<clave>.mp3` de esta carpeta suena en streaming en lugar de la pista generada con ZzFX.
Si agregás o cambiás un MP3, corré `npm run music-points` (necesita ffmpeg): mide dónde empieza a sonar
y dónde empieza su fundido final, y lo anota en `src/data/musicFiles.ts`. Sin eso, el test falla.
