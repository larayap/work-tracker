---
type: change-tasks
change_name: "work-groups-history-time-format"
status: draft
spec_refs: ["[[multiple-simultaneous-groups]]", "[[hide-usage-chart-duration-scale]]", "[[usage-aggregation-by-visible-app-name]]", "[[judgment-fixes-sessions-groups-history-revised]]", "[[readable-session-title-typography]]", "[[session-time-without-seconds]]", "[[configurable-time-format-preference]]", "[[bright-chart-bars-on-dark-background]]"]
created: "2026-08-05"
updated: "2026-08-05"
tags: [change, tasks]
---

# Tasks: work-groups-history-time-format

29 tareas, numeración global secuencial (Tarea 1 → Tarea 29) para que las dependencias entre
specs sean explícitas con `Requiere: Tarea N`, aunque el documento esté organizado en
secciones por spec.

## Nota sobre TDD: no aplica como modo de trabajo

El proyecto **no tiene test runner ni framework de test**, y montar uno no está en el alcance
aprobado de este cambio. Ninguna tarea se marca `[TDD]`: sería decorativo sin un runner que
ejecute rojo→verde.

Lo más cercano disponible es el patrón **control negativo / control positivo con `node -e`**,
ya usado como precedente del proyecto para el fix F1 (ver ADR-0011). Se aplica donde el diseño
lo permite:

- **`session-aggregate.js`** (Tareas 1-4): hay comportamiento previo incorrecto que demostrar
  (14 filas con 3 rótulos duplicados) y comportamiento nuevo que confirma la corrección (11
  filas, sin duplicados, misma suma). Es control negativo/positivo genuino.
- **`time-format.js`** (Tareas 5-7): `formatTimeHHMM` es una función nueva, no la corrección de
  un bug — no hay "comportamiento incorrecto" previo que capturar. El control previo (Tarea 5)
  es un chequeo de grafo de llamadas (`grep`) antes de retirar `formatTimeHHMMSS`, no un control
  negativo de valores. El control posterior (Tarea 7) sí verifica los valores de la función
  nueva contra la tabla de casos del diseño.

El resto de los archivos (`.vue`, `ipc-handlers.js`, `settings.js`) no son ejecutables sin
`node_modules` (ausente en este worktree) ni sin Electron: su criterio de completado es
**observación explícita en la app corriendo** (Franja B: requiere `npm install` +
`electron:serve`, hoy bloqueado — ver `design.md §Estrategia de verificación sin test runner`)
o **Franja C** (requiere gesto de mouse). Cada tarea marca cuál de las cuatro categorías le
corresponde: `EJECUTABLE (node -e)`, `EJECUTABLE (grep)`, `VISUAL (Franja B)`, `VISUAL (Franja
C)`, o `REVISIÓN DE DIFF (sin ejecución)`.

## Orden de ejecución

1. **Módulos puros primero** (Tareas 1-8): `session-aggregate.js` (1-4) y `time-format.js` +
   `BySessionView.vue` (5-8). Son los únicos verificables hoy con `node -e`, sin dependencias
   entre sí. Dentro de este bloque, `time-format.js` (Tareas 5-7) debe completarse **antes**
   que `BySessionView.vue` (Tarea 8), o el import queda roto (`formatTimeHHMMSS` ya no existe).
2. **Cadena de la preferencia** (Tareas 9-16): `ipc-handlers.js` → `settings.js` →
   `OpcionesPanel.vue` → `HistoryView.vue`, de la fuente de verdad hacia los consumidores.
   `BySessionView.vue` (Tarea 8) ya quedó lista en el bloque anterior y no se vuelve a tocar
   acá — solo se verifica en conjunto (Tarea 16).
3. **Ajustes visuales** (Tareas 17-21): `UsageChart.vue` (17-19) y `AppRow.vue` (20-21).
   Independientes entre sí y del resto de las tareas.
4. **Refactor de N grupos** (Tareas 22-28): `CronometroAplicacion.vue`. El único cambio grande,
   y el único cuya verificación exige la app corriendo con mouse real (Franja C). No bloquea a
   ningún otro bloque ni depende de ellos.
5. **Revisión de no-regresión** (Tarea 29): `judgment-fixes-sessions-groups-history-revised` no
   introduce código; se revisa al final, contra el diff completo.

---

## Spec: Gráfico y lista de uso por aplicación, agrupados por nombre visible normalizado (`usage-aggregation-by-visible-app-name`)

### Tarea 1: Control negativo — capturar la salida actual de `aggregateByApp` antes de tocar el código

- **Archivos**: ninguno se modifica; se ejecuta contra `src/utils/session-aggregate.js` tal
  como está hoy y contra el `sessions.json` real del usuario.
- **Qué hacer**: correr el script de abajo **antes** de cualquier cambio de código y anotar los
  tres valores de salida (filas, rótulos repetidos, suma de `durationMs`) para compararlos
  contra la Tarea 3.
