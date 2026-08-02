<template>
  <div class="app-row" :class="{ paused: row.state === 'paused' }">
    <div class="row-data">
      <div class="app-icon-inline">
        <img :src="icon || fallbackIcon" :alt="`Icono de ${row.name}`" :title="row.name" />
      </div>
      <span class="app-name" :title="row.name">{{ row.name }}</span>
      <div class="display">{{ formattedTime }}</div>
      <span
        class="status-indicator"
        :aria-label="row.state === 'running' ? 'Contando' : 'En pausa'"
        role="status"
      >
        <font-awesome-icon :icon="row.state === 'running' ? 'play' : 'pause'" />
      </span>
    </div>
    <button class="stop-button" @click="$emit('stop', row.appId)" title="Detener">
      <font-awesome-icon icon="square" />
    </button>
  </div>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faPlay, faPause, faSquare } from '@fortawesome/free-solid-svg-icons'
import { library } from '@fortawesome/fontawesome-svg-core'
import { msToHHMMSS } from '@/utils/time-format.js'

library.add(faPlay, faPause, faSquare)

// Componente de presentación pura (D12): sin data() de estado propio, sin
// timers, sin IPC directo. Recibe la fila y el ícono ya resueltos, emite una
// única intención (`stop`).
export default {
  name: 'AppRow',
  components: { FontAwesomeIcon },
  props: {
    row: { type: Object, required: true },
    icon: { type: String, default: null },
  },
  emits: ['stop'],
  data() {
    return {
      fallbackIcon: require('@/assets/idk.png'),
    }
  },
  computed: {
    formattedTime() {
      return msToHHMMSS(this.row.elapsedMs)
    },
  },
}
</script>

<style scoped>
.app-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
}

.row-data {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.app-row.paused .row-data {
  opacity: 0.55;
}

.app-icon-inline {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.app-icon-inline img {
  width: 100%;
  height: 100%;
  filter: grayscale(1);
}

.app-name {
  margin-left: 0.5rem;
  width: 8ch;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #f0f0f0;
}

.display {
  display: inline;
  font-size: 2rem;
  width: 8ch;
  margin: 0 0 0 0.5rem;
  user-select: none;
  color: #f0f0f0;
}

.status-indicator {
  font-size: 0.75rem;
  color: #f0f0f0;
  pointer-events: none;
  cursor: default;
}

.stop-button {
  background: none;
  border: none;
  cursor: pointer;
  margin: 0 0 0 0.75rem;
  padding: 0.5rem 1rem;
  font-size: 1.1rem;
  color: #f0f0f0;
  transition: transform 0.2s ease-in-out;
  flex-shrink: 0;
}

.stop-button:hover {
  transform: scale(1.2);
}

.stop-button:focus {
  outline: none;
}
</style>
