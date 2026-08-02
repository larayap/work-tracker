---
type: project-profile
updated: "2026-08-02"
---

# cronometro-app

Aplicación de escritorio (Electron + Vue 3) para cronometrar el tiempo dedicado a
programas/aplicaciones, con modos manual y Pomodoro, historial de sesiones y sonidos
de interacción.

## Stack

- **Lenguaje**: JavaScript (ES2020 fuente, target `es5` vía Babel — ver `jsconfig.json` y `babel.config.cjs`). Sin TypeScript.
- **Framework**: Vue 3.2 (Options/Composition mixto, SFCs `.vue`) sobre Electron 13. Empaquetado dual: `vue-cli-plugin-electron-builder` (`electron:build`/`electron:serve`) y `@electron-forge/cli` 7.7 (`start`/`package`/`make`) conviven en `package.json` — revisar en `sdd-explore` cuál es el flujo activo real.
- **Estado**: Pinia 3 — 3 stores en `src/stores/` (`menu`, `monitoredApps`, `settings`), detalle en `## Arquitectura` más abajo.
- **Routing**: vue-router 4 (multi-entry: `index.html` y `history.html` vía `pages` de `vue.config.js`).
- **UI/Interacción**: `@fortawesome/vue-fontawesome` (íconos), `vuedraggable` 4 (drag & drop activo, usado en `Menu.vue`, `CronometroPomodoro.vue` y `CronometroAplicacion.vue` — este último agrega filas a grupos de sesión), `v-calendar` 3 y `vue3-datepicker` (selección de fechas en historial). `@shopify/draggable` sigue en `dependencies` sin ninguna referencia en `src/` (grep sin resultados) — dependencia muerta, candidata a remover. `fluid-dnd` fue removida de `dependencies` (apuntaba a un tarball local inexistente fuera del repo, bloqueaba `npm install`).
- **Gráficos**: `chart.js` 4 + `vue-chartjs` 5, confinados al bundle de historial (`src/history/UsageChart.vue`, ADR-0010) — sin import fuera de ese bundle.
- **Audio**: `howler` 2 (sonidos de interacción en `src/plugins/sound.js` y `src/sounds/*.mp3`), volumen persistido vía store `settings` (ver abajo).
- **Detección de procesos**: `active-win` 8 activo en producción — foco de ventana vía `src/main/platform-windows.js::getForegroundWindow`, motor de monitoreo con dos reductores puros (lifecycle/focus) en `src/main/monitor-engine.js` (ADR-0001). Enumeración de procesos vivos por `tasklist` (sin PowerShell); ventanas abiertas y listado de instaladas sí usan PowerShell (2 invocaciones `exec('powershell ...')` en `platform-windows.js`, líneas ~99 y ~157).
- **Test runner**: no detectado. No hay `jest.config.*`, `vitest.config.*` ni scripts de test en `package.json`.
- **Linter**: ESLint 7 + `eslint-plugin-vue` 8 (`plugin:vue/vue3-essential` en `package.json`, `plugin:vue/essential` en `.eslintrc.js` — configs levemente inconsistentes entre sí), parseo vía `vue-eslint-parser` + `@babel/eslint-parser`.
- **Build/bundler**: Vue CLI Service 5 (webpack por debajo). `vue.config.js` define `externals: { electron: 'require("electron")' }` y `resolve.fallback.fs = false` (polyfills de Node deshabilitados/parciales, browserify-* como devDependencies).
- **CI**: no detectado. No existe `.github/workflows/` ni `.gitlab-ci.yml` en el repo.

## Arquitectura (post `app-detection-logos-audio`, mergeado a main)

