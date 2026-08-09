<!-- eslint-disable vue/no-multiple-template-root -->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content opciones-content">
      <h3>Opciones</h3>
      <div class="volume-control">
        <label for="master-volume">Volumen general</label>
        <input
          id="master-volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="settingsStore.masterVolume"
          @input="settingsStore.setMaster(Number($event.target.value))"
        />
      </div>
      <div class="volume-control">
        <label for="interaction-volume">Volumen de sonidos de interacción</label>
        <input
          id="interaction-volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="settingsStore.interactionVolume"
          @input="settingsStore.setInteraction(Number($event.target.value))"
        />
      </div>
      <div class="setting-control">
        <label for="time-format">Formato de hora</label>
        <select
          id="time-format"
          :value="settingsStore.timeFormat"
          @change="settingsStore.setTimeFormat($event.target.value)"
        >
          <option value="24h">24 horas</option>
          <option value="12h">12 horas</option>
        </select>
      </div>
      <div class="setting-control">
        <label for="startup-visibility">Al arrancar</label>
        <select
          id="startup-visibility"
          :value="settingsStore.startupVisibility"
          @change="settingsStore.setStartupVisibility($event.target.value)"
        >
          <option value="window">Mostrar la ventana</option>
          <option value="tray">Solo en la bandeja</option>
        </select>
        <small>
          Aplica a todo arranque de la aplicación, incluido el arranque
          automático con el inicio de sesión de Windows.
        </small>
      </div>
      <button class="close-btn" @click="$emit('close')">Cerrar</button>
    </div>
  </div>
</template>

<script>
import { useSettingsStore } from '@/stores/settings'

export default {
  name: 'OpcionesPanel',
  emits: ['close'],
  data() {
    return {
      settingsStore: useSettingsStore(),
    }
  },
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-content {
  background-color: #444;
  color: #fff;
  padding: 20px;
  border-radius: 8px;
  width: 300px;
  max-height: 80%;
  overflow-y: auto;
  outline: none;
}
.opciones-content h3 {
  margin-top: 0;
  text-align: center;
}
.volume-control,
.setting-control {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.volume-control label,
.setting-control label {
  font-size: 0.9rem;
}
.setting-control small {
  font-size: 0.75rem;
  color: #bbb;
}
.volume-control input[type='range'],
.setting-control input[type='range'] {
  width: 100%;
}
.close-btn {
  margin-top: 10px;
  width: 100%;
  background: #222;
  border: none;
  color: #fff;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
}
.close-btn:hover {
  background: #333;
}
</style>
