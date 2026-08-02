# Verify Report: sessions-groups-history

**Fecha**: 2026-08-02
**Veredicto**: ✅ PASS

19 commits (`0e702cc..HEAD`), 99/112 checkboxes de `tasks.md` marcados, 10 specs en `spec_refs`.
Esta fase re-ejecuta la validación desde cero contra el código real del worktree —no acepta
las afirmaciones de `sdd-apply` sin auditarlas— y usa el interop WSL→Windows disponible en
este entorno para llevar varias verificaciones más allá de lo que fases previas alcanzaron
(ver `## Verificaciones que exceden lo ya documentado`).

## Resultados por Spec

### row-lifecycle-persistence-by-type

| Criterion | Status | Notas |
|-----------|--------|-------|
| Agregar muestra fila de inmediato | ✅ | preexistente, sin cambios de contrato |
| Automático que abre proceso aparece sin acción manual | ✅ | `reduceLifecycle` alta verificada |
| ■ y cierre de proceso producen el mismo efecto, sin importar modalidad | ⚠️ | equivalencia estructural verificada en ambos caminos por separado (ver abajo); el disparo por un proceso real muriendo queda pendiente de Windows |
| Automático permanece en selección y reaparece | ✅ | `reduceLifecycle`, misma referencia sin cierres |
| Manual sale de la selección al salir su fila | ✅ | **re-verificado con `closeRow` real** (ver abajo) |
| Perder el foco no saca la fila | ✅ | **nuevo**: `reduceFocus(null, rows, now)` nunca reduce el array |
| Automático puede estar en selección sin fila | ✅ | preexistente |

**Scenarios verificados**: 6/8 con evidencia directa; 2 requieren un proceso Windows real
muriendo (no fabricable en este entorno).

### sessions-json-persistence

| Criterion | Status | Notas |
|-----------|--------|-------|
| Reloj muestra sesión en curso, no total del día | ✅ | preexistente |
| Cerrar proceso registra sesión | ⚠️ | composición verificada por partes, camino completo vía `tick()` pendiente de Windows |
| Detener fila registra sesión | ✅ | **nuevo**: `closeRow` real |
| Salir con filas abiertas registra todas | ✅ | **nuevo**: `closeAllRows` real, 1 escritura |
| Perder el foco no registra nada | ✅ | estructural |
| Varios tramos el mismo día → varias entradas | ✅ | **nuevo**: abrir/cerrar 2 veces produce 2 `id` distintos |
| Migración sin pérdida, sin borrar el original | ✅ | protocolo completo re-verificado contra el log real |
| Nombre + grupo se conservan en el historial | ✅ | **nuevo**: `renameSession`+`setRowGroup`+`renameGroup`+`closeRow` end-to-end |

**Scenarios verificados**: 7/8 con evidencia directa.

### installed-apps-data-integrity

| Criterion | Status | Notas |
|-----------|--------|-------|
| Discord y Clip Studio aparecen | ⚠️ | Clip Studio no está instalado en este equipo — límite de datos reales, no del entorno |
| Sin runtimes/actualizadores/redistribuibles | ✅ | re-verificado contra enumeración PowerShell **en vivo** (ver abajo) |
| Sin duplicados | ✅ | 82/82 `appId` únicos en la corrida en vivo |
| Sin nombres corruptos | ✅ | 0 entradas con `?`/`�` en la corrida en vivo |
| Filtro por texto | ✅ | preexistente |
| Elegir desde procesos abiertos | ✅ | preexistente |
| Caché vieja se reconstruye sola | ✅ | `schemaVersion` verificado |

**Scenarios verificados**: 6/7; el 7° depende de qué haya instalado en la máquina, no del código.

### deselect-from-saved-selection

Sin cambios respecto de lo que dejó `sdd-apply`: el guard reordenado y el CSS corregido se
confirmaron por lectura y coinciden exactamente con D-6 (ver `## Verificado OK`, punto 6). Los
4 criterios de interacción de click sobre el modal real quedan pendientes de Windows.

### selection-type-manual-vs-auto

Sin cambios. `addAsType` por defecto `'auto'`, el toggle propaga `type` hasta
`add-to-selection`, y la reconciliación de arranque (`loadSelection`) se re-verificó como
parte del punto 1 de escrutinio (carrera del reductor) contra el código real.

