<template>
  <div class="pomodoro-dynamic">
    <h1 class="title-pomodoro">Pomodoro</h1>
    <!-- Sesiones: arrastrables -->
    <div class="session-list">
      <draggable class="session-content" v-model="sessions"
        item-key="id" animation="200" chosen-class="drag-chosen" ghost-class="drag-ghost">
        <template #item="{ element, index }">
          <div class="session-item" :class="{ editing: editingIndex === index }">
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

export default {
  name: 'DynamicPomodoro',
  components: { draggable, FontAwesomeIcon },
  data() {
    return {
      sessions: [
        { id: Date.now(), time: 60 },
        { id: Date.now() + 1, time: 120 },
        { id: Date.now() + 2, time: 180 },
        { id: Date.now() + 3, time: 60 }
      ],
      running: false,
      currentIndex: 0,
      currentTime: 0,
      timer: null,
      editingIndex: null,
      editValue: null
    }
  },
  methods: {
    formatTime(seconds) {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0')
      const s = (seconds % 60).toString().padStart(2, '0')
      return `${m}:${s}`
    },
    formatTimeMin(seconds) {
      const m = seconds / 60;
      return m % 1 === 0
        ? String(m)
        : m.toFixed(1)
    },
    addDefaultSession() {
      this.sessions.push({ id: Date.now(), time: 5 * 60 })
    },
    removeSession(index) {
      if (this.sessions[index]) {
        this.sessions.splice(index, 1)
      }
    },
    startEditing(index) {
      this.editingIndex = index
      this.editValue = Math.floor(this.sessions[index].time / 60)
    },
    stopEditing() {
      if (this.editValue > 0) {
        this.sessions[this.editingIndex].time = this.editValue * 60
      }
      this.editingIndex = null
      this.editValue = null
    },
    toggle() {
      this.running ? this.pause() : this.start()
    },
    start() {
      if (!this.sessions.length) return
      this.running = true
      this.currentIndex = 0
      this.currentTime = this.sessions[0].time
      this.timer = setInterval(this.tick, 1000)
    },
    pause() {
      clearInterval(this.timer)
      this.running = false
    },
    reset() {
      clearInterval(this.timer)
      this.running = true
      this.currentTime = this.sessions[this.currentIndex]?.time || 0
      this.timer = setInterval(this.tick, 1000)
    },
    cancel() {
      clearInterval(this.timer)
      this.running = false
      this.currentTime = 0
      this.currentIndex = 0
    },
    tick() {
      if (this.currentTime > 0) {
        this.currentTime--
      } else {
        this.nextSession()
      }
    },
    nextSession() {
      clearInterval(this.timer)
      if (this.currentIndex < this.sessions.length - 1) {
        this.currentIndex++
        this.currentTime = this.sessions[this.currentIndex].time
        this.timer = setInterval(this.tick, 1000)
      } else {
        this.running = false
      }
    }
  },
  beforeUnmount() {
    clearInterval(this.timer)
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
  display: flex;
  flex-direction: row;
  gap: 10px;
  justify-content: center;
}

.session-content {
  display: flex;
  flex-direction: row;
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
}

.session-item:active {
  cursor: grabbing;
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
  text-align: center;
  border: none;
  border-radius: 3px;
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
  background-color: aquamarine;
}
</style>
