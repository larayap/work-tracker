// Orquestación del selector de instaladas: caché en disco, revalidación en
// segundo plano, deduplicación de la promesa de enumeración en vuelo
// (D8/ADR-0003). Llama al módulo de plataforma para los datos crudos y al
// filtro puro para separar aplicaciones de usuario de ruido de sistema.
'use strict'

const path = require('path')
const { app } = require('electron')
const jsonStore = require('./json-store.js')
const platform = require('./platform-windows.js')
const { filterInstalledApps } = require('./installed-apps-filter.js')

let mainWindowRef = null
let inFlightPromise = null

// setMainWindow(win) — ipc-handlers.js la invoca con la misma referencia que
// usa para el motor de monitoreo (Tarea 15/27), así este módulo puede
// empujar `installed-apps-updated` sin que `background.js` lo intermedie.
function setMainWindow(win) {
  mainWindowRef = win
}

function getCacheFilePath() {
  return path.join(app.getPath('userData'), 'installed-apps-cache.json')
}

// enumerate() → Promise<{ apps, cachedAt }> — única promesa en vuelo
// compartida entre llamadas concurrentes (D8: "un solo spawn de PowerShell").
function enumerate() {
  if (inFlightPromise) return inFlightPromise

  inFlightPromise = platform
    .listInstalledCandidates()
    .then((rawEntries) => filterInstalledApps(rawEntries))
    .then((apps) => {
      const cachedAt = Date.now()
      jsonStore.writeJson(getCacheFilePath(), { apps, cachedAt })
      if (mainWindowRef) {
        mainWindowRef.webContents.send('installed-apps-updated', { apps, cachedAt })
      }
      return { apps, cachedAt }
    })

  inFlightPromise.finally(() => {
    inFlightPromise = null
  })

  return inFlightPromise
}

// getInstalledApps() → Promise<{ apps, cachedAt, loading }>
//
// Con caché: la devuelve de inmediato y dispara la revalidación en segundo
// plano (su resultado llega después por `installed-apps-updated`, no por el
// valor de retorno de esta llamada). Sin caché: no espera a la enumeración —
// devuelve de inmediato el estado de carga, y el listado real llega por el
// mismo canal de push cuando la promesa en vuelo se resuelve.
function getInstalledApps() {
  const cached = jsonStore.readJson(getCacheFilePath(), null)

  if (cached) {
    enumerate()
    return Promise.resolve({ apps: cached.apps, cachedAt: cached.cachedAt, loading: false })
  }

  enumerate()
  return Promise.resolve({ apps: [], cachedAt: null, loading: true })
}

module.exports = { getInstalledApps, setMainWindow }
