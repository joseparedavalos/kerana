# RECETA · Cómo rediseñar un nivel (S19, hecha sobre l1; corregida en S22, S23 y S24 con l2)

El procedimiento que se siguió en S19 para rehacer l1 (Paraguarí) y en S22 para l2 (Ñeembucú), con la segunda pasada de S23 sobre l2. Sirve para rediseñar l3 a l7 sin inventar el método: cambian los datos del nivel, no los pasos. Vocabulario (grupo de ritmo, cadencia, celda, portal, los cinco componentes): `docs/REVIEW.md` §0. Lo que l2 agregó o corrigió está en §8 (S22), §9 (S23, huecos sin salida y enemigos en los saltos) y §10 (S24, probar las protecciones como juega una persona y la zona de ritmo), y marcado *(S22)*, *(S23)* o *(S24)* donde cambió una regla.

---

## 0. Qué tener a mano antes de dibujar

**Leer:** la ficha del nivel en `docs/REVIEW.md` (Parte 1), su sección del GDD (§6.x), GDD §11.7.1 (sintaxis ASCII) y la vitrina de S18 (`tools/levels/vitrina.txt`, `?debug=1&level=vitrina&gifts=all`).

**Alcances de Kerana** (de `gameplay.ts`; no se cambian al rediseñar):

| Qué | Valor | Para qué sirve |
|---|---|---|
| Cuerpo | 1 × 2,6 tiles | un pasillo mide al menos 4 filas; si hay que saltar adentro, **6** (con 4 el techo corta el salto y no se pasan ni 2 tiles de espinas) |
| Salto | *(S24, medido)* **63,3 px = 3,96 tiles** de alto (la fórmula v²/2g daba 4,17: la física avanza a paso fijo y sube menos); 6,25 de largo a la misma altura | pared o escalón obligatorio: **≤ 3**. Una pared de **4 no se trepa nunca** (medido con saltos corriendo desde 0 a 40 px). Algo que NO debe alcanzarse saltando: **≥ 4** arriba |
| Salto doble | *(S24, medido)* **108,7 px = 6,8 tiles** con el segundo en el ápice | una pared de **7 no se trepa** con salto doble (el hueco de l2 con `gifts=all`); una de 6 sí |
| Hueco a la misma altura | el centro viaja ≈ 5,8 tiles; el cuerpo ya apoya con 1 px | un hueco de **N** tiles de aire pide **N − 1** de viaje. Para que algo quede fuera de alcance desde un borde, **≥ 8 tiles de aire** |
| Hongo | *(S24)* **135,7 px = 8,5 tiles** a 60 Hz: el rebote empuja dos veces (el segundo, un paso de la física más arriba) y con el juego lento sube más (144 px a 30 Hz); con salto doble, 181 px | repisa a la que solo se llega con el hongo: 5 a 7 tiles por encima del hongo. *(S22)* De costado, el rebote avanza ≈ 6 tiles hasta caer a 6 filas: una repisa que NO debe alcanzarse rebotando va a **≥ 8 tiles** del hongo |
| Caída | sin daño | una caída de 10 tiles es un camino válido (se usó para pasar de la galería 1 a la 2). *(S23, corrige S22)* Quien sale corriendo de un borde avanza ≈ 5 tiles en una caída de 10 filas y **≈ 9,5 en una de 20** (medido: de la cima del ascenso 2 de l2, 21 filas, cayó en x 262,5 saliendo de x 253): abajo, **≥ 11 tiles** de piso antes del agua, y lo que se recoge (la Luz) donde se cae, no donde se salta |
| Cabeza | 2,6 tiles sobre los pies | *(S23)* saltando, la cabeza llega ≈ 6,8 filas sobre el piso: un pickup a menos de 7 filas encima de un piso por el que se pasa se toca desde abajo si lo que lo sostiene es de un solo sentido. Para que no se alcance, que esté sobre roca (`#`) |
| Onda del tajo cargado | la luz llega ≈ 6 tiles aunque haya pared | piedra encerrada a ≤ 6 tiles de donde se para Kerana, detrás de 1 tile de roca |

**Piezas (S18):** `-` plataforma de un solo sentido (las sólidas `+` pueden trabar a Kerana contra un techo: no usarlas), `:` recorrido, `*` piedra (Switch), `|` reja, `M` hongo (`kind=once` o `kind=sleep`). Propiedades con `at X,Y …`. Un hongo **también rebota si se llega caminando**: cualquier hongo en el piso del camino lo pisa todo el que pasa (ver errores, §5).

