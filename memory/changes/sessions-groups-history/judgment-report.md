---
type: judgment-report
change_name: "sessions-groups-history"
iteration: 2
verdict: pass
confirmed_issues: 1
suspect_issues: 1
created: "2026-08-02"
tags: [judgment]
---

# Judgment Report: sessions-groups-history

Iteración 2 de 2 (máximo del protocolo). Dos jueces independientes (`sonnet`), en paralelo, sin
conocerse: Judge A con foco en corrección contra las specs, Judge B con foco en robustez,
regresiones e integración. **Ambos retornaron veredicto `fail`.** Toda la evidencia que sostiene
este reporte fue reproducida de forma independiente por el adjudicador contra el sistema real
—log de producción, motor real con timer real, sistema de archivos NTFS real, PowerShell real de
la máquina— sin aceptar las afirmaciones de `sdd-apply` ni las de los jueces.

**El veredicto del adjudicador es `pass`**, contra los dos `fail`. La justificación completa está
en `## Adjudicación del veredicto`; el resumen es que los dos hallazgos son reales pero ninguno
rompe comportamiento observable por el usuario, y las vías por las que podrían hacerlo resultaron
no alcanzables al ejecutarlas.

## Síntesis

| Categoría | Count |
|-----------|-------|
| Confirmed (ambos jueces) | 1 |
| Suspect A (solo Judge A) | 0 |
| Suspect B (solo Judge B) | 1 |

| ID | Severidad adjudicada | Origen | Adjudicación |
|----|----------------------|--------|--------------|
| G1 | low | confirmed (A+B) | real — residuo sin consecuencia alcanzable |
| G2 | medium | suspect-B | real — regresión angosta, no viola Requirement |

## Los cuatro fixes de la iteración 1: verificados

Antes de los hallazgos nuevos: los cuatro defectos de la iteración 1 **están corregidos**.
Reproducción propia con control negativo en los cuatro casos.

### F1 — agregación del historial migrado — corregido

`aggregateByApp` real sobre las 32 entradas migradas del `usage-log.txt` de producción:

```
2025-04-06 | apps reales: 2 | filas: 2 | duraciones exactas: OK
2025-04-07 | apps reales: 2 | filas: 2 | duraciones exactas: OK
2025-04-13 | apps reales: 2 | filas: 2 | duraciones exactas: OK
2025-04-17 | apps reales: 1 | filas: 1 | duraciones exactas: OK
2025-05-09 | apps reales: 1 | filas: 1 | duraciones exactas: OK
2025-05-10 | apps reales: 2 | filas: 2 | duraciones exactas: OK
2025-06-08 | apps reales: 1 | filas: 1 | duraciones exactas: OK
2026-08-01 | apps reales: 2 | filas: 2 | duraciones exactas: OK
2026-08-02 | apps reales: 3 | filas: 3 | duraciones exactas: OK
=> pérdida de programas en algún día: false
```

Los 9 días que la iteración 1 mostraba fusionados ahora separan cada programa con su duración
exacta. Verificado además:

- **Unicidad de `key`** (la que consume el `v-for` de `ByAppView.vue:10`): 10 filas, 10 keys
  únicas, 1 solo `appId` distinto — exactamente el caso que rompería `:key="row.appId"`.
- **Los dos Scenarios de alcance mes y rango** de la spec de fixes, contra el log real:
  abril 2025 → 6 barras, mayo 2025 → 3, agosto 2026 → 4, rango abril 2025–agosto 2026 → 10
  barras, totales exactos en todos.
- **Sin regresión** para entradas nuevas: con `appId` real la agrupación sigue siendo por `appId`.
- **Sin crash** con `app` `null`, `undefined`, `''` ni con el literal `"null"` que el log real
  contiene (2026-08-01).
- Consumidores de `aggregateByApp`: solo `ByAppView.vue` y `UsageChart.vue`. `BySessionView.vue`
  usa `buildDayTimeline`, no afectado.

### F2 — cierre definitivo al salir — corregido en lo que importa

Reproducción con el `monitor-engine.js` real (solo `electron`, `platform-windows`, `session-log`
y `json-store` mockeados), timer real de 1000ms, contra el código pre-fix y post-fix:

```
CONTROL NEGATIVO (pre-fix, git show ad7ca33^)
  4) tras 2.5s con el proceso muerto -> escrituras: 2   <-- ENTRADA DUPLICADA
POST-FIX (código actual)
  4) tras 2.5s con el proceso muerto -> escrituras: 1   <-- una sola entrada
```

