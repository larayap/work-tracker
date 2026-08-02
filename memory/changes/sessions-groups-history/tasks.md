# Tasks: sessions-groups-history

26 tareas sobre las seis etapas aprobadas en `proposal.md`, descompuestas desde la sección
**Output Expected** de `design.md`. Cada etapa deja la aplicación funcionando; los bloques
1-3 y 4-6 son entregables por separado, y la etapa 6 está partida en 6a (vistas + gráfico del
día) y 6b (alcance mes/rango), también entregables por separado.

## Orden de ejecución

```
Etapa 1 (T1→T3)           Etapa 2 (T4→T6)            Etapa 3 (T7→T10)
  T1 ─┐                     T4 → T5 ─┐                 T7 ──┬─→ T9 ─┐
  T2 ─┴→ T3                 T2 ──────┴→ T6              T8 ─┘       │
                                                          T7 ────────┴─→ T10

Etapa 4 (T11→T19)                                        Etapa 5 (T20)
  T11 ────────────────────┐                               T18 → T20
  T12 → T13 ← (T11) ──────┤
  T13 → T14 → T15          │
  T14 → T17                │
  T7 → T18 ← T14            │
  T18 → T19

Etapa 6a (T21→T25)                       Etapa 6b (T26)
  T21 ┐
  T17,T11 → T22 → T23              T22, T25, T11 → T26
  T22,T11 → T24
  T21,T22,T11 → T25
```

- **Etapas 1-3** (selección y calidad de datos) son independientes de **4-6** (persistencia,
  grupos, historial) salvo por tocar los mismos archivos de UI (`AppSelectorModal.vue`,
  `AppRow.vue`). Ejecutar 1→2→3 en orden interno; 4-6 solo puede arrancar después de que
  exista `session-log.js` reescrito (T14), que a su vez depende de T7 (el motor debe conocer
  `type`, `sessionName`, `groupId` antes de que la migración y el `before-quit` los persistan).
- **T7** (reductor con baja atómica) es la tarea de mayor riesgo (`proposal.md`: riesgo de
  probabilidad Alta) y la única que otras ocho tareas dependen de forma transitiva. Hacerla
  primero dentro de la etapa 3 y verificarla a fondo antes de avanzar.
- **La migración (D-2) se corta en tres tareas chicas y verificables** (T11 agregador puro
  usado por la lectura, T12 parser puro, T13 orquestación idempotente), cada una ejercitable
  con `node -e` contra una copia del `usage-log.txt` real — nunca el original.

### Nota de entorno para las verificaciones `node -e`

Este worktree no tiene `node_modules` instalado. Los módulos nuevos de este cambio
(`session-log-parser.js`, `session-aggregate.js`) se diseñan **sin ninguna dependencia de
`npm`** (solo `fs`/`path` del núcleo de Node), así que sus verificaciones corren igual sin
`npm install`. Los módulos que ya existían antes de este cambio y hacen
`require('electron')` en el nivel superior del archivo (`monitor-engine.js`,
`installed-apps-filter.js` no lo hace — `monitor-engine.js` sí) **necesitan `npm install`
corrido al menos una vez** para que `require('electron')` resuelva (el paquete `electron`
fuera del runtime de Electron devuelve un string, inofensivo, en vez de lanzar
`MODULE_NOT_FOUND`). Esto es preexistente a este cambio, no algo que haya que corregir acá;
si `sdd-verify` corre en un entorno sin `npm install`, correrlo una vez antes de las
verificaciones de `reduceLifecycle`/`reduceFocus`/`removeRow` (T7).

### Refinamiento respecto de `design.md`: `src/main/session-log-parser.js` (archivo nuevo)

`design.md` no lista este archivo en **Output Expected** — el diseño ubica el parser de
migración dentro de `session-log.js`. Se extrae a un archivo propio por una razón concreta,
verificada en esta fase: `session-log.js` hace `require('electron')` en su nivel superior
(para `app.getPath('userData')`), así que **cualquier función que viva ahí, pura o no, se
vuelve imposible de requerir con `node -e` en un entorno sin `node_modules`** — que es
exactamente lo que `design.md` promete para el parser de migración en su sección
"Estrategia de Testing" ("verificable con `node -e`, sin Windows y sin Electron"). Separar el
parser (y la orquestación de archivos de la migración, que usa `fs`/`path` del núcleo pero no
`electron`) en un módulo propio es el mismo patrón que el proyecto ya usa entre
`installed-apps.js` (orquestación + Electron) e `installed-apps-filter.js` (puro,
ADR-0003) — no una desviación de arquitectura, sino aplicar el patrón existente a una
pieza nueva. `session-log.js` sigue siendo el dueño único del archivo `sessions.json` (D-1):
solo delega en `session-log-parser.js` la parte que no necesita `electron`.

---

## Etapa 1 — Calidad de datos Windows (P7, P8) · D-13

**Specs**: [[installed-apps-data-integrity]]

### Tarea 1: Fix de encoding UTF-8 en las invocaciones PowerShell

- **Archivos**: `src/main/platform-windows.js`
- **Qué hacer**: agregar `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` como
  **primera sentencia** de los dos comandos PowerShell del módulo: el string de
  `listOpenWindows()` (línea ~99, hoy empieza con `Get-Process | Where-Object ...`) y el
  array `buildInstalledAppsScript()` (línea ~129, el primer elemento hoy es
  `"$ErrorActionPreference = 'SilentlyContinue'"` — el fix va antes de esa línea, como nuevo
  primer elemento del array que `.join('; ')` concatena). Son las únicas dos invocaciones
  PowerShell del módulo (confirmado por grep de todo el árbol en `design.md` V4); no tocar el
  lado JavaScript — `exec()` de Node ya decodifica UTF-8 por defecto.
- **Criterio de completado**: correr, vía interop, el comando final ya modificado (o un
  repro mínimo con el mismo patrón) y confirmar que un carácter con tilde sale en UTF-8 de
  dos bytes, no en CP-850 de un byte. Comando exacto verificado en esta fase (sin el fix,
  `ó` = `a2`; con el fix, `ó` = `c3 b3`):
  ```bash
  powershell.exe -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [PSCustomObject]@{n='Cronómetro versión'} | ConvertTo-Json" | xxd
  # esperado: la secuencia de bytes 63 33 62 33 (c3 b3) donde antes salía a2
  ```
  Además, confirmar contra el `installed-apps-cache.json` real de este entorno (ver Tarea 3)
  que, tras invalidar la caché con el fix ya aplicado, las tres entradas corruptas
  identificadas en `design.md` (V10: `Cron?metro App`, `Navegaci?n privada con Firefox`,
  `Registro de telemetr?a para Office`) se reenumeran con sus caracteres correctos.

- [x] `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` es la primera sentencia de
  `listOpenWindows()`.
- [x] `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` es el primer elemento del
  array de `buildInstalledAppsScript()`, antes de `$ErrorActionPreference`.
- [x] El hexdump del comando modificado muestra bytes UTF-8 (`c3 b3`, `c3 ba`) para tildes,
  no bytes CP-850 (`a2`, `a3`).

### Tarea 2: Filtro `.exe` + deduplicación por `appId`

- **Archivos**: `src/main/installed-apps-filter.js`
- **Qué hacer**: en `shouldDiscard(entry)`, agregar una condición que descarte cualquier
  entrada cuyo `targetPath` (ya sabido no-vacío en ese punto, por el chequeo de la línea 45)
  no termine en `.exe` (case-insensitive). En `filterInstalledApps(rawEntries)`, después del
  `.filter(...).map(...)` actual, agregar un paso de deduplicación por `appId` que conserve
  **la primera aparición** y descarte las repeticiones (un `Set` de claves vistas, en el
  mismo orden en que llegan las entradas).
- **Criterio de completado** [TDD — función pura, `node -e`]: contra una copia del array
  `apps` real de `installed-apps-cache.json` de este entorno (106 entradas, shape
  `{ appId, name, exePath, publisher }` — el mismo shape que produce `filterInstalledApps`,
  así que las dos reglas nuevas se pueden probar aplicándolas directo sobre esa lista, sin
  reconstruir las entradas crudas del acceso directo):
  ```bash
  node -e "
  const c = require('/mnt/c/Users/Luis Araya/AppData/Roaming/cronometro-apps/installed-apps-cache.json');
  const exeOnly = c.apps.filter(a => a.exePath.toLowerCase().endsWith('.exe'));
  const seen = new Set();
  const deduped = exeOnly.filter(a => !seen.has(a.appId) && seen.add(a.appId));
  console.log('total', c.apps.length, 'exeOnly', exeOnly.length, 'deduped', deduped.length);
  "
  # esperado (verificado en esta fase): total 106, exeOnly 91, deduped 82
  ```
  Con la función real (`shouldDiscard` + `filterInstalledApps`), fabricar entradas crudas
  mínimas (`{ targetPath: '...chm', ... }`) para las 15 no-`.exe` reales (`.chm`, `.html`,
  `.url`, `.txt`, `.ico`) y confirmar que las 15 se descartan; fabricar dos entradas con el
  mismo `targetPath` y confirmar que sobrevive solo una.

