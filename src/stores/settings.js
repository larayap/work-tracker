// Store Pinia de preferencias de volumen.
// Persiste vía IPC (get-settings/save-settings, registrados en ipc-handlers.js)
// y delega la aplicación real del volumen en plugins/sound.js — sin lógica de
// audio duplicada acá (D15).
import { defineStore } from 'pinia'
import { setMasterVolume, setInteractionVolume } from '@/plugins/sound'

const { ipcRenderer } = window.require('electron')

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    masterVolume: 1,
    interactionVolume: 1,
    timeFormat: '24h',
  }),
  actions: {
    async load() {
      const settings = await ipcRenderer.invoke('get-settings')
      if (settings) {
        this.masterVolume = settings.masterVolume
        this.interactionVolume = settings.interactionVolume
        // Sin fallback propio: el main ya entrega el default (`get-settings`
        // mergea `defaultSettings`); repetirlo acá crearía una segunda
        // fuente de verdad del default de producto.
        this.timeFormat = settings.timeFormat
      }
      setMasterVolume(this.masterVolume)
      setInteractionVolume(this.interactionVolume)
    },
    // Único punto de escritura a disco (defecto latente 2 del diseño): antes,
    // `setMaster`/`setInteraction` armaban su propio payload de dos claves —
    // agregar `timeFormat` al estado sin centralizar acá borraría la
    // preferencia del disco cada vez que se mueve el volumen.
    persist() {
      ipcRenderer.send('save-settings', {
        masterVolume: this.masterVolume,
        interactionVolume: this.interactionVolume,
        timeFormat: this.timeFormat,
      })
    },
    setMaster(v) {
      this.masterVolume = v
      setMasterVolume(v)
      this.persist()
    },
    setInteraction(v) {
      this.interactionVolume = v
      setInteractionVolume(v)
      this.persist()
    },
    setTimeFormat(v) {
      this.timeFormat = v
      this.persist()
    },
  },
})
