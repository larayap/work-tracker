<!-- eslint-disable vue/no-multiple-template-root -->
<template>
  <TitleBar />
  <div class="history-view">
    <h2 style="color: white;">Days of Work</h2>

    <v-calendar
      is-expanded
      :attributes="calendarAttributes"
      :max-date="new Date()"
      class="dark-calendar"
      @dayclick="handleDateClick"
    />

    <UsageChart :entries="chartEntries" :label="chartLabel" />

    <div class="view-tabs">
      <button :class="{ active: activeView === 'byApp' }" @click="activeView = 'byApp'">
        Por app
      </button>
      <button :class="{ active: activeView === 'bySession' }" @click="activeView = 'bySession'">
        Por sesión
      </button>
    </div>

    <ByAppView v-if="activeView === 'byApp'" :entries="dayEntries" />
    <BySessionView v-else :entries="dayEntries" />
  </div>
</template>

<script>
import TitleBar from './TitleBar.vue'
import UsageChart from './UsageChart.vue'
import ByAppView from './ByAppView.vue'
import BySessionView from './BySessionView.vue'
import { formatDateYYYYMMDD } from '@/utils/time-format.js'

const { ipcRenderer } = window.require('electron')

// Shell de la ventana de historial (D-10): sostiene todo el estado
// compartido (día seleccionado, alcance del gráfico, pestaña activa) y es el
// único punto de IPC. `ByAppView`/`BySessionView`/`UsageChart` son
// componentes de presentación pura, reciben las entradas ya filtradas por
// prop, sin IPC propio.
export default {
  name: 'HistoryView',
  components: { TitleBar, UsageChart, ByAppView, BySessionView },
  data() {
    return {
      // `formatDateYYYYMMDD` (hora local) — nunca `toISOString()` (corrige
      // el defecto de zona horaria V15: en Chile, abrir el historial
      // después de las 20:00 con `toISOString()` consultaba el día
      // siguiente y mostraba la lista vacía).
      selectedDate: formatDateYYYYMMDD(new Date()),
      // 'day' | 'month' | 'range' — fijo a 'day' en esta etapa; el selector
      // de alcance y las otras dos opciones llegan en la Tarea 26.
      chartScope: 'day',
      customRange: null,
      activeView: 'byApp', // 'byApp' | 'bySession'
      sessionDates: [],
      dayEntries: [],
      chartEntries: [],
    }
  },
  computed: {
    calendarAttributes() {
      return [
        {
          key: 'logs',
          highlight: { contentClass: 'dot' },
          dates: this.sessionDates.map(this.parseLocalNoon),
        },
      ]
    },
    // Alcance del gráfico (D-12): esta etapa solo cubre 'day', que coincide
    // por construcción con el intervalo de las dos listas de abajo — el
    // criterio "el gráfico coincide con la lista por aplicación en el día"
    // se cumple porque ambos piden el mismo `{from, to}`.
    chartInterval() {
      return { from: this.selectedDate, to: this.selectedDate }
    },
    chartLabel() {
      return this.selectedDate
    },
  },
  watch: {
    selectedDate() {
      this.loadDayEntries()
      this.loadChartEntries()
    },
  },
  created() {
    this.loadSessionDates()
    this.loadDayEntries()
    this.loadChartEntries()
  },
  methods: {
    async loadSessionDates() {
      this.sessionDates = await ipcRenderer.invoke('get-session-dates')
    },
    async loadDayEntries() {
      this.dayEntries = await ipcRenderer.invoke('get-sessions', {
        from: this.selectedDate,
        to: this.selectedDate,
      })
    },
    async loadChartEntries() {
      const { from, to } = this.chartInterval
      this.chartEntries = await ipcRenderer.invoke('get-sessions', { from, to })
    },
    // 'YYYY-MM-DD' → Date al mediodía local, para que el punto del
    // calendario no se corra de día por redondeo de zona horaria.
    parseLocalNoon(dateStr) {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day, 12)
    },
    handleDateClick(day) {
      this.selectedDate = formatDateYYYYMMDD(day.date)
    },
  },
}
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  background-color: #1b1b1b ;
}

::-webkit-scrollbar {
  width: 3px;              /* Grosor del scrollbar */
  background-color: transparent; /* Fondo del track, transparente */
}

::-webkit-scrollbar-track {
  background-color: transparent; /* Track invisible */
}

::-webkit-scrollbar-thumb {
  background-color: #2e2e2e;  /* Color blanco */
  border-radius: 3px;      /* Borde redondeado */
}

/* Opcional: hover para feedback */
::-webkit-scrollbar-thumb:hover {
  background-color: #ccc;
}

.history-view {
  padding: 20px;
  max-width: 600px;
  font-family: sans-serif;
  background-color: #1b1b1b;
  box-sizing: border-box;
  border-radius: 0 !important;
}

.dark-calendar {
  /* Fondo y texto base */
  background-color: #1b1b1b !important;
  color: #fff !important;
  /* Margen para separar un poco */
  margin: 1rem auto;
  border-radius: 0 !important;
}

.vc-arrow:hover {
  background-color: #2e2e2e !important; /* Color de fondo al pasar el mouse */
  color: #fff !important; /* Color del texto al pasar el mouse */
}

.vc-weekday {
  color: #bdbdbd !important;
}
.vc-day-content.vc-disabled {
  color: #bdbdbd !important; /* Color gris para días deshabilitados */
}
.dark-calendar .vc-title span {
  text-transform: capitalize;
}

.dark-calendar * {
  /* Hacemos transparente a todos los subelementos
     para no sobreescribirlo todo con negro sólido */
  background-color: transparent ;
  color: #fff ;
}



/* Día seleccionado */
.dark-calendar .vc-day-content.vc-highlight-content-solid.vc-blue {
  background-color: #777676 !important; /* el color que desees */
  color: #fff !important;
}
.dark-calendar .vc-highlight.vc-highlight-bg-solid.vc-blue {
  background-color: #a4a5a5 !important;
  opacity: 1 !important;
}

.vc-focus {
  border: 1px solid #3a3a3a;
  border-radius: 0 !important;
}

.vc-focus:focus {
  box-shadow: 0 0 0 2px #3a3a3a !important;
}

.view-tabs {
  display: flex;
  gap: 0.4rem;
  margin-top: 1rem;
}
.view-tabs button {
  flex: 1;
  background: #333;
  border: none;
  color: #ccc;
  padding: 6px;
  cursor: pointer;
  border-radius: 4px;
}
.view-tabs button.active {
  background: #6f6f6f;
  color: #fff;
}
</style>