### inline-session-naming

| Criterion | Status | Notas |
|-----------|--------|-------|
| Agregar nunca pide nombre | ✅ | preexistente |
| Click abre edición con Enter confirma | ❌ pendiente | requiere DOM real |
| Esc cancela sin cambios | ❌ pendiente | requiere DOM real (estructural: `cancelEdit` no llama `renameSession`) |
| Se puede renombrar cuantas veces se quiera mientras está abierta | ✅ | **nuevo**: 3 llamadas sucesivas, último valor gana |
| Se congela al cerrar, sin cambios posteriores | ✅ | **nuevo**: `renameSession` tras `closeRow` es no-op comprobado |
| Sin nombre se comporta como antes | ✅ | preexistente |

### group-composition-and-drag

| Criterion | Status | Notas |
|-----------|--------|-------|
| Arrastrar a la franja crea grupo editable | ❌ pendiente | requiere mouse real |
| Cada fila conserva su reloj | ✅ | `setRowGroup` no toca `elapsedMs`/`pid`/`state` |
| Cada fila conserva su entrada de historial propia | ✅ | verificado end-to-end (ver sessions-json-persistence) |
| Total = suma de las filas | ✅ | `buildDayTimeline`, verificado exhaustivamente |
| Sacar una fila la devuelve al listado suelto | ✅ | **nuevo**: `setRowGroup(appId, null)` real, hermana no afectada |
| Grupo sin filas deja de existir | ✅ | estructural, sin entidad persistida |

### selector-listing-icons

Sin cambios de AC respecto de `sdd-apply`: los 4 criterios son observación visual/temporal con
la app real corriendo, que este entorno no puede dar. Sí se re-verificó de forma independiente,
con concurrencia real fabricada (no simulada), el mecanismo de fondo del que depende esta spec
— ver punto 4 de escrutinio.

### session-view

Sin cambios. `buildDayTimeline` (su fuente de orden/colapso) está cubierta exhaustivamente por
los tests de `session-aggregate.js` re-corridos en esta fase.

### usage-chart-by-interval

Sin cambios de AC. `chartInterval`/`chartLabel` re-verificados con los mismos tres casos
exactos de `design.md` (día/mes/rango) contra el código real de `HistoryView.vue`.

### Tests

No hay test runner en el proyecto (confirmado, sin cambios). La verificación se apoyó en:

```
npx eslint src --ext .js,.vue        → limpio (0 errores/warnings)
npx vue-cli-service build            → OK, 3 warnings de tamaño (preexistentes, no de este cambio)
npx vue-cli-service electron:build --dir → OK (renderer + bundle de main process)
```

`node -e` directo contra los módulos reales del worktree (ver detalle en `## Verificado OK`),
y `powershell.exe`/`tasklist.exe` reales vía interop WSL→Windows.

**Cobertura**: toda la lógica pura del cambio (`reduceLifecycle`, `reduceFocus`, `removeRow`,
`session-log-parser.js`, `session-aggregate.js`, `installed-apps-filter.js`) se ejercitó con
entradas fabricadas y, donde aplica, contra corpus reales (`usage-log.txt`,
`installed-apps-cache.json`, una enumeración PowerShell en vivo). El código con estado del main
process (`monitor-engine.js`, `session-log.js`, `icon-cache.js`) se ejercitó con `electron`
mockeado sobre disco real sirviendo del scratchpad (nunca el `userData` real).

## Hallazgos de Seguridad

Domain `feature`, no aplica análisis de seguridad dedicado. Sin hallazgos: no se introducen
inputs de red nuevos: las dos invocaciones PowerShell nuevas modificadas son las mismas dos
preexistentes con un `[Console]::OutputEncoding` agregado; los canales IPC nuevos
(`get-sessions`, `get-session-dates`, `rename-session`, `rename-group`, `set-row-group`) no
exponen filesystem arbitrario (rutas fijas bajo `userData`, resueltas por el propio módulo, no
recibidas del renderer).

## Verificado OK (comando y salida, o cita)

**1. Reductor con baja atómica (Tarea 7, ADR-0009)** — tres escenarios fabricados contra
`reduceLifecycle` real (`src/main/monitor-engine.js`): carrera (manual muere y su `appId`
aparece en `discovered` en el mismo tick) → no renace, sale de `selection`; sin cierres →
`selection` es la misma referencia; auto con PID muerto → sale de `rows`, permanece en
`selection`. Los tres dieron el resultado esperado.

