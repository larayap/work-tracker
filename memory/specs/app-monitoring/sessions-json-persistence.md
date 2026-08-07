---
type: capability-spec
title: "Historial estructurado en sessions.json, con nombre de sesión, grupo y cierre al salir de la app"
capability: "app-monitoring"
slug: "sessions-json-persistence"
domain: "feature"
delta_type: modified
supersedes: "[[session-log-persistence]]"
superseded_by: null
status: completed
assigned_agent: "sdd-apply"
priority: critical
depends_on: []
change_ref: "[[sessions-groups-history]]"
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/sessions-groups-history"
feature_branch: "feature/sessions-groups-history"
commits: ["7b81610843141a092a1549d7dd1c214f7df27ee1"]
mr: ""
acceptance_criteria:
  - "El reloj de una fila muestra el tiempo transcurrido desde que esa fila apareció, nunca el acumulado del día"
  - "Cerrar el proceso de un programa monitoreado registra una entrada en el historial con la duración de esa aparición"
  - "Detener una fila registra una entrada en el historial con la duración de esa aparición"
  - "Salir de la aplicación con filas abiertas registra una entrada de historial por cada una"
  - "El historial anterior en texto plano se migra una sola vez a formato estructurado, sin perder datos y sin borrar el archivo original"
  - "Una entrada de historial conserva el nombre de la sesión y la identificación del grupo cuando corresponde"
related: ["[[row-lifecycle-persistence-by-type]]", "[[legacy-userdata-one-shot-migration]]"]
affects: ["[[inline-session-naming]]", "[[group-composition-and-drag]]", "[[session-view]]", "[[usage-chart-by-interval]]"]
adrs: ["[[0002-main-process-owns-monitoring-state]]", "[[0006-userdata-json-persistence]]"]
scope: ["src/main/session-log.js", "src/background.js", "src/main/json-store.js"]
verified_at: "2026-08-02"
created: "2026-08-02"
updated: "2026-08-06"
tags: [capability-spec]
---

# Historial estructurado en sessions.json, con nombre de sesión, grupo y cierre al salir de la app

## Purpose

El reloj de cada fila sigue respondiendo "cuánto llevo en esto ahora", y cada sesión se sigue
abriendo y cerrando en los mismos instantes que hoy. Lo que cambia es dónde y cómo queda ese
historial: pasa de una línea de texto simple a un registro estructurado que además guarda el
nombre que el usuario le puso a la sesión y el grupo al que pertenecía, y que se puede
consultar por cualquier rango de fechas sin depender de leer texto línea por línea. El
historial existente se migra una sola vez, sin perderse. Y una sesión que quedaba abierta al
cerrar la aplicación —hoy una pérdida silenciosa de tiempo— pasa a cerrarse y registrarse
también en ese momento.

## Requirements

- El sistema SHALL abrir una sesión nueva cada vez que una fila aparece en el listado
  visible, con el reloj de esa fila arrancando en cero.
- El sistema SHALL acumular en la sesión abierta el tiempo durante el cual la fila está en
  estado corriendo, sin acumular mientras está en estado pausado.
- El sistema SHALL cerrar y registrar en el historial la sesión de una fila en el instante
  en que el proceso de ese programa se cierra.
- El sistema SHALL cerrar y registrar en el historial la sesión de una fila en el instante
  en que el usuario presiona el control de detener esa fila.
- El sistema SHALL cerrar y registrar en el historial toda sesión que siga abierta en el
  instante en que el usuario cierra la aplicación, con la misma completitud que los otros
  dos eventos de cierre.
- El sistema SHALL NOT registrar ninguna entrada en el historial en momentos distintos de
  esos tres: perder el foco, por sí solo, nunca cierra ni registra una sesión.
- El sistema SHALL abrir una sesión independiente y nueva, arrancando en cero, cada vez que
  una fila vuelve a aparecer después de haber sido registrada y cerrada.
