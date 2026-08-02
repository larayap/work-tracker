// Motor de monitoreo multi-app. Dos reductores puros aplicados en orden fijo
// dentro de un único timer (D1/ADR-0001):
//
//   1. reduceLifecycle — el proceso vivo gobierna la EXISTENCIA de la fila.
//   2. reduceFocus     — el foco gobierna el ESTADO de una fila que ya existe.
//
// Ningún predicado combina las dos señales: es la prohibición explícita del
// ADR-0001, la que evita reintroducir el bug de pausa original.
'use strict'

const path = require('path')
const { app } = require('electron')
const platform = require('./platform-windows.js')
const sessionLog = require('./session-log.js')
const jsonStore = require('./json-store.js')

// ---------------------------------------------------------------------------
// Identidad (D4): appId = ruta del ejecutable normalizada a minúsculas, o el
// prefijo degradado 'name:<imagen>' cuando no hay ruta resoluble (procesos
// elegidos desde la vía de procesos abiertos sin acceso reconocible).
// ---------------------------------------------------------------------------

// degradedAppId(imageName) → String — arma el appId degradado 'name:<imagen>'
// desde un nombre de imagen (con extensión). Única fuente de este formato
// (fix F2, judgment-report iteración 2): antes se armaba por separado en
// `normalizeAppId` y se derivaba con un criterio distinto en
// `matchFocusedAppId`, y esa desalineación entre productor y consumidor del
// mismo dato es justo lo que dejaba sin acumular tiempo a una fila degradada
// con el foco encima.
function degradedAppId(imageName) {
  return 'name:' + String(imageName).toLowerCase()
}

// normalizeAppId({ exePath, imageName }) → String — pura.
function normalizeAppId({ exePath, imageName }) {
  if (exePath) return exePath.toLowerCase()
  return degradedAppId(imageName)
}

// ---------------------------------------------------------------------------
// reduceLifecycle — inserciones y bajas de fila. Nunca decide el estado de una
// fila: una fila que entra queda con `state: null`, que `reduceFocus` resuelve
// en el mismo tick (D1). Sin IPC ni `fs`.
// ---------------------------------------------------------------------------

// reduceLifecycle(sLive, selection, rows) → { rows, selection, closed }
//
// sLive — señal de vida, construida por el orquestador del tick (Tarea 13):
//   { alivePids: Set<Number>,      // pids de filas existentes que siguen vivos
//                                  // (process.kill(pid,0) cada tick, sin spawn)
//     discovered: { [appId]: pid } // evidencia de apertura o vinculación por
//                                  // appId — tasklist cada 5 ticks + PID/ruta
//                                  // de la muestra de foco del propio tick }
//
// Orden interno invariante (D-5/ADR-0009 — resuelve la carrera de la entrada
// manual: sin esto, el mismo tick que cierra una fila manual todavía la ve en
// `selection` al evaluar altas y la recrea):
//   1. filas con PID muerto salen a `closed`
//   2. (mismo paso que el 1) baja atómica de las entradas MANUAL de esas filas
//   3. vinculación de PIDs a filas sin PID
//   4. altas evaluadas sobre `nextSelection`, nunca sobre la `selection` de entrada
function reduceLifecycle(sLive, selection, rows) {
  const closed = []

  // Paso 1: baja de fila con pid !== null cuyo PID ya no está vivo (D6 — una
  // fila con pid: null nunca sale por este camino, porque nunca tuvo
  // evidencia de vida que pueda perder).
  let nextRows = rows.filter((row) => {
    const hasPid = row.pid !== null && row.pid !== undefined
    if (hasPid && !sLive.alivePids.has(row.pid)) {
      closed.push({ row, motivo: 'process-exit' })
      return false
    }
    return true
  })

  // Paso 2 (en el mismo paso que el 1): baja atómica de las entradas `manual`
  // cuyas filas acaban de cerrarse. Si no hubo baja manual, `nextSelection` es
  // la MISMA referencia que `selection` (no clonar sin necesidad) — el
  // llamador (tick()) la usa para decidir con `!==` si hay que persistir.
  let nextSelection = selection
  const closedManualIds = new Set(
    closed.filter(({ row }) => row.type === 'manual').map(({ row }) => row.appId)
  )
  if (closedManualIds.size > 0) {
    nextSelection = selection.filter((entry) => !closedManualIds.has(entry.appId))
  }

  // Paso 3: vinculación de PIDs a filas sin PID (sin cambios) — fila con pid
  // null cuyo proceso se detecta vivo se le asigna el pid, sin abrir sesión
  // nueva ni tocar elapsedMs/sessionStartedAt.
  nextRows = nextRows.map((row) => {
    const noPid = row.pid === null || row.pid === undefined
    const livePid = sLive.discovered[row.appId]
    if (noPid && livePid !== undefined) {
      return { ...row, pid: livePid }
    }
    return row
  })

  // Paso 4: alta — programa de `nextSelection` (nunca `selection`) con
  // proceso vivo y sin fila propia. Nace con `state: null` — reduceFocus lo
  // resuelve en la misma muestra de foco de este tick (D1). El alta manual
  // con proceso cerrado (D6) NO ocurre acá: la dispara
  // `addToSelection`/`add-to-selection` (Tarea 14/17), que crea la fila con
  // `pid: null` fuera del tick.
  nextSelection.forEach((entry) => {
    const alreadyHasRow = nextRows.some((row) => row.appId === entry.appId)
    if (alreadyHasRow) return

    const livePid = sLive.discovered[entry.appId]
    if (livePid === undefined) return // sin evidencia de vida: no hay alta

    if (nextRows.length >= 4) return // límite D7, sin distinguir origen

    const now = Date.now()
    nextRows.push({
      appId: entry.appId,
      name: entry.name,
      exePath: entry.exePath,
      type: entry.type,
      pid: livePid,
      state: null,
      elapsedMs: 0,
      sessionStartedAt: now,
      lastTickAt: now,
      sessionName: null,
      groupId: null,
      groupName: null,
    })
  })

  return { rows: nextRows, selection: nextSelection, closed }
}

