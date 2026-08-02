---
type: judgment-report
change_name: "app-detection-logos-audio"
iteration: 2
verdict: escalated
confirmed_issues: 2
suspect_issues: 0
created: "2026-08-02"
tags: [judgment]
---

# Judgment Report: app-detection-logos-audio — iteración 2 (final)

> **Este reporte se escribió para ser leído por una persona que no siguió el detalle
> técnico del cambio.** La sección "Resumen para decidir" alcanza para tomar la decisión;
> el resto es la evidencia que la respalda.

## Resumen para decidir

Los **tres defectos de la iteración 1 quedaron efectivamente corregidos**. Eso se verificó
de forma independiente, ejecutando código, no leyendo los mensajes de commit.

Pero aparecieron **dos defectos nuevos**, ambos verificados con evidencia ejecutable en este
entorno:

1. **La caché de íconos se rompe para siempre ante una sola falla de escritura en disco.**
   La corrección de S1 introdujo una cola de escrituras. Esa cola no captura errores: si una
   escritura falla una vez —disco lleno, el antivirus o OneDrive bloqueando el archivo un
   instante—, **todas las peticiones de ícono posteriores fallan por el resto de la sesión**,
   y el renderer las reintenta en cada tick sin freno. Antes de la corrección, una falla así
   perdía solo esa escritura y la siguiente funcionaba. Es un modo de falla estrictamente
   peor que el que había antes del fix.

2. **Una fila "degradada" muestra el cronómetro congelado en cero.** Una fila degradada es
   la que se agrega desde el listado de procesos abiertos cuando Windows no entrega la ruta
   del ejecutable (típicamente, programas corriendo como administrador). La corrección de C2
   logró que esa fila vincule su proceso y desaparezca al cerrarlo —que era lo que faltaba—,
   pero el mecanismo que decide *qué fila está en primer plano* quedó comparando contra un
   dato de otro formato. Resultado: la fila aparece, se comporta bien al cerrarse, y **nunca
   cuenta tiempo**. Marca 00:00:00 mientras el usuario usa el programa.

**Ninguno de los dos afecta el camino principal de la aplicación**: agregar programas desde
el listado de instalados, o desde procesos abiertos con ruta resoluble, funciona. El defecto
1 requiere una falla de disco; el defecto 2 requiere que el programa monitoreado corra
elevado.

**Ambas correcciones son chicas y localizadas** (del orden de diez líneas en total): agregar
un `.catch()` que reinicie la cola de escrituras, y alinear el criterio de foco de las filas
degradadas con el nuevo formato de identidad.

Como esta era la **segunda y última iteración de judgment**, el pipeline se detiene acá y la
decisión pasa al usuario. Las opciones razonables son dos: aplicar los dos arreglos antes de
archivar, o aceptar el cambio y registrarlos como trabajo siguiente asumiendo el alcance
acotado de cada uno.

---

## Encuadre

Iteración 1 devolvió FAIL con tres hallazgos (C1 critical, C2 high, S1 low-medium),
recogidos en `specs/app-monitoring/judgment-fixes-iteration-1.md`. `sdd-apply` los corrigió
en cuatro commits sobre `cdaf80b`: `e7dd8d2`, `cf4b70b`, `a0c5648`, `517e8f5`.

El alcance de esta iteración fue verificar esos tres fixes con evidencia propia y buscar lo
que hubieran podido romper — no re-auditar de cero un cambio que ya pasó dos pasadas de
`sdd-verify` y una de judgment.

Dos jueces independientes en paralelo (modelo `sonnet`), sin conocimiento mutuo:

- **Juez A — corrección y cumplimiento de spec.** Verificar cada Requirement y Acceptance
  Criterion de la fix-spec contra el código en `HEAD`; recorrer la cadena completa
  productor→consumidor del dato nuevo; buscar regresiones del listener de `ready` eliminado;
  contrastar contra `row-lifecycle` y `session-log-persistence`.
