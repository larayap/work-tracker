<template>
    <div class="duration-tile" @click="handleClick">
      <div class="duration-number">{{ time }}</div>
      <div class="duration-label">{{ label }}</div>
    </div>
  </template>
  
  <script>
  export default {
    name: 'DurationTile',
    props: {
      time: {
        type: Number,
        default: 25
      },
      label: {
        type: String,
        default: 'POMODORO'
      }
    },
    emits: ['click'],
    setup(props, { emit }) {
      const handleClick = () => {
        // Dispara un evento para que el padre abra un modal, o
        // simplemente muestre UI de edición
        emit('click')
      }
      
      return { handleClick }
    }
  }
  </script>
  
  <style scoped>
  .duration-tile {
    background-color: #444;
    color: #fff;
    width: 90px;
    height: 90px;
    margin: 10px;
    border-radius: 10px;
    /* Centramos contenido */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    transition: transform 0.2s;
  }
  
  .duration-tile:hover {
    transform: translateY(-2px);
  }
  
  .duration-number {
    font-size: 1.8em; /* número grande */
    font-weight: bold;
    margin-bottom: 5px;
  }
  
  .duration-label {
    font-size: 0.8em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.8;
  }
  </style>
  