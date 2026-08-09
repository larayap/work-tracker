import '@/styles/tokens.css'
import { createApp } from 'vue'
import HistoryView from './HistoryView.vue'
import VCalendar from 'v-calendar'
import 'v-calendar/style.css'

const app = createApp(HistoryView)
app.use(VCalendar)  // <-- MUY IMPORTANTE
app.mount('#app')
