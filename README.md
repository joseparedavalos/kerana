# Kerana

Pokõi ñemoñare. Kerana y las siete criaturas.

Juego de plataformas 2D para navegador inspirado en la mitología guaraní del Paraguay. Kerana despierta tras siete años de sueño embrujado y recorre siete lugares del país para liberar a sus siete hijos de la maldición de Tau.

Hecho con Phaser 4, Vite y TypeScript.

- **Jugar:** [joseparedavalos.github.io/kerana](https://joseparedavalos.github.io/kerana/)
- **Diseño del juego:** [docs/GDD.md](docs/GDD.md). Las decisiones del 13 de octubre pisan los capítulos viejos.
- **Qué falta para publicar:** [docs/PENDIENTES.md](docs/PENDIENTES.md)
- **Plan de sesiones:** [docs/SESIONES.md](docs/SESIONES.md)
- **Plan de producción (historial):** [docs/PLAN.md](docs/PLAN.md)
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
| `level=1` … `level=7`, `level=8` o `level=yvaga` | Empieza en ese nivel. `8` es Yvága. También valen `l1` y `test` |
| `boss=1` | Empieza en la antesala del jefe |
| `gifts=all` | Fuerza los dones. El tajo, el salto doble y el dash ya están desde el inicio |
| `god=1` | Kerana no recibe daño |

Ejemplos: `http://localhost:5173/?level=1&debug=1` · publicado: `https://joseparedavalos.github.io/kerana/?debug=1&level=1`

En la computadora: ← → o A D para moverse; Espacio, Z o K para saltar (mantener = más alto); X o J para el sable; C, L o Shift para el dash. En el celular hay botones. Se pueden mover desde Opciones. Varios dedos funcionan a la vez.

Más detalles en [docs/GDD.md §11.11](docs/GDD.md).

## Créditos
Idea y dirección: Jose. Assets de terceros y sus licencias: `CREDITS.md`.
