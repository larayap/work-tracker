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

    <div class="scope-tabs">
      <button :class="{ active: chartScope === 'day' }" @click="chartScope = 'day'">Día</button>
      <button :class="{ active: chartScope === 'month' }" @click="chartScope = 'month'">Mes</button>
      <button :class="{ active: chartScope === 'range' }" @click="chartScope = 'range'">Rango</button>
    </div>

    <!-- Modificador `.range` de `v-model` (v-calendar 3.1.2) — no la prop
         `is-range`, que es la API de v2 y no debe copiarse (V12/D-12).
         `eslint-plugin-vue` no conoce los modificadores custom de un
         componente externo compilado (no SFC), de ahí el disable puntual. -->
    <!-- eslint-disable vue/no-custom-modifiers-on-v-model -->
    <v-date-picker
      v-if="chartScope === 'range'"
      v-model.range="customRange"
      :max-date="new Date()"
      class="dark-calendar range-picker"
    />
    <!-- eslint-enable vue/no-custom-modifiers-on-v-model -->

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
    <BySessionView v-else :entries="dayEntries" :time-format="timeFormat" />
  </div>
</template>

<script>
import TitleBar from './TitleBar.vue'
import UsageChart from './UsageChart.vue'
import ByAppView from './ByAppView.vue'
import BySessionView from './BySessionView.vue'
import { formatDateYYYYMMDD } from '@/utils/time-format.js'
import { monthBounds } from '@/utils/session-aggregate.js'

const { ipcRenderer } = window.require('electron')

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTH_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Rótulo del intervalo vigente (D-11/D-12), calculado en el shell a partir
// de las mismas cadenas 'YYYY-MM-DD' que ya viajan por toda la app — sin
// librería de fechas adicional, mismo criterio que `session-aggregate.js`.
function formatDayLabel(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${day} ${MONTH_ABBR[month - 1]} ${year}`
}

function formatMonthLabel(dateStr) {
  const [year, month] = dateStr.split('-').map(Number)
  return `${MONTH_FULL[month - 1]} ${year}`
}

function formatRangeLabel(fromStr, toStr) {
  const [, fromMonth, fromDay] = fromStr.split('-').map(Number)
  const [, toMonth, toDay] = toStr.split('-').map(Number)
  if (fromMonth === toMonth) {
    return `${fromDay}–${toDay} ${MONTH_ABBR[fromMonth - 1]}`
  }
  return `${fromDay} ${MONTH_ABBR[fromMonth - 1]}–${toDay} ${MONTH_ABBR[toMonth - 1]}`
}

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
      chartScope: 'day', // 'day' | 'month' | 'range' — gobierna solo el gráfico (D-12)
      customRange: null, // { start: Date, end: Date } | null — solo con chartScope 'range'
      activeView: 'byApp', // 'byApp' | 'bySession'
      sessionDates: [],
      dayEntries: [],
      chartEntries: [],
      // Preferencia de formato de hora (ADR-0012): esta ventana no monta
      // Pinia (el store `settings` arrastra `@/plugins/sound`, que precarga
      // cinco `Howl` innecesarios acá), así que se lee una sola vez por IPC
      // en `created()` y se baja por prop a `BySessionView`.
      timeFormat: '24h',
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
    // Alcance del gráfico (D-12), derivado según la tabla de la decisión: con
    // `chartScope: 'day'` coincide por construcción con el intervalo de las
    // dos listas de abajo — el criterio "el gráfico coincide con la lista
    // por aplicación en el día" se cumple porque ambos piden el mismo
    // `{from, to}`. Las dos listas nunca miran `chartScope`: siguen ancladas
    // a `selectedDate` sin excepción.
    chartInterval() {
      if (this.chartScope === 'month') {
        return monthBounds(this.selectedDate)
      }
      if (this.chartScope === 'range' && this.customRange) {
        return {
          from: formatDateYYYYMMDD(this.customRange.start),
          to: formatDateYYYYMMDD(this.customRange.end),
        }
      }
      return { from: this.selectedDate, to: this.selectedDate }
    },
    chartLabel() {
      if (this.chartScope === 'month') {
        return formatMonthLabel(this.selectedDate)
      }
      if (this.chartScope === 'range' && this.customRange) {
        const { from, to } = this.chartInterval
        return formatRangeLabel(from, to)
      }
      return formatDayLabel(this.selectedDate)
    },
  },
  watch: {
    selectedDate() {
      this.loadDayEntries()
      this.loadChartEntries()
    },
    chartScope() {
      this.loadChartEntries()
    },
    customRange() {
      if (this.chartScope === 'range') this.loadChartEntries()
    },
  },
  created() {
    this.loadSessionDates()
    this.loadDayEntries()
    this.loadChartEntries()
    this.loadTimeFormat()
  },
  methods: {
    async loadTimeFormat() {
      const settings = await ipcRenderer.invoke('get-settings')
      this.timeFormat = settings.timeFormat
    },
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

.view-tabs,
.scope-tabs {
  display: flex;
  gap: 0.4rem;
  margin-top: 1rem;
}
.view-tabs button,
.scope-tabs button {
  flex: 1;
  background: #333;
  border: none;
  color: #ccc;
  padding: 6px;
  cursor: pointer;
  border-radius: 4px;
}
.view-tabs button.active,
.scope-tabs button.active {
  background: #6f6f6f;
  color: #fff;
}

.range-picker {
  margin-top: 0.6rem;
}
</style>
