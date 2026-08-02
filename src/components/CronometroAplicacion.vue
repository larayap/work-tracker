<template>
  <div class="cronometro">
    <div class="header-wrapper">
      <button class="button-history" @click="openHistoryWindow()" title="Ver historial">
        <font-awesome-icon icon="bars" />
      </button>
      <h1 style="margin: 0;">Work</h1>
      <button
        class="button-add"
        @click="showSelector = true"
        :disabled="monitoredApps.limitReached"
        title="Agregar aplicación"
      >
        <font-awesome-icon icon="plus" />
      </button>
    </div>

    <!-- Estado vacío (empty-state): mismo reposo que hoy, sin mensaje ni ilustración -->
    <div v-if="monitoredApps.rows.length === 0" class="controls">
      <div class="display">00:00:00</div>
    </div>

    <!-- Filas sueltas (D-7/group-composition-and-drag): array local derivado
         del snapshot por el `watch` de más abajo, suspendido mientras
         `isDragging` está activo. `vuedraggable` muta este array de forma
         optimista durante el gesto; el próximo snapshot lo reconstruye desde
         el estado autoritativo del main. -->
    <draggable
      v-model="dragUngrouped"
      class="drag-list"
      group="monitored-rows"
      item-key="appId"
      @start="isDragging = true"
      @end="isDragging = false"
      @change="onUngroupedDragChange"
    >
      <template #item="{ element }">
        <AppRow
          :row="element"
          :icon="monitoredApps.icons[element.exePath]"
          @stop="monitoredApps.stopRow(element.appId)"
        />
      </template>
    </draggable>

    <!-- Contenedor de grupo: franja delgada con ≥2 filas sueltas, cabecera
         editable en cuanto recibe su primera fila (D-7). Un solo contenedor
         activo a la vez — el modelo (`groupId` por fila) soporta N grupos,
         el límite es de esta interfaz. -->
    <div v-if="showGroupContainer" class="group-container">
      <div v-if="dragGrouped.length === 0" class="group-strip">
        Arrastrá aquí para agrupar
      </div>
      <div v-else class="group-header">
        <input
          v-if="editingGroupName"
          ref="groupNameInput"
          v-model="draftGroupName"
          class="group-name-input"
          @keyup.enter="confirmGroupName"
          @keyup.esc="cancelGroupName"
          @blur="cancelGroupName"
          @click.stop
        />
        <span v-else class="group-name" @click="startEditGroupName">
          {{ activeGroupName || 'Grupo sin nombre' }}
        </span>
      </div>
      <draggable
        v-model="dragGrouped"
        class="drag-list"
        group="monitored-rows"
        item-key="appId"
        @start="isDragging = true"
        @end="isDragging = false"
        @change="onGroupDragChange"
      >
        <template #item="{ element }">
          <AppRow
            :row="element"
            :icon="monitoredApps.icons[element.exePath]"
            @stop="monitoredApps.stopRow(element.appId)"
          />
        </template>
      </draggable>
    </div>

    <AppSelectorModal v-if="showSelector" @close="showSelector = false" />
  </div>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faPlus, faBars } from '@fortawesome/free-solid-svg-icons'
import { library } from '@fortawesome/fontawesome-svg-core'
import draggable from 'vuedraggable'
import { useMonitoredAppsStore } from '@/stores/monitoredApps'
import AppRow from '@/components/AppRow.vue'
import AppSelectorModal from '@/components/AppSelectorModal.vue'
const { ipcRenderer } = window.require('electron')

library.add(faPlus, faBars)