- **Criterio de completado — EJECUTABLE (node -e)**:

  ```bash
  # ejecutar desde la raíz del worktree
  node -e "
  const { aggregateByApp } = require('./src/utils/session-aggregate.js');
  const fs = require('fs');
  const entries = JSON.parse(fs.readFileSync('/mnt/c/Users/Luis Araya/AppData/Roaming/cronometro-apps/sessions.json', 'utf-8'));
  const rows = aggregateByApp(entries);
  const labels = rows.map(r => r.app);
  const dupes = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
  console.log('entradas de entrada:', entries.length);
  console.log('filas de salida:', rows.length);
  console.log('rotulos repetidos:', dupes);
  console.log('suma durationMs entrada:', entries.reduce((s,e)=>s+e.durationMs,0));
  console.log('suma durationMs salida:', rows.reduce((s,r)=>s+r.durationMs,0));
  "
  ```

  Valor de referencia ya medido en `sdd-design` (2026-08-05, mismo archivo real, 44 entradas):
  `filas de salida: 14`, `rotulos repetidos: ['Google Chrome', 'League of Legends', 'Firefox']`,
  `suma durationMs entrada === suma durationMs salida === 13697054`. Confirmado de nuevo en esta
  fase (`sdd-tasks`) con idéntico resultado. Si el `sessions.json` real cambió desde entonces
  (nuevas sesiones), los números absolutos pueden variar — lo que importa es que **antes** del
  cambio existan rótulos repetidos y que la suma de entrada y salida coincida.

- [ ] Correr el script y registrar los tres valores de salida antes de tocar código.
- [ ] Confirmar que aparece al menos un rótulo repetido (evidencia del defecto que la Tarea 2
  corrige).

### Tarea 2: Implementar la agrupación por nombre visible normalizado

- **Archivos**: `src/utils/session-aggregate.js`
- **Requiere**: Tarea 1 (el control negativo debe capturarse contra el código viejo).
- **Qué hacer**:
  - Agregar `normalizeAppName(app)` → `String(app ?? '').trim().toLowerCase()`.
  - Reescribir `groupKeyOf(entry)` → `` `name:${normalizeAppName(entry.app)}` `` — la clave deja
    de mirar `entry.appId` por completo; nunca vuelve a ser `appId` desnudo (invariante 1 de
    ADR-0011).
  - Reescribir `aggregateByApp(entries)` para que `appId` de la fila fusionada sea el **primer
    `appId` no nulo entre los miembros, o `null`** (informativo, nunca clave), y que `app` sea
    el rótulo más corto entre las variantes (criterio F4 de `installed-apps-filter.js:96-100`;
    ante empate de longitud gana la primera aparición). Ver el código de referencia completo en
    `design.md §D-2 → Función completa`.
  - Reescribir el comentario de cabecera de `groupKeyOf`/`aggregateByApp`: el párrafo actual
    explica la degradación por `appId` (fix F1) y queda obsoleto y engañoso si se deja. Debe
    decir explícitamente que `appId` ya no es clave y por qué no puede volver a serlo.
  - `buildDayTimeline`, `filterByInterval` y `monthBounds` no se tocan.
- **Modo**: no aplica TDD — módulo puro, verificado por control negativo/positivo (Tareas 1 y
  3).

- [ ] `normalizeAppName` agregada.
- [ ] `groupKeyOf` usa solo el nombre normalizado, nunca `entry.appId`.
- [ ] `aggregateByApp` calcula `appId` informativo y `app` por el criterio F4.
- [ ] Comentario de cabecera reescrito, sin mencionar la degradación por `appId` como
  comportamiento vigente.

### Tarea 3: Control positivo — confirmar la corrección contra los mismos datos reales

- **Archivos**: ninguno se modifica; se ejecuta contra el `src/utils/session-aggregate.js` ya
  corregido en la Tarea 2.
- **Requiere**: Tarea 2.
- **Qué hacer**: correr el mismo script de la Tarea 1 contra el código nuevo y comparar contra
  los valores anotados entonces.
- **Criterio de completado — EJECUTABLE (node -e)**:

  ```bash
  # mismo script que la Tarea 1, más las tres aserciones nuevas
  node -e "
  const { aggregateByApp } = require('./src/utils/session-aggregate.js');
  const fs = require('fs');
  const entries = JSON.parse(fs.readFileSync('/mnt/c/Users/Luis Araya/AppData/Roaming/cronometro-apps/sessions.json', 'utf-8'));
  const rows = aggregateByApp(entries);
  const labels = rows.map(r => r.app);
  const dupes = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
  const keys = rows.map(r => r.key);
  console.log('filas de salida:', rows.length);
  console.log('rotulos repetidos:', dupes);
  console.log('suma durationMs entrada:', entries.reduce((s,e)=>s+e.durationMs,0));
  console.log('suma durationMs salida:', rows.reduce((s,r)=>s+r.durationMs,0));
  console.log('claves unicas === filas:', new Set(keys).size === rows.length);
  console.log('chrome y google chrome coexisten:', rows.some(r => r.key === 'name:chrome') && rows.some(r => r.key === 'name:google chrome'));
  "
  ```

  Resultado esperado (medido en `sdd-design` sobre los mismos 44 registros): `filas de salida:
  11` (antes 14), `rotulos repetidos: []`, suma de entrada **igual** a la suma de salida **e
  igual** a la anotada en la Tarea 1, `claves unicas === filas: true`, `chrome y google chrome
  coexisten: true`.

- [ ] Filas de salida menores que en la Tarea 1, sin rótulos repetidos.
- [ ] Suma de `durationMs` de salida idéntica a la de la Tarea 1 (no se pierde ni se duplica
  tiempo).
- [ ] `key` única por fila (`new Set(keys).size === rows.length`).
- [ ] `name:chrome` y `name:google chrome` coexisten como filas separadas (ningún programa
  distinto se fusiona).

### Tarea 4: Verificar el criterio de rótulo F4 con un caso fabricado

