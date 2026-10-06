# RECETA · Cómo rediseñar un nivel (S19, hecha sobre l1)

El procedimiento que se siguió en S19 para rehacer l1 (Paraguarí). Sirve para rediseñar l2 a l7 sin inventar el método: cambian los datos del nivel, no los pasos. Vocabulario (grupo de ritmo, cadencia, celda, portal, los cinco componentes): `docs/REVIEW.md` §0.

---

## 0. Qué tener a mano antes de dibujar

**Leer:** la ficha del nivel en `docs/REVIEW.md` (Parte 1), su sección del GDD (§6.x), GDD §11.7.1 (sintaxis ASCII) y la vitrina de S18 (`tools/levels/vitrina.txt`, `?debug=1&level=vitrina&gifts=all`).

**Alcances de Kerana** (de `gameplay.ts`; no se cambian al rediseñar):

| Qué | Valor | Para qué sirve |
|---|---|---|
| Cuerpo | 1 × 2,6 tiles | un pasillo mide al menos 4 filas; si hay que saltar adentro, **6** (con 4 el techo corta el salto y no se pasan ni 2 tiles de espinas) |
| Salto | 4,17 tiles de alto; 6,25 de largo a la misma altura | pared o escalón obligatorio: **≤ 3**. Algo que NO debe alcanzarse saltando: **≥ 5** arriba |
| Hueco a la misma altura | el centro viaja ≈ 5,8 tiles; el cuerpo ya apoya con 1 px | un hueco de **N** tiles de aire pide **N − 1** de viaje. Para que algo quede fuera de alcance desde un borde, **≥ 8 tiles de aire** |
| Hongo | 7,6 tiles (medido en el smoke: 126 px = 7,9) | repisa a la que solo se llega con el hongo: 5 a 7 tiles por encima del hongo |
| Caída | sin daño | una caída de 10 tiles es un camino válido (se usó para pasar de la galería 1 a la 2) |
| Onda del tajo cargado | la luz llega ≈ 6 tiles aunque haya pared | piedra encerrada a ≤ 6 tiles de donde se para Kerana, detrás de 1 tile de roca |

**Piezas (S18):** `-` plataforma de un solo sentido (las sólidas `+` pueden trabar a Kerana contra un techo: no usarlas), `:` recorrido, `*` piedra (Switch), `|` reja, `M` hongo (`kind=once` o `kind=sleep`). Propiedades con `at X,Y …`. Un hongo **también rebota si se llega caminando**: cualquier hongo en el piso del camino lo pisa todo el que pasa (ver errores, §5).

---

## 1. Orden de trabajo

1. **Medir el nivel viejo.** Con el piloto del smoke (`tools/lib/pilot.mjs`) y un plan de un solo paso (`{ run: 1, untilFight: true }`), copiando el JSON viejo (`git show HEAD:public/assets/maps/lN.json`) sobre `dist/assets/maps/` después de `npm run build`. Es la base para decir cuánto se ganó. l1: **22,2 s**.
2. **Listar las mecánicas** del nivel en dos columnas: las que se enseñan (nuevas para el jugador) y las que solo se exigen. Para cada nueva, anotar su pareja: dónde se presenta sin riesgo y dónde se exige (principio 1); y su repetición: sobre suelo firme y después sobre un pozo (principio 2). En l1: pozo, plataforma, piedra y hongo eran nuevos.
3. **Fijar lo que no se toca:** el inicio (en l1, la cueva A y la salida, x 0–61) y la antesala con la arena, copiadas columna por columna y corridas a la derecha (l1: x 176–239 → x 250–313). El alto del mapa no se cambió: `shiftY` del fondo está calibrado para él.
4. **Esqueleto:** el perfil del suelo (en qué fila se pisa en cada tramo: G9, G13, G8…), las secciones y los fuegos. Buscar alto antes que ancho: l1 creció 74 tiles de ancho pero el tiempo se duplicó por la ruta doble y la cueva en zigzag.
5. **Grupos de ritmo** dentro de cada sección (§2), con su cadencia.
6. **Ruta alternativa y desvío** (§3).
7. **Plumas, al final** (§4): cuando ya se sabe dónde están los saltos difíciles y las rutas.
8. **Escribir la grilla con un generador** (script en el scratchpad, no en el repo): parte del `.txt` viejo de `git show HEAD:…` y aplica `fill(x0, x1, y0, y1, ch)` y `put(x, y, ch)` por pieza, con un comentario por línea. Así se mueve una pieza cambiando un número. La salida va a `tools/levels/lN.txt` (cabecera + grilla) y después `npm run maps`. Verificar con `git status` que solo cambió `lN.txt`/`lN.json`.
9. **Plan del piloto** (`tools/lib/pilot-plans.mjs`) y correr las dos rutas. Leer el log de saltos (`salto en x … pared/hueco/espinas`) y el rastro (x y pies cada 100 ms). Si el piloto hace algo que haría un jugador (subirse a una repisa, caer en un hongo), **se corrige el mapa**, no el piloto.
10. **Smoke:** inventario de piezas, recorrido entero hasta "Nivel completado", ruta alta con su pluma y las piedras del rejugar. Tres corridas.
11. **Documentar:** cabecera del `.txt` (secciones y piezas con x), GDD §6.x, PLAN.

