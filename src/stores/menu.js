// src/stores/appStore.js
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    manual: false,
    aplicacion: false,
    pomodoro: false,
  }),
  getters: {
    // devuelve [1,2,3] según cuáles estén en true
    selected(state) {
      const arr = []
      if (state.manual)     arr.push(1)
      if (state.aplicacion) arr.push(2)
      if (state.pomodoro)   arr.push(3)
      return arr
    }
  },
  actions: {
    toggleOption(val) {
      switch (val) {
        case 1: this.manual     = !this.manual;     break;
        case 2: this.aplicacion = !this.aplicacion; break;
        case 3: this.pomodoro   = !this.pomodoro;   break;
      }
    }
  }
})