**Rompibles (S22):** `B` roca agrietada (tajo cargado o su onda) y `%` fardo frágil (tajo normal); los de la misma clase que se tocan caen juntos, así que una pared de 3 × 4 se dibuja con 12 letras y cae de un golpe. Cada clase se ve distinta del terreno sin cartel (la roca con grietas que brillan, el fardo de paja clara). Lo apoyado encima de un bloque cae al romperlo (guavirá en un nido). Una balsa sobre `~` deja el agua dibujada debajo.

---

## 1. Orden de trabajo

1. **Medir el nivel viejo.** Con el piloto del smoke (`tools/lib/pilot.mjs`) y un plan de un solo paso (`{ run: 1, untilFight: true }`), copiando el JSON viejo (`git show HEAD:public/assets/maps/lN.json`) sobre `dist/assets/maps/` después de `npm run build`. Es la base para decir cuánto se ganó. l1: **22,2 s**. *(S22)* Con agua hace falta `aim: true` (frena en el aire sobre los camalotes) y el don del nivel anterior en el guardado (`gifts` en `kerana.save.v1` y recargar). Si el mapa viejo atrapa al piloto (en l2, el salto a los juncos lo metía en el cuarto secreto), medir por tramos con `body.reset` y sumar: l2, **≈ 35 s** (12,4 + ≈ 2 + 20,4).
2. **Listar las mecánicas** del nivel en dos columnas: las que se enseñan (nuevas para el jugador) y las que solo se exigen. Para cada nueva, anotar su pareja: dónde se presenta sin riesgo y dónde se exige (principio 1); y su repetición: sobre suelo firme y después sobre un pozo (principio 2). En l1: pozo, plataforma, piedra y hongo eran nuevos.
3. **Fijar lo que no se toca:** el inicio (en l1, la cueva A y la salida, x 0–61) y la antesala con la arena, copiadas columna por columna y corridas a la derecha (l1: x 176–239 → x 250–313). *(S22)* El alto **sí** puede crecer: el fondo va fijo a la cámara y `shiftY` solo lo encuadra en la vista. En l2 el mapa pasó de 24 a 40 filas agregando 16 arriba: la antesala y la arena se copian corridas también en y (y `rect BossArena` con `y + 16`); el jefe se ubica por la arena (`floorY`), no por números fijos.
4. **Esqueleto:** el perfil del suelo (en qué fila se pisa en cada tramo: G9, G13, G8…), las secciones y los fuegos. Buscar alto antes que ancho: l1 creció 74 tiles de ancho pero el tiempo se duplicó por la ruta doble y la cueva en zigzag.
5. **Grupos de ritmo** dentro de cada sección (§2), con su cadencia.
6. **Ruta alternativa y desvío** (§3).
7. **Plumas, al final** (§4): cuando ya se sabe dónde están los saltos difíciles y las rutas.
8. **Escribir la grilla con un generador** (script en el scratchpad, no en el repo): parte del `.txt` viejo de `git show <commit base>:…` *(S22: no `HEAD`: después del primer commit de la sesión, `HEAD` ya tiene el nivel nuevo)* y aplica `fill(x0, x1, y0, y1, ch)` y `put(x, y, ch)` por pieza, con un comentario por línea. Así se mueve una pieza cambiando un número. La salida va a `tools/levels/lN.txt` (cabecera + grilla) y después `npm run maps`. Verificar con `git status` que solo cambió `lN.txt`/`lN.json`.
9. **Plan del piloto** (`tools/lib/pilot-plans.mjs`) y correr las dos rutas. Leer el log de saltos (`salto en x … pared/hueco/espinas`) y el rastro (x y pies cada 100 ms). Si el piloto hace algo que haría un jugador (subirse a una repisa, caer en un hongo), **se corrige el mapa**, no el piloto. *(S22)* Pasos que agregó l2: `charge` (tajo cargado), `bounce` (hongo, esperando una balsa si hace falta), `jumpTo` (penca o repisa), `mover` con `at: 'end'` y `exit: 'none'` (de balsa a balsa), y `wait`/`untilMover` en `run` (esperar la balsa en la orilla y no sobre un camalote). Correr cada plan **dos veces**: una variación de tiempo de un frame cambió la ruta en l2 (§8).
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

## 7. Lista de cierre (S22: válida también para l2)

