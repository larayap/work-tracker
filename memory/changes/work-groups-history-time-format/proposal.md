---
type: change-proposal
change_name: "work-groups-history-time-format"
jira_key: "POM-1"
status: approved
effort: M
risks:
  - id: R1
    descripcion: "Los ítems visuales (2, 4, 7) y el aspecto visual del 1 se entregan sin haber corrido el código modificado. El entorno SÍ permite observar la UI: hay interop con Windows y la app se capturó con éxito antes del pipeline (click en el ícono de bandeja, porque la ventana arranca con show:false). Pero eso observa el build instalado, no el código nuevo: el repo no tiene node_modules, no hay runner ni CI, y levantar la versión modificada exige un npm install + electron:serve todavía no verificado en este entorno."
    probabilidad: Media
    impacto: Bajo
    mitigacion: "Intentar el arranque real en sdd-verify por el camino ya probado (interop + ícono de bandeja); si no prospera, tratar la confirmación visual del usuario como criterio de aceptación explícito de esos ítems. Los tres ajustes visuales son de una a dos líneas: corregirlos tras el feedback es barato."
  - id: R2
    descripcion: "Regresión del arrastre al pasar de dos listas fijas a N: la guarda isDragging hoy suspende la reconstrucción de dos arrays; con N contenedores puede quedar un hueco donde un snapshot del main pise un arrastre en curso."
    probabilidad: Media
    impacto: Alto
    mitigacion: "Guarda única a nivel de componente (no por lista) y reconstrucción atómica de toda la colección al terminar el gesto; verificación manual de los cuatro gestos de group-composition-and-drag."
  - id: R4
    descripcion: "La unificación por nombre visible fusiona dos programas legítimamente distintos que comparten nombre de acceso directo, reintroduciendo por otra vía la mezcla que el fix F1 corrigió. Ya no es hipotético: el ítem 3 ahora modifica de verdad la clave de agrupación de session-aggregate.js."
    probabilidad: Media
    impacto: Alto
    mitigacion: "La clave nunca vuelve a ser `appId` desnudo. Control negativo y positivo con `node -e` sobre las 44 entradas reales de sessions.json antes y después del cambio, mismo procedimiento que sustentó F1; el delta de spec deja escrito el criterio nuevo y su verificación."
  - id: R6
    descripcion: "El ítem 3 se entrega con `Chrome` y `Google Chrome` todavía en dos barras: el usuario pidió literalmente juntar 'todos los chrome' y la unificación por nombre exacto no los junta, porque en sus datos son dos nombres visibles distintos."
    probabilidad: Media
    impacto: Bajo
    mitigacion: "Queda como decisión objetable explícita en esta propuesta, con las tres alternativas evaluadas y su costo. Si el usuario objeta al aprobar, la normalización de nombres distintos se trata como cambio aparte, antes de sdd-spec."
created: "2026-08-05"
updated: "2026-08-05"
tags: [change, proposal]
---

# Propuesta: work-groups-history-time-format (v2 — post clarificaciones)

## Intent

POM-1 pide siete ajustes sobre la ventana de trabajo y la de historial: permitir más de un
grupo de sesión, limpiar y aclarar el gráfico del historial, hacer legible el título de
sesión, y llevar las horas de reloj a `HH:MM` con preferencia 12h/24h configurable.

## Scope

**Entra**: los siete ítems, todos en el renderer salvo el default nuevo de `settings.json`,
más un delta sobre dos specs vigentes (ver ítem 3).

**No entra**:
- **Fuente global de la ventana del cronómetro** (`App.vue`), título "Work" y Pomodoro:
  conservan la decorativa por decisión explícita del usuario (Q1).
- **Fuente del gráfico** (`ChartJS.defaults.font.family` y su `@import` en `UsageChart.vue`):
  se conserva la decorativa por el mismo criterio. Decisión heredada objetable.
- **Tema claro del historial**: descartado por Q3. `dark-loading-state` queda intacta.
- **Columnas de tiempo de "Por app" y "Por sesión"**: intactas por Q2 (pero ver trade-off 1:
  las *filas* de "Por app" sí se funden como consecuencia del ítem 3).
- **Normalización de nombres visibles distintos** (`Chrome` vs `Google Chrome`): fuera, ver
  decisión de diseño del ítem 3.
- **Entradas con nombre basura de la migración** (`app: "null"`): fuera, ver mismo apartado.
- Modelo ni persistencia de grupos: siguen siendo metadata por fila (ADR-0008).
- El límite de 4 filas simultáneas del monitor; `msToHHMMSS` (duraciones); tests
  automatizados (el proyecto no tiene runner: la verificación es manual).

