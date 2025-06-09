<!-- eslint-disable vue/no-multiple-template-root -->
<template>
  <div id="custom-titlebar">
     <div class="toggle-squares">
      <div
        class="option-card"
        :class="{ selected: appStore.manual }"
        @click="toggleManual"
      >
        <img src="@/assets/manual.png" alt="Manual" class="option-icon" />
      </div>
      <div
        class="option-card"
        :class="{ selected: appStore.aplicacion }"
        @click="toggleAplicacion"
      >
        <!-- <img src="@/assets/manual.png" alt="Manual" class="option-icon" /> -->
        W
      </div>
      <div
        class="option-card"
        :class="{ selected: appStore.pomodoro }"
        @click="togglePomodoro"
      >
        <!-- <img src="@/assets/manual.png" alt="Manual" class="option-icon" /> -->
        P
      </div>
    </div>
    <div class="window-controls">
      <button v-if="!pinned" @click="togglePin">
        <font-awesome-icon :icon="['fas', 'thumbtack']" />
      </button>
      <button v-else @click="togglePin">
        <font-awesome-icon :icon="['fas', 'thumbtack-slash']" />
      </button>
      <button @click="maximizarToggle">
        <span v-if="!maximizado">
          <font-awesome-icon :icon="['far', 'square']" />
        </span>
        <span v-else>
          <font-awesome-icon :icon="['fas', 'window-restore']" />
        </span>
      </button>
      <button @click="cerrar">
        <font-awesome-icon :icon="['fas', 'x']" />
      </button>
    </div>
  </div>
  
  <!-- Modal para mostrar la lista de ventanas -->
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
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faWindowMinimize, faWindowMaximize, faWindowRestore, faX, faGear, faThumbtack, faThumbtackSlash } from '@fortawesome/free-solid-svg-icons'
import { faRectangleXmark, faSquare } from '@fortawesome/free-regular-svg-icons'
import { useAppStore } from '@/stores/menu'

library.add(faWindowMinimize, faWindowMaximize, faWindowRestore, faRectangleXmark, faX, faSquare, faGear, faThumbtack, faThumbtackSlash)

const { remote, ipcRenderer } = require('electron')

export default {
  name: 'TitleBar',
  components: { FontAwesomeIcon },
  data() {
    return {
      maximizado: false,
      pinned: false,
      openWindows: [],
      showAppList: false,
      selectedIndex: 0,
      appStore: useAppStore(),
    }
  },
  mounted() {
    const win = remote.getCurrentWindow()
    win.on('maximize', () => { this.maximizado = true })
    win.on('unmaximize', () => { this.maximizado = false })
  },
  methods: {
    maximizarToggle() {
      const win = remote.getCurrentWindow()
      win.isMaximized() ? win.unmaximize() : win.maximize()
    },
    cerrar() {
      remote.getCurrentWindow().close()
    },
    toggleManual() {
      this.appStore.toggleOption(1)
      this.appStore.manual ? this.$playSound('add') : this.$playSound('deleteItem')
    },
    toggleAplicacion() {
      this.appStore.toggleOption(2)
      this.appStore.aplicacion ? this.$playSound('add') : this.$playSound('deleteItem')
    },
    togglePomodoro() {
      this.appStore.toggleOption(3)
      this.appStore.pomodoro ? this.$playSound('add') : this.$playSound('deleteItem')
    },

    togglePin() {
      if (this.pinned) {
        ipcRenderer.send('stop-monitoring-active-window')
        ipcRenderer.send('set-always-on-top', false)
        this.pinned = false
      } else {
        const menuTemplate = [
          {
            label: 'Poner la app sobre todo',
            click: () => {
              ipcRenderer.send('set-always-on-top', true)
              ipcRenderer.send('stop-monitoring-active-window')
              this.pinned = true
            }
          },
          {
            label: 'Poner solo sobre una aplicación',
            click: async () => {
              const windows = await ipcRenderer.invoke('get-open-windows')
              this.openWindows = windows
              this.selectedIndex = 0
              this.showAppList = true
              this.$nextTick(() => {
                // Enfocar el modal para recibir eventos de teclado
                this.$refs.modalContent.focus()

              })
            }
          }
        ]
        const menu = remote.Menu.buildFromTemplate(menuTemplate)
        menu.popup({ window: remote.getCurrentWindow() })
      }
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
    selectApp(app) {
      ipcRenderer.send('start-monitoring-active-window', app.appName)
      this.pinned = true
      this.showAppList = false
    },
    closeAppList() {
      this.showAppList = false
    }
  }
}
</script>

<style scoped>
#custom-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  -webkit-app-region: drag;
  padding: 5px 10px;
  border-bottom: white 1px solid;
  white-space: nowrap;
}
.window-controls button,
.setting-control button {
  -webkit-app-region: no-drag;
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  white-space: nowrap;
}
.window-controls button:hover,
.setting-control button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.toggle-squares,
.option-card {
  -webkit-app-region: no-drag;
}


.toggle-squares {
  display: flex;
  gap: 0.4rem;
}

.option-card {
  flex: 1;
  padding: 2px;
  width: 24px;
  height: 24px;
  font-size: 1em;      /* quizá ajustes un poco el tamaño */
  text-align: center;
  border: 2px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 0;      /* asegura esquinas cuadradas */
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;

  /* Quita cualquier outline por foco */
  outline: none;
}
.option-card:hover {
  border-color: #999;
  color: #999;
}

.option-card.selected {
  background: #6f6f6f;
  color: white;
}

/* Estilos para el modal */
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
.option-icon {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain; /* mantiene la proporción */
}
</style>
