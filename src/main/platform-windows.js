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
// Aplicaciones instaladas: fuente son los accesos directos .lnk del Menú
// Inicio (D8/ADR-0003); el registro solo enriquece y marca descartes. Un
// único proceso PowerShell hace las dos cosas.
//
// Nota de verificación: esta consulta PowerShell no se pudo ejecutar ni
// sintaxear en este entorno (WSL2/Linux no tiene `powershell.exe`). La
// correlación acceso-directo↔registro es best-effort (por `DisplayName`
// exacto o por `InstallLocation` como prefijo del target) — si no hay match,
// la entrada sigue adelante con los campos de registro en null/undefined y
// queda sujeta solo a los descartes por ruta/nombre de `installed-apps-filter.js`.
// Pendiente de verificación en Windows (Tarea 25 del tasks.md).
// ---------------------------------------------------------------------------

function buildInstalledAppsScript() {
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    '$shell = New-Object -ComObject WScript.Shell',
    "$uninstallKeys = Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' | Where-Object { $_.DisplayName }",
    "$roots = @((Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs'), (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'))",
    '$shortcuts = foreach ($root in $roots) { if (Test-Path $root) { Get-ChildItem -Path $root -Filter \'*.lnk\' -Recurse -ErrorAction SilentlyContinue } }',
    '$result = foreach ($lnk in $shortcuts) { ' +
      '$sc = $shell.CreateShortcut($lnk.FullName); ' +
      '$targetPath = $sc.TargetPath; ' +
      '$baseName = [System.IO.Path]::GetFileNameWithoutExtension($lnk.Name); ' +
      '$match = $uninstallKeys | Where-Object { $_.DisplayName -eq $baseName -or ($_.InstallLocation -and $targetPath -and $targetPath.ToLower().StartsWith($_.InstallLocation.ToLower())) } | Select-Object -First 1; ' +
      '[PSCustomObject]@{ ' +
        'shortcutName = $baseName; ' +
        'shortcutFolder = Split-Path $lnk.DirectoryName -Leaf; ' +
        'targetPath = $targetPath; ' +
        'targetExists = if ($targetPath) { Test-Path $targetPath } else { $false }; ' +
        'publisher = if ($match) { $match.Publisher } else { $null }; ' +
        'systemComponent = if ($match) { $match.SystemComponent } else { $null }; ' +
        'parentKeyName = if ($match) { $match.ParentKeyName } else { $null }; ' +
        'releaseType = if ($match) { $match.ReleaseType } else { $null } ' +
      '} ' +
    '}',
    '$result | ConvertTo-Json -Depth 3',
  ].join('; ')
}

// listInstalledCandidates() → Promise<RawInstalledEntry[]> — sin filtrar.
function listInstalledCandidates() {
  return new Promise((resolve, reject) => {
    const cmd = `powershell -NoProfile -Command "${buildInstalledAppsScript()}"`
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
      if (error) return reject(error)
      try {
        const result = JSON.parse(stdout.trim() || '[]')
        resolve(Array.isArray(result) ? result : [result])
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
  listInstalledCandidates,
  getExecutableIcon,
}
