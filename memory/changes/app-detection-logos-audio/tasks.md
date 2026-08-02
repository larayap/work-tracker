---
type: tasks
change_name: "app-detection-logos-audio"
created: "2026-08-01"
updated: "2026-08-01"
tags: [tasks]
---

# Tasks: app-detection-logos-audio

## Orden de ejecución

El proyecto no tiene test runner ni CI. El criterio de completado de cada tarea es
**verificación manual observable**: qué hace una persona con la app corriendo (o con `node`
directo sobre una función pura) para comprobar que la tarea quedó lista. Las funciones puras
del motor (`reduceLifecycle`, `reduceFocus`) no dependen de Electron ni de Windows, así que se
verifican con `node -e "..."` sin levantar la app — es más rápido y más confiable que pasar
por la UI.

Seis bloques, en el orden que fija `proposal.md` por el acoplamiento real:

1. **Bloque 0 — Infraestructura compartida.** `json-store.js` y `time-format.js` no dependen
   de nada del cambio y los consumen tanto el Bloque 1 (Opciones) como el Bloque 2 (motor).
   Van primero para no bloquear a ninguno de los dos.
2. **Bloque 1 — Independiente.** Fix del destello blanco y Opciones + volumen. No tocan el
   motor, se verifican de inmediato.
3. **Bloque 2 — Motor multi-app en el main process.** El riesgo alto del cambio: refactor de
   la función central de la app sin red de tests. Cortado en tareas chicas, cada una deja el
   proyecto en un estado ejecutable. **Punto de atención**: entre la Tarea 16 (se podan los
   canales viejos de `background.js`) y el Bloque 3 (se reescribe la UI que los consumía), el
   widget "Aplicación" queda visualmente roto o vacío — es transición esperada, no una
   regresión. La verificación de este bloque se hace por DevTools console (`ipcRenderer.invoke`
   directo a los canales nuevos) y por inspección del archivo `usage-log.txt`, no por la UI
   vieja.
4. **Bloque 3 — Store Pinia + UI multi-programa.** Reconecta el widget al snapshot nuevo.
   A partir de acá la UI vuelve a ser observable de punta a punta.
5. **Bloque 4 — Íconos automáticos B/N.** Se apoya en `exePath` como identidad, ya en pie
   desde el Bloque 2.
6. **Bloque 5 — Selector de apps instaladas + auto-arranque.** El más caro, último por
   diseño.

`depends_on` señala tareas previas requeridas. Dentro de un bloque, las tareas son
secuenciales salvo que se indique lo contrario.

---

## Bloque 0 — Infraestructura compartida

### Tarea 1: Crear el helper de persistencia JSON

- [x] Completada
- **Archivos**: `src/main/json-store.js` (nuevo)
- **Qué hacer**: `readJson(filePath, fallback)` y `writeJson(filePath, data)` bajo
  `app.getPath('userData')`. `readJson` devuelve `fallback` ante archivo ausente o JSON
  corrupto, sin lanzar. `writeJson` escribe con `JSON.stringify(data, null, 2)`. Sin
  dependencias nuevas (`fs`, ya usado en `background.js`).
- **Depends_on**: —
- **Criterio de completado**: `node -e "const {readJson, writeJson} = require('./src/main/json-store.js'); writeJson('/tmp/t.json', {a:1}); console.log(readJson('/tmp/t.json', null)); console.log(readJson('/tmp/no-existe.json', 'default'))"` imprime `{ a: 1 }` y luego `default`. Escribir basura no-JSON en `/tmp/t.json` a mano y repetir `readJson` con fallback `'default'`: debe devolver `'default'` sin lanzar excepción.

### Tarea 2: Extraer funciones puras de formateo de tiempo

- [x] Completada
- **Archivos**: `src/utils/time-format.js` (nuevo)
- **Qué hacer**: `msToHHMMSS(ms)`, `formatTimeHHMMSS(dateObj)`, `formatDateYYYYMMDD(dateObj)`,
  extraídas literalmente de `src/components/CronometroAplicacion.vue:207-227`. Sin cambios de
  comportamiento, solo de ubicación — son las mismas usadas hoy en `reset()`.
- **Depends_on**: —
- **Criterio de completado**: `node -e "const {msToHHMMSS, formatDateYYYYMMDD} = require('./src/utils/time-format.js'); console.log(msToHHMMSS(3723000)); console.log(formatDateYYYYMMDD(new Date(2026,7,1)))"` imprime `01:02:03` y `2026-08-01`.

---

## Bloque 1 — Trabajo independiente (paralelo desde el arranque)

Cubre `[[dark-loading-state]]` y `[[dual-volume-control]]`. No toca `background.js` fuera de
`open-history-window`, ni el motor de monitoreo.

### Tarea 3: Fix del destello blanco al abrir el historial

- [x] Completada
- **Archivos**: `src/background.js` (función `open-history-window`, líneas 222-242), `public/history.html`
- **Qué hacer**: en las opciones de la `BrowserWindow` del historial agregar
  `backgroundColor: '#1b1b1b'` y `show: false`; agregar
  `historyWindow.once('ready-to-show', () => historyWindow.show())`. En `public/history.html`
  agregar dentro de `<head>` un `<style>html, body { background-color: #1b1b1b; margin: 0; }</style>`.
- **Depends_on**: —
- **Criterio de completado**: cumple los acceptance criteria de `[[dark-loading-state]]`.
  Con la app corriendo (`npm run electron:serve` o el build activo), abrir la ventana de
  historial repetidas veces (botón de historial en el widget "Aplicación") y observar que en
  ningún momento aparece un destello de color claro antes del contenido; el fondo es oscuro
  desde el primer frame.

### Tarea 4: Store Pinia de settings (volumen)