// removeRow(rows, appId) → { rows, removed } — pura, helper interno que
// comparten el ■ (intención del usuario) y el cierre de proceso dentro del
// tick (Tarea 13); ambos caminos convergen acá para no divergir (D1).
function removeRow(rows, appId) {
  const removed = rows.find((row) => row.appId === appId) || null
  const nextRows = rows.filter((row) => row.appId !== appId)
  return { rows: nextRows, removed }
}

// ---------------------------------------------------------------------------
// reduceFocus — asigna estado a las filas que ya existen. Nunca cambia cuántas
// filas hay: solo puede transicionar corriendo ⇄ pausado (D1).
// ---------------------------------------------------------------------------

// matchFocusedAppId(sFocus, rows) → appId | null
//
// Correlación en el orden que fija D4: ruta primero (vía primaria y exacta),
// nombre de imagen después (vía de respaldo para filas degradadas 'name:...').
//
// El nombre de imagen de respaldo se deriva de `sFocus.exePath` con
// `path.basename` cuando la ruta está disponible — la misma derivación que
// usa `addToSelection()` para armar el appId degradado (vía `degradedAppId`)
// — en vez de `sFocus.name`. Fix de F2 (judgment-report iteración 2):
// `sFocus.name` es, en Windows, la Description del recurso de versión del
// ejecutable (verificado en el código nativo vendorizado de `active-win`),
// que para la mayoría de los programas no coincide con su nombre de imagen;
// una fila degradada nunca vinculaba el foco aunque la ruta sí llegara
// resuelta, porque su `appId` no tiene `exePath` propio contra el cual
// comparar. `sFocus.name` queda como último recurso, solo si no hay
// `exePath` en la muestra de foco.
function matchFocusedAppId(sFocus, rows) {
  if (!sFocus) return null

  if (sFocus.exePath) {
    const byPath = rows.find(
      (row) => row.exePath && row.exePath.toLowerCase() === sFocus.exePath.toLowerCase()
    )
    if (byPath) return byPath.appId

    const byDegradedFromPath = rows.find(
      (row) => row.appId === degradedAppId(path.basename(sFocus.exePath))
    )
    if (byDegradedFromPath) return byDegradedFromPath.appId
  }

  if (sFocus.name) {
    const byName = rows.find((row) => row.appId === degradedAppId(sFocus.name))
    if (byName) return byName.appId
  }

  return null
}

// reduceFocus(sFocus, rows, now) → rows — pura.
// sFocus: { exePath, name, pid } | null — muestra de getForegroundWindow().
function reduceFocus(sFocus, rows, now) {
  const focusedAppId = matchFocusedAppId(sFocus, rows)

  return rows.map((row) => {
    if (row.appId === focusedAppId) {
      return {
        ...row,
        state: 'running',
        elapsedMs: row.elapsedMs + (now - row.lastTickAt),
        lastTickAt: now,
      }
    }
    return { ...row, state: 'paused', lastTickAt: now }
  })
}

