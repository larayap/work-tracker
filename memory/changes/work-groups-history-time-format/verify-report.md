---
type: change-verify-report
change_name: "work-groups-history-time-format"
spec_refs: ["[[multiple-simultaneous-groups]]", "[[hide-usage-chart-duration-scale]]", "[[usage-aggregation-by-visible-app-name]]", "[[judgment-fixes-sessions-groups-history-revised]]", "[[readable-session-title-typography]]", "[[session-time-without-seconds]]", "[[configurable-time-format-preference]]", "[[bright-chart-bars-on-dark-background]]"]
verdict: PARTIAL
created: "2026-08-05"
updated: "2026-08-06"
tags: [change, verify-report]
---

# Verify report: work-groups-history-time-format

## Veredicto (iteración 2): PARTIAL

## Resumen ejecutivo de la iteración 2

`sdd-apply` corrigió el fallo de build reportado en la iteración 1 (`4b9c991`: reemplazo de
`??` por `x == null ? '' : x` en `src/utils/session-aggregate.js`). Con autorización explícita
del usuario para verificación visual, re-sincronicé el worktree a la copia Windows, levanté la
app real (`npm run electron:serve`, compiló ambos bundles sin error) y la revelé desde la
bandeja del sistema (la partida de LoL del usuario ya había terminado — pantalla de resultados
confirmada por captura antes de tocar nada).

**Siete de las ocho specs quedan confirmadas visualmente contra la app real**, con datos
reales de sesiones (`sessions.json`, 44 entradas del 2026-08-02) y `settings.json` real, sin
inferencia a partir del diff:

- `readable-session-title-typography` — confirmado: nombres de fila y título de sesión en
  sans-serif, título "Work" y dígitos del cronómetro en la tipografía decorativa sin cambios.
- `hide-usage-chart-duration-scale` — confirmado: sin escala numérica bajo las barras, tooltip
  exacto al pasar el cursor (`League of Legends 00:04:34`), listas sin cambios.
- `bright-chart-bars-on-dark-background` — confirmado: barras claras sobre fondo oscuro, fondo
  sin cambios en ninguna captura de la sesión.
- `session-time-without-seconds` — confirmado: rangos `HH:MM` sin segundos en la vista Por
  sesión, en 24h y en 12h.
- `configurable-time-format-preference` — confirmado **end-to-end**, incluidos los tres
  criterios más difíciles: (a) sin `timeFormat` en disco, el panel muestra 24h por defecto;
  (b) cambiar a 12h se refleja de inmediato en el historial con AM/PM; (c) la preferencia
  sobrevive tanto a mover el volumen (no se pisa por `persist()`) como a un **reinicio real
  del proceso Electron** (kill de todos los `electron`/`node`, relanzamiento desde cero).
- `usage-aggregation-by-visible-app-name` — confirmado a nivel de render (la lógica ya estaba
  confirmada en iteración 1): 5 barras/filas sin duplicados sobre datos reales.
- `judgment-fixes-sessions-groups-history-revised` — sin cambios respecto a iteración 1 (no
  hay código nuevo que revisar; el diff de los tres archivos protegidos sigue vacío).

**Una spec queda con sus acceptance criteria centrales sin verificar, no por un defecto sino
por una limitación de automatización**: `multiple-simultaneous-groups`. Confirmé dos hechos
independientes del gesto de arrastre (dos filas sueltas coexisten; la franja de creación está
disponible con filas sueltas presentes), pero el gesto de arrastrar-y-soltar sobre
`vuedraggable`/SortableJS no se pudo reproducir con mouse sintético pese a tres técnicas
distintas (`mouse_event` lineal, `mouse_event` con nudge inicial, `SendInput` con coordenadas
absolutas). No infiero que el agrupamiento funcione porque el diff coincida con el diseño
(ya confirmado en iteración 1): lo reporto explícitamente como no reproducible, distinto de
"verificado". Ver detalle completo en la sección 3 (reemplaza a la de iteración 1) y en el
archivo de la spec, que documenta la frontera exacta entre lo confirmado y lo no reproducible.

