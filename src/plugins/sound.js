// src/plugins/sound.js
import { Howl } from 'howler'

// inicializa todos tus sonidos
const sounds = {
  endSession: new Howl({ src: [require('@/sounds/endSesion.mp3')], preload: true }),
  deleteItem: new Howl({ src: [require('@/sounds/deleteItem.mp3')], preload: true }),
  popUp:       new Howl({ src: [require('@/sounds/popUp.mp3')],       preload: true }),
  pressButton: new Howl({ src: [require('@/sounds/pressButton.mp3')], preload: true }),
  add:         new Howl({ src: [require('@/sounds/add.mp3')],         preload: true }),
}

export default {
  install(app) {
    // registra un método global $playSound
    app.config.globalProperties.$playSound = (key) => {
      const s = sounds[key]
      if (s) s.play()
      else    console.warn(`[Sound] no existe sonido para "${key}"`)
    }
  }
}
