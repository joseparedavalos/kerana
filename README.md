# Kerana: Pokõi Mbyja

Juego de plataformas 2D para navegador inspirado en la mitología guaraní del Paraguay. Kerana despierta tras siete años de sueño embrujado y recorre siete lugares del país para liberar a sus siete hijos de la maldición de Tau.

Hecho con Phaser 4, Vite y TypeScript, y desarrollado con Claude Code.

- **Jugar:** (enlace de GitHub Pages, cuando esté activo)
- **Diseño del juego:** [docs/GDD.md](docs/GDD.md)
- **Plan de producción:** [docs/PLAN.md](docs/PLAN.md)
- **Assets:** [docs/ASSETS.md](docs/ASSETS.md)

## Correr en local
Requiere Node.js LTS.

```
npm install
npm run dev        # abre http://localhost:5173/
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run build` | Revisa tipos y genera `dist/` |
| `npm run preview` | Sirve `dist/` |
| `npm test` | Pruebas de lógica (Vitest) |
| `npm run maps` | Convierte `tools/levels/*.txt` en mapas de Tiled (`public/assets/maps/`) |
| `npm run tiles` | Genera los tilesets placeholder (`--force` para reemplazar los existentes) |
| `npm run smoke` | Prueba de humo con Chrome/Chromium headless (después de `build`; ruta en `CHROME_PATH` si no lo encuentra) |

Los valores de sensación (velocidad, salto, cámara…) están en `src/config/gameplay.ts`: cambialos y recargá.

## Parámetros de depuración
Funcionan siempre en `npm run dev`; en la versión publicada, solo si la URL incluye `debug=1`.

| Parámetro | Efecto |
|---|---|
| `debug=1` | Hitboxes, FPS y estado de Kerana (abajo a la izquierda) |
| `level=test` o `level=1..7` | Empieza directo en ese nivel (por ahora solo existe `test`) |
| `boss=1` | Empieza en la antesala del jefe (desde S6) |
| `gifts=all` | Todos los dones (desde S2/S6) |
| `god=1` | Kerana no recibe daño (desde S2) |

Ejemplos: `http://localhost:5173/?level=test&debug=1` · publicado: `https://<usuario>.github.io/kerana/?debug=1&level=test`

Controles actuales: ← → o A D para moverse; Espacio, Z o K para saltar (mantener = más alto); Enter en el título.

Más detalles en [docs/GDD.md §11.11](docs/GDD.md).

## Créditos
Idea y dirección: Jose. Assets de terceros y sus licencias: `CREDITS.md`.
