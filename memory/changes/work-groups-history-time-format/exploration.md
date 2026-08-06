# Exploración: work-groups-history-time-format

Todas las specs de `session-groups`, `history-window`, `app-row-ui` y `session-naming`
relevantes al intent tienen `verified_at: 2026-08-02` y `superseded_by: null`. `git log
--after=2026-08-02` sobre los `scope[]` de las siete specs consultadas (`CronometroAplicacion.vue`,
`AppRow.vue`, `monitoredApps.js`, `monitor-engine.js`, `session-log.js`, `HistoryView.vue`,
`UsageChart.vue`, `session-aggregate.js`, `App.vue`) no devuelve commits: ninguna está stale.
Se usan como fuente primaria de "qué hace hoy el sistema"; el código se lee para "dónde" y para
verificar los dos puntos que las specs no cubren (límite de grupos, alcance real de la fuente
decorativa).

Intento de captura visual con la app real en Windows (handle `198752`, ventana "Workout"): la
ventana apareció visible sin pasar por el tray, pero la captura devolvió el contenido de otra
ventana superpuesta (una terminal), no la UI de la app — descartado sin insistir, según lo
indicado en el prompt. Toda la evidencia de este documento es de código y specs.

## Ítem 1 — Grupos múltiples

### Estado actual

El modelo de datos **ya soporta N grupos simultáneos sin cambios**: `groupId`/`groupName` son
campos libres por fila en el main process, sin colección de grupos ni límite de cantidad
distinta de grupos activos. `setRowGroup(appId, groupId)` acepta cualquier `groupId` y
`renameGroup(groupId, name)` opera sobre cualquier `groupId` existente entre las filas — ninguno
de los dos impone unicidad [fuente: código `src/main/monitor-engine.js:374-393`].

La limitación real está enteramente en `CronometroAplicacion.vue`: un solo
`activeGroupId`/`activeGroupName` en `data()`, un solo array `dragGrouped` y un solo
`<div class="group-container">` en el template. El `watch` sobre `monitoredApps.rows` deriva
`activeGroupId` tomando `grouped[0].groupId` — el primer grupo que aparezca en el snapshot,
ignorando si hubiera más de uno — y `onGroupDragChange` siempre asigna la fila arrastrada a
`this.activeGroupId || generateGroupId()`, es decir al único grupo conocido por la UI o a uno
nuevo si no hay ninguno [fuente: código `src/components/CronometroAplicacion.vue:107-146,161-168`].
El propio comentario del componente ya documenta esta lectura: *"Un solo contenedor activo a la
vez — el modelo (`groupId` por fila) soporta N grupos, el límite es de esta interfaz"*
[fuente: código `src/components/CronometroAplicacion.vue:46-49`].

ADR-0008 confirma la misma conclusión a nivel de decisión de arquitectura: *"El modelo soporta
más de un grupo simultáneo sin cambios: `groupId` por fila ya lo permite. Que la interfaz de
este cambio muestre un solo contenedor es una decisión de alcance de la UI, no un límite del
modelo"* [fuente: spec [[group-composition-and-drag]] / ADR `0008-sessions-and-groups-as-entry-metadata`].

`buildDayTimeline` (agregador del historial) ya itera sobre un `Map<groupId, block>` sin
límite de entradas distintas — el historial ya puede mostrar cualquier cantidad de grupos
distintos del mismo día sin cambios [fuente: código `src/utils/session-aggregate.js:57-88`].

**Conclusión de la ambigüedad #2 planteada**: es una limitación de UI, no de modelo. El esfuerzo
real es acotado a un componente del renderer.

### Archivos afectados

| Archivo | Rol | Impacto |
|---|---|---|
| `src/components/CronometroAplicacion.vue` | Único componente con estado de grupo en el renderer | Único archivo con cambios esperados: pasar de un `activeGroupId`/`dragGrouped` a una colección indexada por `groupId`, y renderizar N contenedores |
| `src/stores/monitoredApps.js` | Expone `setRowGroup`/`renameGroup` genéricos | Sin cambios esperados — ya no impone límite alguno |
| `src/main/monitor-engine.js` | Dueño del estado de grupo | Sin cambios esperados — ya soporta `groupId` arbitrario |
| `src/main/session-log.js` | Persiste `groupId`/`groupName` por entrada | Sin cambios esperados |
| `src/history/BySessionView.vue` + `src/utils/session-aggregate.js` | Muestran grupos como bloques en el historial | Sin cambios esperados — ya soportan múltiples `groupId` por día |