// ---------------------------------------------------------------------------
// Estado en memoria y orquestación del tick (Tarea 13). Nada de esto es puro:
// vive acá porque el main process es la fuente de verdad (D2/ADR-0002).
// ---------------------------------------------------------------------------

let selection = [] // selección guardada — persistida, ver Tarea 14
let rows = [] // listado visible — solo en memoria (D5/ADR-0006)
let tickHandle = null
let inFlight = false
let discoveryTickCounter = 0

const listeners = []

// onUpdate(callback) — se invoca tras cada tick y tras cada intención del
// usuario que cambie el snapshot. ipc-handlers.js (Tarea 15) lo usa para
// empujar `monitored-apps-state` sin que este módulo conozca IPC ni
// `mainWindow`.
function onUpdate(callback) {
  listeners.push(callback)
}

function notify() {
  listeners.forEach((callback) => callback())
}

// tick() — muestrea S_live y S_focus, aplica los dos reductores en orden fijo
// (D1) y registra las sesiones cerradas antes de descartar sus filas.
async function tick() {
  if (inFlight) return
  inFlight = true
  try {
    discoveryTickCounter += 1

    // S_live, parte 1: liveness barata por PID de fila conocido, sin spawn.
    const alivePids = new Set()
    rows.forEach((row) => {
      if (row.pid !== null && row.pid !== undefined && platform.isProcessAlive(row.pid)) {
        alivePids.add(row.pid)
      }
    })

    const discovered = {}

    // S_focus: única fuente de foco. La muestra también aporta evidencia de
    // vida (D1/D3) para el programa en foco, sin spawn adicional.
    const focusSample = await platform.getForegroundWindow()
    if (focusSample && focusSample.exePath) {
      const focusedAppId = focusSample.exePath.toLowerCase()
      const inSelection = selection.some((entry) => entry.appId === focusedAppId)
      if (inSelection && focusSample.pid) {
        discovered[focusedAppId] = focusSample.pid
      }
    }

    // S_live, parte 2: descubrimiento condicionado (D3) — solo si hace falta
    // (hay selección sin fila y el listado no está lleno) y solo cada 5 ticks.
    const missingSelection = selection.some(
      (entry) => !rows.some((row) => row.appId === entry.appId)
    )
    const needsDiscovery = missingSelection && rows.length < 4
    if (needsDiscovery && discoveryTickCounter % 5 === 0) {
      const processes = await platform.listRunningProcesses()
      selection.forEach((entry) => {
        if (discovered[entry.appId] !== undefined) return
        const imageName = entry.exePath
          ? path.basename(entry.exePath)
          : entry.appId.replace(/^name:/, '')
        const match = processes.find(
          (proc) => proc.imageName.toLowerCase() === imageName.toLowerCase()
        )
        if (match) discovered[entry.appId] = match.pid
      })
    }

    // 1. Ciclo de vida primero (D1): inserciones y bajas.
    const lifecycleResult = reduceLifecycle({ alivePids, discovered }, selection, rows)
    lifecycleResult.closed.forEach(({ row }) => sessionLog.appendSession(row, new Date()))

    // La baja atómica de entradas manuales (D-5/ADR-0009) solo se persiste
    // cuando el reductor devolvió una referencia distinta — comparación por
    // referencia, no de contenido, para no escribir en cada tick.
    if (lifecycleResult.selection !== selection) {
      selection = lifecycleResult.selection
      jsonStore.writeJson(getSelectionFilePath(), selection)
    }

    // 2. Foco después (D1): asigna estado a las filas que sobrevivieron.
    rows = reduceFocus(focusSample, lifecycleResult.rows, Date.now())

    notify()
  } finally {
    inFlight = false
  }
}

// startEngine()/stopEngine() — un único timer de 1000ms (D1). Arranca solo si
// la selección guardada no está vacía.
function startEngine() {
  if (tickHandle) return
  tickHandle = setInterval(tick, 1000)
}

function stopEngine() {
  if (tickHandle) {
    clearInterval(tickHandle)
    tickHandle = null
  }
}

// closeRow(appId, motivo) — único camino de salida de fila por intención
// externa (■ del usuario). El cierre por proceso muerto pasa por el mismo
// `removeRow` puro dentro de `tick()`, vía `reduceLifecycle` (D1, sequence
// diagram "Salida de fila" de design.md).
function closeRow(appId, motivo) {
  const { rows: nextRows, removed } = removeRow(rows, appId)
  if (removed) {
    console.log(`Fila cerrada: ${appId} (${motivo})`)
    sessionLog.appendSession(removed, new Date())
    rows = nextRows

    // Baja atómica de la entrada manual (D-5/ADR-0009): en la misma operación
    // síncrona que quita la fila y registra la sesión, nunca en un paso
    // posterior — ningún camino de salida de fila puede dejar sin resolver,
    // en la misma operación, la baja de su entrada en `selection`.
    if (removed.type === 'manual') {
      const prevLength = selection.length
      selection = selection.filter((entry) => entry.appId !== appId)
      if (selection.length !== prevLength) {
        jsonStore.writeJson(getSelectionFilePath(), selection)
      }
    }

    notify()
  }
  return removed
}

