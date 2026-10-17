# Pendientes para publicar

El plan completo está en [docs/SESIONES.md](SESIONES.md).
Revisado el 17 de octubre de 2026, contra lo que ya está en `main` (pull requests 82 a 92). Al día con S37.

Primero itch.io, gratis y en navegador. Después Google Play, con el feedback de itch.io. Steam más adelante (S34, 16 de octubre).

## Hecho

- El prólogo se salta y dice por qué se levanta Kerana. Hay figuras. Ella mira a la derecha y Tau queda a su altura.
- Si hay partida, el título ofrece Continuar y Nueva partida.
- Los carteles del nivel 1 enseñan una sola cosa.
- Kerana libera con una frase. Tau se sella, no se libera.
- El sable tiene arco, chispas y sacudida. El tajo cargado se siente distinto. La sacudida se apaga en Opciones.
- La chipa reemplaza a la pluma. El guardado no se borra.
- Al terminar un nivel se ven el hijo, el don y las chipas, con un botón grande de Siguiente.
- El tajo cargado, el salto doble y el dash están desde el primer nivel. El corazón nuevo sigue creciendo.
- El corazón cura. El tereré, la guampa de cuero, da la inmunidad. Lo que cae en la pelea de Mbói Tu'ĩ también es un corazón.
- Los hongos tienen sombrero, manchas y tallo.
- Los botones del celular se mueven y se agrandan. Varios dedos a la vez. El ataque automático está apagado.
- En el nivel 1 el piso es una franja. Hay musgo en la ladera y no hay plantas en la cueva. El cántaro y las piedras se sacaron.
- Las cabezas de Teju Jagua son del mismo marrón que el lomo.
- El diálogo muestra la cara de Kerana, dentro del cuadro.
- Al reaparecer, la cámara llega con ella.
- El detalle del escenario de los niveles 1 a 5 está hecho. No choca y no cambia el salto. La canoa se sacó: no se entendía. La tabla está en [docs/SESIONES.md](SESIONES.md).
- El piso se redibujó, solo el dibujo. Pasto con hojas de alto distinto donde hay tierra, piedra en la cueva, revoque en el pueblo y adoquín en la ciudad. Se pisa igual.
- Las vacas quedan de este tamaño. Agrandarlas un poco ensucia el pixel.
- La documentación está al día (S34): plan Pro y Opus 5.5 sin presupuesto en dólares, capturas del antes y el después para lo visual, una viñeta por documento en `CLAUDE.md` y el orden de publicación.
- El GDD dice el orden de publicación correcto: itch.io, después Google Play, después Steam (S35). `CLAUDE.md` y la línea «Futuro» del GDD, también (S36).
- Las tres chipas del nivel abren el paso a la antesala (S36). Una cortina de raíces con una tablita que muestra cuántas lleva Kerana; Mainumby dice cuántas faltan; con las tres se entregan y el paso se abre. Desde la pausa se puede volver a buscar las que faltan. Las partidas viejas con el hijo ya libre encuentran el paso abierto. La chipa A de l2 y la C de l3 piden ahora un desvío de verdad. El ascensor de la chipa C de l7 va y viene: si se iba sin Kerana, la chipa se perdía.

- Hay música (S37): diez piezas generadas por código (título, mapa, cada nivel y Yvága) y una variante tensa para cada jefe. Fundidos, más baja en los diálogos, pausa sin foco y arranque con el primer toque. Volumen de música y de efectos por separado en Opciones. Todo aviso de jefe suena, y suenan la puerta de las chipas, los disparadores, las rejas, las plataformas, las lianas, la roca que pide el tajo cargado, la red de seguridad, el salto doble y los menús.

## Ahora

1. Escuchar la música (Jose) y ajustarla en `src/data/music.ts`: Claude no puede oír. Volumen y fundidos en `GAMEPLAY.audio`. Faltan el remate de la liberación (hoy calla la música) y el tema del final (hoy suena el del título).
2. Nivel 6, el detalle del escenario: laja con pasto en el borde, una palma y unas rocas. Sin choque. Después el 7: losa y vela, una cruz y un ramo seco.
3. Jugar las veintiuna chipas como jugador nuevo, ahora que son obligatorias (S36): que cada una se encuentre sin saber dónde está, y que la puerta de la ofrenda se entienda a la primera. La lista de qué pide cada una está en las notas de S36 (`docs/PLAN.md`).
4. El smoke no siempre pasa tres veces seguidas en el contenedor (S37): con el juego a menos de ≈ 10 FPS el piloto se traba en el paso 1 de l2 (también sin música) y alguna vez en la copa 3 de l3. No es del juego: es el piloto, afinado para 10-12 FPS. Detalle en las notas de S37.
5. Publicar en itch.io (los pasos, abajo).
6. Google Play, con el feedback de itch.io (los pasos, abajo).

## itch.io

Sin resolver todavía:

- Subir el build de navegador (el mismo `dist/` de GitHub Pages).
- Página del juego.
- Capturas.
- Descripción.

## Google Play

Sin resolver todavía:

- **Prueba cerrada obligatoria:** 12 testers durante 14 días continuos, para cuentas personales creadas después del 13 de noviembre de 2023. Conviene arrancarla temprano: el plazo corre solo mientras se trabaja en otra cosa.
- Cuenta de desarrollador: US$25, pago único, con verificación de identidad.
- Empaquetado para Android.
- Política de privacidad.
- Clasificación de contenido.
- Íconos y capturas.

## Para cuando vayamos a Steam

- Demo de unos 30–40 minutos (nivel 1 y un pedazo del 2) que termine con «Wishlist el juego completo».
- Logros y mejores tiempos en el mapa. El guardado ya los tiene. No se muestran.
- Cápsula, trailer que abra con gameplay, control y Steam Deck.
- Portugués.

## Ideas sin fecha

Sin sesión asignada. No son pendientes para publicar.

- **Expansión del Chaco, después de publicar.** Dos niveles nuevos en el Chaco paraguayo (espinal seco, quebracho, el Impenetrable), con Pombero y Malavisión como jefes. Es una campaña aparte que se juega después de vencer a Tau, no parte de la historia de los siete hijos: la línea principal cierra con Tau. En una expansión el jugador ya sabe jugar, así que puede exigir desde el primer minuto, sin la obligación de enseñar que tuvo l1.

## No entra

- Acortar niveles.
- Energía, anuncios, cofres al azar y rachas diarias.
- Cambiar cómo se carga el tajo.
- Portugués antes de terminar el juego en el Paraguay.
- Pasar el juego a Unity para mejorar el piso. Phaser alcanza: la diferencia es el dibujo.
- El estilo pintado con curvas. Kerana sigue en pixel art de 16 píxeles.