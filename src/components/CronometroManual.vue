<template>
    <div class="cronometro">
      <h1 class="module-title">
        <img src="@/assets/icon-manual.svg" alt="" class="module-icon" />
        Manual
      </h1>
      <div class="display">{{ formattedTime }}</div>
      <div class="controls">
        <button @click="toggle">
          <font-awesome-icon :icon="running ? 'pause' : 'play'" />
        </button>
        <button @click="reset">
          <font-awesome-icon icon="square" />
        </button>
      </div>
    </div>
  </template>
  
  <script>
  import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
  import { faPlay, faPause, faSquare } from '@fortawesome/free-solid-svg-icons'
  import { library } from '@fortawesome/fontawesome-svg-core'

  library.add(faPlay, faPause, faSquare)
  
  export default {
    name: 'CronometroComponent',
    data() {
      return {
        time: 0,          // Tiempo en milisegundos
        intervalId: null, // ID del intervalo
        running: false,    // Indica si está corriendo
      }
    },
    components: { FontAwesomeIcon },
    computed: {
      formattedTime() {
        // Calcula horas, minutos, segundos y centésimas de segundo
        const seconds = Math.floor((this.time / 1000) % 60)
        const minutes = Math.floor((this.time / (1000 * 60)) % 60)
        const hours = Math.floor(this.time / (1000 * 60 * 60))
        
        // Formatea con ceros a la izquierda
        const pad = num => num < 10 ? '0' + num : num
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      }
    },
    methods: {
      playSound(refName) {
        // clona la etiqueta <audio> y la dispara
        const snd = this.$refs[refName].cloneNode()
        snd.play().catch(()=>{})
      },
      start() {
        this.$playSound('pressButton')
        if (!this.running) {
          this.running = true
          const startTime = Date.now() - this.time
          this.intervalId = setInterval(() => {
            this.time = Date.now() - startTime
          }, 10) // Actualiza cada 10ms para mostrar centésimas
        }
      },
      pause() {
        this.$playSound('pressButton')
        this.running = false
        clearInterval(this.intervalId)
      },
      reset() {
        this.$playSound('pressButton')
        this.running = false
        clearInterval(this.intervalId)
        this.time = 0
      },
      toggle() {
        this.running ? this.pause() : this.start()
      },
    },
    beforeDestroy() {
      clearInterval(this.intervalId)
    }
  }
  </script>
  
  <style scoped>
  .cronometro {
    text-align: center;
    margin: 0;
  }
  /* Mismo encabezado que Work Tracker y Pomodoro: icono y nombre en una fila.
     `justify-content` centra el par dentro del módulo, porque acá el encabezado no
     comparte fila con botones que lo empujen a un costado. */
  .module-title {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }
  .module-icon {
    height: 20px;
    max-width: 20px;
    object-fit: contain;
  }
  .display {
    font-size: 2rem;
    margin: 0 0 8px;
  }
  .controls button {
    background: none;
    border: none;
    cursor: pointer;
    margin: 0;
    padding: 0 1rem;
    font-size: 1.5rem;
    color: #f0f0f0;
    transition: transform 0.2s ease-in-out;
    }

    .controls button:hover {
      transform: scale(1.2);
    }

  </style>
  