- [ ] Pozos, plataformas, piedras y hongos que pide la sesión, contados en el smoke (inventario).
- [ ] Cada pieza nueva con su presentación sin riesgo antes de exigirse (solo l1 o la idea nueva del nivel).
- [ ] Ruta alternativa de 30–50 tiles: la alta paga más y caerse de ella deja en la baja.
- [ ] Nada que haya que saltar mide más de 3 tiles, salvo que haya otro camino (hongo, plataforma).
- [ ] Tres plumas, tres verbos, cada una guía o paga; ninguna al alcance por otro lado.
- [ ] Plan del piloto para la ruta principal (y la alta), tiempo medido antes y después; cada plan corrido dos veces.
- [ ] *(S22)* Desde l2: el don anterior en el camino principal una vez por sección; cada cartel antes del primer encuentro con lo que explica; rompibles de las dos clases donde abren camino.
- [ ] *(S23)* `tests/trap.test.ts` sin encierros nuevos: si uno es a propósito, con premio y anotado en el test (§9).
- [ ] *(S23)* Enemigos en los saltos según §9: visibles desde el borde, con un ciclo que se lee antes de saltar y ninguno atado al reloj de una plataforma móvil de forma que el salto quede imposible.
- [ ] *(S24)* Cada protección (la red, un premio en un hueco, una salida) probada como juega una persona en esa situación: moviéndose, saltando, con el salto doble si el que prueba usa `gifts=all` (§10.1).
- [ ] *(S24)* `tests/diver.test.ts`: cada ñakurutu o karakara con camino libre hasta la mayoría de los lugares de su zona (§10.3).
- [ ] `npm run maps`, `npm run build`, `npm test` y tres `npm run smoke` seguidos.
- [ ] Ningún otro `.txt` ni valor de `gameplay.ts` tocado (`git status`).
- [ ] Cabecera del `.txt`, GDD §6.x y PLAN actualizados.

---

## 8. Lo que agregó l2 (S22)

l2 se hizo con esta receta sin cambiar el orden de trabajo. Lo que sirvió distinto en un nivel que no es el primero:

**Medidas de l2:** 369 × 40 (antes 280 × 24). Ruta principal **≈ 80 s** con el piloto (antes ≈ 35 s); la ruta alta de B tarda ≈ 16 s contra ≈ 8 s de la baja (espera una balsa). Parciales y tabla de piezas: cabecera de `tools/levels/l2.txt` y GDD §6.2.

**Grupos de ritmo de l2** (más cortos que en l1, como pide §6):

| # | Tiles | Qué pide | Cadencia |
|---|---|---|---|
| A1 | x 0–21 | fardo opcional (tajo normal), roca agrietada obligatoria (tajo cargado) | llano x 17–21 |
| A2 | x 22–38 | camalotes sobre agua baja (seguro), mbói | llano x 32–38 |
| A3 | x 39–57 | cadena 1 sobre agua honda (huecos de 2) | orilla x 52–57 |
| A4 | x 58–73 | cadena 2, salto final de 5 con la pluma A | **fuego x 74** |
| B1 | x 75–108 | piedra encerrada (onda) que arranca la balsa, jakare debajo | orilla x 105–108 |
| B2 | x 109–128 | par de balsas: de una a la otra | orilla x 125–131 |
| B3 | x 129–160 | hongo → balsa alta, repisa; pencas en zigzag o atajo del fardo con hongo en la chimenea | cima del albardón |
| B4 baja | x 153–197 | pozo, túnel, nido que deja caer, junco con jakare, mbói, camalote | **fuego x 198** |
| B4 alta | x 155–197 | muro de roca agrietada, balsa sobre el hueco, pluma B, ñakurutu | **fuego x 198** |
| C1 | x 199–218 | poste con ñakurutu, camalotes | orilla x 219–223 |
| C2 | x 219–252 | hongo dormido (cargado), plataforma vertical, hongo de un uso → balsa alta | cima x 239–252 |
| C3 | x 253–262 | caída a la orilla, Luz de Arasy | orilla |
| C4 | x 263–308 | camalote, balsa → ascensor → poste alto (ñakurutu), par de balsas con jakare | **antesala x 309** |

**Piezas que funcionaron y cómo se arman:**

