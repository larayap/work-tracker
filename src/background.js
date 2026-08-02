'use strict'

import { app, protocol, BrowserWindow, Menu, Tray, globalShortcut, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'

const activeWin = require('active-win')
const path = require('path')
const isDevelopment = process.env.NODE_ENV !== 'production'
const { exec } = require('child_process');
const fs = require('fs')

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

let mainWindow = null
let tray = null
let cronometroInterval = null // Intervalo para el cronómetro
let alwaysOnTopInterval = null // Intervalo para alwaysOnTop



function createTray() {
  // Ruta del ícono para la bandeja

  const iconPath = path.join(__static, 'img', 'icon-work.png')
  tray = new Tray(iconPath)

  // Tooltip que aparece al pasar el ratón sobre el ícono
  tray.setToolTip('Workout')

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
    title: 'Workout',
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

app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools()
    }
  })
  createTray()
  createWindow()
})

ipcMain.handle('get-open-windows', () => {
  return new Promise((resolve, reject) => {
    // Ejecuta un comando PowerShell para obtener procesos con ventana principal no vacía
    const cmd = `powershell -Command " Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object @{Name='appName'; Expression={ if ($_.Description) { $_.Description } else { $_.Name }}} | ConvertTo-Json "`;
    // eslint-disable-next-line no-unused-vars
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(error)
      }
      try {
        const result = JSON.parse(stdout.trim())
        // Si solo se devuelve un objeto (cuando hay un solo proceso), lo convertimos a array
        const windows = Array.isArray(result) ? result : [result]
        resolve(windows);
      } catch (parseError) {
        reject(parseError)
      }
    })
  })
})

let currentAppName = null

ipcMain.on('start-cronometro-monitoring', async (event, appName) => {
  if (cronometroInterval) {
    // Si la app seleccionada es la misma, no hagas nada
    if (appName === currentAppName) {
      console.log(`El monitoreo de "${appName}" ya está activo.`)
      return
    }
    // Si se selecciona una nueva app, detener el monitoreo anterior
    clearInterval(cronometroInterval)
    cronometroInterval = null
    console.log(`Cambiando monitoreo a nueva aplicación: ${appName}`)
  }

  // Actualizar la app seleccionada
  currentAppName = appName

  // Obtener la información de la ventana activa
  const winInfo = await activeWin()
  if (winInfo && winInfo.owner && winInfo.owner.name === appName) {
    const exePath = winInfo.owner.path
    console.log(`Proceso seleccionado: ${exePath}`)

    // Enviar el icono solo una vez al iniciar
    mainWindow.webContents.send('app-active', {
      isActive: true,
    })
  }

  // Iniciar el intervalo para monitorear la ventana activa
  cronometroInterval = setInterval(async () => {
    const winInfo = await activeWin()
    if (winInfo && winInfo.owner && winInfo.owner.name === appName) {
      // Si la app está activa, enviar solo el estado, sin cambiar el icono
      mainWindow.webContents.send('app-active', {
        isActive: true,
      })
    } else {
      // Si pierde el foco, pausar cronómetro
      mainWindow.webContents.send('app-active', {
        isActive: false,
      })
    }
  }, 1000) // Verificación cada 1 segundo
  console.log(`Monitoreo de "${appName}" para el cronómetro iniciado.`)
})

ipcMain.on('stop-cronometro-monitoring', () => {
  if (cronometroInterval) {
    clearInterval(cronometroInterval)
    cronometroInterval = null
    mainWindow.webContents.send('app-active', false)
    console.log('Monitoreo para el cronómetro detenido.')
  }
})

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

const logFilePath = path.join(app.getPath('userData'), 'usage-log.txt')

ipcMain.on('save-log-line', (event, line) => {
  fs.appendFile(logFilePath, line + '\n', (err) => {
    if (err) {
      console.error('Error al escribir el log:', err)
      return
    }
    console.log('Línea de log guardada en:', logFilePath)
  })
})


ipcMain.handle('get-app-logs', async () => {
  console.log(`Leyendo el archivo de log: ${logFilePath}`)
  if (!fs.existsSync(logFilePath)) return []

  const lines = fs.readFileSync(logFilePath, 'utf-8').split('\n').filter(Boolean)

  return lines.map(line => {
    const match = line.match(/\[(.*?)\] Aplicación: (.*?) \| Duración: (.*?) \| Inicio: (.*?) \| Fin: (.*)/)
    if (!match) return null

    // eslint-disable-next-line no-unused-vars
    const [_, datetime, app, duration, startTime, endTime] = match
    const [date] = datetime.split(' ')
    return { date, app, duration, startTime, endTime }
  }).filter(Boolean)
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

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})


app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  createWindow()
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