---

## 2. Secciones, grupos de ritmo y cadencias

**Cuántos:** 2 grupos en A (enseñar sin presión), 5–6 en B (desarrollo) y 4–5 en C (giro). Cada grupo mide **10–25 tiles** y pide **una cosa nueva o una combinación de dos ya vistas**. Nunca más de 25 tiles sin desafío ni más de dos grupos seguidos sin una cadencia.

**Cómo se marca una cadencia** (en orden de fuerza): un fuego; un cambio de pantalla (boca de cueva, subida a una cima); un llano de **≥ 4 tiles** sin nada; un cambio de altura que obliga a pararse (esperar una plataforma). Se anotan en la tabla del nivel con su x.

**l1 tal como quedó** (x en tiles; G = fila que se pisa):

| # | Tiles | Qué pide | Cadencia |
|---|---|---|---|
| A1 | x 1–24 | escalón de 2, primer teju'i, bloque de 3 | llano x 25–29 |
| A2 | x 25–44 | piedra temporizada (opcional, pluma A), liana | salida de la cueva x 45 |
| B1 | x 45–61 | teju'i, roca de 3, mbopi | escalón a la meseta x 62 |
| B2 | x 62–86 | zanja segura (x 67–69) y pozo 1 (x 76–78) del mismo ancho | llano x 79–86 |
| B3 | x 87–101 | piedra y reja bajo el arco (x 91 / x 94), cartel | **fuego x 101** |
| B4 | x 102–117 | foso con plataforma (x 104–113), mbopi | borde x 114–116 |
| B5 | x 117–136 | piedra que arranca la balsa sobre el pozo 2 (x 118–129) | llano x 130–136 |
| B6 baja | x 137–178 | Luz de Arasy, 4 teju'i, hongo de un uso para subir (x 177–178) | cima x 179 |
| B6 alta | x 145–178 | hongo del hoyo (x 146–147), repisas, guavirá, pluma B, mbopi | cima x 179, **fuego x 184** |
| C1 | x 190–216 | boca, cartel, estalactita, espinas | llano x 212–216 |
| C2 | x 217–244 | estalactita, teju'i, estalactita, hueco a la galería 2 (secreto tras la liana x 245) | la caída a G22 |
| C3 | x 244 → 205 | galería 2 hacia la izquierda: teju'i, estalactita, espinas, estalactita, piedra encerrada | borde del pozo vertical |
| C4 | x 200–210 | plataforma vertical sobre el pozo (x 200–203) | galería 3, x 204–210 |
| C5 | x 211–249 | teju'i, estalactita, espinas | **antesala x 250** |

---

## 3. Pozos, plataformas, piedras y fuegos