- **De balsa a balsa:** las dos con el mismo largo, velocidad y `waitMs`, y la segunda dibujada en su punta lejana con el recorrido hacia la primera (`---::::` … `::::---`). Arrancan juntas y llegan juntas a las puntas que se miran, siempre: el salto (2 tiles de aire) se hace durante la espera. Si están separadas, el hueco es de 10 y no se puede saltar. Balsa → **ascensor:** el vertical se dibuja **arriba** con el recorrido hacia abajo, así está abajo cuando llega la balsa y sube con Kerana.
- **Hongo → balsa:** un hongo **normal** bajo el recorrido de una balsa a 6 filas del sombrero: Kerana rebota sola en el lugar hasta que la balsa pasa por encima (no hay que adivinar el momento). La repisa a la que lleva la balsa queda a ≥ 8 tiles del hongo (si no, se llega rebotando). Con el hongo **de un solo uso** hay que pisarlo cuando la balsa está en su origen, sobre el hongo: durante el vuelo (≈ 0,65 s) avanza ≈ 2 tiles. Si se falla, 3 s de espera.
- **Ascensos sin salto doble:** pencas de un solo sentido cada 3 filas, corridas 2–3 tiles y alternando el lado (zigzag); hongo para 6–7 filas; una pared de 7 obliga a usar el hongo o la balsa. Si hay que saltar debajo de una repisa, 6 filas libres (con menos, el salto se corta: igual alcanza para 2 tiles de aire).
- **El tajo cargado en el camino**, una vez por sección: A, roca agrietada que cierra el paso (con cartel); B, piedra encerrada pegada a la balsa (la luz llega ≈ 6 tiles desde 14 px delante de Kerana: pararse a ≤ 5); C, hongo dormido al pie de una pared de 7. El muro de la ruta alta es un cuarto uso, opcional.
- **Rompibles:** un fardo junto al inicio enseña sin cartel que la paja se rompe; la roca de enfrente, con cartel, que la piedra con luz pide el cargado. Después: atajo tras un fardo, nido que deja caer una guavirá, muro de roca que separa la ruta fácil (un pozo antes del muro, adonde se cae caminando) de la rentable.

**Errores de l2 y su corrección:**

1. **El pozo no daba al túnel:** quedó una columna sólida entre los dos (el piloto se quedó trabado a mitad del pozo). Al tallar un pasaje que sigue a un pozo, que el túnel empiece en la columna del pozo.
2. **Un escalón de 1 fila al salir de la chimenea** hacía saltar, y ese salto cruzaba el pozo de la ruta baja: según el frame, el piloto (y un jugador) terminaba en una ruta u otra. Corrección: la penca de la chimenea al ras de la cima (cima del albardón en la fila 18).
3. **Caer de la cima del ascenso 2 al agua:** la orilla de abajo medía 7 tiles y la caída avanza ≈ 6. Corrección: 10 tiles de orilla y la Luz de Arasy donde se aterriza.
4. **El cartel del jakare estaba después del primer jakare** (el de la balsa). Corrección: el cartel antes de la roca de la balsa, y uno solo.
5. **La piedra encerrada a 6,5 tiles de la balsa:** el piloto la encendía justo al límite del alcance de la luz. Corrección: roca pegada a la balsa (4,5 tiles).
6. **La onda no rompía la roca agrietada:** la roca es suelo y la onda se apagaba al tocarla. Corrección en el código (S22): la onda no se frena en un rompible y lo rompe.
7. **El generador volvió a leer su propia salida** (error 1 de S19): después del primer commit, `git show HEAD:` ya era el l2 nuevo y la arena copiada traía la pluma C (`npm run maps`: "Hay 4 plumas"). Corrección: leer del commit base de la sesión.
8. **El salto del ascensor al poste se pasaba a veces** (smoke 2 de 3): el piloto empezaba a apuntar recién al soltar el salto y el poste mide 2 tiles; al caer al agua, el paso quedaba caminando hacia el agua. Corrección: poste a 1 tile del ascensor y el piloto apunta desde que despega (y solo salta parado sobre la plataforma). Un salto a algo de 2 tiles necesita poco hueco.
9. **`?level=2` no trae el tajo cargado** (sale del guardado): el nivel no se puede pasar sin él desde x 14. Para probar: jugar l1 antes o `gifts=all` (trae todos los dones).

---

## 9. Lo que agregó la segunda pasada de l2 (S23)

Jose jugó l2 y encontró dos cosas que la receta no cubría: un hueco al que se entra y del que no se sale, y saltos vacíos con los enemigos en el suelo. La pasada siguió el mismo orden de trabajo (§1), con el generador partiendo del commit base de la sesión.

### 9.1 Huecos sin salida (encierros)

**Qué es.** Un piso al que se llega (cayendo o saltando) y del que no se sale con lo que Kerana tiene. El de Jose: el hueco entre el pilar del ascenso 2 y la pared del timbó (x 234-238, fila 33). Se entraba caminando desde el pilar y las paredes medían 7 y 21; solo se salía con salto doble. No era un fallo de colisiones.