- **Archivos**: ninguno se modifica.
- **Requiere**: Tarea 2.
- **Qué hacer**: confirmar que, ante dos variantes de escritura del mismo nombre, gana la más
  corta.
- **Criterio de completado — EJECUTABLE (node -e)**:

  ```bash
  node -e "
  const { aggregateByApp } = require('./src/utils/session-aggregate.js');
  const rows = aggregateByApp([
    { app: 'Chrome ', appId: null, durationMs: 1000 },
    { app: 'Chrome', appId: null, durationMs: 2000 },
  ]);
  console.log(JSON.stringify(rows));
  "
  ```

  Resultado esperado: una única fila, `app: 'Chrome'` (sin el espacio final), `durationMs:
  3000`.

- [ ] El script devuelve exactamente 1 fila.
- [ ] El rótulo elegido es `'Chrome'`, sin espacio sobrante.
- [ ] `durationMs` es la suma de las dos entradas fabricadas.

---

## Spec: Horario de inicio y cierre de una sesión sin segundos (`session-time-without-seconds`)

### Tarea 5: Control previo — confirmar el único llamador de `formatTimeHHMMSS` antes de retirarla

- **Archivos**: ninguno se modifica.
- **Qué hacer**: correr `grep` sobre `src/` para confirmar que `formatTimeHHMMSS` no tiene más
  llamadores que `BySessionView.vue`, antes de eliminarla.
- **Criterio de completado — EJECUTABLE (grep)**:

  ```bash
  grep -rn "formatTimeHHMMSS" src/
  ```

  Resultado ya confirmado en esta fase (`sdd-tasks`): 4 líneas — la definición y el export en
  `src/utils/time-format.js`, y el import más una línea de uso (dos llamadas) en
  `src/history/BySessionView.vue`. Ningún otro archivo aparece.

- [ ] El único consumidor de `formatTimeHHMMSS` es `BySessionView.vue`.

### Tarea 6: Agregar `formatTimeHHMM` y retirar `formatTimeHHMMSS`

- **Archivos**: `src/utils/time-format.js`
- **Requiere**: Tarea 5.
- **Qué hacer**:
  - Agregar `formatTimeHHMM(dateObj, format)`: 24h por defecto (incluido `format === undefined`
    o cualquier valor distinto de `'12h'`), `HH:MM` con cero a la izquierda; con
    `format === '12h'`, `H:MM AM|PM` sin cero a la izquierda, `00:xx` → `12:xx AM`, `12:xx` →
    `12:xx PM`. Código de referencia completo en `design.md §D-3`.
  - Eliminar `formatTimeHHMMSS` y su entrada en `module.exports`.
  - `msToHHMMSS` y `formatDateYYYYMMDD` quedan intactas, sin tocar su implementación ni su
    export.
- **Modo**: no aplica TDD — módulo puro, verificado por control posterior (Tarea 7).

- [ ] `formatTimeHHMM(dateObj, format)` agregada con la firma exacta (parámetro `format`
  explícito, la función no lee estado global).
- [ ] `formatTimeHHMMSS` eliminada del archivo y de `module.exports`.
- [ ] `msToHHMMSS` y `formatDateYYYYMMDD` sin cambios.

### Tarea 7: Verificar `formatTimeHHMM` contra la tabla de casos del diseño

- **Archivos**: ninguno se modifica.
- **Requiere**: Tarea 6.
- **Criterio de completado — EJECUTABLE (node -e + grep)**:

  ```bash
  node -e "
  const { formatTimeHHMM } = require('./src/utils/time-format.js');
  const cases = [
    [new Date(2026,0,1,0,5),  '24h',      '00:05'],
    [new Date(2026,0,1,0,5),  '12h',      '12:05 AM'],
    [new Date(2026,0,1,9,5),  '12h',      '9:05 AM'],
    [new Date(2026,0,1,12,0), '12h',      '12:00 PM'],
    [new Date(2026,0,1,13,5), '24h',      '13:05'],
    [new Date(2026,0,1,13,5), '12h',      '1:05 PM'],
    [new Date(2026,0,1,23,59),'12h',      '11:59 PM'],
    [new Date(2026,0,1,13,5), undefined,  '13:05'],
  ];
  let ok = true;
  cases.forEach(([d,f,expected]) => {
    const got = formatTimeHHMM(d, f);
    if (got !== expected) { ok = false; console.log('FAIL', f, 'got', got, 'expected', expected); }
  });
  console.log(ok ? 'PASS: los 8 casos coinciden' : 'HAY FALLOS');
  "
  grep -rn "formatTimeHHMMSS" src/   # debe devolver 0 líneas
  ```

- [ ] Los 8 casos de la tabla (incluido `undefined` → 24h) devuelven el valor esperado.
- [ ] `grep -rn "formatTimeHHMMSS" src/` devuelve 0 líneas (retiro completo, ningún import
  huérfano).

### Tarea 8: Actualizar `BySessionView.vue` al nuevo punto de formateo

- **Archivos**: `src/history/BySessionView.vue`
- **Requiere**: Tarea 7 (si se hace antes, el import queda roto).
- **Qué hacer**:
  - Import: quitar `formatTimeHHMMSS`, agregar `formatTimeHHMM` desde `@/utils/time-format.js`.
  - Agregar prop `timeFormat: { type: String, default: '24h' }`.
  - `formatRange(entry)` pasa a usar `formatTimeHHMM(new Date(entry.startedAt), this.timeFormat)`
    y `formatTimeHHMM(new Date(entry.endedAt), this.timeFormat)` en las dos llamadas.
  - `formatDuration` (usa `msToHHMMSS`) no cambia.
