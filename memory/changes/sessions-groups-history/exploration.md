# Exploración: sessions-groups-history

## Estado Actual (general)

El cambio anterior (`app-detection-logos-audio`) entregó un motor de monitoreo
multi-app modularizado en `src/main/` (D10/ADR-0004), con selección guardada
persistida en `monitored-selection.json`, íconos automáticos en gris, y un selector
de instaladas de dos vías. Este cambio extiende esa base en 9 frentes independientes
entre sí en el código (tocan módulos distintos), pero con una dependencia de diseño
fuerte entre los puntos 1, 2 y 3 (todos pasan por `monitor-engine.js` y el shape de
`selection`/`rows`).

## Archivos Afectados

| Archivo | Rol | Impacto |
|---|---|---|
| `src/components/AppSelectorModal.vue` | Modal de selección (instaladas + procesos abiertos) | P1 (deselección), P2 (tipo de selección al agregar), P9 (íconos) |
| `src/main/monitor-engine.js` | Motor de monitoreo, `selection`/`rows` en memoria, persistencia de selección | P2 (tipo manual/auto), P3 (nombre de sesión) |
| `src/main/ipc-handlers.js` | Canales IPC | P1 (ya expone `remove-from-selection`, sin cambios necesarios) |
| `src/stores/monitoredApps.js` | Store espejo del snapshot | P1 (ya expone `removeApp`, sin cambios necesarios) |
| `src/main/session-log.js` | Construcción y append de línea de `usage-log.txt` | P3 (nombre de sesión), P4 (grupo) |
| `src/background.js` | Handler `get-app-logs` (parseo de `usage-log.txt` con regex) | P3, P4, P5 (el parser vive acá, no en `session-log.js`) |
| `src/history/HistoryView.vue` | Vista de historial (ventana separada) | P5 (dos vistas), P6 (gráfico) |
| `src/main/platform-windows.js` | Único módulo con PowerShell/tasklist | P7 (encoding), P8 (fuente de datos del filtro) |
| `src/main/installed-apps.js` | Orquestación de caché de instaladas | P7 (invalidación de caché corrupta) |
| `src/main/installed-apps-filter.js` | Filtro puro de instaladas | P8 (fuga de `.chm`/`.html`) |
| `src/main/icon-cache.js` | Caché de íconos de dos niveles | P9 (costo de 106 extracciones) |
| `src/components/Menu.vue`, `src/components/CronometroPomodoro.vue` | Usos existentes de `vuedraggable` | P4 (precedente de drag & drop, ninguno reutilizable directo) |
| `package.json` | Dependencias | P4 (confirma `@shopify/draggable`/`fluid-dnd` muertas), P6 (candidata de chart lib) |
| `vue.config.js` | Config de Vue CLI, multi-page (`index`, `history`) | P6 (el bundle de historial es independiente del de index) |

---

## Punto 1 — Deselección de aplicaciones

**Estado actual** `[fuente: código]`

El IPC y el motor **ya soportan deselección completa**: `ipc-handlers.js:27-30`
registra `remove-from-selection`, que llama a `monitorEngine.removeFromSelection`
(`monitor-engine.js:378-388`) — quita la entrada de `selection`, la persiste, cierra
la fila si tenía una (con `closeRow`, registrando la sesión) y detiene el motor si la
selección queda vacía. El store `monitoredApps.js:31-34` ya expone la acción
`removeApp(appId)` que invoca ese canal.

Lo que falta es exclusivamente el gesto de UI: `AppSelectorModal.vue` (`choose()`,
líneas 120-127) solo llama `addApp`, y **corta con `return` si `isSelected(appEntry.appId)`
es true** (línea 121: `if (this.monitoredApps.limitReached || this.isSelected(...)) return`).
El checkmark (línea 35) se muestra pero clickear una fila ya marcada no dispara nada —
ni agrega ni quita. No hay ningún control de "quitar" separado en el modal, ni en
`AppRow.vue` (el botón ■ de una fila detiene/cierra, no deselecciona: ver `row-lifecycle`).

**Approaches**

- **A. Alternar en `choose()`**: si `isSelected` es true, llamar `removeApp(appId)` en
  vez de retornar. Sin cambios de IPC ni de store. **Esfuerzo: XS.**
- **B. Alternar + confirmación**: igual que A, pero con un diálogo de confirmación si la
  app tiene fila activa (evita cortar una sesión en curso sin querer). **Esfuerzo: S.**

**Recomendación**: A. El IPC ya devuelve el snapshot actualizado y `removeFromSelection`
ya maneja el caso de fila activa (la cierra y registra la sesión, mismo camino que ■).
No hay pérdida de datos que justifique una confirmación adicional (consistente con
`row-lifecycle`, donde cerrar/detener ya es una acción sin confirmación).

