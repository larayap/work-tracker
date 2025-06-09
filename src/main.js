import { createApp } from 'vue'
import { createPinia }   from 'pinia'
import App from './App.vue'
import SoundPlugin from '@/plugins/sound'

const app = createApp(App)
app.use(createPinia())
app.use(SoundPlugin)
app.mount('#app')
