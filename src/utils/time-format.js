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

function formatTimeHHMMSS(dateObj) {
  const hh = String(dateObj.getHours()).padStart(2, '0')
  const mm = String(dateObj.getMinutes()).padStart(2, '0')
  const ss = String(dateObj.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function formatDateYYYYMMDD(dateObj) {
  const yyyy = dateObj.getFullYear()
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
  const dd = String(dateObj.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

module.exports = { msToHHMMSS, formatTimeHHMMSS, formatDateYYYYMMDD }
