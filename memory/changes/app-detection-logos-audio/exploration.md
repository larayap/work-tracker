# Exploración: app-detection-logos-audio

> Sin specs vigentes (`memory/specs/` vacío — primer cambio SDD del repo). Todas las secciones se basan en lectura directa de código `[fuente: código {path}]`.

## Estado Actual

### 0. Flujo de empaquetado activo (ambigüedad heredada de sdd-init)

`package.json` declara scripts para dos toolchains (`electron:build`/`electron:serve` de `vue-cli-plugin-electron-builder`, y `start`/`package`/`make` de `@electron-forge/cli`), pero solo una es funcionalmente viable hoy:

- `src/background.js:4-5` importa `createProtocol` desde `'vue-cli-plugin-electron-builder/lib'` y depende de `process.env.WEBPACK_DEV_SERVER_URL` (inyectada por ese plugin) para diferenciar dev/prod `[fuente: código src/background.js:4,79-88]`.
- `forge.config.js` solo configura `packagerConfig`, `makers` y los plugins `auto-unpack-natives`/`fuses` — **no** incluye `@electron-forge/plugin-webpack` ni ningún plugin que compile `src/*.vue` con Vue CLI `[fuente: código forge.config.js:1-44]`. `package.json.devDependencies` confirma la ausencia de ese plugin `[fuente: código package.json:38-67]`.
- Conclusión: el flujo real y único que compila el renderer (Vue SFCs, multi-page `index.html`/`history.html`) es **`vue-cli-plugin-electron-builder`** vía `vue-cli-service electron:build`/`electron:serve`. Los scripts de Electron Forge (`start`/`package`/`make`) empaquetarían `background.js` sin el bundle del renderer — están inactivos/incompletos, probablemente un intento de migración abandonado a medio camino.
- Implicación para el diseño: el main process sigue viviendo en `src/background.js` (root del proyecto, `package.json.main: "background.js"`); cualquier IPC nuevo (enumeración de apps instaladas, extracción de íconos, `active-win`, etc.) se agrega ahí, no en un `main.js` de Forge.

### 1. Logos automáticos de programas (feature 1)

- Mecanismo manual actual: `CronometroAplicacion.vue` resuelve el ícono con un `watch` sobre `selectedApp` que hace `require(\`@/assets/${newAppName}.png\`)`, con fallback a `src/assets/idk.png` si el `require` falla (nombre sin imagen) `[fuente: código src/components/CronometroAplicacion.vue:97-104]`.
- Los assets son PNGs cargados a mano en el repo, con nombres que deben calzar exactamente con el nombre de proceso reportado por Windows (incluye espacios: `"CLIP STUDIO PAINT.png"`, `"Google Chrome.png"`, `"VEGAS Pro.png"`, etc.) `[fuente: código src/assets/*.png]`. Es decir: hoy el "logo automático" es en realidad un mapeo estático nombre→archivo, mantenido a mano por el desarrollador, sin ninguna extracción real del ejecutable.
- No hay ningún import de `nativeImage`, `app.getFileIcon`, ni librerías de extracción de íconos (`extract-file-icon`, `icon-extractor`, etc.) en el proyecto — ni en `package.json` ni en `src/background.js` `[fuente: código package.json:20-67, src/background.js:1-11]`.
- `winInfo.owner.path` (ruta del ejecutable) ya está disponible en el main process vía `active-win()`, usado hoy solo para loguear (`console.log`) en `start-cronometro-monitoring` `[fuente: código src/background.js:156-159]`. Es el dato que haría falta para extraer el ícono real.
- Electron 13 (versión fijada en `devDependencies`) expone `app.getFileIcon(path, options)` (retorna `NativeImage`, disponible desde Electron 0.37+) y `nativeImage.createFromPath()` — ambas corren en el main process, no en el renderer (por seguridad/acceso a FS nativo). El resultado se puede serializar a `dataURL` (`nativeImage.toDataURL()`) para mandarlo por IPC al renderer.
- No existe hoy ningún procesamiento de imagen a blanco y negro en el código (`grayscale`, `filter`, `desaturate` no aparecen en `src/` `[fuente: código grep sin resultados]`).

### 2. Selector de apps instaladas (feature 2)

