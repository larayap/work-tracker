import { createApp } from 'vue'
import { createPinia }   from 'pinia'
import App from './App.vue'
import SoundPlugin from '@/plugins/sound'
import { useSettingsStore } from '@/stores/settings'

const app = createApp(App)
app.use(createPinia())
app.use(SoundPlugin)

// Carga el volumen persistido antes del primer render, para que rija desde
// el primer sonido (Tarea 7).
useSettingsStore().load()

app.mount('#app')
