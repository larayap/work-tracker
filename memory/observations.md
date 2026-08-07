# Observations SDD

Log de hallazgos operacionales del pipeline SDD.
Categorías permitidas: ver `@global/skills/_shared/obsidian-persistence-convention#observations-md-policy`.
Formato: ## YYYY-MM-DD | <tag> | <change|global> | <summary>

## 2026-08-01 | pre-adr | app-detection-logos-audio | Empaquetado dual (electron-forge + vue-cli-plugin-electron-builder) en package.json — resolver cuál es el flujo activo antes de tocar background.js o el packaging
## 2026-08-01 | pre-adr | app-detection-logos-audio | Sin test runner ni CI configurados en el repo — sdd-verify deberá definir estrategia de verificación para este cambio
## 2026-08-01 | gap | global | _profile.md no existía — primera inicialización SDD del repositorio; creado desde cero en sdd-init

## 2026-08-01 | pre-adr | app-detection-logos-audio | Alcance Windows-first para detección y enumeración de apps instaladas — decisión propuesta en sdd-propose (default), pendiente de confirmación del usuario; candidata a ADR en sdd-design junto con el aislamiento del código dependiente de SO
## 2026-08-01 | pre-adr | app-detection-logos-audio | Semántica del conteo multi-programa: solo acumula el programa con foco (proceso vivo = sesión abierta, foco = quién suma) — define el modelo de datos, candidata a ADR en sdd-design
## 2026-08-01 | pre-adr | app-detection-logos-audio | Contrato IPC `app-active` se versiona para llevar `appName`/`pid` — cambio de contrato entre main y renderer, documentar en design

## 2026-08-01 | env-quirk | app-detection-logos-audio | context7 no cubre `active-win`: la búsqueda devuelve homónimos sin relación (x-win, active_merchant). El contrato de la librería se documenta en tech-context.md a partir del uso real en `src/background.js:156-170` — `owner.name` y `owner.path` confirmados por uso, `owner.processId` no
## 2026-08-01 | env-quirk | app-detection-logos-audio | La doc de context7 para Electron corresponde a la rama `main` y no marca disponibilidad por versión: `nativeImage.createThumbnailFromPath` aparece documentada pero NO existe en Electron 13, la versión fijada en el proyecto. Verificar versión de introducción antes de adoptar cualquier API de Electron en este repo

## 2026-08-01 | debt-candidate | forge.config.js sin plugin de webpack (toolchain no funcional)
**Detectado por**: sdd-explore en `app-detection-logos-audio`
**Ubicación**: `forge.config.js`, scripts `start`/`package`/`make` de `package.json`
**Descripción**: Electron Forge está configurado (`packagerConfig`, `makers`, plugins `auto-unpack-natives`/`fuses`) pero sin `@electron-forge/plugin-webpack` ni equivalente que compile los SFCs de Vue — estos scripts no producen un build funcional del renderer. El flujo real es `vue-cli-plugin-electron-builder` (`electron:build`/`electron:serve`). Riesgo de builds rotos si alguien ejecuta los scripts de Forge esperando el flujo completo.
**Promoción sugerida**: `sdd new remove-unused-forge-toolchain --domain debt`

## 2026-08-01 | debt-candidate | stateManager.js sin referencias detectadas
**Detectado por**: sdd-explore en `app-detection-logos-audio`
**Ubicación**: `src/utils/stateManager.js`
**Descripción**: Módulo que persiste un booleano `mostrarMenu` en `state.txt` junto al propio archivo. No se encontró ningún `require`/`import` de este módulo en el resto de `src/` — candidato a código muerto, o su uso real vive fuera de las rutas exploradas y debería documentarse.
**Promoción sugerida**: `sdd new cleanup-dead-state-manager --domain debt`

## 2026-08-01 | debt-candidate | Modal "seleccionar app abierta" duplicado
**Detectado por**: sdd-explore en `app-detection-logos-audio`
**Ubicación**: `src/components/CronometroAplicacion.vue:152-181`, `src/components/TitleBar.vue:136-172`
**Descripción**: Misma UI de modal (lista de ventanas abiertas, navegación por teclado, selección) implementada de forma casi idéntica en dos componentes, sin un componente compartido. Aumenta el costo de mantenimiento cuando se toquen ambos flujos en este cambio (selector de apps).
**Promoción sugerida**: `sdd new extract-shared-app-picker-modal --domain debt`

## 2026-08-02 | verification-gap | app-detection-logos-audio | sdd-apply completó las 29 tareas; verificación manual en Windows pendiente
**Fase**: sdd-apply
**Contexto**: el entorno de ejecución es WSL2/Linux y la app es Windows-only en su detección (`active-win`, `tasklist`, PowerShell, `app.getFileIcon`, accesos directos del Menú Inicio). No se pudo levantar la app ni correr ningún guion de verificación manual de `design.md`.
**Lo que sí se verificó en este entorno**:
- `npx eslint src --ext .js,.vue` — limpio en todo `src/` tras cada bloque.
- `npx vue-cli-service build` — el renderer (index/history) transpila sin errores tras cada bloque.
- `npx vue-cli-service electron:build --dir` — el bundle del main process (`background.js` + todo `src/main/*`) compila sin errores tras los bloques 2, 4 y 5 (los que tocan `background.js`/`src/main/`).
- Las funciones puras del motor y del filtro de instaladas, con `node -e` directo: `readJson`/`writeJson` (Tarea 1), `msToHHMMSS`/`formatDateYYYYMMDD` (Tarea 2), `isProcessAlive` con PID propio y PID inexistente (Tarea 8), `buildSessionLine` contra la regex de `get-app-logs` (Tarea 10), los 6 escenarios de `reduceLifecycle` y los 3 de `reduceFocus` (Tareas 11-12), `getSnapshot()` en frío (Tarea 15), y `filterInstalledApps` con 5 entradas fabricadas (Tarea 24).
**Lo que queda pendiente de verificación en Windows** (no observable ni ejecutable desde este entorno):
1. Guion manual completo de `design.md` (puntos 1-26): motor con un solo programa, multi-fila y límite, `ResizeObserver`/antibucle, íconos, selector, indicador no interactivo, volumen, historial sin destello.
2. Si `winInfo.owner.processId` (o `.pid`) de `active-win` viene poblado al cambiar de foco entre programas reales — Tarea 8 dejó el campo como refuerzo opcional (D4), pero la confirmación empírica requiere Windows.
3. La consulta PowerShell de `listInstalledCandidates()` (Tarea 25): no se pudo ejecutar ni sintaxear con un intérprete real (no hay `powershell.exe` en WSL2). La sintaxis (bloques `if/else` como expresión dentro de `[PSCustomObject]@{...}`, `Get-ItemProperty` con array de `-Path`) está escrita de buena fe contra PowerShell 5.1 pero no probada.
4. La correlación acceso-directo↔registro en esa misma consulta es best-effort (por `DisplayName` exacto o `InstallLocation` como prefijo) — no hay clave foránea real entre un `.lnk` y una entrada de `Uninstall`; si no matchea, la entrada sigue sujeta solo a los descartes por ruta/nombre del filtro puro (ya verificado).
5. El fallback de `idk.png` en `icon-cache.js` vía `app.getAppPath()` + `nativeImage.createFromPath()`: razonado contra cómo `vue-cli-plugin-electron-builder` empaqueta el proceso main (sin loader de imágenes en `bundleMain`, ver commit `3ab7b95`) y contra el `files` glob por defecto de electron-builder (no excluye `src/`), pero no hay forma de generar un build empaquetado real (`.exe`/NSIS) en este entorno para confirmarlo.
6. Todos los criterios de aceptación de las specs tocadas (`two-state-row-machine`, `row-lifecycle`, `saved-selection-only-monitoring`, `session-log-persistence`, `simultaneous-limit`, `empty-state`, `automatic-bw-icons`, `installed-apps-listing-quality`, `status-indicator-non-interactive`, `dual-volume-control`, `dark-loading-state`) quedan con sus checkboxes de `Acceptance Criteria` sin marcar en las specs — el código los implementa según el diseño, pero "implementado" no es "verificado", y marcar los checkboxes sin haber corrido el escenario real sería una afirmación no honesta.
**Acción sugerida para sdd-verify**: ejecutar el guion manual completo de `design.md` sobre un build de Windows (`npm run electron:serve` o el instalador NSIS), confirmar los 6 puntos de arriba, y recién entonces marcar `status: completed` y los checkboxes de acceptance_criteria en las specs.

## 2026-08-02 | correction | app-detection-logos-audio | fallback de idk.png corregido y verificado empíricamente
**Fase**: sdd-apply (segunda pasada, tras FAIL de sdd-verify)
**Contexto**: el punto 5 de la observación anterior (`2026-08-02 | verification-gap`) daba por buena la ruta `path.join(app.getAppPath(), 'src', 'assets', 'idk.png')` razonando que el `files` glob de electron-builder no excluye `src/`. `sdd-verify` demostró que ese razonamiento era incorrecto: `directories.app` (fijado por `vue-cli-plugin-electron-builder` a `dist_electron/bundled`) nunca contiene `src/` en ningún build empaquetado — el glob de `files` ni siquiera llega a evaluarse sobre el proyecto real, solo sobre la salida de webpack. Confirmado extrayendo un `app.asar` real.
**Corrección aplicada**: `src/assets/idk.png` → `git mv` a `public/img/idk.png`; `icon-cache.js` ahora usa `path.join(__static, 'img', 'idk.png')`, el mismo patrón que `background.js` ya usaba para `icon-work.png`. Re-verificado con el mismo procedimiento que usó `sdd-verify`: `npx vue-cli-service electron:build --dir` + `npx asar extract` sobre el `app.asar` generado — `img/idk.png` aparece en la raíz del asar extraído, junto a `icon-work.png`. Build y `asar extract` corridos y limpiados dentro de esta misma pasada (`dist`/`dist_electron` no quedan en el worktree).
**Decisión sobre el fallback local de `AppRow.vue`** (`fallbackIcon: require('@/assets/idk.png')`, señalado por `sdd-verify` como lo que hoy tapa el defecto en la UI): se **conserva**, no se elimina. Motivo: no es solo un respaldo redundante ante fallo de IPC — también sirve de placeholder instantáneo mientras `ensureIcon()` resuelve el ícono real de forma asíncrona; eliminarlo cambiaría el defecto corregido por una regresión distinta (parpadeo en blanco en cada fila nueva, todo el tiempo, no solo en el caso de falla). El mecanismo primario del respaldo (D9) sigue siendo `icon-cache.js`. Para no duplicar el archivo físico entre `src/assets/` y `public/img/`, el `require` de `AppRow.vue` ahora apunta directamente a `../../public/img/idk.png`: verificado contra el bundle compilado (`dist/js/index.*.js`) que webpack lo sigue procesando igual que antes (inline como `data:image/png;base64,...`, mismo mecanismo que el resto de `src/assets`).
**Segundo defecto corregido**: `monitoredApps.js` (`ensureIcon`) — guard de reentrada cambiado de `this.icons[exePath]` (falsy para `null` legítimo) a `Object.prototype.hasOwnProperty.call(this.icons, exePath)`. Sin cambios de reactividad necesarios: Pinia usa `reactive()` (Proxy), que ya trackea la asignación de claves nuevas.
**Commits**: `dc5d5d2` (icon-cache.js + AppRow.vue + mover idk.png), `cdaf80b` (monitoredApps.js).

## 2026-08-02 | correction | app-detection-logos-audio | C1/C2/S1 de sdd-judgment (iteración 1) corregidos

**Fase**: sdd-apply (tras veredicto FAIL de sdd-judgment, iteración 1 de 2)
**Spec**: `judgment-fixes-iteration-1.md`. Detalle completo con evidencia en `changes/app-detection-logos-audio/judgment-report.md`.

