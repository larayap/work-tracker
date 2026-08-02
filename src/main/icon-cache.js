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

// Cola de escrituras a disco (fix S1, judgment-fixes-iteration-1), con
// volcado por tanda (D-14, Tarea 4). `getIcon` separa lectura y escritura del
// archivo de caché con un `await` de por medio (la extracción del ícono); con
// N extracciones en vuelo —el caso típico al abrir el selector con ~82
// entradas (Tarea 5, concurrencia 6)— una escritura por ícono costaría N
// lecturas y N escrituras de un archivo que crece con cada una.
//
// Las entradas pendientes se acumulan en `pendingWrites`; el volcado real se
// agenda con un temporizador (`DEBOUNCE_MS`) que se **reinicia** con cada
// llegada mientras sigue pendiente. Un `diskWriteQueue.then(...)` a secas
// (microtask puro) no alcanza: la extracción nativa del ícono es una llamada
// asíncrona real que tarda mucho más que un microtask, así que la primera en
// resolver dispararía el volcado antes de que las demás hayan llamado a
// `persistToDisk` — el mismo patrón de "una escritura por ícono" de antes,
// disfrazado. El debounce deja que una tanda que resuelve en un rango de
// tiempo cercano se acumule antes de la lectura+escritura única.
let diskWriteQueue = Promise.resolve()
const DEBOUNCE_MS = 50

let pendingWrites = new Map()
let flushTimer = null
let flushPromise = null
let resolveFlushPromise = null

// runFlush() — le toca el turno a la tanda acumulada hasta este instante:
// la separa de `pendingWrites` (S1: cualquier llamada nueva que llegue
// mientras el disco está ocupado arma su propia tanda siguiente, sin perder
// claves), y encola la lectura+mezcla+escritura real detrás de cualquier
// volcado anterior todavía en curso.
function runFlush() {
  flushTimer = null
  const batch = pendingWrites
  pendingWrites = new Map()
  const resolve = resolveFlushPromise
  flushPromise = null
  resolveFlushPromise = null

  // El `.catch` final es el fix de F1 (judgment-report, iteración 2): sin él,
  // una única falla de `jsonStore.writeJson` (`fs.writeFileSync` sin
  // try/catch por diseño, D11/ADR-0006) deja `diskWriteQueue` como una
  // promesa rechazada, y todo `.then()` encadenado después nunca vuelve a
  // ejecutar su callback — la cola queda inutilizada por el resto del
  // proceso. Absorber el error acá restablece la cola a una promesa resuelta
  // para la próxima tanda, y de paso evita que `getIcon` (que hace
  // `await persistToDisk(...)`) rechace por un fallo de la caché en disco:
  // esa caché es una optimización, no un requisito de corrección del ícono,
  // que ya quedó servido desde memoria.
  diskWriteQueue = diskWriteQueue
    .then(() => {
      const diskCache = jsonStore.readJson(getCacheFilePath(), {})
      for (const [key, dataUrl] of batch) {
        diskCache[key] = dataUrl
      }
      jsonStore.writeJson(getCacheFilePath(), diskCache)
    })
    .catch(() => {})
    .then(() => resolve())
}

// persistToDisk(key, dataUrl) — agrega al `Map` de pendientes y devuelve la
// promesa del volcado agendado (para que `getIcon` pueda seguir haciendo
// `await persistToDisk(...)`), sin leer ni escribir nada de forma inmediata.
function persistToDisk(key, dataUrl) {
  pendingWrites.set(key, dataUrl)

  if (!flushPromise) {
    flushPromise = new Promise((resolve) => {
      resolveFlushPromise = resolve
    })
  }

  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(runFlush, DEBOUNCE_MS)

  return flushPromise
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