**Cómo se buscan.** `tests/trap.test.ts` corre `findTraps` (el mismo análisis que usa el juego, `src/systems/trapLogic.ts`) sobre el JSON de cada nivel, con los dones que se traen al llegar (salto doble desde l4), y falla si aparece un encierro que no está en su lista. El análisis exagera a propósito lo que Kerana puede hacer (en el aire se mueve sin límite, las plataformas móviles son piso en todo su recorrido, los rompibles no existen): lo que marca es seguro un encierro. En S23 se comprobó además con una simulación de saltos con la física de `gameplay.ts` (script del scratchpad, no está en el repo): en l2 de S22 y en el de S23 los dos encuentran el mismo y único hueco, y ningún otro aparece ni con un salto un 10 % más bajo. Los demás niveles no tienen ninguno.

**Reglas al dibujar.**
- Todo piso rodeado de paredes de **≥ 4** (de **≥ 7** desde l4, con salto doble) necesita una salida *(S24: medido; S23 decía 5 y 8)*: un escalón de ≤ 3, un hongo, una penca, una plataforma móvil o un rompible de tajo normal. El agua honda, las espinas y un pozo hasta el fondo también sirven: ya devuelven a Kerana a tierra firme.
- Al dibujar un pilar o una pared de ≥ 5, mirar qué queda **al pie del otro lado**: ahí estaba el hueco de Jose.
- Si el hueco es interesante (desde arriba se ve algo), no hace falta taparlo: se le da **premio** y una **salida que se vea desde adentro** *(S24: el fardo del hueco de l2, §10.2; en S23 lo sacaba la red)*. En l2: una Luz de Arasy y una guavirá, con luciérnagas.

**La red de seguridad** (global, `GAMEPLAY.trap.waitMs`): si Kerana queda en un piso encerrado, pasado ese tiempo vuelve al último suelo firme (que nunca se toma dentro de un encierro) y le cuesta `damage.trap` (1), aunque salte o se mueva todo el tiempo. Con `?debug=1` los pisos encerrados llevan una raya roja. *(S24)* Es el respaldo, no la salida: desde S24 ningún nivel tiene encierros (el único a propósito es el pozo F de la vitrina, para el smoke).

### 9.2 Enemigos en los saltos

Tres reglas: el enemigo (o su aviso) se ve **desde el borde**, antes de saltar; su patrón se **lee desde ahí** para elegir el momento; y el salto **nunca queda imposible** por el ciclo del enemigo. Ninguno de los tres enemigos de l2 tiene azar.

| Enemigo | Cómo funciona (`enemies.ts`) | Dónde va en un salto |
|---|---|---|
| Jakare (Lurker) | se activa con Kerana a ≤ 64 px en x y en y; mientras siga cerca repite: burbujas 0,9 s → afuera 1,8 s → abajo 1,4 s (4,1 s, de los que 2,3 s no muerde). Asoma 8 px sobre el agua y mide 30 px (≈ 2 tiles) | **bajo el camalote de llegada** (cadena 2, x 60), con el borde de despegue a ≤ 3 tiles para que el ciclo empiece mientras se espera en tierra; se cruza cuando se hunde. O **en el medio de un hueco de 3** (balsas de C1, x 215): un salto completo lo pasa, solo castiga el salto corto |
| Ñakurutu (Diver) | se lanza si Kerana está **más abajo** y a ≤ 96 px (6 tiles); aviso 0,5 s, picada a 230 px/s hacia donde estaba, vuelve a 70 px/s y espera 0,9 s | en un **poste del otro lado del hueco, más alto que el borde** y a ≤ 5 tiles de él (ruta alta, x 186): se lanza mientras Kerana está parada en el borde, nunca a mitad del salto. Parado a la misma altura que Kerana no se lanza nunca (el de la ruta alta de S22 estaba así) |
| Mbói (Walker) | va y viene ± 44 px a 30 px/s (≈ 6 s); **no gira en los bordes**, solo en paredes y en las puntas de su patrulla | en la **orilla de llegada**, con el centro de la patrulla a ≥ 3 tiles del agua (si no, se cae): se salta cuando se aleja o se la corta (2 golpes). Donde atraca una balsa (x 128) también: se la ataca desde la balsa |

**Con plataformas móviles** el momento del salto lo fija la plataforma, no el jugador: el ciclo del enemigo no puede caer justo en esa ventana. Lo que se corrigió en S23:
- La balsa de B1 pasaba **por encima** de un jakare: con la balsa a 50 px/s, cuando asomaba (0,9 s después de activarse) estaba a 19 px de Kerana, es decir, debajo de ella, siempre. Se sacó.
- En el par de balsas final, el jakare del hueco (de 2 tiles, demasiado angosto para sus 30 px) asomaba bajo la punta de la balsa de llegada 0,7 s después de que las balsas se juntaban: solo se podía saltar en esa ventana o caer más lejos. Se sacó.
- Lo que sí funciona con una plataforma: una mbói donde atraca (siempre se la puede atacar o saltar), un ñakurutu que se lanza durante el viaje (avisa y se lo corta) y un jakare **en el medio** de un hueco de 3.
- No poner un ñakurutu cuyo radio llegue al fuego: se lanza cada vez que Kerana reaparece (por eso el poste de C1 quedó en x 204).