- Hoy **no existe** un selector de "aplicaciones instaladas en el PC". Lo que existe es un selector de **ventanas actualmente abiertas**: el IPC handler `get-open-windows` ejecuta un comando PowerShell (`Get-Process | Where-Object { $_.MainWindowTitle -ne '' }`) y devuelve `{ appName }` por cada proceso con ventana visible `[fuente: código src/background.js:116-135]`.
- Ese listado se consume en dos lugares con UI casi idéntica (código duplicado): el modal de `CronometroAplicacion.vue` (`openAppList`/`selectApp`, líneas 152-166) y el modal de "pin sobre una app" en `TitleBar.vue` (`selectApp`, líneas 165-169) `[fuente: código src/components/CronometroAplicacion.vue:152-181, src/components/TitleBar.vue:136-172]`.
- Esto es fundamentalmente distinto del intent: "elegir desde un listado de aplicaciones **instaladas**" implica enumerar el sistema (ej. Windows: `HKLM\...\Uninstall` del registro, o accesos directos de `Start Menu`), no procesos en ejecución. El mecanismo actual (`Get-Process` vía PowerShell, atado a Windows) tampoco tiene equivalente para Linux/macOS — el `_profile.md` no detecta soporte multiplataforma explícito, pero `forge.config.js` sí define makers para `darwin` (zip), `deb` y `rpm`, lo que sugiere intención de soportar más de Windows a futuro.
- El costo de enumerar apps instaladas vía registro de Windows es alto en superficie (parsing de claves de registro, filtrado de entradas basura, íconos que no siempre existen) comparado con seguir usando procesos en ejecución (bajo costo, ya implementado) — pero procesos en ejecución no resuelve "elegir antes de que la app esté abierta", que es justamente lo que pide el intent (arranque automático al abrirse el programa).

### 3. Detección automática y auto-stop (feature 3)

- El loop de detección vive enteramente en el **main process** (`src/background.js`), no en el renderer: `setInterval` de 1000ms dentro del handler `start-cronometro-monitoring`, que en cada tick llama `activeWin()` y compara `winInfo.owner.name` contra el `appName` monitoreado, emitiendo `app-active` con `{ isActive: true|false }` al renderer `[fuente: código src/background.js:139-183]`.
- Esta detección mide **foco de ventana**, no **proceso corriendo**: si el usuario minimiza o cambia de ventana (pero el programa sigue abierto), `winInfo.owner.name` deja de matchear y se emite `isActive: false` — el renderer interpreta esto como "pausar" (`pauseTime()`), no como "el programa se cerró". No hay ninguna verificación de si el proceso sigue vivo cuando pierde el foco (ej. `tasklist`/enumeración de PIDs) `[fuente: código src/background.js:168-181]`.
- El intent pide explícitamente la semántica de proceso ("se detiene sola cuando el programa se cierra"), que es distinta de la semántica de foco actual. Implementarla requiere: (a) detectar cierre real del proceso (ej. correlacionar con `Get-Process` periódico o un evento de sistema), y (b) decidir qué pasa con el conteo cuando el programa pierde el foco pero sigue abierto (¿debe seguir sumando o pausar? hoy pausa).
- El renderer nunca deja de escuchar `app-active` explícitamente por app — el listener se registra una sola vez en `mounted()` (`listenForAppStatus`, línea 182-192) y no distingue eventos entre distintas apps monitoreadas; con una sola app a la vez esto no es un problema, pero es una limitación real de cara a multi-programa (feature 4): el canal `app-active` no lleva `appName` en el payload, solo `isActive` `[fuente: código src/background.js:162-164,172-179; src/components/CronometroAplicacion.vue:183-191]`.

### 4. Pausa manual (feature 4)

- Existen dos mecanismos de "pausa" independientes y desacoplados sobre el mismo componente, lo que explica por qué la pausa manual podría no sentirse efectiva:
  1. **Pausa manual explícita** (botón play/pause, `toggle()`→`pause()`): actualiza `running = false` **y** envía IPC `stop-cronometro-monitoring`, que en el main process hace `clearInterval(cronometroInterval)` — es decir, detiene el monitoreo por completo, no solo "pausa" el contador `[fuente: código src/components/CronometroAplicacion.vue:107-124, src/background.js:185-192]`.
  2. **Pausa automática por foco** (`listenForAppStatus` → `resumeTime()`/`pauseTime()`): reacciona al evento `app-active` emitido por el `setInterval` del main process, y maneja su propio `running`/`intervalId` **sin** enviar ningún IPC de vuelta — es un control paralelo sobre las mismas variables de instancia (`running`, `intervalId`, `time`) que usa el botón manual `[fuente: código src/components/CronometroAplicacion.vue:182-205]`.
