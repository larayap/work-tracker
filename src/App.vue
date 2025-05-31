<template>
  <div id="allContainer">
    <div class="titlebar-wrapper">
      <TitleBar 
        :show-manual="showManual"
        :show-aplicacion="showAplicacion"
        :show-pomodoro="showPomodoro"
        @toggle-manual="showManual = $event"
        @toggle-aplicacion="showAplicacion = $event"
        @toggle-pomodoro="showPomodoro = $event"
      />
    </div>
    <div class="menu-scrollable">
      <Menu 
      :show-manual="showManual"
      :show-aplicacion="showAplicacion"
      :show-pomodoro="showPomodoro"
      @toggle-manual="showManual = $event"
      @toggle-aplicacion="showAplicacion = $event"
      @toggle-pomodoro="showPomodoro = $event"
      />
    </div>
  </div>
</template>

<script>
import Menu from './components/Menu.vue'
import TitleBar from './components/TitleBar.vue'

export default {
  name: 'App',
  components: {
    Menu,
    TitleBar,
  },
  data() {
    return {
      showManual: false,
      showAplicacion: false,
      showPomodoro: false,
    }
  },
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Russo+One&display=swap');

html, body {
  font-family: "Architects Daughter", cursive;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
#app {
  font-family: "Architects Daughter", cursive;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #e7e7e7;

}
#allContainer {
  /* 100vh hace que #allContainer ocupe el 100% de la altura de la ventana de la app */
  height: 100vh;

  /* Flex column: TitleBar arriba (no scroll), Menu abajo (scroll) */
  display: flex;
  flex-direction: column;
}


.menu-scrollable {
  overflow-y: auto;
  overflow-x: hidden;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
}

.menu-scrollable::-webkit-scrollbar {
  width: 0px;
}


</style>