- **Modo**: no aplica TDD — componente `.vue`, sin runtime disponible en este worktree
  (`node_modules` ausente). Verificación visual.
- **Criterio de completado — VISUAL (Franja B, requiere `npm install` + `electron:serve`)**: en
  la vista "Por sesión" del historial, el rango horario de cada sesión y de cada miembro de
  grupo se muestra solo con hora y minuto (sin segundos), y la duración y el nombre de la
  sesión no cambian su forma de mostrarse.

- [ ] Import actualizado (`formatTimeHHMM` en vez de `formatTimeHHMMSS`).
- [ ] Prop `timeFormat` agregada con default `'24h'`.
- [ ] `formatRange` usa `formatTimeHHMM` en las dos llamadas (inicio y cierre).
- [ ] Observación visual: horario sin segundos, duración y nombre sin cambios.

---

## Spec: Preferencia configurable de formato de hora, 12 horas o 24 horas (`configurable-time-format-preference`)

> `time-format.js` (Tarea 6) y `BySessionView.vue` (Tarea 8) ya están listos desde el bloque
> anterior y cubren dos de los cinco archivos del `scope` de esta spec. Esta sección cubre los
> tres restantes (`ipc-handlers.js`, `settings.js`, `OpcionesPanel.vue`) más `HistoryView.vue`,
> y cierra con la verificación end-to-end de la preferencia completa.

### Tarea 9: `ipc-handlers.js` — default de `timeFormat` y merge de defaults en `get-settings`

- **Archivos**: `src/main/ipc-handlers.js`
- **Qué hacer** (defecto latente 1 del diseño — corrige que `readJson` no mergea defaults):
  - `defaultSettings` pasa de `{ masterVolume: 1, interactionVolume: 1 }` a
    `{ masterVolume: 1, interactionVolume: 1, timeFormat: '24h' }`.
  - El handler `get-settings` pasa de `jsonStore.readJson(getSettingsFilePath(),
    defaultSettings)` a:
    ```js
    ipcMain.handle('get-settings', () => ({
      ...defaultSettings,
      ...jsonStore.readJson(getSettingsFilePath(), {}),
    }))
    ```
    Esto es necesario porque `readJson(path, fallback)` devuelve `fallback` **solo** si el
    archivo falta o está corrupto — el `settings.json` real del usuario existe y tiene
    únicamente `{ masterVolume, interactionVolume }`, así que sin el merge `timeFormat` llega
    `undefined` al renderer.
  - `save-settings` no cambia.
- **Modo**: no aplica TDD — `ipc-handlers.js` requiere `electron`, no ejecutable con `node -e`
  plano sin `node_modules`. Verificación visual (Tarea 10).

- [ ] `defaultSettings.timeFormat === '24h'`.
- [ ] `get-settings` devuelve `{ ...defaultSettings, ...archivo }` en vez de
  `readJson(path, defaultSettings)`.

### Tarea 10: Verificar que `get-settings` no pierde `timeFormat` con el `settings.json` real del usuario

- **Archivos**: ninguno se modifica.
- **Requiere**: Tarea 9.
- **Criterio de completado — VISUAL (Franja B, requiere `npm install` + `electron:serve`)**: con
  la app del cronómetro corriendo (el `settings.json` real en `userData` sigue teniendo solo
  `masterVolume`/`interactionVolume` la primera vez), abrir las DevTools de esa ventana y
  ejecutar en la consola:
  ```js
  require('electron').ipcRenderer.invoke('get-settings').then(console.log)
  ```
  El resultado debe incluir `timeFormat: '24h'` aunque el archivo en disco no tenga esa clave
  todavía. Esto prueba el defecto latente 1 sin necesitar que `OpcionesPanel.vue` esté
  modificado todavía.

- [ ] `get-settings` devuelve `timeFormat: '24h'` contra el `settings.json` real (que no tiene
  esa clave).

### Tarea 11: `settings.js` — estado `timeFormat` y `persist()` único

- **Archivos**: `src/stores/settings.js`
- **Qué hacer** (defecto latente 2 del diseño — corrige que `setMaster`/`setInteraction` envían
  un payload literal de dos claves):
  - `state()` agrega `timeFormat: '24h'`.
  - Nueva acción `persist()` que envía las **tres** claves por `save-settings`:
    ```js
    persist() {
      ipcRenderer.send('save-settings', {
        masterVolume: this.masterVolume,
        interactionVolume: this.interactionVolume,
        timeFormat: this.timeFormat,
      })
    }
    ```
  - `setMaster(v)` y `setInteraction(v)` dejan de armar su propio payload literal y terminan en
    `this.persist()`.
  - Nueva acción `setTimeFormat(v) { this.timeFormat = v; this.persist() }`.
  - `load()` agrega `this.timeFormat = settings.timeFormat` sin fallback propio (el main ya
    entrega el default vía la Tarea 9).
- **Modo**: no aplica TDD — store Pinia con IPC real, no ejecutable con `node -e` plano.
  Verificación visual (Tarea 13, tras cablear `OpcionesPanel.vue`).

- [ ] `state()` incluye `timeFormat: '24h'`.
- [ ] `persist()` centraliza el envío de las tres claves; `setMaster`/`setInteraction` lo
  llaman en vez de armar su propio payload.
- [ ] `setTimeFormat(v)` agregada.
- [ ] `load()` lee `settings.timeFormat` sin fallback local.

