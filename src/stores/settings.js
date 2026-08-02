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
  }),
  actions: {
    async load() {
      const settings = await ipcRenderer.invoke('get-settings')
      if (settings) {
        this.masterVolume = settings.masterVolume
        this.interactionVolume = settings.interactionVolume
      }
      setMasterVolume(this.masterVolume)
      setInteractionVolume(this.interactionVolume)
    },
    setMaster(v) {
      this.masterVolume = v
      setMasterVolume(v)
      ipcRenderer.send('save-settings', {
        masterVolume: this.masterVolume,
        interactionVolume: this.interactionVolume,
      })
    },
    setInteraction(v) {
      this.interactionVolume = v
      setInteractionVolume(v)
      ipcRenderer.send('save-settings', {
        masterVolume: this.masterVolume,
        interactionVolume: this.interactionVolume,
      })
    },
  },
})
