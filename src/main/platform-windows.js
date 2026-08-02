// Único módulo dependiente del sistema operativo (D10/ADR-0004). Ningún otro
// archivo del proyecto ejecuta PowerShell, invoca binarios del sistema ni lee
// el registro. La interfaz se define por capacidades: cada función describe
// qué información entrega, no cómo la obtiene.
'use strict'

const { exec } = require('child_process')
const { app } = require('electron')
const activeWin = require('active-win')

// ---------------------------------------------------------------------------
// Foco: ¿qué programa es dueño de la ventana en primer plano ahora?
// ---------------------------------------------------------------------------

// getForegroundWindow() → Promise<{ exePath, name, pid } | null>
//
// Riesgo de diseño (ADR-0001/tech-context.md): `winInfo.owner.processId` figura
// en la documentación pública de `active-win` pero NO está confirmado por uso
// en este repositorio — `src/background.js` (código previo a este cambio) solo
// usa `owner.name` y `owner.path`. El diseño (D4) ya trata la ruta del
// ejecutable como clave primaria de correlación y el PID como refuerzo, nunca
// como dato obligatorio: si `processId` (o `pid`) viene `undefined`, `pid`
// queda en `null` y el resto del motor sigue funcionando correlacionando por
// `exePath`. Verificación pendiente en Windows (no ejecutable desde WSL2):
// confirmar con la app corriendo si el campo llega poblado al cambiar de foco.
async function getForegroundWindow() {
  const winInfo = await activeWin()
  if (!winInfo || !winInfo.owner) return null
  return {
    exePath: winInfo.owner.path || null,
    name: winInfo.owner.name || null,
    pid: winInfo.owner.processId || winInfo.owner.pid || null,
  }
}

// ---------------------------------------------------------------------------
// Liveness: ¿ese PID sigue correspondiendo a un proceso vivo? Sin spawn.
// ---------------------------------------------------------------------------

// isProcessAlive(pid) → Boolean
function isProcessAlive(pid) {
  if (pid === null || pid === undefined) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return err.code !== 'ESRCH'
  }
}

// ---------------------------------------------------------------------------
// Procesos en ejecución: pares de nombre de imagen y PID, sin spawn de
// PowerShell — `tasklist` es un ejecutable del sistema, más barato.
// ---------------------------------------------------------------------------

function parseTasklistCsv(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const fields = line.match(/"([^"]*)"/g)
      if (!fields || fields.length < 2) return null
      return {
        imageName: fields[0].replace(/"/g, ''),
        pid: parseInt(fields[1].replace(/"/g, ''), 10),
      }
    })
    .filter(Boolean)
}

// listRunningProcesses() → Promise<[{ imageName, pid }]>
function listRunningProcesses() {
  return new Promise((resolve, reject) => {
    exec('tasklist /FO CSV /NH', (error, stdout) => {
      if (error) return reject(error)
      resolve(parseTasklistCsv(stdout))
    })
  })
}

// ---------------------------------------------------------------------------
// Ventanas abiertas: mismo mecanismo que ya usaba `get-open-windows`, extendido
// con `exePath`/`pid` sin cambiar el significado de `appName`.
// ---------------------------------------------------------------------------

// listOpenWindows() → Promise<[{ appName, exePath, pid }]>
function listOpenWindows() {
  return new Promise((resolve, reject) => {
    const cmd = `powershell -Command "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object @{Name='appName'; Expression={ if ($_.Description) { $_.Description } else { $_.Name } }}, @{Name='exePath'; Expression={ $_.Path }}, @{Name='pid'; Expression={ $_.Id }} | ConvertTo-Json"`
    exec(cmd, (error, stdout) => {
      if (error) return reject(error)
      try {
        const result = JSON.parse(stdout.trim())
        const windows = Array.isArray(result) ? result : [result]
        resolve(windows)
      } catch (parseError) {
        reject(parseError)
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Ícono de un ejecutable (D9/ADR-0005). Funciona con el programa cerrado: la
// extracción es por ruta de archivo, no depende de un proceso vivo.
// ---------------------------------------------------------------------------

// getExecutableIcon(exePath) → Promise<String|null> — data URL, o null si la
// extracción falla o la imagen resulta vacía (el llamador decide el respaldo).
async function getExecutableIcon(exePath) {
  try {
    const icon = await app.getFileIcon(exePath, { size: 'normal' })
    if (!icon || icon.isEmpty()) return null
    return icon.toDataURL()
  } catch (err) {
    return null
  }
}

module.exports = {
  getForegroundWindow,
  isProcessAlive,
  listRunningProcesses,
  listOpenWindows,
  getExecutableIcon,
}