export default {
  name: 'CronometroComponent',
  components: { FontAwesomeIcon, AppRow, AppSelectorModal, draggable },
  data() {
    return {
      monitoredApps: useMonitoredAppsStore(),
      showSelector: false, // Mostrar AppSelectorModal
      // Grupos por arrastre (D-7): arrays locales derivados del snapshot,
      // nunca la fuente de verdad — el main lo es (ADR-0002).
      dragUngrouped: [],
      dragGrouped: [],
      activeGroupId: null,
      activeGroupName: null,
      isDragging: false,
      editingGroupName: false,
      draftGroupName: '',
    }
  },
  computed: {
    // La franja aparece con ≥2 filas sueltas; la cabecera (con miembros) se
    // sostiene sola aunque el listado suelto baje de 2.
    showGroupContainer() {
      return this.dragGrouped.length > 0 || this.dragUngrouped.length >= 2
    },
  },
  created() {
    this.monitoredApps.init()
  },
  watch: {
    'monitoredApps.rows'(rows) {
      rows.forEach((row) => this.monitoredApps.ensureIcon(row.exePath))

      // Guarda `isDragging` (D-7): un snapshot llegando en medio de un
      // arrastre no debe pisar los arrays locales que `vuedraggable` está
      // mutando en ese instante — la reconstrucción pendiente se aplica
      // recién cuando el gesto termina (`@end`).
      if (this.isDragging) return

      this.dragUngrouped = rows.filter((row) => !row.groupId)
      const grouped = rows.filter((row) => row.groupId)
      this.dragGrouped = grouped
      this.activeGroupId = grouped.length > 0 ? grouped[0].groupId : null
      this.activeGroupName = grouped.length > 0 ? grouped[0].groupName : null
    },
  },
  methods: {
    openHistoryWindow() {
      ipcRenderer.send('open-history-window')
    },
    // onUngroupedDragChange/onGroupDragChange traducen el gesto a una
    // intención (D-7): `evt.added` en la lista destino es lo único que
    // importa — el `evt.removed` de la lista origen del mismo gesto no
    // necesita acción propia, ya cubierto por el `added` de la otra lista.
    onUngroupedDragChange(evt) {
      if (!evt.added) return
      this.monitoredApps.setRowGroup(evt.added.element.appId, null)
    },
    onGroupDragChange(evt) {
      if (!evt.added) return
      const groupId = this.activeGroupId || this.generateGroupId()
      this.monitoredApps.setRowGroup(evt.added.element.appId, groupId)
    },
    generateGroupId() {
      return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    },
    startEditGroupName() {
      this.draftGroupName = this.activeGroupName || ''
      this.editingGroupName = true
      this.$nextTick(() => this.$refs.groupNameInput && this.$refs.groupNameInput.focus())
    },
    confirmGroupName() {
      if (this.activeGroupId) {
        this.monitoredApps.renameGroup(this.activeGroupId, this.draftGroupName)
      }
      this.editingGroupName = false
    },
    cancelGroupName() {
      this.editingGroupName = false
    },
  },
}
</script>

<style scoped>
.cronometro {
  position: relative;
  text-align: center;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;

}
.header-wrapper {
  display: flex;
  position: relative;
  width: 100%;
  justify-content: center;
}
.display {
  display: inline;
  font-size: 2rem;
  width: 8ch;
  margin: 0;
  user-select: none;
}

.button-history {
  position: absolute;
  left: 0;
  top: 0;
  background-color: transparent;
  color: #f0f0f0;
  font-size: 1.1rem;    /* Tamaño del icono */
  border: none;
  cursor: pointer;
  transition: transform 0.3s ease-in-out;
}
.button-history:hover {

  color: #d3d3d3;

}

.button-add {
  position: absolute;
  right: 0;
  top: 0;
  background-color: transparent;
  color: #f0f0f0;
  font-size: 1.1rem;
  border: none;
  cursor: pointer;
  transition: transform 0.3s ease-in-out;
}
.button-add:hover:not(:disabled) {
  color: #d3d3d3;
}
.button-add:disabled {
  opacity: 0.4;
  cursor: default;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
}

.selected-app {
  margin-top: 1rem;
  font-size: 1rem;
  color: #f0f0f0;
}

.drag-list {
  width: 100%;
}

.group-container {
  width: 100%;
  margin-top: 0.4rem;
  border: 1px dashed rgba(240, 240, 240, 0.3);
  border-radius: 6px;
}

.group-strip {
  padding: 0.5rem;
  font-size: 0.75rem;
  color: rgba(240, 240, 240, 0.6);
  text-align: center;
}

.group-header {
  padding: 0.3rem 0.5rem;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px 6px 0 0;
}

.group-name {
  font-size: 0.85rem;
  color: #f0f0f0;
  cursor: text;
}

.group-name-input {
  font: inherit;
  font-size: 0.85rem;
  width: 100%;
  box-sizing: border-box;
  border: none;
  border-radius: 2px;
  padding: 0 2px;
}
</style>
