<template>
  <div id="menuContainer" class="Menu">
    <h1 v-if="showMenu">Menú cronometros</h1>
    <div v-if="showMenu" id="menu">
      <label>
        <input type="checkbox" v-model="selected" :value="1">
        Manual
      </label>
      <label>
        <input type="checkbox" v-model="selected" :value="2">
        Aplicación
      </label>
      <label>
        <input type="checkbox" v-model="selected" :value="3">
        Pomodoro
      </label>
      <button @click="aplicarSeleccion">Aplicar</button>
    </div>

    <!-- <div id="contenedorComponentes">
      <div v-if="applied.includes(1)" id="componente1" class="componente">
        <CronometroManual />
      </div>
      <div v-if="applied.includes(2)" id="componente2" class="componente cronometroAplicacion">
        <CronometroAplicacion />
      </div>
      <div v-if="applied.includes(3)" id="componente3" class="componente">
        <CronometroPomodoro />
      </div>
    </div> -->
    <div id="contenedorComponentes">
      <draggable v-model="applied" item-key="id" animation="200" chosen-class="drag-chosen" ghost-class="drag-ghost">
        <template #item="{ element }">
          <div class="componente">
            <!-- usa element.id para elegir el componente -->
            <component :is="getComponent(element.id)" :key="element.id" />
          </div>
        </template>
      </draggable>

    </div>
  </div>
</template>

<script>
import draggable from 'vuedraggable';
import CronometroManual from './CronometroManual.vue';
import CronometroAplicacion from './CronometroAplicacion.vue';
import CronometroPomodoro from './CronometroPomodoro.vue';

const { remote } = require('electron')

export default {
  name: 'HelloWorld',
  components: {
    CronometroManual,
    CronometroAplicacion,
    CronometroPomodoro,
    draggable
  },
  data() {
    return {
      selected: [], // Almacena la selección actual de los checkboxes
      applied: [],   // Almacena la selección aplicada al pulsar "Aplicar"
      showMenu: true
    }
  },
  methods: {
    aplicarSeleccion() {
      // Copia la selección actual a la variable "applied"
      this.applied = this.selected.map(n => ({ id: n }));
      this.showMenu = false

      // Espera a que se renderice el contenido y mide sus dimensiones
      this.$nextTick(() => {
        const content = document.getElementById('allContainer')
        if (content) {
          let contentWidth = content.offsetWidth
          let contentHeight = content.offsetHeight
          remote.getCurrentWindow().setContentSize(contentWidth, contentHeight)
        }
      })
    },
    getComponent(id) {
      switch (id) {
        case 1:
          return 'CronometroManual';
        case 2:
          return 'CronometroAplicacion';
        case 3:
          return 'CronometroPomodoro';
        default:
          return null;
      }
    }
  }
}
</script>

<style scoped>

#menu {
  display: flex;
  flex-direction: column;
  align-items: center; /* Centra el conjunto de opciones en el contenedor */
  gap: 10px;
  margin-bottom: 20px;
  width: 100%; /* Puedes ajustar este valor según necesites */
}
#menu label {
  display: block;
  width: 120px; /* Ancho fijo para que todas empiecen en la misma posición */
  text-align: left;
}
#menu button {
  margin-top: 10px;
}
.componente {
  border: 1px solid #ccc;
  margin: 10px 0;
  padding: 5px;
  cursor: grab;
}
.componente:active {
  cursor: grabbing;
}
.cronometroAplicacion {
  position: relative;
}
.drag-chosen {
  opacity: 1 !important;
}
.drag-ghost {
  opacity: 0 !important;
}
</style>