- [x] Completada
- **Archivos**: `src/stores/settings.js` (nuevo)
- **Qué hacer**: `defineStore('settings', { state: () => ({ masterVolume: 1, interactionVolume: 1 }), actions: { load(), setMaster(v), setInteraction(v) } })`. `load()` invoca `get-settings` por IPC y aplica el resultado al estado y a `sound.js` (ver Tarea 5). `setMaster`/`setInteraction` actualizan el estado, llaman a las funciones de `sound.js` y disparan `send('save-settings', { masterVolume, interactionVolume })`. El canal IPC en sí (`get-settings`/`save-settings`) se registra en la Tarea 15 junto al resto del contrato; esta tarea puede dejar los `invoke`/`send` escritos aunque el handler del main no exista todavía — se integra al final del Bloque 2.
- **Depends_on**: Tarea 1 (el handler que persistirá `settings.json` usa `json-store.js`, aunque se registre en la Tarea 15)
- **Criterio de completado**: revisión de código — el store expone `masterVolume`,
  `interactionVolume`, `load`, `setMaster`, `setInteraction`, y no hay lógica de audio
  duplicada aquí (delega a `sound.js`). No es verificable de punta a punta hasta la Tarea 7.

### Tarea 5: Volumen en `plugins/sound.js`

- [x] Completada
- **Archivos**: `src/plugins/sound.js`
- **Qué hacer**: exportar (además de instalar `$playSound`) `setMasterVolume(v)` →
  `Howler.volume(v)`, y `setInteractionVolume(v)` → aplica `howl.volume(v)` a `add`, `popUp`,
  `pressButton` y `deleteItem`. `endSession` no se toca — queda regido solo por
  `Howler.volume()`.