- Consecuencia observable: si el usuario pausa manualmente (mecanismo 1, que además detiene el `setInterval` del main process), el main deja de emitir `app-active` — pero si luego el usuario reactiva sin volver a seleccionar una app (`start()` en línea 114 exige `this.selectedApp` pero no revalida estado de monitoreo previo), el estado puede quedar inconsistente entre `running` del renderer y `cronometroInterval` del main. No hay un flag explícito de "pausado manualmente" que el main process respete — el main solo sabe "hay intervalo activo" o "no hay intervalo", y el renderer solo sabe "estoy corriendo" o "no", sin una tercera dimensión de "pausado a propósito por el usuario, pese a que la app siga con foco".
- El acumulado de tiempo vive en `this.time` (data del componente), actualizado en el `setInterval` de `resumeTime()` con precisión de 10ms (`Date.now() - startTime`) `[fuente: código src/components/CronometroAplicacion.vue:193-200]`. No hay persistencia de este valor entre pausas largas o cierre de la app — solo se persiste al hacer `reset()`, que escribe una línea de log vía `save-log-line` `[fuente: código src/components/CronometroAplicacion.vue:125-151, src/background.js:246-254]`.

### 5. Multi-programa simultáneo (feature 5)

- El modelo actual es **mono-app**: `CronometroAplicacion.vue` tiene un único `selectedApp` (string), un único `time`, un único `running`, y el propio main process solo sostiene una variable `currentAppName` y un único `cronometroInterval` global (module-level, no por-app) `[fuente: código src/background.js:20,137-153; src/components/CronometroAplicacion.vue:74-86]`. Seleccionar una nueva app cancela el monitoreo de la anterior (`start-cronometro-monitoring` limpia el intervalo previo si `appName` cambia, líneas 140-150).
- `src/stores/menu.js` (Pinia) no maneja apps monitoreadas — maneja qué **secciones de la UI** están activas (`manual`/`aplicacion`/`pomodoro`, los 3 modos de cronómetro que pueden coexistir arrastrados en el menú vía `vuedraggable`), no instancias de apps dentro del modo "Aplicación" `[fuente: código src/stores/menu.js:1-29]`. Es decir: hoy ya se puede tener Manual + Aplicación + Pomodoro simultáneamente como widgets reordenables (`Menu.vue`, `applied` array + `draggable`), pero dentro del widget "Aplicación" solo cabe una app a la vez.
- `src/utils/stateManager.js` es un módulo separado y **no relacionado** con el estado de apps monitoreadas: persiste un booleano `mostrarMenu` en un archivo `state.txt` junto al propio módulo (`path.join(__dirname, 'state.txt')`) `[fuente: código src/utils/stateManager.js:1-27]`. No se encontró ningún import de `stateManager.js` en el resto de `src/` — es código muerto o usado solo desde algún flujo no explorado; se registra como debt candidate más abajo.
- Persistencia real relacionada con el dominio: el log de sesiones de "Aplicación" vive en un archivo de texto plano (`usage-log.txt`, formato `[fecha] Aplicación: X | Duración: Y | Inicio: Z | Fin: W`, parseado con regex en `get-app-logs`) `[fuente: código src/background.js:244-272]`; el Pomodoro persiste sus sesiones en JSON (`pomodoro-sessions.json`) `[fuente: código src/background.js:274-306]`. No hay estructura de datos para "N apps monitoreadas en paralelo, cada una con su tiempo acumulado".
- UI/estética a respetar para el diseño multi-programa: tema oscuro global (`#0f0f0f` de fondo de ventana, texto `#e7e7e7`/`#f0f0f0`), fuente `"Architects Daughter"` (títulos/cuerpo) importada por Google Fonts en `App.vue` `[fuente: código src/App.vue:46-63]`; `TitleBar.vue` fija arriba (`.titlebar-wrapper`) y `Menu.vue` scrolleable debajo con `scroll-snap-type: y mandatory` (cada widget de `.componente` hace snap) `[fuente: código src/App.vue:1-24,63-85]`. Los estilos son mayoritariamente `scoped` por componente SFC, sin sistema de diseño centralizado (sin CSS vars/tokens compartidos, colores hardcodeados repetidos como `#f0f0f0`/`#1b1b1b`/`#2e2e2e` en varios archivos).
- El widget "Aplicación" ya calcula el tamaño de la ventana dinámicamente en `Menu.vue` (`resizeWindow`, mide `scrollHeight`/`scrollWidth` y llama `remote.getCurrentWindow().setContentSize(...)`) cada vez que cambia la selección de widgets — cualquier UI multi-programa que cambie de alto dinámicamente (ej. lista expandible de apps) interactúa con este mecanismo `[fuente: código src/components/Menu.vue:81-91,141-164]`.