- **Fuego antes de la primera tanda que puede costar corazones en serie.** En l1 el fuego de x 101 queda justo antes del foso y del pozo 2. Si el nivel pasa de ≈ 280 tiles, tres fuegos (l1 tiene x 101, x 184 y la antesala). Ningún pozo en los 10 tiles después de un fuego: el jugador que vuelve necesita un momento.
- **Pozo:** siempre con un llano antes (≥ 4 tiles, para tomar carrera) y otro después (≥ 4, para aterrizar y descansar). Su pareja segura es una **zanja del mismo ancho con piso 2 filas abajo**, 5–6 tiles antes. Un pozo es una columna vacía hasta la última fila: caer cuesta 1 corazón y vuelve al último suelo firme.
- **Plataforma móvil:** primero sobre un **foso con piso** (caerse es salir caminando por un escalón de 3), después sobre un pozo y **un tile más ancha** (3 → 4). La vertical va al final, sobre un pozo, con espera larga en los extremos (`waitMs=1200`) y al ras del piso en las dos puntas. Velocidad 40–60 px/s.
- **Piedras:** la primera obligatoria y sin riesgo (reja), con cartel. La segunda combina dos cosas ya enseñadas (piedra + plataforma). La temporizada es opcional y paga una pluma. La encerrada queda a la vista en el camino de la primera pasada y se usa al rejugar. Con `mode=run` la plataforma sale **apenas** se golpea la piedra: ponerla pegada al borde, así se sube caminando mientras arranca despacio.
- **Hongo:** el de un solo uso se presenta como entrada a la ruta opcional (sin riesgo) y se exige al final de la ruta baja (pared de 5). El dormido, solo para rejugar (pide el tajo cargado).

---

## 4. Dónde va cada pluma

1. **Una por sección** (A, B y C, GDD §6.0) y **cada una con un verbo distinto**. Listar los verbos del nivel (primera pasada y rejugar) y repartirlos. l1: A **atacar** (piedra temporizada, carrera hasta el nicho), B **saltar** (sobre el hueco más alto de la ruta alta), C **tajo cargado** (piedra encerrada y hongo dormido).
2. **Cada pluma guía o paga.** La que paga va **en el arco del salto arriesgado**: calcular a qué altura pasa Kerana en esa x con un salto completo (l1: hueco x 162–164, pies en la fila ≈ 4,4 → pluma en x 163, fila 4). La que guía queda a la vista desde el camino principal, apuntando a la ruta. La del don posterior queda **visible pero cerrada** (reja de la cámara, nicho enrejado) para que el jugador se acuerde de volver.
3. **Comprobar que no se llega por otro lado** con la tabla de alcances (§0): l1-B no se alcanza desde la meseta, l1-C no se alcanza saltando desde el piso de la cámara (5 filas).
4. Los índices de las plumas salen por filas (S17). Si se mueve una `F` de fila en un nivel ya jugado, el guardado puede marcar como recogida otra: anotarlo en el PR.

---

## 5. Errores en los que caí y cómo los corregí

