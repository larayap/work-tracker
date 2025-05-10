<template>
  <div class="cronometro">
    <div style="display: flex;">
      <button class="button-history" @click="openHistoryWindow()" title="Ver historial">
        <font-awesome-icon icon="bars" />
      </button>
      <h1 style="margin: 0;">Work</h1>
    </div>
    
    <div class="controls">
      <!-- Nuevo botón para seleccionar la aplicación -->
      <button @click="openAppList">
        <font-awesome-icon icon="plus" />
      </button>
      <div class="app-icon-inline" v-if="appIcon">
        <img :src="appIcon" :alt="`Icono de ${selectedApp}`" :title="`${selectedApp}`" />
      </div>
      <div class="display">{{ formattedTime }}</div>
      <button @click="reset">
        <font-awesome-icon icon="square" />
      </button>
      <button @click="toggle">
        <font-awesome-icon :icon="running ? 'pause' : 'play'" />
      </button>

    </div>

    <!-- Modal para seleccionar la aplicación -->
    <div v-if="showAppList" class="modal-overlay" @click.self="closeAppList">
      <div class="modal-content" ref="modalContent" tabindex="0" @keydown="handleKeydown">
        <h3>Selecciona una aplicación</h3>
        <ul>
          <li
            v-for="(app, index) in openWindows"
            :key="index"
            :class="{ selected: index === selectedIndex }"
            @click="selectApp(app)"
          >
            {{ app.appName }}
          </li>
        </ul>
        <button class="close-btn" @click="closeAppList">Cerrar lista</button>
      </div>
    </div>

    <!-- Modal de historial -->
    <div v-if="showHistory" class="modal-overlay" @click.self="showHistory = false">
      <div class="modal-content calendar-history">
        <h3>Historial por día</h3>
        <input type="date" v-model="selectedDate" @change="loadLogsForDate" />
        <ul class="history-list">
          <li v-for="(log, index) in filteredLogs" :key="index">
            {{ log.startTime }} - {{ log.endTime }} | {{ log.app }} ({{ log.duration }})
          </li>
        </ul>
        <button class="close-btn" @click="showHistory = false">Cerrar historial</button>
      </div>
    </div>

  </div>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faPlay, faPause, faSquare, faPlus, faBars } from '@fortawesome/free-solid-svg-icons'
import { library } from '@fortawesome/fontawesome-svg-core'
const { ipcRenderer } = window.require('electron')

library.add(faPlay, faPause, faSquare, faPlus, faBars)