- [x] `shouldDiscard` descarta cualquier `targetPath` que no termine en `.exe`.
- [x] `filterInstalledApps` deduplica por `appId`, conservando la primera aparición.
- [x] Contra la copia real: 106 → 91 (filtro `.exe`) → 82 (dedup).

### Tarea 3: `schemaVersion` e invalidación de caché

- **Archivos**: `src/main/installed-apps.js`
- **Depende de**: Tarea 1 (el fix de encoding debe existir antes de forzar una
  reenumeración, o la caché se reconstruye con los mismos nombres corruptos)
- **Qué hacer**: agregar `const INSTALLED_APPS_SCHEMA_VERSION = 2`. En `enumerate()`,
  escribir `{ schemaVersion: INSTALLED_APPS_SCHEMA_VERSION, apps, cachedAt }` en vez de
  `{ apps, cachedAt }`. En `getInstalledApps()`, tratar la caché leída como válida
  **únicamente** si `cached.schemaVersion === INSTALLED_APPS_SCHEMA_VERSION`; si la caché es
  `null`, o no tiene ese campo, o tiene un valor distinto, seguir exactamente el camino que
  hoy sigue "sin caché" (dispara `enumerate()` y devuelve `{ apps: [], cachedAt: null,
  loading: true }` de inmediato).
- **Criterio de completado**: la caché real de este entorno no tiene `schemaVersion`
  (verificado en esta fase: `Object.keys(cache) → ['apps', 'cachedAt']`), así que sirve como
  corpus real de "caché inválida":
  ```bash
  node -e "
  const c = require('/mnt/c/Users/Luis Araya/AppData/Roaming/cronometro-apps/installed-apps-cache.json');
  const SCHEMA = 2;
  console.log('caché real se clasifica como inválida:', c.schemaVersion !== SCHEMA);
  "
  # esperado: true
  ```
  Verificación de integración (con Tarea 1 ya aplicada): abrir el selector en la app real
  apuntando a este `userData`, confirmar que la primera apertura reenumera (no sirve el
  listado de 106 entradas viejo) y que la caché resultante en disco tiene
  `schemaVersion: 2`.

- [x] `INSTALLED_APPS_SCHEMA_VERSION = 2` declarado y usado al escribir la caché.
- [x] `getInstalledApps()` trata `schemaVersion` ausente o distinto como si no hubiera
  caché.
- [x] Contra la caché real de este entorno (sin `schemaVersion`), se clasifica como
  inválida.

---

## Etapa 2 — Íconos del selector (P9) · D-14, D-15

**Specs**: [[selector-listing-icons]]

### Tarea 4: `persistToDisk` por tanda en `icon-cache.js`

- **Archivos**: `src/main/icon-cache.js`
- **Qué hacer**: reemplazar la cola actual (una lectura+mezcla+escritura por **cada** ícono,
  líneas 26-50) por una que acumula pendientes en un `Map` (clave → `dataUrl`) y agenda **un
  único** volcado que, cuando le toca el turno, lee el archivo una vez, mezcla todo lo
  pendiente acumulado hasta ese momento y escribe una vez. `persistToDisk(key, dataUrl)` pasa
  a solo agregar al `Map` y devolver la promesa del volcado agendado (para que `getIcon`
  pueda seguir haciendo `await persistToDisk(...)`).

  **Punto de atención, no un detalle menor**: agendar el volcado con
  `diskWriteQueue.then(...)` a secas (un microtask) **no agrupa nada real** bajo concurrencia
  genuina. La extracción nativa del ícono (`platform.getExecutableIcon`) es una llamada
  asíncrona real que tarda mucho más que un microtask; con 6 extracciones en vuelo (Tarea 5),
  la primera en resolver dispararía el volcado antes de que las otras cinco hayan llamado a
  `persistToDisk`, y el resultado sería el mismo patrón de "una escritura por ícono" que hoy,
  disfrazado. El volcado necesita agendarse con un temporizador que se reinicie con cada
  llegada mientras está pendiente (debounce corto, del orden de decenas de ms) para que una
  tanda de íconos que resuelven en un rango de tiempo cercano se acumule antes de que ocurra
  la lectura+escritura única.

  **Preservar las dos propiedades que el código actual ya tiene** (comentarios existentes en
  el archivo, líneas 15-40): **S1** — la lectura del archivo sigue ocurriendo dentro del
  turno de la cola, nunca antes de esperar, así que ninguna clave de una escritura
  concurrente se pierde. **F1** — el `.catch` final restablece el estado de agendado y limpia
  los pendientes, para que una falla de disco no deje la cola inutilizada por el resto del
  proceso.
- **Criterio de completado**: verificación manual en Windows (mismo criterio que fija
  `design.md` en su Escenario 7 — este archivo no es puro, usa `electron.nativeImage` y
  `app.getPath`, así que no es verificable con `node -e` sin Windows): borrar
  `app-icons-cache.json` del `userData` real, abrir el selector, confirmar que el listado
  responde de inmediato con la imagen de respaldo y que los íconos se completan
  progresivamente. Confirmar que el archivo resultante se escribió **una sola vez** para toda
  la tanda (por ejemplo, con un `console.log` temporal dentro de `jsonStore.writeJson` — o
  observando que el `mtime` del archivo cambia una sola vez durante la apertura — retirado
  antes de cerrar la tarea).

- [x] `persistToDisk` acumula en un `Map` en vez de leer+escribir por cada llamada.
- [x] El volcado se agenda con un temporizador que se reinicia con cada llegada mientras está
  pendiente (no un microtask puro).
- [x] S1 se preserva: ninguna clave pendiente se pierde entre el agendado y el volcado.
- [x] F1 se preserva: una falla de `jsonStore.writeJson` no deja la cola inutilizada.
- [ ] Verificado a mano en Windows: una tanda de N íconos nuevos produce una sola escritura
  del archivo de caché.

### Tarea 5: `ensureIcons` con concurrencia acotada en el store

- **Archivos**: `src/stores/monitoredApps.js`
- **Depende de**: Tarea 4
- **Qué hacer**: agregar la acción `ensureIcons(exePaths)` que recorre la lista con
  concurrencia acotada a 6 llamadas en vuelo (un pool simple: mantener 6 promesas activas,
  reemplazar cada una por la siguiente ruta pendiente en cuanto se resuelve), reutilizando
  `ensureIcon(exePath)` existente (el guard por `hasOwnProperty` de esa función ya cubre la
  reentrada, no hay que duplicarlo).
- **Criterio de completado**: `node -e` no aplica (el store usa `window.require('electron')`
  y Pinia, no es puro). Verificación observable: instrumentar temporalmente un contador de
  invocaciones "en vuelo" simultáneas de `ensureIcon` al llamar `ensureIcons` con un array
  fabricado de 20+ rutas y confirmar que el máximo simultáneo no supera 6 en ningún momento
  (retirar la instrumentación antes de cerrar la tarea).

- [x] `ensureIcons(exePaths)` existe en el store y reutiliza `ensureIcon`.
- [x] La concurrencia máxima simultánea verificada es 6, no 82 en paralelo ni secuencial de
  a uno.

### Tarea 6: Íconos en el listado del selector

- **Archivos**: `src/components/AppSelectorModal.vue`
- **Depende de**: Tarea 2 (listado ya limpio, sin `.chm` ni duplicados — pedir el ícono de
  una entrada que Tarea 2 ya habría descartado es trabajo garantizado inútil), Tarea 5
- **Qué hacer**: en cada `<li>` de `filteredInstalled` (dentro de `v-if="tab === 'installed'"`,
  líneas 26-38), agregar un `<img>` con `filter: grayscale(1)` (mismo tratamiento que
  `AppRow.vue`) que use `monitoredApps.icons[appEntry.exePath]` con el mismo respaldo
  `public/img/idk.png` que ya usa `AppRow.vue` (mismo mapa `icons` del store — no crear un
  mapa de íconos propio del modal, sería duplicar el que ya existe). Disparar
  `monitoredApps.ensureIcons(...)` con las `exePath` del listado en cuanto `installedApps` se
  puebla (tanto en `loadInstalled()` como en `handleInstalledUpdated`, los dos puntos donde
  hoy se asigna `this.installedApps`).
- **Criterio de completado**: verificación manual en Windows — Escenario 1 y 4 de la spec
  `selector-listing-icons`: cada entrada del listado muestra su ícono real o el respaldo; la
  primera apertura tras borrar la caché de íconos no muestra demora perceptible mientras se
  completan; una apertura posterior no repite la extracción (verificable observando que no
  hay nuevas llamadas IPC `get-app-icon` para rutas ya presentes en `monitoredApps.icons`).

- [x] Cada `<li>` de instaladas muestra `<img>` con el ícono o el respaldo, con
  `grayscale(1)`.
- [x] `ensureIcons` se dispara al poblarse `installedApps`, en los dos puntos donde se asigna
  hoy.
- [x] No se introduce un mapa de íconos propio del modal: se reutiliza `monitoredApps.icons`.

---

## Etapa 3 — Selección (P1, P2) · D-5, D-6

**Specs**: [[selection-type-manual-vs-auto]], [[deselect-from-saved-selection]],
[[row-lifecycle-persistence-by-type]]

### Tarea 7: Selección tipada + reductor con baja atómica + reconciliación de arranque

