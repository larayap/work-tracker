<template>
  <div class="pomodoro-dynamic">
    <audio ref="endSesion" :src="endSesion" preload="auto"></audio>
    <audio ref="deleteItem" :src="deleteItem" preload="auto"></audio>
    <audio ref="popUp" :src="popUp" preload="auto"></audio>
    <audio ref="pressButton" :src="pressButton" preload="auto"></audio>
    <audio ref="add" :src="add" preload="auto"></audio>

    <h1 class="title-pomodoro">Pomodoro</h1>
    <!-- Sesiones: arrastrables -->
    <div class="session-list" ref="sessionList">
      <draggable 
        class="session-content" 
        v-model="sessions"
        item-key="id" 
        animation="200" 
        chosen-class="drag-chosen" 
        ghost-class="drag-ghost" 
        @end="onSessionReorder"
      >
        <template #item="{ element, index }">
          <div class="session-item" :class="{ editing: editingIndex === index }" :style="getFillStyle(index)">
            <button class="remove-btn" @click.stop="removeSession(index)">—</button>
            <span v-if="editingIndex !== index" class="item" @click="startEditing(index)">
              {{ formatTimeMin(element.time) }}
            </span>
            <input v-else class="edit-input" type="number" v-model.number="editValue" min="1" @blur="stopEditing"
              @keyup.enter="stopEditing" />
          </div>
        </template>
      </draggable>
      <div class="session-item add-btn" @click="addDefaultSession">+</div>
    </div>

    <!-- Temporizador -->
    <div class="timer">
      <h3>{{ formatTime(currentTime) }}</h3>
    </div>

    <!-- Controles -->
    <div class="controls">
      <button @click="toggle">
        <font-awesome-icon :icon="running ? 'pause' : 'play'" />
      </button>
      <!-- <button @click="start" :disabled="running">Iniciar</button>
      <button @click="pause" :disabled="!running">Pausar</button> -->
      <button @click="reset">
        <font-awesome-icon :icon="'rotate-left'" />
      </button>
      <button @click="cancel">
        <font-awesome-icon :icon="'x'" />
      </button>
    </div>

  </div>
</template>

<script>
import draggable from 'vuedraggable'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faPlay, faPause, faSquare, faRotateLeft, faX } from '@fortawesome/free-solid-svg-icons'
import { library } from '@fortawesome/fontawesome-svg-core'
library.add(faPlay, faPause, faSquare, faRotateLeft, faX)

const endSesion = require('@/sounds/endSesion.mp3')
const deleteItem = require('@/sounds/deleteItem.mp3')
const popUp = require('@/sounds/popUp.mp3')
const pressButton = require('@/sounds/pressButton.mp3')
const add = require('@/sounds/add.mp3')

const { ipcRenderer } = window.require('electron')

