<template>
  <div class="usage-chart">
    <div class="usage-chart-header">{{ label }}</div>
    <div class="usage-chart-viewport">
      <div class="usage-chart-inner" :style="{ height: containerHeight + 'px' }">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>

<script>
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import { aggregateByApp } from '@/utils/session-aggregate.js'
import { msToHHMMSS } from '@/utils/time-format.js'

// Registro explícito y mínimo (D-11, ADR-0010): sin `Legend` (un solo
// dataset) ni `Title` (la cabecera de acá arriba es HTML propio, más
// barata), sin `chart.js/auto`. Registrar de menos produce el error de
// runtime `"category" is not a registered scale`.
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

// Defaults globales fijados UNA sola vez (D-11): tema oscuro sin repetir
// opciones por gráfico. Efecto de módulo deliberado — este componente vive
// exclusivamente en el bundle de historial (ADR-0010), nunca en el de la
// ventana del cronómetro.
ChartJS.defaults.color = '#f0f0f0'
ChartJS.defaults.font.family = "'Architects Daughter', cursive"

const BAR_HEIGHT_PX = 28
const CONTAINER_MARGIN_PX = 24
const MIN_HEIGHT_PX = 80

export default {
  name: 'UsageChart',
  components: { Bar },
  props: {
    entries: { type: Array, required: true },
    label: { type: String, default: '' },
  },
  computed: {
    // El dataset sale de un `computed` sobre `aggregateByApp` (D-11): evita
    // el warning `Target is readonly` de `vue-chartjs` (no pasar un valor
    // reactivo de solo lectura directo).
    aggregated() {
      return aggregateByApp(this.entries)
    },
    chartData() {
      return {
        labels: this.aggregated.map((row) => row.app),
        datasets: [
          {
            label: 'Tiempo',
            data: this.aggregated.map((row) => row.durationMs),
            backgroundColor: '#6f6f6f',
          },
        ],
      }
    },
    chartOptions() {
      return {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { callback: (value) => msToHHMMSS(value) },
          },
          y: {
            grid: { display: false },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => msToHHMMSS(context.parsed.x),
            },
          },
        },
      }
    },
    // El alto real crece con la cantidad de aplicaciones (D-11): el
    // contenedor de afuera es el que scrollea, sin comprimir ni ocultar
    // ninguna barra, sin top-N ni categoría "Otras".
    containerHeight() {
      return Math.max(MIN_HEIGHT_PX, this.aggregated.length * BAR_HEIGHT_PX + CONTAINER_MARGIN_PX)
    },
  },
}
</script>

<style>
/* Sin `scoped`: un `@import` de fuente no se puede acotar a un componente.
   Mismo origen que ya carga `src/App.vue` para el resto de la app (D-11) —
   sin conexión, cae a la tipografía de respaldo declarada en `ChartJS.defaults`. */
@import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
</style>

<style scoped>
.usage-chart {
  width: 100%;
  margin-top: 1rem;
}

.usage-chart-header {
  font-size: 0.9rem;
  color: #f0f0f0;
  text-align: center;
  margin-bottom: 0.4rem;
}

.usage-chart-viewport {
  width: 100%;
  max-height: 320px;
  overflow-y: auto;
}

.usage-chart-inner {
  width: 100%;
  position: relative;
}
</style>
