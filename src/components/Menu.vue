<template>
  <div id="menuContainer" class="Menu">
    <div v-if="showMenu" class="menu-container">
      <h1 class="menu-title">Inicio</h1>
      <h2>Apps para usar:</h2>
      <div class="menu-options">
        <div
          v-for="opt in options"
          :key="opt.value"
          class="option-card"
          :class="{ selected: appStore.selected.includes(opt.value) }"
          @click="toggleOption(opt.value)"
        >
          <span class="option-label">{{ opt.label }}</span>
        </div>
      </div>
      <button class="apply-btn" @click="aplicarSeleccion">
        <font-awesome-icon :icon="['far', 'circle-check']" />
      </button>
    </div>
    <div  v-if="!showMenu" id="contenedorComponentes">
      <draggable 
        v-model="applied" 
        item-key="id" 
        animation="200" 
        -class="drag-chosen" 
        ghost-class="drag-ghost" 
        @change="handleDragChange"
        class="draggable-container"
      >
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
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleCheck } from '@fortawesome/free-regular-svg-icons'
import { library } from '@fortawesome/fontawesome-svg-core'
import { useAppStore  }  from '@/stores/menu'
import CronometroManual from './CronometroManual.vue';
import CronometroAplicacion from './CronometroAplicacion.vue';
import CronometroPomodoro from './CronometroPomodoro.vue';

library.add(faCircleCheck)

const { remote } = require('electron')

export default {
  name: 'HelloWorld',
  components: {
    CronometroManual,
    CronometroAplicacion,
    CronometroPomodoro,
    draggable,
    FontAwesomeIcon
  },
  data() {
    return {
      applied: [],   // Almacena la selección aplicada al pulsar "Aplicar"
      showMenu: true,
       options: [
        { value: 1, label: 'M' },
        { value: 2, label: 'A' },
        { value: 3, label: 'P' },
      ],
      appStore: useAppStore(),
      lastAppliedSize: { ancho: 0, alto: 0 }, // guarda antibucle del ResizeObserver (D13)
      resizeObserver: null,
    }
  },
  created() {
    this.applied = this.appStore.selected.map(id => ({ id }))
  },
  mounted() {
    // Filas que entran y salen solas (motor de monitoreo) son una causa de
    // cambio de alto que ningún gesto del usuario acompaña (D13): se observa
    // el contenedor y se recalcula ante cualquier cambio, venga de donde
    // venga.
    const menuEl = document.getElementById('menuContainer')
    if (menuEl) {
      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => this.resizeWindow())
      })
      this.resizeObserver.observe(menuEl)
    }
  },
  beforeUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  },
  watch: {
    'appStore.selected'(nuevo) {
      this.applied = this.applied.filter(item => nuevo.includes(item.id))
      nuevo.forEach(id => {
        if (!this.applied.find(x => x.id === id)) {
          this.applied.push({ id })
        }
      })
      this.resizeWindow()
    }
  },
  methods: {
    toggleOption(val) {
      this.$playSound('pressButton')
       this.appStore.toggleOption(val)
    },
    handleDragChange() {
      this.$playSound('popUp')
    },
    aplicarSeleccion() {
      this.$playSound('pressButton')
      this.applied = this.appStore.selected.map(n => ({ id: n }))
      this.showMenu = false
      this.resizeWindow()
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
    },
    // Única implementación de la medición y el resize (D13): la invocan por
    // igual el gesto de aplicar selección, el arrastre de widgets y el
    // ResizeObserver de `mounted()`.
    resizeWindow() {
      this.$nextTick(() => {
        // 1) Mide la altura de tu TitleBar fija:
        const titleBarEl = document.querySelector('.titlebar-wrapper');
        const tituloAlto = titleBarEl ? titleBarEl.offsetHeight : 0;

        // 2) Mide TODO el contenido del menú (incluso lo que despertaría scroll):
        const menuEl = document.getElementById('menuContainer');
        if (!menuEl) return;

        // IMPORTANTE: scrollHeight = contenido total (visible + oculto por scroll)
        const menuTotalAlto = menuEl.scrollHeight;
        const menuTotalAncho = menuEl.scrollWidth;

        // 3) Altura total necesaria = altura del TitleBar + altura total del menú
        const altoDeseado = tituloAlto + menuTotalAlto;
        // 4) Ancho deseado (puede ser el mayor entre menuTotalAncho y el ancho de la TitleBar):
        const anchoDeseado = Math.max(menuTotalAncho, titleBarEl.offsetWidth);

        // Guarda antibucle (D13, riesgo de diseño): `setContentSize` cambia el
        // layout y puede reactivar al ResizeObserver. Solo se aplica cuando el
        // tamaño calculado difiere del último aplicado en más de 1px.
        const diffAncho = Math.abs(anchoDeseado - this.lastAppliedSize.ancho);
        const diffAlto = Math.abs(altoDeseado - this.lastAppliedSize.alto);
        if (diffAncho <= 1 && diffAlto <= 1) return;

        this.lastAppliedSize = { ancho: anchoDeseado, alto: altoDeseado };
        remote.getCurrentWindow().setContentSize(anchoDeseado, altoDeseado);
      });
    },
  }
}
</script>

<style scoped>
.menu-container {
  max-width: 280px;
  margin: auto;
  padding: 1rem;

}
.menu-title {
  font-size: 2.2em;
}
.menu-options {
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.option-card {
  flex: 1;
  padding: 0.75rem 0;
  font-size: 2em;
  text-align: center;
  border: 2px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-card:hover {
  border-color: #999;
  color: #999;
}

.option-card.selected {
  background: #6f6f6f;
  color: white;
}

.apply-btn {
  background: none;
  border: none;
  color: white;
  font-size: 2.2em;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.apply-btn:hover {
  color: #999;
}
h1 {
  margin: 0;
}
h2 {
  margin: 0 0 20px 0;
}

#menuContainer {
  padding: 10px 0 0 0; 
}
.componente {
  border: 1px solid #ccc;
  margin: 0;
  padding: 5px;
  cursor: grab;
  scroll-snap-align: start;
}
.draggable-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
