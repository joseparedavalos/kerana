# REVIEW · Diagnóstico del diseño de niveles (S16)

Auditoría del juego tal como está en la rama de S16 (después de S13d). No cambia código: describe lo que hay y señala los huecos.

**Convenciones.** Coordenadas leídas de `tools/levels/*.txt`: `x` = columna, `fila` = fila del carácter (0 arriba). "Altura" = diferencia entre superficies donde se pisa, en tiles de 16 px. Física de `src/config/gameplay.ts` (S16, sin cambios):

| Valor | Dato | Derivado |
|---|---|---|
| `runSpeed` 150 px/s | 9,375 tiles/s | 1 tile = 0,107 s |
| `gravity` 1200, `jumpVelocity` −400 | altura 66,7 px = **4,17 tiles** | subida 0,333 s; salto completo a la misma altura 0,667 s, **6,25 tiles** de alcance a toda carrera |
| `doubleJumpVelocity` −340 | +48,2 px = **3,0 tiles** | salto + doble ≈ 115 px = **7,2 tiles** de alto; ≈ 1,05 s en el aire, **≈ 9,9 tiles** de alcance |
| `dash` 320 px/s × 160 ms, `vy = 0` | 51 px = 3,2 tiles | intangible; enfriamiento 500 ms desde que termina (660 ms entre inicios) |
| `jungle.bounceVelocity` −540 | 121,5 px = **7,6 tiles** | el corte del salto no se aplica al rebote |
| `maxFallSpeed` 420 | se alcanza tras 0,35 s y 73,5 px de caída | caer 3 tiles: 0,28 s; 4: 0,33 s; 7: 0,44 s |

---

## 0. Vocabulario

Viene de dos referencias de diseño de niveles: "Level Design Lessons" de Anna Anthropy y "A Framework for Analysis of 2D Platformer Levels" de Smith, Cha y Whitehead (UC Santa Cruz). Las sesiones futuras usan estos términos.

- **Verbo:** una acción que el jugador puede ejecutar (correr, saltar, atacar, tajo cargado, salto doble, dash).
- **Los cinco componentes de un nivel:**
  1. **Plataformas:** superficies que se recorren con seguridad. Pueden ser fijas, móviles, temporales (por tiempo o por pisadas), de un solo sentido.
  2. **Obstáculos:** todo lo que hace daño, incluidos los huecos. Una pared que estorba pero no daña NO es obstáculo.
  3. **Ayudas de movimiento:** trasladan al jugador de otra forma que correr o saltar (resortes, viento, cuerdas). No modifican al personaje de forma permanente.
  4. **Coleccionables:** premian, guían la ruta o compensan el riesgo.
  5. **Disparadores:** cambian el estado del nivel (interruptores, botones con tiempo, reacciones en cadena).
- **Grupo de ritmo:** conjunto corto de componentes que encapsula UN área de desafío, con principio, medio y cadencia (el punto donde el ritmo de pulsaciones cambia o el jugador puede descansar).
- **Celda:** región de juego lineal. **Portal:** el punto donde dos celdas se tocan y el jugador puede cambiar de ruta. Un nivel lineal es una sola celda.

---

## Parte 1 · Fichas por nivel

### l1 · Paraguarí (`l1.txt`)

**1. Medidas.** 240 × 34. A x 0–44 (cueva, suelo fila 12) · B x 45–105 (ladera; meseta fila 9 desde x 62) · checkpoint 1 x 112 · C x 106–175 (descenso: superficies en filas 16, 20, 24, 28) · antesala x 176–199 (fila 31) · arena x 200–239. GDD pide A ≈ 50, B ≈ 70, C ≈ 60: real 45, 61, 70.

**2. Grupos de ritmo.**

| # | Tiles | Qué pide | Cadencia |
|---|---|---|---|
| 1 | x 1–24 | escalón de 2 (x 12), primer teju'i (x 16), bloque de 3 (x 22–24) | llano x 25–29 |
| 2 | x 30–44 | guavirá (x 30), cartel de ataque, liana que tapa la salida (x 41) | salida de la cueva x 45 |
| 3 | x 45–61 | roca de 3 (x 50–51) + teju'i (x 48); pluma 1 arriba | llano x 52–61 |
| 4 | x 62–100 | escalón de 3 a la meseta, 2 mbopi (x 60, 74), Luz de Arasy (x 82), pasillo de 4 teju'i (x 86–98) | borde de la meseta x 100 |
| 5 | x 101–130 | caída de 7 tiles al pozo, rocas `B` (pluma 2), checkpoint x 112 | checkpoint x 112 |
| 6 | x 131–145 | bajada de 4, estalactitas x 135 y 141, teju'i x 138, espinas x 143–144 | rellano x 146 |
| 7 | x 146–160 | teju'i x 150, estalactita x 152, cornisa de la pluma 3, espinas x 158–159 | rellano x 161 |
| 8 | x 161–175 | estalactitas x 166 y 171, mbopi x 168, espinas x 173–174 | antesala x 176 |

8 grupos en 200 tiles: uno cada 25 tiles (≈ 2,7 s de carrera).

**3. Tramos vacíos (> 20 tiles).** Ninguno con la regla estricta. Sin contar el guavirá ni la liana, x 26–47 (22 tiles) solo tiene un cartel.

**4. Componentes.**
- Plataformas: fijas; un solo sentido 3 (cornisa x 155–158 y 2 repisas de la arena). Móviles: ninguna. Temporales: ninguna.
- Obstáculos: 8 teju'i, 5 mbopi, 5 estalactitas, 3 tramos de espinas de 2 tiles. **Ni un pozo**: el descenso tiene suelo en cada escalón.
- Ayudas de movimiento: **ninguna**.
- Coleccionables: 3 plumas, 3 guavirá (x 30, secreto x 142, antesala x 186), 1 Luz de Arasy.
- Disparadores: **ninguno**.

**5. Verbos.** Exige: correr, saltar, atacar (liana x 41 y jefe). Acepta: tajo cargado (rocas de la pluma 2, solo al rejugar), salto doble (pluma 3, desde l3). Nunca: dash.