**Por qué PARTIAL y no FAIL ni PASS**: no hay ningún defecto de código encontrado en esta
iteración — todo lo observado coincide con las specs y con `design.md`. Un FAIL enviaría el
cambio de vuelta a `sdd-apply` sin que haya nada que corregir en código. Un PASS ignoraría que
cinco criterios de aceptación de una spec siguen sin observación directa. `current_phase`
queda en `sdd-verify` (sin avanzar) para que una fase futura — con verificación manual del
gesto de arrastre por una persona, no por automatización — pueda cerrar el veredicto en PASS.

Antes de cerrar, restauré `settings.json` del usuario a su contenido original
(`{"masterVolume": 1, "interactionVolume": 1}`) y confirmé **cero procesos `electron`/`node`
corriendo** (`tasklist.exe` sin coincidencias) tras la verificación.

---

## Iteración 1 (contexto, ya resuelto)

La build del proceso main de Electron no compilaba en el commit `1a221a0`. Es un defecto de
implementación acotado y de una línea de alcance real — no un problema de diseño ni de las
specs. `sdd-apply` lo corrigió en `4b9c991` (ver diff más abajo, confirmado también en esta
iteración 2 contra la copia Windows re-sincronizada).

Todo lo verificable sin la app corriendo (los dos módulos puros con `node -e`, los `grep` de
no-regresión, y la revisión de diff de los diez archivos modificados contra el diseño) pasó
sin excepciones y coincidió exactamente con los valores esperados documentados en `tasks.md` y
`design.md`. Ese trabajo no se repite acá; queda documentado tal cual en las secciones
siguientes.

---

## 1. Hallazgo crítico: la build del main process falla

### Confirmación directa (no de segunda mano)

Sincronicé el worktree a la copia Windows (`rsync` desde
`.sdd/worktrees/work-groups-history-time-format/` a `cronometro-app-win/`, con
`node_modules` ya instalado) y corrí `npm run electron:serve`. Reproduje el fallo exacto
reportado por el orquestador:

```
 DONE  Compiled successfully in 2842ms   ← bundle del renderer (index.html + history.html)

 ERROR  Failed to compile with 1 errors  ← bundle del main process (background.js)

 error  in ./src/utils/session-aggregate.js

Module parse failed: Unexpected token (23:21)
You may need an appropriate loader to handle this file type, currently no loaders are
configured to process this file. See https://webpack.js.org/concepts#loaders
| // registrado.
| function normalizeAppName(app) {
>   return String(app ?? '').trim().toLowerCase()
| }

 @ ./src/main/session-log.js 13:29-69
 @ ./src/background.js
 @ multi ./src/background.js
```

El renderer compila entero (`index.html` + `history.html`, con el chunk de `chart.js`
confinado según ADR-0010). Solo el bundle del **main process** falla: el pipeline de
`vue-cli-plugin-electron-builder` que empaqueta `background.js` usa una versión de
webpack/acorn que no reconoce el operador `??` (nullish coalescing, ES2020) a nivel de
sintaxis — el mensaje "no loaders are configured to process this file" es característico de
un fallo de **parseo**, no de una API de runtime ausente (Electron 13/V8 sí soporta `??` en
ejecución).

### Alcance exacto — determinado, no supuesto

```bash
grep -rn '??' src/ --include="*.js" --include="*.vue"
```
Resultado: **3 coincidencias, las 3 en `src/utils/session-aggregate.js`** — línea 19 (dentro
de un comentario, no se parsea como token), línea 23 y línea 64 (código real). Ningún otro
archivo del diff usa `??`.

```bash
grep -rnE '\?\.[a-zA-Z_]' <los 10 archivos del diff>
```
Resultado: **0 coincidencias** en ningún archivo — no hay optional chaining (`?.`) en el
cambio.

`time-format.js` (el otro módulo compartido main/renderer que este cambio toca) **no tiene
ningún operador ES2020**: usa solo template literals, arrow functions, destructuring y
`padStart` — todo ES2015/ES2017, que la build del main ya venía compilando antes de este
cambio sin problema. `ipc-handlers.js` introduce object spread
(`{ ...defaultSettings, ...jsonStore.readJson(...) }`, ES2018): **no rompe el build** — lo
confirmé aplicando el fix de abajo y viendo compilar el main completo con un solo `??`
corregido a la vez pendiente, sin que `ipc-handlers.js` generara un segundo error.

**Conclusión de alcance**: el defecto está acotado a exactamente **dos líneas de código** en
`src/utils/session-aggregate.js` (23 y 64) — ningún otro archivo modificado por este cambio
tiene sintaxis incompatible con la build del main.

