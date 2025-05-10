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

    <table class="log-table">
      <thead>
        <tr>
          <th>Tiempo</th>
          <th>App</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(log, i) in filteredLogs" :key="i">
          <td>{{ log.duration }}</td>
          <td>{{ log.app }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import TitleBar from './TitleBar.vue'

const { ipcRenderer } = window.require('electron')

export default {
  data() {
    return {
      logs: [],
      selectedDate: new Date(),
      filteredLogs: [],
      datesWithLogs: [],
    }
  },  
  components: {
    TitleBar,
  },
  computed: {
    calendarAttributes() {
      return [
        {
          key: 'logs',
          highlight: {
            contentClass: 'dot',
          },
          dates: this.datesWithLogs,
        }
      ]
    },
  },
  methods: {
    async loadLogs() {
      const entries = await ipcRenderer.invoke('get-app-logs')
      this.logs = entries

      const uniqueDates = [...new Set(entries.map(log => log.date))]
      this.datesWithLogs = uniqueDates.map(this.parseLocalNoon)
      this.loadLogsForDate(this.selectedDate)
    },
    parseLocalNoon(dateStr) {
      const [onlyDate] = dateStr.split('T') // "2025-04-06"
      
      // Separa año, mes, día => [2025, 4, 6]
      const [year, month, day] = onlyDate.split('-').map(Number)
      
      // Retorna una fecha local con hora = 12:00 (para evitar el desfase hacia el día anterior)
      return new Date(year, month - 1, day, 12)
    },
    loadLogsForDate(date) {
      const formatted = date.toISOString().split('T')[0]
      const todaysLogs = this.logs.filter(log => log.date === formatted)

      // Agrupamos por app y sumamos duraciones en segundos
      const grouped = {}
      todaysLogs.forEach(log => {
        if (!grouped[log.app]) {
          grouped[log.app] = 0
        }
        grouped[log.app] += this.parseDurationToSeconds(log.duration)
      })

      // Convertimos a array final con la duración en "HH:MM:SS"
      this.filteredLogs = Object.keys(grouped).map(appName => ({
        app: appName,
        duration: this.formatSecondsToHMS(grouped[appName])
      }))
    },
        // Convierte "HH:MM:SS" a segundos
        parseDurationToSeconds(durationStr) {
      // Ejemplo: "00:10:15"
      const [hh, mm, ss] = durationStr.split(':').map(Number)
      return hh * 3600 + mm * 60 + ss
    },

    // Convierte segundos a "HH:MM:SS"
    formatSecondsToHMS(totalSec) {
      const hours = Math.floor(totalSec / 3600)
      const mins = Math.floor((totalSec % 3600) / 60)
      const secs = totalSec % 60

      const hh = String(hours).padStart(2, '0')
      const mm = String(mins).padStart(2, '0')
      const ss = String(secs).padStart(2, '0')
      return `${hh}:${mm}:${ss}`
    },
    handleDateClick(day) {
      this.selectedDate = new Date(day.date)
      this.loadLogsForDate(this.selectedDate)
    }
  },
  mounted() {
    this.loadLogs()
  }
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

/* Estilos para la tabla */
.log-table {
  width: 100%;
  border-collapse: collapse;  /* Para un look más compacto */
  margin-top: 1rem;
  table-layout: fixed;
}

/* Cabecera de la tabla */
.log-table thead th {
  background-color: #2a2a2a;
  color: #fff;
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #fff; /* Divider */
}

/* Celdas de datos */
.log-table tbody td {
  background-color: #1b1b1b;
  color: #fff;
  padding: 0.75rem;
  border-bottom: 1px solid #333; /* Divider horizontal */
}

/* Ultima fila sin borde? (Opcional) */
.log-table tbody tr:last-child td {
  border-bottom: none;
}

</style>