### Tarea 12: `OpcionesPanel.vue` — selector de formato de hora

- **Archivos**: `src/components/OpcionesPanel.vue`
- **Requiere**: Tarea 11.
- **Qué hacer**:
  - Agregar un bloque `.setting-control` con un `<select>` de dos `<option>` cuyos `value` son
    literalmente `'24h'` y `'12h'` (mismo dominio que el parámetro de `formatTimeHHMM`, sin capa
    de mapeo), enlazado a `settingsStore.setTimeFormat($event.target.value)`.
  - Las tres reglas CSS existentes de `.volume-control` pasan a listar también el selector
    nuevo (no se crea una clase `.volume-control` mentirosa para una preferencia que no es de
    volumen).
- **Modo**: no aplica TDD — componente `.vue`. Verificación visual (Tarea 13).

- [ ] `<select>` con valores `'24h'`/`'12h'` agregado, enlazado a `setTimeFormat`.
- [ ] Las tres reglas CSS de `.volume-control` cubren también el selector nuevo.

### Tarea 13: Verificar que mover el volumen no borra `timeFormat` en disco

- **Archivos**: ninguno se modifica.
- **Requiere**: Tarea 12.
- **Criterio de completado — VISUAL (Franja B, requiere `npm install` + `electron:serve`)**: con
  la app corriendo, abrir Opciones y mover el slider de volumen general (sin tocar el selector
  de formato de hora); luego abrir `settings.json` en `userData` y confirmar que conserva **las
  tres** claves (`masterVolume`, `interactionVolume`, `timeFormat`), no solo las dos de volumen.
  Es la verificación directa del defecto latente 2: antes de la Tarea 11, este mismo gesto
  borraría `timeFormat` del archivo.

- [ ] Tras mover el volumen, `settings.json` conserva `timeFormat` además de las dos claves de
  volumen.

### Tarea 14: `HistoryView.vue` — cargar `timeFormat` por IPC y bajarlo por prop

- **Archivos**: `src/history/HistoryView.vue`
- **Qué hacer** (defecto latente 3 del diseño — ADR-0012: el historial no monta Pinia):
  - Agregar `timeFormat: '24h'` a `data()`.
  - En `created()`, cargar `const settings = await ipcRenderer.invoke('get-settings');
    this.timeFormat = settings.timeFormat` (junto al resto de las cargas ya existentes de
    `created()`).
  - Pasar `:time-format="timeFormat"` a `<BySessionView>`.
  - **No** importar `@/stores/settings` ni montar Pinia en esta ventana: ese import arrastra
    `@/plugins/sound`, que precarga cinco `Howl` en una ventana que no reproduce sonido.
- **Modo**: no aplica TDD — componente `.vue`, shell de IPC de la ventana de historial.
  Verificación en Tarea 15/16.

- [ ] `timeFormat` en `data()` con default `'24h'`.
- [ ] `created()` invoca `get-settings` y asigna `this.timeFormat`.
- [ ] `<BySessionView>` recibe `:time-format="timeFormat"`.
- [ ] Ningún import de `@/stores/settings` en el archivo.

### Tarea 15: Verificar que el historial no arrastra Pinia ni el store de settings

- **Archivos**: ninguno se modifica.
- **Requiere**: Tarea 14.
- **Criterio de completado — EJECUTABLE (grep)**:

  ```bash
  grep -n "stores/settings" src/history/HistoryView.vue
  ```

  Debe devolver 0 líneas.

- [ ] `grep -n "stores/settings" src/history/HistoryView.vue` devuelve 0 líneas.

### Tarea 16: Verificación end-to-end de la preferencia completa

- **Archivos**: ninguno se modifica.
- **Requiere**: Tareas 8, 13, 14.
- **Criterio de completado — VISUAL (Franja B, requiere `npm install` + `electron:serve`)**: con
  la app corriendo,
  1. abrir Opciones, elegir `12h` en el selector, abrir el historial (ventana nueva) → la vista
     "Por sesión" muestra los horarios con indicador AM/PM.
  2. volver a Opciones, elegir `24h`, reabrir el historial → los horarios ya no muestran AM/PM.
  3. cerrar y volver a abrir la aplicación completa → la preferencia elegida en el paso 2 sigue
     vigente (persistencia entre reinicios).
  4. Limitación aceptada y ya documentada en ADR-0012: una ventana de historial que ya estaba
     abierta **antes** de cambiar la preferencia no la refleja hasta que se la cierra y se la
     vuelve a abrir — esto **no** es un defecto a reportar, es el comportamiento diseñado.

- [ ] Elegir `12h` hace que los horarios muestren AM/PM en una apertura nueva del historial.
- [ ] Elegir `24h` hace que los horarios no muestren AM/PM en una apertura nueva del historial.
- [ ] La preferencia persiste tras cerrar y reabrir la aplicación.

---

## Spec: El gráfico de uso no muestra la escala de duración al pie de las barras (`hide-usage-chart-duration-scale`)

### Tarea 17: `UsageChart.vue` — ocultar la escala `x` y aclarar las barras

- **Archivos**: `src/history/UsageChart.vue`
- **Qué hacer** (cubre esta spec y `bright-chart-bars-on-dark-background` en el mismo archivo):
  - `scales.x` pasa de `{ grid: { display: false }, ticks: { callback: ... } }` a
    `{ display: false }` — oculta la escala entera (línea, grilla y ticks). Se retiran
    `scales.x.grid` y `scales.x.ticks.callback`: dejarlos sería configuración muerta.
  - `scales.y` no se toca.
  - `tooltip.callbacks.label` no se toca — el import de `msToHHMMSS` sigue usándose ahí, sin
    quedar huérfano.
  - `backgroundColor: '#6f6f6f'` → `backgroundColor: '#d9d9d9'` en el dataset.
  - No se toca `ChartJS.defaults.color`, ningún color de fondo, ni el `@import` de la fuente.
