// Función pura de filtrado del selector de instaladas (D8/ADR-0003). Sin
// dependencia de Electron ni del sistema operativo: se verifica con entradas
// fabricadas. Sesgo deliberado hacia el falso negativo — ante ambigüedad, se
// descarta la entrada.
'use strict'

const SYSTEM_PATH_PATTERNS = [/\\windows\\/i, /\\system32\\/i, /\\winsxs\\/i]

const SYSTEM_FOLDER_PATTERNS = [
  /accessories/i,
  /administrative tools/i,
  /windows tools/i,
  /windows powershell/i,
  /startup/i,
]

const EXE_NAME_DISCARD_PATTERNS = [
  /update/i,
  /setup/i,
  /install/i,
  /^unins/i,
  /crashpad/i,
  /helper/i,
  /service/i,
]

const RELEASE_TYPE_DISCARD_PATTERNS = [/update/i, /hotfix/i]

const KB_SHORTCUT_PATTERN = /kb\d{6,}/i

function isSystemComponent(value) {
  return value === true || value === '1' || value === 1
}

function matchesAny(patterns, value) {
  return patterns.some((pattern) => pattern.test(value))
}

function exeNameOf(targetPath) {
  return targetPath.split(/[\\/]/).pop() || ''
}

function shouldDiscard(entry) {
  if (entry.targetExists === false) return true
  if (!entry.targetPath) return true
  if (matchesAny(SYSTEM_PATH_PATTERNS, entry.targetPath)) return true
  if (entry.shortcutFolder && matchesAny(SYSTEM_FOLDER_PATTERNS, entry.shortcutFolder)) return true
  if (matchesAny(EXE_NAME_DISCARD_PATTERNS, exeNameOf(entry.targetPath))) return true
  if (isSystemComponent(entry.systemComponent)) return true
  if (entry.parentKeyName) return true
  if (entry.releaseType && matchesAny(RELEASE_TYPE_DISCARD_PATTERNS, entry.releaseType)) return true
  if (KB_SHORTCUT_PATTERN.test(entry.shortcutName || '')) return true
  return false
}

// filterInstalledApps(rawEntries) → InstalledApp[]
function filterInstalledApps(rawEntries) {
  return rawEntries
    .filter((entry) => !shouldDiscard(entry))
    .map((entry) => ({
      appId: entry.targetPath.toLowerCase(),
      name: entry.shortcutName,
      exePath: entry.targetPath,
      publisher: entry.publisher || null,
    }))
}

module.exports = { filterInstalledApps }
