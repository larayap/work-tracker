// Registro único de todos los canales IPC del motor de monitoreo, íconos,
// instaladas y Opciones. `background.js` invoca `registerIpcHandlers(mainWindow)`
// una sola vez (Tarea 16).
'use strict'

const path = require('path')
const { app, ipcMain } = require('electron')
const monitorEngine = require('./monitor-engine.js')
const jsonStore = require('./json-store.js')
const iconCache = require('./icon-cache.js')
const installedApps = require('./installed-apps.js')

function getSettingsFilePath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

const defaultSettings = { masterVolume: 1, interactionVolume: 1 }

function registerIpcHandlers(mainWindow) {
  ipcMain.handle('get-monitored-snapshot', () => monitorEngine.getSnapshot())

  ipcMain.handle('add-to-selection', (event, entry) => {
    monitorEngine.addToSelection(entry)
    return monitorEngine.getSnapshot()
  })

  ipcMain.handle('remove-from-selection', (event, appId) => {
    monitorEngine.removeFromSelection(appId)
    return monitorEngine.getSnapshot()
  })

  ipcMain.on('stop-monitored-row', (event, appId) => {
    monitorEngine.closeRow(appId, 'user-stop')
  })

  ipcMain.handle('get-app-icon', (event, exePath) =>
    iconCache.getIcon(exePath).then((dataUrl) => ({ exePath, dataUrl }))
  )

  // installed-apps.js empuja 'installed-apps-updated' directamente sobre
  // `mainWindow.webContents` (Tarea 26); acá solo se le pasa la referencia,
  // mismo patrón que el motor de monitoreo con `onUpdate`.
  installedApps.setMainWindow(mainWindow)
  ipcMain.handle('get-installed-apps', () => installedApps.getInstalledApps())

  ipcMain.handle('get-settings', () => jsonStore.readJson(getSettingsFilePath(), defaultSettings))

  ipcMain.on('save-settings', (event, settings) => {
    jsonStore.writeJson(getSettingsFilePath(), settings)
  })

  // Empuja el snapshot completo cada tick y tras cada intención del usuario
  // (D2/ADR-0002). El motor no conoce IPC ni `mainWindow`: solo expone
  // `onUpdate`.
  monitorEngine.onUpdate(() => {
    mainWindow.webContents.send('monitored-apps-state', monitorEngine.getSnapshot())
  })
}

module.exports = { registerIpcHandlers }