### Confirmación de que el fix es correcto y suficiente

Apliqué temporalmente (no comiteado, no dejado en el worktree — revertido con
`git checkout -- src/utils/session-aggregate.js` antes de terminar esta fase) el reemplazo:

```diff
- return String(app ?? '').trim().toLowerCase()
+ return String(app == null ? '' : app).trim().toLowerCase()
```
```diff
- if (String(entry.app ?? '').length < String(existing.app ?? '').length) existing.app = entry.app
+ if (String(entry.app == null ? '' : entry.app).length < String(existing.app == null ? '' : existing.app).length) existing.app = entry.app
```

Con las dos líneas corregidas:
1. `node -e` contra los mismos 44 registros reales sigue devolviendo **11 filas, suma
   `13697054` preservada** — el fix ES5 es conductualmente idéntico al original.
2. `npm run electron:serve` compila **el main completo** (`Compiled successfully in 401ms`,
   emite `dist_electron\index.js`) y llega a `Launching Electron...` — la app arranca.

**Acción concreta para `sdd-apply`**: reemplazar los dos usos de `app ?? ''` /
`entry.app ?? ''` / `existing.app ?? ''` en `src/utils/session-aggregate.js` (líneas 23 y 64)
por el equivalente ES5 `x == null ? '' : x` (o cualquier forma sin `??`/`?.`). Actualizar
también el comentario de la línea 19, que cita literalmente `` `String(app ?? '')` `` como
ejemplo. Por §D del protocolo común, esto se corrige en código — **no** se crea un delta de
spec: el criterio de agregación (D-2, ADR-0011) es correcto, la sintaxis elegida para
expresarlo no es compatible con el pipeline de build del main.

---

## 2. Verificación por spec

### [[usage-aggregation-by-visible-app-name]] — PASS (lógica + render, iteración 2)

Control positivo contra `sessions.json` real (44 entradas), ejecutado con `node -e` sobre el
código **tal como está comiteado** (con el `??` original, ya que Node ejecuta esto
directamente sin pasar por webpack):

```
entradas de entrada: 44
filas de salida: 11
rotulos repetidos: []
suma durationMs entrada: 13697054
suma durationMs salida: 13697054
claves unicas === filas: true
chrome y google chrome coexisten: true
```

Coincide exactamente con el valor de referencia documentado en `tasks.md` (Tarea 3) y
`design.md`. Caso fabricado F4 (Tarea 4):

```
[{"key":"name:chrome","appId":null,"app":"Chrome","durationMs":3000}]
```

Una fila, rótulo `'Chrome'` sin espacio sobrante, `durationMs` sumado — exacto.