**Ojo (S23):** hasta S23 el ñakurutu parado sobre un poste **no se lanzaba**: el primer paso de la picada lo apoyaba en el poste y la daba por terminada (temblaba y volvía a su lugar; por eso los saltos "estaban vacíos"). Ahora la picada no choca con el suelo en su primera mitad. Los karakara de l3 y l6 esperan en el aire y casi no cambian.

El piloto juega con `god=1` (los enemigos no lo tocan): que un salto con enemigo sea justo se comprueba con estos números, no con el smoke. El smoke sí comprueba que el guardián avisa y se lanza.

### 9.3 El guardián (encuentro, no jefe)

El ñakurutu guasu (`nakurutu_guasu`, valores en `GAMEPLAY.guardian`) es el Diver de siempre, en grande: aviso de 1,1 s (tiembla, se pone blanco y grazna), picada, 1 s aturdido en el suelo y vuelta lenta; quita 2 corazones y aguanta 5 golpes. Cómo se arma el encuentro:
- **Percha 4 filas sobre su rama**: se pasa por debajo. Radio de 128 px (≈ 7 tiles en x a esa altura): la llegada desde las balsas queda a 8 tiles, fuera del radio, para ver el aviso antes de entrar.
- **Ventana para pasar**: tras cada picada, 1 s aturdido + ≈ 2 s de vuelta + 1,6 s en la rama: se lo golpea mientras está en el suelo o se corre por debajo hasta la recompensa.
- **Recompensa fuera de su alcance** (la repisa de la pluma B, 8 filas bajo la percha) y **sobre roca**, para que no se toque desde la ruta alta saltando (§0, cabeza).
- **Sin barra ni arena**: la rama tiene salida por los dos lados (las balsas y la caída a la ruta alta).

### 9.4 Piezas nuevas y cómo se arman

- **Camino oculto**: el pilar de roca sobre el muro agrietado es un tronco hueco con un **ascensor tapado por follaje** (`H`, capa Foreground: se dibuja delante y no choca). Como el recorrido va en celdas `H`, el ascensor se declara con `rect Mover x= y= w= h= dy=` (sin `:`). Se ve cuando baja hasta la fila 14, sobre el muro: es la pista (más las luciérnagas). Roto el muro, se sube saltando desde abajo (el piloto lo hace solo si la plataforma está sobre su cabeza).
- **Atajo escondido**: un fardo en la pared del estante del ascenso 2 tapa una chimenea con un hongo que sube a la cima (como el atajo del palmar).
- **Nidos que sueltan**: un fardo de 2 filas con una guavirá encima, en una orilla o en la ruta alta; al romperlo, la guavirá cae (`dropTo`).
- **Par de balsas de 2 tiles**: con 11 tiles de agua, balsas de 2 que recorren 2 dejan 3 de hueco al cruzarse y 7 en las puntas (no se salta sin ellas).
- **Después de un poste de 3, ≥ 5 tiles de orilla**: el salto que lo pasa avanza ≈ 5 tiles; con 3, caía en la balsa o en el agua.

**Medidas de l2 (S23):** 369 × 40 (no creció). Ruta principal ≈ 80 s u ≈ 91 s con el piloto (S22: ≈ 80 s): el par de balsas de C1 suma ≈ 3 s y, según la fase con la que se llega al ascenso 2, la plataforma vertical y las balsas que siguen hacen esperar ≈ 11 s más (error 6). La copa (camino oculto) tarda ≈ 18 s desde la cima del albardón hasta el fuego 2, contra ≈ 5 s de la ruta baja.

### 9.5 Errores de S23 y su corrección

