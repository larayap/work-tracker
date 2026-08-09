<!-- eslint-disable vue/no-multiple-template-root -->
<template>
    <div id="custom-titlebar">
      <div class="window-controls">
        <button @click="minimizar">
          <font-awesome-icon :icon="['fas', 'window-minimize']" />
        </button>
        <button @click="cerrar">
          <font-awesome-icon :icon="['fas', 'x']" />
        </button>
      </div>
    </div>
  </template>
  
  <script>
  import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
  import { library } from '@fortawesome/fontawesome-svg-core'
  import { faWindowMinimize, faWindowMaximize, faWindowRestore, faX, faGear, faThumbtack, faThumbtackSlash } from '@fortawesome/free-solid-svg-icons'
  import { faRectangleXmark, faSquare } from '@fortawesome/free-regular-svg-icons'
  
  library.add(faWindowMinimize, faWindowMaximize, faWindowRestore, faRectangleXmark, faX, faSquare, faGear, faThumbtack, faThumbtackSlash)
  
  const { remote } = require('electron')
  
  export default {
    name: 'TitleBar',
    components: { FontAwesomeIcon },
    methods: {
      minimizar() {
        remote.getCurrentWindow().minimize()
      },
      cerrar() {
        remote.getCurrentWindow().close()
      },
    }
  }
  </script>
  
  <style scoped>
  #custom-titlebar {
    position: fixed;
    height: 30px;
    width: 100%;
    color: #fff;
    display: flex;
    align-items: center;
    -webkit-app-region: drag; /* region arrastrable */
    z-index: 9999;            /* por encima del contenido */
  }
  /* Contenedor de controles */
  .window-controls {
    margin-left: auto;         /* Empuja este contenedor a la derecha */
    display: flex;
    gap: 10px;                 /* Espacio entre botones (en lugar de margin-left en cada uno) */
  }


  .window-controls button {
    -webkit-app-region: no-drag;
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 16px;
    margin-left: 10px;
  }
  .window-controls button:hover,
  .setting-control button:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
  
  /* Estilos para el modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
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
  }
  .modal-content h3 {
    margin-top: 0;
    text-align: center;
  }
  .modal-content ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .modal-content li {
    padding: 8px;
    cursor: pointer;
  }
  .modal-content li.selected,
  .modal-content li:hover {
    background-color: rgba(255,255,255,0.3);
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
  