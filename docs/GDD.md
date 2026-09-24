# Kerana: Pokõi Mbyja
## Documento de Diseño del Juego (GDD)

> **Título provisional.** *Pokõi mbyja* significa "siete estrellas" en guaraní. Alternativa en español: *Kerana: Las siete estrellas*. **[Revisar]**

| Campo | Valor |
|---|---|
| Versión | 0.1, base para producción |
| Fecha | Septiembre de 2026 |
| Idea y dirección | Jose |
| Género | Plataformas y acción 2D con jefes y progresión ligera de habilidades |
| Plataforma | Navegador (PC y móvil), publicado en GitHub Pages |
| Tecnología | Phaser 4 · Vite · TypeScript |
| Público | 10 años en adelante |
| Duración | 45 a 75 minutos la primera partida |
| Idiomas | Español (principal) · inglés [Extra] |

### Índice

0. Cómo usar este documento
1. Visión general
2. Historia y mundo
3. Kerana, la jugadora
4. Sistemas de juego
5. Enemigos
6. Niveles y jefes
7. Jefe secreto: Tau [Extra]
8. Pantallas e interfaz
9. Arte
10. Audio
11. Especificación técnica
12. Alcance y prioridades
13. Glosario
14. Fuentes

---

## 0. Cómo usar este documento

- Es la **fuente de verdad** del diseño. Si cambias una decisión, cámbiala aquí primero; el código la sigue.
- Etiquetas de prioridad (detalle en §12):
  - **[MVP]**: imprescindible para que el juego exista.
  - **[Núcleo]**: debería entrar; se recorta solo si el presupuesto aprieta.
  - **[Extra]**: solo si sobra presupuesto.
- **[Revisar]** marca datos culturales, lingüísticos o licencias creativas que el autor debe validar.
- Todos los números de "sensación" son valores iniciales. Viven en `src/config/gameplay.ts` y se ajustan jugando.
- **Para Claude Code:** lee este índice y **solo las secciones que cita tu sesión** en `docs/PLAN.md`.

---

## 1. Visión general

### 1.1 Resumen
Tau, el espíritu del mal, robó a Kerana y la hundió en un sueño embrujado. Mientras dormía, sus siete hijos, marcados por una maldición, crecieron como los monstruos de la mitología guaraní y hoy siembran el miedo por todo el Paraguay.

Siete años después, Kerana despierta en los cerros de Paraguarí con un sable de luz en la mano y un colibrí a su lado. Recorre siete lugares del país, del estero a la selva y del pueblo a la capital, para enfrentarse a cada hijo. No viene a matarlos: viene a **liberarlos**. Cada hijo liberado sube al cielo como una estrella, hasta formar **Eichu**, las Pléyades: la constelación que para los guaraníes anuncia el año nuevo.

### 1.2 Pilares de diseño

1. **Madre, no cazadora.** Cada jefe es un hijo. Vencer es liberar: la marca de Tau se rompe y hay reencuentro.
2. **El mito se juega.** Cada rasgo de la leyenda se vuelve mecánica: las siete cabezas de Teju Jagua, el bastón que vuelve invisible a Jasy Jatere, el pindó que protege del Ao Ao.
3. **Paraguay reconocible.** Lugares reales, flora y fauna locales (guavirá, pindó, lapacho, tacurú, yacaré) y palabras en guaraní.
4. **Preciso y justo.** Controles ajustados, ataques siempre anunciados, checkpoints generosos y ningún "game over".
5. **A la medida del presupuesto.** Todo es modular y basado en datos, para construirlo con unos US$100 de sesiones de Claude Code (ver `docs/PLAN.md`).

### 1.3 Experiencia buscada

- En los primeros 30 segundos, el jugador despierta, corre, salta y corta una liana sin leer instrucciones.
- Cada nivel enseña **una idea nueva**, la combina con lo conocido y la pone a prueba contra el jefe.
- Cada jefe cuenta su historia a través de su mecánica y termina en un momento emotivo breve.
- Al final, el jugador mira el cielo nocturno y reconoce las siete estrellas.

### 1.4 Referencias

- **Sensación de salto:** Celeste (coyote time, buffer, salto variable).
- **Combate con arma corta y jefes con patrones:** Shovel Knight; Cuphead por la claridad de los avisos.
- **Habilidades que abren caminos al volver:** Hollow Knight, en versión mínima.
- **Cultura:** Narciso R. Colmán, *Ñande Ypy Kuéra* (1929); Museo Mitológico Ramón Elías (Capiatá).

### 1.5 Estructura del juego
Título → Prólogo → Mapa → Nivel 1 … Nivel 7 (cada nivel termina con su jefe) → Final → Créditos.

Rejugabilidad: 3 plumas de mainumby por nivel, mejores tiempos [Extra] y jefe secreto [Extra].

---

## 2. Historia y mundo

### 2.1 El mito (resumen fiel a las fuentes)

- **Creación.** Tupã, junto con la diosa Arasy, bajó a la tierra (según algunas versiones, a un cerro de Areguá) y creó el mundo. La primera pareja humana fue Rupave y Sypave, "padre" y "madre de los pueblos". Entre sus hijos estaban Tume Arandu, el sabio, y Marangatu; entre sus hijas, Porâsy.
- **Kerana.** Hija de Marangatu. Su nombre significa "dormilona", porque pasaba los días durmiendo.
- **Tau.** El espíritu del mal se transformó en un joven apuesto, visitó a Kerana durante siete días e intentó raptarla. Angatupyry, el espíritu del bien, luchó contra él siete días y siete noches, pero Pytajovái, dios de la guerra, ayudó a Tau, y Tau se llevó a Kerana.
- **La maldición.** Arasy maldijo a Tau y a toda su descendencia. Kerana dio a luz siete hijos, todos sietemesinos y todos marcados: **Teju Jagua, Mbói Tu'i, Moñái, Jasy Jatere, Kurupi, Ao Ao y Luisón**.
- **El fin de los siete.** En la versión de Colmán, la joven Porâsy se sacrifica: reúne a los hermanos en una cueva que luego es incendiada. En una de las versiones, los siete, purificados por el fuego, suben al cielo y forman **Eichu** (las Pléyades). Kerana muere de pena, y donde muere brota un manantial que corre para siempre. Tau vuelve buscando venganza, pero el sabio Tume Arandu lo deja hechizado.
- **Eichu.** Cuando las Pléyades aparecen por el este antes del amanecer, a comienzos de junio, empieza el año nuevo guaraní: un tiempo de renovación.

> El mito original incluye violencia sexual de Tau contra Kerana y rasgos sexuales en algunos hijos. El juego los omite por completo (ver §2.8).

### 2.2 Nuestra adaptación (licencias creativas)

| En el mito | En el juego | Por qué |
|---|---|---|
| Kerana es víctima pasiva | Kerana es la protagonista que actúa | Da agencia a la heroína: es una madre que recupera a sus hijos |
| Tau solo la rapta | Tau además la hunde en un sueño de siete años y usa a sus hijos como armas | Juega con el significado de su nombre y justifica el "despertar" |
| Los siete mueren en el fuego | La **marca de Tau** se rompe con el sable de luz y cada hijo sube al cielo como estrella | Conserva la purificación y el origen de Eichu, sin muertes |
| Porâsy destruye a los monstruos | Porâsy no aparece (cameo posible [Extra]) | Kerana ocupa el papel de liberadora |
| Kurupi según Colmán | Se agregan los **pies al revés**, un rasgo de versiones regionales del Curupí y la Curupira **[Revisar]** | Da una mecánica de engaño; hay alternativa 100 % Colmán en §6.5 |
| Orden de nacimiento | Los niveles siguen el orden de nacimiento, del primero al séptimo | Estructura clara: Luisón, el séptimo, es el jefe final |

### 2.3 Personajes

**Kerana.** Protagonista. Joven guaraní, hija de Marangatu. Valiente y tierna, a veces cansada ("siete años dormí y todavía tengo sueño"). Lucha con el **sable de Angatupyry**, una hoja curva de luz dorada que el espíritu del bien le deja en la mano al despertar.

**Mainumby.** Compañero. Colibrí mensajero de Angatupyry. Vuela junto a Kerana, da pistas y comenta con humor ligero. En la cosmología mbya, el colibrí aparece junto al creador **[Revisar]**.

**Angatupyry.** Espíritu del bien. Aparece como luz y voz en el prólogo y en el final.

**Tau.** Antagonista. Casi siempre fuera de escena: una sombra, una carcajada, la marca sobre sus hijos. Cuando se muestra, es un joven apuesto con una flauta (su disfraz en el mito) o una silueta de humo violeta con ojos rojos.

**Arasy.** Madre del cielo, asociada a la luna. No aparece en pantalla, pero su luz protege a Kerana (power-up **Luz de Arasy**). Arasy lanzó la maldición; ahora ayuda a Kerana a deshacer lo que la maldición torció.

**Marangatu.** Padre de Kerana. Solo aparece en el prólogo.

**Tume Arandu.** El sabio. Solo aparece en el jefe secreto [Extra].

**Los siete hijos**

| # | Nombre | Epíteto en el juego | Rasgo mítico clave | Idea jugable |
|---|---|---|---|---|
| 1 | Teju Jagua | Guardián de las cavernas y los frutos | Lagarto enorme con siete cabezas de perro y ojos de fuego; casi no se mueve; come frutas y miel | Siete cabezas que atacan por turnos; el cuerpo queda en la penumbra |
| 2 | Mbói Tu'i | Señor de los esteros | Serpiente con cabeza de loro, pico enorme y lengua roja bífida; protege a los anfibios; ama las flores; grazna fortísimo | Emerge del agua; graznido sónico; flores que curan |
| 3 | Moñái | Señor de los campos abiertos y del aire | Serpiente con dos cuernos rectos e iridiscentes que hipnotizan; se descuelga de los árboles; protege el robo | Cae desde las copas; hipnosis que invierte los controles; roba corazones |
| 4 | Jasy Jatere | Señor de la siesta | Niño de pelo dorado con un bastón de oro que lo vuelve invisible; domina a las abejas | Invisible salvo por su silbido; hay que quitarle el bastón |
| 5 | Kurupi | Señor de la selva y sus animales | Figura baja, pelo como alambre y boca grande; domina a los animales silvestres; nunca sale de la selva | Llama animales; huellas engañosas [licencia creativa] |
| 6 | Ao Ao | Señor de los cerros | Bestia con cuerpo de oveja, cabeza feroz como de oso y garras; anda en manada; se para en dos patas para atacar; solo el pindó salva de él | Persecución; el pindó como refugio; embestidas |
| 7 | Luisón | Señor de la noche y los camposantos | Cabeza de perro con una hilera de dientes, cuerpo seco, extremidades mitad garras; aúlla trepado a las lápidas | Pelea en la oscuridad; aullidos; forma de luna llena |

### 2.4 Prólogo: texto de las diapositivas [MVP]
Una ilustración por diapositiva (o fondo oscuro con partículas mientras no haya arte). El texto aparece letra por letra.

