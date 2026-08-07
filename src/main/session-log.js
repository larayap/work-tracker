// Dueño único de `sessions.json` (D-1/ADR-0007): lo carga una vez al
// arrancar, lo mantiene parseado en memoria, y cada cierre hace `push` +
// `jsonStore.writeJson` sincrónico — una sola escritura por invocación, nunca
// una por fila. La migración one-shot desde `usage-log.txt` vive en
// `session-log-parser.js` (Tarea 12/13, sin `electron`); acá solo se
// resuelven las rutas reales con `app.getPath('userData')` y se delega.
'use strict'

const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const jsonStore = require('./json-store.js')
const { migrateLegacyLogAt } = require('./session-log-parser.js')
const { filterByInterval } = require('../utils/session-aggregate.js')
const { formatDateYYYYMMDD } = require('../utils/time-format.js')

let sessions = [] // estado en memoria, cargado una vez por migrateLegacyLog()
let idCounter = 0 // sufijo del `id`, reinicia en cada arranque del proceso —
// mismo criterio que el parser de migración (Tarea 12)

function getSessionsFilePath() {
  return path.join(app.getPath('userData'), 'sessions.json')
}

function getLegacyLogFilePath() {
  return path.join(app.getPath('userData'), 'usage-log.txt')
}

function getLegacyBackupFilePath() {
  return path.join(app.getPath('userData'), 'usage-log.txt.bak')
}

// migrateLegacyLog() — se invoca una vez al arrancar, antes de
// `monitorEngine.loadSelection()` (ADR-0007: si el motor pudiera abrir
// sesiones antes de que esto corra, crearía `sessions.json` prematuramente y
// la migración se saltearía).
//
// La guarda `existsSync(usage-log.txt)` (fix F1, judgment-report del cambio
// open-source-readiness) es lo que hace cierta la propiedad de reintento que
// ADR-0013 le atribuye al traspaso de `userData`. Sin ella, el protocolo de
// ADR-0007 publicaba `sessions.json = []` incluso cuando no había ningún
// historial legado que migrar — y ese archivo vacío es irreversible: bloquea
// para siempre el paso 1 de ADR-0007. La secuencia que rompía era ésta: el
// traspaso de `userdata-migration.js` falla al copiar `usage-log.txt` en el
// primer arranque (archivo tomado por un antivirus, disco lleno momentáneo),
// se publica un `sessions.json` vacío, y en el arranque siguiente el
// `usage-log.txt` sí se copia pero ya nadie lo parsea: ADR-0007 lo renombra
// a `.bak` sin absorberlo y el historial completo queda invisible.
//
// No publicar nada cuando no hay nada que migrar es equivalente para el
// resto de la aplicación: `jsonStore.readJson` tolera el archivo ausente y
// devuelve el fallback (ADR-0006), y `appendSessions` crea `sessions.json`
// en el primer cierre de sesión. `sessions.json` deja de existir siempre
// después de este punto, y ningún otro consumidor lo asume.
function migrateLegacyLog() {
  if (fs.existsSync(getLegacyLogFilePath())) {
    migrateLegacyLogAt({
      sessionsPath: getSessionsFilePath(),
      legacyPath: getLegacyLogFilePath(),
      backupPath: getLegacyBackupFilePath(),
    })
  }
  sessions = jsonStore.readJson(getSessionsFilePath(), [])
}

// appendSessions(rows, endDate) — construye una entrada por cada `row` (mismo
// shape que produce el parser de migración) y escribe **una sola vez**
// (D-4/ADR-0009: antes de `before-quit`, síncrono). La escritura usa
// `jsonStore.writeJsonAtomic` (fix F3, judgment-report iteración 1): el
// historial completo se reescribe en cada cierre, y uno de los llamadores es
// `closeAllRows` desde `before-quit` — el instante de mayor probabilidad de
// interrupción del proceso de todo el ciclo de vida. `writeJson` desnudo
// dejaba el archivo entero truncado ante esa interrupción; tmp+rename deja
// el historial previo intacto o el nuevo completo, nunca a medio escribir.
function appendSessions(rows, endDate) {
  if (rows.length === 0) return

  const endedAt = endDate.getTime()
  const date = formatDateYYYYMMDD(endDate) // nunca `toISOString()` (V15)

  rows.forEach((row) => {
    idCounter += 1
    sessions.push({
      id: `${endedAt}-${idCounter}`,
      date,
      appId: row.appId,
      app: row.name,
      startedAt: row.sessionStartedAt,
      endedAt,
      durationMs: row.elapsedMs,
      sessionName: row.sessionName || null,
      groupId: row.groupId || null,
      groupName: row.groupName || null,
    })
  })

  jsonStore.writeJsonAtomic(getSessionsFilePath(), sessions)
}

// appendSession(row, endDate) — se mantiene exportada para los llamadores
// existentes que cierran fila por fila (monitor-engine.js); delega en
// `appendSessions` para no duplicar la construcción de la entrada.
function appendSession(row, endDate) {
  appendSessions([row], endDate)
}

// readSessions({ from, to }) → entradas del intervalo, ordenadas por
// `startedAt` ascendente. Usa el mismo `filterByInterval` que el renderer
// (D-8/D-9): un solo criterio de intervalo para main y renderer.
function readSessions({ from, to }) {
  return filterByInterval(sessions, from, to).sort((a, b) => a.startedAt - b.startedAt)
}

// listSessionDates() → fechas únicas, para los puntos del calendario.
function listSessionDates() {
  return [...new Set(sessions.map((entry) => entry.date))]
}

module.exports = {
  migrateLegacyLog,
  appendSession,
  appendSessions,
  readSessions,
  listSessionDates,
}