El defecto que motivó F2 —la segunda entrada de historial para la misma sesión lógica— está
eliminado. Ambos jueces llegaron a la misma conclusión sobre este punto por separado; Judge B lo
dice explícitamente: "el defecto original de F2 (doble entrada de historial) **no** se reproduce
[...] ese punto específico del AC está genuinamente resuelto". Lo que queda abierto es G1, abajo.

Verificado además que el motor queda recuperable: `closeAllRows` con `rows` vacío es inocuo, y
`addToSelection` vuelve a arrancar el timer (`if (!tickHandle) startEngine()`), así que
`stopEngine()` dentro del cierre no puede dejar el motor muerto de forma irreversible.

### F3 — escritura atómica del historial — corregido

`json-store.js` real contra el sistema de archivos **NTFS real** (vía `/mnt/c`) y contra ext4:

```
3. CONTROL NEGATIVO: interrupción con writeJson desnudo (pre-fix)
   destino ILEGIBLE -> Expected ',' or '}' after property value in JSON at position 40
4. misma interrupción con writeJsonAtomic
   destino legible: 2 entradas (historial previo intacto)
5. ¿el .tmp huérfano rompe la siguiente escritura?  -> no, destino: 3 entradas
6. ¿el .tmp huérfano confunde a readJson?           -> no, ignora el .tmp
```

El `rename` sobre destino existente —el caso de cada cierre de sesión, distinto del
`rename` sobre destino inexistente que hace la migración— funciona en NTFS. `writeJson` quedó
byte a byte intacto: los otros consumidores (selección monitoreada, settings, cachés de íconos e
instaladas) mantienen su comportamiento. `writeJsonAtomic` se usa únicamente en
`appendSessions`. Lo que sí apareció es G2, abajo.

### F4 — nombre canónico en el listado de instaladas — corregido

Script PowerShell real de `buildInstalledAppsScript` contra la máquina Windows de este entorno,
188 accesos directos crudos → 82 mostrados (mismo conteo que la iteración 1). Los 8 grupos de
colisión reales, uno por uno:

```
mysql.exe : "MySQL 8.0 Command Line Client - Unicode"          -> "MySQL 8.0 Command Line Client"
vlc.exe   : "VLC media player - reset preferences and cache..." -> "VLC media player"
steam / winrar / cursor / ollama / python : sin cambio (ya salían bien)
wslg.exe  : "Chromium Web Browser (Ubuntu)"                     -> "Ghostty (Ubuntu)"
```

Los dos casos que la spec nombra quedan con su nombre principal. **El orden de salida es idéntico
al de primera aparición** (verificado elemento a elemento) y no hay `undefined` en la salida.

El cambio de ganador en `wslg.exe` es la colisión R1 que la iteración 1 evaluó y **rechazó**
explícitamente como limitación conocida del modelo de identidad (`appId` = ruta del ejecutable,
ADR-0004): dos programas distintos comparten lanzador y el listado solo puede mostrar uno. Cuál
de los dos sobrevive era arbitrario antes y sigue siendo arbitrario ahora. No es hallazgo nuevo.
Ambos jueces lo detectaron y ambos, correctamente, se abstuvieron de reportarlo como defecto.

## Hallazgos confirmados

### G1 — El tick en vuelo resucita la fila en memoria tras `closeAllRows`

- **severity adjudicada**: low (Judge A: high · Judge B: medium)
- **origen**: confirmed — ambos jueces, de forma independiente
- **file**: `src/main/monitor-engine.js:412-418` (`closeAllRows`), mecanismo en `tick()`
  (líneas 234-300) y en el paso de altas de `reduceLifecycle` (líneas 107-131)

`stopEngine()` hace `clearInterval(tickHandle)`: impide que arranque un tick **nuevo**, pero no
cancela el tick que ya está suspendido en `await platform.getForegroundWindow()`. Ese tick
reanuda igual, encuentra `rows` vacío y `selection` intacta —`closeAllRows` nunca toca
`selection`— y el paso de altas de `reduceLifecycle` vuelve a crear la fila.

**Evidencia — reproducción propia del adjudicador**, la misma corrida que verificó F2:

```
2) tras closeAllRows -> rows: []                       | escrituras: 1
3) tras resolver el tick en vuelo -> rows: [{"appId":"c:\\test\\app.exe", ...}]   <-- RESUCITADA
4) tras 2.5s con el proceso muerto -> escrituras: 1
```

El Requirement de la spec de fixes dice: *"después de ese cierre ninguna fila vuelve a existir ni
se registra una segunda entrada de historial para una sesión ya cerrada"*. La segunda conjunción
se cumple; **la primera, leída literalmente, no**: la fila vuelve a existir en el `rows` del
módulo y viaja en un `notify()` hacia el renderer. El comentario que el fix agregó
(`monitor-engine.js:409-411`, "cierra el camino completo, no solo la ventana") describe con
precisión que no hay ticks nuevos, pero es más fuerte de lo que el código sostiene respecto del
tick en vuelo.

**Por qué se adjudica `low` y no bloquea.** Las dos vías por las que la fila resucitada podría
producir daño real se probaron, y ninguna resulta alcanzable:

1. **Un segundo `closeAllRows`** sí escribiría una entrada duplicada — lo verifiqué:
   `escrituras: 2` al invocarlo dos veces con la fila resucitada en medio. Pero `closeAllRows`
   tiene un único llamador en todo `src/` (`background.js:261`, dentro de `before-quit`), y
   Electron emite `before-quit` una sola vez por secuencia de salida: `Browser::Quit()`
   corta por su guarda `is_quitting_` antes de re-emitirlo, que es lo que hace que el patrón
   estándar `window-all-closed → app.quit()` —el que este proyecto usa— no dispare la salida dos
   veces. *Esta última parte es razonamiento sobre el diseño documentado de Electron, no
   ejecución: intenté correr Electron 13.6.9 en este entorno para contarlo empíricamente y el
   binario no levanta por dependencias del sistema ausentes (`libnss3.so`).*
2. **El usuario apretando ■ sobre la fila resucitada** (IPC `stop-monitored-row` → `closeRow`)
   sí escribe una segunda entrada — también lo verifiqué (`escrituras nuevas: 1`). Requiere un
   clic en la ventana durante el desarme del proceso, inmediatamente después de que el propio
   usuario eligió "Salir" en la bandeja. No es un escenario plausible.

Fuera de esas dos vías, la fila resucitada no toca disco: `rows` es estado solo en memoria por
diseño (D5/ADR-0006), la selección no se modifica en ese tick (verificado: el conteo de
escrituras queda en 1), y el proceso termina. El residuo es real y merece quedar registrado,
pero su consecuencia observable es nula.

**Endurecimiento sugerido para un cambio futuro** (no aplicado — la iteración 2 es el máximo del
protocolo): vaciar también `selection` dentro de `closeAllRows`. Sin entradas en la selección, el
paso de altas no tiene sobre qué dar de alta y la vía queda cerrada por construcción, sin depender
de que no haya ningún tick en vuelo. Es una línea y no afecta a la persistencia, porque
`closeAllRows` corre cuando el proceso ya está saliendo y la selección en disco no se reescribe
en ese camino.

## Hallazgos suspect

### G2 — `writeJsonAtomic` falla donde `writeJson` sobrevivía, bajo un bloqueo de Windows que niega el borrado

- **severity adjudicada**: medium (Judge B: high)
- **origen**: suspect-B (Judge A revisó F3 y lo cerró sin hallazgo)
- **file**: `src/main/json-store.js:34-38`, consumido por `src/main/session-log.js:78`

El `rename` de tmp+rename necesita permiso de borrado sobre el destino. Si otro proceso tiene
`sessions.json` abierto con un share mode que permite lectura y escritura pero **niega** el
borrado, `fs.renameSync` falla con `EACCES` — mientras que el `fs.writeFileSync` desnudo anterior
sobrevivía a ese mismo bloqueo.

**Evidencia — reproducción propia** contra NTFS real, sosteniendo el bloqueo desde PowerShell con
`[System.IO.File]::Open` y variando el share mode:

```
FileShare::ReadWrite            writeJson: OK       writeJsonAtomic: FALLA EACCES   <-- la regresión
FileShare::ReadWrite, Delete    writeJson: OK       writeJsonAtomic: OK
FileShare::Read                 writeJson: FALLA    writeJsonAtomic: FALLA
FileShare::None                 writeJson: FALLA    writeJsonAtomic: FALLA
```