---

## Punto 2 — Dos tipos de selección (manual/transitoria vs automática/persistente)

**Estado actual** `[fuente: código + spec [[row-lifecycle]]]`

Hoy **toda** adición es persistente: `addToSelection` (`monitor-engine.js:348-373`)
siempre empuja a `selection` y siempre escribe `monitored-selection.json`
(línea 353), sin distinción de origen (tab "instaladas" vs "procesos abiertos" en
`AppSelectorModal.vue` — ambos llaman `monitoredApps.addApp`). No existe ningún campo
de tipo en la entrada de `selection` ni en la fila de `rows`.

La semántica que cambia con "manual" es la de **salida**, no la de entrada:
`row-lifecycle` fija que ■ y cierre de proceso sacan la fila del listado visible pero
**conservan la selección guardada** (`closeRow`, `monitor-engine.js:286-295`, nunca toca
`selection`; el cierre por proceso muerto dentro de `tick()` tampoco — `reduceLifecycle`
línea 60-67 solo filtra `rows`). Para una entrada "manual", el intent pide lo contrario:
que esos dos eventos también la saquen de `selection`, para que no reaparezca sola la
próxima vez que el programa abra.

Puntos de código concretos que un tipo "manual" tendría que tocar:
- `addToSelection` (línea 348): necesitaría aceptar y persistir un campo de tipo.
- `closeRow` (línea 286) y el filtro de baja por proceso muerto dentro de `tick()`
  (línea 60-67, vía `reduceLifecycle`): para una fila de tipo manual, además de sacarla
  de `rows`, habría que sacarla de `selection` (y re-escribir o simplemente no
  persistirla si nunca se persistió — ver alternativas).
- `reduceLifecycle`, alta por selección (línea 85-105): ya asume que todo lo que está
  en `selection` puede generar fila de nuevo; una entrada manual que sigue en memoria
  después de un ciclo normal necesitaría no re-entrar salvo que sea reabierta antes de
  que se le remueva de `selection` (condición de carrera a resolver en diseño).

**Approaches**

- **A. Campo `type` en la entrada de selección** (`'manual' | 'auto'`), persistido igual
  para ambos tipos en `monitored-selection.json`. Al cerrar una fila de tipo manual (■ o
  proceso muerto), además de sacarla de `rows` se llama `removeFromSelection` sobre la
  misma entrada. Reutiliza toda la infraestructura existente sin bifurcar el archivo de
  persistencia. **Esfuerzo: S-M.**
- **B. Selección manual nunca toca disco**: las entradas manuales viven solo en el
  arreglo `selection` en memoria (nunca se escriben a `monitored-selection.json`), y al
  reiniciar la app desaparecen solas (lo cual además resuelve "no reaparece" de forma
  más fuerte: ni siquiera dentro de la misma sesión de la app, tras un reinicio).
  Requiere separar `selection` en dos arreglos o añadir el mismo campo `type` pero
  filtrando antes de `jsonStore.writeJson`. **Esfuerzo: S-M** (similar a A, difiere en
  el criterio de escritura).
- **C. UI para elegir el tipo al agregar**: cualquiera de A/B necesita que
  `AppSelectorModal.vue` decida qué tipo pasar en `choose()`/`chooseOpenWindow()` — un
  toggle, un botón secundario por entrada, o mapear la pestaña ("instaladas" = auto,
  "procesos abiertos" = manual) son variantes de UI a decidir en `sdd-design`, no de
  esta exploración.

**Recomendación**: A, con la persistencia de `monitored-selection.json` incluyendo
`type` en cada entrada (retrocompatible: entradas sin `type` se tratan como `'auto'`).
B agrega una asimetría de persistencia (dos rutas de escritura) sin necesidad real: el
requisito es "no reaparece tras cerrar/detener", no "no sobrevive un reinicio de la
app mientras sigue corriendo" — A ya cumple el requisito manteniendo un solo archivo y
un solo camino de escritura (DRY/KISS).

**Riesgo de diseño**: decidir en `sdd-design` el orden exacto de operaciones en
`closeRow`/`reduceLifecycle` para no dejar una ventana donde una fila manual recién
cerrada por proceso muerto todavía figure en `selection` cuando el mismo tick vuelve a
evaluar altas (podría re-crear la fila que se acaba de cerrar).

---

## Punto 3 — Sesiones con nombre

**Estado actual** `[fuente: código + spec [[session-log-persistence]]]`