Los dos criterios marcados `[x]` en la spec (fusión por nombre visible, no-fusión de nombres
distintos) quedan confirmados a nivel de agregación. En iteración 2, el render también se
confirmó: historial real sobre "2 ago 2026" muestra 5 barras/filas sin duplicados ("League of
Legends", "Google Chrome", "Brave", "Firefox", "Access"). Los criterios de alcance
día/mes/rango y desplazamiento con muchas apps siguen fuera del `scope` tocado por este
cambio (no forman parte de lo que este diff modifica) y quedan sin marcar, como corresponde.

### [[session-time-without-seconds]] — PASS completo

```
PASS: los 8 casos coinciden
```
(los 8 casos de la tabla de diseño: 24h/12h, medianoche, mediodía, `undefined` → 24h).

```bash
grep -rn "formatTimeHHMMSS" src/
```
→ 0 líneas: retiro completo, sin import huérfano. `BySessionView.vue` actualizado
(`formatTimeHHMM(new Date(entry.startedAt), this.timeFormat)` en las dos llamadas, revisión
de diff). El criterio marcado `[x]` en la spec (horario sin segundos) está verificado a nivel
de función pura y de diff, y en iteración 2 también contra la app real: `Por sesión` sobre "2
ago 2026" muestra rangos `HH:MM` sin segundos tanto en 24h (`11:37–11:38`) como en 12h
(`11:37 AM–11:38 AM`). **PASS** — spec cerrada.

### [[configurable-time-format-preference]] — PASS end-to-end (iteración 2)

Revisión de diff de iteración 1 (cinco archivos del `scope`, contra los tres defectos latentes
que `design.md` identifica) confirmada; en iteración 2 se ejecutó el ciclo completo contra la
app real y `settings.json` real:

1. **Default sin preferencia** (defecto latente 1): `settings.json` inicial no tenía la clave
   `timeFormat`; el panel mostró igual "24 horas" (merge de defaults en `get-settings`).
2. **Elegir 12h**: `settings.json` pasó a `"timeFormat": "12h"` de inmediato; el historial en
   "2 ago 2026" → "Por sesión" mostró `11:37 AM–11:38 AM` (con AM/PM).
3. **Elegir 24h**: se volvió al selector, `settings.json` pasó a `"timeFormat": "24h"`; una
   ventana de historial nueva sobre el mismo día mostró `11:37–11:38` (sin AM/PM) — mismos
   datos, formato distinto.
4. **Defecto latente 2** (`persist()` unificado): con `timeFormat: "12h"`, se movió el slider
   "Volumen general" (`masterVolume` → `0.52` en disco) y se releyó `settings.json`:
   `timeFormat` seguía en `"12h"`, no fue pisado por el guardado del volumen.
5. **Persistencia entre reinicios** (el criterio más exigente): con `timeFormat: "12h"` en
   disco, se mataron **todos** los procesos `electron`/`node` (cierre real, no solo ocultar a
   la bandeja) y se relanzó `npm run electron:serve` desde cero. La instancia nueva mostró
   "12 horas" en el panel y `masterVolume` ~0.52 — ambos leídos de disco en un proceso
   Electron completamente nuevo, no de un estado en memoria heredado.

Los cinco criterios de aceptación quedan confirmados. **PASS** — spec cerrada. Al finalizar,
`settings.json` se restauró a `{"masterVolume": 1, "interactionVolume": 1}` (su contenido
antes de esta verificación) para no dejar alterada la configuración real del usuario.

### [[hide-usage-chart-duration-scale]] y [[bright-chart-bars-on-dark-background]] — PASS visual (iteración 2)

`UsageChart.vue`, revisión de diff (iteración 1): `scales.x` pasa exactamente a `{ display:
false }` (se retiran `grid` y `ticks.callback`, sin dejar configuración muerta); `scales.y`
sin cambios; `tooltip.callbacks.label` sin cambios (sigue usando `msToHHMMSS`, sin import
huérfano); `backgroundColor` pasa de `'#6f6f6f'` a `'#d9d9d9'`; `ChartJS.defaults` sin tocar.
Coincide con D-4a/D-4b de `design.md`.

Iteración 2, historial real sobre "2 ago 2026" (5 apps: League of Legends, Google Chrome,
Brave, Firefox, Access): ninguna escala numérica bajo las barras; al posicionar el cursor
sobre la barra de League of Legends (sin click) apareció el tooltip nativo `League of
Legends 00:04:34`, coincidiendo con la lista "Por app" de abajo; las barras se ven en gris
claro con contraste evidente sobre el fondo casi negro de la ventana, que se mantuvo oscuro en
todas las capturas de la sesión, incluida la primera tras revelar la ventana desde la bandeja
(sin destello claro observado — verificación de un solo cuadro, no descarta un parpadeo por
debajo del intervalo de captura). Los seis criterios combinados de ambas specs quedan
confirmados. **PASS** — ambas specs cerradas.

### [[readable-session-title-typography]] — PASS visual (iteración 2)

`AppRow.vue`, revisión de diff (iteración 1): `font-family: sans-serif` agregado a
`.app-name`; en `.app-name-input` agregado **después** de `font: inherit` (orden correcto,
dado que el shorthand `font` resetea `font-family` — el detalle que `design.md` marca como
decisivo). `App.vue` y `CronometroPomodoro.vue` no aparecen en el diff.

Iteración 2, app real con dos filas activas: el nombre "Discord" (sin título propio) y,
después de renombrarla mediante el campo de edición inline, "Voice call" se vieron en
sans-serif, claramente distinto de la tipografía decorativa del título "Work" y de los
dígitos del cronómetro `00:00:00` en la misma captura. El campo de edición se usó
efectivamente para escribir el nombre nuevo (aplica la misma regla CSS por código). El widget
Pomodoro no se abrió en esta sesión — su archivo no aparece en el diff, así que no hay razón
para esperar un cambio ahí, pero no es una observación directa de ese widget en particular.
Los cuatro criterios quedan confirmados con esa salvedad explícita. **PASS** — spec cerrada.

### [[multiple-simultaneous-groups]] — código coherente con el diseño, gestos de arrastre NO REPRODUCIBLES

Revisión completa del diff de `CronometroAplicacion.vue` contra D-1 de `design.md` (iteración
1, sin cambios en iteración 2):

- `data()` tiene los 8 campos nuevos (`dragGroups`, `dragNewGroup`, `isDragging`,
  `pendingRows`, `pendingIntent`, `editingGroupId`, `draftGroupName`, más `dragUngrouped`
  preexistente) y ya no tiene `dragGrouped`/`activeGroupId`/`activeGroupName`
  /`editingGroupName`. El computed `showGroupContainer` fue eliminado.
- `applyRows(rows)` construye `nextUngrouped`/`nextGroups` en locales y asigna **al final**
  las dos propiedades reactivas — reconstrucción atómica tal como especifica D-1.
- `onDragStart`/`onDragEnd` implementan las tres reglas de la guarda exactamente como en
  `design.md` (bandera única, snapshot diferido en `pendingRows`, descarte del pendiente si
  `pendingIntent` es verdadero).
- Los tres handlers de `@change` (`onUngroupedDragChange`, `onGroupDragChange`,
  `onNewGroupDragChange`) marcan `pendingIntent = true` y `pendingRows = null` **antes** de
  emitir la intención IPC, en ese orden.
- Template: `v-for="group in dragGroups"` con `<draggable v-model="group.rows">` por grupo,
  usando `group.groupId` en el `@change` (no una variable de componente única); franja de
  creación con `dragNewGroup` (siempre vacío, sin `@start`/`@end` propios); visibilidad
  `dragUngrouped.length >= 1 || isDragging`.
- `startEditGroupName`/`confirmGroupName` reciben `group` y usan `group.groupId`; el manejo
  del `ref` en `v-for` contempla el caso array de Vue 3 (`Array.isArray(el) ? el[0] : el`).

El código implementa fielmente el diseño aprobado. En iteración 2, con la app real corriendo
y dos filas activas ("Google Chrome" y "Discord"/"Voice call"), confirmé dos hechos
independientes del gesto de arrastre: ambas filas coexisten sueltas y visibles al mismo
tiempo, y la franja "Arrastrá aquí para agrupar" está disponible mientras hay filas sueltas
(la condición del código, `dragUngrouped.length >= 1 || isDragging`, no exige que ya exista un
grupo previo). **El gesto de arrastre en sí no se pudo reproducir** pese a tres técnicas de
automatización de mouse distintas — detalle completo en la sección 3, que reemplaza a la de
iteración 1. Los cuatro criterios que dependen directamente de arrastrar una fila (formar un
segundo grupo, mover una fila entre grupos, repartir 4 filas en varios grupos, vaciar un grupo)
quedan **sin verificar por esta vía**, no por hallazgo de un defecto sino por límite de la
automatización. No se infiere que funcionen porque el diff coincida con el diseño.

### [[judgment-fixes-sessions-groups-history-revised]] — PASS (revisión de diff, sin ejecución)

```bash
git diff 22e1228 --stat -- src/main/monitor-engine.js src/main/session-log.js src/main/installed-apps-filter.js
```
→ vacío. Los tres archivos protegidos por esta spec no aparecen en el diff del cambio. El
único archivo del `main` que cambia es `ipc-handlers.js` (Tarea 9), que no participa de
ninguno de los tres requisitos vigentes de esta spec. Los tres criterios `[x]` de la spec
(ya marcados desde `sdd-apply`) se sostienen: no hay regresión.

---

## 3. Ítems visuales

### 3.1 Iteración 1 (histórico): por qué no se completó ninguno

Con un fix temporal de una línea (no comiteado, revertido antes de cerrar la fase) confirmé
que el main compilaba y Electron llegaba a `Launching Electron...`. Antes de interactuar con
la ventana, una captura de pantalla completa mostró que la máquina Windows estaba en uso
activo por el usuario: una partida clasificatoria de League of Legends en fase de selección
de campeón, con temporizador corriendo. Detuve toda interacción de mouse de inmediato, sin
abrir ninguna ventana de la app, y terminé el proceso de Electron/webpack por PID. Ninguno de
los ítems de Franja B/C se observó en esa iteración.

### 3.2 Iteración 2: qué se completó y qué quedó fuera de alcance de la automatización

Con autorización explícita del usuario ("Dale, verificá ahora") y con la partida de LoL ya
terminada (pantalla de resultados "DERROTA", confirmada por captura antes de tocar nada),
re-sincronicé el worktree con el fix `4b9c991` ya aplicado, levanté la app real y la revelé
desde la bandeja del sistema (chevron de overflow → ícono del cronómetro en el panel
expandido; coordenadas reconfirmadas por captura en cada intento, no asumidas del run
anterior). Con esto **completé la verificación visual de siete de las ocho specs** —detalle
por spec en la sección 2— usando datos reales: `sessions.json` (44 entradas, 2026-08-02) y
`settings.json` real del usuario.

**Lo que no se pudo reproducir, y por qué:** el gesto de arrastrar una fila hacia la franja
"Arrastrá aquí para agrupar" (o entre grupos), sobre el que dependen los criterios centrales
de `multiple-simultaneous-groups`. Con dos filas activas agregadas para la prueba (Google
Chrome y Discord/"Voice call"), intenté tres técnicas de automatización de mouse a nivel de
sistema operativo, cada una verificada por captura antes/después (sin cambio de contenedor de
la fila ni cambio de alto de ventana en ninguna):

1. `mouse_event` de Win32 con `LEFTDOWN` → 15 pasos de movimiento lineal (`SetCursorPos`) →
   `LEFTUP`, sobre el ícono de la fila.
2. La misma API, pero sobre el texto del cronómetro (no la `<img>` del ícono, para descartar
   que un drag nativo de imagen interceptara el gesto) y con un nudge inicial de 5 píxeles en
   pasos de 60ms antes del movimiento grande, imitando el umbral de arranque de un drag real.
3. `SendInput` (la API de nivel más bajo recomendada para automatización confiable en
   Windows) con coordenadas absolutas normalizadas a la resolución de pantalla y 25 pasos de
   movimiento.

Ninguna de las tres logró que SortableJS (la librería detrás de `vuedraggable`) iniciara el
drag. Es una limitación conocida de automatizar gestos de arrastre basados en JS con eventos
de mouse sintéticos a nivel de SO — no es evidencia de un defecto de la app: el código de
`CronometroAplicacion.vue` ya fue revisado en iteración 1 contra `design.md` §D-1 sin
hallazgos, y en esta iteración confirmé dos comportamientos del mismo mecanismo que **no**
dependen del arrastre (dos filas sueltas coexistiendo, franja de creación disponible con
filas sueltas presentes). Reporto esto de forma explícita como **no reproducible**, distinto
de "verificado" — ver `memory/specs/session-groups/multiple-simultaneous-groups.md` para el
detalle criterio por criterio.

**Nota sobre `dark-loading-state`** (spec relacionada, no en `spec_refs` de este cambio):
en cada revelado de ventana desde la bandeja (tres veces en total, incluida tras el reinicio
completo del proceso) la primera captura mostró fondo oscuro sin destello claro. Es una
verificación de un solo cuadro por revelado — no descarta un parpadeo por debajo del
intervalo entre el click y la captura (~700ms, delay fijo de la herramienta de automatización)
— pero en ninguno de los tres intentos hubo evidencia de flash.

### 3.3 Cierre de la sesión de verificación

Al terminar: se restauró `settings.json` a `{"masterVolume": 1, "interactionVolume": 1}` (su
contenido antes de esta verificación — se había modificado a `masterVolume: 0.52` y
`timeFormat: "12h"` como parte de las pruebas de la sección 2). Se mataron todos los procesos
`electron`/`node` de las dos instancias lanzadas durante la sesión (kill por PID, no
`taskkill /IM` masivo, para no afectar otros procesos del usuario) y se confirmó **cero
procesos `electron`/`node` corriendo** con `tasklist.exe` tras la limpieza. Los archivos PNG
temporales de las capturas se borraron de `C:\Users\Luis Araya\dev\`.

---

## 4. Coherencia bidireccional del grafo de specs

Verificación de `depends_on`/`affects` para las 8 specs de `spec_refs`, contra las specs que
referencian (existan o no en `spec_refs`):

| Spec (S) | Relación | Spec referenciada (T) | Estado |
|---|---|---|---|
| `multiple-simultaneous-groups` | `depends_on` | `group-composition-and-drag` | OK — T declara `affects: [[multiple-simultaneous-groups]]` |
| `readable-session-title-typography` | `depends_on` | `inline-session-naming` | OK — T declara `affects: [[readable-session-title-typography]]` |
| `session-time-without-seconds` | `depends_on` | `session-view` | OK — T declara `affects: [[session-time-without-seconds]]` |
| `session-time-without-seconds` | `affects` | `configurable-time-format-preference` | OK — U declara `depends_on: [[session-time-without-seconds]]` |
| `configurable-time-format-preference` | `depends_on` | `session-time-without-seconds` | OK (misma relación que la fila anterior, confirmada en ambos sentidos) |
| `usage-aggregation-by-visible-app-name` | `depends_on` | `sessions-json-persistence` | **WARN** — T existe pero su `affects` lista `usage-chart-by-interval` (la spec que esta cambia supersede), no `usage-aggregation-by-visible-app-name` |
| `usage-aggregation-by-visible-app-name` | `supersedes` | `usage-chart-by-interval` | OK — `usage-chart-by-interval.superseded_by` apunta de vuelta correctamente |
| `judgment-fixes-sessions-groups-history-revised` | `depends_on` | `sessions-json-persistence` | **WARN** — mismo `affects` faltante que la fila anterior |
| `judgment-fixes-sessions-groups-history-revised` | `depends_on` | `installed-apps-data-integrity` | **WARN** — T existe pero su `affects` no incluye esta spec ni la tiene en `related` |
| `judgment-fixes-sessions-groups-history-revised` | `supersedes` | `judgment-fixes-sessions-groups-history` | OK — `superseded_by` apunta de vuelta correctamente |
| `hide-usage-chart-duration-scale`, `bright-chart-bars-on-dark-background` | `depends_on`/`affects` | (ambos `[]`) | Nada que verificar |

Las tres inconsistencias son de metadata pura (falta una entrada en un array `affects`, la
spec referenciada existe) → **WARN, no FAIL**, según la regla del protocolo. **No se aplica
corrección automática**: la regla exige que la validación principal sea PASS como condición
previa, y este reporte cierra en PARTIAL (iteración 1 cerró en FAIL). Además, `sessions-json-persistence` e
`installed-apps-data-integrity` no pertenecen al `spec_refs` de este cambio — corregirlas
queda fuera del alcance de esta fase (`sdd-verify` solo actúa sobre las specs de su propio
`spec_refs`). Quedan documentadas acá para que una fase futura con motivo legítimo para
tocar esas specs las corrija.

Ningún `depends_on` apunta a una spec inexistente — no hay hallazgos de severidad FAIL en el
grafo. Sin cambios en iteración 2 (ninguna spec de `spec_refs` cambió sus relaciones).

---

## 5. Comandos ejecutados (resumen para trazabilidad)

### Iteración 1

```bash
# Franja A — módulos puros, código tal como está comiteado
node -e "... aggregateByApp contra sessions.json real (44 entradas) ..."
# → 11 filas, sin duplicados, suma 13697054 preservada, claves únicas, chrome/google chrome coexisten

node -e "... aggregateByApp caso fabricado 'Chrome '/'Chrome' ..."
# → 1 fila, 'Chrome', durationMs 3000

node -e "... formatTimeHHMM contra 8 casos de la tabla de diseño ..."
# → PASS: los 8 casos coinciden

grep -rn "formatTimeHHMMSS" src/                        # → 0 líneas
grep -n "stores/settings" src/history/HistoryView.vue   # → 0 líneas
git diff 22e1228 --stat -- src/main/monitor-engine.js src/main/session-log.js src/main/installed-apps-filter.js
                                                          # → vacío

# Confirmación de build (copia Windows, node_modules real)
rsync -a --exclude='node_modules/' ... worktree/ cronometro-app-win/
npm run electron:serve
# → renderer: Compiled successfully | main: Failed to compile, 1 error, session-aggregate.js:23:21

grep -rn '??' src/ --include="*.js" --include="*.vue"    # → 3 coincidencias, todas en session-aggregate.js
grep -rnE '\?\.[a-zA-Z_]' <10 archivos del diff>          # → 0 coincidencias

# Confirmación del fix (temporal, revertido antes de cerrar la fase)
node -e "... aggregateByApp con el fix ES5 ..."           # → 11 filas, suma 13697054 (idéntico)
npm run electron:serve                                    # → main: Compiled successfully, Launching Electron...
git checkout -- src/utils/session-aggregate.js            # → revertido; git diff posterior vacío
```

### Iteración 2

```bash
# Resincronización con el fix ya comiteado (4b9c991)
rsync -a --exclude='node_modules/' --exclude='.git' --exclude='.sdd/' --exclude='memory/' \
  --exclude='dist_electron/' --delete worktree/ cronometro-app-win/
grep -n "app ?? \|app == null" src/utils/session-aggregate.js
# → confirma `x == null ? '' : x` en las líneas 26 y 67 de la copia sincronizada

npm run electron:serve
# → renderer + main: Compiled successfully, Launching Electron... (ambos bundles, sin error)

# Revelado de ventana (bandeja → chevron → ícono cronómetro), confirmado con conteo de
# píxeles no-negros por PIL (100% no-negro tras revelar, no ~99% negro de una ventana oculta)

# AppSelectorModal: se agregaron dos filas reales (Google Chrome, Discord) para tener
# contenido con el que probar tipografía y coexistencia de filas sueltas

# Edición inline: click en "Discord" → SendKeys "Voice call" → Enter → displayName confirma
# el cambio en sans-serif

# Tres intentos de drag automatizado sobre la fila "Voice call" hacia la franja de creación
# (ver detalle en sección 3.2): mouse_event lineal, mouse_event con nudge inicial, SendInput
# absoluto — ninguno inició el drag de SortableJS (sin cambio de alto de ventana ni de
# contenedor en ninguno de los tres)

# Formato de hora, ciclo completo:
cat settings.json                     # → sin clave timeFormat (antes de tocar nada)
# UI: seleccionar "12 horas"
cat settings.json                     # → {"masterVolume":1,"interactionVolume":1,"timeFormat":"12h"}
# Historial → "2 ago 2026" → Por sesión → "11:37 AM–11:38 AM" (con AM/PM, sin segundos)
# UI: mover slider "Volumen general"
cat settings.json                     # → {"masterVolume":0.52,"interactionVolume":1,"timeFormat":"12h"}
#                                          (timeFormat sobrevive al guardado del volumen)
# UI: volver a "24 horas"; nueva ventana de historial → "11:37–11:38" (sin AM/PM)

# Prueba de reinicio real del proceso:
tasklist.exe | grep -i electron  # (antes) → 5 electron.exe, 2 node.exe
# Stop-Process -Force sobre los 7 PIDs
tasklist.exe | grep -i electron  # → vacío (cero procesos)
npm run electron:serve            # relanzamiento desde cero
# Panel de Opciones en la instancia nueva → "12 horas" + volumen ~0.52 → persistencia confirmada
#   a través de un reinicio real del proceso, no solo de la ventana

# Chart tooltip: cursor sobre la barra de "League of Legends" (sin click) → tooltip
# "League of Legends 00:04:34", coincide con la lista "Por app"

# Cierre de la sesión:
# settings.json restaurado a {"masterVolume": 1, "interactionVolume": 1}
tasklist.exe | grep -i "electron\|node"  # → vacío (cero procesos electron/node)
```

---

## 6. Acciones para la próxima fase

**Ninguna acción de código pendiente.** No se encontró ningún defecto en esta iteración: las
siete specs verificadas visualmente coinciden exactamente con `design.md` y con sus
acceptance criteria. La única spec que no cierra en PASS (`multiple-simultaneous-groups`) no
tiene una causa de código — su diff ya fue confirmado fiel al diseño en iteración 1 — sino una
limitación de la automatización de mouse usada para esta verificación frente a
`vuedraggable`/SortableJS.

Recomendación concreta: una verificación manual breve, hecha por una persona con mouse real
(no automatizada), de los cuatro criterios pendientes de `multiple-simultaneous-groups`
(formar un segundo grupo, mover una fila entre grupos, repartir 4 filas en varios grupos,
vaciar un grupo hasta que desaparezca). Si esa verificación manual confirma el comportamiento
— lo esperable, dado que el código ya coincide con el diseño aprobado — el cambio queda listo
para `sdd-archive` sin ninguna modificación de código adicional.
