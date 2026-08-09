<template>
  <div class="cronometro">
    <div class="header-wrapper">
      <button class="button-history" @click="openHistoryWindow()" title="Ver historial">
        <font-awesome-icon icon="bars" />
      </button>
      <h1 class="module-title">
        <img src="@/assets/work_worktracker.webp" alt="" class="module-icon" />
        Work Tracker
      </h1>
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

    <!-- Filas sueltas (D-1/multiple-simultaneous-groups): array local derivado
         del snapshot por el `watch` de más abajo, suspendido mientras
         `isDragging` está activo — el snapshot que llega durante el gesto se
         guarda en `pendingRows`, nunca se descarta. `vuedraggable` muta este
         array de forma optimista durante el gesto; al terminar, `applyRows`
         lo reconstruye desde el estado autoritativo del main. -->
    <draggable
      v-model="dragUngrouped"
      class="drag-list"
      group="monitored-rows"
      item-key="appId"
      @start="onDragStart"
      @end="onDragEnd"
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

    <!-- N contenedores de grupo (D-1): un `<draggable>` por grupo, en el
         orden de primera aparición de cada `groupId` en `rows`. Cada
         cabecera y cada handler de `@change` usa `group.groupId` — nunca una
         variable de componente única — así que renombrar o agrupar sobre un
         grupo no altera a los demás. -->
    <div v-for="group in dragGroups" :key="group.groupId" class="group-container">
      <draggable
        v-model="group.rows"
        class="drag-list"
        group="monitored-rows"
        item-key="appId"
        @start="onDragStart"
        @end="onDragEnd"
        @change="onGroupDragChange($event, group.groupId)"
      >
        <template #header>
          <div class="group-header">
            <input
              v-if="editingGroupId === group.groupId"
              ref="groupNameInput"
              v-model="draftGroupName"
              class="group-name-input"
              @keyup.enter="confirmGroupName(group)"
              @keyup.esc="cancelGroupName"
              @blur="cancelGroupName"
              @click.stop
            />
            <span v-else class="group-name" @click="startEditGroupName(group)">
              {{ group.groupName || 'Grupo sin nombre' }}
            </span>
          </div>
        </template>
        <template #item="{ element }">
          <AppRow
            :row="element"
            :icon="monitoredApps.icons[element.exePath]"
            @stop="monitoredApps.stopRow(element.appId)"
          />
        </template>
      </draggable>
    </div>

    <!-- Franja permanente de creación (D-1): `dragNewGroup` SIEMPRE vacío —
         un `<div>` a secas no es zona de drop de SortableJS, tiene que ser
         una lista del mismo `group`. Sin `@start`/`@end` propios: nunca
         origina un arrastre porque está vacía, esos eventos los emite la
         lista de origen. Visible con al menos una fila suelta o durante
         cualquier arrastre, para no desmontarse bajo el cursor si el gesto
         vacía el listado suelto. -->
    <div v-if="dragUngrouped.length >= 1 || isDragging" class="group-container">
      <draggable
        v-model="dragNewGroup"
        class="drag-list new-group-list"
        group="monitored-rows"
        item-key="appId"
        @change="onNewGroupDragChange"
      >
        <template #header>
          <div class="group-strip">Arrastrá aquí para agrupar</div>
        </template>
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
      // Grupos por arrastre (D-1/multiple-simultaneous-groups): arrays
      // locales derivados del snapshot, nunca la fuente de verdad — el main
      // lo es (ADR-0002). `dragGroups` es una colección derivada de N
      // grupos `{ groupId, groupName, rows }`, uno por `<draggable>`.
      dragUngrouped: [],
      dragGroups: [],
      dragNewGroup: [], // SIEMPRE vacío: modelo de la franja de creación
      isDragging: false, // guarda ÚNICA a nivel de componente
      pendingRows: null, // snapshot llegado durante un arrastre, a aplicar al terminar
      pendingIntent: false, // este gesto ya emitió una intención por IPC
      editingGroupId: null, // reemplaza al booleano editingGroupName
      draftGroupName: '',
    }
  },
  created() {
    this.monitoredApps.init()
  },
  watch: {
    'monitoredApps.rows'(rows) {
      rows.forEach((row) => this.monitoredApps.ensureIcon(row.exePath))

      // Guarda de arrastre (D-1): un snapshot llegando en medio de un gesto
      // se guarda en `pendingRows`, nunca se descarta — con N contenedores
      // la ventana de un snapshot perdido (≤1s) es más cara: puede mostrar
      // una fila ya cerrada por el motor dentro de un grupo.
      if (this.isDragging) {
        this.pendingRows = rows
        return
      }
      this.applyRows(rows)
    },
  },
  methods: {
    openHistoryWindow() {
      ipcRenderer.send('open-history-window')
    },
    // Reconstrucción atómica (D-1): recorre `rows` una sola vez, arma todo
    // en locales y recién al final asigna — nunca una reconstrucción parcial
    // "grupo por grupo", que dejaría al `v-for` mostrando una mezcla de dos
    // snapshots distintos.
    applyRows(rows) {
      const nextUngrouped = []
      const byId = new Map()
      const nextGroups = []
      rows.forEach((row) => {
        if (!row.groupId) {
          nextUngrouped.push(row)
          return
        }
        let group = byId.get(row.groupId)
        if (!group) {
          group = { groupId: row.groupId, groupName: row.groupName, rows: [] }
          byId.set(row.groupId, group)
          nextGroups.push(group)
        }
        group.rows.push(row)
      })
      this.dragUngrouped = nextUngrouped
      this.dragGroups = nextGroups
    },
    // Guarda de arrastre de tres reglas (D-1, mitigación de R2):
    // 1) una sola bandera a nivel de componente, nunca una por lista —
    //    SortableJS emite `start`/`end` en la instancia de origen del gesto
    //    exactamente una vez cada uno.
    onDragStart() {
      this.isDragging = true
    },
    onDragEnd() {
      this.isDragging = false
      // 3) si el gesto ya emitió una intención (`@change` corre antes que
      //    `@end`), el snapshot pendiente es anterior a esa intención:
      //    aplicarlo devolvería la fila a su origen por un frame. Se
      //    descarta — el snapshot correcto ya viene en camino.
      if (this.pendingIntent) {
        this.pendingIntent = false
        return
      }
      // 2) si no hubo intención, se aplica el snapshot pendiente (llegó
      //    durante el gesto), fuera del despacho de eventos de SortableJS.
      if (!this.pendingRows) return
      const rows = this.pendingRows
      this.pendingRows = null
      this.$nextTick(() => this.applyRows(rows))
    },
    // onUngroupedDragChange/onGroupDragChange/onNewGroupDragChange traducen
    // el gesto a una intención (D-1): `evt.added` en la lista destino es lo
    // único que importa — el `evt.removed` de la lista origen del mismo
    // gesto no necesita acción propia, ya cubierto por el `added` de la
    // otra lista. Marcan `pendingIntent` y limpian `pendingRows` ANTES de
    // emitir la intención por IPC, porque `@change` corre antes que `@end`.
    onUngroupedDragChange(evt) {
      if (!evt.added) return
      this.pendingIntent = true
      this.pendingRows = null
      this.monitoredApps.setRowGroup(evt.added.element.appId, null)
    },
    onGroupDragChange(evt, groupId) {
      if (!evt.added) return
      this.pendingIntent = true
      this.pendingRows = null
      this.monitoredApps.setRowGroup(evt.added.element.appId, groupId)
    },
    onNewGroupDragChange(evt) {
      if (!evt.added) return
      this.pendingIntent = true
      this.pendingRows = null
      this.monitoredApps.setRowGroup(evt.added.element.appId, this.generateGroupId())
      this.dragNewGroup = []
    },
    generateGroupId() {
      return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    },
    startEditGroupName(group) {
      this.draftGroupName = group.groupName || ''
      this.editingGroupId = group.groupId
      // Trampa de Vue 3: un `ref` declarado dentro de un `v-for` se registra
      // como array, aunque un `v-if` deje un solo elemento renderizado.
      this.$nextTick(() => {
        const el = this.$refs.groupNameInput
        const input = Array.isArray(el) ? el[0] : el
        if (input) input.focus()
      })
    },
    confirmGroupName(group) {
      this.monitoredApps.renameGroup(group.groupId, this.draftGroupName)
      this.editingGroupId = null
    },
    cancelGroupName() {
      this.editingGroupId = null
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
.module-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.module-icon {
  height: 20px;
  max-width: 20px;
  object-fit: contain;
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

/* La etiqueta de invitación vive en el slot #header de este `<draggable>` (D-6),
   así que el nodo Sortable ya tiene alto propio y el `min-height` deja de crear
   área desde cero. Lo que preserva ahora es el área de destino por debajo de la
   etiqueta: el alto de la etiqueta (~31px) más los 40px que el bloque tenía como
   única superficie de drop antes de que la etiqueta entrara al nodo. */
.new-group-list {
  min-height: 72px;
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