**6. Celdas y portales.** 1 celda + 2 bolsillos sin salida: rincón de la pluma 2 (x 101–104, filas 13–15) y nicho secreto (x 142–145, fila 23, liana). Portales hoy: esos dos. Cabrían: (a) sobre la meseta x 62–100, cielo abierto en las filas 0–8 donde ya vuelan los mbopi: una ruta alta sobre el pasillo de teju'i; (b) la caverna x 131–175 mide 16–20 filas de alto y la cornisa x 155–158 (fila 18) ya es un escalón hacia una ruta alta; (c) el rincón x 101–104 ya toca la meseta y el pozo: abrirlo por arriba lo vuelve paso.

**7. Plumas.** 1: x 46 fila 4, sobre la salida, saltando desde la roca x 50 (saltar; desde el suelo faltan ≈ 5 px). Premia explorar, sin riesgo. 2: x 102 fila 15, tras 3 rocas `B` (tajo cargado, al rejugar). Bolsillo sin riesgo. 3: x 156 fila 17, cornisa a 6 tiles del suelo (salto doble, desde l3), entre una estalactita y espinas: compensa un riesgo leve.

---

### l2 · Ñeembucú (`l2.txt`)

**1. Medidas.** 280 × 24, superficie en la fila 17. A x 0–59 · B x 60–139 · checkpoint 1 x 120 · C x 140–219 · antesala x 220–239 · arena x 240–279.

**2. Grupos de ritmo.**

| # | Tiles | Qué pide | Cadencia |
|---|---|---|---|
| 1 | x 0–11 | rincón de práctica (3 rocas `B` en x 4, guavirá x 1), inicio x 8 | x 11 |
| 2 | x 12–25 | agua baja x 12–21 con mbói (x 20) | seco x 22–25 |
| 3 | x 26–41 | 2 camalotes sobre agua baja (x 27–28, 31–32), agua baja x 34–40 | x 41 |
| 4 | x 42–55 | cadena 1: 3 camalotes sobre agua honda; pluma 1 | orilla x 56–65 |
| 5 | x 62–73 | jakare (x 67) en agua de 7 tiles, junco x 69–70 | x 73–85 |
| 6 | x 80–105 | mbói x 80, agua honda de 16 tiles con 4 juncos, jakare x 94; pluma 2 | orilla x 106 |
| 7 | x 106–139 | mbói x 110, checkpoint x 120, guavirá x 124, agua baja x 126–135 | checkpoint x 120 |
| 8 | x 140–163 | poste de 3 con ñakurutu (x 146), cadena 2 (3 camalotes) | agua baja + Luz de Arasy x 164–171 |
| 9 | x 172–203 | poste con ñakurutu (x 172), cadena 3 (5 camalotes) | islote x 188–190 (medio) y orilla x 200–203 |
| 10 | x 204–219 | torre 3 + 3 con ñakurutu (x 206), cadena 4 (3 camalotes); pluma 3 | antesala x 220 |

10 grupos en 240 tiles.

**3. Tramos vacíos.** Ninguno.

**4. Componentes.**
- Plataformas: fijas; un solo sentido 6 (juncos y repisa de la pluma 3); temporales 18 (16 tramos `S` + 2 `rect Sinking`; 2 de los 16 en la arena). Móviles: ninguna.
- Obstáculos: 3 mbói, 2 jakare, 3 ñakurutu; agua honda (12 tramos fuera de la arena). Sin espinas.
- Ayudas de movimiento: **ninguna** (el agua baja frena: es lo contrario).
- Coleccionables: 3 plumas, 4 guavirá, 1 Luz de Arasy.
- Disparadores: **ninguno**.

**5. Verbos.** Exige: correr, saltar, atacar (jefe). Acepta: tajo cargado (rincón de práctica, secreto x 101, onda contra jakare). Salto doble y dash: solo la pluma 3, al rejugar.

**6. Celdas y portales.** 1 celda + 2 bolsillos: rincón x 1–3 y cuarto secreto x 101–105 (filas 6–10). Cabrían: (a) el cuarto secreto ya flota sobre los juncos: seguirlo a la derecha por arriba; (b) la torre x 204–207 y la repisa de la pluma 3 (x 216–217) están a la misma altura (fila 11): a 3 tiles de la antesala, una ruta alta sobre la cadena 4; (c) el islote x 188–190 divide la cadena 3 en dos mitades.

**7. Plumas.** 1: x 52 fila 13, 3 tiles sobre el último camalote de la cadena 1 (saltar desde algo que se hunde): compensa riesgo. 2: x 91 fila 15, sobre el junco bajo x 91–92 **que está en el camino**, junto al jakare de x 94: casi imposible de perder. 3: x 216 fila 10, repisa a 8 tiles de la torre x 207. Las notas de S7 dicen "pide dash", pero el salto doble (desde l3) también llega: ≈ 9,9 tiles de alcance contra 8. Callejón sin salida.

---

### l3 · Misiones (`l3.txt`)

**1. Medidas.** 300 × 24, suelo en la fila 17. A x 0–69 · B x 70–149 · checkpoint 1 x 150 · C x 150–229 · antesala x 230–259 · arena x 260–299.

**2. Grupos de ritmo.**

| # | Tiles | Qué pide | Cadencia |
|---|---|---|---|
| 1 | x 22–34 | tacurú de 2 (x 22–24), ñandú x 32 | x 40 |
| 2 | x 35–49 | copa de la pluma 1 (x 35–39), tacurú de 2 (x 46–47) | x 48 |
| 3 | x 50–62 | isla de monte (ramas en filas 13, 10, 7; secreto arriba), ñandú x 56 | x 60–62 |
| 4 | x 63–97 | viento a favor x 76–93, karakara x 90 | Luz de Arasy x 100 |
| 5 | x 98–123 | viento en contra x 98–109, teju'i x 108, espinas x 112–113, karakara x 118 | x 121–123 |
| 6 | x 124–149 | tacurú agrietado (pluma 2), viento x 132–147, ñandú x 140 | checkpoint x 150 |
| 7 | x 150–175 | pozo de 3 (x 160–162), copa x 164–167, espinas x 168–169, viento x 170–185, karakara x 172 | x 179–187 |
| 8 | x 176–195 | pozos de 3 (x 176–178, 188–190), karakara x 184 | x 191–197 |
| 9 | x 196–222 | 4 copas con viento en contra (`speed=70`), pluma 3; teju'i x 222 | antesala x 230 |