- **Modo**: no aplica TDD — componente `.vue` con `chart.js`, no ejecutable sin `node_modules`.
  Verificación visual (Tareas 18 y 19).

- [ ] `scales.x` es exactamente `{ display: false }`, sin `grid` ni `ticks.callback` residual.
- [ ] `scales.y` sin cambios.
- [ ] `backgroundColor` del dataset es `'#d9d9d9'`.
- [ ] `ChartJS.defaults`, `tooltip.callbacks.label` y el `@import` de fuente sin cambios.

### Tarea 18: Verificar que la escala desaparece sin perder el valor exacto

- **Archivos**: ninguno se modifica.
- **Requiere**: Tarea 17.
- **Criterio de completado — VISUAL (Franja B, requiere `npm install` + `electron:serve`)**: al
  abrir el historial con el gráfico de tiempo por aplicación visible, debajo de las barras no
  aparece ninguna escala de números de duración; pasar el cursor sobre una barra sigue
  mostrando su tiempo exacto; las listas "Por app" y "Por sesión" siguen mostrando sus columnas
  de tiempo sin cambios.

- [ ] Ninguna escala de números visible al pie del gráfico.
- [ ] El tooltip al pasar el mouse sigue mostrando la duración exacta.
- [ ] Las listas "Por app" y "Por sesión" no cambiaron.

---

## Spec: Barras del gráfico de uso más claras sobre el fondo oscuro (`bright-chart-bars-on-dark-background`)

### Tarea 19: Verificar el contraste de las barras claras sobre el fondo oscuro

- **Archivos**: ninguno se modifica (el cambio de código es el mismo de la Tarea 17).
- **Requiere**: Tarea 17.
- **Criterio de completado — VISUAL (Franja B, requiere `npm install` + `electron:serve`)**: las
  barras del gráfico se ven en un gris claro (`#d9d9d9`) bien contrastado contra el fondo
  oscuro (`#1b1b1b`) de la ventana de historial; el fondo de la ventana y el resto de su
  paleta no cambiaron (`dark-loading-state` sigue intacta); las etiquetas de categoría y los
  números del gráfico se siguen leyendo con claridad sobre el color nuevo de las barras.

- [ ] Barras en tono claro, bien contrastadas sobre el fondo oscuro.
- [ ] Fondo de la ventana de historial sin cambios.
- [ ] Etiquetas y números del gráfico legibles sobre el color nuevo.

---

## Spec: Título de sesión en tipografía legible dentro de la fila de aplicación (`readable-session-title-typography`)

### Tarea 20: `AppRow.vue` — tipografía legible en `.app-name` y `.app-name-input`

- **Archivos**: `src/components/AppRow.vue`
- **Qué hacer**:
  - Agregar `font-family: sans-serif;` a la regla `.app-name`.
  - Agregar `font-family: sans-serif;` a la regla `.app-name-input`, **después** de
    `font: inherit` dentro de la misma regla — el shorthand `font` resetea `font-family`, así
    que el orden decide si el cambio aplica.
  - No tocar `App.vue` ni `CronometroPomodoro.vue`: conservan la tipografía decorativa.
- **Modo**: no aplica TDD — cambio de CSS puro en un componente `.vue`. Verificación visual
  (Tarea 21).

- [ ] `.app-name` tiene `font-family: sans-serif`.
- [ ] `.app-name-input` tiene `font-family: sans-serif` declarado después de `font: inherit`.
- [ ] `App.vue` y `CronometroPomodoro.vue` sin cambios.

### Tarea 21: Verificar la legibilidad del nombre/título en sus dos estados

- **Archivos**: ninguno se modifica.
- **Requiere**: Tarea 20.
- **Criterio de completado — VISUAL (Franja B, requiere `npm install` + `electron:serve`)**: el
  nombre de la aplicación (sin título propio) se lee en tipografía legible; un título de sesión
  puesto por el usuario se lee en la misma tipografía; el campo de edición del título usa la
  misma tipografía legible mientras se edita; el título de la ventana ("Work") y el
  temporizador Pomodoro conservan la tipografía decorativa, sin cambios. Efecto secundario
  esperado a confirmar (no es un defecto): el ancho renderizado de `.app-name`/`.app-name-input`
  (`width: 8ch`) puede cambiar levemente porque `ch` depende de la fuente.

- [ ] Nombre de aplicación sin título propio, legible.
- [ ] Título de sesión con nombre propio, legible, misma tipografía.
- [ ] Campo de edición del título, legible mientras se edita.
- [ ] Título de la ventana y Pomodoro conservan la tipografía decorativa.

---

## Spec: Varios grupos de sesión visibles al mismo tiempo en el listado de trabajo (`multiple-simultaneous-groups`)

### Tarea 22: `CronometroAplicacion.vue` — reemplazar el estado de un solo grupo por una colección de N grupos

