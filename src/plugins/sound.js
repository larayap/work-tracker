// src/plugins/sound.js
import { Howl, Howler } from 'howler'

// inicializa todos tus sonidos
const sounds = {
  endSession: new Howl({ src: [require('@/sounds/endSesion.mp3')], preload: true }),
  deleteItem: new Howl({ src: [require('@/sounds/deleteItem.mp3')], preload: true }),
  popUp:       new Howl({ src: [require('@/sounds/popUp.mp3')],       preload: true }),
  pressButton: new Howl({ src: [require('@/sounds/pressButton.mp3')], preload: true }),
  add:         new Howl({ src: [require('@/sounds/add.mp3')],         preload: true }),
}

// Sonidos de interacción: los cuatro decorativos, sin la alarma de fin de
// sesión (D15). `endSession` queda regido solo por Howler.volume().
const interactionSoundKeys = ['add', 'popUp', 'pressButton', 'deleteItem']

// Volumen maestro: relativo al volumen propio de cada sonido (howler ya lo
// aplica de forma multiplicativa), afecta a los cinco sonidos incluida la alarma.
export function setMasterVolume(v) {
  Howler.volume(v)
}

// Volumen de interacción: solo sobre los cuatro sonidos decorativos.
export function setInteractionVolume(v) {
  interactionSoundKeys.forEach((key) => sounds[key].volume(v))
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