### Dependencias y restricciones

- ADR-0008 fija el modelo (grupo = campo, no entidad): cualquier approach debe permanecer
  dentro de ese modelo — no crear una colección de grupos persistida ni un archivo nuevo.
- El límite de 4 filas simultáneas en el listado visible (`nextRows.length >= 4` en
  `reduceLifecycle`, `src/main/monitor-engine.js:114`) sigue vigente sin relación con la
  cantidad de grupos — agrupar no crea ni destruye filas.
- `vuedraggable` exige mutar arrays locales por gesto: con N grupos habrá N arrays (o una
  estructura indexada por `groupId`), y la guarda `isDragging` (que hoy suspende la
  reconstrucción de dos arrays fijos) debe extenderse a todos ellos sin dejar huecos donde un
  snapshot en tick pise un arrastre en curso.
- La heurística actual de aparición del contenedor ("aparece con ≥2 filas sueltas") deja de
  ser unívoca con N grupos posibles — con más de un grupo hace falta un gesto explícito para
  crear "el segundo grupo" (hoy no existe ningún botón "nuevo grupo").

### Approaches posibles

**Approach A: colección de grupos derivada dinámicamente (`Map<groupId, rows[]>`)**
- El `watch` de `rows` construye N grupos en vez de uno; el template hace `v-for` sobre esa
  colección, cada grupo con su propio `<draggable>` y su propia guarda de `isDragging`.
- La aparición de un grupo nuevo requiere una acción explícita (ej. botón "+ nuevo grupo") en
  vez de la heurística implícita actual, porque con N grupos posibles ya no hay un único
  "próximo grupo" al que asignar una fila sacada del listado suelto.
- **Pros**: se ajusta 1:1 al modelo ya vigente (ADR-0008), sin tocar main/store/persistencia.
- **Contras**: la interacción de "crear el segundo grupo" es nueva y no está definida por
  ninguna spec — requiere diseño de interacción explícito en `sdd-propose`/`sdd-design`.
- **Esfuerzo**: M.

**Approach B: contenedor único + selector de "grupo activo" (tabs)**
- Se mantiene un solo `<draggable>` de grupo visible a la vez, con un selector para cambiar de
  grupo activo antes de arrastrar.
- **Pros**: cambio de template más chico.
- **Contras**: dos gestos en vez de uno para armar el segundo grupo (cambiar de tab, luego
  arrastrar); no es la lectura natural de "crear varios grupos" que pide el intent, que sugiere
  verlos simultáneamente, no uno a la vez.
- **Esfuerzo**: S, pero peor ajuste al intent.

### Recomendación

**Approach recomendado**: A.
**Justificación**: el modelo ya lo permite sin fricción; el costo real está en el diseño de
interacción para crear un grupo adicional, que de todas formas hay que resolver con el usuario
en `sdd-propose` independientemente del approach elegido.

---

## Ítem 2 — Ocultar horas debajo de los gráficos

### Estado actual

La lectura más literal de "abajo del gráfico" corresponde al eje de valores de
`UsageChart.vue`: por ser un gráfico de barras horizontal (`indexAxis: 'y'`), el eje de
duración se dibuja al pie del gráfico, con ticks formateados explícitamente como `HH:MM:SS` vía
`ticks: { callback: (value) => msToHHMMSS(value) }` sobre `scales.x`
[fuente: código `src/history/UsageChart.vue:61-74`]. Esas etiquetas son, literalmente, horas
que aparecen debajo de las barras del gráfico.

