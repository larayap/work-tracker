// Motor de monitoreo multi-app. Dos reductores puros aplicados en orden fijo
// dentro de un único timer (D1/ADR-0001):
//
//   1. reduceLifecycle — el proceso vivo gobierna la EXISTENCIA de la fila.
//   2. reduceFocus     — el foco gobierna el ESTADO de una fila que ya existe.
//
// Ningún predicado combina las dos señales: es la prohibición explícita del
// ADR-0001, la que evita reintroducir el bug de pausa original.
'use strict'

// ---------------------------------------------------------------------------
// Identidad (D4): appId = ruta del ejecutable normalizada a minúsculas, o el
// prefijo degradado 'name:<imagen>' cuando no hay ruta resoluble (procesos
// elegidos desde la vía de procesos abiertos sin acceso reconocible).
// ---------------------------------------------------------------------------

// normalizeAppId({ exePath, imageName }) → String — pura.
function normalizeAppId({ exePath, imageName }) {
  if (exePath) return exePath.toLowerCase()
  return 'name:' + String(imageName).toLowerCase()
}

// ---------------------------------------------------------------------------
// reduceLifecycle — inserciones y bajas de fila. Nunca decide el estado de una
// fila: una fila que entra queda con `state: null`, que `reduceFocus` resuelve
// en el mismo tick (D1). Sin IPC ni `fs`.
// ---------------------------------------------------------------------------

// reduceLifecycle(sLive, selection, rows) → { rows, closed }
//
// sLive — señal de vida, construida por el orquestador del tick (Tarea 13):
//   { alivePids: Set<Number>,      // pids de filas existentes que siguen vivos
//                                  // (process.kill(pid,0) cada tick, sin spawn)
//     discovered: { [appId]: pid } // evidencia de apertura o vinculación por
//                                  // appId — tasklist cada 5 ticks + PID/ruta
//                                  // de la muestra de foco del propio tick }
function reduceLifecycle(sLive, selection, rows) {
  const closed = []

  // baja: fila con pid !== null cuyo PID ya no está vivo (D6 — una fila con
  // pid: null nunca sale por este camino, porque nunca tuvo evidencia de vida
  // que pueda perder).
  let nextRows = rows.filter((row) => {
    const hasPid = row.pid !== null && row.pid !== undefined
    if (hasPid && !sLive.alivePids.has(row.pid)) {
      closed.push({ row, motivo: 'process-exit' })
      return false
    }
    return true
  })

  // vinculación: fila con pid null cuyo proceso se detecta vivo → se le asigna
  // el pid, sin abrir sesión nueva ni tocar elapsedMs/sessionStartedAt.
  nextRows = nextRows.map((row) => {
    const noPid = row.pid === null || row.pid === undefined
    const livePid = sLive.discovered[row.appId]
    if (noPid && livePid !== undefined) {
      return { ...row, pid: livePid }
    }
    return row
  })

  // alta: programa de `selection` con proceso vivo y sin fila propia.
  // Nace con `state: null` — reduceFocus lo resuelve en la misma muestra de
  // foco de este tick (D1). El alta manual con proceso cerrado (D6) NO ocurre
  // acá: la dispara `addToSelection`/`add-to-selection` (Tarea 14/17), que crea
  // la fila con `pid: null` fuera del tick.
  selection.forEach((entry) => {
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
      pid: livePid,
      state: null,
      elapsedMs: 0,
      sessionStartedAt: now,
      lastTickAt: now,
    })
  })

  return { rows: nextRows, closed }
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
// `sFocus.name` en Windows no siempre es un nombre de imagen exacto (puede ser
// la descripción del proceso) — es la misma degradación que D4 ya acepta para
// la vía de procesos abiertos sin ruta resoluble.
function matchFocusedAppId(sFocus, rows) {
  if (!sFocus) return null

  if (sFocus.exePath) {
    const byPath = rows.find(
      (row) => row.exePath && row.exePath.toLowerCase() === sFocus.exePath.toLowerCase()
    )
    if (byPath) return byPath.appId
  }

  if (sFocus.name) {
    const degradedId = 'name:' + sFocus.name.toLowerCase()
    const byName = rows.find((row) => row.appId === degradedId)
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

module.exports = {
  normalizeAppId,
  reduceLifecycle,
  reduceFocus,
  removeRow,
}