1. "Dicen los antiguos que Tupã y Arasy bajaron a la tierra y crearon los ríos, los montes y las estrellas."
2. "Entre los primeros pueblos vivía Marangatu, y con él su hija Kerana, a quien todos llamaban la dormilona."
3. "Tau, el espíritu del mal, se disfrazó de joven hermoso para llevársela. Angatupyry, el espíritu del bien, luchó contra él siete días y siete noches… pero Tau venció."
4. "Arasy maldijo a Tau y a toda su descendencia. Los siete hijos de Kerana nacieron con la marca de la maldición."
5. "Tau durmió a Kerana con un hechizo y usó a sus hijos para sembrar el miedo en toda la tierra."
6. "Pasaron siete años. En los cerros de Paraguarí, una luz se enciende en la mano de Kerana. Kerana despierta."

### 2.5 Arco de cada nivel

| Nivel | Hijo | Bajo la marca de Tau… | Al ser liberado dice… | Pista del siguiente |
|---|---|---|---|---|
| 1 | Teju Jagua | Custodia la oscuridad en vez de los frutos | "¿Che sy? ¿Sos vos?" | Mbói Tu'i grita en los esteros del sur |
| 2 | Mbói Tu'i | Su graznido ahuyenta a las ranas que protegía | "Las ranas lloraban por mí." | Moñái roba en los campos abiertos |
| 3 | Moñái | Roba sin parar para llenar un vacío | "Robé tanto. Nada llenaba el vacío." | Jasy Jatere juega en Capiatá a la hora de la siesta |
| 4 | Jasy Jatere | Sus juegos se volvieron crueles | "Solo quería que alguien jugara conmigo." | Kurupi nunca sale de la selva |
| 5 | Kurupi | Usa a los animales como soldados | "La selva era mi única casa." | Ao Ao caza en el Ybytyruzú; hay que subir a un pindó |
| 6 | Ao Ao | Un hambre que nunca se calma | "Siempre tuve hambre." | Luisón espera donde duermen los muertos, en Asunción |
| 7 | Luisón | La tristeza de haber nacido último, en la oscuridad | "Nací último. Y nací en la oscuridad." | (Final) |

### 2.6 Final [MVP]

1. "Siete estrellas subieron al cielo, una por cada hijo."
2. "Los guaraníes las llaman Eichu. Cuando aparecen antes del amanecer, a comienzos de junio, empieza el año nuevo: el tiempo de volver a empezar."
3. "Kerana se sentó junto a un manantial que nunca dejaría de correr y miró a sus hijos brillar." (Guiño al manantial de Kerana en el mito.)
4. Si faltan plumas: "Pero lejos, en la oscuridad, Tau todavía escuchaba…" → Créditos.
   Con las 21 plumas [Extra]: Mainumby: "Kerana… Tau está en Yvága. Esta vez no se escapa." → Jefe secreto (§7).

### 2.7 Tono de escritura

- Frases cortas, con tono de leyenda contada junto al fuego. Mainumby aporta humor ligero, nunca sarcasmo moderno.
- **Los diálogos usan el voseo paraguayo** ("¿sos vos?", "corré", "saltá"). La narración del prólogo y el final va en tercera persona neutra.
- Las palabras en guaraní se usan con naturalidad (glosario §13). Se traducen solo cuando el contexto no alcanza.
- Cada diálogo tiene como máximo 3 líneas por personaje y 90 caracteres por línea.

### 2.8 Sensibilidad cultural y de contenido [MVP]

- **Kerana y Tau:** se omite toda violencia sexual. Tau "se la llevó" y "la durmió con un hechizo".
- **Kurupi:** se omiten sus rasgos sexuales del mito. En el juego es el señor de la selva y sus animales.
- **Jasy Jatere:** se usa la versión popular infantil (el duende de la siesta que se lleva a los niños que no duermen), no la de Colmán.
- **Luisón:** no hay cadáveres ni tumbas profanadas. Ronda el camposanto y aúlla sobre las lápidas; al liberarlo, vuelve la paz y se encienden las velas.
- **Ao Ao:** "caza a la gente", sin sangre ni gore.
- **Enemigos:** son animales marcados por Tau; al vencerlos se purifican y huyen, no mueren.
- **Representación guaraní:** la vestimenta y los adornos de Kerana se basan en referencias guaraníes (tipoi, collares de semillas, pintura de urucú **[Revisar]**). Se evitan los estereotipos genéricos de "indígena de película", como los tocados de guerra de pueblos norteamericanos, los flecos de cuero o los tótems. Nada de caricaturas.
- **Idioma:** conviene validar el guaraní con hablantes. Todas las palabras están en el glosario para revisarlas en un solo lugar.
- **Lugares reales:** son versiones ficcionalizadas y respetuosas. La Recoleta es un cementerio real: nada de humor sobre los difuntos.

---

## 3. Kerana, la jugadora

### 3.1 Apariencia

Diseño aprobado por Jose (S3; prompt en `docs/ASSETS.md` §3.2):