Esta es la tarea de mayor riesgo del cambio (riesgo de probabilidad Alta en `proposal.md`).
El orden interno es la corrección, no un detalle de estilo — ver [[0009-typed-selection-with-atomic-manual-removal]].

- **Archivos**: `src/main/monitor-engine.js`, `src/background.js`
- **Qué hacer**:
  1. `reduceLifecycle(sLive, selection, rows)` cambia de contrato a
     `→ { rows, selection, closed }` (hoy devuelve `{ rows, closed }`). Sus pasos internos
     quedan fijados en este orden invariante:
     - Paso 1 (sin cambios): filas con PID muerto salen a `closed`.
     - Paso 2 (**nuevo, en el mismo paso que el 1**): `nextSelection` se calcula quitando de
       `selection` las entradas `type: 'manual'` cuyo `appId` está en `closed`. Si no hubo
       cierres, `nextSelection` debe ser la **misma referencia** que `selection` (no clonar
       sin necesidad) — el llamador la usa para decidir con `!==` si hay que persistir.
     - Paso 3 (sin cambios): vinculación de PIDs a filas sin PID.
     - Paso 4 (cambia la fuente): las altas se evalúan recorriendo `nextSelection`, **nunca**
       la `selection` de entrada. Cada fila nueva incluye `type: entry.type`.
  2. En `tick()` (líneas 256-260): tomar `lifecycleResult.selection`; si
     `lifecycleResult.selection !== selection`, reasignar `selection = lifecycleResult.selection`
     y persistir con `jsonStore.writeJson(getSelectionFilePath(), selection)` (solo en ese
     caso, no en cada tick).
  3. `closeRow(appId, motivo)` (líneas 286-295): en la misma función síncrona, después de
     registrar la sesión, dar de baja la entrada de `selection` con ese `appId` **si es
     `type: 'manual'`**, y persistir solo si `selection` cambió de tamaño. Ningún camino de
     salida de fila puede dejar sin resolver, en la misma operación, la baja de su entrada en
     `selection` (prohibición explícita de ADR-0009).
  4. `addToSelection({ appId, name, exePath, imageName, type })` (líneas 348-373): guardar
     `type: type || 'auto'` en la entrada de `selection`, y también en la fila creada de
     inmediato (para que el marcador visual de Tarea 10 sea correcto sin esperar un tick).
  5. `getSnapshot()` (líneas 298-316): agregar `type: row.type` a cada fila y
     `type: entry.type` a cada entrada de `selection`.
  6. `loadSelection()` (líneas 328-331) pasa a ser `async`: normaliza `type` una sola vez al
     leer (`entry.type === 'manual' ? 'manual' : 'auto'`); si hay al menos una entrada
     `manual`, enumera procesos vivos una sola vez con `platform.listRunningProcesses()` y
     descarta las entradas `manual` cuyo nombre de imagen no aparece entre los procesos vivos
     (las entradas `auto` no se tocan); persiste solo si la reconciliación cambió algo;
     arranca el motor si `selection.length > 0`. La enumeración solo se paga si hay al menos
     una entrada manual guardada (guarda de dos términos, mismo criterio de costo que
     ADR-0001 usa para el descubrimiento).
  7. `src/background.js` línea 85: `monitorEngine.loadSelection()` → `await
     monitorEngine.loadSelection()` (ya está dentro de la función `async createWindow()`).
- **Modo**: [TDD] — `reduceLifecycle`, `removeRow` y la normalización de `type` son puros y
  se verifican con entradas fabricadas.
- **Criterio de completado**: los tres escenarios siguientes, prototipados y verificados en
  esta fase contra una copia aislada de la lógica propuesta (requiere `npm install` corrido
  una vez en el entorno real, ver nota de entorno arriba, porque `monitor-engine.js` importa
  `electron`):
  1. Fila manual con PID muerto **y** su `appId` presente en `discovered` en el mismo tick
     (la carrera que motiva ADR-0009) → la fila NO renace, y la entrada manual sale de
     `selection` en el mismo resultado.
  2. Sin cierres en el tick → `reduceLifecycle(...).selection === selection` (misma
     referencia).
  3. Fila automática con PID muerto → la fila sale del listado, pero su entrada permanece en
     `selection` (control de no regresión de `row-lifecycle-persistence-by-type`).
  ```bash
  node -e "
  const { reduceLifecycle } = require('./src/main/monitor-engine.js');
  const selection = [
    { appId: 'app:manual', name: 'M', exePath: null, type: 'manual' },
    { appId: 'app:auto', name: 'A', exePath: null, type: 'auto' },
  ];
  const rows = [
    { appId: 'app:manual', name: 'M', exePath: null, pid: 111, state: 'running', elapsedMs: 0, sessionStartedAt: 1, lastTickAt: 1, type: 'manual' },
    { appId: 'app:auto', name: 'A', exePath: null, pid: 222, state: 'paused', elapsedMs: 0, sessionStartedAt: 1, lastTickAt: 1, type: 'auto' },
  ];
  const r = reduceLifecycle({ alivePids: new Set([222]), discovered: { 'app:manual': 999 } }, selection, rows);
  console.log('manual no renace:', !r.rows.some(x => x.appId === 'app:manual'));
  console.log('manual fuera de selection:', !r.selection.some(x => x.appId === 'app:manual'));
  const noChange = reduceLifecycle({ alivePids: new Set([111,222]), discovered: {} }, selection, rows);
  console.log('sin cierres, misma referencia:', noChange.selection === selection);
  "
  ```
  Reconciliación de arranque: verificar contra `monitored-selection.json` real de este
  entorno (tres entradas sin `type`, todas se normalizan a `'auto'` y no se tocan en la
  reconciliación, porque la reconciliación solo evalúa entradas `manual`).
  Control de no regresión: correr también los escenarios ya cubiertos por
  `row-lifecycle-persistence-by-type` y `saved-selection-only-monitoring` sin `type` (todas
  `auto`) y confirmar que el comportamiento no cambió.

- [ ] `reduceLifecycle` devuelve `{ rows, selection, closed }` con los 4 pasos en el orden
  fijado.
- [ ] La baja de la entrada manual ocurre en el mismo paso que la baja de la fila, antes de
  evaluar altas.
- [ ] `tick()` persiste `selection` solo cuando cambió (comparación por referencia).
- [ ] `closeRow` da de baja la entrada manual correspondiente en la misma operación
  síncrona.
- [ ] `addToSelection` guarda `type` (`'auto'` por defecto) en la entrada y en la fila
  inmediata.
- [ ] `getSnapshot()` expone `type` en filas y en `selection`.
- [ ] `loadSelection()` es `async`, normaliza `type`, reconcilia manuales muertas contra
  procesos vivos (una sola enumeración, solo si hay al menos una manual) y persiste solo si
  cambió.
- [ ] `background.js` usa `await monitorEngine.loadSelection()`.
- [ ] Verificado con entradas fabricadas: la carrera del escenario 1 no reproduce (fila no
  renace, manual sale de `selection`); sin cierres, `selection` es la misma referencia; auto
  con PID muerto permanece en `selection`.

### Tarea 8: Deselección desde el selector — dos correcciones

- **Archivos**: `src/components/AppSelectorModal.vue`
- **Qué hacer**, las dos juntas (sin la segunda, la primera queda inalcanzable con el listado
  lleno):
  1. `choose(appEntry)` (línea 120-127): reordenar el guard. Si `isSelected(appEntry.appId)`
     → llamar `this.monitoredApps.removeApp(appEntry.appId)` y salir. Recién **después**,
     evaluar `limitReached` para bloquear el alta. Hoy el orden es al revés
     (`limitReached || isSelected`), lo que bloquea la deselección justo cuando el listado
     está lleno — el caso en el que más se necesita.
  2. La clase `disabled` del `<li>` (línea 32) hoy es
     `:class="{ disabled: monitoredApps.limitReached, checked: isSelected(...) }"`, y el CSS
     `.selector-list li.disabled { pointer-events: none }` (línea 223-227) bloquea el click
     en **todas** las filas cuando el límite está alcanzado, incluidas las ya seleccionadas.
     Cambiar la condición de `disabled` a
     `monitoredApps.limitReached && !isSelected(appEntry.appId)`.
- **Criterio de completado**: el check-mark (`{{ isSelected(appEntry.appId) ? '✓' : '' }}`,
  línea 35) ya distingue visualmente lo seleccionado — no hay trabajo nuevo ahí, solo
  confirmar que sigue funcionando. Verificación manual en Windows: con el listado en el
  límite de 4, desmarcar una app ya seleccionada desde el selector debe funcionar (hoy no
  funciona, por el bug del guard); desmarcar una app sin fila activa la saca de `selection`
  sin generar fila al reabrirse; desmarcar una app con fila activa la cierra y la registra
  con el mismo efecto que ■ (esto último ya lo implementa `removeFromSelection` +
  `closeRow`, sin cambios de este cambio — es la spec `deselect-from-saved-selection`
  confirmando comportamiento existente, D-6).

- [ ] `choose()` evalúa `isSelected` antes que `limitReached`, y llama `removeApp` cuando
  corresponde.