- **Archivos**: `src/components/CronometroAplicacion.vue`
- **Qué hacer**:
  - En `data()`, eliminar `dragGrouped`, `activeGroupId`, `activeGroupName`, `editingGroupName`.
  - Agregar `dragGroups: []` (colección `[{ groupId, groupName, rows: [] }]`), `dragNewGroup:
    []` (siempre vacío, modelo de la franja de creación), `isDragging: false` (guarda única a
    nivel de componente), `pendingRows: null`, `pendingIntent: false`, `editingGroupId: null`,
    `draftGroupName: ''`.
  - Eliminar el computed `showGroupContainer` (ya no aplica con N contenedores; la visibilidad
    de la franja se resuelve en la Tarea 25).
- **Modo**: no aplica TDD — refactor de estado de un componente `.vue`, sin ejecución posible
  sin la app corriendo con mouse real.

- [ ] `data()` con los 8 campos nuevos, sin los 4 que se retiran.
- [ ] Computed `showGroupContainer` eliminado.

### Tarea 23: `applyRows()` atómico y `watch` con snapshot diferido

- **Archivos**: `src/components/CronometroAplicacion.vue`
- **Requiere**: Tarea 22.
- **Qué hacer**:
  - Implementar `applyRows(rows)`: recorre `rows` una sola vez, arma `nextUngrouped` y
    `nextGroups` (por orden de primera aparición de cada `groupId`) en variables locales, y
    **recién al final** asigna `this.dragUngrouped = nextUngrouped` y `this.dragGroups =
    nextGroups` — nunca una reconstrucción parcial "grupo por grupo". Código de referencia
    completo en `design.md §D-1 → Reconstrucción atómica`.
  - Reemplazar el cuerpo del `watch('monitoredApps.rows', ...)`: si `this.isDragging` es
    verdadero, guardar `this.pendingRows = rows` (ya no se descarta el snapshot); si no, llamar
    a `this.applyRows(rows)` directamente. La llamada a `ensureIcon` por fila se mantiene igual
    que hoy, antes de la guarda.
- **Modo**: no aplica TDD — mismo motivo que la Tarea 22.

- [ ] `applyRows(rows)` implementado con asignación atómica al final.
- [ ] El orden de los grupos en `dragGroups` es el de primera aparición de cada `groupId` en
  `rows`.
- [ ] El `watch` guarda el snapshot en `pendingRows` durante un arrastre, en vez de
  descartarlo.

### Tarea 24: Guarda de arrastre de tres reglas (`onDragStart`/`onDragEnd`, `pendingIntent`)

- **Archivos**: `src/components/CronometroAplicacion.vue`
- **Requiere**: Tarea 23.
- **Qué hacer**:
  - `onDragStart() { this.isDragging = true }`.
  - `onDragEnd()`: si `pendingIntent` es verdadero, lo resetea a `false` y termina (el snapshot
    posterior a la intención ya viene en camino, no se aplica el pendiente). Si no, y hay
    `pendingRows`, los limpia y llama a `this.$nextTick(() => this.applyRows(rows))` — nunca
    `applyRows` dentro del propio handler de SortableJS.
  - Los handlers de `@change` (`onUngroupedDragChange`/el que reemplaza a `onGroupDragChange`
    en la Tarea 25) marcan `this.pendingIntent = true` y `this.pendingRows = null` **antes** de
    emitir `setRowGroup` por IPC — `@change` corre antes que `@end`, así que este orden importa.
  - Todos los `<draggable>` (suelto, N grupos, franja) enlazan `@start="onDragStart"` y
    `@end="onDragEnd"` — una guarda única a nivel de componente, no una por lista.
- **Modo**: no aplica TDD — mismo motivo. Verificación de este bloque completo en la Tarea 27
  (gestos C1-C5), no es verificable de forma aislada.

- [ ] `onDragStart`/`onDragEnd` implementados con las tres reglas del diseño.
- [ ] Todos los `<draggable>` usan los mismos handlers de guarda (una sola bandera
  `isDragging` para todo el componente).
- [ ] Los handlers de `@change` marcan `pendingIntent = true` y limpian `pendingRows` antes de
  emitir la intención IPC.

### Tarea 25: Template — N contenedores de grupo + franja permanente de creación

- **Archivos**: `src/components/CronometroAplicacion.vue`
- **Requiere**: Tarea 24.
- **Qué hacer**:
  - Reemplazar el único `<div class="group-container">` por un `v-for` sobre `dragGroups`: un
    `<div class="group-container">` por grupo, cada uno con su propio `<draggable
    v-model="group.rows" group="monitored-rows" item-key="appId" @start="onDragStart"
    @end="onDragEnd" @change="...">`.
  - Agregar la franja de creación: `<draggable v-model="dragNewGroup" group="monitored-rows"
    item-key="appId">` (sin `@start`/`@end` propios — nunca origina un arrastre porque está
    vacía). Al recibir su primera fila en `@change`: `setRowGroup(appId,
    this.generateGroupId())` y `this.dragNewGroup = []` en el mismo handler.
  - Visibilidad de la franja: `dragUngrouped.length >= 1 || isDragging` (cambia el umbral
    actual de `>= 2`; el `|| isDragging` evita que la franja se desmonte bajo el cursor durante
    un gesto que vacía el listado suelto).
  - El handler de `@change` de cada `<draggable>` de grupo existente usa `group.groupId` (el
    del grupo al que pertenece esa lista), no una variable de componente única.
- **Modo**: no aplica TDD — cambio de template, verificación en Tareas 27-28.

- [ ] `v-for` sobre `dragGroups` renderiza un contenedor por grupo.
- [ ] Franja de creación (`dragNewGroup`, siempre vacía) presente, sin `@start`/`@end` propios.
- [ ] Visibilidad de la franja: `dragUngrouped.length >= 1 || isDragging`.
- [ ] Cada grupo usa su propio `groupId` en el handler de `@change`, no una variable global.