1. **El generador leyó su propia salida.** Al regenerar desde `tools/levels/l1.txt` ya reescrito, se copiaron las piezas nuevas encima de sí mismas (`npm run maps` avisó: "Hay 4 plumas"). Corrección: el generador lee siempre el original de `git show HEAD:…`.
2. **La repisa opcional quedaba en el camino.** La repisa de la pluma A estaba 2 filas sobre el bloque de la cueva: el salto natural para bajar del bloque terminaba arriba de ella. Corrección: 3 filas sobre el bloque (solo se llega con un salto completo y a propósito).
3. **La ruta alta se alcanzaba con un salto largo** desde la meseta: con 6 tiles de aire el centro solo viaja 5 y el salto da 5,8. Corrección: 8 tiles de aire.
4. **Un hongo en el piso elige por el jugador.** El hongo de entrada a la ruta alta estaba en el pasillo: quien bajaba caminando de la meseta caía justo encima (la caída de 4 filas avanza ≈ 3 tiles) y subía sin querer. Corrección: el hongo va en un **hoyo** de 2 × 2 debajo de la primera repisa; la ruta baja lo salta como un hueco y quien se deja caer rebota derecho a la repisa.
5. **La balsa se iba sin Kerana.** Con `mode=run` sale al golpear la piedra; el piloto esperaba que volviera (5,7 s). Corrección: piedra pegada al borde; se sube caminando mientras arranca.
6. **La boca de la cueva era muy baja** para entrar caminando desde la cima: la cabeza chocaba con el techo. Corrección: la boca abre desde la fila 4 y el techo baja a la fila 7 recién dentro de la galería.
7. **El piloto creía estar en el piso** al pasar por un pickup o un enemigo: `body.touching.down` también se enciende por un overlap. Corrección (en el piloto): solo cuentan `blocked.down` y las plataformas. **Ojo:** `Player` usa la misma condición; puede que Kerana salte en el aire al tocar un pickup desde arriba (sin verificar en la jugadora, ver notas de S19).

---

## 6. Qué cambiar para un nivel que no es el primero

l1 enseña; los demás pueden exigir desde el principio.

- **Lo que ya se enseñó no se vuelve a presentar sin riesgo.** Pozos, plataformas, piedras y hongos ya están vistos en l1: en l2 pueden aparecer directamente sobre un pozo. Solo **la idea nueva del nivel** (camalotes en l2, viento en l3, niebla en l4…) sigue la pareja seguro → obligatorio y la repetición suelo firme → pozo.
- **El don del nivel anterior se exige en el camino principal** (REVIEW, hueco 2), una vez por sección: en l2, una piedra encerrada **en** el camino (el tajo cargado ya se tiene); en l4, saltos que piden el salto doble; en l5, el dash. La piedra encerrada y el hongo dormido dejan de ser "para rejugar".
- **Amenazas a la vez:** hasta 2 en l2–l3, hasta 3 desde l4. En l1, nunca 3.
- **Huecos:** l1 ≤ 4 tiles a la misma altura en el camino principal; desde l2, hasta 5; desde l3 (salto doble), hasta 8 si hay un descanso antes.
- **Grupos de ritmo:** la misma cantidad por sección, pero más cortos (10–15 tiles) y con cadencias más cortas (llanos de 3).
- **Plumas:** hasta l4, al menos una pide un don posterior (GDD §6.0). Las otras dos pagan un riesgo del propio nivel.
- **Fuegos:** la misma regla (antes de la primera tanda que cuesta corazones; tres si el nivel pasa de ≈ 280 tiles).
- **Antesala y arena:** copiarlas tal cual, corridas, salvo que la sesión pida tocarlas. Ajustar en el smoke el chequeo de `boss=1` (rango de x de la antesala) y cualquier coordenada del nivel.
- **Medir antes y después** con el piloto (§1, pasos 1 y 9) y anotar las dos cifras.

---

## 7. Lista de cierre

- [ ] Pozos, plataformas, piedras y hongos que pide la sesión, contados en el smoke (inventario).
- [ ] Cada pieza nueva con su presentación sin riesgo antes de exigirse (solo l1 o la idea nueva del nivel).
- [ ] Ruta alternativa de 30–50 tiles: la alta paga más y caerse de ella deja en la baja.
- [ ] Nada que haya que saltar mide más de 3 tiles, salvo que haya otro camino (hongo, plataforma).
- [ ] Tres plumas, tres verbos, cada una guía o paga; ninguna al alcance por otro lado.
- [ ] Plan del piloto para la ruta principal (y la alta), tiempo medido antes y después.
- [ ] `npm run maps`, `npm run build`, `npm test` y tres `npm run smoke` seguidos.
- [ ] Ningún otro `.txt` ni valor de `gameplay.ts` tocado (`git status`).
- [ ] Cabecera del `.txt`, GDD §6.x y PLAN actualizados.