- [ ] La clase `disabled` no bloquea el click sobre filas ya seleccionadas cuando el límite
  está alcanzado.
- [ ] Verificado a mano: desmarcar con el listado en el límite de 4 funciona.

### Tarea 9: Toggle de modalidad Permanente/Una vez + propagación de `type`

- **Archivos**: `src/components/AppSelectorModal.vue`, `src/stores/monitoredApps.js`
- **Depende de**: Tarea 7 (el motor debe aceptar y usar `type`), Tarea 8 (evita tocar
  `choose()` dos veces en la misma iteración)
- **Qué hacer**:
  1. `AppSelectorModal.vue`: agregar un toggle único arriba del listado (`data(): { ...,
     addAsType: 'auto' }`, dos opciones "Permanente" / "Solo esta vez", default
     `'auto'`). `choose(appEntry)` y `chooseOpenWindow(win)` pasan `type: this.addAsType` al
     llamar `addApp`.
  2. `stores/monitoredApps.js::addApp`: agregar `type` a la desestructuración
     (`{ appId, name, exePath, imageName, type }`) y al objeto que se envía por
     `ipcRenderer.invoke('add-to-selection', { ..., type })`. El canal `add-to-selection`
     en `ipc-handlers.js` ya reenvía el objeto `entry` completo sin desestructurar
     (`monitorEngine.addToSelection(entry)`) — no requiere cambio de código, solo
     confirmar por lectura que sigue siendo así tras el resto de este cambio.
- **Criterio de completado**: agregar sin tocar el toggle dejar el programa como
  `'auto'` (comportamiento de hoy, sin cambios). Cambiar el toggle a "Solo esta vez" y
  agregar un programa → verificar en `monitored-selection.json` real que la entrada tiene
  `type: 'manual'`. Verificación manual en Windows: reiniciar el cronómetro con el programa
  manual todavía abierto (la fila reaparece) y con el programa cerrado (sin rastro en
  `monitored-selection.json`) — los dos escenarios de `selection-type-manual-vs-auto` que
  ejercitan Tarea 7's reconciliación end-to-end.

- [ ] Toggle "Permanente / Solo esta vez" visible arriba del listado, default Permanente.
- [ ] `choose()` y `chooseOpenWindow()` propagan `type` según el toggle.
- [ ] `stores/monitoredApps.js::addApp` propaga `type` hasta el canal IPC.
- [ ] Confirmado por lectura: `ipc-handlers.js` no necesita cambio (reenvía `entry` completo).
- [ ] Verificado a mano: agregar sin tocar el toggle preserva el comportamiento de hoy;
  agregar en "Solo esta vez" persiste `type: 'manual'`.

### Tarea 10: Marcador visual de fila manual

- **Archivos**: `src/components/AppRow.vue`
- **Depende de**: Tarea 7 (`row.type` en el snapshot)
- **Qué hacer**: agregar un marcador visual discreto (ej. un ícono pequeño o un borde sutil,
  condicionado a `row.type === 'manual'`) en el template de `AppRow.vue`, sin alterar el
  layout de las filas automáticas.
- **Criterio de completado**: verificación manual — una fila `manual` se distingue de una
  `auto` de un vistazo, sin que el marcador desplace o tape el resto de la fila (nombre,
  reloj, indicador de estado, botón de detener).

- [ ] El marcador aparece solo cuando `row.type === 'manual'`.
- [ ] No altera el layout de filas automáticas.

---

## Etapa 4 — Persistencia estructurada (P3) · D-1, D-2, D-3, D-4, D-9

**Specs**: [[sessions-json-persistence]], [[inline-session-naming]] (scaffolding de motor),
[[group-composition-and-drag]] (scaffolding de motor)

### Tarea 11: Módulo puro de agregación por intervalo

- **Archivos**: `src/utils/session-aggregate.js` (**crear**)
- **Qué hacer**: módulo CommonJS puro y sin dependencias (mismo patrón que
  `src/utils/time-format.js`), con cuatro funciones:
  ```javascript
  filterByInterval(entries, from, to)  // comparación de strings sobre `date`, inclusivo en ambos extremos
  aggregateByApp(entries)              // → [{ appId, app, durationMs }], desc por durationMs
  buildDayTimeline(entries)            // → [{ type:'session', entry } | { type:'group', groupId, groupName, durationMs, members }], asc por el startedAt mínimo de cada bloque
  monthBounds(dateStr)                 // 'YYYY-MM-DD' → { from: 'YYYY-MM-01', to: 'YYYY-MM-<último día>' }
  ```
  `buildDayTimeline` colapsa las entradas con el mismo `groupId` en un único bloque
  `{ type: 'group', ... }` con `durationMs` como la suma de `durationMs` de sus miembros
  (D-3: nunca tiempo de reloj de pared) y con la posición del bloque dada por el `startedAt`
  mínimo entre sus miembros; las entradas sin `groupId` quedan como bloques
  `{ type: 'session', entry }` individuales. `monthBounds` calcula el último día del mes con
  `new Date(year, month, 0).getDate()` (mes en base 1 pasado como `month` da el día 0 del mes
  siguiente = último día del mes actual), cubriendo 28/29/30/31 sin tabla hardcodeada.
- **Modo**: [TDD] — puro, sin `fs` ni `electron`, verificable con `node -e` sin instalar
  nada.
- **Criterio de completado**, verificado en esta fase con el diseño exacto arriba descrito
  (los cuatro casos de `design.md` §Estrategia de Testing):
  ```bash
  node -e "
  const { filterByInterval, aggregateByApp, buildDayTimeline, monthBounds } = require('./src/utils/session-aggregate.js');
  const entries = [
    { date: '2026-08-01', appId: 'a', app: 'A', durationMs: 100, startedAt: 1, groupId: null },
    { date: '2026-08-02', appId: 'a', app: 'A', durationMs: 200, startedAt: 2, groupId: null },
    { date: '2026-08-02', appId: 'b', app: 'B', durationMs: 50, startedAt: 3, groupId: 'g1', groupName: 'Grupo' },
    { date: '2026-08-02', appId: 'c', app: 'C', durationMs: 70, startedAt: 4, groupId: 'g1', groupName: 'Grupo' },
    { date: '2026-08-03', appId: 'a', app: 'A', durationMs: 999, startedAt: 5, groupId: null },
  ];
  console.log('from==to:', filterByInterval(entries, '2026-08-02', '2026-08-02').length === 3);
  console.log('agg desc:', JSON.stringify(aggregateByApp(entries.filter(e => e.date === '2026-08-02'))));
  console.log('timeline colapsa grupo:', JSON.stringify(buildDayTimeline(entries.filter(e => e.date === '2026-08-02'))));
  console.log('agosto 31:', JSON.stringify(monthBounds('2026-08-15')));
  console.log('feb 2026 (28):', JSON.stringify(monthBounds('2026-02-10')));
  console.log('feb 2028 bisiesto (29):', JSON.stringify(monthBounds('2028-02-10')));
  "
  ```
  Prototipo ya validado en esta fase con exactamente esta salida: `filterByInterval` en el
  borde `from == to` da 3 entradas; `aggregateByApp` ordena A(200) > C(70) > B(50); el
  timeline produce un bloque `session` para A y un bloque `group` con `durationMs: 120` (suma
  de B+C) para `g1`; `monthBounds('2026-08-15') → {from:'2026-08-01', to:'2026-08-31'}`;
  `monthBounds('2026-02-10') → {to:'2026-02-28'}`; `monthBounds('2028-02-10') → {to:'2028-02-29'}`.

- [ ] `filterByInterval` incluye ambos extremos del rango.
- [ ] `aggregateByApp` suma `durationMs` por `appId`/`app` y ordena descendente.
- [ ] `buildDayTimeline` colapsa por `groupId` (suma de duraciones, nunca reloj de pared) y
  ordena por el `startedAt` mínimo del bloque.
- [ ] `monthBounds` resuelve correctamente 28, 29 (bisiesto), 30 y 31 días.
- [ ] Verificado con `node -e` sin dependencias instaladas.

### Tarea 12: Parser puro del historial legado

- **Archivos**: `src/main/session-log-parser.js` (**crear** — ver nota de refinamiento al
  inicio de este documento)
- **Qué hacer**: módulo puro (solo puede requerir `fs` para las funciones de Tarea 13, pero
  `parseLegacyLog` en sí no toca disco) que exporta `parseLegacyLog(text) → { entries,
  discardedCount }`, aplicando la regex existente hoy en `background.js:215`
  (`/\[(.*?)\] Aplicación: (.*?) \| Duración: (.*?) \| Inicio: (.*?) \| Fin: (.*)/`) línea a
  línea sobre `text.split(/\r?\n/).filter(Boolean)`. Por cada línea que matchea, reconstruir
  una entrada `{ id, date, appId: null, app, startedAt, endedAt, durationMs, sessionName:
  null, groupId: null, groupName: null }` con estas reglas exactas (D-2, ninguna es
  negociable):
  - `date`: la parte de fecha del prefijo `[YYYY-MM-DD HH:MM:SS]`.
  - `durationMs`: del campo `Duración` (parsear `HH:MM:SS` a milisegundos). **Nunca**
    `endedAt - startedAt`.
  - `endedAt`: `date` + campo `Fin`, combinados como fecha/hora **local** (no UTC).
  - `startedAt`: `date` + campo `Inicio`, local; si `Inicio > Fin` (comparación de string,
    válida porque ambos son `HH:MM:SS` de igual longitud), restar un día — la sesión cruzó
    medianoche.
  - `app`: el campo `Aplicación` tal cual viene, **incluido el literal `"null"`** cuando el
    log tiene `Aplicación: null` (no convertir a `null` de JS).
  - `id`: `` `${endedAt}-${counter}` ``, con `counter` incrementando por cada línea que sí
    matchea (para que las líneas duplicadas exactas, que el diseño exige conservar, tengan
    `id` distinto).
  - Líneas que no matchean: no producen entrada, incrementan `discardedCount`.