- **Juez B — robustez, integración y modos de falla.** Concurrencia y estado compartido en
  la cola de escrituras; ciclo de vida del proceso main; contratos entre módulos y procesos
  en cada frontera; manejo de errores y casos extremos.

Ambos con reglas de evidencia estrictas: cita de código o comando y salida real; lo que solo
se puede confirmar en Windows se reporta como no verificable, no como defecto.

**Veredicto de Juez A**: pass. **Veredicto de Juez B**: fail.

---

## Los tres fixes de la iteración 1: verificados

| Defecto iteración 1 | Estado | Cómo se verificó |
|---|---|---|
| **C1** (critical) — `createWindow()` corría dos veces por arranque | **Corregido** | Ambos jueces por separado. Un único `app.whenReady().then()` en `src/background.js:128`; cero `app.on('ready')`. Juez B lo confirmó sobre el **bundle compilado real** (`electron:build --dir`), no sobre el fuente: `grep -c "app.on('ready'"` → 0, `grep -c "whenReady"` → 1. Juez A verificó además que las tres responsabilidades del listener eliminado (instalar Vue Devtools, `createTray()`, `createWindow()`) sobreviven en el listener consolidado. |
| **C2** (high) — el `appId` degradado nunca vinculaba un PID | **Corregido** en lo que la spec exige | Juez A recorrió la cadena completa y la ejercitó con `node -e` sobre `normalizeAppId` y `reduceLifecycle` reales, con **control negativo** reproduciendo el `appId` pre-fix: el post-fix correlaciona contra el nombre de imagen de `tasklist`, el pre-fix no. Verificación propia de esta fase del eslabón que el diff no muestra (ver abajo). |
| **S1** (low-medium) — carrera en la caché de íconos en disco | **Corregido en el camino feliz** | Ambos jueces con `node -e` contra `icon-cache.js` y `json-store.js` reales sobre `fs` real. Juez B: 6 escrituras concurrentes sobreviven completas; control negativo con el patrón pre-fix pierde 3 de 4 claves. Pero ver hallazgo **F1**: el camino de error quedó peor que antes. |

### Verificación propia de esta fase (adjudicador)

El diff de los cuatro commits **no muestra** el handler del canal `add-to-selection`, que es
un eslabón obligatorio de la cadena de C2. Vive en `src/main/ipc-handlers.js:22`. Verificado:

```js
ipcMain.handle('add-to-selection', (event, entry) => {
  monitorEngine.addToSelection(entry)
```

Reenvía el objeto `entry` completo sin destructurar, así que `imageName` sobrevive el cruce
renderer→main. La cadena no se corta ahí. También verificado que la otra vía de alta
(`AppSelectorModal.vue#choose`, desde el listado de instaladas) pasa un `appId` explícito, de
modo que la ausencia de `imageName` en ese camino es inocua.

Y que las dos puntas del `appId` degradado hablan el mismo formato: `monitor-engine.js:24-27`
arma `'name:' + String(imageName).toLowerCase()`; el bloque de descubrimiento
(`monitor-engine.js:219-227`) lo revierte con `entry.appId.replace(/^name:/, '')` y compara
contra `proc.imageName` en minúsculas.

---

## Hallazgos

### F1 — Una falla de escritura envenena la cola de la caché de íconos de forma permanente

- **Severidad**: high
- **Clasificación**: suspect (solo Juez B) → **adjudicado CONFIRMADO** con evidencia propia
- **Archivo**: `src/main/icon-cache.js:26-38` (declaración de `diskWriteQueue` y
  `persistToDisk`), consumido en la línea 87 (`await persistToDisk(key, dataUrl)`)
- **Introducido por**: `a0c5648`, el fix de S1

`persistToDisk` encadena cada escritura sobre la anterior:

```js
diskWriteQueue = diskWriteQueue.then(() => {
  const diskCache = jsonStore.readJson(getCacheFilePath(), {})
  diskCache[key] = dataUrl
  jsonStore.writeJson(getCacheFilePath(), diskCache)
})
return diskWriteQueue
```