### 6. Volumen (feature 6)

- `src/plugins/sound.js` inicializa 5 `Howl` (`endSession`, `deleteItem`, `popUp`, `pressButton`, `add`) precargados desde `src/sounds/*.mp3`, y expone un único método global `$playSound(key)` que hace `sounds[key].play()` sin parámetro de volumen `[fuente: código src/plugins/sound.js:1-23]`. Howler expone `Howl#volume()` y `Howler.volume()` (global) de forma nativa, no usados hoy.
- No existe **ninguna** noción de volumen ni de configuración persistida en el código: no hay `localStorage`, `electron-store`, ni archivo de settings dedicado — el único grep de "volume/volumen/settings/opciones/config" en `src/` solo matchea la línea de definición de `$playSound` en `sound.js` (falso positivo del método `config.globalProperties`) `[fuente: código grep src -in "volume|volumen|settings|opciones|config"]`.
- No existe una pantalla de "Opciones"/"Configuración" en la app: la navegación actual son 3 widgets de cronómetro (Manual/Aplicación/Pomodoro) más la ventana de historial (`history.html`) — ningún componente de settings. El feature 6 requiere crear esta superficie de UI desde cero (no hay ancla existente para "agregar un slider" — hay que decidir dónde vive: ¿nuevo botón en `TitleBar.vue` junto a `pin`/`maximizar`/`cerrar`, ícono `faGear` ya importado pero sin uso (`TitleBar.vue:72,76`, importado y nunca referenciado en el template — dead import)?).

### 7. Flash blanco del calendario (feature 7)

- `public/history.html` es el HTML base de la ventana de historial (entry `history` en `vue.config.js:9-13`) y no define ningún `background-color` en `<html>`/`<body>` inline — está vacío salvo el `<div id="app">` `[fuente: código public/history.html:1-10]`.
- El color de fondo oscuro (`#1b1b1b`) para esa vista se define recién en el `<style>` **no-scoped** de `HistoryView.vue` (`html, body { background-color: #1b1b1b }`, líneas 128-133) — es decir, se aplica vía CSS-in-JS inyectado por webpack **después** de que Vue monta y el bundle se ejecuta, no está presente en el HTML servido inicialmente.
- La `BrowserWindow` del historial se crea en `open-history-window` sin `backgroundColor` (a diferencia de la `mainWindow`, que sí define `backgroundColor: '#0f0f0f'` en su constructor) y sin `show: false` + evento `ready-to-show` — se instancia con las opciones por defecto de Electron, que pintan la ventana en blanco hasta que hay contenido que renderizar, y además no está `show: false` así que se muestra de inmediato al crear la ventana, antes de terminar de cargar `history.html`/el bundle `[fuente: código src/background.js:222-233, comparar con src/background.js:60-77]`.
- Causa raíz identificada con confianza alta: combinación de (a) `BrowserWindow` de historial sin `backgroundColor` oscuro propio, y (b) ausencia de `show:false`/`ready-to-show` para no exponer la ventana hasta que el primer paint ya tiene el fondo oscuro aplicado. El CSS oscuro existe pero llega tarde (post-bundle), no está en el HTML estático.

## Archivos Afectados