1. **La pluma de la copa se tocaba desde la ruta alta**, saltando al vacío al final de la ruta: la cabeza llega ≈ 6,8 filas sobre el piso y la repisa era de un solo sentido. Corrección: repisa de roca (§0, cabeza).
2. **El salto sobre el poste de C1 caía en el agua**: con el par de balsas pegado al poste quedaban 3 tiles de orilla y el salto sobre un poste de 3 avanza ≈ 5. Corrección: el agua empieza 5 tiles después del poste. Acercar el poste al fuego tampoco sirve: su ñakurutu se lanzaría cada vez que Kerana reaparece en el fuego.
3. **La caída desde la cima del ascenso 2 llegaba al borde de la orilla** (x 262,5 de 262): la orilla pasó a x 253-263 (§0, caída).
4. **El ñakurutu no se lanzaba desde su poste** (§9.2).
5. **El piloto de l1 fallaba en el smoke** (caía al pozo 2 una o muchas veces; en corridas sueltas no): con el juego más lento que en S22, el salto al bloque de la piedra caía sobre la balsa o golpeaba la piedra en el aire (la balsa `mode=run` salía antes de tiempo), y el salto de bajada apuntaba a 0,5 tiles del borde de la orilla: al frenar en el aire volvía al hueco. Correcciones en el piloto, no en el mapa: la piedra solo se golpea parada en el piso y, en un paso `mover` con `power`, antes que nada (aunque ya esté sobre la plataforma: se acerca, la mira y la golpea); si la plataforma se alejó de su punta mientras llegaba, se frena 14 px antes del borde y la espera otra vez; si ya se va de la punta de llegada, sigue viaje; después de cualquier caída el paso empieza de nuevo. Y en el plan de l1, un `jumpTo` al bloque de la piedra y `landX` 1,5 tiles adentro de la orilla. Con tres pilotos a la vez (juego muy lento) todavía puede fallar: el smoke corre de a uno.
6. **El tiempo de l2 sale en dos valores** (≈ 80 s u ≈ 91 s): el par de balsas de C1 (ciclo de 3,6 s) deja al piloto al pie del ascenso 2 en una de dos fases de la plataforma vertical (ciclo de 7,4 s), y esa espera arrastra las de las balsas que siguen. Al medir, correr varias veces y dar los dos.

---

## 10. Lo que agregó S24: probar como juega una persona, y la zona de ritmo

### 10.1 La lección: una protección se prueba con lo que hace una persona de verdad en esa situación

Jose quedó encerrado en el hueco de l2 mucho más de los 4 s de la red, saltando todo el tiempo. S23 había probado la red con Kerana **quieta** y **sin salto doble**, y había calculado el alcance con la fórmula continua v²/2g (4,17 tiles; 7,18 con salto doble), redondeada a 4 y 7 filas. Las dos cosas eran el caso ideal:

- **El reloj no tenía la culpa.** Reproducido en el juego (S24): sin salto doble, Kerana saltando, caminando, atacando o tocando el salto sin parar sale a los 4 s. El reloj no se reinicia al moverse.
- **El modelo sí.** Con `gifts=all` (como decía el PR de S23 que se probara) Kerana tiene salto doble, el modelo daba por salida el pilar de 7 y el hueco no quedaba marcado: la red no actuaba nunca. Y no se sale: medido cuadro a cuadro, el salto doble perfecto sube 108,7 px y el pilar pide 112. Lo mismo con el salto normal: 63,3 px contra los 64 de una pared de 4.
- **Corrección:** el alcance sale de la física del juego (`trapReach`, paso fijo de Arcade), no de una fórmula; el reloj pasó a lógica pura con tests de saltar, caminar y atacar; y el smoke prueba la red con Kerana corriendo de pared a pared, saltando, con salto doble y atacando (pozo F de la vitrina, pared de 7).

En la práctica, al probar algo que protege al jugador (la red, una salida, un premio en un hueco):

1. **Medir en el juego, no con fórmulas.** Detenido el bucle (`game.loop.sleep()`) y avanzando con `game.step()` a 60 Hz se mide lo que hace la física de verdad (S24: salto 63,3 px, salto doble 108,7, hongo 135,7 y hongo con salto doble 181). Un modelo "generoso" que exagera más allá de lo que la física permite deja trampas sin red.
2. **Probar con lo que hace alguien atrapado:** saltar sin parar, contra las paredes, con el salto doble, atacando; nunca solo quieto.
3. **Probar con los dones con los que prueba Jose:** `gifts=all` trae salto doble y dash, y cambia qué es un encierro.
4. **Probar el estado entre niveles:** la escena se reutiliza; lo que se calcula por nivel (las celdas de la red, el reloj) se limpia al cargar el siguiente (en S23 quedaban las del nivel anterior).

### 10.2 El hueco del premio con salida

El hueco de l2 (x 234-238) se sale rompiendo un **fardo** en la base del pilar (x 233, filas 29-32) y por un túnel de 4 filas hasta el pie del ascenso. Fardo y no roca: se rompe con el tajo normal, que se tiene siempre (también en una partida sin el tajo cargado), y la red trata los rompibles como abiertos, así que con una roca alguien sin el tajo cargado quedaría encerrado sin red. A la altura de Kerana y pegado a donde cae: desde adentro se ve en cuanto se aterriza (paja clara contra roca oscura, captura `l2-hueco.png`).