La matriz acota el hallazgo con precisión: **la regresión existe en exactamente un share mode**.
Con un bloqueo más estricto (`Read`, `None`) el código pre-fix ya fallaba igual, así que no hay
diferencia; con `ReadWrite, Delete` —el share mode que los antivirus y los indexadores usan
convencionalmente, justamente porque tmp+rename es el patrón de escritura atómica universal en
Windows— ambos caminos funcionan.

Judge B verificó además, y lo confirmé por lectura, que nada captura esa excepción: no hay
`try/catch` alrededor de `appendSessions`, `closeAllRows` ni el listener de `before-quit`, y no
hay `uncaughtException` registrado. Eso no es algo que F3 introduzca: ADR-0006 declara
explícitamente `fs.writeFileSync` **sin `try/catch` por diseño** para toda la persistencia del
proyecto, y `writeJson` puede lanzar por disco lleno o permisos igual que antes.

**Por qué se adjudica `medium` y no bloquea.** Ningún Requirement de ninguna spec cubre el
comportamiento del sistema ante un bloqueo de archivo de terceros; el comportamiento pre-fix bajo
ese bloqueo era incidental, no especificado. El Requirement que F3 sí tiene —*"el archivo de
historial queda legible con su contenido previo o con el contenido nuevo completo, nunca a medio
escribir"*— se cumple y está verificado con control negativo. El intercambio neto es favorable:
se cambia "una interrupción del proceso durante la escritura destruye **todo** el historial"
(demostrado en la iteración 1, y el llamador es el cierre de `before-quit`) por "un bloqueo
externo con un share mode poco habitual pierde **las sesiones que se estaban cerrando**, dejando
el historial previo intacto". El daño del segundo caso es estrictamente menor que el del primero,
y el proyecto ya apostó a este patrón en `migrateLegacyLogAt` por ADR-0007.

Queda registrado como limitación conocida, no como deuda a corregir antes de cerrar.

## Puntos calientes cerrados sin hallazgo

Verificados por el adjudicador, además de la cobertura de los jueces:

- **Radio de impacto de F3 sobre los demás consumidores de `json-store.js`**: `writeJson` y
  `readJson` quedaron sin tocar; `writeJsonAtomic` solo se usa en `appendSessions`. El `.tmp`
  huérfano que deja una interrupción no rompe la escritura siguiente ni confunde a `readJson`
  (ejecutado). La migración usa el mismo nombre de `.tmp` que `appendSessions`, pero corre una
  sola vez al arrancar y antes de que el motor pueda abrir sesiones: no hay concurrencia.
- **Caminos de salida del motor tras `stopEngine()` en `closeAllRows`**: único llamador
  (`before-quit`); `mainWindow.on('close')` hace `preventDefault()` + `hide()` mientras
  `!app.isQuiting`, así que cerrar la ventana a la bandeja nunca dispara el cierre; ningún
  `preventDefault` sobre `before-quit` que pudiera abortar la salida dejando el motor detenido; y
  el motor es recuperable vía `addToSelection` si eso ocurriera.
- **Coherencia de `ByAppView.vue` y `UsageChart.vue` con el nuevo shape de fila**: `ByAppView`
  usa `:key="row.key"`; `UsageChart` posiciona las barras por índice de array y etiqueta con
  `row.app`, así que no depende de la unicidad de la key.
- **Colisión entre el degradado de `session-aggregate.js` y `degradedAppId` del motor**: para
  fusionar, una entrada migrada tendría que llamarse literalmente igual que un nombre de imagen
  en minúsculas (`chrome.exe`). Los nombres del log real son nombres legibles
  (`"Google Chrome"`). Verificado ejecutando ambos casos.
- **Documentación de los fixes**: el ADR-0007 lleva una nota de corrección honesta sobre la
  premisa que F3 invalidó, y el AC de `usage-chart-by-interval` fue re-verificado con la causa
  raíz correcta en lugar de la justificación insuficiente anterior. Las cifras que `sdd-apply`
  declara (32 entradas / 9 días, 188 → 82) coinciden exactamente con las de mi reproducción
  independiente.
- **Estado del árbol**: `src/` está íntegramente commiteado (`HEAD = ed8fbf2`); el código revisado
  es el código commiteado.

## Observaciones menores (sin acción)