- **Modo**: [TDD] — puro, sin `electron`, verificable con `node -e` sin instalar nada.
- **Criterio de completado**, verificado en esta fase contra una **copia** de
  `usage-log.txt` (nunca el original) en el scratchpad de esta sesión:
  ```bash
  node -e "
  const { parseLegacyLog } = require('./src/main/session-log-parser.js');
  const fs = require('fs');
  const text = fs.readFileSync('/ruta/a/una/copia/usage-log.txt', 'utf-8');
  const { entries, discardedCount } = parseLegacyLog(text);
  console.log('entries', entries.length, 'discarded', discardedCount);
  console.log('null literal conservado:', entries.some(e => e.app === 'null'));
  const dupChrome = entries.filter(e => e.app === 'Chrome' && e.durationMs === 615000);
  console.log('duplicadas exactas conservadas (3):', dupChrome.length === 3);
  console.log('duración del campo, no de la resta:', entries.some(e => e.durationMs === 5000 && (e.endedAt - e.startedAt) !== 5000));
  "
  ```
  Ya ejecutado en esta fase contra la copia real (32 líneas): resultado exacto
  `entries=32, discarded=0`; la línea `Aplicación: null` se conserva con `app: 'null'` y
  `durationMs: 16000`; las 3 líneas duplicadas exactas de Chrome (`Duración: 00:10:15`) se
  conservan como 3 entradas con `durationMs: 615000` cada una; la entrada con
  `Duración: 00:00:05 | Inicio: 11:41:06 | Fin: 11:42:24` da `durationMs: 5000` mientras que
  `endedAt - startedAt` de esa misma entrada da `78000` — confirma que `durationMs` viene del
  campo, no de la resta.

- [ ] `parseLegacyLog` no requiere `electron` (solo, si acaso, `fs`/`path` del núcleo).
- [ ] `durationMs` sale del campo `Duración`, nunca de `endedAt - startedAt`.
- [ ] `startedAt` resta un día cuando `Inicio > Fin` (cruce de medianoche).
- [ ] El literal `"null"` de `Aplicación` se conserva tal cual, sin convertir a `null`.
- [ ] Líneas duplicadas exactas producen entradas separadas con `id` distinto.
- [ ] Verificado contra la copia real: 32 entradas, 0 descartadas, los tres controles de
  arriba pasan.

### Tarea 13: Migración one-shot idempotente (`migrateLegacyLogAt`)

- **Archivos**: `src/main/session-log-parser.js`
- **Depende de**: Tarea 12
- **Qué hacer**: agregar `migrateLegacyLogAt({ sessionsPath, legacyPath, backupPath })` al
  mismo módulo, con rutas explícitas como parámetro (no resuelve `userData` — eso lo hace
  `session-log.js` en Tarea 14, para mantener este módulo libre de `electron`). Implementa el
  protocolo de tres pasos de [[0007-structured-sessions-json-with-one-shot-migration]]:
  1. Si `sessionsPath` **no** existe: leer `legacyPath` (si tampoco existe, texto vacío),
     `parseLegacyLog`, escribir el resultado en `sessionsPath + '.tmp'`
     (`JSON.stringify(entries, null, 2)`), y recién entonces `fs.renameSync` a
     `sessionsPath`. Si `sessionsPath` ya existe, saltar este paso completo (ya migrado).
  2. Si `legacyPath` existe y `backupPath` no existe: `fs.renameSync(legacyPath, backupPath)`.
     Este paso es independiente del paso 1 y corre siempre que aplique, incluso si el paso 1
     se saltó por "ya migrado".
  El archivo original **nunca se borra**, solo se renombra. No hay ningún punto entre estos
  pasos donde `sessionsPath` exista parcialmente escrito.
- **Modo**: [TDD] — usa `fs`/`path` del núcleo, sin `electron`; verificable con `node -e`
  sobre un directorio temporal con una copia del log real.
- **Criterio de completado**, verificado en esta fase, protocolo completo contra una copia
  real, incluida la idempotencia:
  ```bash
  node -e "
  const { migrateLegacyLogAt } = require('./src/main/session-log-parser.js');
  const fs = require('fs');
  const paths = { sessionsPath: './scratch/sessions.json', legacyPath: './scratch/usage-log.txt', backupPath: './scratch/usage-log.txt.bak' };
  // (./scratch/usage-log.txt es una COPIA del real, nunca el original)
  migrateLegacyLogAt(paths);
  const s1 = JSON.parse(fs.readFileSync(paths.sessionsPath, 'utf-8'));
  console.log('1ra corrida: sessions=', s1.length, 'legacy existe=', fs.existsSync(paths.legacyPath), 'bak existe=', fs.existsSync(paths.backupPath));
  migrateLegacyLogAt(paths); // 2da corrida: no debe fallar ni cambiar nada
  const s2 = JSON.parse(fs.readFileSync(paths.sessionsPath, 'utf-8'));
  console.log('2da corrida idempotente:', JSON.stringify(s1) === JSON.stringify(s2));
  "
  ```
  Ya ejecutado en esta fase: 1ra corrida → `sessions=32`, `legacy existe=false`,
  `bak existe=true`; 2da corrida → contenido idéntico, sin error. También verificar el corte
  a medio camino: correr solo el paso 1 (simulando una interrupción antes del paso 2, con un
  `sessions.json` ya escrito pero el `.txt` todavía presente) y confirmar que una corrida
  posterior de `migrateLegacyLogAt` completa el paso 2 sin reprocesar el paso 1 (el
  `sessions.json` no cambia).

- [ ] El original nunca se borra: solo se renombra a `.bak`.
- [ ] El paso de escritura de `sessions.json` usa `.tmp` + `renameSync`, nunca escribe
  directo sobre `sessionsPath`.
- [ ] Los pasos 1 y 2 son independientes: una interrupción entre ambos se resuelve sola en la
  corrida siguiente.
- [ ] Correr dos veces seguidas produce el mismo `sessions.json` (idempotencia verificada).
- [ ] Verificado contra una copia real: 32 entradas migradas, `.bak` creado, original ausente.

### Tarea 14: `session-log.js` dueño de `sessions.json`

- **Archivos**: `src/main/session-log.js` (reescritura mayor)
- **Depende de**: Tarea 11, Tarea 13
- **Qué hacer**: reescribir el módulo para que sea el dueño único del archivo (D-1). Requiere
  `session-log-parser.js` (Tarea 12/13) y `session-aggregate.js` (Tarea 11, para
  `filterByInterval`), además de `jsonStore.js` (para las escrituras normales, no la de la
  migración, que usa su propio `tmp`+`rename`).
  - Estado en memoria: `let sessions = []`, cargado una vez.
  - `migrateLegacyLog()`: resuelve las rutas reales con `app.getPath('userData')` (`sessions.json`,
    `usage-log.txt`, `usage-log.txt.bak`) y delega en `migrateLegacyLogAt(...)` de Tarea 13;
    al terminar, carga el `sessions.json` resultante en el array `sessions` con
    `jsonStore.readJson(getSessionsFilePath(), [])` (siempre existe en este punto, la
    migración lo garantiza).
  - `appendSessions(rows, endDate)`: construye una entrada por cada `row` (mismo shape que
    produce el parser: `id`, `date` con `formatDateYYYYMMDD(endDate)` de `time-format.js`
    —**nunca** `toISOString()`—, `appId: row.appId`, `app: row.name`, `startedAt:
    row.sessionStartedAt`, `endedAt: endDate.getTime()`, `durationMs: row.elapsedMs`,
    `sessionName: row.sessionName || null`, `groupId: row.groupId || null`, `groupName:
    row.groupName || null`), las hace `push` a `sessions`, y escribe **una sola vez** con
    `jsonStore.writeJson(getSessionsFilePath(), sessions)` (que ya es síncrono —
    `fs.writeFileSync` — sin cambios necesarios en `json-store.js`). Usar un contador
    incremental en memoria para el sufijo del `id` (reinicia en cada arranque del proceso,
    igual que el parser de migración).
  - `appendSession(row, endDate)`: se mantiene como función exportada (los llamadores
    existentes en `monitor-engine.js` la siguen usando por fila individual), delega en
    `appendSessions([row], endDate)`.
  - `readSessions({ from, to })`: `filterByInterval(sessions, from, to)` ordenado por
    `startedAt` ascendente.
  - `listSessionDates()`: `[...new Set(sessions.map(e => e.date))]`.
  - Eliminar `buildSessionLine` y todo uso de `fs.appendFile` (el `fs` de callback
    asíncrono desaparece del archivo).