`jsonStore.writeJson` es un `fs.writeFileSync` **sin `try/catch`** (`json-store.js:17-19`) —
deliberadamente, porque la tolerancia a fallos de ese módulo se diseñó solo para la lectura
(D11/ADR-0006). Si lanza, la promesa queda rechazada **y guardada como el nuevo valor de
`diskWriteQueue`**. El encadenado siguiente es `.then(callback)` sin manejador de error, así
que encadenar sobre una promesa ya rechazada nunca ejecuta el callback: solo propaga el
rechazo. La cola queda inutilizada por el resto de la vida del proceso.

**Evidencia propia (ejecutada en este entorno)** — `icon-cache.js` y `json-store.js` reales,
`fs` real en un directorio temporal, `electron` stubeado, una única falla de escritura
simulada:

```
1) tras escritura OK, claves en disco: [ 'c:\a.exe' ]
2) getIcon(b) rechazó: EBUSY simulado
3) getIcon(c) TAMBIÉN rechazó (cola envenenada): EBUSY simulado
4) claves en disco al final: [ 'c:\a.exe' ]
```

La tercera llamada es para una clave nunca vista, con la escritura ya restablecida, y aun así
rechaza con el error **original**. Juez B llegó al mismo resultado por su cuenta.

**Radio de impacto, más ancho que la caché.** `getIcon` hace `await persistToDisk(...)` antes
de devolver, así que el rechazo se propaga al canal IPC (`ipc-handlers.js:36`) y de ahí al
renderer. `stores/monitoredApps.js:49-53` no tiene `try/catch`:

```js
async ensureIcon(exePath) {
  if (!exePath || Object.prototype.hasOwnProperty.call(this.icons, exePath)) return
  const { dataUrl } = await ipcRenderer.invoke('get-app-icon', exePath)
  this.icons[exePath] = dataUrl
},
```

Con la promesa rechazada, `this.icons[exePath]` nunca se asigna, así que el guard
`hasOwnProperty` nunca se activa y el `watch` sobre `rows` —que se reemplaza por referencia
en cada tick (D2/D17)— repite el IPC **indefinidamente**, con un unhandled rejection por
tick. Es exactamente el bucle que `cdaf80b` había eliminado, reintroducido bajo condición de
error.

**Por qué es una regresión y no deuda preexistente.** Antes de `a0c5648`, la escritura era
síncrona dentro de `getIcon`: una falla rechazaba esa llamada y nada más; la siguiente
volvía a intentar desde cero. El fix cambió una pérdida puntual por una inutilización
permanente.

**Corrección esperada**: capturar el error en el encadenado para que la cola se restablezca
(`diskWriteQueue = diskWriteQueue.then(...).catch(() => {})`), decidiendo explícitamente si
el fallo de persistencia debe propagarse a `getIcon` o si el ícono debe devolverse igual con
la caché en memoria ya poblada. Lo segundo es lo coherente con el diseño: la caché en disco
es una optimización, no un requisito de la funcionalidad.

---

### F2 — Una fila degradada nunca acumula tiempo

- **Severidad**: high
- **Clasificación**: **CONFIRMADO** — los dos jueces lo encontraron de forma independiente
  (Juez B como hallazgo high; Juez A como observación fuera de alcance), con el mismo
  mecanismo identificado
- **Archivo**: `src/main/monitor-engine.js:130-134` (`matchFocusedAppId`, no tocada por los
  fixes) contra `src/main/monitor-engine.js:325` (`addToSelection`, sí tocada)

`matchFocusedAppId` decide qué fila está en primer plano, y por lo tanto cuál acumula
tiempo. Para una fila degradada —`exePath` nulo— la rama por ruta no aplica nunca
(`row.exePath &&` es falso), así que siempre cae a la rama por nombre:

```js
if (sFocus.name) {
  const degradedId = 'name:' + sFocus.name.toLowerCase()
  const byName = rows.find((row) => row.appId === degradedId)
```