Debajo del propio `<UsageChart>` en el DOM de `HistoryView.vue` están además las dos listas
ancladas al día (`ByAppView`/`BySessionView`), que también muestran duraciones
[fuente: código `src/history/HistoryView.vue:34-46`] — pero mostrar esas listas es un
requisito explícito y vigente de `usage-chart-by-interval` (*"El sistema SHALL NOT cambiar lo
que muestran las dos listas debajo del gráfico cuando cambia el alcance del gráfico"*)
[fuente: spec [[usage-chart-by-interval]]]. Esa spec no prohíbe ocultar columnas de tiempo
dentro de esas listas, solo que cambien con el alcance del gráfico — pero tocar su contenido
excede lo que la spec anticipa.

### Archivos afectados

| Archivo | Rol | Impacto |
|---|---|---|
| `src/history/UsageChart.vue` | Define `chartOptions.scales.x` | Candidato principal — ocultar o simplificar el eje de duración |

### Dependencias y restricciones

- ADR-0010 confina toda librería de gráficos a `src/history/` — el cambio de escalas/ticks es
  interno a ese bundle, sin efecto sobre `index.html`.
- `usage-chart-by-interval` exige que el gráfico siga siendo legible con minutos (día) y con
  decenas de horas (mes/rango) [fuente: spec [[usage-chart-by-interval]]] — remover el eje por
  completo deja el valor exacto disponible solo vía tooltip (`plugins.tooltip.callbacks.label`,
  que ya usa el mismo `msToHHMMSS` y no se ve afectado por ocultar el eje).

### Approaches posibles

**Approach A: `scales.x.display: false`**
- Oculta el eje X completo (grid, línea y ticks). El gráfico queda con las barras y las
  categorías (nombres de app) en el eje Y; el valor exacto solo aparece al pasar el mouse.
- **Pros**: cambio de una línea, resuelve la lectura más literal del pedido.
- **Contras**: ninguno funcional — el tooltip ya cubre el valor exacto.
- **Esfuerzo**: XS.

**Approach B: ocultar solo los ticks (`scales.x.ticks.display: false`)**
- Conserva la línea/grid del eje como referencia visual sin números.
- **Pros**: deja una referencia visual mínima.
- **Contras**: no está claro que el usuario quiera conservar ningún resto del eje.
- **Esfuerzo**: XS.

### Recomendación

**Approach recomendado**: A, sujeto a confirmar con el usuario si la lectura correcta es "el
eje de horas del gráfico" — el tamaño del cambio es idéntico entre A y una eventual variante
sobre las listas, así que la ambigüedad se resuelve barato en `sdd-propose`.

**Ambigüedad adicional detectada (no listada explícitamente por el orquestador, pero real)**:
"las horas" podría en cambio referirse a las columnas de tiempo de `ByAppView`/`BySessionView`,
que están literalmente debajo del `<UsageChart>` en el layout de `HistoryView.vue`. Esa lectura
choca con el `SHALL NOT` vigente de `usage-chart-by-interval` sobre esas listas (no en su
contenido, pero sí en su rol declarado de fuente de verdad del día) — documentado para que
`sdd-propose` lo confirme con el usuario si el Approach A no resulta ser lo que se pedía.

---

## Ítem 3 — Agrupar por aplicación en el gráfico (día/mes/rango)

### Estado actual

La agregación por aplicación **ya existe** para los tres alcances (día, mes, rango), vía un
único agregador puro reutilizado tanto por el gráfico como por la lista "Por app":
`aggregateByApp` suma `durationMs` por `groupKeyOf(entry)`, donde la clave es `entry.appId`
salvo que sea `null`, en cuyo caso degrada a `name:${entry.app}`
[fuente: código `src/utils/session-aggregate.js:26-49`]. Este agregador ya fue corregido y
re-verificado contra los 32 registros reales migrados de `usage-log.txt`, exactamente para el
caso de fusión indebida (`appId: null` colapsando todos los programas en una fila) — el fix
opuesto al que pide este ítem [fuente: spec [[usage-chart-by-interval]], sección Acceptance
Criteria, fix F1].

**Gap real no cubierto por el agregador actual**: si la misma aplicación visible (mismo `app`,
ej. "Chrome") corre bajo dos `exePath` distintos y ambos tienen `appId` no-nulo (dos
instalaciones, o una reinstalación que cambió de ruta), sus entradas HOY se agrupan en dos
barras separadas con la misma etiqueta "Chrome" — la clave de agrupación es identidad de
ejecutable (`appId`), no nombre visible. No hay evidencia en el código de que este caso se haya
evaluado ni descartado; es una hipótesis a validar contra datos reales antes de decidir si hay
algo que corregir.

### Archivos afectados

| Archivo | Rol | Impacto |
|---|---|---|
| `src/utils/session-aggregate.js` | `groupKeyOf`/`aggregateByApp`, compartido por gráfico y lista "Por app" | Único candidato a cambio si se confirma el gap — cambiarlo aquí resuelve gráfico y lista a la vez (DRY ya vigente) |

### Dependencias y restricciones

- Cambiar `groupKeyOf` de `appId` a `app` (nombre visible) fusionaría también programas
  distintos que coincidan por casualidad en el nombre legible, dato que ni ADR-0006 ni
  ADR-0007 garantizan estable/único — sería revertir en la práctica el criterio del fix F1 ya
  validado (`usage-chart-by-interval`), que existe justamente para evitar fusiones espurias.
- Este agregador es compartido: cualquier cambio de clave afecta gráfico y lista "Por app" al
  mismo tiempo — no hay forma de tocar uno sin el otro tal como está estructurado hoy (SSOT ya
  cumplido, a favor y en contra).

### Approaches posibles

**Approach A: verificar antes de tocar código**
- Consultar el `sessions.json` real de producción (accesible vía interop Windows, mencionado
  como recurso disponible) para confirmar si existe una duplicación real de "Chrome" (u otra
  app) en dos barras distintas del mismo intervalo.
- **Pros**: si no hay duplicación real, este ítem ya está resuelto y solo falta comunicarlo —
  cero riesgo de revertir el fix F1.
- **Contras**: no cierra el ítem si el usuario ya observó la duplicación en su uso diario y el
  entorno de verificación no la reproduce.
- **Esfuerzo**: XS (solo verificación, sin cambio de código).

**Approach B: clave de agrupación híbrida por nombre normalizado**
- Agrupar primero por `appId`; si dos `appId` distintos (no degradados, es decir con `exePath`
  real) comparten el mismo `app` normalizado (mismo nombre, distinta ruta), fusionar esas
  entradas bajo una clave común basada en el nombre.
- **Pros**: cubre el caso de reinstalación/rutas múltiples sin tocar el criterio de degradación
  ya validado (`appId: null` sigue degradando a nombre, sin cambios).
- **Contras**: agrega una regla más al agregador puro, con su propio riesgo de colisión de
  nombres entre programas distintos — requiere pensar el caso con cuidado (ej. dos ejecutables
  legítimamente distintos que compartan `name`, como suele pasar con updaters/launchers).
- **Esfuerzo**: S.

### Recomendación

**Approach recomendado**: A primero. Este ítem probablemente ya cumple el intent tal como está
implementado hoy; conviene verificarlo con datos reales antes de invertir esfuerzo en tocar un
agregador que ya tiene un fix validado en sentido contrario.

---

## Ítem 4 — Tipografía legible

### Estado actual

`"Architects Daughter", cursive` (fuente decorativa, Google Fonts) está declarada en **tres
lugares** del código:

1. **Global**, en `src/App.vue` sobre `html, body` y `#app` — afecta toda la ventana del
   cronómetro sin excepción: título "Work", nombres de aplicación en las filas (que no
   declaran `font-family` propio y heredan por cascada), campo de edición de nombre de sesión,
   sesiones de Pomodoro, etc. [fuente: código `src/App.vue:47-62`].
2. **Puntual**, en `src/components/CronometroPomodoro.vue` sobre `.edit-input` (campo de
   edición de minutos de una sesión Pomodoro) [fuente: código
   `src/components/CronometroPomodoro.vue:331`].
3. **En el bundle de historial**, `src/history/UsageChart.vue` fija
   `ChartJS.defaults.font.family = "'Architects Daughter', cursive"` y trae su propio `@import`
   de la fuente [fuente: código `src/history/UsageChart.vue:28-29,94-98`] — pese a que el
   resto de la ventana de historial (`HistoryView.vue`) ya usa `font-family: sans-serif`
   [fuente: código `src/history/HistoryView.vue:220-227`]. ADR-0010 documenta esta
   inconsistencia como trade-off aceptado explícitamente: *"La ventana de historial usa hoy
   `font-family: sans-serif`, mientras el resto de la aplicación carga `Architects Daughter`...
   Aplicar la misma tipografía al gráfico obliga a importarla también en el bundle de
   historial"* [fuente: ADR `0010-charting-library-confined-to-history-bundle`].

Los nombres de aplicación en las filas del cronómetro (`AppRow.vue`, clases `.app-name` /
`.app-name-input`) **no declaran `font-family` propio** — heredan la decorativa desde `App.vue`
por cascada [fuente: código `src/components/AppRow.vue:160-178`]. No existe hoy ningún selector
CSS que aplique la fuente decorativa "solo a nombres de aplicación": es simplemente el
`font-family` de raíz, heredado por todo lo demás también.

**Conclusión de la ambigüedad #1 planteada**: el ticket dice "la fuente de texto de
aplicaciones", pero en el código no hay ningún punto donde la fuente decorativa esté acotada a
nombres de apps — es una decisión global de `App.vue`. Dos lecturas reales, ninguna resuelta por
el código:

- **(a) Acotada**: cambiar solo `.app-name`/`.app-name-input` en `AppRow.vue` con un override
  local. Ajustado a la letra literal, pero deja el resto de la ventana (título, Pomodoro,
  etc.) con la fuente decorativa — mezcla visual de dos tipografías en la misma ventana.
- **(b) Global**: cambiar `App.vue` (y por herencia todo lo que cuelga de `#app`). Resuelve
  "que se pueda ver bien" de raíz para toda la ventana del cronómetro, pero excede lo que el
  ticket menciona literalmente (solo habla de "aplicaciones").

### Archivos afectados

| Archivo | Rol | Impacto |
|---|---|---|
| `src/App.vue` | Declara la fuente global (`html, body`, `#app`) | Cambio de raíz si la lectura es (b) |
| `src/components/AppRow.vue` | Nombres de aplicación en las filas | Override puntual si la lectura es (a) |
| `src/components/CronometroPomodoro.vue` | `.edit-input` con la misma fuente | Afectado en ambas lecturas si se busca consistencia |
| `src/history/UsageChart.vue` | Fuente del gráfico + su propio `@import` | Candidato a alinear con `sans-serif` ya vigente en `HistoryView.vue`, independiente de (a)/(b) |

### Dependencias y restricciones

- Ningún ADR fija la tipografía decorativa global como decisión arquitectónica deliberada —
  es libre de cambiar sin ADR nuevo.
- ADR-0010 sí documenta el trade-off de la fuente del gráfico como consecuencia de una decisión
  de bundle — cambiarla no contradice el ADR, lo alinea con el estado que el propio ADR señala
  como inconsistente hoy.
- El `@import` de Google Fonts depende de red; sin conexión cae a la tipografía de respaldo
  (`cursive` o `sans-serif` del sistema, según cuál quede declarada) — comportamiento ya
  heredado, no nuevo.

### Approaches posibles

**Approach A: cambio acotado a nombres de aplicación (lectura literal)**
- Agregar `font-family: sans-serif` (o la fuente del sistema) como override local en
  `.app-name`/`.app-name-input` de `AppRow.vue`.
- **Pros**: ajustado al texto exacto del ticket.
- **Contras**: deja una mezcla de dos tipografías visibles en la misma ventana (título
  decorativo, nombres de app en fuente normal) — puede no ser la experiencia visual que el
  usuario espera al pedir "que se pueda ver bien".
- **Esfuerzo**: XS.

**Approach B: cambio global de la ventana del cronómetro**
- Quitar `font-family: "Architects Daughter", cursive` de `App.vue` (`html, body`, `#app`),
  reemplazándola por `sans-serif` (o la fuente nativa del SO) para toda la ventana.
- **Pros**: resuelve la legibilidad de raíz, consistente en toda la interfaz; no requiere tocar
  archivo por archivo.
- **Contras**: cambia el aspecto visual de elementos que el ticket no menciona explícitamente
  (título "Work", Pomodoro) — requiere confirmación del usuario si el pedido era acotado.
- **Esfuerzo**: XS-S (incluye limpiar el `@import` si `Russo One` no se usa en otro lado —
  verificar antes de retirarlo).

**Approach C: A o B + alinear `UsageChart.vue` con `sans-serif`**
- Independiente de la decisión (a)/(b), dejar de fijar `Architects Daughter` en
  `ChartJS.defaults.font.family`, coherente con que `HistoryView.vue` ya usa `sans-serif` —
  resuelve la inconsistencia que el propio ADR-0010 señala como trade-off vigente.
- **Esfuerzo adicional**: XS.

### Recomendación

**Ambigüedad para HITL explícito en `sdd-propose`**: alcance global (B) vs. acotado a nombres
de aplicación (A). Independientemente de esa decisión, el complemento C (alinear el gráfico con
`sans-serif`) es de bajo riesgo y recomendable en ambos casos.

---

## Ítem 5 — Horas de sesión sin segundos

### Estado actual

El único lugar que muestra el rango horario de una sesión (inicio–fin) es
`BySessionView.vue::formatRange`, que llama dos veces a `formatTimeHHMMSS` y une el resultado
con un guion largo: `HH:MM:SS–HH:MM:SS`
[fuente: código `src/history/BySessionView.vue:52-54`]. `formatTimeHHMMSS` es una función pura
en `src/utils/time-format.js:21-26` sin otros consumidores — verificado por búsqueda exhaustiva
en `src/`: es el único punto de formateo de hora de reloj de todo el proyecto.

**Distinción importante**: `msToHHMMSS` (usada en `AppRow.vue` para el reloj en vivo de una
fila, en `ByAppView.vue` para el total por app, y en `UsageChart.vue` para ejes/tooltip) formatea
una **duración transcurrida**, no una hora de reloj — es una función distinta. El ticket dice
"las horas de las SESIONES", que léxicamente apunta al rango horario de inicio/fin
(`formatTimeHHMMSS`/`formatRange`), no al contador de tiempo acumulado. No hay otro lugar en el
código que muestre `sessionStartedAt`/`startedAt`/`endedAt` como hora de reloj — verificado por
grep.

### Archivos afectados

| Archivo | Rol | Impacto |
|---|---|---|
| `src/utils/time-format.js` | Define `formatTimeHHMMSS` | Cambiar a `HH:MM` (quitar segundos) |
| `src/history/BySessionView.vue` | Único llamador de `formatTimeHHMMSS` (vía `formatRange`) | Sin cambio de lógica propia, solo se beneficia del cambio en la función |

### Dependencias y restricciones

Ninguna — cambio puro y aislado, sin ADRs que lo condicionen. Se relaciona con el ítem 6
(formato AM/PM vs 24h) porque ambos tocan el mismo punto de formateo de hora de reloj: conviene
resolverlos en el mismo cambio de `time-format.js` para no iterar dos veces sobre el mismo
archivo y la misma función.

### Approaches posibles

**Approach A: modificar `formatTimeHHMMSS` in-place**
- Quitar el tercer segmento (segundos) del resultado.
- **Contras**: el nombre de la función deja de describir lo que devuelve.
- **Esfuerzo**: XS.

**Approach B: reemplazar por una función nueva (`formatTimeHHMM` o equivalente)**
- Agregar la función nueva, actualizar el único llamador, y evaluar si conviene retirar
  `formatTimeHHMMSS` si queda sin usos.
- **Pros**: nombre coherente con el output; sienta la base natural para absorber también la
  preferencia AM/PM del ítem 6 en la misma función.
- **Esfuerzo**: XS.

### Recomendación

**Approach recomendado**: B, diseñado junto con el ítem 6 en el mismo punto de cambio de
`time-format.js`.

---

## Ítem 6 — Preferencia de formato de hora (AM/PM vs 24h)

### Estado actual

Existe ya un mecanismo de settings persistente completo y genérico, reutilizable sin cambios de
patrón:

- **Persistencia**: `settings.json` bajo `userData`, vía IPC `get-settings`/`save-settings`,
  con un `defaultSettings = { masterVolume: 1, interactionVolume: 1 }` en el main
  [fuente: código `src/main/ipc-handlers.js:14-18,59-63`].
- **Estado del renderer**: `useSettingsStore` (Pinia) hoy solo conoce `masterVolume` e
  `interactionVolume`, con acciones `load()`/`setMaster()`/`setInteraction()` que llaman a
  `ipcRenderer.invoke('get-settings')`/`ipcRenderer.send('save-settings', …)`
  [fuente: código `src/stores/settings.js`].
- **UI de configuración**: `OpcionesPanel.vue` solo expone dos controles de volumen (rango
  0-1); no existe ningún control de formato de hora [fuente: código
  `src/components/OpcionesPanel.vue`].

ADR-0006 es la decisión vigente que rige `settings.json` (persistencia JSON por concepto,
main-only, IPC `invoke`/`send`) — agregar una preferencia nueva es una extensión directa de un
patrón ya probado, no un mecanismo nuevo que requiera ADR propio.

**Alcance real de "que funcione en la app"**: el único lugar donde se muestra hoy una hora de
reloj (no una duración) es `BySessionView.vue::formatRange`, verificado en el ítem 5 por grep
exhaustivo. La preferencia solo tiene, hoy, un consumidor real.

### Archivos afectados

| Archivo | Rol | Impacto |
|---|---|---|
| `src/main/ipc-handlers.js` | `defaultSettings` | Agregar el campo nuevo (ej. `timeFormat: '24h'`) con su default |
| `src/stores/settings.js` | Store Pinia de settings | Agregar estado + acción `setTimeFormat` |
| `src/components/OpcionesPanel.vue` | UI de configuración | Agregar el control (ej. select o radio 12h/24h) |
| `src/utils/time-format.js` | Formateo de hora de reloj | La función debe aceptar el modo elegido como parámetro (ver ítem 5) |
| `src/history/BySessionView.vue` | Único consumidor de hora de reloj hoy | Leer la preferencia del store y pasarla a la función de formateo |

### Dependencias y restricciones

- ADR-0006 fija el patrón de persistencia — seguirlo sin desviarse (extender `settings.json`,
  no crear un archivo nuevo).
- El main process no necesita saber nada de formato de horas: solo persiste/devuelve el JSON
  tal cual, igual que hoy con volumen — la lógica de formateo vive enteramente en el renderer.
- `src/utils/time-format.js` es deliberadamente un módulo puro sin dependencias de Electron ni
  de Pinia, verificable con `node -e` sin pasar por webpack/Babel — así lo declara su propio
  comentario de cabecera. La función de formateo debe seguir recibiendo el modo como parámetro
  explícito, no leyendo el store internamente, para no romper esa propiedad.
- SSOT a futuro: si se agregan más vistas de hora de reloj más adelante, deberían pasar por la
  misma función centralizada para que la preferencia se aplique de forma consistente — hoy solo
  hay un consumidor, así que no hay riesgo de divergencia todavía.

### Approaches posibles

**Approach A: función pura con el formato como parámetro explícito**
- `formatTimeHHMM(dateObj, format)` con `format: '24h' | '12h'`, sin leer el store
  internamente. `BySessionView.vue` lee `useSettingsStore().timeFormat` (vía `load()` ya
  existente, o una nueva propiedad reactiva) y lo pasa como argumento.
- **Pros**: mantiene `time-format.js` puro y testeable sin webpack/Babel, seguridad total
  contra acoplar un módulo de utilidad a un store de UI.
- **Esfuerzo**: S.

**Approach B: la función importa el store Pinia directamente**
- Rompe la pureza declarada de `time-format.js` y contradice el patrón ya establecido para ese
  módulo (mismo criterio que ya se sigue para `msToHHMMSS`/`formatDateYYYYMMDD`).
- **Descartado** por inconsistencia con la convención existente del archivo (KISS/DRY: no vale
  la pena inventar una excepción para este caso).

### Recomendación

**Approach recomendado**: A. Extiende `settings.json`/`useSettingsStore` siguiendo el patrón ya
vigente (ADR-0006) y mantiene `time-format.js` puro, coherente con su convención de módulo
declarada en su propio comentario de cabecera.

---

## Ítem 7 — Gráficos más blancos

### Estado actual

La paleta actual del gráfico de historial es oscura/gris: `ChartJS.defaults.color = '#f0f0f0'`
(texto/ticks) y barras en `backgroundColor: '#6f6f6f'` (gris medio)
[fuente: código `src/history/UsageChart.vue:28,56`], sobre un fondo de ventana `#1b1b1b`
(casi negro) fijado en `HistoryView.vue`/`history.html`/`background.js`
[fuente: spec [[dark-loading-state]]]. El resto de la paleta oscura del historial (calendario,
tablas) también usa grises oscuros (`#2a2a2a`, `#1b1b1b`, `#333`)
[fuente: código `src/history/HistoryView.vue`, `src/history/ByAppView.vue`].

### Archivos afectados

| Archivo | Rol | Impacto |
|---|---|---|
| `src/history/UsageChart.vue` | `backgroundColor` de las barras, `ChartJS.defaults.color` | Candidato principal si el alcance es solo el gráfico |
| `src/history/ByAppView.vue`, `src/history/BySessionView.vue`, `src/history/HistoryView.vue` | Colores de tabla/timeline/fondo/calendario | Candidatos solo si el alcance se extiende a toda la ventana de historial |

### Dependencias y restricciones

`dark-loading-state` (spec vigente) exige que el fondo de la VENTANA se mantenga oscuro desde
el primer instante en que se abre — *"El sistema SHALL NOT mostrar ningún destello de color
claro entre la apertura de la ventana de historial y la aparición de su contenido"*
[fuente: spec [[dark-loading-state]]]. Un cambio de paleta que aclare el FONDO de la ventana
(no solo las barras) entra en conflicto directo con esa spec y requeriría revisarla
explícitamente, no solo tocar CSS.

### Approaches posibles

**Approach A: acotado a las barras del gráfico**
- Subir el brillo de `backgroundColor` (de `#6f6f6f` a un gris más claro o casi blanco, con
  contraste suficiente sobre el fondo oscuro) y ajustar `ChartJS.defaults.color` si hiciera
  falta más contraste de texto.
- **Pros**: mantiene el fondo oscuro de la ventana intacto — compatible sin fricción con
  `dark-loading-state`.
- **Esfuerzo**: XS.

**Approach B: tema completo más claro del historial**
- Aclarar fondo, calendario y tablas además del gráfico.
- **Contras**: requiere reabrir `dark-loading-state` como spec (evaluar si sigue vigente o si
  necesita un delta) y toca más archivos.
- **Esfuerzo**: M-L, con riesgo directo de contradecir una spec vigente.

### Recomendación

**Approach recomendado**: A, como interpretación más económica y la única compatible sin
fricción con `dark-loading-state`. Si el usuario efectivamente quiere un tema claro completo del
historial (no solo las barras), es una ambigüedad adicional real a confirmar en `sdd-propose`
antes de tocar `dark-loading-state`.

---

## Archivos Afectados (consolidado, todos los ítems)

| Archivo | Ítems que lo tocan | Rol |
|---|---|---|
| `src/components/CronometroAplicacion.vue` | 1 | Estado y template de grupos por arrastre |
| `src/App.vue` | 4 | Tipografía global de la ventana del cronómetro |
| `src/components/AppRow.vue` | 4 (approach acotado) | Nombres de aplicación en filas |
| `src/components/CronometroPomodoro.vue` | 4 | `.edit-input` con fuente decorativa |
| `src/history/UsageChart.vue` | 2, 3 (si aplica), 4, 7 | Configuración del gráfico chart.js: escalas, colores, fuente |
| `src/utils/session-aggregate.js` | 3 (si aplica) | Clave de agrupación por aplicación |
| `src/utils/time-format.js` | 5, 6 | Formateo de hora de reloj (sesiones) |
| `src/history/BySessionView.vue` | 5, 6 | Único consumidor de hora de reloj |
| `src/main/ipc-handlers.js` | 6 | `defaultSettings` de `settings.json` |
| `src/stores/settings.js` | 6 | Store Pinia de preferencias |
| `src/components/OpcionesPanel.vue` | 6 | UI de configuración |
| `src/history/HistoryView.vue`, `src/history/ByAppView.vue` | 7 (si el alcance se extiende) | Paleta general del historial |

Ningún ítem requiere tocar `src/main/monitor-engine.js`, `src/main/session-log.js` ni
`src/stores/monitoredApps.js` — el modelo de datos y persistencia ya soportan lo que los siete
ítems piden (grupos múltiples, `groupId`/`groupName`/`sessionName` por entrada, `settings.json`
extensible).

## Riesgos Identificados

- **Ítem 1**: la interacción para crear "el segundo grupo" no está definida por ninguna spec
  vigente — requiere diseño explícito de UX en `sdd-propose`/`sdd-design`, no es un simple
  levantamiento del límite de 1.
- **Ítem 2**: dos lecturas posibles de "las horas" (eje del gráfico vs. columnas de las listas)
  con implicancias distintas sobre una spec vigente (`usage-chart-by-interval`) — HITL
  recomendado aunque no fue una de las dos ambigüedades señaladas explícitamente.
- **Ítem 3**: cambiar la clave de agrupación sin verificar antes contra datos reales arriesga
  revertir el fix F1 ya validado (`usage-chart-by-interval`), que corrige exactamente el
  problema inverso (fusión indebida de programas distintos).
- **Ítem 4**: ambigüedad de alcance (global vs. acotado a nombres de app) señalada
  explícitamente por el orquestador — HITL obligatorio en `sdd-propose`.
- **Ítem 7**: si el usuario espera un tema claro completo del historial y no solo las barras
  del gráfico, colisiona directamente con `dark-loading-state` (spec vigente) — HITL
  recomendado antes de decidir el alcance.
- **Transversal**: los ítems 5 y 6 comparten el mismo punto de cambio (`time-format.js`,
  `formatTimeHHMMSS`/su reemplazo) — conviene que `sdd-design`/`sdd-tasks` los trate como una
  sola unidad de trabajo para no iterar dos veces sobre la misma función.
- **Verificación visual**: ningún approach de este documento fue verificado contra la UI real
  corriendo (el intento de captura en Windows no llegó a mostrar la ventana de la app — ver
  nota al inicio). Los approaches de los ítems 2, 4 y 7 (los más visuales) deberían confirmarse
  con una captura real antes de cerrar `sdd-design`, si el entorno lo permite en una fase
  posterior.
