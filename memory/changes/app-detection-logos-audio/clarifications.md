# Clarifications: app-detection-logos-audio

## Iteración 1 — Preguntas (2026-08-01)

Cada pregunta trae una recomendación marcada como **DEFAULT**. Si estás de acuerdo con
todas, basta con aprobar la propuesta y se toma el default de cada una.

1. **Alcance de sistema operativo.** La enumeración de apps instaladas solo tiene camino
   realista en Windows (registro / Menú Inicio). El código de detección actual ya es
   Windows-only, pero `forge.config.js` declara makers para darwin, deb y rpm.
   - **(a) DEFAULT — Windows-first explícito.** Se declara en la spec, y todo el código
     dependiente de SO se aísla en un módulo del main process para que sumar otro SO
     después sea aditivo. Motivo: no hay soporte real de otro SO hoy, y abrir una rama por
     SO duplica la superficie de la feature más riesgosa sin nadie que la use.
   - (b) Rama por SO desde el arranque (sube el esfuerzo de XL a claramente más).

2. **Semántica del conteo con varios programas.** Si tenés 3 programas monitoreados
   abiertos pero usás uno solo, ¿qué pasa con los otros dos?
   - **(a) DEFAULT — solo suma el que tiene el foco.** Proceso vivo = sesión abierta;
     foco = quién acumula. Motivo: la app mide tiempo dedicado; si N programas suman en
     paralelo, el total de un día supera al día y el historial pierde sentido. Es además
     la semántica que la app ya tiene hoy con una app.
   - (b) Todos los programas abiertos suman en paralelo (mide uptime de proceso, no
     atención). Elegí esta si tu caso real es medir renders o procesos largos desatendidos.
   - (c) Mixto configurable por programa (agrega una opción por app; más superficie).

3. **Límite de programas simultáneos.** Pediste "no una lista infinita" sin dar número.
   - **(a) DEFAULT — 4.** Cada fila mide ~44px; con 4 el widget Aplicación queda en ~210px
     y sigue entrando en un punto de `scroll-snap` junto a Manual y Pomodoro, sin scroll
     interno y sin pelear con el resize automático de ventana de `Menu.vue`.
   - (b) 3 (más conservador, widget más compacto).
   - (c) 5 o 6 (el widget empieza a necesitar scroll interno propio).

4. **"Volumen de la app y el de las opciones".** Lectura que propongo:
   - **(a) DEFAULT — dos controles.** Un master global que baja todo, y un control aparte
     para los sonidos de interacción (agregar, popup, botón, eliminar). La alarma de fin de
     sesión queda solo bajo el master. Motivo: la alarma es una señal que tiene que
     escucharse; los clics son decoración y son lo que uno quiere bajar sin perder la
     alarma.
   - (b) Un solo control global (más simple, pero obliga a elegir entre silencio y alarma
     audible).
   - (c) Un slider por cada uno de los 5 sonidos (más control, más UI, sin caso de uso
     declarado).

5. **Tamaño del cambio.** Tal como está propuesto, el esfuerzo es XL y agrupa 6 features
   con un refactor del motor de monitoreo de por medio, sin tests que lo respalden.
   - **(a) DEFAULT — todo junto.** Se hace completo en la secuencia propuesta.
   - (b) Sacar el **selector de apps instaladas** a un cambio posterior. Es la pieza más
     cara y con más ruido (parsear el registro de Windows); todo lo demás funciona
     eligiendo desde las apps abiertas como hoy. Bajaría el esfuerzo a L y haría cada fase
     más verificable.

6. **Presentación multi-programa.** Delegaste el diseño; está descrito en prosa en la
   sección "Approach Propuesto" de `proposal.md` (columna de filas planas, ícono gris 24px,
   nombre truncado, reloj alineado a 8ch, botones pausa/detener por fila, y la fila activa
   distinguida solo por opacidad y brillo, sin colores de acento). **DEFAULT: se toma tal
   cual.** Si algo no calza con lo que tenías en la cabeza, decilo ahora — después de
   `sdd-design` cambiarlo cuesta más.

---

## Iteración 1 — Respuestas (2026-08-01)

El usuario eligió **[R] Refinar**. Respuestas y correcciones, punto por punto.

### 1. Alcance de SO
Sin objeción → se mantiene **(a) Windows-first explícito**.

### 2. Semántica del conteo — CONFIRMADA, con la redacción corregida

El usuario respondió: *"El conteo en paralelo no tendría el problema que mencionas, ya que
la idea sería que estuviese contando solo el programa en el que se está... irían sumando
dependiendo de cuál tenga el foco pero todos deberían salir como que están ahí, solo que
todos pausados menos el que sí está activo."*