`sFocus.name` viene de `platform-windows.js:31` (`activeWin().owner.name`). El código nativo
de la dependencia, vendorizado en el repo, muestra qué es ese valor exactamente
(`node_modules/active-win/Sources/windows/main.cc:95-117`):

```c
std::string name = getFileName(path);   // p. ej. "notepad.exe"
...
if (infoSize != 0) {
  ...
  std::string nname = getDescriptionFromFileVersionInfo(pVersionInfo);
  if (nname != "") { name = nname; }    // sobreescribe con la Description: "Notepad"
}
```

Es decir: para cualquier ejecutable con Description en su recurso de versión —la mayoría de
las aplicaciones de escritorio reales— `sFocus.name` es una **descripción sin extensión**,
mientras que el `appId` de la fila degradada ahora es un **nombre de imagen con `.exe`**. No
coinciden nunca.

**Evidencia propia (ejecutada)** — `reduceFocus` real, fila degradada, foco sobre ese mismo
programa:

```
appId post-fix: name:clipstudiopaint.exe
POST-FIX state: [ [ 'paused', 0 ] ]
POST-FIX con path en foco pero fila sin exePath: [ [ 'paused', 0 ] ]
```

La fila queda en `paused` con `elapsedMs: 0` incluso con el foco puesto encima, y la segunda
línea muestra que tampoco se salva cuando `active-win` sí resuelve la ruta: la rama por ruta
exige que la **fila** tenga `exePath`, y una fila degradada por definición no lo tiene.

Esto viola un SHALL explícito de `two-state-row-machine`:

> El sistema SHALL transicionar una fila de pausado a corriendo en el instante en que el
> programa gana el foco.

y arrastra a `session-log-persistence`: al cerrarse el proceso, la fila se retira
correctamente (eso sí lo arregló C2) pero registra una sesión de duración cero.

**Adjudicación sobre si es una regresión — no lo es, y conviene decirlo con precisión.**
Juez B sostuvo que antes del fix ambos lados coincidían. Eso no se sostiene: en el caso
degradado, `Get-Process` no puede leer `$_.Path` porque no puede acceder al módulo del
proceso, y `$_.Description` sale de esa misma vía, así que también viene vacío. El `appName`
pre-fix era, entonces, `$_.Name` —sin extensión y sin ser una descripción—, que tampoco
coincidía con la Description que entrega `active-win`. Antes y después el emparejamiento
falla, en subcasos complementarios: pre-fix acertaba solo cuando la descripción coincidía
con el nombre de proceso; post-fix acierta solo cuando el ejecutable **no** tiene recurso de
versión y `active-win` cae al nombre de archivo. Juez A lo clasificó como preexistente y
fuera del alcance de C2 por la misma razón, y verificó con `diff` contra `cdaf80b` que la
función no fue tocada por ninguno de los cuatro commits.

**Pero preexistente no quiere decir ajeno.** `monitor-engine.js` es un archivo **creado por
este cambio**: el defecto vive dentro de lo que se está juzgando, no en la base heredada. Y
el efecto es que la vía degradada —que D4 declara explícitamente "degradación, no error"—
sigue sin funcionar de extremo a extremo después de una iteración dedicada a repararla:
ahora la fila entra y sale bien, pero marca cero.

**Corrección esperada**: que la rama de nombre de `matchFocusedAppId` derive el nombre de
imagen de `sFocus.exePath` (`path.basename`) cuando esté disponible, en vez de confiar en
`sFocus.name`, y solo caiga a `sFocus.name` como último recurso. Con eso las dos vías de
correlación —foco y descubrimiento por `tasklist`— usan la misma clase de dato, que es lo
que D4 pide.

---

## Hallazgos descartados en la adjudicación

Se reportan por transparencia; no pesan en el veredicto.

- **Selección persistida con `appId` en formato viejo** (Juez B, medium,
  `monitor-engine.js:219-227`). El razonamiento es correcto en abstracto, pero el archivo
  `monitored-selection.json` lo introduce **este mismo cambio**, que todavía no se publicó:
  no existe ningún usuario con una selección persistida en formato previo. No hay dato viejo
  que migrar. **Descartado.**