| Archivo | Rol | Impacto |
|---------|-----|---------|
| `src/background.js` | Main process Electron: creación de ventanas, todos los `ipcMain` handlers, loop de detección (`setInterval` + `active-win`), persistencia en disco (log de uso, sesiones pomodoro) | Alto — aquí van: extracción de íconos (`app.getFileIcon`/`nativeImage`), enumeración de apps instaladas, rediseño del loop de detección multi-app con semántica de proceso, `backgroundColor`/`ready-to-show` en `open-history-window`, nuevo estado de settings (volumen) si se persiste en main |
| `src/components/CronometroAplicacion.vue` | Widget "Aplicación": selección de 1 app, cronómetro, ícono estático, modal de ventanas abiertas, historial de logs por fecha (modal duplicado, no usa `history.html`) | Alto — pasa de mono-app a lista de apps monitoreadas; reemplaza `require('@/assets/...')` por ícono servido desde main vía IPC; unifica semántica de pausa manual vs. automática |
| `src/components/TitleBar.vue` | Barra de título de la ventana principal: toggles de widgets (Manual/Aplicación/Pomodoro), pin/maximizar/cerrar, y un segundo modal duplicado de "ventanas abiertas" para pin-sobre-app | Medio — candidato a alojar el ícono/entrada de "Opciones" (volumen); el ícono `faGear` ya está importado sin uso |
| `src/components/Menu.vue` | Layout de widgets: selección inicial (M/A/P), lista `applied` drag-and-drop, resize dinámico de ventana según contenido | Medio — si el widget "Aplicación" cambia de tamaño por tener N apps, `resizeWindow()`/`aplicarSeleccion()` deben seguir funcionando correctamente |
| `src/stores/menu.js` | Store Pinia: qué widgets (Manual/Aplicación/Pomodoro) están activos | Bajo-Medio — no modela apps monitoreadas hoy; podría extenderse o convivir con un store nuevo dedicado a "apps monitoreadas" |
| `src/plugins/sound.js` | Registro de sonidos Howler y `$playSound` global | Alto para feature 6 — necesita exponer control de volumen (`Howler.volume()`/`Howl#volume()`) y leer/escribir un valor persistido |
| `src/assets/*.png` | Logos manuales actuales (`Blender.png`, `CLIP STUDIO PAINT.png`, etc.) + `idk.png` fallback | Bajo — quedarían como fallback o se eliminan una vez automatizada la extracción de íconos |
| `src/history/HistoryView.vue` | Vista de calendario/historial (`v-calendar`), estilos oscuros globales vía `<style>` no-scoped | Medio — el fondo oscuro ya existe aquí pero llega tarde; puede necesitar duplicarse/promoverse a `public/history.html` o a opciones de `BrowserWindow` |
| `public/history.html` | HTML base de la ventana de historial | Bajo pero directo — candidato a fix del flash (agregar `background:#1b1b1b` inline) |
| `public/index.html` | HTML base de la ventana principal | Ninguno esperado (ya funciona bien vía `backgroundColor` de `mainWindow`) |
| `forge.config.js` / scripts `start`/`package`/`make` de `package.json` | Flujo de empaquetado alternativo, no funcional para el renderer hoy | Ninguno directo — riesgo de confusión si se toca sin resolver antes la ambigüedad (ya resuelta arriba: usar `vue-cli-plugin-electron-builder`) |
| `src/utils/stateManager.js` | Persiste un booleano `mostrarMenu` en `state.txt`; sin referencias encontradas en `src/` | Ninguno esperado — candidato a debt (código muerto o mal ubicado) |

## Approaches Posibles

### Feature 1 — Logos automáticos B/N

**Approach A: Extracción nativa con `app.getFileIcon` + conversión a escala de grises en el renderer (CSS `filter: grayscale(1)`)**
- Pros: `app.getFileIcon` es API estándar de Electron (disponible desde Electron 13), no agrega dependencias; `filter: grayscale()` es CSS puro, cero costo de procesamiento, reversible/ajustable (ej. contraste) sin reprocesar la imagen.
- Contras: `getFileIcon` en Windows entrega íconos de baja resolución por defecto (`size: 'normal'` ~32px, `'large'` varía por SO) — puede verse pixelado si se escala. El grayscale vía CSS es solo visual: si en el futuro se necesita el bitmap ya-en-gris (ej. para el ícono de bandeja del sistema `Tray`), habría que reprocesar.
- Esfuerzo: S

**Approach B: Extracción nativa + conversión de bitmap a gris server-side (main process) con `nativeImage`/librería de procesamiento**
- Pros: el dato que llega al renderer ya está en gris, consistente en cualquier contexto (no solo `<img>` con CSS), reutilizable para `Tray`/notificaciones.
- Contras: `nativeImage` no expone manipulación de píxeles de alto nivel — requeriría convertir a buffer y aplicar luminancia manualmente o sumar una dependencia (ej. `sharp`, pesada para Electron/nativo, complica el build); mayor esfuerzo y superficie de fallos (formatos de imagen, dependencias nativas compiladas).
- Esfuerzo: M-L

**Recomendación**: Approach A. Cubre el intent ("se ven en blanco y negro de forma uniforme") con el menor esfuerzo y sin nuevas dependencias nativas; el caso de uso de gris "real" en Tray no está en el intent actual (YAGNI).

### Feature 2 — Selector de apps instaladas