El formato de `usage-log.txt` es texto plano, una línea por sesión, construida por
`buildSessionLine` (`session-log.js:12-23`):

```
[YYYY-MM-DD HH:MM:SS] Aplicación: <name> | Duración: <HH:MM:SS> | Inicio: <HH:MM:SS> | Fin: <HH:MM:SS>
```

y parseada con una regex en `background.js:215` (`get-app-logs`, **no** en
`session-log.js`; la escritura y la lectura/parseo viven en módulos distintos, una
asimetría ya presente antes de este cambio). Confirmado con datos reales de
`usage-log.txt` del userData (3320 bytes, líneas desde 2025-04 hasta 2026-08-02 hoy),
formato estable, sin caracteres `|` en los nombres de programa observados (Brave,
Firefox, Google Chrome, Visual Studio Code) que rompan la regex.

Agregar un nombre de sesión exige tocar dos lugares acoplados por el mismo formato:
`buildSessionLine` (agregar un campo) y la regex de `background.js:215` (agregar un
grupo de captura). El feed de dónde saldría el nombre: no hay ningún input de texto
hoy en el flujo de agregar/iniciar una fila (`AppSelectorModal.vue` no tiene campo de
texto salvo el buscador).

**Approaches**

- **A. Extender la línea de texto plano** con un campo más:
  `... | Fin: <HH:MM:SS> | Sesión: <nombre o vacío>`. Mínimo cambio de forma, pero cada
  consumidor de la regex debe migrar. Un nombre de sesión que contenga `|` rompe el
  parseo (mismo riesgo que ya declara ADR-0006 para nombres de programa). **Esfuerzo: S.**
- **B. Migrar el registro de sesiones a JSON**, con precedente directo en el propio
  repo: `pomodoro-sessions.json` ya prueba el patrón (`jsonStore`, o el ad-hoc de
  `background.js:225-257`). Cada entrada sería un objeto
  `{ date, app, duration, start, end, sessionName, groupId? }`, extensible sin tocar
  una regex — y ya resuelve de paso el mismo problema para el punto 4 (grupo). Requiere
  decidir si migra el historial existente (`usage-log.txt` ya tiene datos reales de uso
  desde 2025-04) o si conviven ambos formatos (log viejo de solo lectura + log nuevo).
  **Esfuerzo: M** (toca escritura en `session-log.js`, lectura en `background.js` o
  movida a un módulo propio, y el parser de `HistoryView.vue`).
- **C. JSON solo para sesiones nuevas, log de texto se congela**: variante de B que
  declara `usage-log.txt` legado (se sigue leyendo para historial pre-cambio) y todo
  registro nuevo va a un `sessions.json`. Evita migración de datos pero deja dos
  fuentes que `HistoryView.vue` debe fusionar. **Esfuerzo: M**, con mayor complejidad
  de lectura que B a cambio de no migrar datos.

**Recomendación**: B. El propio ADR-0006 ya señala `usage-log.txt` como fragilidad
aceptada "por decisión explícita de alcance" del cambio anterior — este cambio sí
necesita campos estructurados nuevos (nombre de sesión, y en el punto 4 un `groupId`),
que es exactamente el caso que vuelve rentable dejar el texto plano. `sdd-design`
deberá decidor si migra `usage-log.txt` a JSON en un paso de arranque (léelo una vez,
conviértelo, listo) o si lo deja como archivo legado de solo lectura — es una decisión
de diseño, no de esta exploración.

---

## Punto 4 — Grupos de sesión con drag & drop

**Estado actual** `[fuente: código]`