**3. Tramos vacíos.** x 1–21 (21 tiles): inicio, un cartel y un tacurú de 1. Sin contar descansos: x 223–259 (la antesala entera).

**4. Componentes.**
- Plataformas: fijas; un solo sentido 12 (copas, ramas de la isla y 3 en la arena). Móviles y temporales: ninguna.
- Obstáculos: 3 ñandú, 4 karakara, 2 teju'i; 2 tramos de espinas; 3 pozos de 3 tiles.
- Ayudas de movimiento: viento, 5 zonas: 3 a favor (18, 16 y 16 tiles) y 2 en contra (12 y 22).
- Coleccionables: 3 plumas, 2 guavirá (secreto x 51, antesala x 240), 1 Luz de Arasy.
- Disparadores: **ninguno**.

**5. Verbos.** Exige: correr, saltar, atacar (jefe). Acepta: tajo cargado (pluma 2). Salto doble: pluma 1, al rejugar. Nunca: dash.

**6. Celdas y portales.** 2 celdas: la ruta de las copas (x 196–217, fila 14) corre paralela al suelo y se une a él; caer no daña. Bolsillos: isla de monte (secreto) y tacurú de la pluma 2. Cabrían: (a) unir la isla x 50–59 (fila 7) con la copa x 35–39 como ruta alta del pastizal; (b) la copa x 164–167 sobre el pozo x 160–162 ya es la entrada a una ruta de copas en C; (c) sacar la ruta de copas de x 217 directo a la antesala.

**7. Plumas.** 1: x 37 fila 10, copa a 6 tiles del suelo (salto doble, el don de este nivel: rejugar). 2: x 129 fila 16, dentro del tacurú (tajo cargado, ya se tiene). Bolsillo. 3: x 214 fila 13, al final de 4 copas con viento en contra; abajo hay suelo: el fallo no cuesta nada. Ninguna compensa un riesgo real.

---

### l4 · Capiatá (`l4.txt`)

**1. Medidas.** 270 × 24, suelo en la fila 17. A x 0–69 (corredores fila 14, techos fila 11) · B x 70–139 · checkpoint 1 x 140 · C x 140–209 (techos en la fila 11) · antesala x 210–229 · arena x 230–269.

**2. Grupos de ritmo.**

| # | Tiles | Qué pide | Cadencia |
|---|---|---|---|
| 1 | x 0–12 | secreto (roca `B` x 5), cornisa de práctica del salto doble (x 7–9) | x 10–12 |
| 2 | x 13–29 | vaca x 14, corredor y techo, jagua x 24 | x 25–33 |
| 3 | x 30–49 | vaca x 34, corredor y techo, jagua x 44 | x 45–49 |
| 4 | x 50–69 | vaca embrujada x 50, campanario (pluma 1), vaca x 58, jagua x 64 | guavirá x 67 |
| 5 | x 70–99 | niebla x 76–85, abejas x 90 | Luz de Arasy x 96 |
| 6 | x 100–127 | muro de 2 (x 100), niebla x 104–111, abejas x 110, hueco del túnel x 118–119 | x 127–131 |
| 7 | x 132–161 | jagua x 132, checkpoint x 140, techos, teja x 154, jagua x 160 | checkpoint x 140 |
| 8 | x 162–192 | techos, tejas x 166 y 178, abejas x 172, jagua x 184 | x 185–192 |
| 9 | x 193–209 | techo, patio escondido (pluma 3), teja x 200 | guavirá x 206 |

**3. Tramos vacíos.** Ninguno con la regla estricta. Sin descansos: x 1–23 y x 133–153.

**4. Componentes.**
- Plataformas: fijas; un solo sentido 20 (corredores, techos, campanario, arena). Móviles: las 3 vacas (14 px/s, ± 3,5 tiles), que ningún salto necesita. Temporales: ninguna.
- Obstáculos: 6 jagua, 3 abejas, 1 vaca embrujada, 4 tejas, espinas solo dentro del túnel. **Ni un pozo.**
- Ayudas de movimiento: las vacas, en teoría (ver Parte 3).
- Coleccionables: 3 plumas, 4 guavirá (secreto x 2, práctica x 8, x 67, x 206). **La antesala (x 210–229) no tiene guavirá**: el de x 206 queda 4 tiles antes (GDD §4.3: "siempre uno en la antesala").
- Disparadores: **ninguno**. La niebla es una zona de estado, no un disparador.

**5. Verbos.** Exige: correr, saltar, atacar (jefe). El camino a ras del suelo pide 2 saltos (muro x 100 y hueco x 118). Acepta: tajo cargado (secreto), salto doble (pluma 1 y cornisa de práctica). Dash: pluma 2, al rejugar.

**6. Celdas y portales.** 2 celdas en C: los techos (fila 11, x 150–202, huecos de 3) corren paralelos a la calle, con portal en x 144–150 (techo bajo fila 14) y salida en x 202. Es la única ruta alternativa real del juego. En A, corredores y techos son islas de 6–9 tiles separadas por 15: no forman ruta. Bolsillos: secreto x 1–5, túnel x 118–126, patio x 194–201. Cabrían: (a) unir los corredores de A (x 12–19, 34–41, 50–58, fila 14) en una ruta sobre los jagua; (b) el túnel termina en x 126 contra el suelo de la calle: abrirlo en x 127 lo vuelve paso; (c) el campanario (fila 6) como puente hacia el techo x 150.