export default {
  name: 'DynamicPomodoro',
  components: { draggable, FontAwesomeIcon },
  data() {
    return {
      sessions: [],
      running: false,
      currentIndex: 0,
      currentTime: 60,
      timer: null,
      editingIndex: null,
      editValue: null,
      endSesion: endSesion,
      deleteItem: deleteItem,
      popUp: popUp,
      pressButton: pressButton,
      add: add,
    }
  },
  mounted() {
    const el = this.$refs.sessionList
    // passive: false para poder preventDefault()
    el.addEventListener('wheel', this.onWheel, { passive: false })
  },
  async created() {
    const saved = await ipcRenderer.invoke('load-sessions')
    if (Array.isArray(saved)) {
      this.sessions = saved
    } else {
      // si no había archivo (o devolvió null), usamos tu array por defecto
      this.sessions = [
        { id: Date.now(),     time: 60 },
        { id: Date.now() + 1, time: 60 },
        { id: Date.now() + 2, time: 60 },
      ]
      // y lo salvamos para que el main cree el archivo
      ipcRenderer.send('save-sessions',
        this.sessions.map(s => ({ id: s.id, time: s.time }))
      )
    }
    // inicializamos currentTime para el primer bloque
    this.currentTime = this.sessions[0]?.time || 0
  },
  computed: {
    // porcentaje [0..1] de cuánto ha avanzado la sesión actual
    currentProgress() {
      const sess = this.sessions[this.currentIndex]
      if (!sess) return 0
      return (sess.time - this.currentTime) / sess.time
    }
  },
  methods: {
    onWheel(e) {
      e.preventDefault()               // evitamos el scroll vertical
      this.$refs.sessionList.scrollLeft += e.deltaY * 0.4
    },
    formatTime(seconds) {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0')
      const s = (seconds % 60).toString().padStart(2, '0')
      return `${m}:${s}`
    },
    playSound(refName) {
      // clona la etiqueta <audio> y la dispara
      const snd = this.$refs[refName].cloneNode()
      snd.play().catch(()=>{})
    },
    onSessionReorder() {
      this.playSound('popUp')
    },
    getFillStyle(index) {
      // completadas → relleno 100%
      
      if (index < this.currentIndex) {
        return { backgroundColor: '#d3d3d3' }
      }
      // en curso → degradado según progreso
      if (index === this.currentIndex) {
        const p = Math.min(Math.max(this.currentProgress, 0), 1) * 100
        return {
          background: `linear-gradient(to right, #d3d3d3 ${p}%, black ${p}%)`
        }
      }
      // futuras → sin relleno extra
      return {}
    },
    formatTimeMin(seconds) {
      const m = seconds / 60;
      return m % 1 === 0
        ? String(m)
        : m.toFixed(1)
    },
    addDefaultSession() {
      this.playSound('add')
      this.sessions.push({ id: Date.now(), time: 5 * 60 })
    },
    removeSession(index) {
      this.playSound('deleteItem')
      if (this.sessions[index]) {
        this.sessions.splice(index, 1)
      }
    },
    startEditing(index) {
      this.editingIndex = index
      this.editValue = Math.floor(this.sessions[index].time / 60)
    },
    stopEditing() {
      const newTime = this.editValue * 60
      if (this.editValue > 0) {
        this.sessions[this.editingIndex].time = newTime
      }
      if (this.editingIndex === this.currentIndex) {
        this.currentTime = newTime
      }
      this.editingIndex = null
      this.editValue = null
    },
    toggle() {
      this.running ? this.pause() : this.start()
    },
    start() {
      if (!this.sessions.length) return
      if (this.currentTime <= 0) {
      // caso “primera vez” o tras cancel()
      this.currentIndex = 0
      this.currentTime = this.sessions[0].time
    }
    this.playSound('pressButton')
    this.running = true
    this.timer = setInterval(this.tick, 1000)
    },
    pause() {
      clearInterval(this.timer)
      this.playSound('pressButton')
      this.running = false
    },
    reset() {
      clearInterval(this.timer)
      this.playSound('pressButton')
      this.running = true
      this.currentTime = this.sessions[this.currentIndex]?.time || 0
      this.timer = setInterval(this.tick, 1000)
    },
    cancel() {
      clearInterval(this.timer)
      this.playSound('pressButton')
      this.running = false
      this.currentIndex = 0
      this.currentTime = this.sessions[this.currentIndex]?.time || 0
    },
    tick() {
      if (this.currentTime > 0) {
        this.currentTime--
      } else {
        this.nextSession()
      }
    },
    nextSession() {
      this.playSound('endSesion')
      clearInterval(this.timer)
      if (this.currentIndex < this.sessions.length - 1) {
        this.currentIndex++
        this.currentTime = this.sessions[this.currentIndex].time
        this.timer = setInterval(this.tick, 1000)
      } else {
        this.playSound('endSesion')
        this.running = false
      }
    }
  },
  watch: {
    // cuando cambie cualquier cosa en sessions, lo grabo
    sessions: {
      deep: true,
      handler(newList) {
        const plainArray = newList.map(s => ({ id: s.id, time: s.time }))
        ipcRenderer.send('save-sessions', plainArray)
      }
    }
  },
  beforeUnmount() {
    clearInterval(this.timer)
    this.$refs.sessionList.removeEventListener('wheel', this.onWheel)
  },
}
</script>

<style scoped>
.pomodoro-dynamic {
  text-align: center;
  user-select: none;
}

.title-pomodoro {
  font-size: 2rem;
  margin: 0 10px 10px 10px;
}

.session-list {
  overflow-x: auto;       /* activa scroll horizontal */
  white-space: nowrap;     /* evita que baje a la siguiente línea */
  text-align: center;      /* centra su contenido inline */
  padding: 10px 0;         /* espacio arriba/abajo (opcional) */
  -webkit-overflow-scrolling: touch; /* suaviza scroll en iOS/macOS */
}

.session-content {
  display: inline-flex;
  gap: 10px;
}

.session-item {
  position: relative;
  border: 1px solid #9b9999;
  background-color: black;
  color: #fff;
  padding: 10px 20px;
  cursor: grab;
  font-size: 1.6em;
  font-weight: bold;
  letter-spacing: 0.1em;
  flex: 0 0 auto;
  display: inline-block; 
}
.add-btn {
  margin-left: 10px;
}
.session-list::-webkit-scrollbar {
  height: 0;
}
.session-list::-webkit-scrollbar-thumb {
  background: rgba(233, 233, 233, 0.3);
}
.remove-btn {
  position: absolute;
  top: 0;
  right: 4px;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  cursor: pointer;
  padding: 0;
}

.controls {
  margin-bottom: 15px;
}

.controls button {
  margin: 0 5px;
  transition: transform 0.2s ease-in-out;
}

.controls button:hover {
  transform: scale(1.2);
}

.controls button:focus {
  outline: none;
}

.timer h3 {
  font-size: 1.4em;
  font-weight: 700;
  margin: 5px 0;
  letter-spacing: 0.1em;
}

.edit-input {
  width: 40px;
  height: 30px;
  position: relative;
  border: 1px solid #9b9999;
  background-color: black;
  color: #fff;
  font-size: 1.2em;
  font-weight: bold;
  border: none;
  outline: none;
  font-family: "Architects Daughter", cursive;
}

.edit-input::-webkit-outer-spin-button,
.edit-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.controls button {
  background: none;
  border: none;
  cursor: pointer;
  margin: 0;
  padding: 0 1rem;
  font-size: 1.5rem;
  color: #f0f0f0;
  transition: transform 0.2s ease-in-out;
}

.drag-chosen {
  opacity: 0.1 !important;
}

.draggable-mirror {
  opacity: 0.1 !important;
}
.drag-ghost {
  opacity: 0 !important;
}
</style>