Confirmado con `grep -rn "draggable\|fluid-dnd\|@shopify"`: `vuedraggable` (paquete
real, no confundir con la palabra "draggable" en nombres de clase CSS) se usa en dos
componentes — `Menu.vue:22-37` (reordenar los widgets M/A/P aplicados) y
`CronometroPomodoro.vue:6-25` (reordenar los tramos de tiempo del Pomodoro). Ambos usos
son de **reordenamiento dentro de una sola lista** (`v-model` + `item-key`), no de
**mover un ítem entre dos contenedores** (que es lo que pide "arrastrar aplicaciones a
un grupo, no necesariamente todas") — `vuedraggable` sí soporta grupos cross-list
(prop `group`), pero no hay precedente de esa forma de uso en el repo; sería la primera
vez.

`@shopify/draggable` y `fluid-dnd` (`package.json:25,29`) no tienen ninguna referencia
en `src/` (confirmado por el mismo grep) — dependencias muertas, tal como ya señalaba
`_profile.md`. `fluid-dnd` además apunta a un `.tgz` local fuera del repo
(`file:../draggapleFluid/...`), un riesgo de reproducibilidad que ya estaba
registrado.

No existe hoy ningún concepto de "grupo" en `monitor-engine.js`: `rows` es un arreglo
plano sin agrupación ni `groupId`.

**Approaches**

- **A. Reutilizar `vuedraggable` con `group`**: agregar un `groupId: null | string` a
  cada fila (`monitor-engine.js`, `getSnapshot()` línea 298-316) y usar dos (o N)
  instancias de `<draggable>` con la misma prop `group` para permitir mover filas entre
  el listado suelto y un contenedor de grupo. Consistente con la convención ya
  establecida en el repo (mismo paquete, mismo patrón `v-model`+`item-key`).
  **Esfuerzo: M** (la lógica de agrupar es nueva, pero la librería y su integración con
  Vue 3 ya están probadas en el propio código).
- **B. Implementar drag & drop nativo (HTML5 Drag and Drop API)** sin librería: cero
  dependencias nuevas, pero hay que resolver a mano ghost image, zonas de drop y
  feedback visual — terreno que `vuedraggable` (que envuelve SortableJS) ya cubre.
  **Esfuerzo: L**, sin beneficio claro sobre A.
- **C. Revivir `@shopify/draggable` o `fluid-dnd`**: descartado — son dependencias
  muertas por decisión ya tomada (una de ellas ni siquiera resuelve de forma
  reproducible), reintroducirlas iría contra DRY (ya hay una librería de drag activa
  y en uso).

**Recomendación**: A. Es la opción que respeta YAGNI/DRY: el proyecto ya trajo
`vuedraggable` para exactamente este propósito (arrastrar y reordenar), y usar el
mismo paquete con su prop `group` es la extensión mínima sobre un patrón ya validado
en dos componentes, en vez de sumar código de gestos táctiles/mouse a mano.

**Riesgo**: `vuedraggable` v4 envuelve SortableJS 1.x — verificar en `sdd-design` que
la prop `group` con `pull`/`put` configurables cubre el caso "no necesariamente todas"
(mover una fila individual sin arrastrar el grupo completo), que es el comportamiento
por defecto de SortableJS al usar grupos con el mismo `name`.

---

## Punto 5 — Historial con dos vistas y desglose por sesión

**Estado actual** `[fuente: código]`

`HistoryView.vue` (245 líneas, exploración completa por primera vez) es una vista
Vue montada en una `BrowserWindow` separada (`background.js:180-204`,
`vue.config.js` la registra como página `history` con entry propio). Flujo actual:

1. `mounted()` → `loadLogs()` (línea 63): pide `get-app-logs` (el handler de
   `background.js:208-223` que parsea `usage-log.txt` completo, sin filtrar por rango).
2. Arma `datesWithLogs` (línea 67-68) para pintar puntos en un `<v-calendar>`
   (`is-expanded`, `max-date="new Date()"`, línea 7-13) — un calendario mensual con
   highlight en los días que tienen alguna entrada.
3. Al hacer click en un día (`handleDateClick`, línea 117-120) o al cargar
   (`loadLogsForDate`, línea 80-98): filtra las entradas de esa fecha exacta, **agrupa
   por nombre de programa y suma duraciones** (líneas 84-97) — pierde el desglose por
   sesión individual (hora de inicio/fin de cada tramo) que sí existe en el dato crudo
   (`log.startTime`, `log.endTime` vienen del parseo pero no se usan en esta vista).
4. Renderiza una tabla plana `<table class="log-table">` con dos columnas: tiempo
   total y app, una fila por programa del día (línea 15-28).

Es decir: **hoy solo existe la vista "por aplicación/día"**, y aun esa descarta el
desglose por tramo (varias entradas del mismo programa en el mismo día se colapsan en
una suma). No hay ninguna vista "por sesión" ni ningún concepto de grupo mostrado.

**Approaches**

- **A. Agregar una segunda vista (tab o toggle) "por sesión"** que renderice
  `todaysLogs` (el filtrado por fecha de la línea 82, antes de agrupar) tal cual,
  mostrando cada entrada individual con su rango horario — sin tocar la vista actual.
  Requiere el nombre de sesión/grupo del punto 3/4 para que la vista tenga algo más que
  mostrar que el propio log ya no tiene (`log.app`, `log.duration`,
  `log.startTime`/`endTime` ya están disponibles). **Esfuerzo: S**, una vez resuelto el
  formato de persistencia del punto 3.
- **B. Reestructurar `HistoryView.vue` en dos componentes** (`ByDayView`,
  `BySessionView`) montados bajo el mismo `TitleBar`, en vez de si-else dentro del
  mismo archivo. Más limpio a largo plazo, mismo esfuerzo funcional que A más el costo
  de separar el componente. **Esfuerzo: S-M.**

**Recomendación**: A como base funcional; delegar a `sdd-design` si conviene B por
tamaño del archivo resultante (245 líneas ya, agregar una vista completa dentro del
mismo archivo puede justificar el split).

---

## Punto 6 — Gráfico de uso

**Estado actual** `[fuente: código + package.json]`

Confirmado: no hay ninguna librería de gráficos en `package.json` (dependencies
completas revisadas) ni ningún uso de `<canvas>`/SVG de datos en `src/`. `HistoryView.vue`
es 100% tabla y calendario.

Dato relevante para el costo: `vue.config.js` define `history` como página
**independiente** de `index` (entries separados, `src/main.js` vs `src/history/main.js`)
— cualquier librería de gráficos que se sume solo pesa en el bundle de la ventana de
historial, nunca en el bundle principal de la ventana de cronómetro.

**Approaches**

- **A. `chart.js` + `vue-chartjs`**: `vue-chartjs` 5.x soporta Vue 3 y Chart.js 4.x.
  API declarativa (`<Bar>`, `<Line>`), maneja responsive y tooltips sin código propio.
  Peso: ~200KB combinado (Chart.js ~170KB min, vue-chartjs es un wrapper delgado) — sin
  impacto en el bundle de `index` por el punto anterior. **Esfuerzo: S-M** para un
  gráfico simple de barras (uso por día o por app).
- **B. SVG a mano**: cero dependencias, control total, pero hay que resolver escalas,
  ejes y tooltips desde cero — sobre-ingeniería para "un gráfico" cuando el proyecto no
  tiene ya una librería de charts de la que reutilizar valor (a diferencia del drag,
  donde sí existe precedente con `vuedraggable`). **Esfuerzo: M-L** por el trabajo de
  ejes/escalas/interacción que una librería da gratis.
- **C. `frappe-charts` o `uPlot`**: alternativas más livianas que Chart.js (uPlot ronda
  40KB). Viables, pero sin ningún precedente ni necesidad de performance extrema (un
  gráfico por ventana de historial, no un dashboard en tiempo real) que justifique el
  API más bajo nivel de uPlot frente a la ergonomía de Chart.js/vue-chartjs.

**Recomendación**: A. Es la opción KISS para el alcance descrito ("un gráfico"): la
ergonomía de `vue-chartjs` con componentes Vue nativos encaja con el resto del stack
(Vue 3 SFCs), y el costo de bundle es irrelevante por estar aislado en la página de
historial. `sdd-design` define qué mide el gráfico (uso por día, por app, o por grupo)
una vez resuelto el formato de datos del punto 3/5.

---

## Punto 7 — Fix de encoding del puente PowerShell

**Estado actual, verificado empíricamente vía interop** `[fuente: código + interop Windows real]`

Confirmadas **2 invocaciones PowerShell** en `platform-windows.js` (no 3 — el `grep`
de todo el árbol solo encuentra estas dos, coincide con lo que ya señalaba `_profile.md`):

- `listOpenWindows()`, línea 99: `powershell -Command "Get-Process | ..."`.
- `listInstalledCandidates()`, línea 157: `powershell -NoProfile -Command "..."`
  (`buildInstalledAppsScript()`, líneas 127-152).

Ninguna de las dos fija `OutputEncoding`. Reproducido el bug real vía interop:

```
$ powershell.exe -NoProfile -Command 'Get-Item "C:\Program Files\cronometro-apps\Cron*.exe" | Select-Object -ExpandProperty Name'
Cronómetro App.exe          # se ve bien en la terminal (decodificación del propio WSL)

$ ... | hexdump -C          # sin fix
43 72 6f 6e a2 6d 65 74 72 6f 20 41 70 70 2e 65 78 65   → 0xa2 = 'ó' en CP-850

$ [Console]::OutputEncoding = [Text.Encoding]::UTF8; ... | hexdump -C   # con fix
43 72 6f 6e c3 b3 6d 65 74 72 6f 20 41 70 70 2e 65 78 65  → c3 b3 = 'ó' en UTF-8
```

Confirma exactamente el diagnóstico del intent: sin el fix, Node decodifica el byte
`0xa2` (CP-850) como si fuera UTF-8 de un solo byte, produciendo el carácter de
reemplazo. Confirmado también en el dato real de producción:
`installed-apps-cache.json` (userData real, 106 entradas) contiene
`"name": "Cron�metro App"` y `"name": "Navegaci�n privada con Firefox"` (Firefox
Private Browsing), ambos con el mismo patrón de corrupción — y el `exePath` corrupto
correspondiente (`C:\Program Files\cronometro-apps\Cron�metro App.exe`) no existe en
disco tal cual, por lo que `getExecutableIcon` (`platform-windows.js:177-185`) falla
silenciosamente (catch que devuelve `null`) y cae al ícono de respaldo — confirma
también el efecto secundario que describe el intent.

**Invalidación de caché corrupta**: `installed-apps.js:58-68` (`getInstalledApps`) lee
`installed-apps-cache.json` con `jsonStore.readJson` y, **si hay caché, la devuelve
siempre de inmediato** sin mirar `cachedAt` como TTL — ese campo es puramente
informativo hoy, se guarda (`installed-apps.js:36`) pero nada lo compara contra una
fecha límite ni contra una versión de esquema. No hay ningún mecanismo de invalidación
por versión: una entrada corrupta persiste indefinidamente hasta que el usuario borra
el archivo a mano o hasta que la reenumeración en segundo plano (que sí dispara en cada
`getInstalledApps()`, línea 62/66) vuelve a fallar exactamente igual (mismo bug de
encoding, mismo resultado corrupto).

**Approaches**

- **A. Fijar `chcp 65001` o `[Console]::OutputEncoding = [Text.Encoding]::UTF8`** al
  inicio de cada script/comando PowerShell invocado, y decodificar el `stdout` de
  `exec()` como UTF-8 (ya es el default de Node, así que alcanza con el fix del lado
  PowerShell). Verificado que funciona vía interop real. **Esfuerzo: XS** — dos líneas,
  una por invocación.
- **B. Invalidar la caché corrupta con un campo de versión de esquema**: agregar
  `schemaVersion` (o similar) al objeto que escribe `installed-apps.js:37`
  (`{ apps, cachedAt, schemaVersion: N }`), y en `getInstalledApps()` tratar un
  `schemaVersion` ausente o desactualizado como caché inválida (fuerza reenumeración
  síncrona en vez de servir el dato corrupto). Necesario porque A por sí solo arregla
  la enumeración *futura*, pero dado que la reenumeración es asíncrona en segundo
  plano (empuja por `installed-apps-updated`), el usuario vería el dato corrupto en la
  primera apertura del selector tras actualizar la app, hasta que la revalidación en
  vuelo complete. **Esfuerzo: S.**
- **C. Borrar la caché en un paso de migración al arrancar** (un `if` en
  `background.js` o `installed-apps.js` que borra el archivo si existe y no tiene el
  campo nuevo): funcionalmente equivalente a B pero con un `fs.unlinkSync` en vez de un
  chequeo de versión — más frágil si se agregan más migraciones después.

**Recomendación**: A + B. A resuelve la causa raíz (sin él, cualquier invalidación de
caché solo hace que el usuario vuelva a ver datos corruptos en la próxima
reenumeración). B es necesario porque la caché existente en discos reales (confirmado:
el propio userData de este entorno la tiene corrupta ahora mismo) no se autorrepara con
solo arreglar la fuente — alguien ya tiene el archivo corrupto en disco.

---

## Punto 8 — Fugas del filtro de instaladas

**Estado actual, verificado con datos reales** `[fuente: código + userData real]`

`installed-apps-filter.js` (`shouldDiscard`, líneas 43-54) descarta por: `targetExists`
falso, `targetPath` ausente, patrones de ruta de sistema, carpeta de accesos directos
de sistema, patrones de nombre de ejecutable (`update`, `setup`, `install`, etc.),
`systemComponent`, `parentKeyName`, `releaseType`, y patrón `KB######`. **Ninguna regla
verifica que `targetPath` termine en `.exe`** — cualquier archivo que exista en disco
(`Test-Path` es true para cualquier tipo de archivo, no solo ejecutables) y no matchee
ninguno de los otros patrones pasa el filtro.

Confirmado contra `installed-apps-cache.json` real (106 entradas totales): **16 entradas
no terminan en `.exe`**, incluyendo exactamente las dos que señala el intent
(`7-Zip Help` → `7-zip.chm`, `Git Release Notes` → `ReleaseNotes.html`) más
`PuTTY Manual` (`.chm`), `PuTTY Web Site`/`Documentation`/`VideoLAN Website` (`.url`),
`Release Notes` de VLC (`.txt`), `Ayuda WinRAR` (`.chm`), dos entradas de WinRAR más
(`.txt`), `GameSir Connect` (`.ico`, un acceso directo a un ícono de instalador de
Microsoft, no a un programa), y `Python 3.12 Manuals` (`.html`). Todas tienen
`targetExists: true` (el archivo de ayuda/manual/atajo realmente existe) y ninguna
matchea los patrones de nombre de ejecutable (que buscan `update`/`setup`/etc., no
extensiones).

**Hallazgo adicional no listado en el intent**: 3 de esas 16 entradas están
**duplicadas exactas** en el JSON (`winrar.chm`, `Rar.txt`, `Novedades.txt` aparecen
dos veces cada una, con el mismo `appId`) — indicio de que el registro
(`HKLM` + `HKLM\WOW6432Node`, o el propio `$uninstallKeys` en
`buildInstalledAppsScript()`) devuelve el mismo programa más de una vez y no hay
deduplicación por `appId` antes de escribir la caché. No se pidió explorar esto, pero
es del mismo módulo y la misma spec (`installed-apps-listing-quality`) que este punto
evoluciona — dejarlo señalado para que `sdd-design`/`sdd-spec` decidan si entra en
alcance.

**Approaches**

- **A. Agregar el chequeo de extensión** (`.toLowerCase().endsWith('.exe')`) como una
  condición más en `shouldDiscard`. Cambio de una línea, función pura, se verifica con
  entradas fabricadas sin Windows (mismo patrón que ya usa el filtro). **Esfuerzo: XS.**
- **B. A + deduplicar por `appId`** antes de devolver el array en `filterInstalledApps`
  (o en `installed-apps.js` antes de escribir la caché) — resuelve también el hallazgo
  adicional de duplicados. **Esfuerzo: XS-S** adicional sobre A.

**Recomendación**: A es el fix mínimo y directo del punto 8 tal como está planteado en
el intent. B es una mejora de la misma calidad de listado (mismo criterio de
aceptación de `installed-apps-listing-quality`: "ninguna entrada... runtime,
actualizador, redistribuible") que cuesta casi nada agregar en el mismo lugar — se deja
como decisión de alcance para `sdd-propose`/`sdd-spec`, no autoincluida acá.

---

## Punto 9 — Ícono en el listado del selector

**Estado actual** `[fuente: código]`

`AppSelectorModal.vue` no muestra ícono alguno hoy — el `<li>` de cada entrada
(línea 29-37) solo tiene el checkmark y el nombre. La infraestructura de íconos
existe y es reutilizable: `ipc-handlers.js:36-38` expone `get-app-icon`, que llama
`iconCache.getIcon(exePath)`, y el store ya tiene el patrón (`ensureIcon`,
`monitoredApps.js:49-53`) que pide bajo demanda y cachea en un mapa local — ese mismo
patrón es trasladable al modal.

**Costo real estimado** (con datos de producción reales):

- El listado de instaladas real tiene **106 entradas** (`installed-apps-cache.json`).
- `app-icons-cache.json` real hoy solo tiene **3 íconos cacheados** (los 3 programas
  efectivamente monitoreados: Brave, Firefox, Chrome) — el selector nunca disparó
  `get-app-icon` para el resto, confirma que hoy el costo de íconos es proporcional a
  filas monitoreadas (máx. 4 por el límite), no al tamaño del listado de instaladas.
- Tamaño de un ícono ya cacheado: **~2000 caracteres de data URL en promedio** (706 a
  2738 observados). Extrapolando a 106 entradas: ~210KB de JSON si se cachearan todas
  de una vez.
- **Riesgo de diseño en `icon-cache.js`, no solo de volumen**: `persistToDisk`
  (líneas 41-50) encola escrituras completas del archivo — cada llamada hace
  `readJson` (parseo completo) + mutación + `writeJson` (serialización + escritura
  completa) del archivo entero, en cadena estricta vía `diskWriteQueue`. Si se abre el
  modal y se disparan 106 `getIcon()` casi simultáneos (mismo patrón que ya causa el
  comentario de "Vue dispara `ensureIcon` para cada fila en un `forEach` síncrono" que
  motivó ese mismo encolado, líneas 15-25), el costo total de I/O crece
  aproximadamente con el cuadrado de las entradas nuevas en esa apertura (cada
  escritura relee y reserializa un archivo que ya creció con las escrituras
  anteriores de la misma tanda) — no es un problema de la extracción del ícono en sí
  (`app.getFileIcon`, nativa, sin spawn), sino del patrón de persistencia.

**Approaches**

- **A. Pedir los 106 íconos al abrir el modal** (mismo patrón `ensureIcon` que
  `CronometroAplicacion.vue`, aplicado a `filteredInstalled`): más simple de
  implementar, pero hereda el costo cuadrático de `persistToDisk` descrito arriba en
  la primera apertura tras instalar/actualizar la app (después, todo sirve de la
  caché en disco y el costo cae a lectura). **Esfuerzo: S** de implementación, con un
  riesgo de UI-jank real en la primera apertura que `sdd-design` debe decidir si
  acepta o mitiga.
- **B. Lazy por viewport (IntersectionObserver o simplemente los primeros N visibles
  del `<ul>` con `overflow-y: auto`)**: pide íconos solo de las filas realmente
  renderizadas en el viewport del modal (300px de ancho, altura acotada por
  `max-height: 80%`), típicamente 8-12 filas visibles a la vez en vez de 106. Reduce
  el costo de la primera apertura de forma proporcional al viewport, no al tamaño del
  listado. **Esfuerzo: M** (requiere observar scroll/intersección en una lista que hoy
  es un `v-for` plano).
- **C. Resolver el problema de raíz en `icon-cache.js`** en paralelo a A: cambiar
  `persistToDisk` para que no releo/reserialice el archivo completo en cada ícono de
  una tanda (ej. acumular un batch de escrituras pendientes y volcarlas una sola vez
  al vaciarse la cola, en vez de una lectura+escritura por ícono). Esto no es parte
  del pedido del punto 9 tal cual, pero sin él, A empeora un patrón ya identificado
  como frágil en `judgment-fixes-iteration-1` (el propio comentario del archivo ya
  earlier document esta cola como fix de un problema de concurrencia). **Esfuerzo: S**
  adicional, doable en el mismo cambio si `sdd-design` lo prioriza, o como debt
  candidate separado si no.

**Recomendación**: A para una primera versión (es lo que pide el intent, "muestra un
ícono chico junto al nombre"), con la advertencia explícita de C como riesgo a
mitigar en el mismo cambio o a registrar como deuda si se posterga — 106 escrituras
encoladas en la primera apertura no es un caso extremo, es el dato real de este
entorno. B es sobre-ingeniería (YAGNI) si C ya resuelve el costo real, que está en la
persistencia y no en el volumen de datos en memoria/red — 106 elementos en una lista
HTML no son un problema de rendering.

---

## Recomendación general (para sdd-propose)

Los 9 puntos son separables en specs/capabilities independientes salvo por el
acoplamiento de diseño ya señalado entre P1/P2/P3 (todos tocan `monitor-engine.js`
y el shape de `selection`) y P3/P4/P5 (todos tocan el formato de persistencia del
historial). Sugerido agrupar:

- **Grupo A — Selección** (P1, P2): mismo módulo (`monitor-engine.js`,
  `AppSelectorModal.vue`), mismo shape de datos (`selection`).
- **Grupo B — Historial estructurado** (P3, P4, P5, P6): depende de resolver primero
  el formato de persistencia (P3) antes de poder implementar grupos (P4) y las vistas
  nuevas (P5, P6).
- **Grupo C — Calidad de datos de Windows** (P7, P8, P9): tres fixes acotados e
  independientes entre sí, sin dependencia de diseño con A o B.

## Riesgos Identificados

- **P2**: orden de operaciones entre `closeRow`/`reduceLifecycle` y la baja de una
  entrada manual de `selection` — ventana de carrera si no se resuelve con cuidado en
  `sdd-design` (ver detalle en el punto 2).
- **P3**: elegir JSON para sesiones implica decidir si se migra `usage-log.txt`
  histórico (datos reales desde 2025-04 en el userData de producción) o si queda como
  archivo legado — impacta directamente el diseño de P5 (¿la vista de historial lee
  de dos fuentes o de una sola?).
- **P4**: `vuedraggable`/SortableJS con grupos cross-list no tiene precedente de uso
  en el repo (los dos usos actuales son de una sola lista) — validar en `sdd-design`
  que la prop `group` cubre "arrastrar una fila sin arrastrar el grupo completo" antes
  de comprometerse a la librería.
- **P7**: el fix de encoding (A) no autorepara cachés ya corruptas en disco de
  usuarios existentes — necesita ir acompañado de invalidación (B), confirmado con el
  propio userData de este entorno, que tiene la caché corrupta ahora mismo.
- **P9**: el costo de íconos en el selector no es de payload ni de rendering, es del
  patrón de escritura encolada de `icon-cache.js` (`persistToDisk`) — cualquier
  approach que dispare muchos `getIcon()` en paralelo hereda ese costo; señalado
  también como debt candidate potencial si se posterga la solución de raíz.
- **Deuda no relacionada con estos 9 puntos, pero en archivos que este cambio toca**:
  `CronometroAplicacion.vue` tiene un modal de historial muerto (referencias a
  `showHistory`/`filteredLogs`/`loadLogsForDate` inexistentes en el script) —
  registrado en `observations.md` como debt candidate.