**7. Plumas.** 1: x 54 fila 5, campanario a 5 tiles del techo de fila 11 (salto doble, desde l3). 2: x 125 fila 20, túnel de 3 de alto con espinas de 2 (dash, al rejugar). 3: x 198 fila 16, detrás de la capa `H` (solo descubrirla). Ninguna compensa riesgo; la 3 premia la curiosidad.

---

### l5 · Canindeyú (`l5.txt`)

**1. Medidas.** 280 × 45, el único vertical. A x 0–59 (suelo fila 41) · B x 60–139 (subida de la fila 41 a la 15: **26 tiles**) · checkpoint 1 x 138 (fila 15) · C x 142–209 (copas en filas 13–15) · antesala x 210–239 (fila 20) · arena x 240–279.

**2. Grupos de ritmo.**

| # | Tiles | Qué pide | Cadencia |
|---|---|---|---|
| 1 | x 0–12 | espinas de práctica del dash (x 7–9, se saltan) | x 10–12 |
| 2 | x 13–35 | kuati x 14, hongo x 20 (secreto), tronco de 3 (x 23–24), kuati x 30 | x 31–35 |
| 3 | x 36–59 | cadena de 3 hongos (x 36 → 41 → 46) a la pluma 1, rama baja x 46–49, kuati x 52 | x 53–59 |
| 4 | x 60–87 | 4 escalones (2 fijos, 2 ramas `R`) sobre karaguatá, Luz de Arasy x 76, hongo de retorno x 74 | rama firme x 86–89 |
| 5 | x 88–104 | mbói colgante x 88, hongo x 89 al tronco, ka'i x 99; túnel de la pluma 2 | techo del tronco |
| 6 | x 105–141 | rama `R` x 107–111, rama x 114–118 con mbói, ka'i x 128 | checkpoint x 138 |
| 7 | x 142–163 | copas con huecos de 4 y 6, hongos debajo | copa x 158–163 |
| 8 | x 164–190 | rama alta x 164–168 con mbói, hueco de 8, ka'i x 180, hueco de 6, kuati x 188 | copa x 184–190 |
| 9 | x 191–209 | hueco de 5, cortina `H` (pluma 3) | antesala x 210 |

**3. Tramos vacíos.** Ninguno. Sin descansos: x 211–239 (antesala).

**4. Componentes.**
- Plataformas: fijas; un solo sentido 17; temporales 4 ramas `R` (se quiebran 0,6 s después de pisarlas). Móviles: ninguna.
- Obstáculos: 4 kuati, 3 ka'i, 3 mbói colgantes; espinas 5 tramos (x 92–119 mide 28 tiles); pozos bajo las copas de C.
- Ayudas de movimiento: 11 hongos.
- Coleccionables: 3 plumas, 2 guavirá (secreto x 15, antesala x 230), 1 Luz de Arasy.
- Disparadores: **ninguno**.

**5. Verbos.** Exige: correr, saltar, atacar (jefe). Acepta: salto doble y dash (dosel), dash (pluma 2). El dosel no los exige: el hueco de 8 (x 164–171) se cruza por la rama alta x 164–168 (4 tiles sobre la copa x 158–163: 64 px contra 66,7) y los hongos de la fila 21 devuelven arriba a quien cae. Las espinas de práctica se saltan. Nunca: tajo cargado (el secreto es una liana).

**6. Celdas y portales.** 1 celda + bolsillos: secreto x 14–18 (fila 34), túnel del tronco, cortina `H`. Los hongos del dosel son una red de rescate, no una ruta. Cabrían: (a) ramas altas x 164–168 y x 179–182 (fila 9) como ruta sobre el dosel; (b) las plataformas de la pluma 1 (x 39–48, filas 29–35) quedan junto al primer escalón de B (x 60, fila 39); (c) el túnel del tronco, abierto hacia la rama x 107–111.

**7. Plumas.** 1: x 46 fila 20, al final de la cadena de 3 hongos (rebote de 7,6 tiles). Guía y enseña el hongo. 2: x 102 fila 27, túnel del tronco con espinas de 2 (dash, ya se tiene). 3: x 205 fila 11, detrás de la cortina `H`, a 3 tiles de la copa x 196–209 (saltar y descubrir). Ninguna compensa un riesgo grande.

---

### l6 · Guairá (`l6.txt`)

**1. Medidas.** 290 × 26. A x 0–69 (escalones de 2: suelo en filas 21, 19, 17, 15) · B x 70–139 (cumbres, filas 12–15) · checkpoint 1 x 134 · C x 140–229 (fila 16) · antesala x 230–249 · arena x 250–289.

**2. Grupos de ritmo.**

| # | Tiles | Qué pide | Cadencia |
|---|---|---|---|
| 1 | x 0–17 | inicio, secreto (roca `B` x 14) | x 16–17 |
| 2 | x 18–33 | escalón, manada de 3 taitetu (x 24–28), cornisa de la pluma 1 | x 32–33 |
| 3 | x 34–49 | escalón, manada de 2 (x 40–42) | x 44–49 |
| 4 | x 50–79 | escalón, rocas que caen x 56 y 64 | guavirá x 60 |
| 5 | x 80–111 | pozos de 4 (x 80–83, 94–97), viento a favor, 2 karakara, cornisa de la pluma 2 sobre el pozo x 108–111 | x 112 |
| 6 | x 112–133 | viento en contra, karakara x 117, pozo de 4 (x 122–125) | checkpoint x 134 |
| 7 | x 140–171 | Luz de Arasy x 144, pindó x 149, manada de 3 (x 158–162), pindó x 169 | copa del pindó |
| 8 | x 172–191 | ruta alta (pluma 3) con rocas x 179 y 186, manada de 2 (x 178–180), pindó x 189 | copa del pindó |
| 9 | x 192–211 | manada de 3 (x 198–202), pindó x 209 | x 212 |

**3. Tramos vacíos.** **x 212–234 (23 tiles)**: suelo llano entre el último pindó y el checkpoint 2.