### 10.3 Enemigos con camino libre

El ñakurutu y el karakara solo avisan y pican si la caja de su cuerpo recorre libre todo el camino hasta Kerana (`diverLogic.ts`); si no, esperan en su lugar. La salida cruza la cara de arriba de su percha (poste, rama o penca), nada más: pegada al pie de su poste, Kerana no es blanco. Al poner uno, que tenga camino libre a la mayoría de los lugares de su zona (`tests/diver.test.ts` lo mide en todos los mapas: en l2, el guasu 10/10, el de la ruta alta 5/7, el del poste de C1 6/10 y el del poste alto 6/12; los karakara de l3 y l6, 100 %).

### 10.4 La zona de ritmo (l2, x 305-375)

Un tramo que se cruza leyendo el ritmo, no reaccionando:

- **Balsas encadenadas con el mismo ciclo** (3 tiles, recorren 4 a 50 px/s, esperan 1,8 s: 6,16 s). Alternan el sentido: las impares salen hacia la derecha desde su origen y las pares se dibujan en su punta derecha y salen hacia la izquierda; así se juntan de a dos, siempre a la vez, con **2 tiles de hueco**, y cada salto cae en la espera de las dos. Con ciclos distintos los encuentros se desfasan (lo vigila `tests/rhythm.test.ts`).
- **El enemigo, sincronizado con las plataformas, no con Kerana:** el jakare guasu sale cuando llega la balsa que tiene más cerca (`rhythmFromMovers`) y su estado sale del reloj de juego, el mismo que mueve las balsas, así que no se desfasa nunca. Burbujas mientras las balsas llegan, afuera al juntarse (1 s), abajo el resto: la ventana para saltar es la espera menos lo que está afuera (0,8 s, más lo que tardan en separarse).
- **Muerde donde se cae, no donde se espera:** su caja cubre el hueco y la primera baldosa de la balsa de llegada, a 1,5 px de la de salida. Esperar en la balsa propia siempre es seguro; si se pierde la ventana, la balsa vuelve al encuentro anterior y hay que pararse en sus dos baldosas lejanas (las burbujas avisan). Saltar con el jakare afuera cuesta corazones (el piloto sin esperar perdió 2 y 3).
- **Un islote en el medio** (suelo firme, sin jakare): descanso y el lugar al que devuelve el agua. Un fuego 12 tiles antes del agua.
- **Medidas:** el mapa pasa a 436 × 40 (la zona se insertó antes de la antesala, que se corrió 67 tiles). El piloto (que espera a que el jakare se hunda: opción `safe` del paso `mover`) cruza la zona en **≈ 21 s** dentro del recorrido de l2 (22-24 s desde la orilla, según la fase de la primera balsa). Sin salto doble ni dash.

### 10.5 Errores de S24 y su corrección

1. **Los tests de S23 pasaban con la red rota:** afirmaban el alcance de la fórmula (4 y 7 filas) en vez de compararlo con la física. Corrección: el test simula el salto paso a paso como Arcade y exige que el modelo no lo pase; con el modelo de S23 fallan 6 de 13.
2. **Las celdas de la red quedaban de un nivel al siguiente** (la escena se reutiliza): se limpian al cargar.
3. **El piloto de l1 quedaba arriba de la plataforma vertical** (2 de las 3 primeras corridas del smoke; el build de S23 falla igual con la CPU frenada ×3): con el juego lento el paso anterior terminaba tarde y Kerana frenaba con el centro sobre la plataforma pero parada en el borde del piso; el piloto la daba por subida y la plataforma bajaba sin ella. Corrección en el piloto: no cuenta como subida si pisa el suelo de al lado. Probé además que vuelva a esperar si la plataforma se va sin ella, y lo saqué: con el juego lento, al subir, los pies quedan más de 3 px separados de la plataforma un cuadro y daba falsos positivos en l2. Para reproducir fallos del smoke que no salen en corridas sueltas: `page.emulateCPUThrottling(3)` imita el headless lento.
4. **Topes de reloj real en el smoke:** el farol de l7 tenía 4 s para que Kerana llegara caminando; con el headless a 12-17 fps a veces no alcanzaban. Los topes de reloj se ponen holgados y se corta por estado.
5. **El cuerpo escalado de un enemigo no se actualiza mientras está deshabilitado** (el jakare bajo el agua): la primera medida de su caja, en el cuadro en que asoma, daba el tamaño sin escalar. Medir a mitad de la emersión.

