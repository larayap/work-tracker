import { createApp } from 'vue'
import App from './App.vue'
import { useDragAndDrop } from 'fluid-dnd/vue'

const app = createApp(App)
app.provide('useDragAndDrop', useDragAndDrop)
app.mount('#app')
