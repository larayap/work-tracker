// Traspaso único de userData de la identidad anterior del producto
// (`cronometro-apps`) a la identidad nueva (`work-tracker`) — D-1 a D-6 /
// ADR-0013. Mismo desdoblamiento que `session-log-parser.js` respecto de
// `session-log.js`: este módulo solo usa `fs`/`path` del núcleo de Node,
// nunca `electron`, y recibe las rutas reales por parámetro en vez de
// resolverlas con `app.getPath()`. Eso lo vuelve ejercitable con `node -e`
// sobre directorios temporales, que es la única verificación determinista
// disponible en un entorno (WSL2) donde no se puede compilar ni ejecutar la
// aplicación.
//
// La condición de traspaso es por archivo, no por directorio: Electron crea
// y puebla el `userData` nuevo con estado propio de Chromium (`Cache/`,
// `Preferences`, `Local Storage/`) antes de `whenReady`, así que el
// directorio destino siempre existe cuando la aplicación toma el control.
// Cada uno de los ocho archivos que la aplicación posee se copia solo si no
// existe ya en el destino — si ambas identidades tienen datos, el destino
// gana, archivo por archivo, sin fusión ni sobreescritura. El origen nunca
// se modifica: solo `existsSync` y `copyFileSync` en modo lectura.
'use strict'

const fs = require('fs')
const path = require('path')

// Nombre del directorio de la identidad anterior bajo %APPDATA% (Windows) /
// el equivalente de `app.getPath('appData')` en otros sistemas operativos.
const LEGACY_USERDATA_DIRNAME = 'cronometro-apps'

// Los ocho archivos que la aplicación posee bajo `userData`, verificados uno
// a uno contra el código que los lee y los escribe (D-2/ADR-0013). Lista
// cerrada: un archivo nuevo que se agregue en el futuro debe sumarse acá.
const OWNED_FILES = [
  'sessions.json',
  'usage-log.txt',
  'usage-log.txt.bak',
  'settings.json',
  'monitored-selection.json',
  'installed-apps-cache.json',
  'app-icons-cache.json',
  'pomodoro-sessions.json',
]

// migrateFileAt(sourceDir, targetDir, fileName) → 'copied' | 'skipped' —
// nunca lanza: un fallo se captura en `migrateUserDataAt` y va a `failed`.
// Copia atómica: `copyFileSync` a un temporal `.migrating` seguido de
// `renameSync` sobre el destino final, el mismo patrón que
// `json-store.js::writeJsonAtomic`. El destino solo aparece completo; un
// `.migrating` sobreviviente a una interrupción se sobrescribe y se
// renombra en el arranque siguiente, así que el estado se autolimpia sin
// código de limpieza dedicado.
function migrateFileAt(sourceDir, targetDir, fileName) {
  const sourcePath = path.join(sourceDir, fileName)
  const targetPath = path.join(targetDir, fileName)

  if (!fs.existsSync(sourcePath)) {
    return 'skipped'
  }
  if (fs.existsSync(targetPath)) {
    return 'skipped'
  }

  const tmpPath = targetPath + '.migrating'
  fs.copyFileSync(sourcePath, tmpPath)
  fs.renameSync(tmpPath, targetPath)
  return 'copied'
}

// migrateUserDataAt({ sourceDir, targetDir }) → { copied, skipped, failed }
// (arrays de nombres de archivo). Si `sourceDir` no existe, es una
// instalación limpia: retorna de inmediato con las tres listas vacías, sin
// crear ni tocar nada. La función nunca lanza: un archivo que falla queda en
// `failed` con el detalle del error y no bloquea a los otros siete: el
// arranque siguiente lo reintenta solo, porque el destino sigue ausente.
function migrateUserDataAt(options) {
  const sourceDir = options.sourceDir
  const targetDir = options.targetDir
  const copied = []
  const skipped = []
  const failed = []

  try {
    if (!fs.existsSync(sourceDir)) {
      return { copied: copied, skipped: skipped, failed: failed }
    }

    fs.mkdirSync(targetDir, { recursive: true })

    OWNED_FILES.forEach((fileName) => {
      try {
        const outcome = migrateFileAt(sourceDir, targetDir, fileName)
        if (outcome === 'copied') {
          copied.push(fileName)
        } else {
          skipped.push(fileName)
        }
      } catch (err) {
        failed.push({ file: fileName, error: err.message })
      }
    })
  } catch (err) {
    failed.push({ file: null, error: err.message })
  }

  return { copied: copied, skipped: skipped, failed: failed }
}

module.exports = {
  LEGACY_USERDATA_DIRNAME: LEGACY_USERDATA_DIRNAME,
  OWNED_FILES: OWNED_FILES,
  migrateUserDataAt: migrateUserDataAt,
}