Es el **mismo comportamiento del DEFAULT (a)**, nombrado distinto. "Conteo en paralelo" en
el vocabulario del usuario significa *varias filas presentes y visibles a la vez*, no
*varias filas acumulando a la vez*. El riesgo que la propuesta v1 levantó (el total de un
día supera al día) no aplica, porque nunca hay más de un reloj avanzando.

**Corrección a la propuesta**: reescribir esta sección sin plantear la acumulación
paralela como alternativa descartada ni como advertencia. El comportamiento es
sencillamente: **todas las filas del listado se muestran siempre; el reloj de la fila con
foco avanza; las demás se muestran en pausa.** El usuario ya reconoce esta semántica
porque es la que la app tiene hoy con una sola app (pone Chrome y solo suma cuando
realmente está en Chrome).

Retirar de `## Trade-offs` el punto sobre el render de Blender de 3 horas: no es un
trade-off que el usuario acepte discutir, la semántica de foco es la deseada.

### 3. Solo el listado del usuario — restricción nueva y explícita

*"no olvidar que esto sería solo del listado que dé el usuario"*

Se monitorea **exclusivamente** lo que el usuario agregó a su lista (por el selector de
instaladas o manualmente). La app **no** agrega filas sola al detectar cualquier programa
en foco. Detectar el foco de un programa que no está en la lista no produce ningún efecto.
Dejarlo escrito como requisito, no como supuesto.

### 4. Selector de apps instaladas — DENTRO de scope, con barra de calidad

*"además sí quiero ese selector"*

Se descarta la opción (b) del punto 5 (sacarlo a un cambio posterior). El cambio se
mantiene **XL** con las 6 features juntas.

Requisito de calidad agregado por el usuario: *"ojalá logres separar procesos random a lo
que son aplicaciones más reales de usar como Discord, Clip Studio, etc."*

El selector muestra **aplicaciones de usuario reconocibles**, no todo lo que el registro
devuelve. Esto sube de "mitigación" a **criterio de aceptación**: un listado que muestre
runtimes, actualizadores, redistribuibles y servicios de fondo se considera no cumplido.
La propuesta debe declarar explícitamente cómo se distingue una app real de un proceso de
sistema (heurística de filtrado), porque es lo que decide si la feature sirve.

### 5. Límite de programas simultáneos
Sin objeción → se mantiene **(a) 4**.

### 6. Volumen
Sin objeción → se mantienen **(a) dos controles** (master + sonidos de interacción).

### 7. Presentación multi-programa — REEMPLAZA lo propuesto en v1

El usuario adjuntó una captura del widget actual y marcó en rojo la fila de controles.
Estado actual observado en la captura: ícono de menú hamburguesa arriba a la izquierda,
título "Work" centrado, y debajo **una fila con `+` · `00:00:00` · `■` (cuadrado) · `▶`
(play)**.

*"tenía pensado que se repita solo esta sección marcada en rojo, tipo que esa misma pero
abajo, y que dependiendo de cuántos hay abiertos del listado (o agregados manualmente) se
vea cuánto lleva de cada uno"*

**Diseño corregido**:

- La fila por programa **replica la fila de controles que ya existe** (`00:00:00` + `■` +
  `▶`), repetida verticalmente, una por programa del listado. No es una fila nueva
  inventada: es la misma que ya está, multiplicada.
- Se descarta la propuesta v1 de fila con ícono 24px + nombre truncado + reloj a 1.4rem con
  ancho 8ch + distinción por opacidad. Punto de partida = la fila actual tal cual se ve.
- **Pendiente de resolver en la propuesta refinada**: dónde entran el logo B/N (feature 1) y
  el nombre del programa dentro de esa fila, dado que la fila actual no los tiene. La
  feature 1 pide logo automático en B/N, así que la fila necesita alojarlo. Proponer la
  ubicación respetando que la fila conserve su forma actual, y declarar cómo se distingue
  visualmente la fila activa de las pausadas.
- El **`+` sale de la fila**: pierde sentido repetido por programa. Va **una sola vez,
  arriba, en una esquina donde se vea bien**, y agrega un programa al listado. Proponer la
  esquina concreta considerando que arriba a la izquierda ya vive el menú hamburguesa y al
  centro el título "Work".

### 8. Semántica del botón cuadrado (■) — requisito nuevo

*"el botón de cuadrado debería cortar por completo el conteo de ese programa, y que no se
vuelva a iniciar el conteo hasta que el programa se cierre y vuelva a abrir si es que está
en el listado automático, o si el usuario le dio manualmente a iniciar el conteo"*