## Approach por ítem

| # | Ítem | Approach | Archivos | Esf. |
|---|---|---|---|---|
| 1 | Grupos múltiples | Colección indexada por `groupId` derivada del snapshot + `v-for` de N contenedores; franja vacía persistente como zona de creación. El modelo ya soporta N (`groupId` por fila): el techo está solo en la UI (`activeGroupId = grouped[0].groupId`) | `CronometroAplicacion.vue` | M |
| 2 | Ocultar horas | `scales.x.display: false`; el tooltip conserva el valor exacto | `UsageChart.vue` | XS |
| 3 | Agrupar apps | Clave de agrupación por **nombre visible normalizado**, `appId` fuera de la clave; rótulo y semántica de `appId` definidos abajo. Verificado contra datos reales: **14 barras → 11** | `session-aggregate.js` + delta de 2 specs | S |
| 4 | Tipografía | Override local de `font-family` en `.app-name` y `.app-name-input` (mismo elemento renderiza `sessionName \|\| name`, no son separables por CSS y no hace falta) | `AppRow.vue` | XS |
| 5+6 | Hora `HH:MM` + 12h/24h | **Unidad única**: nueva `formatTimeHHMM(date, format)` pura (formato por parámetro, sin leer el store); `timeFormat` en `defaultSettings`, store y `OpcionesPanel`, siguiendo ADR-0006 | `time-format.js`, `BySessionView.vue`, `ipc-handlers.js`, `settings.js`, `OpcionesPanel.vue` | S |
| 7 | Gráficos más blancos | `backgroundColor` de las barras de `#6f6f6f` a gris claro sobre el fondo oscuro actual | `UsageChart.vue` | XS |

## Decisión de diseño (ítem 1): cómo nace el segundo grupo

Se mantiene el gesto único que ya existe: la franja "Arrastrá aquí para agrupar" se vuelve
permanente debajo de los grupos existentes mientras queden filas sueltas; al soltar la primera
fila se convierte en grupo con cabecera editable y aparece una franja vacía nueva. **Razón**:
con grupos como metadata por fila (ADR-0008) un grupo vacío no existe en el modelo, y un botón
"+ nuevo grupo" crearía un grupo fantasma que el próximo snapshot del main borraría. **Costo**:
alto vertical fijo mientras haya filas sueltas; con el límite de 4 filas el techo son 4 grupos.
Objetable al aprobar.

## Decisión de diseño (ítem 3): unificación por nombre visible

**Regla**: `groupKeyOf(entry)` pasa a ser `'name:' + String(entry.app ?? '').trim().toLowerCase()`.
El `appId` sale de la clave por completo.

**Por qué no revierte F1**: F1 falló por agrupar por `appId` **desnudo** — las entradas migradas
llevan `appId: null` y colapsaban todas en una fila. La clave nueva nunca colapsa nombres
distintos: usa siempre lo que F1 ya usaba como degradación. Medido sobre las 44 entradas reales
del usuario: hoy 14 barras, con la clave nueva 11; se funden los tres pares con rótulo repetido
(`Google Chrome`, `Firefox`, `League of Legends`) y **ningún programa distinto se fusiona**.

- **Rótulo de la fila fusionada**: el nombre más corto entre las variantes, desempate por primera
  aparición — mismo criterio que ya aplica `installed-apps-filter.js:98` (fix F4) para elegir
  entre accesos directos. Reuso de un criterio existente en vez de inventar uno.
- **`appId` de la fila fusionada**: la fila deja de representar un ejecutable único. Se conserva
  el campo del shape documentado `{ key, appId, app, durationMs }` con semántica redefinida —
  **primer `appId` no nulo entre los miembros, o `null`; informativo, no identificatorio**.
  Hoy ningún consumidor lo lee (`ByAppView.vue:10` usa `row.key`, `UsageChart.vue:51,55` usan
  `app`/`durationMs`), así que eliminarlo sería más limpio pero fuerza un delta extra sobre el
  shape documentado sin ganancia funcional.
- **`key`**: sigue única por fila (`name:<normalizado>`), que es lo que exige el `v-for` de
  `ByAppView.vue:10` — la trampa que F1 dejó anotada.