- **Criterio de completado**: no es puro (usa `electron.app`), verificación manual + lectura
  de código. Confirmar por lectura que no queda ningún `fs.appendFile` en el archivo (`grep
  -n "appendFile" src/main/session-log.js` → sin resultados). Verificación de integración en
  Windows: cerrar una fila (■ o cierre de proceso) y confirmar que `sessions.json` gana una
  entrada nueva con el shape correcto y `date` en hora local (no UTC).

- [ ] `sessions` vive en memoria, cargado una vez por `migrateLegacyLog()`.
- [ ] `appendSessions(rows, endDate)` es la única función que escribe a disco, con una sola
  llamada a `jsonStore.writeJson` por invocación (no una por fila).
- [ ] `appendSession(row, endDate)` delega en `appendSessions([row], endDate)`.
- [ ] `readSessions({from,to})` usa `filterByInterval` de `session-aggregate.js` y ordena por
  `startedAt`.
- [ ] `listSessionDates()` devuelve fechas únicas.
- [ ] `buildSessionLine` y todo `fs.appendFile` fueron eliminados del archivo.
- [ ] `date` de cada entrada usa `formatDateYYYYMMDD`, nunca `toISOString()`.

### Tarea 15: Integración de la migración en el arranque + eliminación de `get-app-logs`

- **Archivos**: `src/background.js`
- **Depende de**: Tarea 13, Tarea 14
- **Qué hacer**: en `createWindow()`, agregar `sessionLog.migrateLegacyLog()` **antes** de
  `await monitorEngine.loadSelection()` (Tarea 7 la deja `async`) — el orden es la invariante
  de ADR-0007: si el motor pudiera abrir sesiones antes de que la migración corra, crearía
  `sessions.json` prematuramente y la migración se saltearía, perdiendo el historial legado.
  Eliminar el handler `get-app-logs` completo (líneas 206-223: la constante `logFilePath`, el
  `ipcMain.handle('get-app-logs', ...)` y su regex) — D-9 lo reemplaza por los canales de
  Tarea 17.
- **Criterio de completado**: por lectura, `sessionLog.migrateLegacyLog()` aparece antes que
  `monitorEngine.loadSelection()` en el flujo de `createWindow()`; `grep -n "get-app-logs"
  src/` no encuentra ningún registro del canal (sí puede haber referencias muertas en el
  renderer, que Tarea 22 elimina). Verificación de integración en Windows: primer arranque
  después de este cambio con el `userData` real (o una copia) → `sessions.json` aparece con
  32 entradas, `usage-log.txt` se renombra a `.bak`.

- [ ] `sessionLog.migrateLegacyLog()` corre antes que `monitorEngine.loadSelection()`.
- [ ] El handler `get-app-logs` y su regex fueron eliminados de `background.js`.
- [ ] Verificado en Windows (o vía interop sobre una copia): la migración corre en el primer
  arranque y deja `sessions.json` + `usage-log.txt.bak`.

### Tarea 16: Cierre sincrónico de sesiones al salir

- **Archivos**: `src/main/monitor-engine.js`, `src/background.js`
- **Depende de**: Tarea 14
- **Qué hacer**: agregar `closeAllRows(motivo)` a `monitor-engine.js`: si `rows.length === 0`
  no hace nada; si no, llama `sessionLog.appendSessions(rows, new Date())` en **una sola**
  operación (no un `forEach` con `appendSession` por fila — D-4 exige una única escritura
  sincrónica), y vacía `rows = []`. Exportarla. En `background.js`, agregar
  `app.on('before-quit', () => monitorEngine.closeAllRows('app-quit'))`. El trabajo dentro de
  `before-quit` debe ser enteramente sincrónico — `appendSessions` ya lo es desde Tarea 14
  (`jsonStore.writeJson` usa `fs.writeFileSync`), así que no hace falta ningún cambio
  adicional para garantizarlo, solo confirmarlo por lectura.
- **Criterio de completado**: por lectura, ningún `await` ni callback asíncrono entre
  `before-quit` y la escritura final a disco. Verificación manual en Windows: abrir 2+ filas,
  salir por el menú de la bandeja (`app.isQuiting = true; app.quit()`, ya dispara
  `before-quit`) → `sessions.json` gana una entrada por fila abierta, cada una con la
  duración hasta ese instante. Repetir saliendo por `window-all-closed` (la otra ruta de
  salida que converge en `app.quit()`).

- [ ] `closeAllRows(motivo)` registra todas las filas abiertas en una sola llamada a
  `appendSessions`.
- [ ] `before-quit` invoca `closeAllRows('app-quit')`.
- [ ] Confirmado por lectura: el camino completo de `before-quit` a la escritura en disco es
  síncrono.
- [ ] Verificado en Windows: salir con filas abiertas registra una entrada por fila, por las
  dos rutas de salida (bandeja y `window-all-closed`).

### Tarea 17: Canales `get-sessions` / `get-session-dates`

- **Archivos**: `src/main/ipc-handlers.js`
- **Depende de**: Tarea 14
- **Qué hacer**: registrar dos canales nuevos:
  ```javascript
  ipcMain.handle('get-sessions', (event, { from, to }) => sessionLog.readSessions({ from, to }))
  ipcMain.handle('get-session-dates', () => sessionLog.listSessionDates())
  ```
  Requerir `session-log.js` en el archivo (hoy `ipc-handlers.js` no lo requiere).
- **Criterio de completado**: verificación de integración en Windows (o vía interop sobre una
  copia migrada): invocar `get-sessions` con `{ from: '2025-04-01', to: '2025-04-30' }` sobre
  el historial migrado (Tarea 15) y confirmar que devuelve solo las entradas de abril 2025,
  ordenadas por `startedAt`; invocar `get-session-dates` y confirmar que devuelve las 9 fechas
  distintas que `design.md` V1 documentó para el log real.

- [ ] `get-sessions` filtra por `{from, to}` usando `readSessions`.
- [ ] `get-session-dates` devuelve fechas únicas usando `listSessionDates`.
- [ ] Verificado contra el historial migrado: el filtro por rango y las fechas únicas son
  correctos.

### Tarea 18: Metadata de sesión y grupo en el motor

- **Archivos**: `src/main/monitor-engine.js`, `src/main/ipc-handlers.js`,
  `src/stores/monitoredApps.js`
- **Depende de**: Tarea 7, Tarea 14
- **Qué hacer**:
  1. `monitor-engine.js`: agregar `sessionName: null`, `groupId: null`, `groupName: null` a
     la fila en los tres puntos donde se crea una fila (`reduceLifecycle` alta, líneas
     ~94-104; `addToSelection`, líneas ~358-368) — al mismo nivel que `elapsedMs` (D-3, son
     propiedades de la fila, no una entidad aparte). `getSnapshot()` los expone en cada fila
     del array `rows`.
     - `renameSession(appId, name)`: busca la fila por `appId` en `rows`, asigna
       `row.sessionName = name || null`, `notify()`.
     - `renameGroup(groupId, name)`: escribe `groupName = name || null` en **todas** las
       filas de `rows` con ese `groupId`, `notify()`.
     - `setRowGroup(appId, groupId)`: busca la fila por `appId`; si `groupId` es truthy,
       asigna `row.groupId = groupId` y `row.groupName` = el `groupName` que ya tengan otras
       filas con ese `groupId` (o `null` si es el primer miembro — el nombre se pone después,
       vía `renameGroup`, con el mismo mecanismo inline de Tarea 19); si `groupId` es
       `null`/falsy, limpia `row.groupId = null` y `row.groupName = null`. `notify()`.
     Exportar las tres.
  2. `ipc-handlers.js`: registrar como `send`/`on` (sin respuesta — el efecto vuelve en el
     snapshot siguiente, mismo patrón que `stop-monitored-row`):
     ```javascript
     ipcMain.on('rename-session', (event, appId, name) => monitorEngine.renameSession(appId, name))
     ipcMain.on('rename-group', (event, groupId, name) => monitorEngine.renameGroup(groupId, name))
     ipcMain.on('set-row-group', (event, appId, groupId) => monitorEngine.setRowGroup(appId, groupId))
     ```
  3. `stores/monitoredApps.js`: tres acciones que solo hacen `ipcRenderer.send(...)` (el
     snapshot llega por el listener ya suscrito en `init()`, igual que `stopRow`):
     ```javascript
     renameSession(appId, name) { ipcRenderer.send('rename-session', appId, name) },
     renameGroup(groupId, name) { ipcRenderer.send('rename-group', groupId, name) },
     setRowGroup(appId, groupId) { ipcRenderer.send('set-row-group', appId, groupId) },
     ```
- **Criterio de completado**: verificación de integración en Windows — cambiar el nombre de
  una fila y confirmar que el snapshot siguiente lo refleja; cerrar esa fila y confirmar que
  `sessions.json` (Tarea 14) registra la entrada con `sessionName` no nulo; llamar
  `setRowGroup` sobre dos filas con el mismo `groupId` y confirmar que ambas aparecen con
  `groupId`/`groupName` iguales en el snapshot.