El cuadrado **detiene** (no pausa): corta el conteo de ese programa y lo deja en un estado
del que **no sale solo aunque el programa recupere el foco**. Solo se reanuda por:
- **(a)** el programa se cierra y se vuelve a abrir, estando en el listado de arranque
  automático; o
- **(b)** el usuario presiona ▶ manualmente.

Esto agrega un tercer estado por programa, distinto de "corriendo" y de "pausado por falta
de foco": **detenido**. Un programa detenido con foco activo no acumula. La propuesta debe
declarar los tres estados y sus transiciones, porque el motor multi-app tiene que
representarlos (hoy el main solo distingue "hay intervalo" / "no hay intervalo").

Aclarar también en la propuesta qué hace ▶ y qué hace ■ respecto de la sesión persistida en
`usage-log.txt` (si ■ cierra la sesión y la escribe al log, o si la mantiene abierta).

---

## Iteración 2 — Preguntas (2026-08-01)

Quedan tres decisiones, todas derivadas del nuevo significado del botón ■. Cada una trae
recomendación marcada como **DEFAULT**: si estás de acuerdo con las tres, aprobá la
propuesta y se toman los defaults.

1. **¿Qué hace ■ con la sesión en `usage-log.txt`?**
   - **(a) DEFAULT — ■ cierra la sesión y escribe la línea en el log en ese momento.**
     Motivo: ■ significa "cortar por completo"; una sesión abierta que nunca acumula solo
     existe en memoria, y si la app se cierra o cae con el programa todavía abierto, ese
     tiempo se pierde. Además ▶ después de ■ inicia un tramo medido nuevo, así que dos
     líneas describen lo que realmente pasó. El historial ya agrega por día y por app: N
     líneas suman igual que una.
   - (b) ■ congela pero deja la sesión abierta hasta que el proceso se cierre (una sola
     línea por apertura del programa, a costa de que la duración registrada no coincida con
     el tiempo transcurrido, y de perder el tramo si la app cae).

2. **¿Qué muestra el reloj de cada fila, y qué pasa con él al presionar ■?** Hoy el ■ es
   literalmente un `reset` que pone el reloj en cero; al redefinirlo como "detener" hay que
   decidir qué queda en pantalla.
   - **(a) DEFAULT — el reloj muestra el acumulado del día para ese programa, y ■ no lo
     pone en cero.** Motivo: pediste ver "cuánto lleva cada uno", y eso es el total del día,
     no el de la última sesión; poner en cero borraría de la vista tiempo que sí quedó
     registrado en el log. Consecuencia: el widget deja de tener un botón para poner un
     reloj en cero a mano — el día se cierra solo a medianoche.
   - (b) El reloj muestra la sesión actual y ■ lo deja en cero (más parecido al
     comportamiento de hoy, pero perdés de vista el total del día).
   - (c) Mantener el acumulado del día y agregar un gesto aparte para poner en cero a mano
     (más UI en una fila que se quiere mínima).

3. **¿Una lista o dos?** Escribiste que un programa detenido se reanuda si "se cierra y
   vuelve a abrir si es que está en el listado automático". Eso se puede leer como que hay
   programas con arranque automático y otros sin él.
   - **(a) DEFAULT — una sola lista.** El listado del usuario *es* el listado de arranque
     automático: todo programa agregado arranca su conteo solo al abrirse. Motivo: no hay
     caso de uso declarado para la otra categoría, y separarlas exige un toggle por fila en
     una UI que se quiere mínima.
   - (b) Dos categorías, con un interruptor por programa para el arranque automático.

---

## Iteración 2 — Respuestas (2026-08-01)

El usuario **aprobó [A]** la propuesta v2. Respuestas a las 3 preguntas, más dos
disambiguaciones de seguimiento que el orquestador levantó porque la respuesta 2 contradecía
un requisito de la iteración anterior.

### 1. ■ y `usage-log.txt` → DEFAULT (a) confirmado
■ cierra la sesión y escribe la línea al log en ese momento.

### 2. Qué hace ■ — REEMPLAZA el estado "detenido" de v2

El usuario respondió: *"el cuadrado debería sacar del listado a ese programa ya que no se
estaría considerando, si solo quedaba un programa sí dejalo en 0 todo, más parecido a lo que
pasa hoy que queda en cero y ya."*

**■ saca la fila del listado visible.** No existe un estado "detenido": el programa deja de
estar en la lista.

