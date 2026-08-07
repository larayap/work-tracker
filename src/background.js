'use strict'

import { app, protocol, BrowserWindow, Menu, Tray, globalShortcut, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'

const activeWin = require('active-win')
const path = require('path')
const isDevelopment = process.env.NODE_ENV !== 'production'
const fs = require('fs')
const platformWindows = require('./main/platform-windows.js')
const monitorEngine = require('./main/monitor-engine.js')
const sessionLog = require('./main/session-log.js')
const { registerIpcHandlers } = require('./main/ipc-handlers.js')

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

let mainWindow = null
let tray = null
let alwaysOnTopInterval = null // Intervalo para alwaysOnTop



function createTray() {
  // Ruta del ícono para la bandeja

  const iconPath = path.join(__static, 'img', 'icon-work.png')
  tray = new Tray(iconPath)

  // Tooltip que aparece al pasar el ratón sobre el ícono
  tray.setToolTip('Work Tracker')

  // Menú contextual al hacer clic derecho en el ícono
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar ventana',
      click: () => {
        showMainWindow()
      }
    },
    {
      label: 'Salir',
      click: () => {
        app.isQuiting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)

  // (Opcional) Al hacer clic izquierdo en el ícono, muestra la ventana
  tray.on('click', () => {
    showMainWindow()
  })
}

async function createWindow() {
  // Create the browser window.
  mainWindow  = new BrowserWindow({
    width: 500,
    height: 330,
    title: 'Work Tracker',
    icon: path.join(__static, 'img', 'icon-work.png'),
    backgroundColor: '#0f0f0f', // Cambia este valor por el color que desees
    frame: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    trafficLightPosition: {
      x: 15,
      y: 13,  // macOS traffic lights seem to be 14px in diameter. If you want them vertically centered, set this to `titlebar_height / 2 - 7`.
  },
  })
  Menu.setApplicationMenu(null);

  // Registra el contrato IPC del motor de monitoreo y de Opciones (Tarea 15),
  // migra el historial legado (ADR-0007) y carga la selección guardada antes
  // de que el renderer pida el primer snapshot (D2/ADR-0002). El orden entre
  // la migración y `loadSelection()` es la invariante de ADR-0007: si el
  // motor pudiera abrir sesiones antes de que la migración corra, crearía
  // `sessions.json` prematuramente y la migración se saltearía, perdiendo el
  // historial legado.
  registerIpcHandlers(mainWindow)
  sessionLog.migrateLegacyLog()
  await monitorEngine.loadSelection()

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await mainWindow .loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST && process.argv.includes('--open-devtools')) {
      mainWindow .webContents.openDevTools()
    }
  } else {
    createProtocol('app')
    mainWindow .loadURL('app://./index.html')
  }
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

// Muestra la ventana si está creada, o la crea si aún no existe
function showMainWindow() {
  if (!mainWindow) {
    createWindow()
  }
  mainWindow.show()
  mainWindow.focus()
}

// Único camino de arranque (fix C1, judgment-fixes-iteration-1). Antes había
// dos listeners de 'ready' —este `whenReady().then()` y un `app.on('ready')`
// que vivía después de todos los handlers de IPC, ambos duplicados ya en la
// base previa al cambio y ahora eliminado— que llamaban createWindow() cada
// uno. La duplicación era inofensiva hasta que este cambio movió
// registerIpcHandlers(mainWindow) adentro de createWindow():
// ipcMain.handle() lanza al registrar un canal ya registrado, así que la
// segunda invocación reasignaba `mainWindow` (línea de BrowserWindow más
// abajo) y lanzaba antes de loadURL() y de mainWindow.on('close'), dejando la
// ventana con la interfaz cargada huérfana y sin handler de cierre.
// Se consolida en un único listener en vez de agregar un guard de
// idempotencia en registerIpcHandlers: ese guard solo enmascararía el
// síntoma (seguiría creándose una ventana de más en cada arranque), mientras
// que la causa raíz es el doble createWindow().
app.whenReady().then(async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools()
    }
  })
  createTray()
  createWindow()
})

// Delegado en platform-windows.js (Tarea 9): el handler conserva el nombre de
// canal y el campo `appName` que TitleBar.vue ya consume, extendido con
// `exePath`/`pid` para el selector nuevo (Tarea 28).
ipcMain.handle('get-open-windows', () => platformWindows.listOpenWindows())

ipcMain.on('start-monitoring-active-window', async (event, appName) => {
  if (alwaysOnTopInterval) return; // Evitar intervalos duplicados
  alwaysOnTopInterval = setInterval(async () => {
    const winInfo = await activeWin();
    if (winInfo && winInfo.owner && winInfo.owner.name === appName) {
      mainWindow.setAlwaysOnTop(true);
    } else {
      mainWindow.setAlwaysOnTop(false);
    }
  }, 100); // Ajusta el intervalo si lo requieres
  console.log(`Monitoreo de "${appName}" iniciado.`);
});

// Escuchar el mensaje para detener el monitoreo
ipcMain.on('stop-monitoring-active-window', () => {
  if (alwaysOnTopInterval) {
    clearInterval(alwaysOnTopInterval);
    alwaysOnTopInterval = null;
    mainWindow.setAlwaysOnTop(false);
    console.log("Monitoreo detenido.");
  }
});

// Escuchar mensaje para activar/desactivar alwaysOnTop sin monitoreo
ipcMain.on('set-always-on-top', (event, value) => {
  mainWindow.setAlwaysOnTop(value);
});

ipcMain.on('open-history-window', () => {
  const historyWindow = new BrowserWindow({
    width: 300,
    height: 600,
    title: 'Historial',
    frame: false,
    backgroundColor: '#1b1b1b',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    }
  })

  historyWindow.once('ready-to-show', () => historyWindow.show())

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    historyWindow.loadURL(`${process.env.WEBPACK_DEV_SERVER_URL}history.html`)
    // historyWindow.webContents.openDevTools()
  } else {
    createProtocol('app')  // ya lo deberías tener en tu createWindow()
    historyWindow.loadURL('app://./history.html')
  }
})

const sessionsFile = path.join(app.getPath('userData'), 'pomodoro-sessions.json')

// handler para leer
ipcMain.handle('load-sessions', async () => {
  try {
    const raw = await fs.promises.readFile(sessionsFile, 'utf8')

    // 1) parseamos la primera vez
    let parsed = JSON.parse(raw)

    // 2) si resulta ser todavía una cadena, parseamos otra vez
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed)
    }

    return parsed
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Error leyendo sesiones:', err)
    return null
  }
})

// listener para guardar
ipcMain.on('save-sessions', (event, plainArray) => {
  fs.writeFile(
    sessionsFile,
    JSON.stringify(plainArray, null, 2),
    'utf8',
    err => {
      if (err) console.error('Error saving sessions:', err)
    }
  )
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cierre sincrónico de sesiones abiertas al salir (D-4/ADR-0009): cubre las
// dos rutas de salida existentes, que convergen en `app.quit()` (el menú de
// la bandeja pone `app.isQuiting = true` y llama `app.quit()`;
// `window-all-closed` también llama `app.quit()` más abajo). Documentado
// como riesgo residual aceptado: Electron puede no emitir `before-quit` en
// Windows durante apagado, reinicio o cierre de sesión del sistema.
app.on('before-quit', () => {
  monitorEngine.closeAllRows('app-quit')
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})


// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}