- **Main process modularizado** en `src/main/` (D10/ADR-0004 — único módulo dependiente de SO es `platform-windows.js`): `platform-windows.js` (foco/procesos/instaladas/ícono, PowerShell+tasklist+registro), `monitor-engine.js` (motor de monitoreo multi-app), `ipc-handlers.js` (canales IPC — `get-monitored-snapshot`, `add-to-selection`, `remove-from-selection`, `stop-monitored-row`, `get-app-icon`, `get-installed-apps`, `get-settings`, `save-settings`), `icon-cache.js` (extracción/caché de íconos, dos niveles memoria+disco, ADR-0005), `installed-apps.js` + `installed-apps-filter.js` (enumeración/filtrado de apps instaladas vía accesos directos del Menú Inicio, ADR-0003), `session-log.js` (registro de sesiones), `json-store.js` (helper de persistencia JSON genérico, lectura tolerante a archivo ausente/corrupto, ADR-0006).
- **Stores Pinia**: `menu.js` (preexistente), `monitoredApps.js` (espejo de snapshot del motor — sin lógica propia, D17: el estado se reemplaza entero al recibir el snapshot del main; único estado local propio es `icons`), `settings.js` (preferencias de volumen, persistidas vía IPC `get-settings`/`save-settings`, delega en `plugins/sound.js`).
- **Componentes nuevos**: `AppRow.vue` (fila de app monitoreada, usado por `CronometroAplicacion.vue`), `AppSelectorModal.vue` (modal de selección de apps instaladas), `OpcionesPanel.vue`.
- **Persistencia**: JSON plano bajo `app.getPath('userData')` vía `json-store.js` — usado por selección monitoreada, caché de íconos, caché de apps instaladas, settings y log de sesiones (ADR-0006, `fs.writeFileSync` sin try/catch por diseño).
- `src/utils/stateManager.js` (mencionado en una versión anterior de este perfil como punto de entrada probable) está **muerto**: solo se referencia a sí mismo, sin importaciones desde el resto de `src/`. No usar como base para nuevas features — la persistencia real vive en `src/main/json-store.js`.

## Convenciones

- **Commits**: mensajes cortos en minúsculas, imperativo/descriptivo, sin prefijo Conventional Commits estricto observado en `git log` del repo principal (ej. "fix endSession sound", "add sounds"). El pipeline SDD debe producir commits en Conventional Commits en inglés según instrucciones globales del usuario, aun si el historial previo no lo sigue.
- **Branches**: sin convención previa observable (repo trabajaba directo sobre `main`). Este cambio introduce `feature/{change-name}` como convención SDD.
- **PR base**: `main`.

## Notas del proyecto

- La extracción automática de íconos ya está implementada (ADR-0005, `src/main/icon-cache.js` + `platform-windows.js::getExecutableIcon` sobre `app.getFileIcon`). Los PNG estáticos en `src/assets/*.png` (`Blender.png`, `CLIP STUDIO PAINT.png`, `Google Chrome.png`, `VEGAS Pro.png`, `Toon Boom *.png`) quedaron sin ninguna referencia en `src/components/` (grep sin resultados) — assets muertos, candidatos a remover; `manual.png` sigue en uso pero es el ícono del modo manual, no un logo de app.
- `src/components/CronometroAplicacion.vue` es ahora un contenedor delgado que itera `monitoredApps.rows` y delega cada fila a `AppRow.vue`; el estado real vive en el store `monitoredApps` (espejo del snapshot IPC) y en el motor de `src/main/monitor-engine.js`, no en el componente.
- No hay tests automatizados en el proyecto — `sdd-verify` deberá definir estrategia de verificación (manual/exploratoria o introducir test runner) para este cambio.
- `fluid-dnd` fue removida de `package.json` en este cambio (apuntaba a un `.tgz` local fuera del repo, `file:../draggapleFluid/...`, inexistente en este entorno — bloqueaba `npm install`). `@shopify/draggable` sigue en `dependencies` sin ninguna referencia en `src/` — dependencia muerta, candidata a remover en un cambio futuro.
- Contexto de encoding del puente PowerShell (relevante para el punto 7 del intent de este cambio): PowerShell 5.1 emite en codepage OEM y Node decodifica como UTF-8 por defecto, lo que corrompe nombres/rutas con tildes o eñes en las ~2 invocaciones `exec('powershell ...')` de `platform-windows.js` (líneas ~99 y ~157). Detalle completo y verificación empírica en `## Entorno` de `state.md` del cambio `sessions-groups-history`.
