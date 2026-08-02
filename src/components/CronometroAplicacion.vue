<template>
  <div class="cronometro">
    <div class="header-wrapper">
      <button class="button-history" @click="openHistoryWindow()" title="Ver historial">
        <font-awesome-icon icon="bars" />
      </button>
      <h1 style="margin: 0;">Work</h1>
      <button
        class="button-add"
        @click="showSelector = true"
        :disabled="monitoredApps.limitReached"
        title="Agregar aplicación"
      >
        <font-awesome-icon icon="plus" />
      </button>
    </div>

    <!-- Estado vacío (empty-state): mismo reposo que hoy, sin mensaje ni ilustración -->
    <div v-if="monitoredApps.rows.length === 0" class="controls">
      <div class="display">00:00:00</div>
    </div>

    <AppRow
      v-for="row in monitoredApps.rows"
      :key="row.appId"
      :row="row"
      :icon="monitoredApps.icons[row.exePath]"
      @stop="monitoredApps.stopRow(row.appId)"
    />

    <AppSelectorModal v-if="showSelector" @close="showSelector = false" />

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
import { faPlus, faBars } from '@fortawesome/free-solid-svg-icons'
import { library } from '@fortawesome/fontawesome-svg-core'
import { useMonitoredAppsStore } from '@/stores/monitoredApps'
import AppRow from '@/components/AppRow.vue'
import AppSelectorModal from '@/components/AppSelectorModal.vue'
const { ipcRenderer } = window.require('electron')

library.add(faPlus, faBars)

export default {
  name: 'CronometroComponent',
  components: { FontAwesomeIcon, AppRow, AppSelectorModal },
  data() {
    return {
      monitoredApps: useMonitoredAppsStore(),
      showSelector: false, // Mostrar AppSelectorModal
    }
  },
  created() {
    this.monitoredApps.init()
  },
  watch: {
    'monitoredApps.rows'(rows) {
      rows.forEach((row) => this.monitoredApps.ensureIcon(row.exePath))
    },
  },
  methods: {
    openHistoryWindow() {
      ipcRenderer.send('open-history-window')
    },
  },
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
.header-wrapper {
  display: flex;
  position: relative;
  width: 100%;
  justify-content: center;
}
.display {
  display: inline;
  font-size: 2rem;
  width: 8ch;
  margin: 0;
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

.button-add {
  position: absolute;
  right: 0;
  top: 0;
  background-color: transparent;
  color: #f0f0f0;
  font-size: 1.1rem;
  border: none;
  cursor: pointer;
  transition: transform 0.3s ease-in-out;
}
.button-add:hover:not(:disabled) {
  color: #d3d3d3;
}
.button-add:disabled {
  opacity: 0.4;
  cursor: default;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
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