**C1 — arranque duplicado (`background.js`)**. Decisión tomada: eliminar el
`app.on('ready', ...)` duplicado y consolidar todo el arranque en el único
`app.whenReady().then()`, en vez de (solo) agregar un guard de idempotencia a
`registerIpcHandlers`. Justificación: un guard de idempotencia hace que
`ipcMain.handle()` deje de lanzar, pero no evita que `createWindow()` se
ejecute dos veces — seguiría construyéndose una `BrowserWindow` de más en
cada arranque (recurso desperdiciado, y la variable de módulo `mainWindow`
terminaría apuntando a la que gane la carrera, no necesariamente por diseño).
Consolidar los listeners ataca la causa, no el síntoma. No se agregó guard de
idempotencia adicional en `registerIpcHandlers` (YAGNI): con un solo camino
de arranque, no hay caso restante en el que se invoque dos veces.
**Verificación en este entorno (sin Windows)**: lectura del control de flujo
resultante, y confirmación por construcción sobre el bundle real —
`npx vue-cli-service electron:build --dir` + `grep` sobre
`dist_electron/bundled/background.js`: cero ocurrencias de
`app.on('ready'` y exactamente una de `whenReady`. `dist`/`dist_electron`
se eliminaron al cerrar, igual que en la pasada anterior.
**Pendiente de confirmar en el primer arranque real en Windows**: que
"Mostrar ventana" desde el tray abra la ventana con la interfaz cargada (no
en blanco) y que cerrarla la oculte en vez de destruirla — el escenario
completo de `judgment-fixes-iteration-1.md` no es observable sin Electron
corriendo de verdad.

**C2 — fila degradada sin vínculo de PID (`monitor-engine.js`,
`platform-windows.js`, `AppSelectorModal.vue`, `stores/monitoredApps.js`)**.
Se tomó la dirección que respeta D4 al pie de la letra (no el parche
alternativo de normalizar agregando `.exe` en `monitor-engine.js`):
`listOpenWindows()` ahora expone `imageName` como campo propio, distinto de
`appName`, y ese campo viaja por `AppSelectorModal.chooseOpenWindow()` →
`monitoredApps.addApp()` → `add-to-selection` → `addToSelection()`, que arma
el `appId` degradado (`normalizeAppId`) sobre `imageName`, no sobre `name`.
**Verificado con `node -e`** sobre las funciones puras: se reprodujo la
construcción del `appId` degradado, la coincidencia contra un
`tasklist`/`listRunningProcesses()` simulado, la vinculación real del pid vía
`reduceLifecycle`, y el cierre posterior del proceso sacando la fila y
devolviéndola en `closed` (equivalente al botón ■). Se corrió además el
control negativo: reconstruyendo el `appId` con la lógica previa (`appName`
en vez de `imageName`) el match nunca ocurre — confirma que el defecto era
real y que el fix lo resuelve. La confirmación de punta a punta contra un
proceso elevado real de Windows (el único camino que ejercita esta vía)
queda pendiente, como ya declaraba la spec.

**S1 — carrera en la caché de íconos en disco (`icon-cache.js`)**. Se eligió
serializar las escrituras (cola de promesas encadenadas, mismo patrón que
`installed-apps.js` ya usa para su promesa en vuelo) en vez de releer y
fusionar en el momento de escribir: la extracción (`getExecutableIcon`)
sigue siendo concurrente entre llamadas — no se serializa el trabajo caro—,
solo el tramo lectura+merge+escritura del archivo, que ahora es
enteramente síncrono dentro de cada turno de la cola.
**Verificado con `node -e`** contra el `json-store.js` real (mockeando
`electron` y `platform-windows.js#getExecutableIcon` con retrasos
escalonados): 5 `getIcon()` concurrentes sobreviven completas en disco.
Control negativo: la misma prueba contra la secuencia previa
(lectura→await→escritura sin cola) perdió 4 de 5 claves, confirmando la
carrera.

**Commits**: `e7dd8d2` (C1), `cf4b70b` (C2), `a0c5648` (S1).

2026-08-02 | judgment-escalation-resolved | app-detection-logos-audio | sdd-judgment escaló tras 2 iteraciones con F1 (regresión introducida por el fix de S1 en icon-cache.js) y F2 (matchFocusedAppId compara contra Description en vez de nombre de imagen). El orquestador presentó el judgment-report al usuario, que optó por corregir ambos antes de archivar en vez de aceptarlos como deuda. Se despacha sdd-apply con alcance acotado a esos dos fixes; el pipeline sigue a sdd-archive sin una tercera ronda de judgment (iteraciones agotadas, decisión explícita del usuario).

2026-08-02 | judgment-escalation-fixed | app-detection-logos-audio | Corregidos F1 y F2 del judgment-report iteración 2, alcance acotado (sin re-auditar el resto del cambio).

**F1 — `icon-cache.js#persistToDisk` (commit `fa12e68`)**. Se agregó
`.catch(() => {})` al final de la cadena de la cola de escrituras. Con eso,
un fallo de `jsonStore.writeJson` (síncrono, sin try/catch por diseño,
D11/ADR-0006) ya no deja `diskWriteQueue` como promesa rechazada para
siempre: la cola se restablece a resuelta en el próximo turno, y `getIcon`
—que hace `await persistToDisk(...)`— deja de propagar ese fallo al
renderer. Decisión explícita (la que el propio judgment-report sugería como
la coherente): el fallo de la caché en disco ya no es visible para el
llamador, porque es una optimización sobre la caché en memoria, no un
requisito de corrección del ícono.
**Verificado con `node -e`** sobre `icon-cache.js` y `json-store.js` reales,
`fs` real, con una escritura fallida simulada (monkey-patch de
`fs.writeFileSync` para la segunda llamada) y `electron`/`active-win`
stubeados: post-fix, `getIcon()` para una clave nunca vista tras la falla ya
no rechaza y persiste correctamente en disco. Control negativo corrido
contra el propio `icon-cache.js` en `HEAD` (antes del fix, `git show
HEAD:src/main/icon-cache.js`): reproduce el rechazo permanente descrito por
el judgment-report byte a byte (mismo mensaje de error propagado en la
tercera llamada).

