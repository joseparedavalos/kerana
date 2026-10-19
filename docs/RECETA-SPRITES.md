# Receta: encargar y conectar el sprite de un jefe

Salió de la cabeza de Moñái: S42 dio los datos técnicos, Jose generó las hojas en Grok y S43 las conectó. Sirve para los otros jefes, y para cualquier parte de un jefe que se quiera pasar de código a sprite.

El pipeline (`npm run sprites`) y el formato de `sprite.json` están en `docs/ASSETS.md` §2. La configuración de Grok y los prompts de cada jefe, en ASSETS §3.1 y §3.4. Esta receta es el orden de los pasos y las reglas que costaron una hoja.

---

## 1. El flujo

1. **Una sesión da los datos técnicos** (sección 2). Lee el código del jefe y deja la lista en sus notas de `docs/PLAN.md` y en el chat. No genera nada ni cambia el juego (S42 lo hizo junto con el cambio de color; puede ser una sesión corta solo para esto).
2. **Jose genera las hojas fuera del repo** (Grok u otra herramienta), con esos datos, la configuración de ASSETS §3.1 y las reglas de formato de la sección 3. Antes de subirlas, las revisa con la lista de la sección 3.
3. **Jose las sube a `raw/<jefe>/<parte>/`**, por ejemplo `raw/monai/head/`, con el nombre `<animación>_<columnas>x<filas>.png`. Si la hoja es del jefe entero, sin partes, va en `raw/<jefe>/`. Lo que hay en `raw/` no se edita después: si una hoja viene mal, se regenera.
4. **Una sesión las conecta:** escribe `raw/<jefe>/<parte>/sprite.json`, corre `npm run sprites` (sale `public/assets/sprites/<jefe>_<parte>.png` y su `.json`), suma la entrada a `CHARACTER_SPRITES` en `src/assets/manifest.ts`, cambia el archivo del jefe (`src/entities/bosses/<Jefe>.ts`) para que juegue cada animación en su estado y deja la versión por código como respaldo si el sprite no está. El encaje del sprite sobre la zona de daño va en `gameplay.ts`; la zona de daño no cambia. Saca capturas del antes y el después de cada estado (método de S20) y actualiza ASSETS (§3.4 y la checklist §10).
5. **Si una hoja tiene un problema que el código no resuelve,** la sesión no la arregla a mano: la deja afuera con `ignore` (sección 5), hace que sus animaciones salgan de otra hoja y anota en `PENDIENTES.md` qué hay que regenerar y qué cambia en `sprite.json` cuando llegue.

## 2. Qué datos pedir antes de generar nada

La sesión del paso 1 tiene que dar todo esto. Sin esta lista, la hoja sale de otro tamaño, con otra cara o con partes que el código ya dibuja. Es lo que dieron las notas de S42 para Moñái (entre paréntesis):