**4. Componentes.**
- Plataformas: fijas; un solo sentido 11 (6 copas de pindó, ruta alta, cornisas). Móviles y temporales: ninguna.
- Obstáculos: 13 taitetu, 3 karakara, 4 rocas que caen, 4 pozos de 4 tiles. Sin espinas.
- Ayudas de movimiento: viento, 3 zonas (2 a favor, 1 en contra).
- Coleccionables: 3 plumas, 3 guavirá (secreto x 11, x 60, antesala x 238), 1 Luz de Arasy.
- Disparadores: **ninguno**. Fuera de la arena, el pindó es una plataforma más: los taitetu no ven a Kerana arriba porque el Charger solo mira su mismo piso.

**5. Verbos.** Exige: correr, saltar, atacar (jefe). Acepta: salto doble (pluma 2), tajo cargado (secreto). Nunca exige: dash.

**6. Celdas y portales.** 2 celdas en C: la ruta alta x 174–190 (filas 8 y 10) va paralela al suelo entre dos pindó. Bolsillos: secreto x 10–15 y cornisa de la pluma 2. Cabrían: (a) la cornisa de la pluma 1 (x 24–31, fila 14) termina a 2 tiles del escalón x 34: es una ruta sobre la manada si continúa; (b) la cornisa de la pluma 2 (x 107–110, fila 8) queda a 4 tiles del bloque x 112–121 (fila 12); (c) el tramo vacío x 212–234 tiene altura libre para una segunda ruta de copas.

**7. Plumas.** 1: x 25 fila 13, cornisa sobre la manada (saltar desde el escalón x 34; caer = caer en la manada): compensa riesgo. 2: x 109 fila 7, cornisa a 6 tiles sobre el bloque x 98–107 y encima del pozo x 108–111. Las notas de S11 dicen "pide viento a favor": el viento es horizontal y no da altura; hace falta salto doble (ya se tiene). Compensa riesgo (pozo). 3: x 189 fila 7, ruta alta con 2 rocas: compensa riesgo y guía a la ruta alternativa. Es el nivel con mejor uso de las plumas.

---

### l7 · Asunción (`l7.txt`)

**1. Medidas.** 280 × 30, suelo en la fila 26. A x 0–69 · B x 70–139 · checkpoint 1 x 137 · C x 140–219 (todo `DarkZone`) · antesala x 220–239 · arena x 240–279.

**2. Grupos de ritmo.**

| # | Tiles | Qué pide | Cadencia |
|---|---|---|---|
| 1 | x 0–26 | farol x 10, secreto (liana x 14), balcón x 18–21, mbopi x 26 | x 27 |
| 2 | x 54–69 | mbopi x 54, muro de 2 (x 58–61), farol x 66 | x 62–69 |
| 3 | x 70–99 | rejas de 3 (x 80–82), muro de 3 (x 88–89), póra x 92, rejas x 96–98 | farol x 100 |
| 4 | x 100–136 | muro de 3 (x 108–109), póra x 113, rejas x 118–120, rincón oscuro con farol y póra, pluma 2 | checkpoint x 137 |
| 5 | x 140–169 | mausoleos de 3 (x 146–150, 164–168), farol x 152, jagua hũ x 158 | Luz de Arasy x 170 |
| 6 | x 170–189 | mausoleo de 3 + cúpula de 9 en escalones (x 172–182, pluma 3), jagua hũ x 186 | x 183–189 |
| 7 | x 190–219 | mausoleo de 3, mbopi x 196, jagua hũ x 202, farol x 206, póra x 212 | antesala x 220 |

7 grupos en 240 tiles: el nivel menos denso.

**3. Tramos vacíos.** **x 27–53 (27 tiles)**: calle llana con 2 faroles (x 30, 50); los balcones x 36–45 son opcionales. Sin descansos: x 1–25.

**4. Componentes.**
- Plataformas: fijas (techos de mausoleos); un solo sentido 4 (balcones y repisa de la pluma 2). Móviles y temporales: ninguna.
- Obstáculos: 3 mbopi, 4 póra, 3 jagua hũ, 3 rejas de 3 tiles. **Ni un pozo.**
- Ayudas de movimiento: **ninguna**.
- Coleccionables: 3 plumas, 2 guavirá (secreto x 11, antesala x 226), 1 Luz de Arasy.
- Disparadores: 12 faroles (10 apagados), débiles: ver Parte 3.

**5. Verbos.** Exige: correr, saltar, atacar (jefe; el póra solo con luz). Acepta: tajo cargado (la onda purifica al póra aunque esté a oscuras). Salto doble y dash: nunca hacen falta (todo mide 3 tiles).

**6. Celdas y portales.** 1 celda + secreto x 10–14 (fila 21). Cabrían: (a) los balcones x 18–21, 36–39 y 42–45 (filas 23 y 20) como ruta de techos sobre la calle vacía x 27–53; (b) los techos de los 5 mausoleos de C (x 146–194, huecos de 4 a 15) como ruta alta en la oscuridad; (c) el rincón oscuro x 122–135 abierto hacia el checkpoint x 137.

**7. Plumas.** 1: x 44 fila 19, balcón alto desde el de x 36–39 (3 tiles, saltar). Sin riesgo. 2: x 132 fila 22, repisa a 3 tiles en el rincón que alumbra el farol x 126 (saltar + encender). Guía: enseña que el farol revela. 3: x 179 fila 16, en la cúpula **que está en el camino principal**: imposible de perder.

---

### yvaga · Yvága (`yvaga.txt`)

**1. Medidas.** 44 × 26. Antesala x 0–3 (inicio y fuego) · arena x 4–43, nubes en la fila 23, 7 estrellas `=` de 3 tiles (filas 20, 17, 14).

**2. Grupos de ritmo.** No hay nivel: solo la arena de Tau.

**3. Tramos vacíos.** No aplica.

**4. Componentes.** Plataformas: 7 estrellas de un solo sentido. Obstáculos: los ataques de Tau. Ayudas de movimiento, coleccionables y disparadores: ninguno (el humo y la estrella que se enciende en la fase 3 los maneja el jefe).

