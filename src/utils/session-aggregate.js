// Agregador de historial por intervalo (D-8): módulo puro y sin dependencias,
// mismo patrón y misma ubicación que `src/utils/time-format.js`. Un único
// agregador sirve tanto al gráfico de la ventana de historial (día/mes/rango,
// `usage-chart-by-interval`) como a la vista por sesión del mismo día
// (`session-view`): día, mes y rango son el mismo mecanismo de intervalo, y
// el colapso por grupo no fusiona relojes, solo suma duraciones (D-3).
// CommonJS deliberado: se verifica con `node -e` directo, sin webpack/Babel,
// sin `fs` ni `electron`.
'use strict'

// filterByInterval(entries, from, to) → entries — comparación de strings
// 'YYYY-MM-DD' sobre el campo `date`, inclusiva en ambos extremos. Válida
// porque `date` siempre tiene el mismo formato y longitud (D-1).
function filterByInterval(entries, from, to) {
  return entries.filter((entry) => entry.date >= from && entry.date <= to)
}

// aggregateByApp(entries) → [{ appId, app, durationMs }] — suma `durationMs`
// por `appId`/`app`, orden descendente por duración total.
function aggregateByApp(entries) {
  const totals = new Map()

  entries.forEach((entry) => {
    const existing = totals.get(entry.appId)
    if (existing) {
      existing.durationMs += entry.durationMs
    } else {
      totals.set(entry.appId, { appId: entry.appId, app: entry.app, durationMs: entry.durationMs })
    }
  })

  return Array.from(totals.values()).sort((a, b) => b.durationMs - a.durationMs)
}

// buildDayTimeline(entries) → bloques cronológicos ordenados por el
// `startedAt` mínimo de cada bloque. Las entradas con el mismo `groupId` se
// colapsan en un único bloque `{ type: 'group', ... }` con `durationMs` como
// la SUMA de `durationMs` de sus miembros (D-3: nunca tiempo de reloj de
// pared); las entradas sin `groupId` quedan como bloques `{ type: 'session',
// entry }` individuales.
function buildDayTimeline(entries) {
  const groups = new Map() // groupId → { block, minStartedAt }
  const items = [] // { block, minStartedAt } — el orden de salida sale de acá

  entries.forEach((entry) => {
    if (!entry.groupId) {
      items.push({ block: { type: 'session', entry }, minStartedAt: entry.startedAt })
      return
    }

    let group = groups.get(entry.groupId)
    if (!group) {
      group = {
        block: {
          type: 'group',
          groupId: entry.groupId,
          groupName: entry.groupName,
          durationMs: 0,
          members: [],
        },
        minStartedAt: entry.startedAt,
      }
      groups.set(entry.groupId, group)
      items.push(group)
    }
    group.block.durationMs += entry.durationMs
    group.block.members.push(entry)
    group.minStartedAt = Math.min(group.minStartedAt, entry.startedAt)
  })

  return items.sort((a, b) => a.minStartedAt - b.minStartedAt).map((item) => item.block)
}

// monthBounds(dateStr) → { from, to } — 'YYYY-MM-DD' al primer y último día
// del mismo mes. `new Date(year, month, 0)` con `month` en base 1 da el día 0
// del mes siguiente = el último día del mes actual, cubriendo 28/29/30/31 sin
// tabla hardcodeada.
function monthBounds(dateStr) {
  const [year, month] = dateStr.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  const lastDayStr = String(lastDay).padStart(2, '0')
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${lastDayStr}` }
}

module.exports = { filterByInterval, aggregateByApp, buildDayTimeline, monthBounds }
