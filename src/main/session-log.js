// Cierre y registro de sesión: la línea de historial y su append a
// usage-log.txt. Absorbe la lógica que hoy vivía en
// CronometroAplicacion.reset(), sin cambiar el formato consumido por
// `get-app-logs` en background.js.
'use strict'

const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { msToHHMMSS, formatTimeHHMMSS, formatDateYYYYMMDD } = require('../utils/time-format.js')

// buildSessionLine(row, endDate) → String — pura, mismo formato que generaba
// CronometroAplicacion.reset(): "[YYYY-MM-DD HH:MM:SS] Aplicación: <name> | Duración: <HH:MM:SS> | Inicio: <HH:MM:SS> | Fin: <HH:MM:SS>"
function buildSessionLine(row, endDate) {
  const duration = msToHHMMSS(row.elapsedMs)
  const startString = row.sessionStartedAt
    ? formatTimeHHMMSS(new Date(row.sessionStartedAt))
    : '00:00:00'
  const endString = formatTimeHHMMSS(endDate)
  const datePart = formatDateYYYYMMDD(endDate)
  const timePart = formatTimeHHMMSS(endDate)
  return `[${datePart} ${timePart}] Aplicación: ${row.name} | Duración: ${duration} | Inicio: ${startString} | Fin: ${endString}`
}

function getLogFilePath() {
  return path.join(app.getPath('userData'), 'usage-log.txt')
}

// appendSession(row, endDate) — construye la línea y la appendea a usage-log.txt.
function appendSession(row, endDate) {
  const line = buildSessionLine(row, endDate)
  fs.appendFile(getLogFilePath(), line + '\n', (err) => {
    if (err) console.error('Error al escribir el log:', err)
  })
}

module.exports = { buildSessionLine, appendSession }