**5. Verbos.** Exige: correr, saltar (subir a una estrella en `echo_mboi`), atacar. Acepta: tajo cargado. Nunca: salto doble y dash (las estrellas están a 3 tiles).

**6. Celdas y portales.** 1 celda.

**7. Plumas.** No tiene.

---

## Parte 2 · Duración

**Carrera pura en horizontal** (ancho hasta la entrada de la arena ÷ 9,375 tiles/s):

| Nivel | Tiles hasta la arena | Carrera pura |
|---|---|---|
| l1 | 200 | 21,3 s |
| l2 | 240 | 25,6 s |
| l3 | 260 | 27,7 s |
| l4 | 230 | 24,5 s |
| l5 | 240 | 25,6 s |
| l6 | 250 | 26,7 s |
| l7 | 240 | 25,6 s |
| **Total** | **1660** | **177 s ≈ 2 min 57 s** |

**Tramos verticales.** Duración de cada salto según la altura a ganar: 1 tile, 0,62 s · 2 tiles, 0,57 s · 3 tiles, 0,51 s · 4 tiles, 0,40 s (en el límite) · hueco a la misma altura, 0,67 s · rebote a 4 tiles más arriba, 0,76 s. Un salto en carrera cubre en horizontal lo mismo que correr, así que solo cuesta tiempo extra cuando frena el avance.

| Nivel | Saltos obligatorios del camino | Lo que frena el avance | Extra estimado |
|---|---|---|---|
| l1 | 4 subidas (11 tiles) + 3 espinas; 5 caídas (22 tiles, 1,7 s en el aire) | nada: las caídas son de paso | + 2 s |
| l2 | 4 subidas (12 tiles) + ≈ 25 huecos de agua | camalotes (se hunden en 1,2 s: empujan, no frenan) | + 3 s |
| l3 | 9 subidas de 1–3 tiles + 3 pozos + 2 espinas | viento en contra (ciclo de 5,2 s) | + 4 s |
| l4 | 2 (muro x 100, hueco x 118) | niebla solo si se queda quieta | + 1 s |
| **l5** | **A: 2 · B: 9 subidas, 26 tiles (≈ 4,9 s en el aire) · C: ≈ 7** | **subida de B: escalones a 2–3 tiles de distancia, 3 de alto, ramas que se quiebran** | **+ 8 s** |
| l6 | 3 subidas de 2 + 4 pozos de 4 | viento en contra | + 3 s |
| l7 | 9 subidas (26 tiles; 3 de ellas en la cúpula de 9) + 3 rejas | cúpula: subir 9 tiles y bajar 9 | + 3 s |

En l5 la subida de B ocupa 61 tiles de ancho (6,5 s corriendo), pero aterrizar, alinearse y saltar 9 veces lleva ≈ 1,0–1,5 s por escalón: **9–14 s solo para B**. Es el único nivel donde lo vertical pesa: ≈ 34 s contra los ≈ 25 s de los demás.

**Total.** 177 s de carrera + ≈ 24 s de tramos verticales = **≈ 3 min 20 s para los 7 niveles**, sin jefes, sin morir y sin esperas. Por nivel: **25 a 34 s**.

**El GDD §6.0 promete 4 a 7 minutos por nivel, sin contar el jefe: 28 a 49 minutos para los 7.** El recorrido real es de 3 min 20 s: entre 8 y 15 veces menos. Para llegar a 4 minutos, un jugador que nunca muere tendría que tardar 7 a 10 veces lo que tarda corriendo. Ni duplicando el tiempo por enemigos, ciclos de viento y caídas, un nivel pasa de 1 minuto.

La contradicción está en el GDD mismo: 240–320 tiles de ancho a 9,4 tiles/s son 26–34 s de carrera. Con esa velocidad, 4 minutos piden una densidad de desafío mucho mayor (hoy: un grupo de ritmo cada 24–34 tiles, unos 3 s) o niveles mucho más largos. `SaveData.playTimeMs` (S13a) ya mide el tiempo real; no hay datos de juego en "Notas de juego de Jose".

---

## Parte 3 · Inventario global de huecos

### Plataformas móviles
**No hay ninguna** en el sentido general. Lo único que se mueve y lleva a Kerana es la vaca (`src/entities/Cow.ts`):

- Qué tiene: `Arcade.Image` sin gravedad e inamovible; choca solo desde arriba (`checkCollision.down/left/right = false`); va y vuelve ± `patrolDistance` 56 px (3,5 tiles) desde donde nace, a `speed` 14 px/s (0,9 tiles/s), con pausa de 1200 ms en cada punta. Mide 30 × 20 (`cow.height` 24 − 4). No tiene código propio para llevar a Kerana: lo hace Arcade al apoyarse sobre un cuerpo inamovible que se mueve. Hay 3 en l4 (x 14, 34, 58) y una más al purificar la vaca embrujada (x 50). Ningún salto del nivel la necesita.
- Qué le falta para ser una plataforma móvil general: objeto propio en el ASCII o Tiled (hoy nace de la letra de enemigo `v`); ancho variable con tiles; recorrido entre dos puntos en cualquier dirección (incluida la vertical, donde Arcade no pega al jugador al bajar); velocidad, pausa y desfase por instancia; choque con el mapa (la vaca ignora paredes y bordes: patrulla a ciegas); arranque opcional por pisada o por disparador; lógica pura con tests (como `SinkingMotor`); reinicio al reaparecer; y un lugar del mapa donde sea necesaria.

### Disparadores
**No hay ningún disparador del jugador** que cambie el nivel a distancia. Lo más cercano:

- **Faroles de l7** (`src/entities/Lantern.ts`, 12 en el mapa, 2 ya encendidos en la arena): al tocarlos se encienden para siempre y dan luz (radio 88 px, `GAMEPLAY.lantern`). Esa luz cambia un estado: el póra se vuelve vulnerable (`needsLight`) y el rincón de la pluma 2 se ve. Es local (solo su radio), permanente, sin tiempo ni cadena. El único que se apaga es el de la arena (aullido de Luisón en la fase 2).
- Otros cambios de estado que no controla el jugador: la arena se cierra al entrar (`BossArena`/`ArenaGate`), las estalactitas, tejas y rocas caen por cercanía (28 px), y las rocas `B` y las lianas se rompen solo en su propio tile.