**Approach A: Mantener enumeración de procesos en ejecución (`Get-Process` actual) y renombrar la UX a "apps activas ahora" en vez de "instaladas"**
- Pros: cero esfuerzo adicional, ya funciona, multiplataforma-friendly de extender (en Linux/macOS se listarían procesos con `ps`/equivalentes).
- Contras: no cumple el intent literal — el usuario no puede preseleccionar apps que hoy no están abiertas para que "arranquen solas" la próxima vez.
- Esfuerzo: XS

**Approach B: Enumerar aplicaciones instaladas via registro de Windows (`HKLM/HKCU ...\Uninstall`) o accesos directos del Menú Inicio, guardar la selección, y usar detección de proceso (feature 3) para activar/desactivar automáticamente**
- Pros: cumple el intent completo (preselección + auto-arranque/auto-stop); es el único approach compatible con "arranca sola al abrirse el programa".
- Contras: mayor esfuerzo — parsear registro (vía `child_process` + `reg query`, o una librería como `winreg`) trae ruido (entradas sin ícono, sin ejecutable directo, actualizaciones de Windows, etc.) que hay que filtrar; atado a Windows (coherente con el mecanismo PowerShell ya usado en el proyecto, pero no portable a macOS/Linux sin una rama de código aparte).
- Esfuerzo: L

**Recomendación**: Approach B es el único que satisface el intent, pero su costo real (parsing de registro + filtrado + UX de "instalada pero nunca abierta, ¿qué ícono muestro?") debe dimensionarse en `sdd-design` combinado con feature 3 (son features acopladas: sin auto-detección de apertura/cierre, preseleccionar una app instalada no tiene efecto).

### Feature 3 — Detección automática y auto-stop

**Approach A: Mantener el loop de foco actual (`active-win` cada 1s) y agregar un chequeo periódico adicional de "¿el proceso sigue vivo?" (ej. `Get-Process -Name` o `tasklist`) para decidir auto-stop real**
- Pros: reutiliza el intervalo existente, cambio incremental y acotado; separa claramente "foco" (afecta pausa/reanudación del conteo) de "proceso vivo" (afecta inicio/fin del monitoreo).
- Contras: dos fuentes de verdad corriendo en paralelo (foco vs. proceso) que hay que sincronizar con cuidado para no reintroducir el bug de pausa (feature 4).
- Esfuerzo: M

**Approach B: Reescribir el loop para que el evento primario sea "proceso corriendo" (enumeración periódica de procesos, no `active-win`) y usar el foco solo como señal secundaria opcional**
- Pros: alinea el modelo mental del código con el intent (auto-stop = proceso cerrado) desde la base, evita parchear sobre el diseño actual.
- Contras: mayor esfuerzo — hay que decidir qué pasa con el conteo cuando el proceso corre pero no tiene foco (¿sigue sumando? el intent no lo aclara para multi-programa) y rediseñar el payload IPC para incluir `appName`/`pid` por evento (hoy `app-active` no lo lleva).
- Esfuerzo: L

**Recomendación**: Approach A como base, pero el payload IPC debe extenderse a incluir `appName` (o `pid`) en cada evento `app-active` para soportar multi-programa (feature 5) — este cambio de contrato IPC es de bajo costo y evita romper el paralelismo cuando haya N apps monitoreadas.

### Feature 4 — Pausa manual

**Approach A: Introducir un flag explícito `pausedManually` que el main process respeta — al pausar manualmente, el intervalo de detección sigue vivo pero deja de emitir eventos que afecten el conteo; al reanudar, se retoma sin perder el `selectedApp`**
- Pros: resuelve directamente la causa raíz identificada (dos mecanismos de pausa desacoplados); no requiere destruir/recrear el monitoreo en cada pausa manual.
- Contras: agrega un estado más a sincronizar entre renderer y main (vía IPC), aunque acotado.
- Esfuerzo: S

**Approach B: Mantener el diseño actual de "pausar = detener monitoreo" (`stop-cronometro-monitoring`) pero forzar que `resumeTime()`/`pauseTime()` (los handlers de foco) solo actúen si `running` fue puesto en `true` por el propio flujo de foco, nunca pisando una pausa manual**
- Pros: cambio más pequeño, no toca el main process.
- Contras: parche sobre el síntoma, no sobre la causa (persiste la dualidad de mecanismos); más frágil ante cambios futuros (ej. multi-programa, donde cada app necesita su propio estado de pausa).
- Esfuerzo: XS-S

**Recomendación**: Approach A. Es la base correcta para que la pausa manual sea un estado de primera clase, necesario también para multi-programa (cada app monitoreada necesitará poder pausarse individualmente).

### Feature 5 — Multi-programa simultáneo