- **Qué parte y qué no.** Qué se encarga y qué sigue por código (la cabeza sí; el cuerpo de 14 segmentos y los cuernos, no). Ver la sección 4.
- **Tamaño en el juego,** en unidades del mundo, y el lienzo en píxeles de textura con `detail` 2 (la cabeza dibujada medía 38 × 34 unidades: 76 × 68 px). Ese lienzo es el `frame` de `sprite.json`.
- **La zona de daño:** cuánto mide y dónde cae dentro del dibujo, para que lo que se ve coincida con lo que golpea (26 × 18 unidades en el centro de la cabeza).
- **Los estados y qué cara tiene cada uno** (reposo con la boca cerrada; fauces abiertas mientras hace daño; ojo cerrado cuando queda aturdida). Un estado = una hoja.
- **Cuántos fotogramas por hoja y a qué velocidad** se van a usar, y si alguna animación abre y se queda quieta en el último cuadro (las fauces de Moñái).
- **Hacia dónde mira** (a la izquierda, como todos los jefes: el juego lo espeja).
- **La paleta,** con los colores en hexadecimal y de dónde salen (la de Moñái está en `GAMEPLAY.monai.palette`: cuerpo #e2732c, vientre #f6dcae, borde #3a1608, ojo #f2e04e…). Lo que se encarga tiene que pegar con lo que sigue por código.
- **La ruta y la clave:** `raw/<jefe>/<parte>/<animación>_<c>x<f>.png` → `<jefe>_<parte>` (`raw/monai/head/` → `monai_head`), y que hay que sumarla a `CHARACTER_SPRITES`.
- **El prompt** para ASSETS §3.4, con lo que no tiene que aparecer (`no horns, no neck`).

## 3. Reglas de formato

Salieron de S43. Revisá cada hoja con esta lista antes de subirla:

- **Siempre PNG, nunca JPG.** El JPG no tiene transparencia y emborrona los bordes: el contorno queda con colores mezclados que el pipeline no puede separar del fondo.
- **Nunca convertir un JPG a PNG con un editor.** No devuelve la transparencia: guarda lo que se ve. En S43 `raw/monai/head/idle_8x1.png` llegó con el damero gris y blanco pintado en los píxeles, todos opacos, y hubo que descartarla. Si la herramienta solo da JPG, se vuelve a generar con fondo magenta y se baja en PNG.
- **Fondo transparente de verdad, o magenta #FF00FF** para el chroma key. El pipeline solo quita esas dos cosas. Para comprobarlo, abrí la hoja sobre un fondo de color: si el damero sigue ahí, está pintado.
- **El nombre lleva el número real de fotogramas:** `idle_8x1.png`, `attack_10x1.png` (columnas × filas). El pipeline corta la hoja con ese número; si está mal, corta los fotogramas por la mitad.
- **Todos los fotogramas del mismo tamaño y dentro de su cuadro,** sin cortarse ni tocar el borde de la celda. Mismo dibujo, mismo estilo y misma escala en toda la hoja: en la `idle` de S43, los fotogramas 4 a 7 venían con otro estilo (sin el contorno negro) y el 7 llegaba al borde; en `attack`, las fauces abiertas salieron más chicas que la cabeza cerrada.
- **Solo la parte encargada.** Para Moñái: la cabeza mira a la izquierda, sin cuello, sin cuerpo y sin cuernos. Si aparece algo que el código dibuja aparte, queda duplicado.
- **Mismo contorno en todas las hojas del jefe.** La hoja `daze` de S43 no tenía el contorno negro de `attack` y se nota al pasar de un estado al otro.

## 4. Qué conviene encargar y qué no

**Encargar las partes rígidas:** las que se dibujan siempre iguales y solo se mueven, giran o se espejan enteras. La cabeza de un jefe, un jefe entero que se mueve como un bloque, un objeto que lleva en la mano.

**Dejar por código lo que sigue a otra cosa en cada cuadro:**

- Lo que se deforma o se acomoda según la posición: el cuerpo de Moñái es una cuerda de 14 segmentos que se enrosca en el tronco con dos capas; los cuellos de Teju Jagua son una curva entre el lomo y cada cabeza; las vueltas de Mbói Tu'ĩ salen del agua. Una hoja no sabe dónde está el tronco ni la cabeza.
- Lo que cambia de color como aviso: los cuernos de Moñái se tiñen iridiscentes antes del pulso. Si van pegados a la cabeza, el tinte pinta la cabeza entera.
- Los efectos: destello del golpe, estrellitas de mareo, halos, partículas, el fuego, el agua.

Si una parte está entre las dos, la sesión de datos lo decide y lo deja escrito antes de generar.

## 5. Dejar afuera una hoja defectuosa: `sheets.<hoja>.ignore`

S43 agregó esta opción al pipeline (con su prueba). Con `"ignore": true` la hoja no se procesa y el resto del personaje se genera igual. Las animaciones que dependían de ella salen de otra hoja con `source`. Así quedó Moñái mientras falta la `idle`:

```json
"sheets": {
  "idle": { "ignore": true },
  "attack": { "align": "top", "anchor": "cell" },
  "daze": { "align": "top", "anchor": "cell" }
},
"anims": {
  "idle": { "source": "attack", "list": [0], "fps": 1, "loop": true },
  "attack": { "frames": [1, 6], "fps": 16 },
  "daze": { "fps": 6, "loop": true }
}
```

El reposo es el fotograma 0 de `attack` (boca cerrada), quieto. Cuando llegue la hoja nueva: se saca el `ignore` (la hoja pasa a `{ "align": "top", "anchor": "cell" }`, como las otras), la línea `idle` de `anims` queda `{ "fps": 8, "loop": true }` y se corre `npm run sprites`. El archivo malo no se borra hasta que esté el nuevo: el pipeline lo ignora.

## 6. Qué le falta a cada jefe

Los ocho tienen una hoja de reposo en `raw/` (S13b), que el juego dibuja encima de su placeholder con `SpriteSkin`. Hoy (S45):

| Jefe | Hojas en `raw/` | Ataque y estado vulnerable hoy | Qué se puede encargar |
|---|---|---|---|
| Teju Jagua | `teju_jagua/head/idle_8x1` (cabeza con cuello) | Por código: el juego tiñe la cabeza de 7 colores y la oscurece al dormir; el fuego, los cuellos, el halo y las estrellitas de cabeza expuesta se dibujan | Mordida (attack) y cabeza expuesta (hurt) de la cabeza, sin cuello si la sesión de datos lo pide así |
| Mbói Tu'ĩ | `mboi_tui/idle_8x1` (cabeza y cuello) | Tintes: el cuello se hincha y se tiñe de celeste antes del escupitajo y destella al recibir el golpe; el agua y las vueltas, por código | Graznido con el pico abierto (attack) y golpeada (hurt) |
| Moñái | `monai/head/` `attack_10x1`, `daze_8x1` (e `idle_8x1`, ignorada) | Con hojas propias desde S43 | **Regenerar `idle_8x1` con transparencia** (pendiente 8 de `PENDIENTES.md`) |
| Jasy Jatere | `jasy_jatere/idle_8x1` | Tintes: se aclara al volverse invisible, el bastón brilla en el aviso de chispas, destello blanco al golpe | Run, attack (chispas con el bastón), hurt y la variante sin bastón (`raw/jasy_jatere/nostaff/`) |
| Kurupi | `kurupi/idle_8x1` | Tintes y destello blanco | Run, attack (pisotón o silbido) y hurt |
| Ao Ao | `ao_ao/run_8x1` (su hoja de reposo es la carrera) | Tintes y destello blanco | Idle quieto, attack (erguido en dos patas, zarpazo) y hurt |
| Luisón | `luison/idle_8x1` | Tintes y destello blanco | Run, attack (lanzar), hurt y la pose de aullido sobre la lápida |
| Tau | `tau/disguise/idle_10x1` y `tau/true/idle_4x2` | Tintes y destello blanco, en las dos formas | Attack (flauta; garras de humo) y hurt de cada forma |

Jasy Jatere, Kurupi, Ao Ao, Luisón y Tau son la lista de lo que se puede encargar a continuación: no tienen hojas propias de ataque ni de estado vulnerable, y en los cinco el sprite es el jefe entero (una parte rígida). Los prompts ya están en ASSETS §3.4. Cada uno pasa por los cinco pasos de la sección 1, empezando por la sesión que da los datos: el tamaño, el lienzo y los estados de cada jefe están en su archivo de `src/entities/bosses/` y en `CHARACTER_SPRITES`, no en esta tabla.