- [ ] `sessionName`/`groupId`/`groupName` existen en toda fila creada, con default `null`.
- [ ] `getSnapshot()` expone los tres campos por fila.
- [ ] `renameSession`, `renameGroup`, `setRowGroup` implementadas y exportadas.
- [ ] Los tres canales IPC registrados como `send`/`on`.
- [ ] Las tres acciones del store implementadas.
- [ ] Verificado: renombrar una sesión y cerrarla persiste el nombre en `sessions.json`.

### Tarea 19: Nombre de sesión inline en la fila

- **Archivos**: `src/components/AppRow.vue`
- **Depende de**: Tarea 18
- **Qué hacer**: agregar edición inline sobre la etiqueta de nombre (`.app-name`, línea 7):
  estado local `editing: false`, `draftName: ''`; click en la etiqueta cuando la sesión está
  abierta → `editing = true`, `draftName = row.sessionName || ''`, mostrar `<input>` en el
  lugar de la etiqueta con el valor precargado; `Enter` → `monitoredApps.renameSession(row.appId,
  draftName)`, `editing = false`; `Esc` → `editing = false` sin llamar `renameSession` (el
  nombre vuelve a ser el que `row.sessionName` ya tenía, sin necesidad de revertir nada
  manualmente porque el store no se tocó). Sin nombre, mostrar el nombre del programa como
  hoy (comportamiento idéntico al actual cuando `sessionName` es `null`).
- **Criterio de completado**: verificación manual — click en la etiqueta abre el input con el
  valor actual; Enter confirma y el snapshot siguiente refleja el nombre nuevo; Esc cancela
  sin persistir ningún cambio; una fila nunca nombrada se ve exactamente igual que antes de
  este cambio.

- [ ] Click en la etiqueta de una fila con sesión abierta inicia la edición con el valor
  actual precargado.
- [ ] Enter llama `renameSession` con el valor editado y cierra la edición.
- [ ] Esc cierra la edición sin llamar `renameSession`.
- [ ] Una fila sin `sessionName` se comporta igual que antes de este cambio.

---

## Etapa 5 — Grupos (P4) · D-7

**Specs**: [[group-composition-and-drag]]

### Tarea 20: Grupos por arrastre + guarda `isDragging` + eliminar modal de historial muerto

- **Archivos**: `src/components/CronometroAplicacion.vue`
- **Depende de**: Tarea 18
- **Qué hacer**:
  1. Reemplazar el listado plano de `AppRow` (líneas 23-29) por dos arrays locales derivados
     del snapshot: `dragUngrouped` (filas con `groupId: null`) y `dragGrouped` (filas con
     `groupId` no nulo, agrupadas por `groupId` para renderizar la cabecera + sus filas). Un
     `watch` sobre `monitoredApps.rows` reconstruye ambos arrays en cada snapshot — **excepto
     mientras `isDragging` es `true`**, momento en el que el watch no toca los arrays.
  2. Dos `<draggable v-model="..." group="monitored-rows" item-key="appId" @start="isDragging
     = true" @end="isDragging = false" @change="onDragChange">`, uno para `dragUngrouped` y
     uno (por grupo activo) para las filas de `dragGrouped`. No hace falta configurar
     `pull`/`put`: el mismo `group` de tipo string en ambas listas habilita el cross-list por
     defecto (V11, verificado sobre el código real de `sortablejs`).
  3. `onDragChange(evt)`: si `evt.added` → `monitoredApps.setRowGroup(evt.added.element.appId,
     groupIdDelDestino)` (`null` si el destino es el listado suelto); si `evt.removed` no
     hace falta actuar (el `added` de la lista destino ya cubre el efecto completo del
     cross-list — son dos eventos por el mismo gesto, D9 de `tech-context.md`). La mutación
     local que hizo `vuedraggable` en los arrays (`dragUngrouped`/`dragGrouped`) es
     **descartada** en el próximo snapshot que llega (el `watch`, ya no suspendido tras
     `@end`, reconstruye ambos arrays desde el estado autoritativo del main).
  4. El contenedor de grupo aparece como franja delgada ("Arrastrá aquí para agrupar") cuando
     `dragUngrouped.length >= 2`, y se convierte en cabecera con nombre editable (mismo
     mecanismo inline de Tarea 19, pero llamando `monitoredApps.renameGroup(groupId, name)`)
     en cuanto recibe su primera fila. Un solo contenedor de grupo activo a la vez (D-7:
     límite de la interfaz, no del modelo — `groupId` ya soporta N grupos).
  5. Eliminar el bloque `<div v-if="showHistory" class="modal-overlay">...</div>` completo
     (líneas 34-45 del template) y cualquier referencia a `showHistory` — es código muerto:
     `showHistory`, `filteredLogs` y `loadLogsForDate` no existen en el `<script>` (solo
     `monitoredApps` y `showSelector` están en `data()`), y consumía el canal `get-app-logs`
     que Tarea 15 elimina.
- **Criterio de completado**: verificación manual en Windows (drag & drop no es verificable
  con `node -e`) — arrastrar una fila a la franja crea el grupo con cabecera editable;
  arrastrar una segunda fila al mismo grupo la suma sin tocar el reloj de la primera; sacar
  una fila del grupo la devuelve al listado suelto; un grupo sin filas deja de mostrarse;
  arrastrar y mantener el gesto más de un segundo (para que un snapshot de 1000ms llegue en
  medio) no rompe el arrastre — la guarda `isDragging` lo cubre. Por lectura: el bloque del
  modal muerto y toda referencia a `showHistory` desaparecieron del archivo.

- [ ] Dos `<draggable>` con `group="monitored-rows"` sobre arrays derivados del snapshot.
- [ ] La guarda `isDragging` suspende la reconstrucción de los arrays durante el gesto.
- [ ] `@change` traduce el gesto a `setRowGroup`, sin persistir mutación local optimista más
  allá del próximo snapshot.
- [ ] La franja aparece con ≥2 filas sueltas y se vuelve cabecera editable con la primera
  fila del grupo.
- [ ] El modal de historial muerto (`showHistory` y sus referencias) fue eliminado.
- [ ] Verificado en Windows: agrupar, desagrupar, grupo vacío desaparece, arrastre sostenido
  >1s no se rompe con un snapshot en medio.

---

## Etapa 6a — Historial: dos vistas + gráfico del día · D-10, D-11

**Specs**: [[session-view]], [[usage-chart-by-interval]]

### Tarea 21: Dependencias `chart.js` + `vue-chartjs`

- **Archivos**: `package.json`
- **Qué hacer**: agregar a `dependencies`: `"chart.js": "^4.5.1"`, `"vue-chartjs": "^5.3.4"`
  (peer deps verificadas en `tech-context.md`: `vue-chartjs@5` exige `chart.js@^4.1.1` y
  `vue@^3.0.0-0 || ^2.7.0`; el proyecto resuelve `vue@3.5.13`, compatible). Correr `npm
  install` para que el lockfile las resuelva.
- **Criterio de completado**: `package.json` lista ambas dependencias; `npm ls chart.js
  vue-chartjs` (o inspección de `package-lock.json`) confirma versiones resueltas
  compatibles entre sí.

- [ ] `chart.js` y `vue-chartjs` agregadas a `dependencies` en `package.json`.
- [ ] `npm install` corrido, lockfile actualizado con versiones compatibles.

### Tarea 22: `HistoryView.vue` — shell (calendario, pestañas, IPC, fix de zona horaria)

- **Archivos**: `src/history/HistoryView.vue` (reescritura mayor)
- **Depende de**: Tarea 17, Tarea 11
- **Qué hacer**: reescribir el componente para que sea el shell que sostiene el estado
  compartido:
  - `selectedDate` (día del calendario), `chartScope` ('day'/'month'/'range', ver Tarea 26),
    `customRange`, y la vista activa ('byApp'/'bySession').
  - Reemplazar `loadLogs()`/`get-app-logs` por `ipcRenderer.invoke('get-session-dates')` (para
    los puntos del calendario) y `ipcRenderer.invoke('get-sessions', { from, to })` (para las
    entradas del día seleccionado, con `from === to === selectedDate` formateado).
  - **Corregir el defecto de zona horaria (V15), obligatorio**: `loadLogsForDate` hoy compara
    con `date.toISOString().split('T')[0]` (UTC) contra un campo `date` escrito en hora
    local — en Chile (UTC-4), abrir el historial después de las 20:00 consulta el día
    siguiente y muestra la lista vacía. Reemplazar **todo** manejo de fechas de la ventana
    (el valor por defecto de `selectedDate`, la comparación al filtrar, el `handleDateClick`)
    por `formatDateYYYYMMDD` de `src/utils/time-format.js` — la misma función que
    `session-log.js` usa para escribir el campo (Tarea 14) —, nunca `toISOString()`.
  - Renderizar `<ByAppView>` o `<BySessionView>` según la pestaña activa (Tarea 23, 24),
    pasándoles las entradas del día ya filtradas (sin que ellas hagan IPC).
  - Renderizar `<UsageChart>` (Tarea 25) con el intervalo derivado del `chartScope` vigente
    (en esta etapa, fijo a `day`; Tarea 26 agrega mes/rango).