**F2 — `monitor-engine.js#matchFocusedAppId` (commit `a74a658`)**. Se extrajo
`degradedAppId(imageName)` como única función que arma el prefijo
`'name:<imagen>'`, compartida por `normalizeAppId` (productor, ya usado por
`addToSelection`) y `matchFocusedAppId` (consumidor). La rama de nombre de
`matchFocusedAppId` ahora deriva el nombre de imagen con `path.basename`
desde `sFocus.exePath` cuando esa ruta está disponible, y solo cae a
`sFocus.name` (la Description del recurso de versión, no un nombre de
imagen) como último recurso. Con esto, filas degradadas emparejan el foco
contra la misma forma de identificador que usa el descubrimiento por
`tasklist`.
**Verificado con `node -e`** sobre `reduceFocus`/`matchFocusedAppId` reales:
una fila degradada (`appId: 'name:clipstudiopaint.exe'`) con una muestra de
foco `{ exePath: 'C:\\...\\CLIPStudioPaint.exe', name: 'Clip Studio Paint' }`
pasa a `running` y acumula 5000ms tras 5s de foco. Nota de entorno: el
`path` nativo de Node en este WSL2 es POSIX y no separa por `\`; se parchea
`path.basename = path.win32.basename` solo en el arnés de verificación para
reproducir fielmente la semántica de Windows en la que corre el main process
en producción (D10/ADR-0004) — no es un cambio de comportamiento del fix.
Control negativo corrido contra `monitor-engine.js` en `HEAD` (antes del
fix): la misma fila y la misma muestra de foco quedan en `paused`/`0ms`,
reproduciendo exactamente el defecto del judgment-report.

**Pendiente de confirmar en Windows** (no ejecutable desde este entorno,
declarado también en el judgment-report):
- El string exacto que `active-win` entrega en `owner.name`/`owner.path`
  para un proceso real con Description, y que `path.win32.basename` sobre
  ese `exePath` real coincide con el nombre de imagen que entrega `tasklist`.
- El comportamiento de `app.quit()` con escrituras encoladas pendientes en
  `diskWriteQueue` (F1 no lo tocó; sigue siendo la misma limitación que ya
  declaraba S1).
- El flujo visual de punta a punta: fila degradada con foco real sobre un
  proceso elevado acumulando tiempo en pantalla, y que una falla real de
  disco (antivirus/OneDrive bloqueando el archivo) no deje la app pidiendo
  íconos en bucle.

Ninguno de los dos fixes tocó lógica fuera de los archivos y funciones que
señalaba el judgment-report; no se aprovechó la iteración para refactorizar
nada adicional (alcance acotado explícito del despacho).

## 2026-08-02 | debt-candidate | Modal de historial muerto en CronometroAplicacion.vue

**Detectado por**: sdd-explore en `sessions-groups-history`
**Ubicación**: `src/components/CronometroAplicacion.vue` líneas 33-45 (template) y 61-84 (script)
**Descripción**: El template referencia `showHistory`, `selectedDate`, `filteredLogs` y
`loadLogsForDate`, ninguno de los cuales existe en `data()`, `computed` ni `methods` del
componente. El botón que abre el historial real (`openHistoryWindow()`, línea 79) envía
`open-history-window` por IPC y abre la ventana separada de `src/history/HistoryView.vue` —
funciona. El bloque `<div v-if="showHistory">` es un segundo modal de historial, inline,
que nunca puede mostrarse (`showHistory` es siempre `undefined`, por lo tanto falsy) y
duplica el propósito de la ventana real con una UI distinta (tabla plana con
inicio/fin/duración por línea de log, sin agrupar). Es probable que sea un remanente de una
implementación anterior a la ventana de historial separada. Este cambio (`sessions-groups-history`)
toca tanto `CronometroAplicacion.vue` (punto 1, deselección) como el historial (puntos 5-6),
así que es candidato a limpiar en el mismo cambio o a extraer como debt separado si no encaja
en el alcance de `sdd-design`.
**Promoción sugerida**: `sdd new remove-dead-history-modal --domain debt` (si `sdd-design` de
este cambio decide no tocarlo directamente al modificar `CronometroAplicacion.vue`)

## 2026-08-02 | architecture | Historial estructurado en sessions.json con migración one-shot

Decisión: el historial pasa de `usage-log.txt` (texto plano + regex) a `sessions.json`
estructurado, con lectura y escritura en un único módulo (`session-log.js`) y migración
one-shot idempotente que publica por renombre y nunca borra el original.
Justificación: tres campos nuevos escritos por el usuario o por el modelo de grupos
(`sessionName`, `groupId`, `groupName`) y una consulta por rango arbitrario vuelven
insostenible el formato de texto. Enmienda —no supersede— la cláusula de ADR-0006 que
conservaba `usage-log.txt`; el resto de ADR-0006 sigue vigente y `sessions.json` lo obedece.
ADR: [[0007-structured-sessions-json-with-one-shot-migration]]

## 2026-08-02 | architecture | Sesiones y grupos como metadata sobre entradas, no entidades

Decisión: `sessionName`, `groupId` y `groupName` son campos de la fila en memoria del main,
copiados a la entrada del historial al cerrarse. No hay colección de grupos, ni archivo de
grupos, ni total persistido: todo total de grupo es derivado (suma de duraciones del período).
La pertenencia a un grupo viaja como intención al main; el renderer nunca es dueño de ese
estado (ADR-0002).
ADR: [[0008-sessions-and-groups-as-entry-metadata]]

## 2026-08-02 | architecture | Selección tipada manual/auto con baja atómica en el reductor

Decisión: campo `type` en `monitored-selection.json` (ausente = `auto`), y la baja de la
entrada manual se resuelve **dentro de `reduceLifecycle`**, en el mismo paso que la baja de la
fila y antes de evaluar altas. El reductor pasa a devolver `{ rows, selection, closed }` y
sigue siendo puro. Resuelve por construcción el riesgo de probabilidad Alta de la propuesta
(fila que renace en el mismo tick + sesión fantasma de 0-1s).
ADR: [[0009-typed-selection-with-atomic-manual-removal]]

## 2026-08-02 | architecture | Librería de gráficos confinada al bundle de historial

Decisión: `chart.js@^4` + `vue-chartjs@^5` entran como dependencias nuevas, importadas
exclusivamente desde `src/history/`. La ventana del cronómetro no carga código de graficado.
Registro tree-shakable explícito, sin adaptador de fechas (el gráfico agrega por aplicación,
no por fecha).
ADR: [[0010-charting-library-confined-to-history-bundle]]

## 2026-08-02 | bug | Historial consulta el día equivocado por la tarde (zona horaria)

**Detectado por**: sdd-design en `sessions-groups-history` (validación V15)
**Ubicación**: `src/history/HistoryView.vue:81` (`loadLogsForDate`)
**Descripción**: filtra con `date.toISOString().split('T')[0]` (UTC) contra un campo `date`
que `src/main/session-log.js` escribe en hora **local** vía `formatDateYYYYMMDD`. Verificado
con `TZ=America/Santiago`: una fecha local del 2 de agosto a las 21:00 produce `2026-08-03`
por `toISOString()`. Efecto observable: abrir la ventana de historial después de ~20:00 en
Chile (UTC-4) consulta el día siguiente y muestra la lista vacía. Es **preexistente**, no
introducido por este cambio.
**Resolución**: entra en alcance de este cambio (D-10 de `design.md`): toda la ventana de
historial pasa a usar `formatDateYYYYMMDD` como fuente única de la fecha. Sin esto, el
criterio de aceptación "el gráfico coincide con la lista por aplicación" falla por la tarde.

## 2026-08-02 | finding | Duplicados en el listado de instaladas: 11 appId, no 3

**Detectado por**: sdd-design en `sessions-groups-history` (validación V8)
**Descripción**: `sdd-explore` estimó 3 entradas duplicadas en `installed-apps-cache.json`
(todas archivos de ayuda de WinRAR). El análisis completo del archivo real (106 entradas)
encuentra **11 `appId` repetidos**, y alcanzan a ejecutables legítimos: Steam, VLC (×3),
WinRAR, Cursor, Ollama, Python, wslg y MySQL. Tras el filtro `.exe` la deduplicación quita
**9 filas**, no 3. Resultado del filtro completo verificado: 106 → 91 (`.exe`) → 82 (dedup).
No cambia la decisión de alcance (la dedup ya estaba incluida), sí su magnitud e impacto
percibido: el defecto afectaba programas que el usuario reconoce, no solo ruido.

## 2026-08-02 | debt-candidate | Modal de historial muerto: RESUELTO en este cambio

**Actualización de la observación del 2026-08-02 (sdd-explore)**: el modal muerto de
`CronometroAplicacion.vue` (template 33-45) entra en alcance de `sessions-groups-history` y se
elimina en la etapa 5 (D-10 de `design.md`). Razón: este cambio ya reescribe ese componente
para el drag & drop de grupos, y el modal consume el canal `get-app-logs`, que D-9 elimina —
dejarlo sería dejar código muerto apuntando a un canal inexistente. **No hace falta promover
`remove-dead-history-modal` como cambio aparte.**

## 2026-08-02 | env-quirk | global | `node_modules` ausente en el worktree — bloquea `node -e` sobre cualquier archivo que haga `require('electron')` en su nivel superior

**Detectado por**: sdd-tasks en `sessions-groups-history`, al diseñar los criterios de
completado de la migración de historial.
**Descripción**: este worktree no tiene `node_modules` instalado. Cualquier módulo que haga
`require('electron')` en el nivel superior del archivo (`monitor-engine.js`,
`session-log.js`, `icon-cache.js`, `installed-apps.js`) falla con `MODULE_NOT_FOUND` al
requerirlo con `node -e` plano, **incluso si la función que se quiere probar es pura y no usa
`electron`** — el error ocurre al cargar el módulo, antes de llamar nada. Es preexistente a
este cambio (ya afectaba a `reduceLifecycle`/`reduceFocus`, que `design.md` de
`app-detection-logos-audio` ya documentaba como "verificables a mano" sin precisar el motivo).
Con `npm install` corrido una vez, `require('electron')` fuera del runtime de Electron
devuelve un string inofensivo en vez de lanzar, y el problema desaparece.
**Mitigación aplicada en `sessions-groups-history`**: los módulos puros nuevos
(`src/utils/session-aggregate.js`, `src/main/session-log-parser.js`) se diseñaron sin
ninguna dependencia de `npm` (solo `fs`/`path` del núcleo de Node), precisamente para que la
verificación con `node -e` no dependa de si `npm install` ya corrió. Ver `tasks.md` de este
cambio, sección "Refinamiento respecto de `design.md`", para el detalle completo.
**Promoción sugerida**: si esto sigue mordiendo verificaciones futuras, considerar un
`sdd new document-electron-require-quirk --domain debt` que deje esta convención (separar
lógica pura de módulos que requieren `electron`) explícita en `_profile.md`.

## 2026-08-02 | env-fix | package.json | Dependencia muerta `fluid-dnd` bloqueaba `npm install` por completo — removida

**Detectado por**: sdd-apply en `sessions-groups-history`, etapa 1, al intentar `npm install`
para poder correr ESLint/build y los `node -e` de Tarea 7 que requieren `require('electron')`
resuelto.
**Descripción**: `package.json` declaraba `"fluid-dnd": "file:../draggapleFluid/fluid-dnd/fluid-dnd-1.3.3-beta.0.tgz"`
apuntando a un archivo fuera del repo que no existe en este entorno (`_profile.md` ya lo
señalaba como dependencia muerta y de reproducibilidad frágil, sin ninguna referencia en
`src/`, junto con `@shopify/draggable`). `npm install` fallaba con `ENOENT` sobre esa ruta —
bloqueo total, no solo de esta dependencia: sin `node_modules` no corre ESLint (`vue-cli-service
lint` depende de plugins locales), no corre el build, y no se puede ejercitar
`reduceLifecycle`/`reduceFocus` de `monitor-engine.js` con `node -e` (requieren `electron`
resuelto, ver observación `env-quirk` anterior).
**Acción tomada**: se removió la línea `fluid-dnd` de `dependencies` en `package.json` (grep
confirmó cero referencias en `src/`) y se corrió `npm install`, que resolvió y actualizó
`package-lock.json` en consecuencia. `@shopify/draggable` se dejó intacto — no bloqueaba el
install y removerlo excede el alcance de `tasks.md`.
**Riesgo**: es un cambio fuera de las 26 tareas de `tasks.md`, hecho por necesidad de
infraestructura (sin él, la mitad de los criterios de completado de este cambio no son
verificables). No afecta comportamiento observable de la aplicación.
**Promoción sugerida**: `sdd new remove-dead-dnd-dependencies --domain debt` para evaluar
remover también `@shopify/draggable` de forma prolija (con su propio commit y verificación),
en vez de que quede como acción incidental de un cambio no relacionado.

## 2026-08-02 | unverifiable-in-env | Etapa 2 (íconos del selector) — escenarios que requieren Windows con la app corriendo

**Detectado por**: sdd-apply en `sessions-groups-history`, al cerrar la etapa 2.
**Descripción**: `icon-cache.js` usa `electron.nativeImage`/`app.getPath` y
`AppSelectorModal.vue`/`monitoredApps.js::ensureIcons` dependen de IPC real y del store
Pinia — ninguno de los dos es verificable con `node -e` sin Windows, tal como ya lo señala
`design.md` (Escenario 7 de la Estrategia de Testing). Lo verificado en esta fase: lint y
build limpios; el patrón de pool de concurrencia acotada a 6 replicado y simulado de forma
aislada (`node -e` con un mock async) confirma que el máximo simultáneo nunca supera 6 sobre
25 ítems fabricados. Queda sin verificar en este entorno: que una tanda real de N íconos
nuevos produzca una sola escritura de `app-icons-cache.json` (Tarea 4, checkbox de
verificación manual) y los tres escenarios de `selector-listing-icons` con la app abierta en
Windows (ícono real o respaldo por entrada, sin demora perceptible, sin repetir extracción en
aperturas siguientes).

## 2026-08-02 | env-quirk | verificación | `path.basename` sobre rutas Windows da resultado incorrecto al testear desde este host Linux/WSL

**Detectado por**: sdd-apply en `sessions-groups-history`, al verificar la reconciliación de
arranque de Tarea 7 (`loadSelection`/`isEntryAlive`) contra `monitored-selection.json` real.
**Descripción**: `require('path').basename(...)` en Node.js selecciona las reglas
posix/win32 según el **sistema operativo donde corre el proceso**, no según la forma de la
ruta que recibe. Con una ruta estilo Windows (`C:\Program Files\...\chrome.exe`) corriendo
`node -e` en este host Linux/WSL, `path.basename(...)` devuelve la ruta completa sin
recortar (no hay separador `/` que reconocer), en vez de `chrome.exe`. En producción, la app
corre en Electron sobre Windows, donde `require('path')` selecciona automáticamente las
reglas win32 y el mismo código funciona correctamente — no es un bug de esta fase, es
preexistente al patrón ya usado en `matchFocusedAppId` y en el descubrimiento condicionado
de `tick()` (ambos ya usan `path.basename(sFocus.exePath)`/`path.basename(entry.exePath)`
sin cambios de este cambio).
**Mitigación aplicada en la verificación**: usar `require('path').win32` explícitamente al
fabricar pruebas con rutas estilo Windows desde este entorno, en vez de `require('path')` a
secas. Con ese ajuste, la reconciliación de arranque verificada contra
`monitored-selection.json` real (Brave/Firefox/Chrome, ninguno con `type`) más un escenario
fabricado (Brave→manual+muerto descartado, Firefox→auto+muerto permanece, Chrome→manual+vivo
contra el `tasklist.exe` real permanece) da el resultado esperado en los tres casos.
**Promoción sugerida**: si `sdd-verify` repite esta clase de verificación, usar `path.win32`
para evitar un falso negativo que parezca un bug de `isEntryAlive`/`matchFocusedAppId` cuando
en realidad es un artefacto de correr node en el host Linux en vez de en el Windows real.

## 2026-08-02 | unverifiable-in-env | Etapa 3 (selección tipada, deselección, marcador visual) — escenarios que requieren Windows con la app corriendo

**Detectado por**: sdd-apply en `sessions-groups-history`, al cerrar la etapa 3.
**Descripción**: verificado en esta fase con `node -e` y entradas fabricadas: los tres
escenarios de `reduceLifecycle` del criterio de Tarea 7 (carrera resuelta, misma referencia
sin cierres, auto permanece), la reconciliación de arranque contra `monitored-selection.json`
real + `tasklist.exe` real (manual muerto descartado, auto muerto intacto, manual vivo
permanece — con la salvedad de `path.win32` para simular Windows desde este host, ver
observación `env-quirk` anterior), y los controles de no regresión (auto/legacy sin `type`
permanecen en `selection`). Lint y build limpios. Queda sin verificar en este entorno
(requiere la app real corriendo en Windows): Tarea 8 (desmarcar con el listado en el límite
de 4), Tarea 9 (verificación end-to-end de agregar en "Solo esta vez" y reiniciar el
cronómetro con el programa manual abierto/cerrado), Tarea 10 (el marcador se distingue "de un
vistazo" — la ausencia de desplazamiento de layout se verificó por lectura del CSS, `position:
absolute` sobre un contenedor de tamaño fijo).

## 2026-08-02 | unverifiable-in-env | Etapa 4 (persistencia estructurada) — escenarios que requieren Windows con la app corriendo

**Detectado por**: sdd-apply en `sessions-groups-history`, al cerrar la etapa 4.
**Descripción**: verificado en esta fase con `node -e` contra copias reales en el scratchpad
(nunca el `userData` real): Tarea 11 (`session-aggregate.js`, los 4 casos exactos de
`design.md`), Tarea 12 (`parseLegacyLog` contra los 32 líneas reales, incluida la línea
`Aplicación: null` y las 3 duplicadas de Chrome), Tarea 13 (migración idempotente, incluido
el corte a medio camino entre pasos 1 y 2), Tarea 17 (`get-sessions`/`get-session-dates`
recompuestos sobre `sessions.json` migrado: abril 2025 da 10 entradas ordenadas por
`startedAt`, 9 fechas únicas — coincide exactamente con V1 de `design.md`). Lint y build
limpios en todo momento. Queda sin verificar en este entorno (requiere la app real corriendo
en Windows, con IPC y disco reales):
- Tarea 15: que el primer arranque real deje `sessions.json` con 32 entradas y
  `usage-log.txt.bak` (la migración en sí ya se verificó de forma aislada en Tarea 13 sobre
  una copia; falta el camino completo `background.js` → `session-log.js` con Electron real).
- Tarea 16: que salir con 2+ filas abiertas registre una entrada por fila, por las dos rutas
  de salida (bandeja y `window-all-closed`). El camino síncrono se confirmó por lectura
  (ningún `await` entre `before-quit` y `jsonStore.writeJson`).
- Tarea 18: que renombrar una fila y cerrarla persista `sessionName` en `sessions.json`, y que
  `setRowGroup` sobre dos filas deje `groupId`/`groupName` iguales en el snapshot real.
- Tarea 19: los tres escenarios de interacción (click abre edición, Enter confirma y el
  snapshot lo refleja, Esc cancela) — requieren DOM real y teclado. La cuarta ("una fila sin
  `sessionName` se ve igual que antes") sí se verificó por lectura: `displayName` es
  `row.sessionName || row.name`, idéntico al `{{ row.name }}` anterior cuando `sessionName`
  es `null`.

## 2026-08-02 | unverifiable-in-env | Etapa 5 (grupos por arrastre) — requiere Windows con mouse real

**Detectado por**: sdd-apply en `sessions-groups-history`, al cerrar la etapa 5.
**Descripción**: drag & drop no es verificable con `node -e` ni con interop (requiere eventos
de mouse reales sobre un DOM renderizado). Verificado en esta fase: lint y build limpios; por
lectura, los dos `<draggable group="monitored-rows">` están sobre `dragUngrouped`/`dragGrouped`
derivados del `watch` con la guarda `isDragging`; `onUngroupedDragChange`/`onGroupDragChange`
solo actúan sobre `evt.added` (nunca `evt.removed`), traduciendo el gesto a
`setRowGroup(appId, groupId | null)`; el bloque del modal de historial muerto y toda
referencia a `showHistory`/`filteredLogs`/`loadLogsForDate` se confirmaron ausentes por
`grep`. Queda sin verificar en este entorno: agrupar, desagrupar, que un grupo vacío
desaparezca, y que un arrastre sostenido >1s no se rompa con un snapshot llegando en medio
(la guarda `isDragging` está implementada pero su efecto solo se observa con un timer real de
1000ms y un gesto de mouse real).

## 2026-08-02 | design-gap-fixed | vue.config.js | ADR-0010 asumía confinamiento que el build por defecto no daba — corregido en sdd-apply

**Detectado por**: sdd-apply en `sessions-groups-history`, etapa 6a, al inspeccionar el build
tras agregar `chart.js`/`vue-chartjs`.
**Descripción**: `design.md`/ADR-0010 afirman que, por tener `history` como página separada de
`index` en `vue.config.js`, "lo que se importe desde la ventana de historial no entra al
bundle de la ventana del cronómetro" — verificado solo leyendo la configuración de páginas, no
el output real del build. El `splitChunks` por defecto de `vue-cli-service`
(`node_modules/@vue/cli-service/lib/config/app.js`) usa un único `cacheGroup` con
`test: /node_modules/` y `name: 'chunk-vendors'` fijo, sin distinguir por entrada: **todo**
node_modules de **ambas** páginas termina en el mismo archivo, que `index.html` también carga.
Confirmado con el build real: tras agregar las dependencias, `chunk-vendors.js` pasó de 513 KiB
a 699 KiB, y `dist/index.html` (la ventana del cronómetro, siempre abierta) referenciaba ese
archivo — violación directa de la invariante que el ADR fija como "la que hay que sostener".
**Acción tomada**: `vue.config.js` gana un `chainWebpack` que separa `chart.js`/`vue-chartjs`
en su propio `cacheGroup` (`chunk-chart-vendors`), y `pages.history.chunks` lo agrega
explícitamente mientras `pages.index.chunks` lo excluye. Verificado tras la corrección:
`chunk-vendors.js` vuelve a 522 KiB (la línea base sin chart.js), `chunk-chart-vendors.js`
(177 KiB) existe aparte, `dist/index.html` no lo referencia y `dist/history.html` sí; grep de
la firma `Chart.js v...` da 8 matches en `chunk-chart-vendors.js` y 0 en `chunk-vendors.js`.
**Riesgo**: es una corrección de infraestructura de build fuera de las 26 tareas de
`tasks.md`, necesaria para que el comportamiento real cumpla lo que el ADR de esta misma fase
declara. No afecta ningún acceptance criteria de las specs (es la condición para que
`charting-library-confined-to-history-bundle` sea cierto, no un requisito propio).

## 2026-08-02 | unverifiable-in-env | Etapa 6a (historial: vistas + gráfico del día) — requiere Windows con la ventana de historial abierta

**Detectado por**: sdd-apply en `sessions-groups-history`, al cerrar la etapa 6a.
**Descripción**: verificado en esta fase: lint y build limpios; la corrección de zona horaria
V15 reproducida y confirmada con `TZ=America/Santiago node -e` (`formatDateYYYYMMDD` da
`2026-08-02` a las 21:30 hora de Chile, `toISOString().split('T')[0]` da `2026-08-03` —
confirma el bug viejo y la corrección nueva); ningún componente de presentación
(`ByAppView`/`BySessionView`/`UsageChart`) hace IPC propio (grep sin resultados); el
confinamiento del bundle de gráficos, corregido y verificado (ver observación
`design-gap-fixed` de esta misma fecha). Queda sin verificar en este entorno (requiere
Electron real, IPC real y un canvas renderizado): que el calendario muestre los puntos
correctos al hacer click, que `ByAppView` reproduzca visualmente la tabla anterior, que
`BySessionView` muestre el orden cronológico correcto con grupos como bloque, y que
`UsageChart` renderice barras legibles con scroll cuando hay más aplicaciones de las que
caben.

## 2026-08-02 | unverifiable-in-env | Etapa 6b (alcance mes/rango) y controles de no regresión finales — requieren Windows con la app corriendo

**Detectado por**: sdd-apply en `sessions-groups-history`, al cerrar la etapa 6b (última etapa
del cambio).
**Descripción**: verificado en esta fase con `node -e`, reproduciendo exactamente la lógica de
`chartInterval`/`chartLabel` de `HistoryView.vue`: alcance día → `{from:'2026-08-15',
to:'2026-08-15'}` con rótulo "15 ago 2026"; mes → `monthBounds` da
`{from:'2026-08-01', to:'2026-08-31'}` con rótulo "Agosto 2026"; rango 12→19 agosto da
`{from:'2026-08-12', to:'2026-08-19'}` con rótulo "12–19 ago" — los tres coinciden con los
ejemplos exactos de `design.md`. Lint y build limpios; el confinamiento del bundle de
gráficos (observación anterior) se re-verificó tras esta etapa y sigue intacto. Por lectura:
`dayEntries` (que alimenta `ByAppView`/`BySessionView`) depende solo de `selectedDate`, nunca
de `chartScope` — las dos listas no pueden cambiar cuando cambia el alcance del gráfico.
Queda sin verificar en este entorno (requiere Electron real con `<v-date-picker>` renderizado
y datos reales de más de un día): que elegir mes o rango en la app real muestre los totales
correctos con las listas ancladas al día. También quedan sin cerrar los dos controles de no
regresión transversales de `tasks.md` (detener/cerrar proceso con entradas `auto` sigue
igual; el límite de 4 con y sin agrupar) — su equivalente a nivel de reductor puro ya se
verificó en la etapa 3 (`reduceLifecycle` con entradas `auto`), pero el control transversal
tal como está escrito pide la app real corriendo.

## 2026-08-02 | finding | sessions-groups-history | sdd-verify: PASS, cero defectos, tres verificaciones que exceden lo ya documentado

**Detectado por**: sdd-verify en `sessions-groups-history`, al cerrar la fase (ver
`verify-report.md` para el detalle completo por spec y por punto de escrutinio).
**Descripción**: se auditaron contra el código real (no solo se releyeron afirmaciones de
`sdd-apply`) los 10 puntos de escrutinio marcados por fases previas — reductor con baja
atómica, migración, `before-quit` sincrónico, batching de `persistToDisk`, guarda
`isDragging`, deselección, confinamiento del bundle, fix de encoding, bug de zona horaria,
remoción de `fluid-dnd` — y las 10 specs completas. Cero defectos de implementación. Tres
verificaciones fueron más allá de lo que el entorno había permitido hasta ahora: (1) el
comando PowerShell real de `listOpenWindows()`/`buildInstalledAppsScript()` corrido contra
`powershell.exe` de esta máquina Windows vía interop, incluida una enumeración completa de 188
accesos directos del Menú Inicio con el pipeline de filtro+dedup real (188→82, 0 nombres
corruptos); (2) el batching de `persistToDisk` bajo concurrencia real fabricada (20
extracciones con `setTimeout` variable, no un mock síncrono) — 1 escritura, 20 entradas; (3)
`closeRow`/`closeAllRows`/`renameSession`/`setRowGroup` ejercitados end-to-end contra
`monitor-engine.js`/`session-log.js` reales con `app.getPath` mockeado y disco real bajo el
scratchpad, lo que permitió marcar 8 acceptance criteria que `sdd-apply` había dejado sin
marcar por asumir que requerían Windows, cuando en realidad requerían disco real + las
funciones del main process, ambos ejercitables sin Electron.
**Hallazgo secundario (grafo de specs)**: 4 inconsistencias de metadata tipo "u debería
declarar depends_on/related: [[s]]" (dirección `affects`, no auto-corregible por regla) — 3 de
ellas en specs de un cambio ya cerrado (`app-detection-logos-audio`: `simultaneous-limit`,
`empty-state`, `automatic-bw-icons` siguen con `depends_on: [[row-lifecycle]]`, el slug viejo,
en vez de `[[row-lifecycle-persistence-by-type]]`) y 1 dentro de este mismo cambio
(`sessions-json-persistence` no declara `deselect-from-saved-selection` de vuelta). No
bloquean el archive — el slug viejo sigue resoluble vía `superseded_by`. Corrección aplicada
(tipo auto-corregible, dirección `depends_on`): `automatic-bw-icons.affects` ahora incluye
`[[selector-listing-icons]]`.
**Promoción sugerida**: si un cambio futuro toca `app-monitoring`, actualizar el `depends_on`
de `simultaneous-limit`/`empty-state`/`automatic-bw-icons` al slug vigente — requiere juicio
(`depends_on` vs. `related`), no se auto-corrige.

## 2026-08-02 | correction | sessions-groups-history | F1-F4 de sdd-judgment (iteración 1) corregidos

**Fase**: sdd-apply (tras veredicto FAIL de sdd-judgment, iteración 1 de 2). Spec:
`[[judgment-fixes-sessions-groups-history]]`. Detalle completo con evidencia en
`changes/sessions-groups-history/judgment-report.md`.

**F1 — `aggregateByApp` fusionaba programas migrados (`session-aggregate.js`, commit
`bb8d3c4`)**. La clave de agrupación pasa de `entry.appId` desnudo a una que degrada al nombre
del programa (`name:<app>`) cuando `appId` es `null` — el caso de las 32 entradas migradas
reales de este entorno. Se agrega `key` a cada fila del agregador para que `ByAppView.vue`
deje de usar `row.appId` (no único entre filas degradadas) como `:key` del `v-for`.
`UsageChart.vue` no necesitó cambios: usa `row.app` como label, nunca `row.appId`.
**Verificado con `aggregateByApp` real** sobre las 32 entradas migradas del `usage-log.txt` de
producción de este entorno (copiado a scratchpad, nunca escrito en `/mnt/c`): control negativo
contra `git show HEAD:src/utils/session-aggregate.js` reproduce exactamente la tabla del
judgment-report (6/9 días fusionan programas, con las mismas duraciones erróneas); post-fix
los 9 días separan cada programa con la suma de duración exacta y sin colisión de `key`.

**F2 — `closeAllRows` no detenía el motor (`monitor-engine.js`, commit `ad7ca33`)**. Una línea:
`stopEngine()` al inicio de `closeAllRows`. Sin ella, un `tick()` suspendido en el `await` de
`getForegroundWindow()` durante `before-quit` resucitaba la fila desde `selection` al resumir,
y un tick posterior con el proceso muerto escribía una segunda entrada para la misma sesión.
**Verificado contra `monitor-engine.js` real, con el timer real** (sin tomar control manual de
los ticks, para no invalidar la prueba): mock de `electron`/`platform-windows`/`session-
log`/`json-store` por inyección directa en `require.cache`. Control negativo contra `git show
HEAD:src/main/monitor-engine.js` reproduce la secuencia completa del judgment-report byte a
byte (2 escrituras, la segunda vía `appendSession` para la fila resucitada); post-fix el
conteo queda en 1 escritura incluso esperando 1.5s reales más allá del próximo intervalo — el
`callCount` de `getForegroundWindow` confirma que ningún tick3 llegó a arrancar.

**F3 — Historial reescrito sin atomicidad (`json-store.js`+`session-log.js`, commit
`cfedccf`)**. Se agrega `writeJsonAtomic` (mismo patrón tmp+rename que `migrateLegacyLogAt`,
ADR-0007) y solo `session-log.js::appendSessions` pasa a usarlo; `writeJson` queda intacto
para el resto de los consumidores (selección, settings, cachés) — decisión explícita de
alcance acotado, no DRY hacia una atomicidad universal que ningún otro consumidor necesita.
Esto **revoca parcialmente** una alternativa que ADR-0007 había descartado por YAGNI
asumiendo que el dato en riesgo era "una sesión, no el historial" — premisa incorrecta, porque
`appendSessions` ya reescribía el archivo completo. Se agregó una nota de corrección inline en
ADR-0007 (sección Alternatives Considered) apuntando a esta spec, siguiendo el mismo patrón de
enmienda que ADR-0007 ya usa sobre ADR-0006.
**Verificado simulando en disco el estado que deja una interrupción real** (no se puede matar
a medias un `fs.writeFileSync` propio desde el mismo proceso Node): escritura truncada directa
al destino lo corrompe entero (control, reproduce el riesgo que describía el judgment-report);
la misma interrupción simulada durante la escritura del `.tmp` deja el destino intacto byte a
byte con el contenido previo, y una `writeJsonAtomic` sin interrumpir publica el contenido
nuevo completo.

**F4 — Deduplicación de instaladas sin criterio de nombre (`installed-apps-filter.js`, commit
`d5e14de`)**. Criterio elegido: nombre más corto gana la colisión (empate → primera
aparición, igual que antes). Se descartó el criterio alternativo de patrones de sufijo
("- Unicode", "- reset preferences...") por ser más frágil y requerir mantener una lista de
patrones nueva; el nombre más corto resuelve los tres casos reales sin heurística adicional.
**Verificado con el script PowerShell real de `buildInstalledAppsScript`** (sin modificarlo)
contra la máquina Windows de este entorno vía interop WSL2 (`execFile` con argv en array, no
`exec` con shell — `exec` sobre `/bin/sh` expande `$_`/`$root`/etc. del script de PowerShell
como si fueran variables de shell antes de que `powershell.exe` las reciba, un artefacto del
arnés de verificación en WSL2, no del código real que corre bajo `cmd.exe` en Windows): 188
accesos directos crudos → 82 mostrados, mismo conteo que el judgment-report. Control negativo
contra `git show HEAD:src/main/installed-apps-filter.js` reproduce los dos `MISMATCH` exactos
del judgment-report (MySQL y VLC con el nombre de un acceso directo secundario); post-fix
ambos muestran su nombre principal, y Python (que ya salía bien por azar del orden de
enumeración) sigue mostrando `Python 3.12 (64-bit)`.

**Pendiente de confirmar en Windows** (no ejecutable desde este entorno, mismo tipo de brecha
que el resto del cambio): el flujo de punta a punta de F2 (antes-de-quit real de Electron, no
simulado) y F1/F4 con la app real renderizando (en vez de las funciones puras invocadas
directo).

**Hallazgo adyacente, fuera de alcance**: varios artefactos de fases previas de este mismo
cambio (`proposal.md`, `design.md`, `exploration.md`, `tech-context.md`, `clarifications.md`,
`verify-report.md`, `judgment-report.md`, ADRs 0007-0010) existen en el worktree pero nunca se
commitearon — el código que documentan sí está commiteado (ver `git log`), la documentación
que lo respalda no. No se resuelve acá: excede el alcance de "exactamente los 4 defectos" del
despacho, y tocar ese backlog de commits mezclaría objetivos de fases no relacionadas con esta.
Candidato a resolver en `sdd-archive` o en un `chore(sdd)` dedicado antes de cerrar el cambio.

---

## 2026-08-02 | finding | sessions-groups-history | sdd-judgment iteración 2: PASS contra dos `fail` de los jueces, con dos limitaciones conocidas registradas

Los cuatro defectos de la iteración 1 (F1–F4) quedaron corregidos y verificados con control
negativo propio del adjudicador contra el sistema real: `aggregateByApp` sobre las 32 entradas
migradas reales (9/9 días separan cada programa, antes 6/9 fusionaban), `monitor-engine.js` real
con timer real (2 escrituras pre-fix → 1 post-fix), `json-store.js` contra NTFS real (destino
ilegible pre-fix → historial previo intacto post-fix) y el script PowerShell real de instaladas
(188 → 82, MySQL y VLC con su nombre principal).

Los dos jueces retornaron `fail`; el adjudicador retornó `pass`. Ninguno de los dos hallazgos es
compartido como bloqueante: el único `confirmed` lo califica Judge B como "no bloqueante por sí
solo", y el `fail` de Judge B descansa en un hallazgo que Judge A revisó y cerró sin defecto.
Detalle completo en `judgment-report.md` (iteración 2). Las dos limitaciones que quedan vivas:

- **[conocida] La fila resucita en memoria tras `closeAllRows`** (`monitor-engine.js:412-418`).
  `stopEngine()` impide ticks nuevos pero no cancela el tick ya suspendido en el `await` del
  foco, que reanuda y recrea la fila desde `selection` (que el cierre nunca toca). Deja
  literalmente incumplida la conjunción "ninguna fila vuelve a existir" del Requirement de
  `[[judgment-fixes-sessions-groups-history]]`, pero sin consecuencia alcanzable: las dos vías al
  duplicado —un segundo `closeAllRows` (Electron emite `before-quit` una sola vez por secuencia
  de salida) y un ■ del usuario durante el desarme del proceso— se probaron y ninguna es
  alcanzable en la práctica. **Endurecimiento de una línea para un cambio futuro**: vaciar
  también `selection` dentro de `closeAllRows`, con lo que el paso de altas de `reduceLifecycle`
  se queda sin nada sobre qué dar de alta y la vía queda cerrada por construcción.
- **[conocida] `writeJsonAtomic` es más frágil que `writeJson` ante un bloqueo que niega el
  borrado** (`json-store.js:34-38`). Matriz de share modes medida contra NTFS real:
  `FileShare::ReadWrite` → `writeJson` OK / `writeJsonAtomic` `EACCES` (única regresión);
  `ReadWrite, Delete` (el que usan antivirus e indexadores convencionalmente) → ambos OK;
  `Read` y `None` → ambos fallaban ya antes. El intercambio es favorable y ninguna spec cubre el
  comportamiento ante bloqueos de terceros, pero la excepción no la captura nadie (ADR-0006
  declara la persistencia sin `try/catch` por diseño), así que en ese caso se pierden las
  sesiones que se estaban cerrando —el historial previo queda intacto—.

Nota de método reutilizable: la matriz de share modes de Windows (`FileShare::None` / `Read` /
`ReadWrite` / `ReadWrite, Delete`, sostenidos desde PowerShell con `[System.IO.File]::Open`
mientras Node escribe) es la forma de decidir si un tmp+rename es una mejora o una regresión
frente a una escritura directa. Sin esa matriz, el hallazgo parece un `high` bloqueante; con
ella, se ve que la regresión vive en un único share mode y que los bloqueos más estrictos
rompían igual el código anterior.

Limitación de entorno registrada: no se pudo contar empíricamente cuántas veces Electron emite
`before-quit` (el binario de `node_modules/electron` 13.6.9 no levanta acá por `libnss3.so`
ausente). Esa parte del análisis es razonamiento sobre el diseño documentado de Electron, no
ejecución.

## 2026-08-05 | design-decision | work-groups-history-time-format | sdd-spec: delta del ítem 3 partido en dos specs sucesoras, capability `app-settings` nueva

**Fase**: sdd-spec. Ocho specs nuevas creadas (una por ítem del ticket, salvo 5+6 que se
mantuvieron separadas — ver justificación en el `Purpose` de cada una — y el ítem 3, que
generó dos specs por la razón de abajo).

**Delta obligatorio del ítem 3** (agrupación por nombre visible normalizado, en vez de
`appId` degradado): el orquestador pidió aplicar la operación delta completa sobre las dos
specs `completed` que el nuevo criterio contradice —
[[usage-chart-by-interval]] (ahora superseded) y
[[judgment-fixes-sessions-groups-history]] (ahora superseded), que documenta 4 correcciones
de judgment (F1-F4) donde solo F1 queda afectada. Decisión tomada: **dos specs sucesoras**,
no una sola que supersediera a ambas — [[usage-aggregation-by-visible-app-name]] (MODIFY de
`usage-chart-by-interval`, restablece las 8 Requirements originales de selección de
alcance/rotulado/scroll sin cambios y agrega el criterio de agrupación por nombre) y
[[judgment-fixes-sessions-groups-history-revised]] (MODIFY de `judgment-fixes-...`,
restablece F2/F3/F4 sin cambios y retira F1, con puntero hacia la spec anterior). Alternativa
descartada: una única spec sucesora con `supersedes` como array apuntando a ambas — se
descartó porque hubiera mezclado en un mismo documento el criterio de agrupación del gráfico
con las correcciones de cierre de sesión/escritura atómica/nombre de instaladas, violando
"una spec = un comportamiento atómico" con más fuerza que mantener dos sucesoras separadas.

**Capability nueva `app-settings`** (spec [[configurable-time-format-preference]], ítem 6):
ninguna de las 8 capabilities existentes cubre el panel de configuración (`OpcionesPanel.vue`
+ `settings.json`) fuera del volumen (`audio-volume`). Se creó la capability nueva en vez de
forzar la preferencia de hora dentro de `history-window` (que solo describe lo que se
muestra, no la preferencia en sí) o de `audio-volume` (tema no relacionado).

**Ajustes de `affects` en specs preexistentes** (inverso declarativo de los `depends_on`
nuevos, por regla del grafo de interconexión): `group-composition-and-drag` →
`multiple-simultaneous-groups`; `inline-session-naming` → `readable-session-title-typography`;
`session-view` → `session-time-without-seconds`.

## 2026-08-05 | env-quirk | work-groups-history-time-format | El bundle del main process de `vue-cli-plugin-electron-builder` usa un webpack/acorn que no parsea `??` (nullish coalescing, ES2020) — falla con "Module parse failed: Unexpected token", mensaje típico de ausencia de loader, no de API en runtime. El renderer (misma versión de Vue CLI Service) compila `??` sin problema: son dos pipelines de webpack distintos dentro del mismo proyecto. Object spread (`{...a, ...b}`, ES2018) sí compila en el main sin problema — no es todo ES2020+ lo que rompe, específicamente `??`/`?.`. Regla práctica para código compartido main+renderer (`src/utils/*.js`): evitar `??` y `?.`, usar `== null` / `!= null` explícito.

## 2026-08-06 | pre-adr | open-source-readiness | Electron 13 (2021) está EOL y sin parches de seguridad. Subir de versión mayor exige migrar el módulo `remote` (removido en Electron 14), usado hoy en `src/components/Menu.vue:55`, `src/components/TitleBar.vue:84` y `src/history/TitleBar.vue:23` vía `require('electron').remote`. Fuera de alcance de `open-source-readiness` — requiere un cambio propio (migración a `@electron/remote` o IPC directo).
## 2026-08-06 | pre-adr | open-source-readiness | `vue-cli-plugin-electron-builder` está sin mantenimiento activo upstream. Es el sistema de build activo confirmado del proyecto (ver `_profile.md`); reemplazarlo excede el alcance de `open-source-readiness`, que solo consolida en él (elimina el `forge.config.js` sin personalizar) sin migrar de librería.
## 2026-08-06 | pre-adr | open-source-readiness | La UI de la app está 100% en español hardcodeado (sin capa de i18n) — un proyecto open source con marca internacional (Tickmark) eventualmente necesitará internacionalización. Fuera de alcance de `open-source-readiness`.
## 2026-08-06 | gap | open-source-readiness | Los 36 archivos de `memory/` (specs y ADRs del pipeline SDD, trackeados en git) quedan expuestos en un repo open source y pueden confundir a un contribuidor externo que no usa el pipeline SDD. Fuera de alcance resolverlo en este cambio — evaluar en `sdd-propose` si corresponde `.gitignore`, mover a un repo separado, o documentar su propósito en `CONTRIBUTING.md`.

## 2026-08-05 | env-quirk | work-groups-history-time-format | La copia Windows preparada para verificación visual (`C:\Users\Luis Araya\dev\cronometro-app-win`) vive en el escritorio real y en uso activo del usuario, no en una sandbox dedicada. Al tomar una captura de pantalla completa para ubicar el ícono de bandeja, apareció una partida de League of Legends en selección de campeón en curso. `sdd-verify` suspendió toda interacción de mouse adicional de inmediato (ningún clic dirigido a la app) y solo hizo limpieza no interactiva (`taskkill` por PID). Ítems de Franja B/C de este cambio quedaron sin verificar por este motivo, además de por la build rota. Para una futura iteración: confirmar con el usuario una ventana de tiempo en la que la máquina esté libre antes de programar verificación visual automatizada, o preferir un entorno headless/dedicado si existe.

## 2026-08-06 | pre-adr | open-source-readiness | `app.getPath('userData')` resuelve por `package.json.name`, no por `productName`. Verificado extrayendo el `package.json` del `app.asar` instalado (`%LOCALAPPDATA%\Programs\cronometro-apps\Workout\resources\app.asar`): declara `name: "cronometro-apps"` y no tiene campo `productName` — electron-builder 22.14.13 con `vue-cli-plugin-electron-builder` 2.1.1 no inyecta el `productName` de `builderOptions` en el paquete. Corolario operativo: renombrar `productName`/`appId`/`executableName` es inocuo para la persistencia (ADR-0006); renombrar `package.json.name` reapunta `%APPDATA%/cronometro-apps` y deja el historial huérfano. Candidato a ADR en `sdd-design`.
## 2026-08-06 | gap | open-source-readiness | El input.md afirma "sin releases publicadas": es falso. Existen `v.1.0.0` (11 descargas) y `v1.0.1` (1 descarga), ambas con asset `Workout.Setup.*.exe` subido manualmente. Hay base instalada de terceros, así que la pérdida de `userData` por renombrado no es un riesgo hipotético. Además `package.json.version` (`1.0.0`) quedó por detrás del último tag publicado y la convención de tags es inconsistente (`v.1.0.0` vs `v1.0.1`).
## 2026-08-06 | env-quirk | open-source-readiness | La ruta de instalación de NSIS es `%LOCALAPPDATA%\Programs\{package.json.name}\{productName}`. Renombrar `productName` a Tickmark instala la app nueva junto a la vieja en vez de reemplazarla; ambas comparten `userData`, así que Tickmark abre con el historial completo y desinstalar Workout es opcional.
## 2026-08-06 | gap | open-source-readiness | Residuos y duplicaciones adicionales no listados en el input: (a) `electron-squirrel-startup` está en `dependencies` sin referencias en `src/` y viaja dentro del asar — residuo de electron-forge; (b) la config de ESLint está duplicada en `.eslintrc.js` (`plugin:vue/essential`) y en `package.json.eslintConfig` (`plugin:vue/vue3-essential`), lo que haría que el lint de CI no refleje el lint local; (c) `.sdd/` no está trackeado ni ignorado en `.gitignore`.
## 2026-08-06 | env-quirk | open-source-readiness | Los scripts `postinstall`/`postuninstall` ejecutan `electron-builder install-app-deps` en cada `npm ci`. En un job de lint sobre `ubuntu-latest` eso intenta resolver la versión de Electron y falla o encarece la instalación; el workflow de lint debe usar `npm ci --ignore-scripts`. Además `npm ci` con Node 24 emite EBADENGINE para `@achrinza/node-ipc`: CI necesita pinear una versión de Node compatible con el toolchain (vue-cli-service 5 + electron-builder 22).
## 2026-08-06 | pre-adr | open-source-readiness | `resources/app-update.yml` del build instalado apunta a `owner: larayap, repo: cronometro-app`, pero no hay `electron-updater` en dependencias: no existe auto-actualización activa. Renombrar el repo en GitHub no tiene efecto en runtime sobre la base instalada; solo importa para el destino del `publish` de electron-builder en el workflow de release.

## 2026-08-06 | pre-adr | open-source-readiness | La regla de migración de ADR-0007 ("si el destino ya existe, no migrar") no se traduce literalmente a la migración de directorio de `userData`: Electron crea y puebla el `userData` nuevo con estado propio de Chromium (`Cache/`, `Preferences`, `Local Storage/`) antes de `whenReady`, así que una condición a nivel de directorio nunca dispararía. La condición debe ser por archivo, sobre los 8 archivos que la app posee (`sessions.json`, `settings.json`, `monitored-selection.json`, `app-icons-cache.json`, `installed-apps-cache.json`, `pomodoro-sessions.json`, `usage-log.txt`, `usage-log.txt.bak`): cada uno se copia solo si no existe en destino. Eso preserva one-shot + idempotencia + no-destrucción del ADR-0007 y define el caso "ambos directorios poblados" como "el destino gana, archivo por archivo". Candidato a ADR en `sdd-design`.
## 2026-08-06 | pre-adr | open-source-readiness | La migración de `userData` debe correr antes de `sessionLog.migrateLegacyLog()` (`src/background.js:90`) y antes de cualquier lectura de settings, cachés o selección monitoreada. Como `app.getPath('userData')` ya resuelve al directorio nuevo tras renombrar `package.json.name`, el origen se calcula explícitamente con `path.join(app.getPath('appData'), 'cronometro-apps')`.
## 2026-08-06 | decision | open-source-readiness | Iteración 2 de `sdd-propose`: el usuario cambió el nombre del producto de Tickmark a **Work Tracker** y eligió la opción B de la clarification 1 (renombrar `package.json.name` a `work-tracker` CON migración one-shot), en contra de la recomendación A (congelar el `name`). Consecuencia asumida: la invariante "este cambio no modifica el comportamiento de la aplicación" se relaja de forma acotada para ese único ítem. Versión de la primera release: `2.0.0`. Autoría y copyright: `larayap`. README sin capturas. Trade-off advertido y asumido por el usuario: "work tracker" está saturado en GitHub y reduce el descubrimiento orgánico que era parte del objetivo del cambio.

## 2026-08-06 | phase-complete | open-source-readiness | `sdd-spec` generó 5 capability-specs nuevas (una por capability sugerida en el dispatch): `project-identity/unified-product-identity`, `userdata-migration/legacy-userdata-one-shot-migration`, `open-source-docs/community-contribution-documents`, `build-toolchain/single-build-and-lint-pipeline`, `release-automation/pr-lint-and-tagged-release-workflow`. Ninguna es delta de una spec preexistente: se verificaron `sessions-json-persistence`, `row-lifecycle-persistence-by-type` y `configurable-time-format-preference` (dueñas de los datos que la migración traspasa) y ninguna documenta la ubicación física del `userData` como parte de su Purpose/Requirements — solo el contenido y el momento de escritura — así que el traspaso de identidad no las vuelve obsoletas ni las modifica; queda enlazado por `related[]`/`affects[]` en ambas direcciones.
## 2026-08-06 | gap | open-source-readiness | Este cambio es `fast_path: spec-first`: no ejecuta `sdd-design`, así que la nota previa "Candidato a ADR en sdd-design" (migración por archivo) no se resuelve en un ADR formal. El diseño de la migración —condición por archivo, no por directorio; tmp+rename por archivo; el destino gana sin fusión— queda documentado únicamente en `proposal.md` §"Approach y trade-offs explícitos" y en los Requirements/Scenarios de `legacy-userdata-one-shot-migration.md`. `sdd-tasks` y `sdd-apply` deben seguir ese texto como fuente de diseño; si `sdd-judgment` corre sobre este cambio (high-risk por la migración), señalar la ausencia de ADR formal como riesgo a evaluar.

2026-08-06 | orchestrator-deviation | open-source-readiness | El orquestador fuerza `sdd-design` vía `sdd dispatch` fuera de la secuencia canónica de `spec-first` (init→propose→spec→tasks). Motivo: `sdd-spec` reportó como gap que el algoritmo de la migración de `userData` —código nuevo sobre datos irreemplazables de la base instalada, con la regla no obvia "condición por archivo, no por directorio"— queda sin ADR formal, cuando el proyecto documenta decisiones equivalentes en ADR-0006 y ADR-0007. `sdd-design` cierra transicionando a `sdd-tasks`, así que la secuencia se reincorpora sin efectos laterales.
2026-08-06 | orchestrator-deviation | open-source-readiness | Construcción del prompt de `sdd-design`: los ADRs relevantes (0004, 0006, 0007) se inyectan por path absoluto con instrucción de lectura obligatoria en lugar de contenido inline (415 líneas). Equivalente en fidelidad —el sub-agente los lee íntegros— y consistente con el patrón de escape hatch que `dispatch-logic.md` admite para specs relacionadas.

## 2026-08-06 | verification | open-source-readiness | `sdd-design` verificó la lista de 8 archivos de la propuesta contra el código real del worktree (barrido de todos los literales `*.json`/`*.txt` en `src/` y de todos los usos de `app.getPath('userData')`): la lista es exacta, no falta ni sobra ninguno. `sessions.json`, `usage-log.txt`, `usage-log.txt.bak` (`session-log.js:21/25/29`), `settings.json` (`ipc-handlers.js:15`), `monitored-selection.json` (`monitor-engine.js:451`), `installed-apps-cache.json` (`installed-apps.js:29`), `app-icons-cache.json` (`icon-cache.js:93`), `pomodoro-sessions.json` (`background.js:212`). Un noveno literal, `state.txt` de `src/utils/stateManager.js:6`, queda fuera a propósito: se escribe con `path.join(__dirname, ...)` —dentro del bundle, no en `userData`— y no tiene ninguna referencia en el resto del código (deuda ya declarada por ADR-0006).
## 2026-08-06 | pre-adr | open-source-readiness | Ninguna lectura de los 8 archivos ocurre antes de `whenReady`: los cinco módulos del main resuelven su ruta dentro de una función y la única resolución en nivel superior (`background.js:212`) arma un string sin tocar disco. Por eso el traspaso corre como primera sentencia de `app.whenReady()` y no dentro de `createWindow()`, que es reentrante (lo llaman `whenReady`, `showMainWindow()` y el handler de `activate`).
## 2026-08-06 | gap | open-source-readiness | El techo sintáctico real del bundle del main es **ES2018**, no ES2016: `src/main/ipc-handlers.js:63-66` usa object spread y compila. La falla dura empieza en ES2020 (`??`, `?.`), donde acorn 6.4.2 se queda corto. El diseño declara ES2016 igual como regla de trabajo porque el traspaso no necesita nada por encima y porque el modo de falla es caro (`npm run build` no compila el main). Matiz que precisa la nota de memoria `main-process-bundle-es2016-ceiling`.
## 2026-08-06 | decision | open-source-readiness | Segunda excepción acotada a la restricción "solo la migración toca `src/`": los tres literales `Workout` de presentación (`background.js:34` tooltip de bandeja, `background.js:65` título de ventana, `public/index.html:8`) pasan a `Work Tracker`. Sin eso queda incumplido un criterio de aceptación aprobado de `unified-product-identity` ("el título de la ventana muestra el nombre del producto"). Son literales sin efecto sobre ninguna lógica, dos de ellos en el mismo archivo que el traspaso ya modifica. Los identificadores internos `Cronometro*` (componentes y clases CSS) no se tocan.
## 2026-08-06 | gap | open-source-readiness | Migrar el lint a `plugin:vue/vue3-essential` destapa **un único error** en todo `src/` (medido ejecutando ESLint 7.32.0 con ambas configuraciones): `vue/no-deprecated-destroyed-lifecycle` en `src/components/CronometroManual.vue:76`. Es un defecto real, no estilo: `@vue/runtime-core` 3.5.13 desestructura `beforeDestroy` pero nunca lo pasa a `registerLifecycleHook`, así que ese `clearInterval` jamás corre al desmontar el componente y el intervalo queda vivo. Corregirlo cambia comportamiento, fuera del alcance de este cambio: la regla queda en `'warn'` (CI verde, señal visible) y el arreglo va como issue de roadmap con su propia verificación.
## 2026-08-06 | env-quirk | open-source-readiness | `vue-cli-service lint` corrige por defecto y `vue/no-deprecated-destroyed-lifecycle` es autocorregible: ejecutar `npm run lint` a secas renombraría `beforeDestroy` a `beforeUnmount` y cambiaría el comportamiento de la app sin que nadie lo pida. `sdd-apply`, `sdd-verify` y el workflow de CI usan `npm run lint -- --no-fix`.
## 2026-08-06 | pre-adr | open-source-readiness | Dos hallazgos verificados en el código instalado que condicionan el workflow de release: (a) electron-builder **no lee el tag** —arma el nombre de la release como `v` + `package.json.version`—, así que la guarda tag↔versión antes de compilar es lo único que impide publicar una release con nombre distinto del tag empujado; (b) el publicador de GitHub usa `draft` cuando no se le indica otra cosa (`electron-publish/out/gitHubPublisher.js:52`), y un borrador no es descargable para nadie que no sea mantenedor, así que el bloque `publish` necesita `releaseType: 'release'` explícito o el criterio de aceptación falla en silencio.
## 2026-08-06 | pre-adr | open-source-readiness | Node en CI se fija en `.nvmrc` (16.20.2) por una restricción dura: el webpack 4.47.0 anidado que arma el bundle del main hashea con `md4`, y desde Node 17 OpenSSL 3 lo rechaza (`ERR_OSSL_EVP_UNSUPPORTED`). Node 16 es la última mayor con OpenSSL 1.1.1 y su npm 8 lee el `lockfileVersion: 3` del proyecto. Contingencia documentada si `actions/setup-node` deja de resolver Node 16: Node 18 con `NODE_OPTIONS=--openssl-legacy-provider`.
## 2026-08-06 | gap | open-source-readiness | Cambiar `name`/`version` y dar de baja diez dependencias en `package.json` desalinea `package-lock.json` (su raíz y su entrada `packages[""]` declaran `name` y `version`), y **`npm ci` falla ante esa desalineación**: los dos workflows morirían en la instalación. `sdd-apply` debe ejecutar `npm install --package-lock-only` tras editar `package.json` y versionar el lock. El registro npm es alcanzable desde este entorno (verificado) y el lock actual está limpio: 1835 dependencias resueltas contra registry.npmjs.org, sin rastro del tarball inexistente de `fluid-dnd` que rompía `npm install` en la máquina Windows.
## 2026-08-06 | pre-adr | open-source-readiness | Invariante que ADR-0013 impone al resto del proyecto: `package.json` **no declara `productName`**. `app.getName()` lo prefiere sobre `name`, así que agregarlo movería el `userData` a `%APPDATA%/Work Tracker` y dejaría huérfano el traspaso recién hecho. Verificado en `vue-cli-plugin-electron-builder/index.js:159-173`: el plugin copia el `package.json` del proyecto al paquete sin inyectar campos. El nombre visible del producto vive solo en `builderOptions` de `vue.config.js`.
## 2026-08-06 | phase-complete | open-source-readiness | `sdd-design` cerró el gap que motivó su despacho excepcional: `design.md` (14 decisiones + Output Expected), `tech-context.md` (contexto de librerías externas verificado contra el código instalado, sin context7 por toolchain anclado varias mayores atrás), ADR-0013 (traspaso de `userData` archivo por archivo) y ADR-0014 (build único, Node fijado, ESLint único). El módulo del traspaso vive en `src/main/userdata-migration.js`, libre de `electron` y con rutas por parámetro —mismo desdoblamiento que ADR-0007—, lo que lo vuelve ejercitable con `node -e` desde WSL2: es la única verificación determinista disponible mientras el instalador no se pueda compilar localmente.
## 2026-08-06 | phase-complete | open-source-readiness | `sdd-tasks` produjo `tasks.md`: 6 fases ordenadas por dependencia (identidad → traspaso de userData → build/lint único → docs comunitarios → CI → issues de roadmap), 24 tareas con checklist, archivo(s) y criterio de completado observable. Dos tareas marcadas `[TDD]` (2.1/2.2, arnés de los 6 escenarios de `migrateUserDataAt` antes del código) por ser la única lógica del cambio verificable de forma determinista sin compilar. Cada criterio de completado distingue lo verificable en WSL2 (grep de literales, `node -e`, `npm run lint -- --no-fix`) de lo diferido a `sdd-verify` (niveles 2/3 de D-13: máquina Windows real y CI en `windows-latest`). `package-lock.json` se regenera una sola vez (Task 3.7), después de que Fase 1 y Fase 3 terminaron de editar `package.json`, para no regenerarlo dos veces.
## 2026-08-06 | gap | open-source-readiness | Task 3.6 pide correr `git check-ignore -v .sdd` "desde la raíz del repo, no del worktree" para verificar que `.gitignore` ignora `.sdd`. Corrido literalmente desde `/home/larayap/cronometro-app` (branch `main`, sin este cambio todavía) el comando NO matchea porque el `.gitignore` de `main` no tiene la línea nueva hasta el merge — es esperable: cada worktree ve su propio árbol de archivos según su branch. Corrido desde el worktree (`feature/open-source-readiness`, donde vive la edición real) sí matchea: `git check-ignore -v .sdd` → `.gitignore:29:/.sdd .sdd`, exit 0. La verificación real y suficiente es la del worktree; la del "repo root pre-merge" solo se cumplirá después de que este branch se mergee a `main`, momento en el que `.sdd/worktrees/...` (el directorio físico que contiene todos los worktrees) queda efectivamente ignorado desde la raíz real del repo.
## 2026-08-06 | env-quirk | open-source-readiness | Task 3.7: `npm install --package-lock-only` con npm 11.12.1 (el que trae Node 24 de este WSL2, no el Node 16 fijado en `.nvmrc`) SÍ dispara el script `postinstall` (`electron-builder install-app-deps`) pese a `--package-lock-only` — contradice la afirmación de `design.md`/D-12 ("el comando no descarga binarios ni ejecuta scripts"), verificada aparentemente con otra versión de npm. El script falla con exit 1 ("Cannot compute electron version...") porque no hay `node_modules/` en este worktree (nunca se instaló) — no hay carpeta para tocar, así que el fallo es inocuo y no corrompe nada. `package-lock.json` se regeneró correctamente antes de la fase de scripts: verificado con `node -e` — `lockfileVersion: 3`, `name`/`version` correctos en la raíz y en `packages[""]` (`work-tracker`/`2.0.0`), 15 `dependencies` y 20 `devDependencies` (coincide con package.json tras la Task 3.3), y ninguno de los 10 paquetes dados de baja aparece en el árbol resuelto (1655 paquetes, antes 1837). Para reproducir sin el ruido del postinstall: `npm install --package-lock-only --ignore-scripts`.
## 2026-08-06 | design-deviation | open-source-readiness | Verificación real de Task 3.4 (`npm run lint -- --no-fix`) destapó que la premisa de D-11/ADR-0014 para `lint.yml` — `npm ci --ignore-scripts` porque `postinstall` (`electron-builder install-app-deps`) es "innecesario para lintear y costoso/roto en Linux" — es doblemente incorrecta, verificado en este WSL2 (Ubuntu, entorno cercano a `ubuntu-latest`): (1) `--ignore-scripts` rompe el lint por completo, no solo lo hace más lento: `vue-cli-plugin-electron-builder/index.js:710` hace `require('./lib/testWithSpectron')` a nivel de módulo, que a su vez hace `require('electron')` a nivel de módulo (`testWithSpectron.js:2`); ese `require` se ejecuta al cargar el plugin para CUALQUIER comando de `vue-cli-service` (`lint` incluido, no solo `electron:build`), y sin el postinstall propio de `electron` (que descarga el binario y escribe `node_modules/electron/path.txt`) `node_modules/electron/index.js:17` lanza `Error: Electron failed to install correctly` antes de que ESLint corra. `npm ci --ignore-scripts` desactiva TODOS los scripts del árbol, incluido el de `electron` mismo, no solo el `postinstall` del proyecto. (2) Medido con `npm ci` sin `--ignore-scripts` (limpio, `rm -rf node_modules` primero): 12 segundos, `electron-builder install-app-deps` corre y termina en éxito (`rebuilding native dependencies dependencies=active-win@8.2.1 platform=linux arch=x64`, exit 0) — no está roto en Linux, al menos con `active-win@8.2.1`/`electron-builder@22.14.13`. **Corrección aplicada en Task 5.1**: `lint.yml` usa `npm ci` a secas, sin `--ignore-scripts`. Verificado end-to-end: `npm ci` (12s) + `npm run lint -- --no-fix` → exit 0, exactamente 1 warning (`vue/no-deprecated-destroyed-lifecycle` en `CronometroManual.vue:76`), igual que lo que predice Task 3.4. Deja una imprecisión registrada en ADR-0014/D-11 (afirma lo contrario) que no se corrige en el ADR — `sdd-apply` no edita ADRs — pero sí en el artefacto real (`lint.yml`) y acá, para que `sdd-verify`/`sdd-archive` lo tengan en cuenta.

## 2026-08-06 | phase-complete | open-source-readiness | `sdd-apply` implementó las 27 tareas de `tasks.md` en 5 commits atómicos sobre `feature/open-source-readiness`: `69e698b` (identidad → Work Tracker), `8bb03a7` (traspaso de userData, TDD con arnés de 6 escenarios sobre directorios reales — todos verdes), `319d1f3` (build único + lint único + `.nvmrc` + `package-lock.json` regenerado), `a692240` (LICENSE/README/CONTRIBUTING/CODE_OF_CONDUCT/plantillas), `81e7fbf` (lint.yml + release.yml). Verificación local exhaustiva: `npm run lint -- --no-fix` → 0 errores, 1 warning esperado (`CronometroManual.vue:76`); `npm run build` (renderer) → OK; guarda tag↔versión probada con `node -e` en ambos casos; YAML de ambos workflows parseado sin error. Los 5 specs quedaron en `status: review` con `commits`/`feature_branch` actualizados y acceptance criteria marcados según lo verificable a nivel 1 (local); lo que exige nivel 2 (máquina Windows) o nivel 3 (CI real en `windows-latest`/`ubuntu-latest`) queda explícitamente sin marcar, con nota en cada spec. Dos hallazgos no anticipados por el diseño, corregidos durante la implementación y documentados en detalle en entradas previas de esta bitácora: (1) `npm install --package-lock-only` con npm 11 dispara igual el `postinstall` del proyecto (inofensivo, no hay `node_modules/` que tocar); (2) la premisa de D-11/ADR-0014 de que `lint.yml` necesita `npm ci --ignore-scripts` es incorrecta — rompe el lint por completo (`vue-cli-plugin-electron-builder` requiere `electron` a nivel de módulo para cualquier comando) y la razón original (`electron-builder install-app-deps` "costoso/roto en Linux") no se sostuvo contra el código real (12s, sin error). `lint.yml` implementado usa `npm ci` a secas, con la desviación documentada inline en el propio YAML.

## 2026-08-06 | phase-complete | open-source-readiness | `sdd-verify`: **PASS**. Los 6 escenarios de `legacy-userdata-one-shot-migration` reproducidos de punta a punta con un arnés `node -e` propio (directorio temporal en `scratchpad/`, nunca `userData` real): limpio, con datos previos, segundo arranque, no-destrucción del origen, ambas identidades con datos distintos, interrupción a mitad de copia — los 6 en verde. Invariantes de mayor riesgo confirmadas: `package.json` sin `productName`, enganche como primera sentencia de `app.whenReady()` (no en `createWindow()`, reentrante), cero `??`/`?.` en todo lo alcanzable desde `background.js`, `package-lock.json` coherente (`name`/`version`/deps idénticos a `package.json`), lint en 0 errores/1 warning, `git diff` de `src/` limitado exactamente al módulo nuevo + enganche + 3 literales de presentación + 6 PNG muertos, `manual.png` intacto. Inspección de solo lectura vía interop Windows: la máquina disponible no tiene base instalada real (ni `cronometro-apps` ni `work-tracker` bajo `%APPDATA%`), así que el nivel 2 de D-13 sigue sin poder ejercitarse en este entorno — declarado como PARTIAL por entorno, no como defecto.

## 2026-08-06 | verification | open-source-readiness | Verifiqué de forma empírica (no solo leída) el argumento de la desviación D-11 que `sdd-apply` dejó documentada pero sin corregir en el ADR: oculté `node_modules/electron/path.txt` y corrí `node -e "require('vue-cli-plugin-electron-builder')"` — lanza `Error: Electron failed to install correctly` de inmediato, confirmando que `--ignore-scripts` en `lint.yml` rompería el lint job completo (el plugin reexporta `testWithSpectron` a nivel de módulo, que hace `require('electron')` en su primera línea, y `electron` necesita su propio postinstall para resolver el binario). La desviación está justificada. Actualicé `memory/adrs/0014-single-build-toolchain-and-pinned-node.md` (sección Decision) para reemplazar la premisa original de D-11 por la cadena de causalidad verificada, dejando el ADR coherente con `lint.yml` tal como quedó implementado.

## 2026-08-06 | metadata-fix | open-source-readiness | Coherencia de grafo: `legacy-userdata-one-shot-migration` declara `affects` hacia `sessions-json-persistence`, `row-lifecycle-persistence-by-type` y `configurable-time-format-preference` (specs completadas en cambios anteriores, antes de que este cambio existiera), pero ninguna de las tres tenía la referencia de vuelta. Inconsistencia solo de metadata (las tres specs existen) → corregida: agregué `[[legacy-userdata-one-shot-migration]]` al `related` de las tres (frontmatter + prosa), `updated` a 2026-08-06.

## 2026-08-06 | debt-candidate | open-source-readiness | Spot-check de dependencias más allá de las 2 que Task 3.3 auditó (`@shopify/draggable`, `electron-squirrel-startup`, ya removidas): `vue-router` y `vue3-datepicker` no tienen ninguna referencia en `src/` (ni import, ni `createRouter`/`useRouter`, ni en `vue.config.js`/`babel.config.cjs`). Preexistentes al cambio, fuera de su alcance aprobado — no se tocaron. Candidatas para `sdd new cleanup-unused-dependencies --domain debt`.
**Promoción sugerida**: `sdd new cleanup-unused-dependencies --domain debt`

2026-08-06 | oracle-false-negative | open-source-readiness | El oráculo C2 `post-verify-router.sh` devolvió `not-high-risk` en su primera invocación. Causa: lee `effort` y `risks[]` del frontmatter de `proposal.md`, y `sdd-propose` los escribió solo en el body (`## Esfuerzo` = "L, en el extremo alto"; tabla `## Riesgos` con 3 entradas de probabilidad Alta). Según la definición canónica de high-risk (`sdd-phase-common § High-risk change`), el cambio SÍ califica por ambos criterios. El orquestador corrigió la causa raíz —poblar el frontmatter con los valores que el body ya declaraba, sin alterar el contenido— y re-invocó el oráculo, en lugar de sobrescribir su decisión con un override manual. Deuda de proceso para el pipeline: `sdd-propose` debe emitir `effort` y `risks[]` en el frontmatter, no solo en prosa; de lo contrario todo change high-risk saltea `sdd-judgment` de forma silenciosa.

## 2026-08-06 | phase-complete | open-source-readiness | `sdd-judgment`: **PASS tras 2 iteraciones y 3 fixes de código** (`5453d15`, `778328e`). Los dos jueces independientes encontraron **por separado el mismo defecto `critical` y el mismo `medium`** — `confirmed` por la definición del formato. Causa raíz común: `usage-log.txt` es el único de los ocho archivos traspasados con un consumidor que lo muta dentro del mismo arranque (el paso 3 de ADR-0007 lo renombra a `.bak`), así que "el archivo no está en el destino" no servía como clave de idempotencia. **C1 (critical)**: si la copia de `usage-log.txt` fallaba en el primer arranque, el paso 1 de ADR-0007 publicaba `sessions.json = []`, y ese archivo vacío bloqueaba para siempre la absorción del log que llegara en el arranque siguiente — un fallo de E/S transitorio se volvía pérdida permanente de visibilidad del historial sobre datos irreemplazables. **C2 (medium)**: en el camino feliz, el arranque siguiente al traspaso encontraba el log ausente (ya renombrado a `.bak`) y lo recopiaba, duplicándolo — afectaba al 100 % de la base instalada. Ninguno de los dos era detectable con el arnés de `sdd-verify`, que ejercitó `migrateUserDataAt()` **aislada**; el defecto vive en el encadenamiento con `migrateLegacyLogAt()`. Lección para el pipeline: cuando un módulo nuevo escribe archivos que un módulo preexistente consume en el mismo arranque, verificar el módulo aislado no alcanza — hay que encadenar los módulos reales en el orden real del arranque.

## 2026-08-06 | verification | open-source-readiness | `sdd-verify` afirmó como hecho verificado que no hay base instalada real en esta máquina (`%APPDATA%\cronometro-apps` inexistente). **Es falso**: Judge A encontró `/mnt/c/Users/Luis Araya/AppData/Roaming/cronometro-apps/` con los 7 archivos de datos reales del usuario (`sessions.json` 15 KB, `app-icons-cache.json` 149 KB, etc.) y la app instalada en `AppData/Local/Programs/cronometro-apps/Workout/`. Sobre esa observación falsa descansaba la justificación "PARTIAL por entorno" del nivel 2 de D-13. Aprovechada, permitió confirmar **empíricamente** dos invariantes que hasta entonces solo estaban verificadas por lectura: (1) el `package.json` extraído del `app.asar` instalado declara `name: "cronometro-apps"` y **no tiene `productName`**, pese a que ese build sí declaraba `productName: 'Workout'` en `builderOptions` — confirma que `vue-cli-plugin-electron-builder` no lo inyecta y que la clave de `userData` de la app instalada será `work-tracker`; (2) los 7 archivos de datos del directorio real están todos en `OWNED_FILES`, sin un noveno huérfano. Lección: verificar la existencia de un directorio antes de declarar que no existe; `powershell.exe` por interop sí alcanza el `%APPDATA%` real.

## 2026-08-06 | gap | open-source-readiness | Regresión introducida por un fix de judgment y encontrada por **los dos jueces por separado** en la iteración 2, corregida en `778328e`: al hacer que la presencia de `usage-log.txt.bak` en el destino contara como evidencia de traspaso consumado (fix del defecto de recopia), se pasó por alto que `usage-log.txt.bak` **también es uno de los ocho archivos que se traspasan**. Un origen con log y respaldo a la vez puede dejar el `.bak` en el destino mientras la copia del log falla, y ese `.bak` recién copiado se leía como "ya traspasado": el log no se reintentaba nunca más. La condición ahora exige que el origen no traiga un `.bak` propio. Lección general: cuando se usa el archivo X como evidencia del traspaso del archivo Y, verificar que X no pueda llegar por el mismo mecanismo que se está tratando de detectar.

## 2026-08-06 | debt-candidate | open-source-readiness | `src/main/session-log.js::migrateLegacyLog()` no tiene `try/catch`: si `migrateLegacyLogAt` lanza (EPERM/EBUSY del antivirus sobre el archivo recién creado por el traspaso, o dos instancias simultáneas — el proyecto no toma `requestSingleInstanceLock`), la excepción escapa, la promesa de `createWindow()` se rechaza antes de `loadURL()` y el usuario queda con una ventana en blanco. Deliberadamente **no corregido** en este cambio: un `try/catch` ingenuo cambiaría un fallo visible y auto-recuperable por uno silencioso, porque hoy la excepción aborta *antes* de `loadSelection()`, así que el motor nunca arranca y ningún `appendSessions` puede sobrescribir el historial con la lista vacía en memoria. Corregirlo bien exige decidir qué hace la app cuando el traspaso o la migración fallan, con logging persistente (hoy `console.error` es inobservable en un binario NSIS del subsistema GUI, que no tiene consola adjunta). Candidato para `sdd new startup-failure-handling --domain debt`.
**Promoción sugerida**: `sdd new startup-failure-handling --domain debt`

## 2026-08-06 | decision-pending | open-source-readiness | Antes de hacer público el repositorio, el usuario debe decidir sobre datos personales que quedan expuestos y que **no son un defecto de código**: el correo `l.arayapardo.dev@gmail.com` aparece en 83 de 86 commits de la historia; `memory/observations.md` contiene la ruta `C:\Users\Luis Araya\dev\cronometro-app-win` (nombre real de la cuenta de Windows) y una anécdota sobre el escritorio en uso; el frontmatter `worktree:` de 30 specs lleva rutas `/home/larayap/...`. Verificado con un barrido de patrones sobre `git rev-list --all`: **no hay credenciales, tokens ni claves en ningún blob**. D-14 del diseño decidió no publicar el correo en `CODE_OF_CONDUCT.md` por este mismo motivo, decisión que la historia de git deja sin efecto. Reescribir la historia es destructivo y quedó fuera del alcance de este cambio.
