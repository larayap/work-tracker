# Clarifications: sessions-groups-history

## Iteración 1 — Preguntas (2026-08-02)

Cada pregunta trae un DEFAULT: si no respondés, la propuesta avanza con esa opción tal
como está escrita en `proposal.md`.

1. **Persistencia del historial (D1).** ¿Migramos `usage-log.txt` a un `sessions.json`
   estructurado, o extendemos la línea de texto con más campos?
   - **DEFAULT: migrar a JSON.** Migración one-shot al arrancar; el `.txt` se renombra a
     `.bak` y deja de leerse. Una sola fuente, un solo lector.
   - Alternativa A: JSON solo para lo nuevo, `usage-log.txt` legado leído en paralelo
     (evita migrar, pero deja dos fuentes que el historial debe fusionar para siempre).
   - Alternativa B: seguir en texto plano con dos campos más (`Sesión:`, `Grupo:`).
     Barato hoy, pero un nombre de sesión con `|` rompe el parseo — riesgo que ADR-0006
     ya declara como aceptado para nombres de programa y que acá empeora, porque el
     nombre lo escribe el usuario.

2. **Qué pasa con una fila manual cuando cerrás el cronómetro (D2).** El intent define
   "manual" por el cierre del *programa monitoreado*, pero falta el caso del cierre de la
   *app cronómetro* con una fila manual todavía viva.
   - **DEFAULT:** la entrada manual se persiste con `type: 'manual'`. Al reabrir el
     cronómetro, si el proceso monitoreado sigue abierto la fila renace (la sesión
     transitoria nunca terminó); si ya se cerró, la entrada se descarta en el primer tick.
   - Alternativa: las entradas manuales nunca tocan disco, así que reiniciar el cronómetro
     también las mata. Más tajante, pero mata una sesión en curso por un reinicio que no
     tiene nada que ver con el programa monitoreado.

3. **Cómo elegís el tipo al agregar (D2b).** El modal mide 300px y lista ~106 apps.
   - **DEFAULT:** un toggle único arriba del listado (`Agregar como: Permanente / Solo
     esta vez`), que aplica al próximo agregado. Default `Permanente` — el comportamiento
     de hoy.
   - Alternativa A: dos botones por fila (explícito, pero 212 controles en el listado).
   - Alternativa B: mapear la pestaña — "Instaladas" = permanente, "Procesos abiertos" =
     solo esta vez. Cero controles nuevos, pero te quita la elección: no podés monitorear
     de forma permanente algo que agregaste desde procesos abiertos.

4. **Sesiones en curso al salir de la app (D2c).** Hoy salir del cronómetro con una fila
   corriendo **pierde ese tiempo**: no hay handler de salida que cierre la sesión
   (verificado en `background.js:260`). No es algo que este cambio haya introducido.
   - **DEFAULT:** entra en alcance — al salir se cierran y registran todas las filas
     abiertas. Sin esto, la semántica de "manual" no es definible.
   - Alternativa: dejarlo como está y registrarlo como deuda aparte (pero entonces
     "cerrar el cronómetro" queda como un agujero en la definición de D2).

5. **Qué es un grupo y qué pasa con el tiempo de cada app (D3).**
   - **DEFAULT:** un grupo es una sesión con nombre que contiene N filas, viva mientras
     existan sus filas. Cada app conserva su propio reloj y su propia entrada en el log,
     con `groupId`/`groupName` encima; el total del grupo se calcula en el historial, no
     se persiste.
   - Alternativa: el grupo tiene un reloj propio y registra **una** entrada agregada. Se
     pierde el desglose por app, que es justo lo que el punto 4 del intent pide guardar.
   - **Sub-pregunta abierta**: si dos apps del mismo grupo cuentan al mismo tiempo, ¿el
     total del grupo es la suma de duraciones (14:00 si dos apps corrieron 7:00 en
     paralelo) o el tiempo de reloj de pared cubierto (7:00)? **DEFAULT: la suma**, porque
     es lo que se lee directo de las entradas y no exige calcular solapamientos.

6. **Cómo se crea un grupo con el mouse (D3b).**
   - **DEFAULT:** franja delgada "Arrastrá aquí para agrupar" que aparece cuando hay ≥2
     filas y se convierte en cabecera con nombre editable al recibir la primera. Dos
     `<draggable>` con la misma prop `group`.
   - Alternativa: un botón "+ sesión" explícito que crea el contenedor vacío. Más visible,
     un control permanente más en un widget que se quiere mínimo.