**2. Migración one-shot (ADR-0007)** — contra una copia del `usage-log.txt` real (32 líneas,
0 descartes): `parseLegacyLog` conserva el literal `"null"` de `Aplicación: null`
(`durationMs: 16000`), las 3 duplicadas exactas de Chrome, y `durationMs` sale del campo
`Duración` (`5000`) y no de `endedAt-startedAt` (`78000`, distinto). `migrateLegacyLogAt`:
1ª corrida → `sessions=32`, `.bak` creado, original ausente; 2ª corrida idempotente (contenido
byte-idéntico); corte a medio camino (paso 1 ya corrido, `.txt` todavía presente) → una corrida
posterior completa solo el paso 2 sin reprocesar `sessions.json` (`before === after`).

**3. `before-quit` sincrónico** — `grep -n "appendFile" src/main/session-log.js` sin resultados;
`json-store.js::writeJson` usa `fs.writeFileSync` (síncrono). Verificado además end-to-end:
`monitorEngine.closeAllRows('app-quit')` sobre 3 filas reales (vía `addToSelection`) deja
`sessions.json` con 3 entradas y `rows` en 0, sin ningún `await` entre el evento y la escritura.

**4. Batching de `persistToDisk`** — concurrencia real fabricada (no simulada): 20 llamadas a
`icon-cache.js::getIcon` con extracción nativa mockeada por `setTimeout` (10-30ms, más lenta
que un microtask), disparadas en el mismo tick vía `Promise.all`. Resultado:
`app-icons-cache.json` termina con **20 entradas y 1 sola escritura** (`fs.writeFileSync`
contado por spy). Ninguna clave se pierde bajo concurrencia (S1), confirma el debounce descrito
en el comentario del archivo.

**5. Guarda `isDragging`** — verificado por lectura: el `watch: 'monitoredApps.rows'` de
`CronometroAplicacion.vue` hace `if (this.isDragging) return` antes de reconstruir
`dragUngrouped`/`dragGrouped`; `isDragging` se activa en `@start` y libera en `@end` de ambos
`<draggable>`. `monitoredApps.rows` se reemplaza por referencia entera en cada snapshot
(`applySnapshot`), consistente con lo que la guarda necesita interceptar. El efecto sobre un
gesto de mouse real >1s con un snapshot llegando en medio no es observable sin DOM.

**6. Deselección** — `AppSelectorModal.vue::choose()`: `if (this.isSelected(...)) { removeApp; return }` antes de evaluar `limitReached`. La clase `disabled` es
`monitoredApps.limitReached && !isSelected(appEntry.appId)` — no bloquea el click sobre filas
ya seleccionadas cuando el límite está alcanzado.

**7. Confinamiento del bundle (ADR-0010)** — build real corrido en esta fase (no solo leído):
`chunk-vendors.js` 522 KiB (línea base sin chart.js), `chunk-chart-vendors.js` 177 KiB aparte.
`dist/index.html` referencia solo `chunk-vendors`/`index.js`; `dist/history.html` referencia
`chunk-chart-vendors`+`chunk-vendors`+`history.js`. `grep -c "Chart.js v"`: 0 en
`chunk-vendors.js`, 2 en `chunk-chart-vendors.js`. `dist`/`dist_electron` eliminados al cerrar.

**8. Fix de encoding — invocación PS real desde el módulo** — se extrajo el comando exacto que
construye `listOpenWindows()` (no una aproximación) interceptando `child_process.exec`, y se
corrió contra `powershell.exe` real: produjo la lista de ventanas abiertas reales de esta
máquina con nombres correctamente acentuados (`"Configuración"`). Control negativo: el mismo
repro sin el fix da `ó`=`a2` (CP-850); con el fix, `ó`=`c3 b3` (UTF-8) — reproducido con
`powershell.exe -NoProfile -Command "[Console]::OutputEncoding = ...; [PSCustomObject]@{n='Cronómetro versión'} | ConvertTo-Json"`.
Además, se corrió el comando exacto de `buildInstalledAppsScript()` (188 shortcuts reales del
Menú Inicio) y se aplicó `filterInstalledApps` real: **188 → 82** entradas, 0 con carácter de
reemplazo, `"Cronómetro App"` (con tilde) presente y correctamente formado — supera lo que
`design.md`/`observations.md` habían podido verificar (contra la caché vieja, no una
enumeración en vivo).

