<template>
  <table class="log-table">
    <thead>
      <tr>
        <th>Tiempo</th>
        <th>App</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.appId">
        <td>{{ formatDuration(row.durationMs) }}</td>
        <td>{{ row.app }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script>
import { aggregateByApp } from '@/utils/session-aggregate.js'
import { msToHHMMSS } from '@/utils/time-format.js'

// Componente de presentación pura (D-10): recibe las entradas del día ya
// filtradas por prop, sin IPC propio — mismo criterio que `AppRow.vue`. Es
// la tabla que ya existía (colapso por programa), extraída del shell y
// reescrita sobre `aggregateByApp` en vez de un `grouped` reducido a mano.
export default {
  name: 'ByAppView',
  props: {
    entries: { type: Array, required: true },
  },
  computed: {
    rows() {
      return aggregateByApp(this.entries)
    },
  },
  methods: {
    formatDuration(ms) {
      return msToHHMMSS(ms)
    },
  },
}
</script>

<style scoped>
.log-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  table-layout: fixed;
}

.log-table thead th {
  background-color: #2a2a2a;
  color: #fff;
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #fff;
}

.log-table tbody td {
  background-color: #1b1b1b;
  color: #fff;
  padding: 0.75rem;
  border-bottom: 1px solid #333;
}

.log-table tbody tr:last-child td {
  border-bottom: none;
}
</style>
