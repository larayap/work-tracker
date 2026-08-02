---
type: project-profile
updated: "2026-08-01"
---

# cronometro-app

Aplicación de escritorio (Electron + Vue 3) para cronometrar el tiempo dedicado a
programas/aplicaciones, con modos manual y Pomodoro, historial de sesiones y sonidos
de interacción.

## Stack

- **Lenguaje**: JavaScript (ES2020 fuente, target `es5` vía Babel — ver `jsconfig.json` y `babel.config.cjs`). Sin TypeScript.
- **Framework**: Vue 3.2 (Options/Composition mixto, SFCs `.vue`) sobre Electron 13. Empaquetado dual: `vue-cli-plugin-electron-builder` (`electron:build`/`electron:serve`) y `@electron-forge/cli` 7.7 (`start`/`package`/`make`) conviven en `package.json` — revisar en `sdd-explore` cuál es el flujo activo real.
- **Estado**: Pinia 3 (`src/stores/menu.js`).
- **Routing**: vue-router 4 (multi-entry: `index.html` y `history.html` vía `pages` de `vue.config.js`).
- **UI/Interacción**: `@fortawesome/vue-fontawesome` (íconos), `vuedraggable` 4 y `@shopify/draggable` (drag & drop, coexisten), `fluid-dnd` (dependencia local vía `file:`), `v-calendar` 3 y `vue3-datepicker` (selección de fechas en historial).
- **Audio**: `howler` 2 (sonidos de interacción en `src/plugins/sound.js` y `src/sounds/*.mp3`).
- **Detección de procesos**: `active-win` 8 (ya presente en dependencias — candidato natural para las features de detección/logos/multi-programa de este cambio).
- **Test runner**: no detectado. No hay `jest.config.*`, `vitest.config.*` ni scripts de test en `package.json`.
- **Linter**: ESLint 7 + `eslint-plugin-vue` 8 (`plugin:vue/vue3-essential` en `package.json`, `plugin:vue/essential` en `.eslintrc.js` — configs levemente inconsistentes entre sí), parseo vía `vue-eslint-parser` + `@babel/eslint-parser`.
- **Build/bundler**: Vue CLI Service 5 (webpack por debajo). `vue.config.js` define `externals: { electron: 'require("electron")' }` y `resolve.fallback.fs = false` (polyfills de Node deshabilitados/parciales, browserify-* como devDependencies).
- **CI**: no detectado. No existe `.github/workflows/` ni `.gitlab-ci.yml` en el repo.

## Convenciones

- **Commits**: mensajes cortos en minúsculas, imperativo/descriptivo, sin prefijo Conventional Commits estricto observado en `git log` del repo principal (ej. "fix endSession sound", "add sounds"). El pipeline SDD debe producir commits en Conventional Commits en inglés según instrucciones globales del usuario, aun si el historial previo no lo sigue.
- **Branches**: sin convención previa observable (repo trabajaba directo sobre `main`). Este cambio introduce `feature/{change-name}` como convención SDD.
- **PR base**: `main`.

## Notas del proyecto

- Los logos de programas monitoreados hoy se cargan manualmente como imágenes estáticas en `src/assets/*.png` (ej. `Blender.png`, `CLIP STUDIO PAINT.png`, `Google Chrome.png`, `VEGAS Pro.png`) — confirma el punto 1 del intent de este cambio (automatizar la obtención de logos).
- `src/components/CronometroAplicacion.vue` es el componente de cronómetro por aplicación; `src/utils/stateManager.js` gestiona persistencia de estado; ambos son puntos de entrada probables para las features de detección/multi-programa/pausa.
- No hay tests automatizados en el proyecto — `sdd-verify` deberá definir estrategia de verificación (manual/exploratoria o introducir test runner) para este cambio.
- Dependencia `fluid-dnd` apunta a un `.tgz` local fuera del repo (`file:../draggapleFluid/...`) — riesgo de reproducibilidad en otros entornos, registrado como observación.