**Approach A: Store Pinia dedicado (`useMonitoredAppsStore`) con array de apps monitoreadas (cada una con `{ appName, exePath, iconDataUrl, time, running, paused }`), límite fijo (ej. 4-6) validado al agregar, y refactor de `CronometroAplicacion.vue` para iterar sobre la lista en vez de un único estado**
- Pros: centraliza el estado (SSOT), reutilizable entre componentes, natural para persistir (ej. via IPC similar a `save-sessions`); el límite acotado se valida en un solo lugar.
- Contras: refactor no trivial de `CronometroAplicacion.vue` (hoy está diseñado 100% mono-app: un `time`, un `intervalId`, un `selectedApp`) y del main process (el `cronometroInterval` module-level pasa a ser un mapa `appName → interval` o un único interval que itera N apps).
- Esfuerzo: L

**Approach B: Renderizar N instancias del componente `CronometroAplicacion.vue` (uno por app seleccionada), cada una gestionando su propio estado local como hoy**
- Pros: cambio menor por componente (cada instancia ya sabe pausar/reanudar/resetear sola); reutiliza casi todo el código existente.
- Contras: el main process solo sostiene **un** `cronometroInterval`/`currentAppName` global (líneas 20, 137-153 de `background.js`) — no soporta hoy monitorear más de una app en paralelo; requeriría de todos modos convertir ese estado a un mapa por-app en el main. Además, sin un store central, coordinar el límite máximo de apps y la presentación conjunta (layout) es más difícil.
- Esfuerzo: M-L (el ahorro en el renderer se compensa con el mismo trabajo necesario en el main process)

**Recomendación**: Approach A. El main process necesita de todos modos volverse multi-app (no hay forma de evitarlo dado que hoy es literalmente una única variable global `cronometroInterval`), así que conviene aprovechar ese refactor para centralizar también el estado del renderer en un store, en vez de mantener N estados locales duplicados. El layout debe respetar el patrón visual actual: widgets apilados verticalmente con `scroll-snap`, fondo oscuro uniforme, misma tipografía — sin introducir un sistema de diseño nuevo (YAGNI dado que hoy no hay tokens compartidos).

### Feature 6 — Volumen

**Approach A: Volumen global único (`Howler.volume(valor)`) persistido en un archivo JSON simple vía IPC (mismo patrón que `save-sessions`/`load-sessions` ya usado para Pomodoro), con un slider en una nueva sección de "Opciones" accesible desde `TitleBar.vue` (reutilizando el ícono `faGear` ya importado pero sin uso)**
- Pros: `Howler.volume()` afecta todos los `Howl` a la vez con una sola llamada — mínimo esfuerzo para "volumen de la app y de los sonidos" (el intent no distingue volumen de música vs. efectos, son los mismos 5 sonidos cortos); reutiliza el patrón de persistencia IPC ya establecido en el proyecto (consistente con Pomodoro sessions).
- Contras: si en el futuro se quisiera volumen por-sonido, este approach no lo soporta sin extenderse.
- Esfuerzo: S

**Approach B: Volumen por sonido individual (`Howl#volume()` por cada key en `sounds`), con UI de sliders por categoría**
- Pros: más control granular.
- Contras: sobre-ingeniería para el intent actual, que pide "ajustar el volumen de la app y el de las opciones/sonidos" (lectura razonable: dos niveles, no cinco) — viola YAGNI.
- Esfuerzo: M

**Recomendación**: Approach A. Un volumen global (más, como mucho, un segundo control diferenciando "sonidos de interacción" si el intent realmente pide dos niveles) cubre el intent sin construir infraestructura que no se pidió.

### Feature 7 — Flash blanco del calendario

**Approach A: Agregar `backgroundColor: '#1b1b1b'` a las opciones de la `BrowserWindow` de historial en `open-history-window` (background.js:222-233), igual que ya tiene `mainWindow`, más `background-color` inline en `public/history.html`**
- Pros: fix directo de la causa raíz identificada, mínimo cambio (2 líneas), consistente con el patrón ya usado en `createWindow()` para la ventana principal.
- Contras: ninguno relevante — es el fix estándar y documentado para este problema en Electron.
- Esfuerzo: XS

