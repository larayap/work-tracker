// Helper de persistencia JSON bajo userData.
// Lectura tolerante a archivo ausente o JSON corrupto: nunca lanza, siempre
// devuelve el `fallback` en esos casos (D11/ADR-0006).
'use strict'

const fs = require('fs')

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    return fallback
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// writeJsonAtomic(filePath, data) — mismo patrón tmp+rename que ya usa
// `migrateLegacyLogAt` (ADR-0007) para publicar `sessions.json` migrado:
// escribe en un archivo temporal junto al destino y recién entonces lo
// renombra sobre el destino final con `fs.renameSync`, que en un mismo
// volumen es la operación atómica que publica el contenido completo de una
// sola vez. Una interrupción a mitad de la escritura deja el `.tmp` a medio
// escribir pero nunca toca el archivo destino (fix F3, judgment-report
// iteración 1: `session-log.js::appendSessions` reescribe el historial
// completo en cada cierre, incluido el cierre síncrono de `before-quit`, y
// una interrupción ahí corrompía todo el historial, no solo la última
// entrada). No sustituye a `writeJson`: el resto de los consumidores
// (selección monitoreada, settings, cachés) sigue con la escritura directa
// sin cambiar su comportamiento — alcance acotado al historial, el único
// archivo que se reescribe entero en cada cierre de sesión.
function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2))
  fs.renameSync(tmpPath, filePath)
}

module.exports = { readJson, writeJson, writeJsonAtomic }
