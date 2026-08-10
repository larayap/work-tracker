<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content selector-content">
      <h3>Agregar aplicación</h3>

      <div class="tabs">
        <button :class="{ active: tab === 'installed' }" @click="tab = 'installed'">
          Instaladas
        </button>
        <button :class="{ active: tab === 'open' }" @click="tab = 'open'">
          Abiertas
        </button>
        <button :class="{ active: tab === 'added' }" @click="tab = 'added'">
          Agregadas
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

      <div class="type-toggle">
        <span class="type-toggle-label">Agregar como:</span>
        <button
          :class="{ active: addAsType === 'auto' }"
          @click="addAsType = 'auto'"
        >
          Permanente
        </button>
        <button
          :class="{ active: addAsType === 'manual' }"
          @click="addAsType = 'manual'"
        >
          Solo esta vez
        </button>
      </div>

      <div v-if="tab === 'installed'">
        <p v-if="installedLoading" class="loading-text">Cargando aplicaciones instaladas…</p>
        <ul class="selector-list">
          <li
            v-for="appEntry in filteredInstalled"
            :key="appEntry.appId"
            :class="{ disabled: monitoredApps.limitReached && !isSelected(appEntry.appId), checked: isSelected(appEntry.appId) }"
            @click="choose(appEntry)"
          >
            <span class="check-mark">{{ isSelected(appEntry.appId) ? '✓' : '' }}</span>
            <img
              class="installed-icon"
              :src="monitoredApps.icons[appEntry.exePath] || fallbackIcon"
              :alt="`Icono de ${appEntry.name}`"
            />
            {{ appEntry.name }}
          </li>
        </ul>
      </div>

      <div v-else-if="tab === 'open'">
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

      <div v-else>
        <p v-if="addedApps.length === 0" class="empty-text">{{ addedEmptyMessage }}</p>
        <ul v-else class="selector-list">
          <li
            v-for="entry in addedApps"
            :key="entry.appId"
            class="checked"
            @click="choose(entry)"
          >
            <!-- Toda entrada de esta vista está seleccionada por construcción: el ✓ es
                 literal y el clic sobre ella cae siempre en la rama de baja de `choose()`. -->
            <span class="check-mark">✓</span>
            <img
              class="installed-icon"
              :src="monitoredApps.icons[entry.exePath] || fallbackIcon"
              :alt="`Icono de ${entry.name}`"
            />
            {{ entry.name }}
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
      // Modalidad del próximo alta (Tarea 9, selection-type-manual-vs-auto):
      // 'auto' preserva el comportamiento de hoy por defecto.
      addAsType: 'auto',
      installedApps: [],
      installedLoading: true,
      openWindows: [],
      // Mismo archivo físico que usa `AppRow.vue` (sin duplicar el asset):
      // respaldo mientras `ensureIcons` completa la tanda, y defensa en
      // profundidad si el canal `get-app-icon` fallara.
      fallbackIcon: require('../../public/img/idk.png'),
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
    // Pestaña "Agregadas" (added-apps-review-tab): fuente `monitoredApps.selection`, no
    // `installedApps` — una entrada dada de alta desde "Abiertas" puede no estar en el
    // listado de instaladas.
    addedApps() {
      const q = this.query.trim().toLowerCase()
      const entries = this.monitoredApps.selection
      if (!q) return entries
      return entries.filter((entry) => (entry.name || '').toLowerCase().includes(q))
    },
    addedEmptyMessage() {
      return this.query.trim()
        ? 'Ninguna aplicación agregada coincide con la búsqueda.'
        : 'Todavía no hay aplicaciones agregadas. Agrégalas desde «Instaladas» o «Abiertas».'
    },
  },
  created() {
    this.loadInstalled()
    this.loadOpenWindows()
    ipcRenderer.on('installed-apps-updated', this.handleInstalledUpdated)
    // Íconos de la selección guardada (pestaña "Agregadas"): una entrada dada de alta
    // desde "Abiertas" puede no estar en el listado de instaladas, así que el
    // `ensureIcons` de `loadInstalled` no la cubre.
    this.monitoredApps.ensureIcons(
      this.monitoredApps.selection.map((entry) => entry.exePath).filter(Boolean)
    )
  },
  beforeUnmount() {
    ipcRenderer.removeListener('installed-apps-updated', this.handleInstalledUpdated)
  },
  methods: {
    loadInstalled() {
      ipcRenderer.invoke('get-installed-apps').then(({ apps, loading }) => {
        this.installedApps = apps
        this.installedLoading = loading
        this.monitoredApps.ensureIcons(apps.map((appEntry) => appEntry.exePath))
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
      this.monitoredApps.ensureIcons(payload.apps.map((appEntry) => appEntry.exePath))
    },
    isSelected(appId) {
      return this.monitoredApps.selection.some((entry) => entry.appId === appId)
    },
    choose(appEntry) {
      // Reordenado (D-6, Tarea 8): si ya está seleccionado, deseleccionar
      // siempre gana, incluso con el límite alcanzado — es justo el caso en
      // que más se necesita liberar un lugar. Recién si no está seleccionado
      // se evalúa `limitReached` para bloquear el alta.
      if (this.isSelected(appEntry.appId)) {
        this.monitoredApps.removeApp(appEntry.appId)
        return
      }
      if (this.monitoredApps.limitReached) return
      this.monitoredApps.addApp({
        appId: appEntry.appId,
        name: appEntry.name,
        exePath: appEntry.exePath,
        type: this.addAsType,
      })
    },
    chooseOpenWindow(win) {
      if (this.monitoredApps.limitReached) return
      // Sin `appId`: el main lo normaliza (D4) — por ruta si `exePath`
      // resolvió, por `win.imageName` (nombre de imagen real, no
      // `win.appName`) en el caso degradado si no (fix C2,
      // judgment-fixes-iteration-1: `appName` es una descripción sin
      // extensión, nunca coincide con lo que devuelve `tasklist`).
      this.monitoredApps.addApp({
        name: win.appName,
        exePath: win.exePath || null,
        imageName: win.imageName,
        type: this.addAsType,
      })
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
  font-size: 0.8rem;
  white-space: nowrap;
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
.type-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  font-size: 0.8rem;
}
.type-toggle-label {
  color: #ccc;
}
.type-toggle button {
  flex: 1;
  background: #333;
  border: none;
  color: #ccc;
  padding: 4px 6px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.78rem;
}
.type-toggle button.active {
  background: #6f6f6f;
  color: #fff;
}
.loading-text,
.empty-text {
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
.installed-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  filter: grayscale(1);
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