- **Historial migrado y nuevo del mismo programa, el mismo día**: en el día de la actualización, un
  programa puede aparecer en dos filas con la misma etiqueta —una migrada (clave por nombre) y una
  nueva (clave por `appId`)—. Verificado ejecutando el caso. No hay pérdida ni misatribución: cada
  fila conserva su propio tiempo y los totales del gráfico siguen coincidiendo con los de la lista.
  Es una consecuencia inherente de que el formato de texto nunca registró la ruta del ejecutable;
  fusionarlas por nombre rompería el modelo de identidad del proyecto. Ambos jueces lo señalaron
  como observación, no como defecto.
- **`groupKeyOf` no normaliza a minúsculas** aunque su comentario dice seguir "el mismo criterio de
  degradación que `degradedAppId`", que sí lo hace. La diferencia es correcta —un nombre legible no
  es un nombre de imagen— pero el comentario afirma una simetría que no existe.
- **`installed-apps-filter.js:98`**: `candidate.name.length` lanza `TypeError` si un acceso directo
  llega con `shortcutName` nulo **y** colisiona con otro sobre el mismo ejecutable. La dedup
  anterior nunca leía `name`, así que es superficie de fallo nueva. No es alcanzable con los datos
  reales (los 188 accesos directos de esta máquina tienen nombre; `shortcutName` sale de
  `GetFileNameWithoutExtension` sobre un `.lnk` existente), pero `shouldDiscard` ya se defiende con
  `entry.shortcutName || ''`, señal de que el módulo contempla el caso.
- **`ipc-handlers.js:69`** empuja el snapshot sin guarda `isDestroyed()`. El fix de F2 reduce la
  exposición en lugar de aumentarla —detiene el motor, así que a lo sumo queda el `notify()` del
  tick en vuelo—, pero la guarda sigue ausente.

## Adjudicación del veredicto

Ambos jueces retornaron `fail`. El adjudicador retorna `pass`. Las razones, explícitas:

1. **Ningún hallazgo es compartido como bloqueante.** El único hallazgo `confirmed` es G1, y los
   propios jueces lo califican distinto: Judge B lo llama "no bloqueante por sí solo" y declara el
   Acceptance Criterion de F2 "genuinamente resuelto"; Judge A lo llama `high`. El `fail` de
   Judge A descansa en G1; el de Judge B descansa en G2, que Judge A revisó y cerró sin hallazgo.
2. **G1 no tiene consecuencia alcanzable.** Probé las dos vías por las que la fila resucitada
   podría producir una entrada duplicada. Ambas producen el duplicado si se las fuerza, y ninguna
   es alcanzable: la primera exige que Electron emita `before-quit` dos veces, contra su diseño; la
   segunda exige que el usuario apriete ■ durante el desarme del proceso que acaba de ordenar
   cerrar. El daño que motivó F2 está eliminado, con control negativo.
3. **G2 no viola ningún Requirement y el intercambio es favorable.** La matriz de share modes acota
   la regresión a un solo caso, deja ver que los bloqueos más estrictos rompían también el código
   anterior, y muestra que el share mode convencional de antivirus e indexadores funciona en ambos
   caminos. Revertir F3 devolvería un riesgo demostrado de pérdida total del historial a cambio de
   endurecer un borde más raro y no especificado.
4. **El criterio de esta fase es el comportamiento especificado.** Los cuatro defectos de la
   iteración 1 —que sí rompían Requirements y se manifestaban en el camino feliz de todo usuario
   existente— están corregidos, cada uno con control negativo propio. Lo que queda son un residuo
   sin efecto observable y un intercambio de robustez en un borde que ninguna spec cubre.

Lo que **no** hago es maquillar los dos hallazgos: G1 deja literalmente incumplida una conjunción
de un Requirement `SHALL` ("ninguna fila vuelve a existir"), y G2 es una regresión real respecto
del comportamiento anterior bajo un bloqueo concreto. Ambos quedan registrados acá y en
`observations.md` como limitaciones conocidas, con el endurecimiento de una línea que cerraría G1
anotado para un cambio futuro. Si el criterio del usuario es que una conjunción `SHALL` incumplida
en memoria justifica detener el cierre, el material para decidirlo está completo en G1.

## Veredicto Final

**pass** — iteración 2 de 2.

Los cuatro defectos de la iteración 1 están corregidos y verificados con control negativo propio
contra el sistema real. Los dos hallazgos nuevos son reales pero no rompen comportamiento
observable por el usuario: quedan como limitaciones conocidas documentadas.

**Siguiente paso**: `sdd-archive`.
