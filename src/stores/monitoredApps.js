// Store Pinia de las apps monitoreadas. Espejo, no modelo (D17): su estado se
// reemplaza entero al recibir el snapshot del main; las actions solo envían
// intenciones por IPC. La única excepción es `icons`, un mapa local que el
// store llena bajo demanda.
import { defineStore } from 'pinia'

const { ipcRenderer } = window.require('electron')

export const useMonitoredAppsStore = defineStore('monitoredApps', {
  state: () => ({
    rows: [],
    selection: [],
    limitReached: false,
    icons: {},
  }),
  actions: {
    // applySnapshot(payload) — única mutación de reemplazo del estado del
    // motor (D2/D17). No deriva ni conserva estado propio sobre el monitoreo.
    applySnapshot(payload) {
      this.rows = payload.rows
      this.selection = payload.selection
      this.limitReached = payload.limitReached
    },
    // `imageName` viaja además de `name` (fix C2, judgment-fixes-iteration-1):
    // es el nombre de imagen real que necesita el `appId` degradado (D4),
    // distinto del nombre legible `name` que se muestra en la fila. `type`
    // ('manual' | 'auto', Tarea 9) viaja también hasta `add-to-selection`, que
    // ya reenvía el objeto `entry` completo sin desestructurar.
    async addApp({ appId, name, exePath, imageName, type }) {
      const snapshot = await ipcRenderer.invoke('add-to-selection', { appId, name, exePath, imageName, type })
      this.applySnapshot(snapshot)
    },
    async removeApp(appId) {
      const snapshot = await ipcRenderer.invoke('remove-from-selection', appId)
      this.applySnapshot(snapshot)
    },
    stopRow(appId) {
      // Sin respuesta directa: el snapshot siguiente llega por el listener
      // suscripto más abajo.
      ipcRenderer.send('stop-monitored-row', appId)
    },
    // ensureIcon(exePath) — pide el ícono si falta y lo cachea en `icons`
    // (canal `get-app-icon`, Tarea 22).
    //
    // Guard de reentrada por `hasOwnProperty`, no por verdad/falsedad del
    // valor: un ícono legítimamente resuelto en `null` (extracción y
    // respaldo fallidos) es una clave ya asignada, no "pendiente". Con
    // `this.icons[exePath]` a secas, `null` es falsy y el guard nunca se
    // activaba — el `watch` de `rows` (que se reemplaza por referencia en
    // cada tick, D2/D17) repetía el IPC indefinidamente para esa fila.
    async ensureIcon(exePath) {
      if (!exePath || Object.prototype.hasOwnProperty.call(this.icons, exePath)) return
      const { dataUrl } = await ipcRenderer.invoke('get-app-icon', exePath)
      this.icons[exePath] = dataUrl
    },
    // ensureIcons(exePaths) — pide los íconos de todo el listado con
    // concurrencia acotada a `CONCURRENCY` en vuelo (D-15, Tarea 5), en vez de
    // disparar un `invoke` por cada una de las ~82 entradas del selector a la
    // vez: el main process que extrae los íconos es el mismo que sostiene el
    // tick de 1000ms del motor. Reutiliza `ensureIcon`, cuyo guard por
    // `hasOwnProperty` ya cubre la reentrada (no repite la extracción de un
    // ícono ya resuelto, aunque sea `null`).
    async ensureIcons(exePaths) {
      const CONCURRENCY = 6
      let cursor = 0
      const worker = async () => {
        while (cursor < exePaths.length) {
          const exePath = exePaths[cursor]
          cursor += 1
          await this.ensureIcon(exePath)
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, exePaths.length) }, () => worker())
      )
    },
    init() {
      ipcRenderer.invoke('get-monitored-snapshot').then((snapshot) => this.applySnapshot(snapshot))
      ipcRenderer.on('monitored-apps-state', (event, snapshot) => this.applySnapshot(snapshot))
    },
  },
})