- El sistema SHOULD permitir que un mismo programa acumule varias entradas de historial en
  un mismo día cuando se usa en varios tramos separados.
- El sistema SHALL registrar, para cada entrada de historial, la fecha, el programa, los
  instantes de inicio y fin, la duración, el nombre de la sesión si el usuario le puso uno, y
  la identificación del grupo si la sesión pertenecía a uno.
- El sistema SHALL migrar automáticamente el historial anterior en texto plano al nuevo
  formato estructurado, la primera vez que la aplicación arranca después de esta
  actualización, sin requerir ninguna acción del usuario.
- El sistema SHALL conservar el archivo de historial original, sin modificarlo ni borrarlo,
  una vez completada la migración.
- El sistema SHALL realizar la migración de forma que, si se interrumpe, el historial
  original quede intacto y sin migrar, o la migración quede completa: nunca un historial
  estructurado a medio migrar o corrupto.
- El sistema SHALL convertir al historial estructurado en la única fuente que toda parte de
  la aplicación lee para mostrar datos de historial, una vez completada la migración.
- El sistema SHOULD permitir consultar el historial por cualquier rango de fechas arbitrario
  sin que el tiempo de respuesta se degrade a medida que el historial crece.

## Scenarios

### Scenario: El reloj muestra la sesión en curso, no el total del día

**GIVEN** una fila que lleva un rato acumulando tiempo en la sesión actual
**WHEN** el usuario mira el reloj de esa fila
**THEN** ve el tiempo transcurrido desde que la fila apareció, no el total acumulado en el
día para ese programa

### Scenario: Cerrar el proceso registra la sesión

**GIVEN** una fila con una sesión abierta y tiempo acumulado
**WHEN** el usuario cierra el proceso de ese programa
**THEN** se registra en el historial una entrada con la duración de esa sesión

### Scenario: Detener la fila registra la sesión

**GIVEN** una fila con una sesión abierta y tiempo acumulado
**WHEN** el usuario presiona el control de detener esa fila
**THEN** se registra en el historial una entrada con la duración de esa sesión

### Scenario: Salir de la aplicación registra las sesiones abiertas

**GIVEN** una o más filas con sesión abierta y tiempo acumulado
**WHEN** el usuario cierra la aplicación
**THEN** se registra en el historial una entrada por cada sesión que estaba abierta, con su
duración hasta ese instante

### Scenario: Perder el foco no registra nada

**GIVEN** una fila con una sesión abierta, en estado corriendo
**WHEN** el programa pierde el foco
**THEN** no se registra ninguna entrada en el historial y la sesión sigue abierta

### Scenario: Reaparición abre una sesión nueva

**GIVEN** un programa cuya sesión anterior ya fue registrada en el historial
**WHEN** ese programa vuelve a aparecer en el listado visible
**THEN** arranca una sesión nueva con el reloj en cero, independiente de la anterior

### Scenario: El historial anterior se migra la primera vez que se abre la app

**GIVEN** un historial existente en el formato de texto anterior
**WHEN** el usuario abre la aplicación por primera vez después de esta actualización
**THEN** el historial queda disponible en el nuevo formato estructurado sin que el usuario
haga nada, y el registro anterior se conserva sin modificar

### Scenario: Una sesión con nombre y grupo queda registrada con esos datos

**GIVEN** una sesión que el usuario nombró y que pertenece a un grupo
**WHEN** esa sesión se cierra y se registra
**THEN** la entrada del historial conserva el nombre de la sesión y la identificación del
grupo

## Acceptance Criteria

Implementación completa (commit 7b81610). Los criterios con verificación directa en esta
fase (`node -e` contra el código real, o lectura estructural sin ambigüedad) quedan marcados;
`sdd-verify` extendió la cobertura con `monitorEngine.closeRow`/`closeAllRows`/`renameSession`
reales (`app.getPath` mockeado, disco real bajo el scratchpad, nunca `userData`). Solo el
camino disparado por `tick()` sobre un proceso que muere de verdad (enumeración PID vía
`tasklist`/`active-win`) requiere la app corriendo en Windows y queda documentado en
`observations.md` (etapa 4).