**Approach B: Agregar además `show: false` + evento `ready-to-show` → `historyWindow.show()`, para no exponer la ventana hasta que el primer frame ya esté pintado con el bundle cargado**
- Pros: elimina cualquier parpadeo residual incluso en máquinas lentas donde el bundle tarda en ejecutar pese al `backgroundColor` correcto.
- Contras: ninguno relevante — es una extensión natural de Approach A, mismo patrón ya usado conceptualmente (aunque no con `ready-to-show`) en `mainWindow` (`show: false` en línea 67, mostrado luego vía `showMainWindow()`).
- Esfuerzo: XS (incremento marginal sobre A)

**Recomendación**: Approach A + B combinados. `mainWindow` ya usa `show: false`; aplicar el mismo patrón a `historyWindow` es consistente con el propio código del proyecto y no agrega complejidad real.

## Recomendación

**Approach recomendado por feature**: 1-A, 2-B (acoplado a 3-A), 3-A, 4-A, 5-A, 6-A, 7-A+B (ver detalle arriba).

**Justificación global**: los 6 features comparten dos ejes de refactor obligados en el main process (`src/background.js`): (a) el modelo de monitoreo pasa de "una app global" a "N apps con su propio ciclo de vida" (necesario para features 2, 3, 4 y 5 simultáneamente — no tiene sentido resolverlos por separado), y (b) se agrega una superficie IPC nueva para extracción de íconos y (si aplica) enumeración de instalados. Sobre esa base, features 1, 6 y 7 son incrementales y de bajo acoplamiento entre sí. Se recomienda a `sdd-design` secuenciar: primero el refactor de estado multi-app (5) + contrato IPC extendido (3+4), luego apoyar sobre él los íconos (1) y el selector de instaladas (2), y tratar volumen (6) y el fix del calendario (7) como trabajo independiente y paralelizable.

## Riesgos Identificados

- **Acoplamiento fuerte entre features 2, 3, 4 y 5**: no es posible implementar "selector de instaladas con auto-arranque" (2) sin antes tener detección real de apertura/cierre de proceso (3), y no es posible tener pausa manual coherente (4) ni multi-programa (5) sin rediseñar el estado global actual del main process (`cronometroInterval`, `currentAppName` como variables únicas). Mitigación: secuenciar el diseño como un solo refactor de "motor de monitoreo multi-app" del que las 4 features consumen, en vez de 4 diseños aislados.
- **Enumeración de apps instaladas atada a Windows** (registro/Start Menu): el mecanismo actual (`Get-Process` vía PowerShell) ya es Windows-only pese a que `forge.config.js` declara makers para `darwin`/`deb`/`rpm`. Si el proyecto pretende soportar Linux/macOS a futuro, esta pieza necesitará una rama de código separada por SO — fuera de scope si el intent es Windows-first, pero debe decidirse explícitamente en `sdd-design` (pre-ADR).
- **Contrato IPC `app-active` insuficiente para multi-programa**: hoy no lleva `appName`/`pid`, solo `isActive` — cualquier cambio a N apps requiere versionar este evento; si se omite, eventos de distintas apps se pisarían entre sí en el renderer.
- **Ambigüedad de empaquetado ya resuelta pero con deuda latente**: los scripts `start`/`package`/`make` de Electron Forge quedan en el repo sin funcionar realmente (sin plugin de webpack) — riesgo de que alguien los ejecute pensando que son el flujo real y obtenga un build roto. Se registra como debt candidate.
- **Código muerto en `src/utils/stateManager.js`**: no se encontraron referencias/imports en `src/`. Si `sdd-design` toca el área de persistencia de estado, conviene confirmar si es dead code antes de reutilizarlo o de asumir que gestiona algo relevante al cambio.
- **Resolución de íconos vía `app.getFileIcon` depende del SO**: en Windows entrega el ícono asociado por shell al ejecutable (generalmente confiable), pero la calidad/tamaño no está garantizada para todos los ejecutables (algunos devuelven ícono genérico). El fallback visual (`idk.png` o equivalente) debe conservarse para este caso.

## Debt Candidates Detectados

Registrados en `observations.md` (ver abajo):

1. `forge.config.js` + scripts `start`/`package`/`make` de Electron Forge — toolchain incompleta/no funcional para el renderer, conviven con el flujo real (`vue-cli-plugin-electron-builder`) sin advertencia. Riesgo de confusión y builds rotos si alguien los ejecuta.
2. `src/utils/stateManager.js` — sin referencias/imports detectados en `src/`; candidato a código muerto o a documentar su uso real si existe fuera de `src/`.
3. UI duplicada del modal "seleccionar app abierta" — implementado casi idéntico en `CronometroAplicacion.vue` (líneas 152-181) y `TitleBar.vue` (líneas 136-172), sin componente compartido.
