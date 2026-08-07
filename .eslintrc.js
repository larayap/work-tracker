module.exports = {
  root: true,
  env: {
    node: true,
  },
  "globals": {
    "__static": "readonly"
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    parser: '@babel/eslint-parser',
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended'
  ],
  rules: {
    // En Vue 3 el hook `beforeDestroy` de
    // src/components/CronometroManual.vue:76 no se registra:
    // @vue/runtime-core lo desestructura pero nunca lo pasa a
    // registerLifecycleHook, así que el clearInterval de ese componente
    // nunca corre al desmontar. Corregirlo (beforeDestroy -> beforeUnmount)
    // cambiaría el comportamiento de la aplicación, fuera del único ítem
    // para el que open-source-readiness relaja esa invariante (D-9/
    // ADR-0014). Queda como warning con el defecto real documentado, y el
    // fix pasa a issue de roadmap.
    'vue/no-deprecated-destroyed-lifecycle': 'warn'
  }
}