// ---------------------------------------------------------------------------
// Nombre de sesión y grupo (D-3/ADR-0008): campos de la fila, no una entidad
// aparte. Un grupo existe si y solo si hay al menos una fila con ese
// `groupId`; su nombre es el `groupName` que comparten esas filas.
// ---------------------------------------------------------------------------

// renameSession(appId, name) — pone o cambia el nombre de la sesión de una
// fila mientras está abierta.
function renameSession(appId, name) {
  const row = rows.find((r) => r.appId === appId)
  if (row) {
    row.sessionName = name || null
    notify()
  }
}

// renameGroup(groupId, name) — escribe `groupName` en TODAS las filas del
// grupo (no hay un único lugar donde vive el nombre: cada fila lo repite).
function renameGroup(groupId, name) {
  const groupName = name || null
  let changed = false
  rows.forEach((row) => {
    if (row.groupId === groupId) {
      row.groupName = groupName
      changed = true
    }
  })
  if (changed) notify()
}

// setRowGroup(appId, groupId) — traduce la intención del arrastre (D-7) a un
// cambio de estado autoritativo. Con `groupId` truthy, la fila se suma al
// grupo y hereda el `groupName` que ya tengan sus otras filas (o `null` si es
// la primera — el nombre llega después, vía `renameGroup`). Con `groupId`
// null/falsy, la fila sale de cualquier grupo.
function setRowGroup(appId, groupId) {
  const row = rows.find((r) => r.appId === appId)
  if (!row) return

  if (groupId) {
    const sibling = rows.find((r) => r.groupId === groupId && r.appId !== appId)
    row.groupId = groupId
    row.groupName = sibling ? sibling.groupName : null
  } else {
    row.groupId = null
    row.groupName = null
  }

  notify()
}

// closeAllRows(motivo) — cierre sincrónico de todas las filas abiertas
// (D-4/ADR-0009), pensado para `before-quit`: una única llamada a
// `appendSessions` (nunca un `forEach` con `appendSession` por fila), que
// hace un único `jsonStore.writeJson` sincrónico — el trabajo entero entre
// `before-quit` y la escritura en disco es síncrono, sin `await` ni callback
// asíncrono de por medio.
function closeAllRows(motivo) {
  if (rows.length === 0) return
  console.log(`Cierre de ${rows.length} fila(s) al salir (${motivo})`)
  sessionLog.appendSessions(rows, new Date())
  rows = []
}

// getSnapshot() — mensaje único de estado que viaja al renderer (D2).
function getSnapshot() {
  return {
    rows: rows.map((row) => ({
      appId: row.appId,
      name: row.name,
      exePath: row.exePath,
      pid: row.pid,
      state: row.state,
      elapsedMs: row.elapsedMs,
      sessionStartedAt: row.sessionStartedAt,
      type: row.type,
      sessionName: row.sessionName,
      groupId: row.groupId,
      groupName: row.groupName,
    })),
    selection: selection.map((entry) => ({
      appId: entry.appId,
      name: entry.name,
      exePath: entry.exePath,
      type: entry.type,
    })),
    limitReached: rows.length === 4,
  }
}

// ---------------------------------------------------------------------------
// Persistencia de la selección guardada (Tarea 14, D11/ADR-0006).
// ---------------------------------------------------------------------------

function getSelectionFilePath() {
  return path.join(app.getPath('userData'), 'monitored-selection.json')
}

// isEntryAlive(entry, processes) — pura, helper de la reconciliación de
// arranque: deriva el nombre de imagen de la misma forma que el
// descubrimiento condicionado del tick (path.basename del exePath, o el
// sufijo del appId degradado si no hay exePath) y lo busca entre los
// procesos vivos reportados por `tasklist`.
function isEntryAlive(entry, processes) {
  const imageName = entry.exePath
    ? path.basename(entry.exePath)
    : entry.appId.replace(/^name:/, '')
  return processes.some((proc) => proc.imageName.toLowerCase() === imageName.toLowerCase())
}