- Joven guaraní del Paraguay, piel morena clara (#D4A07A), rasgos indígenas sudamericanos. **Sin plumas ni pintura facial.**
- Pelo negro, lacio y largo, suelto sobre la espalda (sin trenzas).
- Vincha tejida con un dibujo geométrico café y beige.
- **Tipoi** (tipoy) suelto, sin mangas, de algodón natural beige crema (#E8D8BE) con una guarda geométrica café (#8B5A3C) en el borde, hasta las rodillas.
- Collar de semillas blancas y cafés; pulsera sencilla.
- Descalza.
- Sable curvo con hoja de luz dorada.
- Silueta legible a 46 px de alto: pelo largo, vestido claro y sable brillante.

### 3.2 Controles
Teclado [MVP]; mando y táctil [Núcleo].

| Acción | Teclado | Mando | Táctil |
|---|---|---|---|
| Moverse | ← → o A D | Stick izquierdo o cruceta | Cruceta virtual (izquierda) |
| Saltar (mantener = más alto) | Espacio, Z o K | A (Xbox) / ✕ (PlayStation) | Botón Saltar |
| Atacar (mantener = tajo cargado) | X o J | X (Xbox) / ▢ (PlayStation) | Botón Atacar |
| Dash (cuando se obtiene) | C, L o Shift | RB / R1 | Botón Dash (aparece al obtenerlo) |
| Pausa | Esc o P | Start | Botón ⏸ |
| Avanzar diálogo | Saltar o Atacar | A | Tocar la pantalla |

Los textos de ayuda muestran las teclas del dispositivo que se esté usando.

### 3.3 Movimiento y acciones

- **Correr:** aceleración y frenado cortos; ni hielo ni respuesta instantánea.
- **Salto variable:** mantener el botón da un salto más alto; soltarlo lo corta.
- **Coyote time:** se puede saltar un instante después de dejar un borde.
- **Buffer de salto:** si se pulsa saltar justo antes de tocar el suelo, salta al aterrizar.
- **Caída limitada:** hay una velocidad máxima de caída.
- **Ataque con el sable:** tajo horizontal hacia adelante, en el suelo o en el aire.
- **Tajo cargado** (don 1): mantener atacar 0,6 s (Kerana brilla) y soltar. Tajo amplio de 3 de daño que rompe rocas agrietadas.
- **Salto doble** (don 3): un segundo salto en el aire.
- **Dash** (don 4): impulso horizontal corto. Kerana es intangible mientras dura. Uno por salto en el aire.
- **Ataque hacia abajo (pogo)** [Extra]: tajo hacia abajo en el aire que rebota sobre enemigos.

### 3.4 Parámetros iniciales [MVP]
Todos en `src/config/gameplay.ts`. Unidades: píxeles del juego (base 640×360), segundos o milisegundos.

| Parámetro | Valor inicial | Nota |
|---|---|---|
| Gravedad | 1200 px/s² | |
| Velocidad al correr | 150 px/s | ≈ 9 tiles por segundo |
| Aceleración en el suelo | 1600 px/s² | |
| Frenado en el suelo | 2000 px/s² | |
| Control en el aire | 0,8 × aceleración | |
| Velocidad de salto | −400 px/s | Altura ≈ 67 px ≈ 4 tiles |
| Corte del salto al soltar | velocidad vertical × 0,45 | Solo si aún sube |
| Velocidad máxima de caída | 420 px/s | |
| Coyote time | 90 ms | |
| Buffer de salto | 110 ms | |
| Salto doble | −340 px/s | ≈ 3 tiles extra |
| Dash | 320 px/s durante 160 ms | Enfriamiento de 500 ms |
| Ataque: hitbox | 26 × 18 px delante de Kerana | |
| Ataque: tiempos | Activo 90 ms desde el frame 2; total 280 ms | |
| Ataque: daño y empuje | 1 de daño; empuje de 120 px/s | |
| Tajo cargado | Mantener ≥ 600 ms; hitbox 40 × 28; 3 de daño | |
| Invulnerabilidad tras daño | 1000 ms con parpadeo a 10 Hz | 2000 ms en modo asistido |
| Retroceso al recibir daño | 160 px/s horizontal, −220 px/s vertical | |
| Hit-stop | 50 ms al golpear; 80 ms al recibir daño | |
| Luz de Arasy | 8000 ms; parpadea los últimos 2000 ms | 12000 ms en modo asistido |
| Corazones | 4 al inicio; 7 como máximo | +3 en modo asistido |
| Cámara | lerp 0,12; zona muerta 60 × 40; anticipación de 40 px hacia donde mira | |

### 3.5 Estados y animaciones
**Estados** (máquina de estados explícita): `idle`, `run`, `jump`, `fall`, `attack`, `charge`, `dash`, `hurt`, `ko`.

Transiciones principales:

- `idle` ↔ `run` según la entrada horizontal.
- `idle`/`run` → `jump` al saltar (incluido coyote y buffer); `jump` → `fall` cuando la velocidad vertical es ≥ 0; `fall` → `idle`/`run` al aterrizar.
- Cualquier estado móvil → `attack` (en el aire mantiene la inercia) → vuelve al estado previo.
- `idle`/`run` → `charge` si se mantiene atacar ≥ 600 ms; al soltar, tajo cargado.
- Cualquier estado → `dash` (si está desbloqueado y disponible) → `fall` o `idle`.
- Cualquier estado → `hurt` al recibir daño (≈ 250 ms de control reducido) → `fall` o `idle`.
- 0 corazones → `ko` → reaparición.

**Animaciones:** obligatorias `idle`, `run`, `jump` (subida), `fall` (caída), `attack` y `hurt`. Opcionales: `charge` (brillo sobre `idle`), `dash` (estela de imágenes), `ko` y `victory`.

### 3.6 Vida, daño y caídas [MVP]

- **Corazones:** 4 al empezar. Los dones de Mbói Tu'i, Kurupi y Ao Ao suman 1 cada uno, hasta 7, el número del mito.
- **Daño:** tocar un enemigo o un ataque de jefe quita 1 corazón, con invulnerabilidad y retroceso.
- **Caídas:** caer a un pozo o a agua profunda quita 1 corazón y Kerana reaparece en el último suelo firme.
- **0 corazones:** "Kerana cae" (fundido a negro breve) y reaparece en el último checkpoint con todos los corazones. En una pelea de jefe, la pelea se reinicia desde la antesala.
- No hay vidas ni "game over".

### 3.7 Dones: progresión [Núcleo]

| Nivel | Hijo liberado | Don | Efecto | Qué abre |
|---|---|---|---|---|
| 1 | Teju Jagua | **Tajo cargado** | Mantener atacar y soltar; 3 de daño | Rocas y tacurúes agrietados |
| 2 | Mbói Tu'i | **Corazón del estero** | +1 corazón máximo (5) | — |
| 3 | Moñái | **Salto doble** ("el aire es de Moñái") | Segundo salto en el aire | Cornisas y copas altas |
| 4 | Jasy Jatere | **Paso de la siesta** (dash) | Impulso horizontal intangible | Huecos largos y pasos estrechos |
| 5 | Kurupi | **Corazón de la selva** | +1 corazón máximo (6) | — |
| 6 | Ao Ao | **Corazón del cerro** | +1 corazón máximo (7) | — |
| 7 | Luisón | — | Final | — |

Si hay que recortar (§12), los tres dones de habilidad pueden darse desde el principio.

---

## 4. Sistemas de juego

### 4.1 Combate [MVP]

- La hitbox del sable es independiente de la de Kerana y solo está activa en ciertos frames.
- Los enemigos comunes aguantan de 1 a 3 golpes. Al recibir un golpe parpadean en blanco 60 ms y retroceden un poco.
- **Hit-stop:** la acción se congela un instante al golpear y al recibir daño, para dar peso al impacto.
- Sacudida leve de cámara en golpes fuertes (desactivable, §4.9).
- **Purificación:** los enemigos vencidos no mueren. La marca de Tau se desprende como humo violeta, un destello de luz cálida y el animal huye o se disuelve en chispas.
- Tocar a un enemigo hace daño a Kerana, salvo con la Luz de Arasy activa o durante el dash.

### 4.2 Checkpoints: los fuegos [MVP]

- Pequeñas fogatas apagadas (*tata*, fuego). Al tocarlas se encienden con sonido y chispas y guardan la posición.
- Dos por nivel: uno a mitad de camino y otro en la antesala del jefe.
- Al encenderlas por primera vez, recuperan 1 corazón [Núcleo].
- En el nivel 7 son faroles: el mismo objeto con otra apariencia.

### 4.3 Objetos

| Objeto | Id | Efecto | Frecuencia |
|---|---|---|---|
| Guavirá | `guavira` | Cura 1 corazón | 2 a 4 por nivel; siempre uno en la antesala |
| Luz de Arasy | `luz_arasy` | Inmunidad 8 s: Kerana brilla plateada, no recibe daño y purifica a los enemigos comunes al tocarlos. Contra los jefes solo evita el daño | 1 o 2 por nivel, antes de los tramos difíciles; nunca en arenas de jefe (salvo en modo asistido) |
| Pluma de mainumby | `pluma` | Coleccionable (3 por nivel) | Escondidas; ver cada nivel |
| Flor del estero | `yvoty` | Cura 1 corazón | Solo en la pelea contra Mbói Tu'i |

La Luz de Arasy usa el sistema de **filtros** de Phaser 4 (por ejemplo, Glow) más un tinte plateado, y parpadea durante los últimos 2 s.

### 4.4 Plumas y rejugabilidad [Núcleo]

- 3 plumas por nivel, 21 en total. Algunas requieren dones posteriores, así que conviene volver a niveles anteriores.
- El mapa muestra las plumas de cada nivel (0/3, 1/3…).
- Con las 21 plumas se abre el jefe secreto [Extra].
- Mejor tiempo por nivel [Extra].

### 4.5 Mainumby, el compañero [Núcleo]

- Sigue a Kerana con un retraso suave, flotando sobre su hombro.
- Los carteles invisibles `Sign` del mapa hacen que Mainumby diga una línea corta (burbuja de 2 a 3 s) **sin detener el juego**.
- Ejemplos:
  - "¡Kerana! ¡Por fin! Siete años dormiste… y el mundo se puso feo."
  - "Esa liana no se va a mover sola. ¡Usá tu sable!"
  - "Encendé los fuegos: si caés, volvés acá."
  - "¡La Luz de Arasy! Mientras brilles, nada te toca."
  - "Un guavirá. Dulce, y te cura."
- Indicar plumas cercanas con un brillo [Extra].

### 4.6 Progresión y guardado [MVP]

- Los niveles se desbloquean en orden. Los completados se pueden rejugar desde el mapa.
- Guardado automático al completar un nivel, obtener una pluma o un don y cambiar opciones.
- La posición del checkpoint solo vale durante la partida en curso del nivel; al salir al mapa, el nivel empieza de nuevo (las plumas recogidas quedan guardadas).

### 4.7 Dificultad y modo asistido [Núcleo]

- Hay una sola dificultad normal.
- **Modo asistido** (Opciones; se puede cambiar en cualquier momento): +3 corazones máximos, avisos de jefe 30 % más largos, invulnerabilidad de 2 s tras el daño, Luz de Arasy de 12 s y una Luz de Arasy en cada arena de jefe.

### 4.8 Estados alterados

| Estado | Dónde | Efecto | Cómo se lee |
|---|---|---|---|
| Hipnosis | Moñái (N3) | Controles horizontales invertidos 3 s | Espiral iridiscente sobre Kerana, tinte y sonido agudo |
| Sueño de siesta | N4 | Quieta 2 s dentro de la niebla → se duerme 1,5 s; pulsar botones acorta el sueño | "Zzz" sobre Kerana, bostezo antes de dormirse |
| Viento | N3, N6 | Empuje horizontal constante mientras dura la ráfaga | El pasto se inclina y aparecen partículas 1 s antes |
| Agua baja | N2 | Velocidad de carrera × 0,6 | Salpicaduras |
| Oscuridad | N7 | Solo se ve el halo de luz de Kerana y los faroles | Iluminación de Phaser 4 |

### 4.9 Accesibilidad [Núcleo]

- Ningún aviso depende solo del color: siempre hay forma, sonido y color.
- Opción para desactivar la sacudida de cámara y los destellos fuertes.
- Velocidad del texto configurable; los diálogos nunca avanzan solos.
- Controles reasignables [Extra].

---

## 5. Enemigos

### 5.1 Principios

- Son animales o espíritus menores **marcados por Tau**: una espiral violeta en el cuerpo y ojos con brillo violeta.
- Al vencerlos se purifican (§4.1).
- Cada nivel presenta 1 o 2 enemigos nuevos y reutiliza otros.
- Todo enemigo se lee en medio segundo: silueta clara y un aviso antes de atacar.

### 5.2 Arquetipos: comportamientos reutilizables
[MVP]: Walker, Flyer y Charger. El resto se implementa en la sesión del nivel que lo usa.

| Arquetipo | Comportamiento | Parámetros principales |
|---|---|---|
| **Walker** | Patrulla y gira en bordes y paredes | velocidad, distancia de patrulla |
| **Charger** | Detecta a Kerana, se prepara (aviso) y embiste en línea recta; frena contra paredes | radio de detección, aviso (ms), velocidad de carga |
| **Flyer** | Vuela en onda o patrulla en el aire; ignora la gravedad | amplitud, frecuencia, velocidad |
| **Diver** | Espera en lo alto y se lanza en picada hacia la posición de Kerana | radio, aviso, velocidad de picada |
| **Lurker** | Oculto (agua, ramas); emerge cuando Kerana se acerca; vulnerable solo fuera | radio, tiempo expuesto |
| **Thrower** | Lanza proyectiles en arco desde un punto fijo | cadencia, velocidad del proyectil |
| **Jumper** | Salta hacia Kerana cada cierto tiempo | fuerza del salto, espera |
| **Swarm** | Enjambre de partículas que persigue un tiempo y se dispersa | duración, velocidad |

### 5.3 Catálogo

| Id | Nombre | Arquetipo | Niveles | Vida | Notas |
|---|---|---|---|---|---|
| `teju_i` | Teju'i (lagartija) | Walker | 1, 3 | 1 | El primer enemigo del juego |
| `mbopi` | Mbopi (murciélago) | Flyer | 1, 7 | 1 | Sale de grietas |
| `jakare` | Jakare (yacaré) | Lurker | 2 | 3 | Burbujas antes de emerger |
| `nakurutu` | Ñakurutu (búho) | Diver | 2, 7 | 1 | Espera en postes |
| `mboi` | Mbói (serpiente) | Walker / Lurker colgante | 2, 5 | 2 | En N5 cuelga de las ramas |
| `nandu` | Ñandu | Charger | 3 | 2 | Se puede saltar por encima |
| `karakara` | Karakara | Diver | 3, 6 | 1 | |
| `jagua` | Jagua embrujado (perro) | Charger | 4 | 2 | Ladra como aviso |
| `abejas` | Enjambre de abejas | Swarm | 4 | 1 | Hecho con partículas; sin sprite propio |
| `kuati` | Kuati (coatí) | Jumper | 5 | 2 | |
| `kai` | Ka'i (mono) | Thrower | 5 | 2 | Lanza frutas desde las copas |
| `taitetu` | Taitetu (pecarí) | Charger (en manada) | 6 | 2 | Van de a 2 o 3 |
| `ao_ao_cria` | Cría de Ao Ao | Jumper | 6 | 1 | |
| `pora` | Póra (fantasma) | Flyer | 7 | 2 | Solo es vulnerable cuando está iluminado |
| `jagua_hu` | Jagua hũ (perro negro) | Charger | 7 | 2 | Ojos brillantes como aviso en la oscuridad |

Todo enemigo común quita 1 corazón al contacto.

---

## 6. Niveles y jefes

### 6.0 Estructura común

- **Tamaño:** entre 240 y 320 tiles de ancho (tiles de 16 px). Una pantalla son 40 × 22,5 tiles.
- **Duración:** 4 a 7 minutos más el jefe.
- **Recorrido tipo:**
  - Tarjeta de título: lugar y subtítulo, por ejemplo "Nivel 1 · Paraguarí · Ybyty: los cerros dormidos".
  - **A. Introducción:** enseña la idea nueva sin riesgo.
  - **B. Desarrollo:** combina la idea con enemigos.
  - **Checkpoint 1.**
  - **C. Giro:** variante más difícil, verticalidad o un secreto.
  - **Checkpoint 2 (antesala):** siempre con un guavirá.
  - **Arena del jefe.**
- **Plumas:** una por sección (A, B y C). Al menos una por nivel requiere un don posterior, desde N1 hasta N4.
- **Arena del jefe:** una pantalla (40 × 23 tiles). Al entrar, la cámara se fija, la entrada se cierra (raíces o rocas) y aparece la barra de vida con nombre y epíteto.
- **Jefes:** 3 fases con umbrales de vida. Cada ataque tiene aviso (telegraph) y una ventana para castigarlo.
- **Secuencia de liberación [MVP]** (código común a todos los jefes):
  1. Último golpe → cámara lenta 0,5 s.
  2. La marca de Tau se agrieta y estalla en luz.
  3. Diálogo breve de reencuentro.
  4. El hijo se vuelve luz y sube; aparece una estrella en el cielo del mapa.
  5. Cartel "Don obtenido" → pantalla de nivel completado → mapa.

### 6.1 Nivel 1: Paraguarí · *Ybyty: los cerros dormidos*

| | |
|---|---|
| Lugar | Cerros de Paraguarí, "la ciudad de los cerros" (inspiración: Cerro Perõ y Cerro Hũ) |
| Hora | Amanecer |
| Tamaño | ≈ 240 × 34 tiles |
| Idea nueva | Lo básico: correr, saltar, atacar, fuegos, curación y Luz de Arasy |
| Enemigos | `teju_i`, `mbopi` |
| Peligros | Espinas de karaguatá; estalactitas que caen (aviso: polvo) |
| Música | Flauta suave y mbaraka; se oscurece al bajar a la caverna |
| Jefe | Teju Jagua |
| Don | Tajo cargado |

**Recorrido**

- **A. El despertar (≈ 50 tiles).** Kerana despierta en una cueva alta. Mainumby: "¡Kerana! ¡Por fin!". Saltos cortos. Una liana tapa la salida: hay que atacar. Primer teju'i en terreno plano. *Pluma 1:* sobre la entrada de la cueva (salto alto con carrerilla).
- **B. La ladera (≈ 70 tiles).** Rocas y un escalón alto que enseña el salto variable. Mbopi salen de las grietas. **Luz de Arasy** justo antes de un pasillo con cuatro teju'i: el jugador descubre que con la luz los purifica al tocarlos. *Pluma 2:* detrás de una roca agrietada (requiere el tajo cargado → volver después).
- **Checkpoint 1.**
- **C. El descenso (≈ 60 tiles, vertical).** Bajada por grietas hacia el corazón del cerro. Estalactitas con aviso; karaguatá en los bordes. *Pluma 3:* en una cornisa alta (requiere salto doble → volver después).
- **Checkpoint 2 (antesala).** Una planta de guavirá. Mainumby: "Algo grande respira ahí abajo…".
- **Arena: la caverna del tesoro.** Suelo plano, dos repisas laterales, cristales y oro al fondo. El cuerpo enorme de Teju Jagua es una silueta en la penumbra del fondo; solo las cabezas, sobre sus cuellos, salen a la luz.

**Jefe: Teju Jagua**. 7 cabezas × 2 golpes (14 golpes).

- Presentación: siete pares de ojos de fuego se encienden uno a uno en la oscuridad. Barra: "Teju Jagua · Guardián de las cavernas y los frutos".
- El cuerpo no se mueve: en el mito, sus propias cabezas lo condenan a la inacción. Pelean las cabezas, cada una de un color del arcoíris, como cuentan algunas versiones.
- Cada cabeza vencida no muere: **se duerme** (cierra los ojos y se retira a la sombra).

| Fase | Cuándo | Ataque | Aviso | Ventana |
|---|---|---|---|---|
| 1 | Hasta dormir 3 cabezas | **Mordida:** una cabeza se lanza en horizontal, a ras del suelo o a la altura de una repisa | Los ojos brillan y gruñe (0,8 s) | La cabeza queda clavada 1,5 s |
| 1 | | **Coletazo:** una onda recorre el suelo | La cola se levanta al fondo (0,7 s) | — (hay que saltar) |
| 2 | Hasta dormir 6 cabezas | **Aliento de fuego:** dos cabezas a la vez, en arco corto; cubre un tercio de la arena | Humo en los hocicos (1 s) | 1 s después del fuego |
| 2 | | **Estalactitas:** caen 3 o 4 después de cada coletazo | Polvo y sombra en el suelo (0,8 s) | — |
| 3 | Última cabeza | Mordidas rápidas alternadas con fuego | 0,5 s | 1 s |

**Liberación**

> **Teju Jagua:** …¿Che sy? ¿Sos vos?
>
> **Kerana:** Soy yo, che memby. Ya no tenés que cuidar esta oscuridad.
>
> **Teju Jagua:** Mis hermanos… Tau los tiene. Mbói Tu'i grita en los esteros del sur.

**Don: tajo cargado.** Mainumby: "¡Mantené el ataque y soltalo! Así se rompen las rocas agrietadas."

### 6.2 Nivel 2: Ñeembucú · *Ypa: las lagunas del estero*

| | |
|---|---|
| Lugar | Esteros y humedales de Ñeembucú |
| Hora | Atardecer naranja que se vuelve noche |
| Tamaño | ≈ 280 × 24 tiles |
| Idea nueva | El agua: camalotes que se hunden, agua baja que frena y agua profunda que te devuelve a la orilla |
| Enemigos | `jakare`, `nakurutu`, `mboi` |
| Peligros | Agua profunda; karaguatá |
| Música | Percusión de agua, ranas y flauta grave |
| Jefe | Mbói Tu'i |
| Don | Corazón del estero (+1 corazón; 5 en total) |

**Recorrido**

- **A. La orilla (≈ 60 tiles).** Primeros camalotes: se hunden 1,2 s después de pisarlos y reaparecen a los 3 s. El agua baja frena la carrera. *Pluma 1:* al final de una cadena de camalotes.
- **B. Los juncales (≈ 80 tiles).** El jakare acecha bajo el agua (burbujas) y emerge. Juncos como plataformas de un solo sentido. *Pluma 2:* junto a la guarida de un jakare (riesgo).
- **Checkpoint 1.**
- **C. Cae la noche (≈ 80 tiles).** Ñakurutu en postes que se lanzan en picada. Cadenas de camalotes sobre agua profunda. **Luz de Arasy** antes de la cadena más larga. *Pluma 3:* al otro lado de un hueco largo (requiere dash → volver después).
- **Checkpoint 2 (antesala).** Las ranas croan… y de golpe se callan.
- **Arena: la laguna central.** Tres islotes con camalotes entre ellos.

**Jefe: Mbói Tu'i**. 12 golpes (3 fases de 4).

- Presentación: un graznido que sacude la pantalla; la cabeza de loro emerge. Barra: "Mbói Tu'i · Señor de los esteros".

| Fase | Ataque | Aviso | Ventana |
|---|---|---|---|
| 1 | **Picotazo:** emerge en uno de 3 puntos y ataca hacia arriba y adelante | Burbujas en el punto (1 s) | El pico queda clavado en el islote 1,5 s |
| 2 | + **Graznido:** dos anillos sónicos avanzan por el suelo y empujan a Kerana hacia atrás | Abre el pico y se le erizan las plumas (0,8 s) | Al terminar el graznido, 1 s |
| 2 | + **Escupitajo:** 3 bolas de agua en arco | Se le hincha el cuello (0,6 s) | — |
| 3 | Se enrosca en el islote central. Los camalotes aparecen y desaparecen. Caen flores (*yvoty*) que curan: en el mito, ama las flores. Picotazos rápidos y graznido doble | 0,6 s | 1 s |

**Liberación**

> **Mbói Tu'i:** Che sy… Las ranas lloraban por mí.
>
> **Kerana:** Ahora van a cantar otra vez.
>
> **Mbói Tu'i:** Moñái roba en los campos abiertos. Cuidado con sus cuernos.

### 6.3 Nivel 3: Misiones · *Ñu: el campo abierto*

| | |
|---|---|
| Lugar | Campos naturales de Misiones: pastizales, tierra colorada, islas de monte y tacurúes |
| Hora | Mediodía, cielo celeste intenso |
| Tamaño | ≈ 300 × 24 tiles |
| Idea nueva | Viento (ráfagas que empujan) y altura (copas de árboles como plataformas) |
| Enemigos | `nandu`, `karakara`, `teju_i` |
| Peligros | Ráfagas; karaguatá. Los tacurúes son sólidos y algunos están agrietados |
| Música | Guitarra y flauta, abierta y luminosa |
| Jefe | Moñái |
| Don | Salto doble |

**Recorrido**

- **A. El pastizal (≈ 70 tiles).** Ñandúes que corren en línea recta (hay que saltarlos); tacurúes como escalones. *Pluma 1:* en una copa alta (requiere salto doble, que se gana al final de este nivel → volver después).
- **B. Las ráfagas (≈ 80 tiles).** Zonas de viento anunciadas por el pasto y las partículas; karakara en picada; **Luz de Arasy**. *Pluma 2:* dentro de un tacurú agrietado (tajo cargado).
- **Checkpoint 1.**
- **C. Las islas de monte (≈ 80 tiles).** Saltos entre árboles con viento y karakara. *Pluma 3:* al final de un tramo con viento en contra.
- **Checkpoint 2 (antesala).**
- **Arena: la isla de monte.** Tres árboles altos con copas que sirven de plataforma; sus troncos bloquean la hipnosis.

**Jefe: Moñái**. 12 golpes.

- Barra: "Moñái · Señor de los campos abiertos y del aire".

| Fase | Ataque | Aviso | Ventana |
|---|---|---|---|
| 1 | **Descenso:** se esconde en una de las copas y cae en picada sobre Kerana | Sombra en el suelo (1 s) | Aturdido en el suelo 1,5 s |
| 2 | + **Hipnosis:** un pulso en anillo sale de sus cuernos, con alcance de 200 px. Si toca a Kerana, invierte los controles 3 s. Los troncos lo bloquean | Los cuernos brillan iridiscentes con un sonido agudo (1 s) | 1 s después del pulso |
| 3 | + **Robo:** una embestida en diagonal que, si acierta, **se lleva un corazón** (brilla en su cola). Golpear la cola lo recupera. Los descensos son más rápidos | Se enrosca y tiembla (0,7 s) | La cola queda expuesta 1,2 s |

**Liberación**

> **Moñái:** Che sy… Robé tanto. Nada llenaba el vacío.
>
> **Kerana:** El cielo ya es tuyo. No hace falta robarlo.
>
> **Moñái:** Jasy Jatere juega en Capiatá a la hora de la siesta. No le creas cuando llora.

**Don: salto doble.** Mainumby: "¡El aire es de Moñái… y ahora también tuyo! Saltá otra vez en el aire."

### 6.4 Nivel 4: Capiatá · *Táva: la hora de la siesta*

| | |
|---|---|
| Lugar | Capiatá, conocida como "la ciudad de los mitos" y sede del Museo Mitológico Ramón Elías. Pueblo de casas con corredores y tejas, con una plaza y un lapacho (*tajy*) en flor |
| Hora | La siesta, hacia las 13:00: sol vertical, calor que ondula el aire, calles vacías |
| Tamaño | ≈ 260 × 30 tiles |
| Idea nueva | Techos y corredores (verticalidad urbana) y la niebla del sueño |
| Enemigos | `jagua`, `abejas` |
| Peligros | Niebla del sueño; tejas que se sueltan (aviso: crujido y polvo) |
| Música | Arpa paraguaya perezosa y marimba lenta |
| Jefe | Jasy Jatere |
| Don | Paso de la siesta (dash) |

**Recorrido**

- **A. La calle principal (≈ 70 tiles).** Perros embrujados que cargan; subida a corredores y techos. Guiño: un cartel de "Museo" en el fondo. *Pluma 1:* sobre el techo de la iglesia (salto doble).
- **B. Los patios (≈ 70 tiles).** Niebla del sueño (§4.8), panales y enjambres; **Luz de Arasy**. *Pluma 2:* tras un paso estrecho (requiere dash, que se gana al final de este nivel → volver después).
- **Checkpoint 1.**
- **C. Los techos (≈ 70 tiles).** Carrera sobre techos con tejas que caen y enjambres. *Pluma 3:* en un patio interior escondido detrás de la capa `Foreground`.
- **Checkpoint 2 (antesala).** Una abuela duerme la siesta en una silla [Extra: personaje decorativo].
- **Arena: la plaza.** El lapacho al centro (sus ramas son plataformas), bancos y dos techos a los lados.

**Jefe: Jasy Jatere**. 9 golpes, más quitarle el bastón.

- Barra: "Jasy Jatere · Señor de la siesta".
- Es del tamaño de Kerana: el jefe más pequeño y el más escurridizo.
- **Niebla del sueño** en partes de la arena durante toda la pelea.

| Fase | Ataque | Aviso | Ventana |
|---|---|---|---|
| 1 (visible, 3 golpes) | Salta entre techos y suelo; lanza **3 chispas doradas** en abanico con el bastón | Levanta el bastón (0,6 s) | Se ríe y se burla: 1,2 s |
| 2 (invisible, 3 golpes) | Aprieta el bastón y **se vuelve invisible**. Lo delatan su **silbido** (con paneo estéreo), notas musicales, huellas de polvo y un brillo tenue. Llama **enjambres de abejas** y ataca por sorpresa | Destello del bastón (0,4 s); zumbido antes de cada enjambre | Cada golpe lo deja visible 2 s |
| 3 (3 golpes) | Al noveno golpe **el bastón sale volando**. Carrera: si Kerana lo toca primero, Jasy Jatere queda visible e indefenso y la pelea termina. Si él lo recupera (tarda 3 s), vuelve a la fase 2 con 1 golpe más | El bastón gira en el aire | — |

**Liberación**

> **Jasy Jatere:** Che sy… Solo quería que alguien jugara conmigo.
>
> **Kerana:** Vamos a jugar, che memby. Pero sin robarle el sueño a nadie.
>
> **Jasy Jatere:** Kurupi no sale nunca de la selva. Los animales le obedecen.

**Don: Paso de la siesta.** Mainumby: "¡Como Jasy Jatere: por un instante, nada te toca! Usalo para cruzar."

### 6.5 Nivel 5: Canindeyú · *Ka'aguy: la selva profunda*

| | |
|---|---|
| Lugar | Bosque Atlántico de Canindeyú (inspiración: Reserva Natural del Bosque Mbaracayú): árboles gigantes, lianas, niebla y lluvia |
| Hora | Día lluvioso, luz verde filtrada |
| Tamaño | ≈ 280 × 45 tiles (el más vertical) |
| Idea nueva | Subir por la selva: hongos que rebotan y ramas que se quiebran; exige usar el dash |
| Enemigos | `kuati`, `kai`, `mboi` (colgante) |
| Peligros | Ramas que se quiebran; karaguatá; caídas |
| Música | Tambores graves, lluvia, coros de pájaros |
| Jefe | Kurupi |
| Don | Corazón de la selva (+1 corazón; 6 en total) |

**Recorrido**

- **A. El sotobosque (≈ 60 tiles).** Hongos que rebotan; kuati que saltan. *Pluma 1:* sobre una cadena de rebotes.
- **B. La subida (≈ 80 tiles, vertical).** Ramas que se quiebran 0,6 s después de pisarlas (crujido de aviso); mbói que cuelgan; ka'i que lanzan frutas desde las copas; **Luz de Arasy**. *Pluma 2:* en un hueco al que solo se llega con dash.
- **Checkpoint 1.**
- **C. El dosel (≈ 70 tiles).** Saltos largos entre copas con dash y salto doble, bajo la lluvia. *Pluma 3:* detrás de una cortina de lianas (secreto).
- **Checkpoint 2 (antesala).**
- **Arena: el claro.** Dos niveles de ramas y raíces grandes.

**Jefe: Kurupi**. 12 golpes.

- Barra: "Kurupi · Señor de la selva y sus animales".

| Fase | Ataque | Aviso | Ventana |
|---|---|---|---|
| 1 | **Llamado de la selva:** silba y llegan 2 kuati o 1 ka'i por los bordes. **Embestida** corta | Pose de silbido (0,8 s); raspa el suelo antes de embestir (0,6 s) | Después de silbar, 1,2 s |
| 2 | **Huellas al revés** [licencia creativa]: corre en la dirección **contraria** a la que mira y sus huellas apuntan al revés. **Pisotón**: onda de hojas | Se agacha (0,7 s) | Tras el pisotón, 1 s |
| 3 | **Engaño:** se divide en tres. Solo el verdadero deja huellas invertidas. Golpear una copia la deshace en hojas y hace que un ka'i lance frutas. El verdadero recibe los golpes | Las copias parpadean al aparecer | Tras cada embestida, 1 s |

**Alternativa 100 % Colmán** **[Revisar]**: si el autor prefiere no usar los pies al revés, la fase 2 es una **estampida** (una manada de animales cruza la arena y hay que saltarla) y la fase 3 son **lianas** que atrapan a Kerana 1 s si las toca.

**Liberación**

> **Kurupi:** Che sy… La selva era mi única casa.
>
> **Kerana:** Y lo va a seguir siendo. Pero ya no para esconderte.
>
> **Kurupi:** Ao Ao caza en las montañas del Ybytyruzú. Si te persigue, subí a un pindó.

### 6.6 Nivel 6: Guairá · *Ybytyruzú: las montañas*

| | |
|---|---|
| Lugar | Cordillera del Ybytyruzú (Guairá): roca, pastizales de altura y palmeras pindó |
| Hora | Atardecer con tormenta; los relámpagos iluminan la escena |
| Tamaño | ≈ 320 × 30 tiles (incluye la persecución) |
| Idea nueva | La persecución y los refugios (pindó) |
| Enemigos | `taitetu`, `ao_ao_cria`, `karakara` |
| Peligros | Rocas que caen (aviso: sombra); viento de cumbre |
| Música | Tambores rápidos y cuerdas tensas; el aullido "ao, ao" como motivo |
| Jefe | Ao Ao |
| Don | Corazón del cerro (+1 corazón; 7 en total) |

**Recorrido**

- **A. El ascenso (≈ 70 tiles).** Taitetu en manada. *Pluma 1:* en una cornisa sobre la manada.
- **B. Las cumbres (≈ 70 tiles).** Viento, relámpagos y karakara. *Pluma 2:* en una cumbre a la que se llega con viento a favor.
- **Checkpoint 1.**
- **C. La persecución (≈ 90 tiles)** [Núcleo]. La cámara avanza sola; Ao Ao y su manada vienen detrás. Quedarse atrás del borde izquierdo cuesta 1 corazón y devuelve a Kerana al último pindó. **Pindó = refugio:** mientras Kerana está en lo alto de un pindó, la cámara se detiene y la manada da vueltas al pie aullando; en el mito, el pindó tiene un hechizo contra su ferocidad. **Luz de Arasy** antes de la persecución. *Pluma 3:* durante la persecución, en una ruta alternativa arriesgada.
  - *Alternativa si se recorta:* un tramo normal con la manada patrullando.
- **Checkpoint 2 (antesala).**
- **Arena: la meseta.** Dos pindó (uno a cada lado) y dos rocas grandes.

**Jefe: Ao Ao**. 15 golpes.

- Barra: "Ao Ao · Señor de los cerros".
- **En un pindó, Kerana está a salvo:** Ao Ao no puede alcanzarla, da vueltas y aúlla. Para ganar hay que bajar a pelear.

| Fase | Ataque | Aviso | Ventana |
|---|---|---|---|
| 1 | **Embestida en cuatro patas** de lado a lado. Si choca contra una roca, queda aturdido | Rasca el suelo y resopla (0,8 s) | Aturdido 2 s |
| 2 | Se para en dos patas: **zarpazo** amplio. **Aullido** "¡ao, ao!" que llama a 2 crías | Se yergue (0,7 s); aúlla con la cabeza en alto (1 s) | 1 s después del zarpazo |
| 3 | **Furia:** embestidas dobles; rocas que caen del cerro; las crías llegan de a 3 | Sombras en el suelo (0,8 s) | Aturdido 1,5 s tras chocar |

**Liberación**

> **Ao Ao:** Che sy… Siempre tuve hambre.
>
> **Kerana:** Ya no, che memby. Descansá.
>
> **Ao Ao:** El último, Luisón… te espera donde duermen los muertos, en Asunción.

### 6.7 Nivel 7: Asunción · *Pyhare: la noche del camposanto*

| | |
|---|---|
| Lugar | Asunción de noche: calles del centro con faroles y, al final, el Cementerio de la Recoleta (mausoleos, ángeles de piedra, cruces de hierro) |
| Hora | Medianoche, luna llena entre nubes, niebla |
| Tamaño | ≈ 280 × 30 tiles |
| Idea nueva | Luz y oscuridad: Kerana lleva un halo de luz, los faroles lo amplían y los póra solo son vulnerables iluminados |
| Enemigos | `pora`, `jagua_hu`, `mbopi` |
| Peligros | Oscuridad total en algunos tramos; rejas con puntas |
| Música | Campanas lejanas, violín y arpa en tono menor |
| Jefe | Luisón |
| Don | — (final) |

**Recorrido**

- **A. Las calles (≈ 70 tiles).** Faroles que se encienden al tocarlos (hacen de checkpoint y de luz); mbopi. *Pluma 1:* sobre un balcón.
- **B. La entrada al camposanto (≈ 70 tiles).** Póra que atraviesan paredes; rejas. *Pluma 2:* en un rincón que solo se ve al encender un farol.
- **Checkpoint 1.**
- **C. El laberinto de mausoleos (≈ 80 tiles).** Oscuridad; techos de mausoleos; jagua hũ. **Luz de Arasy** en el tramo más oscuro. *Pluma 3:* en lo alto de un mausoleo.
- **Checkpoint 2 (antesala).** Un farol y un guavirá.
- **Arena: la plaza central del cementerio.** Mausoleos a los lados (sus techos son plataformas) y lápidas.
- **Tono:** respetuoso. Luisón es quien perturba la paz; al liberarlo, las velas del cementerio se encienden solas.

**Jefe: Luisón**. 18 golpes.

- Barra: "Luisón · Señor de la noche y los camposantos".

| Fase | Ataque | Aviso | Ventana |
|---|---|---|---|
| 1 (entre las tumbas) | Salta entre los techos de los mausoleos y lanza **terrones** de tierra en arco. **Aúlla sobre una lápida** y llama a 2 póra | Gira el brazo (0,6 s); trepa a la lápida (1 s) | Mientras aúlla, 1,5 s |
| 2 (luna llena) | La luna sale entre las nubes: Luisón crece y gana velocidad. Su aullido **apaga las luces**: solo quedan el halo de Kerana y los faroles que ella vuelva a encender. **Embiste desde la oscuridad** | Dos ojos brillantes y un gruñido (1 s) | Tras la embestida, 1,2 s |
| 3 (la marca de Tau) | La sombra de Tau aparece detrás de Luisón y lo mueve como a un títere. Ataques encadenados: embestida, terrones y póra | 0,6 s | 1 s |

**Liberación**

> **Luisón:** Che sy… Nací último. Y nací en la oscuridad.
>
> **Kerana:** Y en la oscuridad te encontré. Vení, che memby. Tus hermanos te esperan arriba.

Después, la risa de Tau se aleja y empieza el final (§2.6).

### 6.8 Final
Las siete estrellas se reúnen en el cielo y forman Eichu. Se muestran las diapositivas de §2.6. Si hay arte, se ve a Kerana sentada junto a un manantial bajo las Pléyades. Luego, créditos.

---

## 7. Jefe secreto: Tau [Extra]

- **Requisito:** las 21 plumas.
- **Arena:** Yvága, el cielo. Las plataformas son las siete estrellas.
- **Fase 1, el joven de la flauta:** Tau con su disfraz del mito. Sus notas hipnotizan (reutiliza la hipnosis de Moñái) y lanzan proyectiles.
- **Fase 2, los ecos:** Tau invoca sombras de los siete hijos, que repiten un ataque cada una (**reutiliza código de los jefes**).
- **Fase 3, las siete estrellas:** Tau muestra su forma real, una sombra de humo con ojos rojos. Cada estrella-hijo ilumina una plataforma y ayuda a Kerana.
- **Cierre:** como en el mito, cuando el sabio Tume Arandu lo dejó hechizado, Tau queda sellado. Final verdadero: Kerana y Mainumby ven amanecer con Eichu en el cielo, *Ary Pyahu*, el año nuevo.

---

## 8. Pantallas e interfaz

### 8.1 Flujo

```
Boot → Preload → Título ─┬─ Nueva partida → Prólogo → Mapa
                         ├─ Continuar ─────────────→ Mapa
                         ├─ Opciones
                         └─ Créditos
Mapa → Nivel N → (jefe) → Liberación → Nivel completado → Mapa
Nivel 7 completado → Final → Créditos → Título
```

### 8.2 Título [MVP]

- Cielo nocturno con 7 estrellas tenues (anticipan el final), el logo "KERANA" y el subtítulo.
- "Pulsá Enter" o "Tocá para empezar".
- Menú: Nueva partida · Continuar (si hay partida guardada) · Opciones · Créditos.

### 8.3 Prólogo y final [MVP]
Una escena genérica de diapositivas (`StoryScene`) que recibe una lista de diapositivas (imagen opcional y texto). Texto letra por letra; avanzar con Saltar o Atacar; saltar todo manteniendo Pausa.

### 8.4 Mapa [MVP]

- Ilustración estilizada de la Región Oriental del Paraguay (la hace el autor; hasta entonces, fondo liso con nodos).
- 7 nodos unidos por un camino punteado. Estados: bloqueado, disponible y completado (con estrella).
- El cielo sobre el mapa se llena de estrellas a medida que avanzan los niveles, hasta formar Eichu.
- Panel del nodo: nombre del lugar, subtítulo, plumas (0/3) y mejor tiempo [Extra].
- Posición aproximada de los nodos para ubicarlos en el mapa:

| Nivel | Lugar | Latitud | Longitud |
|---|---|---|---|
| 1 | Paraguarí | −25,62 | −57,15 |
| 2 | Ñeembucú (Pilar) | −26,86 | −58,30 |
| 3 | Misiones (San Juan Bautista) | −26,67 | −57,14 |
| 4 | Capiatá | −25,35 | −57,45 |
| 5 | Canindeyú (Mbaracayú) | −24,13 | −55,52 |
| 6 | Guairá (Ybytyruzú) | −25,85 | −56,25 |
| 7 | Asunción | −25,28 | −57,63 |

(Coordenadas aproximadas, solo para ubicar los nodos.)

### 8.5 HUD [MVP]

- Arriba a la izquierda: corazones (llenos y vacíos).
- Arriba a la derecha: plumas del nivel (0/3). Con la Luz de Arasy activa, su icono y una barra de tiempo.
- En peleas de jefe, abajo al centro: barra de vida con nombre y epíteto.
- Los dones aparecen como iconos pequeños junto a los corazones [Núcleo].

### 8.6 Pausa y opciones [MVP / Núcleo]

- **Pausa:** Continuar · Reiniciar desde el fuego · Opciones · Salir al mapa.
- **Opciones:** volumen de música · volumen de efectos · idioma · modo asistido · sacudida de cámara (sí/no) · destellos (sí/no) · velocidad del texto · borrar partida (con confirmación).

### 8.7 Diálogos [MVP]

- Caja inferior con retrato a la izquierda (96 × 96), nombre y texto letra por letra.
- Avanza con Saltar, Atacar o tocando la pantalla. El juego se pausa durante los diálogos de liberación, pero no durante las burbujas de Mainumby.

### 8.8 Nivel completado [MVP]

- "¡Nivel completado!", el hijo liberado, el don obtenido, las plumas (x/3) y el tiempo [Extra]. Luego vuelve al mapa.

### 8.9 Créditos [MVP]

- Idea y dirección, desarrollo (con Claude Code), arte y sonido (con sus fuentes y licencias según `CREDITS.md`), agradecimientos y fuentes culturales (§14).

---

## 9. Arte

### 9.1 Dirección de arte

- **Estilo:** pixel art de 16 bits con alma de leyenda ilustrada. Cálido, misterioso y nunca grotesco.
- **Contraste jugable:** los personajes y los peligros se leen siempre sobre el fondo. Los fondos van más apagados y con menos contraste que la capa jugable.
- **La marca de Tau:** motivo visual común a todos los marcados, una espiral violeta oscura (#3B1F4A) con destellos rojos.
- **La luz buena:** oro cálido (Angatupyry y el sable) y plata (Arasy).

### 9.2 Resolución, escala y tamaños

- **Resolución interna:** 640 × 360, escalada con nitidez (`pixelArt: true`). Se ve perfecta a 1280 × 720 (×2) y a 1920 × 1080 (×3).
- **Tiles:** 16 × 16.
- **Escala única:** 1 píxel del arte = 1 píxel del juego. Nada se escala dentro del juego salvo efectos.

| Elemento | Tamaño de frame | Tamaño visible aprox. |
|---|---|---|
| Kerana | 64 × 64 | ≈ 44 a 48 px de alto |
| Mainumby | 24 × 24 | ≈ 12 px |
| Enemigos pequeños (teju'i, mbopi) | 32 × 32 | |
| Enemigos medianos (mbói, ñakurutu, karakara, kuati, ka'i, crías, póra) | 48 × 48 | |
| Enemigos grandes (jakare, ñandu, jagua, taitetu, jagua hũ) | 64 × 64 (jakare 64 × 32) | |
| Teju Jagua: cabeza con cuello | 96 × 64 | El cuerpo es una silueta de fondo |
| Mbói Tu'i: cabeza con cuello | 128 × 160 | El resto del cuerpo, bajo el agua |
| Moñái | 192 × 96 | |
| Jasy Jatere | 64 × 64 | Del tamaño de Kerana |
| Kurupi | 96 × 96 | |
| Ao Ao | 160 × 128 | |
| Luisón | 128 × 128 (más grande en la fase 2) | |
| Retratos de diálogo | 96 × 96 | |
| Iconos del HUD | 12 × 12 o 16 × 16 | |

### 9.3 Paleta
Colores de referencia para la interfaz y para guiar la generación de arte:

| Uso | Color | Hex |
|---|---|---|
| Fondo de interfaz ("noche guaraní") | Azul noche | #1B1A2E |
| Luz de Angatupyry, interfaz activa | Oro | #F2C14E |
| Luz de Arasy (inmunidad) | Plata azulada | #CFE3F2 |
| Urucú (Kerana, acentos) | Rojo | #B8322A |
| Ocre (Kerana, tierra) | Ocre | #C98B2B |
| Tipoi (Kerana) | Beige crema | #E8D8BE |
| Guarda del tipoi y vincha | Café | #8B5A3C |
| Monte | Verde oscuro | #2F5D3A |
| Tierra colorada (N3) | Rojo tierra | #A8472C |
| Cielo (N3) | Celeste | #7FB7E0 |
| Marca de Tau | Violeta oscuro | #3B1F4A |

**Paleta por nivel**

1. **Paraguarí, amanecer:** rosados y violetas en el cielo, verdes oscuros, rocas gris azulado; oro y cristales en la caverna.
2. **Ñeembucú, atardecer a noche:** naranjas, verdes agua, barro marrón y flores lila de camalote.
3. **Misiones, mediodía:** amarillo pasto, tierra colorada, celeste intenso y verde de monte.
4. **Capiatá, siesta:** blancos de cal, tejas rojizas, sombras violetas y luz dura amarilla; lapacho rosado.
5. **Canindeyú, lluvia:** verdes profundos, niebla gris verdosa y destellos de luz filtrada.
6. **Guairá, tormenta:** marrones, verdes grisáceos, cielo plomizo y relámpagos blancos.
7. **Asunción, medianoche:** azules profundos, mármol blanco, verde espectral de los póra y la luz cálida de Kerana.

### 9.4 Animación

- De 6 a 12 fotogramas por segundo según la acción: correr ≈ 12 fps; idle ≈ 6 a 8 fps.
- Los pies en la **misma línea base** en todos los frames (evita el temblor).
- Kerana mira a la derecha en el arte; el juego la voltea. Los enemigos y jefes miran a la izquierda.
- Efectos como el brillo de la carga, la estela del dash, el parpadeo y el tinte se hacen **por código**, no con más frames.

### 9.5 Fondos (parallax)

- Tres capas por nivel [Núcleo; en MVP basta una]:
  - **Lejana** (cielo y horizonte): factor 0,1.
  - **Media** (cerros, árboles o edificios): factor 0,35.
  - **Cercana** (siluetas): factor 0,7.
- Alto de 360 px y ancho suficiente para el recorrido (≈ 1280 a 1920 px); si no alcanza, se repite en espejo.
- Las capas media y cercana necesitan fondo transparente (o magenta #FF00FF para recortar).

### 9.6 Tilesets

- Tiles de 16 × 16. Un tileset por bioma: **cerro/cueva, estero, campo, pueblo, selva, montaña y ciudad/cementerio**.
- Contenido mínimo por bioma: suelo (bordes y relleno), plataforma de un solo sentido (izquierda, centro, derecha), peligro (espinas o karaguatá), agua (superficie y fondo) donde haga falta, variante agrietada (rompible) y decoración (pasto, flores, piedras).
- Hasta que haya arte, un **tileset gris generado por código** con un color por bioma.
- Detalles de formato, autotile y fuentes posibles en `docs/ASSETS.md`.

### 9.7 Efectos visuales (VFX)

- **Purificación:** humo violeta que se deshace en chispas doradas.
- **Luz de Arasy:** filtro Glow plateado, partículas pequeñas y parpadeo al final.
- **Tajo:** estela curva amarilla de 2 a 3 frames (sprite o gráfico).
- **Carga:** partículas que convergen hacia el sable.
- **Dash:** estela de 3 imágenes semitransparentes de Kerana.
- **Polvo** al aterrizar y al frenar; **salpicaduras** en el agua.
- **Destello blanco** al recibir un golpe (tinte).
- **Liberación:** anillo de luz, cámara lenta y partículas ascendentes.
- **Ambiente:** lluvia (N5), niebla (N4 y N7), relámpagos (N6), luciérnagas (N2).

### 9.8 Tipografía

- Una fuente pixel para títulos y la interfaz, y otra legible para los diálogos si hace falta.
- **Requisito obligatorio:** debe mostrar ñ, á é í ó ú, ã ẽ ĩ õ ũ ỹ y el puso ('). Frase de prueba: *"Mbói Tu'i, Yvy Marane'ỹ, ñe'ẽ, Ñeembucú, Paraguarí"*. Ojo: la ẽ requiere soporte de caracteres vietnamitas en muchas fuentes.
- Fuentes con licencia OFL, guardadas en el repo (`public/assets/fonts/`), sin dependencia de CDN.

---

## 10. Audio

### 10.1 Dirección musical

- **Naturaleza (N1, N2, N3, N5, N6):** instrumentos de raíz guaraní: mbaraka (maraca), takuapu (bastón de ritmo), flautas y tambores.
- **Pueblo y ciudad (N4, N7):** arpa paraguaya y guitarra, más melancólicas de noche.
- **Jefes:** una base común más intensa, con una variación por jefe si el presupuesto lo permite.
- Alternativa económica: chiptune con timbres de flauta y percusión.

### 10.2 Música

| Pantalla | Pista | Prioridad |
|---|---|---|
| Título y mapa | "Canto de Eichu" (tranquila, nocturna) | MVP |
| Niveles | Una pista genérica de aventura | MVP |
| Niveles | Una pista por nivel (7) | Núcleo |
| Jefes | Una pista de jefe común | MVP |
| Liberación | Remate corto ascendente (5 a 8 s) | Núcleo |
| Final y créditos | Tema de Kerana | Núcleo |

Formato: **MP3** (compatible con todos los navegadores). Volúmenes parejos entre pistas. Ver licencias en `docs/ASSETS.md`.

### 10.3 Efectos de sonido
Primero se generan **por código con ZzFX** (sin archivos); más adelante se pueden reemplazar por grabaciones.

Lista: salto · salto doble · aterrizaje · tajo · carga (bucle) · tajo cargado · golpe a enemigo · purificación · daño a Kerana · curación · Luz de Arasy (inicio y fin) · pluma · fuego que se enciende · dash · interfaz (mover, aceptar, volver) · aviso genérico de jefe · jefe herido · liberación (arpegio ascendente) · graznido de Mbói Tu'i · silbido de Jasy Jatere · zumbido de abejas · aullido "ao, ao" · aullido de Luisón · viento · salpicadura · roca que se rompe · rama que cruje.

### 10.4 Implementación

- `AudioManager` único: música con fundido entre pistas y efectos centralizados por clave (`sfx.play('jump')`).
- Respeta los volúmenes de Opciones y se pausa al perder el foco de la ventana.
- En móvil, el audio arranca tras el primer toque (regla de los navegadores).

---

## 11. Especificación técnica

### 11.1 Stack

- **Phaser 4** (4.2 o superior) con Arcade Physics.
- **Vite** como servidor de desarrollo y empaquetador; **TypeScript** en modo estricto.
- **Vitest** para pruebas de lógica.
- **ZzFX** para efectos de sonido generados.
- Node 22 en la nube (preinstalado) y Node LTS en la PC del autor.
- Dependencias de herramientas: una librería de imágenes para el pipeline de sprites (por ejemplo `sharp` o `pngjs`); debe funcionar en la nube y en Windows sin compilar nada.
- **Fijarse en Phaser 4, no en Phaser 3:** ver `CLAUDE.md`.

### 11.2 Estructura del repositorio

```
/
├── CLAUDE.md                 Instrucciones para Claude Code
├── README.md
├── CREDITS.md                Assets de terceros y sus licencias
├── docs/
│   ├── GDD.md                Este documento
│   ├── PLAN.md               Plan de sesiones y presupuesto
│   ├── ASSETS.md             Especificación de assets
│   └── setup/deploy.yml      Workflow de GitHub Pages (el autor lo copia a mano)
├── index.html
├── package.json · package-lock.json · tsconfig.json · vite.config.ts
├── public/assets/
│   ├── sprites/              Sprites procesados (sheet PNG + JSON)
│   ├── tiles/                Tilesets
│   ├── maps/                 Mapas en formato Tiled JSON
│   ├── backgrounds/          Capas de parallax por nivel
│   ├── portraits/            Retratos de diálogo
│   ├── ui/                   Iconos, logo, mapa del mundo
│   ├── fonts/
│   └── audio/music/
├── raw/                      Originales sin procesar (exportaciones de Grok, etc.)
├── tools/
│   ├── sprites.mjs           Pipeline raw → public/assets/sprites
│   ├── build-maps.mjs        Mapas ASCII → Tiled JSON
│   ├── make-placeholder-tiles.mjs
│   └── levels/               Fuentes ASCII de los niveles (test.txt, l1.txt…)
├── src/
│   ├── main.ts
│   ├── config/gameplay.ts    Todos los parámetros de sensación
│   ├── data/                 levels.ts, enemies.ts, bosses.ts, dialogues.ts, story.ts
│   ├── i18n/                 es.ts, en.ts, index.ts
│   ├── assets/manifest.ts    Lista única de assets (clave, ruta, frames)
│   ├── scenes/               Boot, Preload, Title, Story, WorldMap, Level, UI, Pause, Credits
│   ├── entities/             Player, enemies/, bosses/, pickups/, hazards/
│   ├── systems/              Save, Audio, Input, Dialogue, Camera, StatusEffects, EventBus
│   └── utils/
└── tests/
```

### 11.3 Configuración de Phaser (guía)
Verificar cada nombre contra los tipos de Phaser 4 antes de usarlo.

```ts
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,                 // WebGL con respaldo Canvas
  parent: 'game',
  width: 640,
  height: 360,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#1B1A2E',
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GAMEPLAY.gravity }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true },
  scene: [/* Boot, Preload, Title, Story, WorldMap, Level, UI, Pause, Credits */],
};
```

### 11.4 Escenas
| Escena | Responsabilidad |
|---|---|
| `BootScene` | Carga lo mínimo para la barra de carga; lee la partida guardada y los parámetros de URL |
| `PreloadScene` | Carga todo según `manifest.ts`; genera **placeholders** para lo que falte (§11.8); crea las animaciones globales |
| `TitleScene` | Logo y menú |
| `StoryScene` | Diapositivas genéricas (prólogo, final) |
| `WorldMapScene` | Mapa, nodos y selección de nivel |
| `LevelScene` | Nivel genérico: recibe `levelId`, carga el mapa, crea entidades y maneja checkpoints, peligros, arena y liberación |
| `UIScene` | HUD en paralelo al nivel; escucha eventos por `EventBus` |
| `PauseScene` | Menú de pausa superpuesto |
| `CreditsScene` | Créditos con desplazamiento |

### 11.5 Entidades y sistemas

- **Player** (`Phaser.Physics.Arcade.Sprite`): máquina de estados (§3.5), lee acciones de `InputManager` (nunca teclas directas) y emite eventos (`player:hurt`, `player:heal`, `player:gift`…).
- **Enemy** (base): `kind`, `hp` y un comportamiento de arquetipo (§5.2) por composición. Al llegar a 0, purificación.
- **Boss** (base): fases por umbral de vida, cola de ataques con pesos, `telegraph()` y `vulnerable()` con tiempos, eventos de cambio de fase y `onDefeated` → `LiberationSequence` común. Un archivo por jefe en `src/entities/bosses/`.
- **Pickups, peligros, checkpoints y carteles** creados por una fábrica a partir de los objetos del mapa.
- **Sistemas:**
  - `SaveManager` (localStorage)
  - `AudioManager`
  - `InputManager` (teclado, mando y táctil → acciones)
  - `DialogueBox`
  - `CameraController` (seguimiento, anticipación, sacudida, bloqueo de arena)
  - `StatusEffects` (hipnosis, sueño, inmunidad)
  - `EventBus` (comunicación entre escenas)
- **Pools** para proyectiles y partículas.

### 11.6 Datos (esquemas guía)

```ts
type LevelId = 'test' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7';
type BossId = 'teju_jagua' | 'mboi_tui' | 'monai' | 'jasy_jatere' | 'kurupi' | 'ao_ao' | 'luison' | 'tau';
type GiftId = 'charged_slash' | 'double_jump' | 'dash' | 'heart_up';

interface LevelDef {
  id: LevelId; order: number;
  nameKey: string; subtitleKey: string;        // claves de i18n
  mapKey: string; mapSource: 'ascii' | 'tiled'; // ver §11.7
  biome: 'cerro' | 'estero' | 'campo' | 'pueblo' | 'selva' | 'montana' | 'ciudad';
  backgrounds: { key: string; factor: number }[];
  musicKey: string;
  boss: BossId; gift: GiftId | null;
  mapNode: { x: number; y: number };           // posición en el mapa del mundo
}

interface AttackDef { id: string; weight: number; telegraphMs: number; activeMs: number; recoverMs: number; }
interface BossDef {
  id: BossId; nameKey: string; epithetKey: string; hp: number;
  phases: { untilHpRatio: number; attacks: AttackDef[] }[];
}
```

### 11.7 Mapas: fuente ASCII y Tiled
Para ahorrar presupuesto, **Claude no escribe JSON de Tiled a mano**: escribe cada nivel como texto ASCII compacto y un script lo convierte al formato de Tiled. El autor puede abrir el JSON en Tiled para pulirlo y decorarlo.

**11.7.1 Formato ASCII** (`tools/levels/<id>.txt`)

```
# l1.txt: Paraguarí
size 240x34
biome cerro
enemy t=teju_i b=mbopi
sign 1=hint.l1.move 2=hint.l1.jump 3=hint.l1.attack
rect BossArena x=200 y=11 w=40 h=23 boss=teju_jagua
point FallingHazard x=150 y=5 delayMs=800
---
(grilla de caracteres: una fila por fila de tiles)
```

| Carácter | Significado |
|---|---|
| `.` | Vacío |
| `#` | Suelo sólido (capa `Ground`) |
| `=` | Plataforma de un solo sentido (capa `Platforms`) |
| `^` | Peligro: espinas o karaguatá (capa `Hazards`) |
| `~` | Agua profunda (capa `Water`) |
| `B` | Roca agrietada (objeto `Breakable`, 1 tile) |
| `P` | Inicio de Kerana (`PlayerSpawn`) |
| `C` | Fuego o checkpoint (`Checkpoint`) |
| `G` | Guavirá |
| `L` | Luz de Arasy |
| `F` | Pluma (índice según el orden de aparición: 0, 1, 2) |
| `1`–`9` | Cartel (`Sign`) según la línea `sign` |
| `a`–`z` | Enemigos según la línea `enemy` |

Los objetos rectangulares (zonas de viento, niebla, oscuridad, arena, pindó, camalotes…) se declaran con `rect` en la cabecera, y los puntuales sin carácter propio (estalactitas, faroles…) con `point`; ambos en unidades de tile. El script `npm run maps` genera `public/assets/maps/<id>.json`.

**Regla:** cuando el autor edita un mapa en Tiled, ese JSON pasa a ser la fuente (`mapSource: 'tiled'` en `levels.ts`) y ya no se regenera desde el ASCII.

**11.7.2 Convenciones de Tiled**

- Mapa ortogonal, tiles de 16 × 16, formato JSON, capas en **CSV**, **tilesets incrustados** ("Embed tilesets"): Phaser no lee tilesets externos.
- La ruta de la imagen del tileset dentro del JSON debe ser relativa y válida (por ejemplo `../tiles/cerro.png`) para que Tiled la abra. Phaser carga la imagen por clave.
- **Capas de tiles** (nombres exactos): `Background` (decoración detrás, sin colisión), `Ground` (sólido), `Platforms` (un solo sentido: colisiona solo desde arriba), `Hazards` (daño al tocar), `Water` (agua profunda: daño y reaparición), `Foreground` (decoración delante de Kerana, sin colisión).
- **Capa de objetos** `Objects`. La clase del objeto se lee de `type` o de `class` (Tiled cambió el nombre del campo entre versiones; leer ambos).

| Clase | Forma | Propiedades |
|---|---|---|
| `PlayerSpawn` | Punto | — |
| `Checkpoint` | Punto | `id` |
| `Enemy` | Punto | `kind`, `facing` (left/right), `patrol` (px) |
| `Pickup` | Punto | `kind` (guavira, luz_arasy, pluma), `index` (plumas: 0 a 2) |
| `Breakable` | Rectángulo | — |
| `Crumble` | Rectángulo | `delayMs` (rama que se quiebra) |
| `Sinking` | Rectángulo | `sinkMs`, `respawnMs` (camalote) |
| `Bouncer` | Rectángulo | `force` (hongo) |
| `WindZone` | Rectángulo | `forceX`, `periodMs` |
| `SleepFog` | Rectángulo | — |
| `DarkZone` | Rectángulo | — |
| `Lantern` | Punto | `id` (farol: checkpoint y luz) |
| `FallingHazard` | Punto | `delayMs` (estalactita, teja, roca) |
| `Sign` | Punto | `textKey` |
| `BossArena` | Rectángulo | `boss` |
| `LevelExit` | Rectángulo | — |
| `ChaseZone` | Rectángulo | `speed` (persecución de N6) |
| `Pindo` | Rectángulo | — (refugio de N6) |

- **Autotile:** si el tileset del bioma sigue el orden de 16 variantes descrito en `docs/ASSETS.md`, el script elige bordes y esquinas automáticamente; si no, usa un solo tile y el autor decora en Tiled.

### 11.8 Carga de assets y placeholders [MVP]

- `src/assets/manifest.ts` es la **lista única** de assets: clave, ruta, tipo y tamaño de frame.
- Si un asset no carga (evento `loaderror`), `PreloadScene` genera una textura de reemplazo (rectángulo de color con la clave escrita) y registra `[ASSET FALTANTE] <clave>` en la consola. **El juego nunca se rompe por un asset ausente.**
- Los sprites procesados vienen como sheet PNG + JSON (formato de atlas o de spritesheet, según el pipeline).

### 11.9 Guardado [MVP]

- `localStorage`, clave `kerana.save.v1`. Siempre dentro de try/catch: si falla, el juego sigue sin guardar.
```ts
interface SaveData {
  version: 1;
  unlockedLevel: number;                   // 1 a 7
  freed: BossId[];                          // jefes liberados
  gifts: GiftId[];
  maxHearts: number;                        // 4 a 7
  feathers: Record<string, boolean[]>;      // por nivel, 3 plumas
  bestTimes: Record<string, number>;        // [Extra]
  settings: { music: number; sfx: number; lang: 'es' | 'en'; assist: boolean;
              shake: boolean; flashes: boolean; textSpeed: 1 | 2 | 3 };
}
```

- Con migración por versión: si cambia el formato, se sube `version` y se migra.

### 11.10 Textos e idiomas [MVP: infraestructura y español]

- Ningún texto visible escrito directamente en el código de las escenas: todo pasa por `t('clave', variables)`.
- `src/i18n/es.ts` completo; `en.ts` [Extra].
- Si falta una clave, se muestra `⟦clave⟧` y se avisa en consola (solo en desarrollo).
- Los textos de ayuda usan variables para las teclas: `t('hint.jump', { key: input.label('jump') })`.

### 11.11 Depuración [MVP]
Parámetros de URL (activos en `npm run dev` o con `?debug=1`):

| Parámetro | Efecto |
|---|---|
| `debug=1` | Hitboxes, FPS y estado de la máquina de Kerana |
| `level=test` o `level=1..7` | Empieza directo en ese nivel |
| `boss=1` | Empieza en la antesala del jefe del nivel |
| `gifts=all` | Todos los dones |
| `god=1` | Kerana no recibe daño |

Ejemplo: `http://localhost:5173/?level=3&boss=1&gifts=all`

Además, el juego define `window.__KERANA_READY__ = true` cuando la primera escena jugable está lista (lo usa la prueba de humo).

### 11.12 Pruebas

- **Vitest** (lógica pura, sin navegador): máquina de estados de Kerana; coyote time y buffer; daño, curación e inmunidad; umbrales de fase de los jefes; `SaveManager` (guardar, cargar y migrar); que todas las claves de `es` existan en `en` (si existe); parser de mapas ASCII.
- **Build:** `npm run build` = `tsc --noEmit` + `vite build`. Debe pasar siempre.
- **Prueba de humo** (si hay Chrome o Chromium headless disponible): `npm run smoke` abre el build, espera `__KERANA_READY__` y falla si hay errores en consola. Opcional: capturas de pantalla para revisión.

### 11.13 Rendimiento

- Objetivo: 60 fps en PC y en móviles de gama media.
- Atlas por personaje; pools; nada de asignar objetos en cada frame; partículas limitadas.
- Tamaño total del juego: idealmente menos de 25 MB. PNG optimizados; música en MP3 de 128 kbps.

### 11.14 Despliegue

- **GitHub Pages con GitHub Actions.** El workflow está en `docs/setup/deploy.yml` y **el autor lo copia a mano** a `.github/workflows/deploy.yml` (ver `docs/PLAN.md`). Claude no toca `.github/workflows/`.
- `vite.config.ts` con `base: './'` para que funcione en `https://<usuario>.github.io/<repo>/`.
- Cada fusión a `main` publica automáticamente en uno o dos minutos.
- **Futuro** [Extra]: itch.io (zip HTML5), Steam (empaquetado con Electron o Tauri) y móvil (Capacitor).

---

## 12. Alcance y prioridades

### 12.1 Qué entra en cada nivel de prioridad

| Área | MVP | Núcleo | Extra |
|---|---|---|---|
| Niveles | 7 niveles jugables con su jefe | Secciones A, B y C completas con las ideas nuevas | Rutas secretas extra |
| Jefes | 2 fases por jefe como mínimo | 3 fases | Jefe secreto Tau |
| Kerana | Correr, salto variable, sable, daño y reaparición | Dones (tajo cargado, salto doble, dash, corazones) | Pogo |
| Objetos | Guavirá y Luz de Arasy | Plumas | Mejores tiempos |
| Historia | Prólogo, liberaciones y final en texto | Retratos y Mainumby compañero | Ilustraciones de las diapositivas |
| Pantallas | Título, mapa simple, HUD, pausa y créditos | Opciones completas y modo asistido | Mapa ilustrado animado |
| Controles | Teclado | Mando y táctil | Reasignación |
| Arte | Placeholders y luego Kerana real | Todos los sprites, 7 tilesets y parallax | Animaciones extra |
| Audio | Efectos con ZzFX y 3 pistas | 7 pistas de nivel y remate de liberación | Variación por jefe |
| Idiomas | Español | — | Inglés |
| Publicación | GitHub Pages | — | itch.io, Steam, móvil |

### 12.2 Lista de recortes (en orden)
Si el gasto supera la meta (ver el semáforo en `docs/PLAN.md`), se recorta en este orden:

1. Jefe secreto Tau. **[RECORTADO desde S4: semáforo rojo tras S2, ver docs/PLAN.md §6.3]**
2. Traducción al inglés. **[RECORTADO desde S4: idem]**
3. Persecución del Ao Ao (queda solo la arena). **[RECORTADO desde S4: idem]**
4. Tercera fase de los jefes 3 a 6. **[RECORTADO desde S3: semáforo rojo tras S4, ver docs/PLAN.md §6.3]**
5. Controles táctiles. **[RECORTADO desde S3: idem]**
6. Parallax de 3 capas (queda 1). **[RECORTADO desde S3: idem]**
7. Mainumby visible (quedan solo los carteles de texto).
8. Plumas coleccionables.
9. Dones de habilidad (se dan desde el inicio).

**Nunca se recorta:** los 7 niveles con su jefe (mínimo 2 fases), el sable, el salto, la Luz de Arasy, el guardado y la historia en texto.

---

## 13. Glosario
**[Revisar]** la ortografía y el uso con hablantes de guaraní.

| Término | Significado |
|---|---|
| Angatupyry | Espíritu del bien |
| Ao Ao | Sexto hijo; señor de los cerros |
| Arasy | Diosa, madre del cielo, asociada a la luna |
| Arete Guasu | "Fiesta grande"; celebración del nuevo ciclo |
| Ary Pyahu | Año nuevo |
| Che memby | "Mi hijo/a" (dicho por la madre) |
| Che sy | "Mi madre" |
| Eichu | Las Pléyades |
| Guavirá | Fruta nativa del Paraguay |
| Jagua / jagua hũ | Perro / perro negro |
| Jakare | Yacaré |
| Jasy | Luna |
| Jasy Jatere | Cuarto hijo; señor de la siesta |
| Ka'aguy | Monte, selva |
| Ka'i | Mono |
| Karaguatá | Planta espinosa (bromeliácea) |
| Karakara | Carancho, ave rapaz |
| Kerana | "Dormilona"; la protagonista |
| Kuati | Coatí |
| Kurupi | Quinto hijo; señor de la selva |
| Luisón | Séptimo hijo; señor de la noche y los camposantos |
| Mainumby | Colibrí |
| Marangatu | Padre de Kerana |
| Mbaraka | Maraca ritual |
| Mbói | Serpiente |
| Mbói Tu'i | Segundo hijo; señor de los esteros |
| Mbopi | Murciélago |
| Mbyja | Estrella |
| Moñái | Tercer hijo; señor de los campos abiertos y del aire |
| Ñakurutu | Búho |
| Ñandu | Ñandú |
| Ñu | Campo |
| Pindó | Palmera nativa; refugio contra el Ao Ao |
| Pokõi | Siete |
| Póra | Fantasma, aparecido |
| Porâsy | Heroína del mito que se sacrifica para vencer a los siete |
| Pyhare | Noche |
| Pytajovái | Dios de la guerra |
| Rupave, Sypave | Primera pareja humana |
| Taitetu | Pecarí |
| Tajy | Lapacho |
| Takuapu | Bastón de ritmo ceremonial |
| Takuru | Tacurú, montículo de termitas |
| Tata | Fuego |
| Tau | Espíritu del mal |
| Táva | Pueblo |
| Teju / teju'i | Lagarto / lagartija |
| Teju Jagua | Primer hijo; guardián de las cavernas y los frutos |
| Tipoi | Vestido tradicional de algodón |
| Tume Arandu | El sabio, tío de Kerana |
| Tupã | Dios creador |
| Ybyty | Cerro |
| Ykua | Manantial |
| Ypa | Laguna |
| Yvága | Cielo |
| Yvoty | Flor |
| Yvy Marane'ỹ | "Tierra sin mal" |

---

## 14. Fuentes

- Narciso R. Colmán (Rosicrán), *Ñande Ypy Kuéra* ("Nuestros antepasados"), 1929; en Portal Guaraní.
- "Taú y Keraná", Wikipedia en español.
- "La leyenda de los siete monstruos de la mitología guaraní", blog Guarani Reko.
- "El origen de Venus y las Pléyades", Pueblos Originarios (versión en que los siete purificados forman Eichu).
- Blas Servín, "Astronomía guaraní", Portal Guaraní (Eichu y el año nuevo).
- Museo Mitológico Ramón Elías, Capiatá (ABC Color; Visit Paraguay).
- Sobre el Curupí de pies invertidos: *Perfil*, "El mito del Curupí".
- Phaser 4: phaser.io (novedades y guía de migración de v3 a v4).