### Hongos (`Bouncer`)
- Solo en **l5**: 11 objetos (26 tiles). A: x 20, 36, 41, 46 (cadena de la pluma 1); B: x 74–75 (retorno), x 89 (al tronco); C: 5 bajo los huecos del dosel (x 143–144, 153–156, 165–170, 179–182, 192–194, fila 21). Ningún otro nivel ni arena los reutiliza.
- Rebote: `bounceVelocity` −540 → 121,5 px = **7,6 tiles**. Recupera el salto doble y el dash del vuelo (`airJumpUsed` y `airDashUsed` en falso); no reinicia el enfriamiento del dash (660 ms entre inicios). El rebote no se puede cortar soltando el botón. También rebota si Kerana llega caminando por el suelo.
- Combinado: rebote + salto doble en la cima = 121,5 + 48,2 = 169,7 px = **10,6 tiles**. El dash no suma altura (`vy = 0` durante 160 ms): agrega 3,2 tiles de alcance horizontal y 0,16 s de vuelo. Nada del mapa pide más de 7,6.

### Colchones de dificultad
- **Caída a un pozo** (`body.top` > alto del mapa + 32 px) o **agua honda** (centro del cuerpo en `Water`): 1 corazón (`damage.pit`, `damage.water`) y reaparece en `safeGround` con un parpadeo de 400 ms. `safeGround` es el último tile de `Ground` o `Platforms` pisado con los dos pies y sin espinas a 1 tile; camalotes, ramas, hongos y vacas son objetos y no cuentan, así que se vuelve al principio de la cadena. El daño ocurre aunque Kerana esté en dash (`unavoidable`), pero **no durante la Luz de Arasy** (`isImmune` se revisa primero) ni en los 1000 ms de invulnerabilidad tras un daño.
- **Espinas:** mismo trato que un pozo (1 corazón y vuelta a `safeGround`), sin empuje.
- **Daño por contacto:** 1 corazón, 1000 ms invulnerable (2000 en modo asistido), empuje 160 / −220 px/s, 250 ms de control reducido.
- **0 corazones:** reaparece en el último fuego con todos los corazones; la pelea de jefe se reinicia. Sin vidas.
- **Dash intangible:** 160 ms en que `takeDamage` ignora enemigos, jefes, proyectiles, objetos que caen y espinas (`touchesHazard` no se revisa durante el dash). No protege de pozos ni agua honda.
- **Onda de luz del tajo cargado** (desde l2): sale a 14 px de Kerana, avanza 96 px (6 tiles) a 240 px/s (0,4 s), mide 14 × 26 y se desvanece desde el 60 % del recorrido: alcance total ≈ 7 tiles. **Purifica a cualquier enemigo común que toque, sin importar su vida** (también al póra a oscuras y a las abejas), rompe rocas `B` y a un jefe le hace 1 solo en su ventana. **No atraviesa paredes**: al entrar en un tile de `Ground` se apaga en 120 ms y deja de dañar; las plataformas de un solo sentido no la frenan. Una a la vez. Cuesta 600 ms de carga.
- **Luz de Arasy:** 8000 ms (12000 asistido), inmune a todo (incluso pozos y agua) y purifica al tocar. Una por nivel, nunca en las arenas: el modo asistido debía poner una en cada arena (GDD §4.7) y no está hecho. Dónde está respecto del tramo difícil que sigue (8 s de carrera = 75 tiles):

| Nivel | Luz | Lo que sigue |
|---|---|---|
| l1 | x 82 (meseta) | 4 teju'i a 4–16 tiles: cubre el pasillo entero |
| l2 | x 168 | ñakurutu a 4 tiles, cadena 3 a 8–31 tiles: cubre la cadena más larga |
| l3 | x 100 | viento en contra ya empezado, teju'i a 8, espinas a 12, karakara a 18 |
| l4 | x 96 | muro a 4, niebla a 8–15, abejas a 14 |
| l5 | x 76 (escalón 3 de 9) | quedan 6 escalones hasta x 121: cubre media subida, no la entera |
| l6 | x 144 | manadas a 14, 34 y 54 tiles: cubre las tres corriendo |
| l7 | x 170 (pasado el primer jagua hũ, x 158) | cúpula a 2, jagua hũ a 16 y 32, póra a 42 |

---

## Parte 4 · Verificaciones puntuales

### 1. Fases de los jefes 3 a 6
Los cuatro tienen **3 fases** con ataques propios en la tercera (`src/data/bosses.ts` y cada archivo de jefe):

| Jefe | Vida | Fase 1 | Fase 2 | Fase 3 |
|---|---|---|---|---|
| Moñái | 12 (4/4/4) | `descent` | `descent`, `pulse` | `descent`, `pulse`, `steal` (robo del corazón, `Monai.ts`) |
| Jasy Jatere | 9 (3/3/3) | `sparks` | `ambush`, `swarm` (invisible) | `ambush`, `swarm`, `sparks`, más rápido |
| Kurupi | 12 (4/4/4) | `call`, `charge` | `reverse_run`, `stomp`, `call` | `decoy`, `stomp` (copias, `Kurupi.ts`) |
| Ao Ao | 15 (5/5/5) | `charge` | `claw`, `howl`, `charge` | `double_charge`, `rockfall`, `howl` (`AoAo.ts`) |

El GDD §12.2 punto 4 estaba desactualizado: **corregido en esta sesión** (solo esa línea).