7. **Cuándo se ofrece nombrar la sesión (D4).**
   - **DEFAULT:** nunca al agregar. El nombre se pone después, click en la etiqueta de la
     fila o del grupo → input inline, Enter confirma, Esc cancela. Editable mientras la
     sesión esté abierta; congelado al cerrarse. Sin nombre = `null`.
   - Alternativa A: prompt al agregar la app (interrumpe el flujo de dos clicks que hoy
     tiene agregar algo).
   - Alternativa B: prompt al primer tick de conteo (interrumpe en el peor momento, justo
     cuando volviste a la app que ibas a usar).

8. **Gráfico: qué muestra y con qué (D5b).**
   - **DEFAULT:** un único gráfico de barras horizontales, tiempo por aplicación del día
     seleccionado, dentro de la vista por app/día. `chart.js` 4 + `vue-chartjs` 5, sobre
     el tema oscuro plano y `Architects Daughter`. ~200KB que solo pesan en la ventana de
     historial, nunca en la del cronómetro.
   - Alternativa A: SVG a mano, cero dependencias, ~80 líneas para un gráfico de barras
     simple — viable si querés mantener `package.json` sin sumar nada.
   - Alternativa B: `uPlot` (~40KB), más liviano pero de API bastante más baja.
   - **Sub-pregunta**: ¿querés además una vista de tendencia multi-día (últimos 7/30 días)?
     **DEFAULT: no** en esta iteración — el calendario ya es la navegación temporal.

9. **Alcance del fix de caché corrupta (D6).**
   - **DEFAULT:** encoding UTF-8 en las dos invocaciones PowerShell **más** `schemaVersion`
     en `installed-apps-cache.json` (versión ausente o vieja = caché inválida, se
     reenumera antes de servir).
   - Alternativa: solo el fix de encoding y borrar la caché una vez en un paso de arranque.
     Funciona hoy, pero deja el problema sin mecanismo para la próxima vez que cambie el
     shape del archivo.

10. **Adiciones fuera del intent literal.** La propuesta incluye tres cosas que no pediste
    explícitamente pero que salen del mismo hallazgo: deduplicación por `appId` en el
    listado de instaladas (3 duplicados reales), corrección del patrón de escritura de
    `icon-cache.js::persistToDisk` (sin ella el punto 9 empeora un problema ya conocido), y
    el cierre de sesiones al salir (pregunta 4).
    - **DEFAULT:** las tres entran.
    - Alternativa: sacar la dedup y/o el arreglo de `persistToDisk` a un cambio de deuda
      aparte. Bajan el alcance de este cambio, pero el arreglo de `persistToDisk` es
      prerequisito real del punto 9 — postergarlo significa aceptar el jank en la primera
      apertura del selector.

---

## Iteración 1 — Respuestas (2026-08-02)

El usuario **aprobó [A]** con una enmienda sobre el gráfico.

1. **D1 Persistencia** → DEFAULT confirmado: migrar a JSON (one-shot, `.txt` → `.bak`).
2. **D2 fila manual al cerrar el cronómetro** → DEFAULT (persistida; renace si el proceso sigue vivo, se descarta si no).
3. **D2b tipo en la UI** → DEFAULT confirmado: toggle único arriba del listado.
4. **D2c cierre de sesiones al salir** → DEFAULT (entra en alcance).
5. **D3 grupos** → DEFAULT (grupo = sesión con nombre; no fusiona relojes; total derivado = suma).
6. **D3b arrastre** → DEFAULT (franja "Arrastrá aquí para agrupar").
7. **D4 nombre** → DEFAULT confirmado: edición inline posterior, nunca prompt.
8. **D5b gráfico** → **ENMIENDA del usuario**: *"los gráficos aparte de por día me gustaría que se puedan ver por mes o la fecha que quiera el usuario en rangos"*. El gráfico deja de ser solo del día seleccionado: debe soportar **tres alcances — día, mes, y rango arbitrario de fechas elegido por el usuario**. Esto anula la sub-decisión "sin tendencias multi-día" de la iteración 1. Implicaciones a reflejar en la propuesta: (a) el historial necesita un selector de alcance (día/mes/rango — `v-calendar` ya soporta selección de rango); (b) la agregación pasa de "entradas de un día" a "entradas de un intervalo"; (c) el caso multi-día refuerza la elección de chart.js frente a SVG a mano (escalas y ejes temporales gratis).
9. **D6 caché** → DEFAULT (encoding + `schemaVersion`).
10. **Adiciones fuera del intent** → DEFAULT (las tres entran).
