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

// normalizeAppName(app) → String — recorta espacios de borde y normaliza
// mayúsculas. `String(app ?? '')` blinda `app` nulo/ausente sin descartar la
// entrada: un agregador que filtra datos oculta el problema y borra tiempo
// registrado.
function normalizeAppName(app) {
  return String(app ?? '').trim().toLowerCase()
}

// groupKeyOf(entry) → String — clave de agrupación de `aggregateByApp`, por
// nombre visible normalizado (ADR-0011). La clave NUNCA vuelve a mirar
// `entry.appId`: agrupar por `appId` desnudo o degradar a él dejaba
// `Chrome` y `Google Chrome` (mismo ejecutable, `appId` distinto por sesión)
// repartidos en filas separadas, y una reinstalación con `appId` nuevo
// duplicaba el mismo programa en el gráfico y en la lista. `appId` queda
// como dato informativo de la fila fusionada (ver `aggregateByApp`), nunca
// como clave — revertir esto reintroduce el defecto que ADR-0011 resuelve.
function groupKeyOf(entry) {
  return `name:${normalizeAppName(entry.app)}`
}

// aggregateByApp(entries) → [{ key, appId, app, durationMs }] — suma
// `durationMs` por `groupKeyOf(entry)` (nombre visible normalizado), orden
// descendente por duración total. `key` es la única clave identificatoria:
// `appId` de la fila fusionada es el primer `appId` no nulo entre los
// miembros, o `null` — puramente informativo, ningún consumidor lo usa como
// clave (ADR-0011). El rótulo `app` de la fila fusionada es el más corto
// entre las variantes de escritura de los miembros (criterio F4 de
// `installed-apps-filter.js:96-100`; ante empate de longitud gana la
// primera aparición).
function aggregateByApp(entries) {
  const totals = new Map()

  entries.forEach((entry) => {
    const key = groupKeyOf(entry)
    const existing = totals.get(key)
    if (!existing) {
      totals.set(key, {
        key,
        appId: entry.appId != null ? entry.appId : null,
        app: entry.app,
        durationMs: entry.durationMs,
      })
      return
    }
    existing.durationMs += entry.durationMs
    if (existing.appId == null && entry.appId != null) existing.appId = entry.appId
    if (String(entry.app ?? '').length < String(existing.app ?? '').length) existing.app = entry.app
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
