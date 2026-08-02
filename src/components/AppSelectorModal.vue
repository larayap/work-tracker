<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content selector-content">
      <h3>Agregar aplicación</h3>

      <div class="tabs">
        <button :class="{ active: tab === 'installed' }" @click="tab = 'installed'">
          Instaladas
        </button>
        <button :class="{ active: tab === 'open' }" @click="tab = 'open'">
          Procesos abiertos
        </button>
      </div>

      <input
        type="text"
        v-model="query"
        placeholder="Buscar..."
        class="search-input"
      />

      <p v-if="monitoredApps.limitReached" class="limit-warning">
        Límite de 4 aplicaciones alcanzado. Detén una fila para agregar otra.
      </p>

      <div v-if="tab === 'installed'">
        <p v-if="installedLoading" class="loading-text">Cargando aplicaciones instaladas…</p>
        <ul class="selector-list">
          <li
            v-for="appEntry in filteredInstalled"
            :key="appEntry.appId"
            :class="{ disabled: monitoredApps.limitReached, checked: isSelected(appEntry.appId) }"
            @click="choose(appEntry)"
          >
            <span class="check-mark">{{ isSelected(appEntry.appId) ? '✓' : '' }}</span>
            {{ appEntry.name }}
          </li>
        </ul>
      </div>

      <div v-else>
        <ul class="selector-list">
          <li
            v-for="win in filteredOpenWindows"
            :key="(win.exePath || win.appName) + '-' + (win.pid || 0)"
            :class="{ disabled: monitoredApps.limitReached }"
            @click="chooseOpenWindow(win)"
          >
            {{ win.appName }}
          </li>
        </ul>
      </div>

      <button class="close-btn" @click="$emit('close')">Cerrar</button>
    </div>
  </div>
</template>

<script>
import { useMonitoredAppsStore } from '@/stores/monitoredApps'

const { ipcRenderer } = window.require('electron')

// Selector con dos vías (D8/row-lifecycle): instaladas (fuente de calidad,
// ADR-0003) y procesos abiertos (compensa el sesgo hacia el falso negativo
// del filtro de instaladas — programas portables sin acceso directo
// reconocible).
export default {
  name: 'AppSelectorModal',
  emits: ['close'],
  data() {
    return {
      monitoredApps: useMonitoredAppsStore(),
      tab: 'installed',
      query: '',
      installedApps: [],
      installedLoading: true,
      openWindows: [],
    }
  },
  computed: {
    filteredInstalled() {
      const q = this.query.trim().toLowerCase()
      if (!q) return this.installedApps
      return this.installedApps.filter((appEntry) => appEntry.name.toLowerCase().includes(q))
    },
    filteredOpenWindows() {
      const q = this.query.trim().toLowerCase()
      if (!q) return this.openWindows
      return this.openWindows.filter((win) => win.appName.toLowerCase().includes(q))
    },
  },
  created() {
    this.loadInstalled()
    this.loadOpenWindows()
    ipcRenderer.on('installed-apps-updated', this.handleInstalledUpdated)
  },
  beforeUnmount() {
    ipcRenderer.removeListener('installed-apps-updated', this.handleInstalledUpdated)
  },
  methods: {
    loadInstalled() {
      ipcRenderer.invoke('get-installed-apps').then(({ apps, loading }) => {
        this.installedApps = apps
        this.installedLoading = loading
      })
    },
    loadOpenWindows() {
      ipcRenderer.invoke('get-open-windows').then((windows) => {
        this.openWindows = windows
      })
    },
    handleInstalledUpdated(event, payload) {
      this.installedApps = payload.apps
      this.installedLoading = false
    },
    isSelected(appId) {
      return this.monitoredApps.selection.some((entry) => entry.appId === appId)
    },
    choose(appEntry) {
      if (this.monitoredApps.limitReached || this.isSelected(appEntry.appId)) return
      this.monitoredApps.addApp({
        appId: appEntry.appId,
        name: appEntry.name,
        exePath: appEntry.exePath,
      })
    },
    chooseOpenWindow(win) {
      if (this.monitoredApps.limitReached) return
      // Sin `appId`: el main lo normaliza (D4) — por ruta si `exePath`
      // resolvió, por nombre de imagen en el caso degradado si no.
      this.monitoredApps.addApp({ name: win.appName, exePath: win.exePath || null })
    },
  },
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
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
.selector-content h3 {
  margin-top: 0;
  text-align: center;
}
.tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}
.tabs button {
  flex: 1;
  background: #333;
  border: none;
  color: #ccc;
  padding: 6px;
  cursor: pointer;
  border-radius: 4px;
}
.tabs button.active {
  background: #6f6f6f;
  color: #fff;
}
.search-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 0.6rem;
  padding: 6px;
  border-radius: 4px;
  border: none;
}
.limit-warning {
  font-size: 0.8rem;
  color: #ffb347;
  margin: 0 0 0.6rem 0;
}
.loading-text {
  font-size: 0.85rem;
  color: #ccc;
  text-align: center;
}
.selector-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.selector-list li {
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.selector-list li:hover {
  background-color: rgba(255, 255, 255, 0.3);
}
.selector-list li.disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
}
.check-mark {
  width: 1em;
  display: inline-block;
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