**9. Bug de zona horaria del historial** — `grep -rn "toISOString" src/history/` solo aparece en
comentarios explicando qué NO hacer. `HistoryView.vue` usa `formatDateYYYYMMDD` en
`selectedDate`, `handleDateClick` y el filtro. `TZ=America/Santiago node -e`:
`formatDateYYYYMMDD` da `2026-08-02` a las 21:30 hora de Chile; `toISOString().split('T')[0]`
da `2026-08-03` — confirma el bug viejo y la corrección nueva.

**10. `fluid-dnd` removido** — `grep -rn "fluid-dnd" package.json src/` sin resultados;
`grep -rn "fluid" src/` sin resultados; `npm ls fluid-dnd` → vacío.

**Módulos puros re-verificados con `node -e`** (mismos casos de `design.md`/`tasks.md`,
re-ejecutados contra el código real, no solo releídos): `session-aggregate.js` (los 4 casos:
borde `from==to`, `aggregateByApp` desc, `buildDayTimeline` colapsa grupo con suma de
duraciones, `monthBounds` en 28/29/30/31 días); `get-sessions`/`get-session-dates` contra el
historial migrado real (abril 2025 → 10 entradas, 9 fechas únicas — coincide con V1 de
`design.md`).

## Pendiente de Windows (qué y cómo verificarlo)

Coincide con lo ya documentado por `sdd-apply` en `observations.md` — no hay hallazgos nuevos
de qué falta, solo la confirmación de que la atribución a "requiere entorno" es honesta:

- Todo gesto de mouse real: drag & drop de grupos (Tarea 20), el guion completo del selector de
  íconos con la ventana abierta (Tareas 4/6), la interacción click/teclado del nombre inline
  (Tarea 19).
- Todo lo que depende de que un proceso Windows real se abra o se cierre de verdad: la
  reconciliación de arranque end-to-end con la app real, el camino `tick()` completo
  (enumeración de procesos → `reduceLifecycle` → `appendSession`), y las dos rutas de salida
  (bandeja, `window-all-closed`) con Electron real.
- El escenario "Discord y Clip Studio aparecen" de `installed-apps-data-integrity`: depende de
  qué haya instalado en la máquina real (Clip Studio no lo está), no del código ni del entorno
  de ejecución.
- Verificación visual pura: que el gráfico renderice barras legibles con scroll, que el
  calendario muestre los puntos correctos, que el marcador de fila manual "se distinga de un
  vistazo".

Ninguno de estos ítems cambia el veredicto: son limitaciones de entorno (falta de Electron con
GUI real en este WSL2), no defectos de implementación — la separación se sostiene con la
evidencia de arriba, que en varios puntos (4, 8, y los `node -e` de `monitor-engine.js`)
ejercita el código real de producción, no una aproximación.

## Defecto encontrado

Ninguno. Cero defectos de implementación tras auditar los 10 puntos de escrutinio señalados por
fases previas, releer las 10 specs completas, y ejercitar el código real (no solo releer
afirmaciones de `sdd-apply`) con `node -e`, interop PowerShell real, y dos builds completos
(renderer + empaquetado con `electron-builder`).

## Verificaciones que exceden lo ya documentado

Tres verificaciones de esta fase van más allá de lo que `sdd-apply`/`design.md` habían podido
hacer, porque usan el interop y la concurrencia real de forma más agresiva:

1. **Encoding, end-to-end real**: se ejecutó `listOpenWindows()` y `buildInstalledAppsScript()`
   —los comandos exactos, extraídos del módulo, no una aproximación— contra `powershell.exe`
   real de esta máquina Windows, incluida la enumeración completa de 188 accesos directos del
   Menú Inicio, con el fix de encoding ya aplicado. `design.md`/`observations.md` habían
   verificado el fix de forma aislada (V4/V5) y habían inspeccionado la caché vieja (V10); esta
   fase corrió el pipeline completo en vivo.
