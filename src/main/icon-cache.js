// Caché de dos niveles por exePath normalizado (D9/ADR-0005): un Map en
// memoria para el proceso en curso, y un archivo JSON en disco que sobrevive
// al reinicio. La extracción real solo se dispara cuando ninguno de los dos
// niveles tiene la ruta pedida.
'use strict'

const path = require('path')
const { app, nativeImage } = require('electron')
const jsonStore = require('./json-store.js')
const platform = require('./platform-windows.js')

const memoryCache = new Map()
let fallbackDataUrlCache = null

// Cola de escrituras a disco (fix S1, judgment-fixes-iteration-1). `getIcon`
// separa lectura y escritura del archivo de caché con un `await` de por
// medio (la extracción del ícono); con 2+ extracciones en vuelo —el caso
// típico al arrancar con varios programas ya abiertos, Vue dispara
// `ensureIcon` para cada fila en un `forEach` síncrono— cada escritura
// pisaría el archivo completo con el estado que leyó *antes* de esperar,
// perdiendo las claves que otra extracción concurrente ya había escrito.
// Encolar la escritura real (lectura+merge+escritura, todo síncrono, sin
// `await` de por medio) hace que cada una vea en disco el resultado de la
// anterior. Mismo patrón de promesa encadenada que ya usa
// `installed-apps.js` para deduplicar su enumeración en vuelo.
let diskWriteQueue = Promise.resolve()

// persistToDisk(key, dataUrl) — encola una escritura; lee el archivo recién
// en el momento en que le toca el turno, no antes, para no perder entradas
// escritas por escrituras encoladas previamente.
function persistToDisk(key, dataUrl) {
  diskWriteQueue = diskWriteQueue.then(() => {
    const diskCache = jsonStore.readJson(getCacheFilePath(), {})
    diskCache[key] = dataUrl
    jsonStore.writeJson(getCacheFilePath(), diskCache)
  })
  return diskWriteQueue
}

function getCacheFilePath() {
  return path.join(app.getPath('userData'), 'app-icons-cache.json')
}

// getFallbackDataUrl() — public/img/idk.png convertido a data URL, cacheado
// una sola vez en memoria.
//
// Nota de entorno: `src/main/*.js` se empaqueta en un único bundle
// (`background.js`) sin loader de imágenes en el webpack del proceso main
// (a diferencia del renderer, que sí procesa `require('@/assets/...')` como
// asset). Requerir el PNG directamente rompería ese bundle, así que se lee
// el archivo del disco con `nativeImage.createFromPath`. La ruta se arma con
// `__static` (global inyectada por `vue-cli-plugin-electron-builder` vía
// `DefinePlugin`, ya usada en `background.js` para `icon-work.png`): en
// desarrollo apunta a `public/`, y en un build empaquetado apunta a la raíz
// de `directories.app` (que sí incluye lo copiado desde `public/`, a
// diferencia de `src/`, que `directories.app` nunca contiene en ninguna
// plataforma — confirmado extrayendo el `app.asar` de un build real).
function getFallbackDataUrl() {
  if (fallbackDataUrlCache) return fallbackDataUrlCache
  try {
    const idkPath = path.join(__static, 'img', 'idk.png')
    const image = nativeImage.createFromPath(idkPath)
    fallbackDataUrlCache = image.isEmpty() ? null : image.toDataURL()
  } catch (err) {
    fallbackDataUrlCache = null
  }
  return fallbackDataUrlCache
}

// getIcon(exePath) → Promise<String> — data URL. Persiste en ambos niveles de
// caché antes de devolver.
async function getIcon(exePath) {
  const key = String(exePath).toLowerCase()

  if (memoryCache.has(key)) return memoryCache.get(key)

  const diskCache = jsonStore.readJson(getCacheFilePath(), {})
  if (diskCache[key]) {
    memoryCache.set(key, diskCache[key])
    return diskCache[key]
  }

  const extracted = await platform.getExecutableIcon(exePath)
  const dataUrl = extracted || getFallbackDataUrl()

  memoryCache.set(key, dataUrl)
  await persistToDisk(key, dataUrl)

  return dataUrl
}

module.exports = { getIcon }
