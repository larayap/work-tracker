// Funciones puras de formateo de tiempo.
// Extraídas literalmente de CronometroAplicacion.vue (comportamiento sin
// cambios, solo de ubicación) para que las use tanto el main (línea del log)
// como el renderer (reloj de cada fila).
// CommonJS deliberado: se verifica con `node -e` directo sin pasar por
// webpack/Babel (criterio de completado de la Tarea 2), y sigue siendo
// importable desde el renderer vía `import { … } from '@/utils/time-format.js'`
// gracias a la interoperabilidad de Webpack con módulos CommonJS.
'use strict'

function msToHHMMSS(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((v) => (v < 10 ? '0' + v : v))
    .join(':')
}

// formatTimeHHMM(dateObj, format) → String — hora local sin segundos.
// `format` entra como parámetro explícito, nunca leído de estado global: es
// lo que hace verificable esta función con `node -e` sin acoplarla a la UI
// ni al store de preferencias. `'12h'` da `H:MM AM|PM` sin cero a la
// izquierda; cualquier otro valor (incluido `undefined`) da `HH:MM` de 24
// horas con cero a la izquierda — la rama 24h es el comportamiento total de
// la función, no una segunda fuente de verdad del default de producto (ese
// vive solo en `defaultSettings.timeFormat`, en el main).
function formatTimeHHMM(dateObj, format) {
  const h24 = dateObj.getHours()
  const mm = String(dateObj.getMinutes()).padStart(2, '0')
  if (format === '12h') {
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`
  }
  return `${String(h24).padStart(2, '0')}:${mm}`
}

function formatDateYYYYMMDD(dateObj) {
  const yyyy = dateObj.getFullYear()
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
  const dd = String(dateObj.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

module.exports = { msToHHMMSS, formatTimeHHMM, formatDateYYYYMMDD }