### 2. ChaseZone (persecución de Ao Ao, recorte 3)
**No existe.** No hay `ChaseZone` en `src/`, `tools/` ni en los mapas (lo único que se llama "chase" es un estado del enjambre, `SwarmMotor`). El tramo C de l6 es la alternativa del GDD §6.6: 3 manadas y 4 pindó que funcionan como plataformas. Sí existe el refugio (`aoAoLogic.onRefuge`, con tests), pero solo se usa en la arena. Para implementarla haría falta:
- un objeto `rect ChaseZone` en el parser ASCII y en `LevelScene`;
- desplazamiento automático de la cámara en `CameraController` (velocidad, inicio y fin), que se detenga mientras `onRefuge` sea verdadero en un pindó;
- un borde izquierdo que quite 1 corazón y devuelva al último pindó (otro punto de reaparición además de `safeGround` y el fuego);
- Ao Ao y la manada corriendo detrás, atados a la cámara, y dando vueltas al pie del pindó;
- qué pasa con 0 corazones dentro de la persecución (reinicio desde el checkpoint 1) y con el smoke;
- rehacer x 140–229 de l6 como recorrido para cámara automática (≈ 90 tiles, pindó cada ~20) con la ruta alternativa de la pluma 3;
- lógica pura del avance con tests.

### 3. Guardado de las plumas
- El nivel usa **`setFeatherCount(levelId, n)`**, una sola vez, al vencer al jefe (`LevelScene.finishLevel`). `collectFeather(levelId, index)` existe en `SaveManager` pero **nadie lo llama**. El ASCII pone `index` 0–2 a cada pluma; `Pickup` lo ignora y no consulta el guardado: **las 3 plumas reaparecen en cada partida**.
- `setFeatherCount` **sobrescribe** el conteo con lo recogido en esa partida: rejugar un nivel y recoger menos plumas **baja** el guardado (rejugar sin recoger ninguna lo deja en 0). Las plumas recogidas antes de abandonar el nivel no se guardan (GDD §4.6 dice que sí).
- Consecuencia para las 21: hay que juntar las 3 de cada nivel **en una misma partida**. Como l1 (plumas 2 y 3), l2 (3), l3 (1) y l4 (2) piden dones posteriores, hay que rejugar l1–l4 enteros, jefe incluido, recogiendo las tres cada vez. Al sellar a Tau se suman los 7 niveles con `getFeathers(...).filter(Boolean)`: solo con 21 aparece la diapositiva final. Rejugar un nivel ya completo con la idea de "solo buscar la que falta" borra las otras dos.

---

## Parte 5 · Los diez huecos más importantes

1. **Duración.** Los niveles duran 25–34 s de carrera pura contra los 4–7 min del GDD §6.0 (3 min 20 s el juego entero, sin jefes). Hay un grupo de ritmo cada 24–34 tiles. Todos los niveles. Costo: **alto** (contenido nuevo en los 7 mapas, o revisar la promesa del GDD).
2. **Los dones no abren nada en el camino.** Tajo cargado, salto doble y dash nunca se exigen en el recorrido principal: solo en plumas y secretos. Lo que el GDD §3.7 llama "qué abre" no se siente. l3–l7 se juegan con los verbos de l1. Costo: **medio** (datos en los ASCII).
3. **Plumas mal guardadas.** `setFeatherCount` sobrescribe, las plumas reaparecen, nada se guarda al recogerlas; rejugar puede bajar el conteo, y las 21 piden una partida perfecta por nivel. Rompe la rejugabilidad del GDD §4.4. Sistema de guardado y `LevelScene`. Costo: **bajo**.
4. **Faltan dos de los cinco componentes.** No hay plataformas móviles (la vaca no sirve como tal) ni disparadores (los faroles de l7 son locales). Todo el juego. Costo: **medio** (entidad nueva + mapas).
5. **Niveles de una sola celda.** Solo l4 (techos de C) tiene una ruta paralela real; l3 y l6 tienen tramos cortos. El resto son bolsillos sin salida (secretos de S12b, plumas). Costo: **medio** (los lugares de la Parte 1 caben sin rehacer los mapas).
6. **Colchones que se comen el desafío.** Desde l2, la onda de luz purifica a cualquier enemigo común a ≈ 7 tiles en 0,4 s, sin importar su vida. La Luz de Arasy evita también el daño de pozos y agua. l1, l4 y l7 no tienen ni un pozo. Costo: **bajo** (valores en `gameplay.ts` y mapas; decisión de Jose).
7. **l6 C sin su idea.** La persecución está recortada y su reemplazo es un tramo llano con 3 manadas; el pindó no tiene función fuera de la arena, y le sigue el tramo vacío x 212–234. Costo: **alto** con `ChaseZone`, **medio** con un rediseño sin cámara automática.
8. **Mecánicas de un solo nivel.** Camalotes solo en l2, niebla en l4, hongos y ramas en l5, oscuridad en l7; viento en l3 y l6. Ningún nivel combina mecánicas anteriores, y 4 niveles (l1, l2, l4, l7) no tienen ayudas de movimiento. Los 11 hongos están todos en l5. Costo: **bajo** (reusar `Bouncer`, `Sinking`, `Crumble`, `WindZone` es escribir ASCII).
9. **Plumas que no piden nada.** l2-2 (en un junco del camino) y l7-3 (en la cúpula del camino) son imposibles de perder; l3-3, l4-3 y l7-1 no tienen riesgo. Hay dos notas de sesión equivocadas: l2-3 no exige dash (alcanza el salto doble) y l6-2 no se alcanza con viento (exige salto doble). Costo: **bajo** (mover pickups en los ASCII).
10. **Tramos vacíos y detalles del GDD.** l7 x 27–53 (27 tiles), l6 x 212–234 (23) y l3 x 1–21 (21) no tienen nada. La antesala de l4 no tiene guavirá. El modo asistido no pone una Luz de Arasy en las arenas (GDD §4.7). Costo: **bajo**.

Bien resuelto, en una línea: cada nivel tiene 2 checkpoints, 1 Luz de Arasy antes de su tramo más denso, secreto marcado con luciérnagas y práctica segura del don; nada que haya que saltar mide más de 3 tiles en el camino; l6 es el que mejor usa las plumas (las 3 compensan un riesgo).