- **Depends_on**: —
- **Criterio de completado**: cumple acceptance criteria de `[[dual-volume-control]]`
  ("bajar el maestro silencia todo incluida la alarma", "bajar interacción no afecta la
  alarma"). Con la app corriendo, en DevTools console:
  `const s = require('@/plugins/sound.js')` no aplica (ES module) — en su lugar, tras
  integrar la Tarea 6/7, mover el slider maestro a 0 y comprobar que `add`/`endSession` dejan
  de sonar; subir el maestro y bajar el de interacción a 0: `add`/`popUp` mudos, `endSession`
  audible al terminar una sesión Pomodoro o Manual.

### Tarea 6: `OpcionesPanel.vue`

- [x] Completada
- **Archivos**: `src/components/OpcionesPanel.vue` (nuevo)
- **Qué hacer**: modal con dos `<input type="range">` (maestro, interacción), usando
  `.modal-overlay`/`.modal-content` como en `CronometroAplicacion.vue`/`TitleBar.vue`. Usa el
  store de la Tarea 4: lee `masterVolume`/`interactionVolume`, llama `setMaster`/
  `setInteraction` en `@input`. Se monta/desmonta con una prop `visible` o `v-model`, no vive
  como ventana propia (D14).
- **Depends_on**: Tarea 4
- **Criterio de completado**: revisión de código — el componente no importa `ipcRenderer`
  directamente (pasa por el store); los dos sliders están presentes con rango 0-1. Verificación
  visual completa en la Tarea 7.

### Tarea 7: Botón Opciones en `TitleBar.vue` + carga inicial en `main.js`

- [x] Completada
- **Archivos**: `src/components/TitleBar.vue`, `src/main.js`
- **Qué hacer**: en `TitleBar.vue`, agregar un botón en `.window-controls` con el ícono
  `faGear` (ya importado en la línea 72, sin uso) que alterna la visibilidad de
  `OpcionesPanel.vue` montado como hermano del `#custom-titlebar`. En `src/main.js`, antes de
  `app.mount('#app')`, llamar `useSettingsStore().load()` para que el volumen persistido rija
  desde el primer sonido.
- **Depends_on**: Tarea 6, Tarea 15 (necesita que `get-settings`/`save-settings` existan
  para que `load()` no falle — puede implementarse antes y probarse recién cuando el canal
  esté registrado)
- **Criterio de completado**: cumple el resto de acceptance criteria de
  `[[dual-volume-control]]`. Con la app abierta en cualquier vista, click en el ícono de
  engranaje de la barra de título muestra `OpcionesPanel` con los dos sliders. Ajustar ambos a
  valores distintos, cerrar la app por completo y reabrirla: los sliders muestran los mismos
  valores que se dejaron (persistencia via `settings.json` en `userData`).

---

## Bloque 2 — Motor de monitoreo multi-app (riesgo alto)

Cubre `[[two-state-row-machine]]`, `[[row-lifecycle]]`, `[[saved-selection-only-monitoring]]`,
`[[session-log-persistence]]`, `[[simultaneous-limit]]` (el tope, no la UI que lo comunica) y
las bases de `[[automatic-bw-icons]]`/`[[installed-apps-listing-quality]]`. Vive en
`src/main/`. Nada de esto se ve todavía reflejado en la UI — eso es el Bloque 3.

### Tarea 8: `platform-windows.js` — foco y liveness, verificación del riesgo `processId`

- [x] Completada
- **Archivos**: `src/main/platform-windows.js` (nuevo)
- **Qué hacer**: `getForegroundWindow()` → `Promise<{ exePath, name, pid } | null>` usando
  `activeWin()`, tomando `winInfo.owner.path`, `winInfo.owner.name` y
  `winInfo.owner.processId` (o `pid`, según lo que la librería entregue de verdad).
  `isProcessAlive(pid)` → `Boolean` usando `process.kill(pid, 0)` envuelto en `try/catch`
  (`ESRCH` → `false`, cualquier otro resultado sin excepción → `true`).
  **Riesgo de diseño a resolver acá**: el ADR-0001/tech-context.md marcan que
  `winInfo.owner.processId` no está confirmado por uso en este repo. Agregar
  temporalmente `console.log(JSON.stringify(winInfo.owner))` dentro de
  `getForegroundWindow()`, ejecutar la app, cambiar el foco entre 2-3 programas reales y
  revisar la terminal donde corre el proceso main: confirmar si `processId` (o `pid`) viene
  poblado con un número. Si viene vacío/`undefined`, dejarlo documentado en un comentario
  arriba de la función y asegurarse de que ninguna otra pieza del motor dependa de ese campo
  como obligatorio (D4 ya lo trata como refuerzo, no como clave primaria). Quitar el
  `console.log` de depuración antes de cerrar la tarea.
- **Depends_on**: —
- **Criterio de completado**: con la app corriendo, en la terminal del proceso main se ve el
  resultado de `getForegroundWindow()` al cambiar el foco entre programas, con `exePath` y
  `name` correctos. Queda una nota (comentario en el código) sobre si `pid`/`processId`
  vino poblado. `node -e "const p = require('./src/main/platform-windows.js'); console.log(typeof p.isProcessAlive)"` confirma que el módulo exporta la función (aunque `isProcessAlive` solo se pueda invocar de verdad con Electron corriendo, ya que usa `process.kill`, disponible en Node puro — se puede probar con `node -e "..." ` pasando el propio PID de ese proceso node y un PID inexistente como `999999`, esperando `true` y `false` respectivamente).

### Tarea 9: `platform-windows.js` — enumeración de procesos y ventanas abiertas

- [x] Completada
- **Archivos**: `src/main/platform-windows.js`
- **Qué hacer**: `listRunningProcesses()` → `Promise<[{ imageName, pid }]>` vía
  `tasklist /FO CSV /NH` (parseo de CSV a pares nombre/PID). `listOpenWindows()` →
  `Promise<OpenWindow[]>` con el contrato extendido `{ appName, exePath, pid }`: mover aquí
  el cuerpo de `get-open-windows` (`src/background.js:116-135`), y extender el comando
  PowerShell o el objeto de retorno para incluir `Path`/`Id` del proceso además de
  `appName`. El campo `appName` no cambia de nombre ni de significado — `TitleBar.vue` sigue
  consumiéndolo sin tocar ese componente en esta tarea.
- **Depends_on**: Tarea 8
- **Criterio de completado**: `node -e "require('./src/main/platform-windows.js').listRunningProcesses().then(r => console.log(r.slice(0,5)))"` corriendo en Windows imprime pares `{ imageName, pid }` reales. Con la app corriendo, abrir el modal de "seleccionar app abierta" de `TitleBar.vue` (que sigue apuntando al canal `get-open-windows` viejo hasta la Tarea 15) confirma que el listado de nombres sigue funcionando igual que antes del cambio.

### Tarea 10: `session-log.js`

- [x] Completada
- **Archivos**: `src/main/session-log.js` (nuevo)
- **Qué hacer**: `buildSessionLine(row, endDate)` — función pura que reproduce el formato
  exacto que hoy genera `CronometroAplicacion.reset()`
  (`[${datePart} ${timePart}] Aplicación: ${name} | Duración: ${duration} | Inicio: ${startString} | Fin: ${endString}`),
  usando `time-format.js` (Tarea 2) y los campos de `row` (`name`, `elapsedMs`,
  `sessionStartedAt`). `appendSession(row, endDate)` — hace `buildSessionLine` y appendea a
  `usage-log.txt` bajo `app.getPath('userData')` (mismo `logFilePath` que
  `src/background.js:244`).
- **Depends_on**: Tarea 2
- **Criterio de completado**: cumple parte de los acceptance criteria de
  `[[session-log-persistence]]` (formato de línea). `node -e` con un `row` fabricado
  (`{ name: 'Test', elapsedMs: 3723000, sessionStartedAt: Date.now() - 3723000 }`) y una
  `endDate` fija: `buildSessionLine` devuelve una línea que matchea la misma expresión
  regular que usa `get-app-logs` en `src/background.js:264`
  (`/\[(.*?)\] Aplicación: (.*?) \| Duración: (.*?) \| Inicio: (.*?) \| Fin: (.*)/`).

### Tarea 11: `monitor-engine.js` — estructuras de datos y `reduceLifecycle` puro

- [x] Completada
- **Archivos**: `src/main/monitor-engine.js` (nuevo)
- **Qué hacer**:
  - Definir las formas de dato de D5: entrada de selección guardada
    `{ appId, name, exePath, addedAt }` y fila `{ appId, name, exePath, pid, state, elapsedMs, sessionStartedAt, lastTickAt }`.
  - `normalizeAppId({ exePath, imageName })` — pura: si `exePath` existe, `appId = exePath.toLowerCase()`; si no, `appId = 'name:' + imageName.toLowerCase()` (D4, caso degradado del selector de procesos abiertos).
  - `reduceLifecycle(sLive, selection, rows)` → `{ rows: nuevasFilas, closed: [{row, motivo}] }`, pura, sin IPC ni `fs`:
    - **alta**: programa de `selection` con proceso vivo (según `sLive`) y sin fila, **si `rows.length < 4`** → crea fila con `pid`, `state` a definir por `reduceFocus` (queda `null`/pendiente en este reductor — no le asigna estado; D1 fija que el orden hace que `reduceFocus` lo resuelva en el mismo tick), `elapsedMs: 0`, `sessionStartedAt: now`.
    - **alta manual con proceso cerrado** (D6): si se agrega desde `selection` una entrada sin evidencia de vida, la fila nace igual con `pid: null`, pero esto lo dispara la acción de agregar (Tarea 15/17), no `reduceLifecycle` en el tick — dejar comentado en el código dónde se realiza esa creación para que `sdd-apply` no la duplique.
    - **baja**: fila con `pid !== null` cuyo PID ya no está vivo → sale de `rows`, entra a `closed` con motivo `'process-exit'`. Una fila con `pid: null` **nunca** sale por este camino (D6).
    - **vinculación**: fila con `pid: null` cuyo proceso se detecta vivo (por ruta o por nombre de imagen) → se le asigna el `pid`, sin abrir sesión nueva ni tocar `elapsedMs`/`sessionStartedAt`.
    - **límite**: rechaza toda inserción cuando `rows.length === 4`, sin distinguir origen (D7). Ninguna otra parte del motor debe reimplementar el chequeo de 4.
  - `closeRow(rows, appId, motivo)` — pura, quita la fila de `appId` de `rows` y la devuelve junto con la fila removida (el llamador decide si llama a `appendSession`). Es el único camino de salida que consumen tanto el ■ como el cierre de proceso (D1, sequence diagram "Salida de fila").
- **Depends_on**: Tarea 2 (para futuros consumidores; `reduceLifecycle` en sí no depende de nada), Tarea 8 (contrato de `sLive`)
- **Criterio de completado**: cumple los siguientes acceptance criteria de
  `[[row-lifecycle]]` y `[[simultaneous-limit]]`, verificables sin Electron: `node -e` con
  `reduceLifecycle` fabricando estados —
  1. selección con 1 programa vivo, `rows: []` → 1 fila nueva.
  2. selección con 1 programa agregado con `pid: null` (agregado manual, cerrado) → no lo da de baja aunque `sLive` no lo reporte vivo.
  3. fila con `pid` cuyo `isProcessAlive` simulado es `false` → sale y aparece en `closed`.
  4. `rows` con 4 elementos y un programa nuevo vivo en la selección → `rows` sigue en 4, no se agrega.
  5. fila con `pid: null` y proceso que aparece vivo → se le asigna `pid`, `elapsedMs` no cambia.
  6. programa fuera de `selection` con proceso vivo → no genera fila (cumple `[[saved-selection-only-monitoring]]`).

### Tarea 12: `monitor-engine.js` — `reduceFocus` puro y acumulación por reloj de pared

- [x] Completada
- **Archivos**: `src/main/monitor-engine.js`
- **Qué hacer**: `reduceFocus(sFocus, rows, now)` → pura, devuelve `rows` con:
  - la fila cuyo `appId` corresponde al programa en foco (correlación por `exePath`/ruta
    primero, por nombre de imagen si no hay ruta — D4) → `state: 'running'`, y
    `elapsedMs += now - lastTickAt` (solo esta fila acumula), `lastTickAt = now`.
  - todas las demás → `state: 'paused'`, `lastTickAt = now` (sin acumular).
  - si el foco no corresponde a ninguna fila (o el programa en foco no está en `selection`),
    todas las filas quedan `paused`.
- **Depends_on**: Tarea 11
- **Criterio de completado**: cumple acceptance criteria de `[[two-state-row-machine]]`.
  `node -e` con `reduceFocus` fabricando `rows` de 3 elementos y `sFocus` apuntando a uno de
  ellos: exactamente esa fila queda `running` con `elapsedMs` incrementado en el delta
  esperado, las otras dos quedan `paused` sin cambio de `elapsedMs`. Repetir con `sFocus` sin
  match: las 3 quedan `paused`.

### Tarea 13: `monitor-engine.js` — timer, orquestación del tick, `inFlight`, arranque/parada

- [x] Completada
- **Archivos**: `src/main/monitor-engine.js`
- **Qué hacer**:
  - `startEngine()`/`stopEngine()`: arrancan/detienen un único `setInterval(tick, 1000)`.
    El motor arranca solo si la selección guardada no está vacía (se invoca desde la carga
    inicial, Tarea 14) y se detiene cuando la selección queda vacía tras un `remove-from-selection`.
  - `tick()`: guarda `inFlight` (si el tick anterior sigue en vuelo, se omite el actual —
    D3). Muestrea `S_live` (combinación de `isProcessAlive` por fila con PID +
    `listRunningProcesses()` cada 5 ticks condicionado a que haga falta descubrir aperturas
    + el PID/ruta de la muestra de foco) y `S_focus` (`getForegroundWindow()`). Aplica
    `reduceLifecycle` y luego `reduceFocus`, **en ese orden, nunca al revés** (D1). Para cada
    fila en `closed`, llama `session-log.appendSession(row, new Date())` (Tarea 10) antes de
    descartarla.
  - `closeRow(appId, motivo)` exportado como función de alto nivel (usa el `closeRow` puro
    de la Tarea 11 + `appendSession` + actualiza el estado en memoria del motor) — es el
    único camino que usan tanto el ■ (intención del usuario, IPC) como la baja por cierre de
    proceso dentro del `tick`.
  - `getSnapshot()`: construye `{ rows, selection, limitReached: rows.length === 4 }` a
    partir del estado en memoria.
- **Depends_on**: Tarea 9, Tarea 11, Tarea 12
- **Criterio de completado**: cumple el resto de acceptance criteria de
  `[[row-lifecycle]]`, `[[two-state-row-machine]]` y `[[session-log-persistence]]`. Con la
  app corriendo y este módulo invocado manualmente desde DevTools console del proceso main
  (o con un script temporal que llame `startEngine()` con una selección fabricada que incluya
  un programa real abierto en el equipo): abrir ese programa → aparece en el `getSnapshot()`
  siguiente con `state` según tenga o no el foco; cambiar el foco a otra ventana → su fila
  pasa a `paused`, `elapsedMs` se detiene; volver el foco → retoma; cerrar el programa →
  desaparece de `getSnapshot()` y aparece una línea nueva en `usage-log.txt` con el formato
  esperado.

### Tarea 14: Persistencia de la selección guardada

- [x] Completada
- **Archivos**: `src/main/monitor-engine.js`
- **Qué hacer**: al arrancar el módulo (o en una función `loadSelection()` invocada desde
  `background.js`), leer `monitored-selection.json` vía `json-store.js` (Tarea 1) con
  fallback `[]`. `addToSelection({ appId, name, exePath })` — agrega si no existe ya ese
  `appId` (usa `normalizeAppId` de la Tarea 11), persiste con `writeJson`, y si el motor no
  estaba corriendo lo arranca (`startEngine()`). `removeFromSelection(appId)` — quita de la
  selección, persiste, y si la fila correspondiente estaba en `rows` la cierra con
  `closeRow(appId, 'removed-from-selection')` antes de quitarla (para no dejar una sesión
  huérfana). Si la selección queda vacía, detiene el motor (`stopEngine()`).
- **Depends_on**: Tarea 1, Tarea 13
- **Criterio de completado**: `node -e` no aplica (usa `app.getPath`, requiere Electron). Con
  la app corriendo, usar DevTools console del proceso main o un canal IPC temporal para llamar
  `addToSelection({...})` con un programa real; verificar en el explorador de archivos que
  `%APPDATA%/<app>/monitored-selection.json` (o el `userData` correspondiente) contiene la
  entrada. Cerrar la app por completo y reabrirla: la fila para ese programa reaparece sola si
  el proceso sigue abierto (sin fila si está cerrado, per D6).

### Tarea 15: `ipc-handlers.js` — contrato IPC completo del motor

- [x] Completada
- **Archivos**: `src/main/ipc-handlers.js` (nuevo)
- **Qué hacer**: registrar, en un solo lugar, todos los canales de la tabla de contratos de
  `design.md`:
  - `ipcMain.handle('get-monitored-snapshot', () => monitorEngine.getSnapshot())`
  - `ipcMain.handle('add-to-selection', (e, entry) => { monitorEngine.addToSelection(entry); return monitorEngine.getSnapshot() })`
  - `ipcMain.handle('remove-from-selection', (e, appId) => { monitorEngine.removeFromSelection(appId); return monitorEngine.getSnapshot() })`
  - `ipcMain.on('stop-monitored-row', (e, appId) => monitorEngine.closeRow(appId, 'user-stop'))`
  - `ipcMain.handle('get-settings', () => jsonStore.readJson(settingsPath, { masterVolume: 1, interactionVolume: 1 }))`
  - `ipcMain.on('save-settings', (e, settings) => jsonStore.writeJson(settingsPath, settings))`
  - Suscribir el `tick` del motor (Tarea 13) para que en cada tick y tras cada intención del
    usuario haga `mainWindow.webContents.send('monitored-apps-state', monitorEngine.getSnapshot())`.
  - Exportar una función `registerIpcHandlers(mainWindowRef)` que `background.js` invoca una
    sola vez.
- **Depends_on**: Tarea 4 (forma de `settings`), Tarea 13, Tarea 14
- **Criterio de completado**: con la app corriendo, en DevTools console de la ventana
  principal: `const {ipcRenderer} = require('electron'); ipcRenderer.invoke('get-monitored-snapshot').then(console.log)` devuelve `{ rows: [], selection: [], limitReached: false }` en frío. `ipcRenderer.invoke('add-to-selection', { appId: 'c:\\ruta\\real\\programa.exe', name: 'Programa', exePath: 'C:\\ruta\\real\\Programa.exe' }).then(console.log)` con un programa realmente abierto devuelve un snapshot con una fila para ese `appId`. `ipcRenderer.send('stop-monitored-row', appId)` seguido de un nuevo `invoke('get-monitored-snapshot')` confirma que la fila desapareció y que se agregó una línea a `usage-log.txt`.

### Tarea 16: Podar `background.js` y delegar en `ipc-handlers.js`

- [x] Completada
- **Archivos**: `src/background.js`
- **Qué hacer**: quitar `cronometroInterval`, `currentAppName`, los handlers
  `start-cronometro-monitoring`, `stop-cronometro-monitoring`, `save-log-line`, y el bloque
  de `get-open-windows` (ya movido a `platform-windows.js` en la Tarea 9 — reemplazar el
  handler para que delegue en `platform-windows.listOpenWindows()`). Agregar
  `require('./src/main/ipc-handlers.js').registerIpcHandlers(mainWindow)` dentro de
  `createWindow()`, después de crear `mainWindow`. Cargar la selección guardada
  (`monitor-engine.loadSelection()`, Tarea 14) en `app.whenReady()` o en `createWindow()`, de
  modo que el motor arranque si corresponde antes de que el renderer pida el primer snapshot.
  Conservar sin cambios: `start-monitoring-active-window`, `stop-monitoring-active-window`,
  `set-always-on-top`, `get-app-logs`, `load-sessions`, `save-sessions`, `open-history-window`
  (ya con el fix de la Tarea 3).
- **Depends_on**: Tarea 9, Tarea 15
- **Criterio de completado**: la app arranca sin errores en la terminal del main process. El
  widget "Aplicación" (todavía con la UI vieja de `CronometroAplicacion.vue`, que en este
  punto llama a canales que ya no existen) puede verse roto o inerte — **es esperado**: se
  corrige en el Bloque 3. Lo que sí debe seguir funcionando sin tocar: el widget Manual, el
  widget Pomodoro, el pin-sobre-app de `TitleBar.vue`, el historial (`get-app-logs`,
  `load-sessions`, `save-sessions`), y Opciones (Bloque 1). Repetir la verificación de la
  Tarea 15 por DevTools console para confirmar que el contrato nuevo sigue vivo tras la poda.

---

## Bloque 3 — Store Pinia + UI multi-programa

Cubre `[[two-state-row-machine]]` y `[[row-lifecycle]]` en su cara visible,
`[[simultaneous-limit]]` (comunicación del límite), `[[empty-state]]` y
`[[status-indicator-non-interactive]]` completos.

### Tarea 17: `stores/monitoredApps.js`

- [x] Completada
- **Archivos**: `src/stores/monitoredApps.js` (nuevo)
- **Qué hacer**: `defineStore('monitoredApps', { state: () => ({ rows: [], selection: [], limitReached: false, icons: {} }), actions: { applySnapshot(payload), addApp({appId, name, exePath}), removeApp(appId), stopRow(appId), ensureIcon(exePath) } })`.
  `applySnapshot` es la única mutación de reemplazo (`this.rows = payload.rows`, etc. — D2,
  D17: "espejo, no modelo"). `addApp`/`removeApp` invocan `add-to-selection`/
  `remove-from-selection` y aplican el snapshot de la respuesta. `stopRow` hace
  `ipcRenderer.send('stop-monitored-row', appId)` (sin respuesta directa — el snapshot
  siguiente llega por el listener). En el `created`/setup del store, suscribir
  `ipcRenderer.on('monitored-apps-state', (e, snapshot) => applySnapshot(snapshot))`.
  `ensureIcon` queda con un cuerpo mínimo por ahora (se completa en el Bloque 4).
- **Depends_on**: Tarea 15
- **Criterio de completado**: en DevTools console de la ventana principal, tras montar la
  app: `useMonitoredAppsStore().rows` refleja lo que devuelve `get-monitored-snapshot`.
  Ejecutar `ipcRenderer.invoke('add-to-selection', {...})` desde otra pestaña de DevTools o
  desde el propio store y observar que `rows` del store se actualiza solo, sin recargar la
  página (confirma la suscripción al canal push).

### Tarea 18: `AppRow.vue`

- [x] Completada
- **Archivos**: `src/components/AppRow.vue` (nuevo)
- **Qué hacer**: componente de presentación pura (D12): prop `row` (la fila del snapshot) y
  prop `icon` (dataURL o `null`, resuelto por el padre), emit `stop`. Sin `data()` de estado
  propio, sin timers, sin IPC directo. Estructura: `[logo 32px B/N] [nombre ancho fijo elipsis] [reloj 8ch 2rem][indicador ~12px] [gap] [■ 18px]`. El reloj formatea `row.elapsedMs` con
  `formatTimeHHMMSS`/equivalente de `msToHHMMSS` (Tarea 2) — sin timer propio, se recalcula
  cuando el prop cambia. El indicador: glifo `faPlay` si `row.state === 'running'`, `faPause`
  si `'paused'`; `pointer-events: none`, `cursor: default`, sin `@click`, sin hover/`scale`;
  `aria-label="Contando"` / `aria-label="En pausa"` según estado (sin verbo de acción). El ■
  emite `stop` con `row.appId`, mantiene contraste pleno en ambos estados. Atenuación
  `opacity: 0.55` en logo/nombre/reloj/indicador cuando `state === 'paused'`; el ■ no se
  atenúa.
- **Depends_on**: Tarea 2
- **Criterio de completado**: cumple todos los acceptance criteria de
  `[[status-indicator-non-interactive]]`. Verificación completa en la Tarea 19 (necesita
  el contenedor). Revisión de código aislada: el componente no importa `ipcRenderer` ni
  `useMonitoredAppsStore`.

### Tarea 19: Reescritura de `CronometroAplicacion.vue`

- [x] Completada
- **Archivos**: `src/components/CronometroAplicacion.vue`
- **Qué hacer**: reemplazar por completo el `<script>` actual. Quitar `time`, `intervalId`,
  `running`, `startTime`, `selectedApp`, el `watch` de `appIcon` con `require`, los métodos
  `toggle`/`start`/`pause`/`reset`/`resumeTime`/`pauseTime`, el listener `app-active` y los
  tres formateadores (ya viven en `time-format.js`, Tarea 2). El componente pasa a:
  - leer `useMonitoredAppsStore()` (Tarea 17): `rows`, `limitReached`.
  - `<template>`: encabezado con `.button-history` (sin cambios) + título + botón `+` en la
    esquina superior derecha del encabezado (misma regla absoluta que `.button-history`,
    `right: 0` en vez de `left: 0`; atenuado y `disabled` cuando `limitReached`).
    `v-for="row in monitoredApps.rows" :key="row.appId"` renderizando `AppRow` (Tarea 18),
    pasando `icon` desde `monitoredApps.icons[row.exePath]` (aunque en esta tarea puede ser
    siempre `null`/`idk.png` — el ícono real llega en el Bloque 4), escuchando `@stop="monitoredApps.stopRow(row.appId)"`.
    Estado vacío: si `rows.length === 0`, mostrar `.display` con `00:00:00` fijo, sin mensaje
    ni ilustración (cumple `[[empty-state]]`).
  - el modal de historial por fecha (líneas 46-58 del archivo actual) se conserva tal cual,
    sin tocar su lógica de `loadLogsForDate`/`filteredLogs`.
  - el modal de selección de apps (líneas 28-44 actuales) se deja como placeholder que abre
    `AppSelectorModal` (aunque ese componente recién se construye en el Bloque 5 — en esta
    tarea puede quedar apuntando al modal viejo de procesos abiertos, actualizado para llamar
    `monitoredApps.addApp(...)` en vez del canal viejo `start-cronometro-monitoring`).
- **Depends_on**: Tarea 17, Tarea 18
- **Criterio de completado**: cumple los acceptance criteria de `[[two-state-row-machine]]`,
  `[[row-lifecycle]]` y `[[empty-state]]` visibles en la UI real. Guion manual (puntos 1-7,
  8-12 de `design.md`): abrir un programa de la selección → aparece su fila en `00:00:00`;
  foco en él → avanza e indicador en play; cambiar el foco → se detiene, la fila sigue
  visible en pausa; volver el foco → retoma; cerrar el programa → la fila desaparece y hay
  línea nueva en el historial; reabrirlo → fila nueva en cero. Con 4 programas abiertos, solo
  un reloj avanza a la vez. Presionar ■ en una fila → sale, se escribe su línea, el programa
  sigue en la selección. Sacar la última fila (por ■ o cierre) → el widget queda en
  `00:00:00` con el `+` disponible, sin mensaje.

### Tarea 20: `ResizeObserver` en `Menu.vue`

- [x] Completada
- **Archivos**: `src/components/Menu.vue`
- **Qué hacer**: unificar `aplicarSeleccion()` y `resizeWindow()` en una sola implementación
  de `resizeWindow()` (que ambos invocan; `aplicarSeleccion()` deja de duplicar el bloque de
  medición). Agregar en `mounted()` un `ResizeObserver` sobre `document.getElementById('menuContainer')`
  que, ante cualquier cambio de tamaño, agenda `resizeWindow()` en
  `requestAnimationFrame`. Guarda antibucle: solo llamar `setContentSize` si el tamaño
  calculado difiere del último aplicado en más de 1px (guardar el último `{ancho, alto}`
  aplicado en `data()`). Desconectar el observer en `beforeUnmount()`.
- **Depends_on**: Tarea 19 (necesita que las filas entren/salgan solas para que el
  `ResizeObserver` tenga algo que observar más allá de los gestos actuales)
- **Criterio de completado**: cumple el riesgo de diseño "bucle de realimentación
  `ResizeObserver`/`setContentSize`" con el guion manual punto 13: con 2-3 programas de la
  selección guardada, abrir y cerrar sus procesos repetidamente **sin tocar el mouse ni la
  ventana** (por ejemplo alternando `Alt+F4`/reabrir desde el ícono) y observar que la
  ventana de la app ajusta su alto en cada entrada/salida de fila, sin saltos visibles, sin
  parpadeo y sin quedar oscilando de tamaño. Repetir arrastrando widgets en el menú de
  selección (M/A/P) para confirmar que el resize por ese gesto sigue funcionando igual que
  antes.

---

## Bloque 4 — Íconos automáticos en blanco y negro

Cubre `[[automatic-bw-icons]]` completo.

### Tarea 21: `icon-cache.js`

- [x] Completada
- **Archivos**: `src/main/icon-cache.js` (nuevo)
- **Qué hacer**: `getIcon(exePath)` → `Promise<string>` (dataURL). Caché de dos niveles: un
  `Map` en memoria por `exePath.toLowerCase()`, y `app-icons-cache.json` en disco vía
  `json-store.js` (Tarea 1). Si no está en ninguna caché, llama
  `platform-windows.getExecutableIcon(exePath)` (nueva capacidad D10 —
  `app.getFileIcon(exePath, { size: 'normal' })` + `toDataURL()`, ambas en
  `platform-windows.js` para respetar el aislamiento de SO). Si `getExecutableIcon` devuelve
  `null` o la imagen resulta vacía (`isEmpty()`), usa `src/assets/idk.png` convertido a
  dataURL una sola vez (cachearlo también). Persiste el resultado en ambos niveles de caché
  antes de devolver.
- **Depends_on**: Tarea 1, Tarea 8 (módulo `platform-windows.js` ya existe)
- **Criterio de completado**: cumple acceptance criteria de `[[automatic-bw-icons]]`
  ("ningún ícono depende de una imagen cargada manualmente", "programa sin ícono útil
  muestra la imagen de respaldo"). Con la app corriendo, invocar
  `icon-cache.getIcon('C:\\ruta\\a\\un\\exe\\real.exe')` desde DevTools console del main (o
  un canal temporal) dos veces seguidas: la primera tarda un poco (extracción real), la
  segunda es inmediata (memoria). Reiniciar la app y repetir: la primera llamada tras
  reiniciar también es inmediata (caché en disco). Probar con una ruta que no exista →
  devuelve el dataURL de `idk.png`.

### Tarea 22: Canal `get-app-icon`

- [x] Completada
- **Archivos**: `src/main/ipc-handlers.js`
- **Qué hacer**: `ipcMain.handle('get-app-icon', (e, exePath) => icon-cache.getIcon(exePath).then(dataUrl => ({ exePath, dataUrl })))`.
- **Depends_on**: Tarea 15, Tarea 21
- **Criterio de completado**: en DevTools console de la ventana principal:
  `ipcRenderer.invoke('get-app-icon', 'C:\\ruta\\real.exe').then(console.log)` devuelve
  `{ exePath, dataUrl }` con un `dataUrl` que empieza con `data:image/png;base64,`.

### Tarea 23: Consumo del ícono en `AppRow.vue` / store

- [x] Completada
- **Archivos**: `src/stores/monitoredApps.js`, `src/components/CronometroAplicacion.vue`, `src/components/AppRow.vue`
- **Qué hacer**: completar `ensureIcon(exePath)` en el store (Tarea 17): si
  `icons[exePath]` no existe, invoca `get-app-icon` y guarda el resultado en `icons`. En
  `CronometroAplicacion.vue`, para cada `row` del `v-for`, llamar
  `monitoredApps.ensureIcon(row.exePath)` (por ejemplo en un `watch` sobre `rows` o al
  entrar la fila) y pasar `monitoredApps.icons[row.exePath]` como prop `icon` a `AppRow`. En
  `AppRow.vue`, aplicar `filter: grayscale(1)` al `<img>` del logo (CSS, D9 — el dato viaja a
  color, el gris es tratamiento visual).
- **Depends_on**: Tarea 19, Tarea 22
- **Criterio de completado**: guion manual puntos 14-16 de `design.md`. Con 2+ programas
  monitoreados, cada fila muestra el ícono real del programa correspondiente, renderizado en
  gris. Un programa cuyo ejecutable no resuelve a un ícono útil (o cuya ruta no existe)
  muestra `idk.png`. Reiniciar la app con la selección guardada no vacía: los íconos
  aparecen sin demora perceptible (sin volver a extraer).

---

## Bloque 5 — Selector de apps instaladas + auto-arranque

Cubre `[[installed-apps-listing-quality]]` completo y cierra `[[row-lifecycle]]` /
`[[saved-selection-only-monitoring]]` en su vía de entrada por instaladas.

### Tarea 24: `installed-apps-filter.js`

- [x] Completada
- **Archivos**: `src/main/installed-apps-filter.js` (nuevo)
- **Qué hacer**: `filterInstalledApps(rawEntries) → InstalledApp[]`, función pura sin
  dependencia de Electron ni del sistema operativo (D8, contrato exacto en `design.md`).
  Implementar la tabla de descartes completa del ADR-0003: sin `.exe` existente
  (`targetExists === false`), target bajo `\Windows\`, `\System32\` o `\WinSxS\`,
  subcarpetas `Accessories`/`Administrative Tools`/`Windows Tools`/`Windows PowerShell`/
  `Startup`, nombre de ejecutable con patrón `*update*`/`*setup*`/`*install*`/`unins*`/
  `*crashpad*`/`*helper*`/`*service*`, `systemComponent === true` (o `'1'`), entradas con
  `parentKeyName` o `releaseType` de tipo update/hotfix, o `shortcutName` con patrón
  `KB######`. Sesgo hacia el falso negativo (D8): ante ambigüedad, descartar. Salida:
  `{ appId, name, exePath, publisher }` con `appId = exePath.toLowerCase()`.
- **Depends_on**: —
- **Criterio de completado**: cumple los acceptance criteria de
  `[[installed-apps-listing-quality]]` a nivel de función pura. `node -e` (o un script
  temporal) con un array de entradas fabricadas que incluya: una entrada tipo Discord
  (`targetExists: true`, sin marcas de descarte), una tipo actualizador
  (`targetPath` con `Updater.exe`), una con `systemComponent: true`, una con target bajo
  `C:\Windows\System32\`, y una `KB5001234` con `parentKeyName` seteado. El resultado de
  `filterInstalledApps` debe incluir solo la entrada tipo Discord.

### Tarea 25: `platform-windows.js` — `listInstalledCandidates`

- [x] Completada
- **Archivos**: `src/main/platform-windows.js`
- **Qué hacer**: `listInstalledCandidates() → Promise<RawInstalledEntry[]>` — un único
  proceso PowerShell que recorre `.lnk` de
  `%ProgramData%\Microsoft\Windows\Start Menu\Programs` y
  `%APPDATA%\Microsoft\Windows\Start Menu\Programs` recursivamente, resuelve cada uno con
  `WScript.Shell.CreateShortcut(path).TargetPath`, y enriquece con las claves `Uninstall` de
  `HKLM`, `HKLM\WOW6432Node` y `HKCU` (`Publisher`, `SystemComponent`, `ParentKeyName`,
  `ParentDisplayName`, `ReleaseType`) devolviendo JSON. Sigue el patrón de
  `child_process.exec` ya usado en `get-open-windows`/Tarea 9 (sin dependencias nativas
  nuevas). Devuelve `{ shortcutName, shortcutFolder, targetPath, targetExists, publisher, systemComponent, parentKeyName, releaseType }` por entrada.
- **Depends_on**: Tarea 9
- **Criterio de completado**: en Windows, con la app corriendo,
  `node -e "require('./src/main/platform-windows.js').listInstalledCandidates().then(r => console.log(r.length, r[0]))"` (o vía DevTools console del main) devuelve un array con
  decenas de entradas y la primera tiene la forma esperada. El tiempo de respuesta es un solo
  spawn de PowerShell (verificable viendo que no hay múltiples procesos `powershell.exe`
  abriéndose y cerrándose en el Administrador de Tareas durante la llamada).

### Tarea 26: `installed-apps.js` — orquestación con caché revalidada

- [x] Completada
- **Archivos**: `src/main/installed-apps.js` (nuevo)
- **Qué hacer**: `getInstalledApps()` — si hay caché en `installed-apps-cache.json`
  (Tarea 1), la devuelve de inmediato (`{ apps, cachedAt, loading: false }`) y dispara en
  segundo plano `listInstalledCandidates()` → `filterInstalledApps()` → persiste →
  `mainWindow.webContents.send('installed-apps-updated', { apps, cachedAt })`. Si no hay
  caché, enumera de inmediato y devuelve `{ apps, cachedAt: null, loading: true }` mientras
  la promesa está en vuelo. Deduplicar peticiones concurrentes: una sola promesa de
  enumeración en vuelo compartida entre llamadas simultáneas.
- **Depends_on**: Tarea 1, Tarea 24, Tarea 25
- **Criterio de completado**: cumple el comportamiento de caché revalidada del ADR-0003. Con
  la app corriendo, primera invocación de `getInstalledApps()` (sin caché previa) tarda lo
  que tarda la enumeración completa. Segunda invocación (con `installed-apps-cache.json` ya
  en disco) es inmediata. Llamar dos veces seguidas sin esperar la primera respuesta no
  dispara dos procesos PowerShell (verificable en el Administrador de Tareas).

### Tarea 27: Canales `get-installed-apps` / `installed-apps-updated`

- [x] Completada
- **Archivos**: `src/main/ipc-handlers.js`
- **Qué hacer**: `ipcMain.handle('get-installed-apps', () => installedApps.getInstalledApps())`.
  El push de `installed-apps-updated` ya lo dispara `installed-apps.js` directamente sobre
  `mainWindow.webContents`; esta tarea solo asegura que `ipc-handlers.js` le pase la
  referencia de `mainWindow` (mismo patrón que `monitor-engine`, Tarea 15).
- **Depends_on**: Tarea 15, Tarea 26
- **Criterio de completado**: en DevTools console, `ipcRenderer.invoke('get-installed-apps').then(console.log)` devuelve la forma esperada. Si se instaló o desinstaló algo desde la
  última vez, esperar unos segundos tras la primera respuesta y confirmar que llega un evento
  `installed-apps-updated` por `ipcRenderer.on(...)`.

### Tarea 28: `AppSelectorModal.vue`

- [x] Completada
- **Archivos**: `src/components/AppSelectorModal.vue` (nuevo)
- **Qué hacer**: reemplaza el modal de selección actual de `CronometroAplicacion.vue`. Dos
  vías dentro del mismo selector (tabs o secciones): (1) **instaladas** — consume
  `get-installed-apps`/`installed-apps-updated`, muestra estado de carga cuando
  `loading: true`, marca con un check las entradas que ya están en
  `monitoredApps.selection`; (2) **procesos abiertos** — consume `get-open-windows`
  (extendido, Tarea 9), permite elegir uno aunque no tenga acceso directo reconocible
  (aplica `normalizeAppId` del lado main al agregar, vía `add-to-selection` — D4, caso
  degradado `name:imagen`). Buscador de texto que filtra ambas listas por `name`. Si
  `monitoredApps.limitReached`, deshabilita agregar nuevas entradas y muestra el aviso
  (SHOULD de `[[simultaneous-limit]]`). Al elegir una entrada, llama
  `monitoredApps.addApp({ appId, name, exePath })`.
- **Depends_on**: Tarea 17, Tarea 27
- **Criterio de completado**: cumple los acceptance criteria de
  `[[installed-apps-listing-quality]]` visibles en UI (guion manual puntos 17-20). Con
  Discord y Clip Studio instalados, ambos aparecen en la vía de instaladas. Recorrer el
  listado completo sin encontrar runtimes, actualizadores, redistribuibles ni servicios de
  fondo. Escribir texto en el buscador acota el listado a coincidencias. Un programa
  portable abierto (sin acceso directo reconocible) se puede elegir desde la vía de procesos
  abiertos y queda agregado a la selección guardada.

### Tarea 29: Conectar `CronometroAplicacion.vue` al selector nuevo

- [x] Completada
- **Archivos**: `src/components/CronometroAplicacion.vue`
- **Qué hacer**: reemplazar el modal placeholder de la Tarea 19 por `AppSelectorModal.vue`
  real (Tarea 28), abierto desde el botón `+` del encabezado. Quitar cualquier resto del
  modal viejo de "seleccionar app abierta" que haya quedado de la Tarea 19 si ya no se usa.
- **Depends_on**: Tarea 19, Tarea 28
- **Criterio de completado**: guion manual completo de extremo a extremo — abrir el
  selector con el `+`, elegir un programa instalado cerrado: aparece de inmediato como fila
  en pausa (D6), y al abrir ese programa hereda el PID sin crear fila nueva ni reiniciar la
  sesión. Elegir un programa desde procesos abiertos: aparece con fila corriendo si tiene el
  foco. Con el listado en 4, el `+` se ve atenuado y no agrega una quinta fila aunque se
  elija una entrada del selector.