// loadSelection() — se invoca una vez al arrancar background.js (Tarea 16),
// ahora async (D-5/ADR-0009): normaliza `type` una sola vez al leer (ausente
// ⇒ 'auto'), y si hay al menos una entrada `manual` reconcilia contra los
// procesos vivos —una única enumeración, nunca si todas las entradas son
// `auto`, mismo criterio de costo que el descubrimiento condicionado del
// tick—, descartando las manuales sin proceso vivo correspondiente sin tocar
// las automáticas. Persiste solo si la reconciliación descartó algo. Arranca
// el motor si la selección resultante no está vacía.
async function loadSelection() {
  const stored = jsonStore.readJson(getSelectionFilePath(), [])
  const normalized = stored.map((entry) => ({
    ...entry,
    type: entry.type === 'manual' ? 'manual' : 'auto',
  }))

  let reconciled = normalized
  if (normalized.some((entry) => entry.type === 'manual')) {
    const processes = await platform.listRunningProcesses()
    reconciled = normalized.filter((entry) => entry.type !== 'manual' || isEntryAlive(entry, processes))
  }

  selection = reconciled
  if (reconciled.length !== normalized.length) {
    jsonStore.writeJson(getSelectionFilePath(), selection)
  }
  if (selection.length > 0) startEngine()
}

// addToSelection({ appId, name, exePath, imageName }) — agrega si no existe
// ya ese appId y crea su fila de inmediato (D6/row-lifecycle: agregar muestra
// la fila sin esperar evidencia de vida). La fila nace con `pid: null` y
// espera — no es candidata a baja hasta que se observe una transición real de
// vivo a muerto (D6). El límite de 4 sigue teniendo precedencia sobre el alta
// inmediata (D7): con el listado lleno, el programa queda en la selección sin
// fila hasta que se libere un lugar.
//
// `imageName` (fix C2, judgment-fixes-iteration-1): cuando no hay `appId`
// explícito ni `exePath` resoluble (vía de procesos abiertos degradada), el
// `appId` degradado que D4 especifica se arma sobre el nombre de imagen real
// — el mismo formato que devuelve `tasklist` en el tick de descubrimiento
// (líneas más abajo) — nunca sobre `name`, que es la descripción legible que
// se muestra en la fila y no tiene por qué coincidir con ningún nombre de
// imagen.
function addToSelection({ appId, name, exePath, imageName, type }) {
  const id = appId || normalizeAppId({ exePath, imageName })
  const existingEntry = selection.find((entry) => entry.appId === id)
  // `type` ('manual' | 'auto', Tarea 9): default 'auto' preserva el
  // comportamiento de hoy. Si la entrada ya existía en la selección, la fila
  // nueva hereda su `type` real en vez del que llega en esta llamada — evita
  // que dos altas del mismo `appId` con distinto toggle dejen la fila
  // desalineada con su propia entrada de selección.
  const entryType = existingEntry ? existingEntry.type : type || 'auto'

  if (!existingEntry) {
    selection.push({ appId: id, name, exePath: exePath || null, addedAt: Date.now(), type: entryType })
    jsonStore.writeJson(getSelectionFilePath(), selection)
  }

  const alreadyHasRow = rows.some((row) => row.appId === id)
  if (!alreadyHasRow && rows.length < 4) {
    const now = Date.now()
    rows.push({
      appId: id,
      name,
      exePath: exePath || null,
      type: entryType,
      pid: null,
      state: 'paused',
      elapsedMs: 0,
      sessionStartedAt: now,
      lastTickAt: now,
      sessionName: null,
      groupId: null,
      groupName: null,
    })
  }

  if (!tickHandle) startEngine()
  notify()
}

// removeFromSelection(appId) — quita de la selección y, si tenía fila propia,
// la cierra con closeRow (motivo 'removed-from-selection') para no dejar una
// sesión huérfana. Detiene el motor si la selección queda vacía.
function removeFromSelection(appId) {
  selection = selection.filter((entry) => entry.appId !== appId)
  jsonStore.writeJson(getSelectionFilePath(), selection)

  if (rows.some((row) => row.appId === appId)) {
    closeRow(appId, 'removed-from-selection')
  }

  if (selection.length === 0) stopEngine()
  notify()
}

module.exports = {
  normalizeAppId,
  reduceLifecycle,
  reduceFocus,
  removeRow,
  tick,
  startEngine,
  stopEngine,
  closeRow,
  closeAllRows,
  renameSession,
  renameGroup,
  setRowGroup,
  getSnapshot,
  onUpdate,
  loadSelection,
  addToSelection,
  removeFromSelection,
}
