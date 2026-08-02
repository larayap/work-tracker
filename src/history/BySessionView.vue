<template>
  <ul class="session-timeline">
    <li
      v-for="block in blocks"
      :key="block.type === 'session' ? block.entry.id : block.groupId"
      class="timeline-block"
    >
      <div v-if="block.type === 'session'" class="session-line">
        <span class="entry-name">{{ block.entry.sessionName || block.entry.app }}</span>
        <span class="entry-range">{{ formatRange(block.entry) }}</span>
        <span class="entry-duration">{{ formatDuration(block.entry.durationMs) }}</span>
      </div>
      <div v-else class="group-block">
        <div class="group-line">
          <span class="entry-name">{{ block.groupName || 'Grupo sin nombre' }}</span>
          <span class="entry-duration">{{ formatDuration(block.durationMs) }}</span>
        </div>
        <ul class="group-members">
          <li v-for="member in block.members" :key="member.id" class="member-line">
            <span class="entry-name">{{ member.sessionName || member.app }}</span>
            <span class="entry-range">{{ formatRange(member) }}</span>
            <span class="entry-duration">{{ formatDuration(member.durationMs) }}</span>
          </li>
        </ul>
      </div>
    </li>
  </ul>
</template>

<script>
import { buildDayTimeline } from '@/utils/session-aggregate.js'
import { msToHHMMSS, formatTimeHHMMSS } from '@/utils/time-format.js'

// Componente de presentación pura (D-10): recibe las entradas del día ya
// filtradas por prop, sin IPC propio. Usa `buildDayTimeline` para el orden
// cronológico y el colapso de grupos en un único bloque (D-3: el total del
// grupo es la suma de sus miembros, nunca reloj de pared).
export default {
  name: 'BySessionView',
  props: {
    entries: { type: Array, required: true },
  },
  computed: {
    blocks() {
      return buildDayTimeline(this.entries)
    },
  },
  methods: {
    formatDuration(ms) {
      return msToHHMMSS(ms)
    },
    formatRange(entry) {
      return `${formatTimeHHMMSS(new Date(entry.startedAt))}–${formatTimeHHMMSS(new Date(entry.endedAt))}`
    },
  },
}
</script>

<style scoped>
.session-timeline {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0 0;
}

.timeline-block {
  border-bottom: 1px solid #333;
  padding: 0.5rem 0;
}

.session-line,
.group-line,
.member-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #fff;
  font-size: 0.85rem;
}

.group-line {
  font-weight: bold;
}

.entry-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-range {
  color: #bdbdbd;
  font-size: 0.75rem;
}

.group-members {
  list-style: none;
  margin: 0.3rem 0 0 0.8rem;
  padding: 0;
}

.member-line {
  padding: 0.2rem 0;
  opacity: 0.85;
}
</style>