- **`installExtension` ahora precede a `createTray()`/`createWindow()`** (Juez B, low,
  `background.js:128-145`). Solo aplica en desarrollo (`isDevelopment && !process.env.IS_TEST`),
  está dentro de un `try/catch`, y Juez A argumenta —con razón— que registrar la extensión
  antes de que el `webContents` cargue es más correcto que después. No es un defecto.
  **Descartado.**

---

## Síntesis

| Categoría | Count |
|-----------|-------|
| Confirmed (ambos jueces) | 1 (F2) |
| Suspect adjudicado como confirmado (evidencia propia) | 1 (F1) |
| Suspect descartado en la adjudicación | 2 |
| Fixes de la iteración 1 verificados como corregidos | 3 de 3 |

## Verificado limpio en esta iteración

- **C1 sin residuos**: un único camino de arranque, confirmado sobre el bundle compilado, no
  solo sobre el fuente. Ninguna responsabilidad del listener eliminado se perdió.
- **Cadena completa de `imageName`**: `platform-windows.js` → `AppSelectorModal.vue` →
  `stores/monitoredApps.js` → `ipc-handlers.js` → `monitor-engine.js#addToSelection`. Cinco
  fronteras, el dato sobrevive las cinco.
- **Regla D6 intacta**: vincular el PID de una fila degradada no altera `elapsedMs` ni
  `sessionStartedAt` (`reduceLifecycle`, ejercitado por ambos jueces).
- **Equivalencia detener ⇄ cierre de proceso**: ambos caminos convergen en el mismo reductor
  y en el mismo `sessionLog.appendSession`, sin lógica especial para el caso degradado.
- **Serialización de escrituras en el camino feliz**: 6 extracciones concurrentes conservan
  las 6 claves; el control negativo pre-fix pierde 3 de 4.
- **Linter**: `npx eslint src --ext .js,.vue` limpio.
- **Builds**: `vue-cli-service build` y `electron:build --dir` completan sin error.

## No verificable en este entorno (WSL2 sin Windows)

Se listan como limitación, no como defecto:

- El string exacto que `active-win` entrega en `owner.name` en runtime para un proceso real
  con Description. F2 se apoya en la lectura del código nativo de la dependencia, que es
  evidencia fuerte pero no ejecución.
- Que `$_.Name + '.exe'` de `Get-Process` coincida byte a byte con la columna de nombre de
  imagen de `tasklist` para un proceso elevado real.
- El flujo visual completo de tray → "Mostrar ventana", y el cierre de un proceso elevado
  real retirando su fila.
- El comportamiento de `app.quit()` con escrituras encoladas pendientes en `diskWriteQueue`.

Todos ya estaban declarados como pendientes de Windows en la propia fix-spec y en
`observations.md`.

## Veredicto Final

**FAIL — escalated.** Es la segunda iteración fallida, así que el pipeline se detiene y la
decisión pasa al usuario.

Los tres defectos de la iteración 1 están efectivamente corregidos, con evidencia propia y
no por confianza en el reporte de `sdd-apply`. Pero la iteración deja dos defectos de
severidad alta verificados en este entorno: uno **introducido por el fix de S1** (una falla
de escritura deja la caché de íconos y el canal de íconos inutilizados por el resto de la
sesión, un modo de falla estrictamente peor que el previo al fix), y otro **confirmado por
ambos jueces** que rompe un SHALL de `two-state-row-machine` para las mismas filas
degradadas que esta iteración se propuso reparar.

Los dos criterios de FAIL se cumplen literalmente: hay comportamiento especificado roto y
hay fragilidad demostrada por ejecución. Corresponde señalarlo también con proporción:
ninguno de los dos toca el camino principal de la aplicación, y ambos se resuelven con del
orden de diez líneas. Un usuario informado puede razonablemente decidir aplicarlos antes de
archivar, o aceptar el cambio y tomarlos como trabajo siguiente. Lo que este reporte no
puede hacer es dar por bueno el cambio sin dejar constancia de ellos.