- **Criterio de completado**: verificación manual en Windows — abrir el historial después de
  las 20:00 hora de Chile y confirmar que el día por defecto es hoy, con sus sesiones
  visibles (control de regresión directo de V15); cambiar de día en el calendario actualiza
  ambas vistas; los puntos del calendario (`get-session-dates`) coinciden con los días reales
  del historial migrado.

- [ ] `get-app-logs` reemplazado por `get-sessions`/`get-session-dates`.
- [ ] Ningún uso de `toISOString()` para fechas de la ventana: todo pasa por
  `formatDateYYYYMMDD`.
- [ ] El shell sostiene `selectedDate`, `chartScope`, `customRange` y la pestaña activa.
- [ ] Verificado después de las 20:00 hora local: el día por defecto es hoy y muestra sus
  sesiones (V15 corregido).

### Tarea 23: `ByAppView.vue` — tabla actual como componente de presentación

- **Archivos**: `src/history/ByAppView.vue` (**crear**)
- **Depende de**: Tarea 22
- **Qué hacer**: extraer la tabla actual (colapso por programa, como ya hace
  `loadLogsForDate`) a un componente de presentación pura — recibe las entradas del día ya
  filtradas por prop, sin IPC propio, mismo criterio que `AppRow.vue` (D-10). Usa
  `aggregateByApp` de `session-aggregate.js` (Tarea 11) para el colapso, en vez de reducir a
  mano con un objeto `grouped` como hace el código actual.
- **Criterio de completado**: verificación manual — el resultado visible es idéntico al de
  la tabla actual (mismos programas, mismas duraciones sumadas) para un mismo día.

- [ ] Componente de presentación pura, sin IPC.
- [ ] Usa `aggregateByApp` para el colapso por programa.
- [ ] El resultado visible coincide con el de la tabla actual para el mismo día.

### Tarea 24: `BySessionView.vue` — lista cronológica con grupos como bloque

- **Archivos**: `src/history/BySessionView.vue` (**crear**)
- **Depende de**: Tarea 22, Tarea 11
- **Qué hacer**: componente de presentación pura que recibe las entradas del día por prop y
  usa `buildDayTimeline` de `session-aggregate.js` para renderizar, en orden cronológico, un
  bloque por sesión suelta (nombre si tiene, rango horario `HH:MM:SS`–`HH:MM:SS`, duración) y
  un bloque por grupo (nombre del grupo, su duración total derivada, y cada entrada miembro
  debajo). Una sesión sin nombre muestra una etiqueta neutra con el nombre del programa en su
  lugar.
- **Criterio de completado**: verificación manual — un día con sesiones sueltas y agrupadas
  muestra el orden cronológico correcto; el bloque de grupo muestra el total como suma de sus
  miembros (no reloj de pared); una sesión sin nombre muestra el nombre del programa como
  etiqueta.

- [ ] Usa `buildDayTimeline` para la lista y el colapso por grupo.
- [ ] Un grupo se muestra como bloque único con su total derivado y sus miembros debajo.
- [ ] Una sesión sin nombre muestra una etiqueta neutra (nombre del programa).

### Tarea 25: `UsageChart.vue` — gráfico de barras horizontales, tema oscuro

- **Archivos**: `src/history/UsageChart.vue` (**crear**)
- **Depende de**: Tarea 21, Tarea 22, Tarea 11
- **Qué hacer**: componente `<Bar>` de `vue-chartjs`, con registro explícito y mínimo
  (`BarElement`, `CategoryScale`, `LinearScale`, `Tooltip` — sin `Legend` ni `Title`, sin
  `chart.js/auto`), `indexAxis: 'y'`, defaults globales fijados una sola vez
  (`ChartJS.defaults.color = '#f0f0f0'`, `ChartJS.defaults.font.family = "'Architects
  Daughter', cursive"`), `scales.x.grid.display = false` y `scales.y.grid.display = false`,
  `responsive: true` + `maintainAspectRatio: false`. El dataset se construye en un
  `computed` a partir de `aggregateByApp` sobre las entradas del intervalo recibidas por
  prop (evita el warning `Target is readonly` de `vue-chartjs` — no pasar un valor reactivo
  de solo lectura directo). El contenedor tiene `overflow-y: auto` y `max-height`, con el
  alto real calculado como `nApps * altoDeBarra + margen`. Una cabecera HTML propia (no
  `plugins.title`, más barata) rotula el intervalo vigente recibido por prop. Sin adaptador
  de fechas (el eje de categorías son nombres de programa).
- **Criterio de completado**: verificación manual — con alcance día, los totales del gráfico
  coinciden exactamente con `ByAppView` (misma fuente, `aggregateByApp`, sobre el mismo
  conjunto filtrado); ninguna aplicación con uso queda fuera del gráfico; un intervalo con
  más aplicaciones de las que caben en pantalla se recorre con scroll, sin comprimir barras
  ni agrupar bajo "Otras"; sin conexión a internet, el gráfico y la ventana caen a la
  tipografía de respaldo sin romperse (limitación heredada, documentada en
  [[0010-charting-library-confined-to-history-bundle]], no una regresión de esta tarea).

- [ ] Registro explícito y mínimo de chart.js (sin `chart.js/auto`, sin `Legend`/`Title`).
- [ ] `indexAxis: 'y'`, sin grid decorativo, defaults oscuros fijados una sola vez.
- [ ] El dataset sale de un `computed` sobre `aggregateByApp`.
- [ ] El contenedor crece con la cantidad de aplicaciones y scrollea, sin top-N ni "Otras".
- [ ] Verificado: los totales con alcance día coinciden con `ByAppView`.

---

## Etapa 6b — Alcance mes/rango · D-8, D-12

**Specs**: [[usage-chart-by-interval]]

### Tarea 26: Selector de alcance día/mes/rango + `v-date-picker` en modo rango

- **Archivos**: `src/history/HistoryView.vue`
- **Depende de**: Tarea 22, Tarea 25 (`monthBounds` ya existe desde Tarea 11 — no hace falta
  tocar `session-aggregate.js` de nuevo)
- **Qué hacer**: agregar un control de tres opciones (`chartScope: 'day' | 'month' |
  'range'`) en el shell. Derivar `{ from, to }` para el gráfico según la tabla de D-12:
  `day` → `{ selectedDate, selectedDate }`; `month` → `monthBounds(selectedDate)`; `range` →
  `{ customRange.start, customRange.end }` formateados a `YYYY-MM-DD`. Para `range`, usar
  **`<v-date-picker v-model.range="customRange" />`** — el modificador `.range` de `v-model`,
  **no** la prop `is-range` (esa es la API de v-calendar 2; la documentación pública que
  devuelve context7 corresponde a v2 y no debe copiarse — verificado en `tech-context.md`
  V12 contra los tipos reales de v-calendar 3.1.2: `ModelModifiers { range? }`,
  `DatePickerRangeObject { start, end }`). `<v-date-picker>` ya está disponible sin instalar
  nada (`app.use(VCalendar)` ya registra los componentes con prefijo `V`). La cabecera del
  gráfico (Tarea 25) recibe el rótulo del intervalo vigente (`"12 ago 2026"`, `"Agosto
  2026"`, `"12–19 ago"`) calculado en el shell. Las dos listas (`ByAppView`, `BySessionView`)
  **no** reciben `chartScope`: siguen ancladas a `selectedDate` sin cambios.
- **Criterio de completado**: verificación manual — cambiar el alcance a mes muestra el
  acumulado del mes completo con la cabecera rotulando el mes, mientras las dos listas de
  abajo siguen mostrando el día del calendario sin cambiar; elegir un rango con
  `<v-date-picker v-model.range>` muestra el acumulado de ese rango con la cabecera
  rotulando las fechas elegidas; un intervalo con más aplicaciones de las que caben se
  recorre con scroll (control de no regresión de Tarea 25).

- [ ] Control de tres opciones (día/mes/rango) en el shell.
- [ ] `{from, to}` derivado según la tabla de D-12 para cada alcance.
- [ ] `<v-date-picker v-model.range="customRange">`, no `is-range`.
- [ ] La cabecera del gráfico rotula el intervalo vigente en los tres alcances.
- [ ] Las dos listas de abajo no cambian cuando cambia `chartScope`.
- [ ] Verificado: mes y rango muestran totales correctos con las listas ancladas al día.

---

## Controles de no regresión (transversales, correr al cerrar cada bloque)

No son tareas nuevas — son las verificaciones que `design.md` fija sobre specs ya
completadas (`row-lifecycle` → `row-lifecycle-persistence-by-type`, `session-log-persistence`
→ `sessions-json-persistence`, `two-state-row-machine`, `simultaneous-limit`,
`saved-selection-only-monitoring`), que este cambio no debe alterar para las entradas `auto`:

- [ ] Con todas las entradas `auto` (sin tocar el toggle de Tarea 9): detener una fila y
  cerrar su proceso producen el mismo efecto que antes de este cambio (Escenario 1 de
  `row-lifecycle-persistence-by-type`, variante `auto`).
- [ ] El límite de 4 filas simultáneas sigue vigente, con y sin agrupar (Escenario 3 de
  `simultaneous-limit`, y el requisito explícito de `group-composition-and-drag` de no
  modificarlo).