### Tarea 26: Cabecera y renombrado por grupo (con el `ref` en `v-for` como array)

- **Archivos**: `src/components/CronometroAplicacion.vue`
- **Requiere**: Tarea 25.
- **Qué hacer**:
  - `startEditGroupName(group)`: `this.draftGroupName = group.groupName || ''`;
    `this.editingGroupId = group.groupId`.
  - `confirmGroupName(group)` → `renameGroup(group.groupId, this.draftGroupName)` (llama a
    `this.monitoredApps.renameGroup(...)`), luego `this.editingGroupId = null`.
  - `cancelGroupName()`: `this.editingGroupId = null`.
  - El template compara `editingGroupId === group.groupId` para decidir si esa cabecera
    muestra el `<input>` o el `<span>`.
  - Trampa de Vue 3 a documentar en el código: un `ref` declarado dentro de un `v-for` se
    registra como array. El foco pasa a:
    ```js
    this.$nextTick(() => {
      const el = this.$refs.groupNameInput
      const input = Array.isArray(el) ? el[0] : el
      if (input) input.focus()
    })
    ```
- **Modo**: no aplica TDD. Verificación en la Tarea 27 (C5).

- [ ] `editingGroupId` (string|null) reemplaza al booleano `editingGroupName`.
- [ ] `confirmGroupName(group)` llama a `renameGroup(group.groupId, ...)`.
- [ ] El manejo del `ref` contempla el caso array de Vue 3 en un `v-for`.

### Tarea 27: Verificar los gestos C1-C5 de composición con N grupos

- **Archivos**: ninguno se modifica.
- **Requiere**: Tareas 22-26 (el refactor completo).
- **Criterio de completado — VISUAL (Franja C, requiere gesto de mouse sobre la app corriendo
  tras `npm install` + `electron:serve`)**:
  - **C1**: con un grupo ya formado y filas sueltas, arrastrar una fila suelta a la franja →
    aparece un **segundo** grupo independiente, y el primero sigue igual.
  - **C2**: con dos grupos formados y al menos una fila suelta, sigue habiendo una franja
    disponible para seguir agregando filas o formar un grupo adicional.
  - **C3**: con un tercer grupo presente, mover una fila del grupo A al grupo B → el grupo de
    origen pierde la fila, el de destino la incorpora, y el **tercero no cambia**.
  - **C4**: vaciar un grupo (detener o sacar todas sus filas) → **solo ese** grupo desaparece,
    los demás siguen visibles.
  - **C5**: renombrar el grupo B no altera el nombre de A ni de C.

- [ ] C1 — segundo grupo aparece sin alterar el primero.
- [ ] C2 — la franja sigue disponible con dos grupos formados.
- [ ] C3 — mover una fila entre A y B no afecta a un tercer grupo C.
- [ ] C4 — vaciar un grupo lo hace desaparecer sin afectar a los demás.
- [ ] C5 — renombrar un grupo no afecta el nombre de los otros.

### Tarea 28: Verificar el reparto de las 4 filas del límite en más de un grupo

- **Archivos**: ninguno se modifica.
- **Requiere**: Tareas 22-26.
- **Criterio de completado — VISUAL (Franja C, requiere gesto de mouse)**: con el listado en su
  límite práctico de 4 filas simultáneas (`monitor-engine.js:114`, sin cambios), repartir esas
  4 filas en más de un grupo a la vez (por ejemplo, 2 grupos de 2 filas, o 3+1) y confirmar que
  todos los grupos formados se muestran simultáneamente sin que ninguno reemplace a otro.

- [ ] Las 4 filas del límite se pueden repartir en 2 o más grupos simultáneos.

---

## Spec: Cierre definitivo de sesiones al salir, escritura atómica del historial y nombre principal en el listado de instaladas (`judgment-fixes-sessions-groups-history-revised`)

### Tarea 29: Revisar que el diff final no toca los tres archivos que esta spec protege

- **Archivos**: ninguno se modifica; se revisa el diff completo del cambio contra
  `src/main/monitor-engine.js`, `src/main/session-log.js` e
  `src/main/installed-apps-filter.js`.
- **Requiere**: todas las tareas anteriores (se hace al final, contra el diff completo del
  cambio).
- **Qué hacer**: esta spec no introduce código en este cambio — sus tres requisitos vigentes
  (cierre definitivo de sesiones al salir, escritura atómica del historial, nombre principal en
  el listado de instaladas) ya están implementados. Lo único que le corresponde acá es
  confirmar que nada de lo tocado por las Tareas 1-28 los rompe.
- **Criterio de completado — REVISIÓN DE DIFF (sin ejecución)**:
  ```bash
  git diff --stat -- src/main/monitor-engine.js src/main/session-log.js src/main/installed-apps-filter.js
  ```
  Debe devolver **vacío** (ningún archivo de estos tres aparece en el diff del cambio). El
  único archivo del `main` que sí cambia es `src/main/ipc-handlers.js` (Tarea 9), que no
  participa de ninguno de los tres requisitos de esta spec.

- [ ] `git diff --stat` sobre los tres archivos protegidos devuelve vacío.
- [ ] `session-aggregate.js` (Tarea 2, D-2) no interviene en ninguno de los tres requisitos
  vigentes de esta spec (cierre al salir, escritura atómica, nombre principal en instaladas).