2. **Batching de `persistToDisk` bajo concurrencia real fabricada** (no un mock síncrono): 20
   extracciones con retraso `setTimeout` variable, disparadas en el mismo tick — confirma que
   el debounce agrupa aun cuando las resoluciones no llegan todas en el mismo microtask.
3. **`closeRow`/`closeAllRows`/`renameSession`/`setRowGroup` end-to-end reales**, con
   `app.getPath` mockeado pero el resto del módulo (`monitor-engine.js`, `session-log.js`,
   `json-store.js`) sin mockear, escribiendo a disco real bajo el scratchpad. Esto cerró 8
   acceptance criteria que `sdd-apply` había dejado sin marcar por depender de "la app corriendo
   en Windows", cuando en realidad dependían de disco real + las funciones reales del main
   process, ambos ejercitables sin Electron.

## Coherencia de Grafo de Specs

Alcance: las 10 specs de `spec_refs`, más los `depends_on`/`affects` que apuntan fuera de ese
conjunto (todos existen — sin FAIL).

**Confirmado — los deltas de esta fase**: las 3 specs supersedidas por este cambio
(`row-lifecycle`, `session-log-persistence`, `installed-apps-listing-quality`) declaran
`superseded_by` apuntando correctamente a las 3 nuevas, y las 3 nuevas
(`row-lifecycle-persistence-by-type`, `sessions-json-persistence`,
`installed-apps-data-integrity`) declaran `supersedes` de vuelta. Simetría verificada en los 6
sentidos.

**WARN (metadata, no auto-corregible — requiere juicio o pertenece a un cambio ya cerrado)**:

1. `simultaneous-limit` (capability `app-monitoring`, `change_ref: app-detection-logos-audio`,
   `status: completed`) declara `depends_on: [[row-lifecycle]]` — el slug viejo, ahora
   supersedido. `row-lifecycle-persistence-by-type.affects` la incluye, pero
   `simultaneous-limit` no la referencia de vuelta ni en `depends_on` ni en `related`.
2. `empty-state` (mismo capability/change_ref/status) — mismo patrón: `depends_on: [[row-lifecycle]]`, sin referencia de vuelta a `row-lifecycle-persistence-by-type`.
3. `automatic-bw-icons` — mismo patrón para su `depends_on: [[row-lifecycle]]` (nota: esta
   spec también recibió una corrección distinta, ver abajo).
4. `sessions-json-persistence.affects` incluye `deselect-from-saved-selection`, pero
   `deselect-from-saved-selection` no declara `sessions-json-persistence` ni en `depends_on`
   ni en `related` (sí declara `row-lifecycle-persistence-by-type` en `depends_on`).

No se auto-corrigen: los 4 casos son del tipo "u debería declarar depends_on/related: [[s]]"
(dirección `affects`), que la regla de corrección automática de `sdd-verify` no cubre (solo
cubre "t debería declarar affects: [[s]]", dirección `depends_on`). Los 3 primeros además
pertenecen a specs de un cambio ya cerrado (`app-detection-logos-audio`, `status: completed`) —
tocarlas excede el alcance de esta fase. Mitigante: el slug viejo `row-lifecycle` sigue siendo
resoluble (`superseded_by` apunta a la spec nueva), así que la cadena no queda rota, solo
desactualizada.

## Correcciones de Metadata

1. `memory/specs/app-icons/automatic-bw-icons.md` — WARN del tipo auto-corregible
   ("t debería declarar affects: [[s]]"): `selector-listing-icons.depends_on` incluye
   `[[automatic-bw-icons]]`, pero `automatic-bw-icons.affects`/`.related` no incluían de vuelta
   a `selector-listing-icons`. Corrección aplicada: `affects: []` → `affects: ["[[selector-listing-icons]]"]`. `updated` ya estaba en `2026-08-02` (sin cambio necesario).

## Acciones Requeridas

Ninguna para archive. Sugerencia no bloqueante para un futuro cambio sobre `app-monitoring`
(no de este cambio): al tocar `simultaneous-limit`/`empty-state`/`automatic-bw-icons`, actualizar
su `depends_on`/`related` del slug viejo `row-lifecycle` al vigente
`row-lifecycle-persistence-by-type` — decisión de juicio (depends_on vs. related) que
corresponde a quien toque esas specs, no a esta fase.
