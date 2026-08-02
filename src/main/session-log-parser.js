// Parser puro del historial legado (`usage-log.txt`) y orquestación de la
// migración one-shot (D-2/ADR-0007). Se separa de `session-log.js` a
// propósito (refinamiento de `tasks.md` sobre `design.md`): `session-log.js`
// hace `require('electron')` en su nivel superior (para `app.getPath`), así
// que cualquier función que viva ahí —pura o no— se vuelve imposible de
// requerir con `node -e` en un entorno sin `node_modules`. Este módulo solo
// usa `fs`/`path` del núcleo de Node, nunca `electron`: `parseLegacyLog` ni
// siquiera toca disco, y `migrateLegacyLogAt` recibe las rutas reales como
// parámetro en vez de resolverlas con `app.getPath('userData')` — eso lo
// hace `session-log.js`, que sigue siendo el dueño único de `sessions.json`.
'use strict'

const fs = require('fs')

const LOG_LINE_PATTERN = /\[(.*?)\] Aplicación: (.*?) \| Duración: (.*?) \| Inicio: (.*?) \| Fin: (.*)/

// parseHHMMSSToMs('HH:MM:SS') → Number — milisegundos. Única fuente de
// `durationMs`: el campo `Duración`, nunca `endedAt - startedAt` (V2 de
// `design.md` — el reloj no cuenta en pausa, así que la resta sobrestima).
function parseHHMMSSToMs(hhmmss) {
  const [hours, minutes, seconds] = hhmmss.split(':').map(Number)
  return ((hours * 60 + minutes) * 60 + seconds) * 1000
}

// buildLocalDateTime('YYYY-MM-DD', 'HH:MM:SS') → Date — combina fecha y hora
// como LOCAL, nunca UTC. El constructor numérico de `Date` interpreta sus
// argumentos en hora local; `new Date(`${date}T${time}`)` en cambio se lee
// como UTC cuando la cadena no lleva offset, que es exactamente el defecto
// que V15/D-10 corrige en el resto de este cambio — no reintroducirlo acá.
function buildLocalDateTime(datePart, timePart) {
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes, seconds] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, seconds)
}

// parseLegacyLog(text) → { entries, discardedCount } — pura, sin tocar disco.
// Aplica la regex que hoy vive en `background.js:215` línea a línea. Reglas
// de reconstrucción (D-2, ninguna negociable): `durationMs` del campo
// `Duración`; `startedAt` resta un día si `Inicio > Fin` (cruce de
// medianoche, comparación de string válida porque ambos son `HH:MM:SS` de
// igual longitud); `app` conserva el literal `"null"` tal cual llega, sin
// convertir a `null` de JS (V3); líneas duplicadas exactas producen entradas
// separadas con `id` distinto (`counter` incremental por línea que matchea).
function parseLegacyLog(text) {
  const entries = []
  let discardedCount = 0
  let counter = 0

  text
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(LOG_LINE_PATTERN)
      if (!match) {
        discardedCount += 1
        return
      }

      const [, datetime, appName, duration, startTime, endTime] = match
      const [datePart] = datetime.split(' ')

      const endDate = buildLocalDateTime(datePart, endTime)
      let startDate = buildLocalDateTime(datePart, startTime)
      if (startTime > endTime) {
        startDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
      }

      const endedAt = endDate.getTime()
      counter += 1

      entries.push({
        id: `${endedAt}-${counter}`,
        date: datePart,
        appId: null,
        app: appName,
        startedAt: startDate.getTime(),
        endedAt,
        durationMs: parseHHMMSSToMs(duration),
        sessionName: null,
        groupId: null,
        groupName: null,
      })
    })

  return { entries, discardedCount }
}

// migrateLegacyLogAt({ sessionsPath, legacyPath, backupPath }) — protocolo de
// tres pasos de ADR-0007, idempotente y no destructivo. Rutas explícitas
// como parámetro: este módulo no resuelve `userData`, para mantenerse libre
// de `electron` (Tarea 14 lo hace en `session-log.js`).
function migrateLegacyLogAt({ sessionsPath, legacyPath, backupPath }) {
  if (!fs.existsSync(sessionsPath)) {
    const text = fs.existsSync(legacyPath) ? fs.readFileSync(legacyPath, 'utf-8') : ''
    const { entries, discardedCount } = parseLegacyLog(text)
    if (discardedCount > 0) {
      console.log(`Migración de historial: ${discardedCount} línea(s) descartada(s) por no matchear el formato esperado.`)
    }
    // Publicación por renombre (D-2): sessions.json solo aparece cuando ya
    // está completo. No hay ningún punto donde exista a medio escribir.
    const tmpPath = sessionsPath + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(entries, null, 2))
    fs.renameSync(tmpPath, sessionsPath)
  }

  // Paso independiente del anterior: corre siempre que aplique, incluso si
  // el paso de arriba se saltó por "ya migrado". El original nunca se borra,
  // solo se renombra.
  if (fs.existsSync(legacyPath) && !fs.existsSync(backupPath)) {
    fs.renameSync(legacyPath, backupPath)
  }
}

module.exports = { parseLegacyLog, migrateLegacyLogAt }
