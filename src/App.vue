<template>
  <div id="allContainer">
    <TitleBar />
    <Menu />
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
  }
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
</style>