Disambiguación pedida por el orquestador (porque en la iteración 1 el usuario había dicho que
un programa detenido se reanuda al cerrarse y volver a abrirse):

> *¿Chrome vuelve solo si lo cerrás y lo volvés a abrir, o queda fuera hasta que lo agregues
> con el `+`?*
> → **Vuelve sola la fila.**

**Comportamiento resultante**: ■ cierra la sesión, la escribe al log y saca la fila de la
vista, **pero el programa sigue en la selección guardada del usuario**. Cuando ese programa se
cierra y se vuelve a abrir, su fila reaparece sola y cuenta desde cero. Concilia ambos
requisitos: el ■ corta de verdad, y el auto-reinicio por ciclo de vida del proceso se conserva.

**Consecuencia sobre el reloj** (resuelve la pregunta 2 del bloque anterior por vía indirecta):
el reloj de una fila muestra el tiempo acumulado **desde que la fila apareció**, no el
acumulado del día. Al reaparecer tras un ciclo cerrar/abrir, arranca en `00:00:00`. Es lo que
el usuario pidió: *"queda en cero y ya"*, alineado con el comportamiento actual.

**Estado vacío**: al sacar la última fila, el widget vuelve a verse como hoy sin programas
—`00:00:00` con el `+`—. El usuario lo pidió explícitamente: *"si solo quedaba un programa sí
dejalo en 0 todo"*.

### 3. Una lista o dos → DEFAULT (a) confirmado
Una sola lista. El listado del usuario es también el de arranque automático.

### 4. El ▶ deja de ser botón — REEMPLAZA la fila de v2

Pregunta del orquestador: con el ■ sacando la fila y el conteo gobernado por el foco, ¿el ▶
conserva función?

Respuesta del usuario: *"solo deja a modo de entender si está pausado o en play ese programa,
más que nada visual para el usuario, pero que no sean botones ni tengan funcionalidad."*

**El ▶/⏸ pasa a ser un indicador de estado, no un control.** No es clickeable, no tiene hover,
no tiene `scale(1.2)`, no responde a nada: solo comunica si esa fila está acumulando (glifo de
play) o en pausa por falta de foco (glifo de pausa). Debe leerse visualmente como indicador y
no como botón — que nadie intente hacerle click.

**El ■ queda como el único control interactivo de la fila.**

### Modelo de estados resultante — SIMPLIFICADO a dos

| Estado | Condición | Reloj | Indicador |
|---|---|---|---|
| **corriendo** | en el listado, proceso vivo, tiene el foco | avanza | glifo play |
| **pausado** | en el listado, sin foco (o proceso cerrado) | quieto | glifo pausa |

Se elimina el estado **detenido** y toda su máquina de transiciones de v2. El ■ ya no produce
un estado: produce la salida de la fila. Con eso, la distinción visual de tres niveles de
contraste de v2 se reduce a dos, y el "■ inactivo en detenido" desaparece.

**Fila final**: logo B/N · nombre · reloj · indicador ▶/⏸ (no interactivo) · ■ (único botón).
El `+` sigue una sola vez en la esquina superior derecha del encabezado.

---

## Iteración 3 — Respuesta (2026-08-01)

El orquestador señaló una decisión derivada que v3 había resuelto por su cuenta: qué pasa con
la fila cuando el proceso se cierra **sin** que el usuario presione ■. v3 la dejaba visible en
`pausado` con el reloj congelado.

Respuesta del usuario: *"me gustaría que si se cierra el programa se salga la sesión y se
guarde como haría si aprietas el cuadrado."*

**El cierre del proceso y el ■ son el mismo evento**: cierran la sesión, la escriben en
`usage-log.txt` y sacan la fila del listado visible. El programa permanece en la selección
guardada en ambos casos, así que la fila reaparece sola la próxima vez que el programa se abra.

**Consecuencia sobre el modelo de estados**: el estado `pausado` queda reservado
exclusivamente para *el programa está abierto pero no tiene el foco*. Desaparece la variante
"pausado porque el proceso está cerrado" que v3 contemplaba: una fila cuyo proceso se cerró
deja de existir, no queda congelada. El estado de una fila viva pasa a ser función de una sola
señal (el foco), y el proceso vivo pasa a gobernar únicamente la existencia de la fila.

Corregir en `proposal.md`: la tabla de dos estados, las transiciones, la tabla de persistencia
(la línea "el proceso se vuelve a abrir → vuelve a 00:00:00" se mantiene, pero ahora describe
la reaparición de la fila, no la reanudación de una fila que seguía ahí), la sección "Qué hace
el ■" y cualquier trade-off que dependiera del caso anterior.