export default {
  name: 'CronometroComponent',
  components: { FontAwesomeIcon },
  data() {
    return {
      time: 0,
      intervalId: null,
      running: false,
      appIcon: null,
      selectedApp: null, // Guarda la aplicación seleccionada
      monitoring: false, // Controla si está monitoreando
      openWindows: [], // Lista de ventanas abiertas
      showAppList: false, // Mostrar el modal
      selectedIndex: 0, // Índice de la app seleccionada
      startTime: null, // Hora de inicio del cronómetro
    }
  },
  computed: {
    formattedTime() {
      const seconds = Math.floor((this.time / 1000) % 60)
      const minutes = Math.floor((this.time / (1000 * 60)) % 60)
      const hours = Math.floor(this.time / (1000 * 60 * 60))
      const pad = num => (num < 10 ? '0' + num : num)
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    }
  },
  watch: {
    selectedApp(newAppName) {
      try {
        this.appIcon = require(`@/assets/${newAppName}.png`)
      } catch (err) {
        this.appIcon = require('@/assets/idk.png')
      }
    }
  },
  methods: {
    toggle() {
      this.running ? this.pause() : this.start()
    },
    openHistoryWindow() {
      const { ipcRenderer } = window.require('electron')
      ipcRenderer.send('open-history-window')
    },
    start() {
      if (!this.running && this.selectedApp) {
        this.running = true
        ipcRenderer.send('start-cronometro-monitoring', this.selectedApp)
      }
    },
    pause() {
      this.running = false
      ipcRenderer.send('stop-cronometro-monitoring')
      clearInterval(this.intervalId)
    },
    reset() {
      // 1) Marcar hora de fin
      const endTime = new Date()
      
      // 2) Parar cronómetro
      this.running = false
      clearInterval(this.intervalId)
      
      // 3) Calcular duración en formato HH:MM:SS
      const totalMs = this.time
      const duration = this.msToHHMMSS(totalMs)

      // 4) Formatear "inicio" y "fin" en HH:MM:SS
      const startString = this.startTime ? this.formatTimeHHMMSS(this.startTime) : '00:00:00'
      const endString = this.formatTimeHHMMSS(endTime)

      // 5) Formato [YYYY-MM-DD HH:MM:SS] Aplicación: XXX | Duración: XXX | Inicio: XXX | Fin: XXX
      const datePart = this.formatDateYYYYMMDD(endTime)       // e.g. 2025-04-06
      const timePart = this.formatTimeHHMMSS(endTime)         // e.g. 14:05:32
      const line = `[${datePart} ${timePart}] Aplicación: ${this.selectedApp} | Duración: ${duration} | Inicio: ${startString} | Fin: ${endString}`
      
      // 6) Enviamos al main process para guardar en .txt
      ipcRenderer.send('save-log-line', line)

      // 7) Reseteamos el contador
      this.time = 0
    },
    openAppList() {
      ipcRenderer.invoke('get-open-windows').then((windows) => {
        this.openWindows = windows
        this.selectedIndex = 0
        this.showAppList = true
        this.$nextTick(() => {
          this.$refs.modalContent.focus()
        })
      })
    },
    selectApp(app) {
      this.selectedApp = app.appName
      ipcRenderer.send('start-cronometro-monitoring', app.appName)
      this.showAppList = false
    },
    closeAppList() {
      this.showAppList = false
    },
    handleKeydown(e) {
      if (e.key === 'ArrowDown') {
        this.selectedIndex = (this.selectedIndex + 1) % this.openWindows.length
      } else if (e.key === 'ArrowUp') {
        this.selectedIndex = (this.selectedIndex - 1 + this.openWindows.length) % this.openWindows.length
      } else if (e.key === 'Enter') {
        const app = this.openWindows[this.selectedIndex]
        if (app) this.selectApp(app)
      } else if (e.key === 'Escape') {
        this.closeAppList()
      }
    },
    listenForAppStatus() {
      ipcRenderer.on('app-active', (event, data) => {
        const { isActive } = data
        console.log('App active:', isActive)
        if (isActive) {
          this.resumeTime()
        } else {
          this.pauseTime()
        }
      })
    },
    resumeTime() {
      if (!this.running) {
        this.running = true
        const startTime = Date.now() - this.time
        this.intervalId = setInterval(() => {
          this.time = Date.now() - startTime
        }, 10)
      }
    },
    pauseTime() {
      this.running = false
      clearInterval(this.intervalId)
    },
    // ===== Utilidades de formateo =====
    msToHHMMSS(ms) {
      const totalSeconds = Math.floor(ms / 1000)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      return [hours, minutes, seconds]
        .map((v) => (v < 10 ? '0' + v : v))
        .join(':')
    },
    formatTimeHHMMSS(dateObj) {
      const hh = String(dateObj.getHours()).padStart(2, '0')
      const mm = String(dateObj.getMinutes()).padStart(2, '0')
      const ss = String(dateObj.getSeconds()).padStart(2, '0')
      return `${hh}:${mm}:${ss}`
    },
    formatDateYYYYMMDD(dateObj) {
      const yyyy = dateObj.getFullYear()
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
      const dd = String(dateObj.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    },
  },
  mounted() {
    this.listenForAppStatus()
  },
  beforeUnmount() {
    clearInterval(this.intervalId)
  }
}
</script>

<style scoped>
.cronometro {
  position: relative;
  text-align: center;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.app-icon-inline {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
}

.app-icon-inline img {
  width: 100%;
  height: 100%;
  border-radius: 10px;
}

.display {
  display: inline;
  font-size: 2rem;
  width: 8ch;
  margin: 0.8rem 2.3rem;
  user-select: none;
}

.button-history {
  position: absolute;
  left: 0;
  top: 0;
  background-color: transparent;
  color: #f0f0f0;
  font-size: 1.1rem;    /* Tamaño del icono */
  border: none;
  cursor: pointer;
  transition: transform 0.3s ease-in-out;
}
.button-history:hover {

  color: #d3d3d3;

}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
}

.controls button {
  background: none;
  border: none;
  cursor: pointer;
  margin: 0;
  padding: 0.5rem 1rem;
  font-size: 1.5rem;
  color: #f0f0f0;
  transition: transform 0.2s ease-in-out;
}

.controls button:hover {
  transform: scale(1.2);
}

.controls button:focus {
  outline: none;
}

.selected-app {
  margin-top: 1rem;
  font-size: 1rem;
  color: #f0f0f0;
}

/* Estilos del modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-content {
  background-color: #444;
  color: #fff;
  padding: 20px;
  border-radius: 8px;
  width: 300px;
  max-height: 80%;
  overflow-y: auto;
  outline: none;
}
.modal-content h3 {
  margin-top: 0;
  text-align: center;
}
.modal-content ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.modal-content li {
  padding: 8px;
  cursor: pointer;
}
.modal-content li.selected,
.modal-content li:hover {
  background-color: rgba(255,255,255,0.3);
}
.close-btn {
  margin-top: 10px;
  width: 100%;
  background: #222;
  border: none;
  color: #fff;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
}
.close-btn:hover {
  background: #333;
}
</style>