- **`Chrome` vs `Google Chrome`**: **no se unifican**. Quedan dos barras (Chrome ~2h41m;
  Google Chrome 23m + 2m). Alternativas evaluadas y descartadas: (a) tabla de alias hardcodeada
  — lista arbitraria a mantener para siempre, no sale de los datos, viola SSOT/YAGNI; (b)
  heurística de sufijo por palabra ("Google Chrome" termina en "Chrome") — funciona para
  Teams/Microsoft Teams, pero su modo de falla es exactamente el que F1 existe para evitar
  (cualquier "X Client" contra un "Client" suelto); (c) backfill del `appId` de las entradas
  viejas contra el catálogo de apps instaladas — única vía basada en datos, pero exige IPC nuevo
  desde el historial y acopla `session-aggregate.js` (puro, cero dependencias) a un catálogo de
  runtime, o bien una migración destructiva sobre el único archivo de datos del usuario. **Si el
  usuario insiste en juntar los chrome, entra como cambio aparte** (probablemente (c), en
  persistencia). Objetable al aprobar → R6.
- **Caso borde `app: "null"`**: verificado — es el **string** `"null"`, no `null` de JS: 1 entrada,
  16 s, `appId: null`. Es basura de la migración del log viejo (ADR-0007), no un defecto de
  agregación. El agregador **no la filtra** (un módulo puro que descarta datos oculta el problema
  y borra tiempo registrado); sí se blinda la normalización con `String(entry.app ?? '')`. La barra
  rotulada `null` queda visible, declarada y fuera de alcance.
- **Delta de specs**: el criterio nuevo **contradice texto vigente** de dos specs `completed` —
  el criterio verificado de `usage-chart-by-interval` (documenta la clave degradada como el fix
  correcto) y la nota F1 de `judgment-fixes-sessions-groups-history`. sdd-spec debe emitir ese
  delta, no solo la spec nueva.
- **Verificación**: control negativo y positivo con `node -e` sobre `sessions.json` real, mismo
  procedimiento que sustentó F1. El control negativo ya corrió en esta iteración (14 barras, con
  tres rótulos repetidos).

## Trade-offs explícitos

1. **Ítem 3 toca también la tabla "Por app"**: `aggregateByApp` es consumido por el gráfico
   (`UsageChart.vue:47`) *y* por `ByAppView.vue:33`. Cambiar la clave funde también sus filas
   (14 → 11). Q2 dijo que las listas de abajo no se tocan — eso aplicaba a las *columnas de
   tiempo*; este efecto es inseparable del arreglo y es coherente (una tabla que lista
   "Google Chrome" dos veces está igual de mal).
2. **Ítem 2**: ocultar el eje deja el valor exacto solo en el tooltip; la lista "Por app" sigue
   dando el total exacto.
3. **Ítem 4**: la ventana queda con dos tipografías conviviendo. Es lo que el usuario pidió
   explícitamente; revertir a alcance global sería un cambio de una línea.
4. **Ítem 4 vs gráfico**: el gráfico queda como único elemento decorativo de una ventana que ya
   usa `sans-serif`. Se conserva por criterio conservador sobre "dejá lo demás con la tipografía".
5. **Ítem 5**: función nueva en vez de mutar `formatTimeHHMMSS` in-place — el nombre queda
   coherente con lo que devuelve y absorbe el ítem 6; el costo es tocar el único llamador.
6. **Ítem 6**: la preferencia tiene hoy **un solo consumidor real** (el rango horario del
   historial). No se centraliza nada más por YAGNI.

## Riesgos

R1 verificación visual del código modificado, posible pero no establecida (Media / Bajo) ·
R2 regresión de arrastre con N listas (Media / Alto) · R4 la unificación por nombre fusiona
programas distintos (Media / Alto) · R6 los dos "chrome" siguen separados (Media / Bajo).
Detalle y mitigación en el frontmatter.

## Esfuerzo

**M**. El grueso sigue siendo el ítem 1: refactor de UI de un componente de 299 líneas cuyo
modelo ya soporta N grupos. Alrededor, una preferencia end-to-end sobre un patrón ya probado
(5+6), un cambio acotado en un módulo puro de 102 líneas con delta de dos specs (3) y tres
ajustes de una a dos líneas (2, 4, 7). Nueve archivos, ninguno en el main salvo un default nuevo.

No sube a L: las dos respuestas se compensan. Q4 confirmó el problema del ítem 3, pero su
solución resultó ser un cambio de clave de ~10 líneas en un módulo sin dependencias, no una
reescritura del agregador; y en paralelo Q1 redujo el ítem 4 de tres archivos a uno y Q3
eliminó el escenario caro (tema claro del historial, que era lo que habría justificado L).