- [x] El reloj de una fila muestra el tiempo transcurrido desde que esa fila apareció,
  nunca el acumulado del día. (comportamiento preexistente de `reduceFocus`/`elapsedMs`, sin
  cambios de este cambio)
- [ ] Cerrar el proceso de un programa monitoreado registra en el historial una entrada con
  la duración de esa aparición. (la composición `reduceLifecycle.closed` →
  `sessionLog.appendSession` está verificada por partes —`reduceLifecycle` produce `closed`
  correctamente, `appendSession`/`appendSessions` escriben correctamente— pero el camino
  completo disparado por `tick()` sobre un PID que muere de verdad no se ejercitó de punta a
  punta en este entorno: requiere enumeración de procesos reales)
- [x] Detener una fila registra en el historial una entrada con la duración de esa
  aparición. (verificado en `sdd-verify`: `monitorEngine.closeRow` real sobre dos filas
  —manual y automática— deja `sessions.json` con una entrada por cada una)
- [x] Cerrar la aplicación con filas abiertas registra en el historial una entrada por cada
  una, con su duración hasta ese instante. (verificado en `sdd-verify`: `closeAllRows`
  real sobre 3 filas abiertas deja `sessions.json` con 3 entradas, escritas en una sola
  llamada a `jsonStore.writeJson`, y `rows` queda en 0)
- [x] Perder el foco, sin cerrar el proceso ni detener la fila, no registra ninguna entrada
  en el historial. (estructural: `reduceFocus` no invoca `appendSession`/`appendSessions` en
  ningún camino, solo transiciona `state`)
- [x] Un programa usado en varios tramos durante el mismo día produce una entrada de
  historial por tramo. (verificado en `sdd-verify`: abrir y cerrar el mismo `appId` dos veces
  seguidas —`addToSelection` → `closeRow` → `addToSelection` → `closeRow`— deja dos entradas
  en `sessions.json` con `id` distinto)
- [x] El historial anterior en texto plano se migra automáticamente al nuevo formato la
  primera vez que arranca la aplicación, sin pérdida de datos y sin borrar el archivo
  original. (verificado exhaustivamente: protocolo completo, idempotencia, corte a medio
  camino, contra la copia real de 32 líneas; re-verificado en `sdd-verify`)
- [x] Una entrada de historial de una sesión nombrada y agrupada conserva ambos datos.
  (verificado en `sdd-verify`: `renameSession` + `setRowGroup` + `renameGroup` sobre dos
  filas, cerradas con `closeRow`, dejan cada entrada de `sessions.json` con su propio
  `sessionName`/`groupId`/`groupName` — sin fusionarse, la fila sin nombre propio queda con
  `sessionName: null` y el `groupId`/`groupName` del grupo)

## Related

- [[row-lifecycle-persistence-by-type]] — los eventos que cierran una sesión (cierre de
  proceso, detener) son los mismos que rigen la salida y reentrada de la fila en el listado
  visible; el cierre de la aplicación es un tercer evento de cierre que esta spec agrega
- [[inline-session-naming]] — provee el nombre que esta spec persiste en cada entrada
- [[group-composition-and-drag]] — provee la identificación de grupo que esta spec persiste
  en cada entrada
- [[session-view]] — consume el historial estructurado para mostrar la vista por sesión
- [[usage-chart-by-interval]] — consume el historial estructurado para agregar por
  intervalo de fechas arbitrario
- [[legacy-userdata-one-shot-migration]] — el traspaso de `userData` al renombrar el
  producto pone a disposición, bajo la identidad nueva, el `sessions.json` que esta spec
  persiste
