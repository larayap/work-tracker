// Registro único de todos los canales IPC del motor de monitoreo y de
// Opciones. `background.js` invoca `registerIpcHandlers(mainWindow)` una sola
// vez (Tarea 16). Los canales de íconos (Tarea 22) y de instaladas (Tarea 27)
// se suman acá en bloques posteriores del mismo cambio.
'use strict'

const path = require('path')
const { app, ipcMain } = require('electron')
const monitorEngine = require('./monitor-engine.js')
const jsonStore = require('./json-store.js')

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
