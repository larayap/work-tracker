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
    async addApp({ appId, name, exePath }) {
      const snapshot = await ipcRenderer.invoke('add-to-selection', { appId, name, exePath })
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
    async ensureIcon(exePath) {
      if (!exePath || this.icons[exePath]) return
      const { dataUrl } = await ipcRenderer.invoke('get-app-icon', exePath)
      this.icons[exePath] = dataUrl
    },
    init() {
      ipcRenderer.invoke('get-monitored-snapshot').then((snapshot) => this.applySnapshot(snapshot))
      ipcRenderer.on('monitored-apps-state', (event, snapshot) => this.applySnapshot(snapshot))
    },
  },
})
