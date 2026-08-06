---
type: adr
title: "La identidad de aplicación en la agregación del historial es el nombre visible normalizado"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-05"
change_ref: "[[work-groups-history-time-format]]"
capability: "history-window"
tags: [adr]
---

# La identidad de aplicación en la agregación del historial es el nombre visible normalizado

## Context

`src/utils/session-aggregate.js::aggregateByApp` decide qué entradas del historial pertenecen
a "la misma aplicación". Es la única definición operativa de identidad de aplicación en la
ventana de historial, y la comparten dos consumidores: el gráfico de barras
(`UsageChart.vue`) y la tabla "Por app" (`ByAppView.vue`).

El criterio vigente hasta este cambio es `entry.appId != null ? entry.appId : 'name:' + entry.app`:
identidad de **ejecutable** (ruta en minúsculas), con degradación al nombre visible cuando la
entrada no tiene ruta. Ese criterio no es arbitrario: reemplazó a una versión que agrupaba por
`appId` desnudo y colapsaba **todos** los programas migrados en una sola fila, porque el
formato viejo (`usage-log.txt`, ADR-0007) nunca registró la ruta del ejecutable y la migración
dejó todas esas entradas con `appId: null`. Esa corrección (F1 de
[[judgment-fixes-sessions-groups-history]]) fue verificada contra los datos reales del usuario
y está documentada en el comentario de cabecera de la función.

El problema que aparece ahora no es el que F1 resolvió, sino su reverso, y solo se manifiesta
cuando **conviven** los dos orígenes de registro para el mismo programa. Verificado sobre las
44 entradas reales de `sessions.json` del usuario (`node -e`, 2026-08-05):

| Nombre visible | `appId` distintos | Efecto hoy |
|---|---|---|
| `Google Chrome` | `null` (13 entradas) + ruta real (8) | **2 barras con el mismo rótulo** |
| `Firefox` | `null` (3) + ruta real (2) | **2 barras con el mismo rótulo** |
| `League of Legends` | `null` (2) + ruta real (1) | **2 barras con el mismo rótulo** |

Es decir: el criterio de identidad depende de **cuándo** se registró la sesión, no de qué
programa fue. Un programa usado antes y después de la migración se parte en dos filas con
rótulo idéntico, y ninguna de las dos muestra su tiempo total.

La condición que sostenía el criterio de ejecutable —"la ruta es el identificador estable, el
nombre es una degradación"— no se cumple sobre este historial: para la mayoría de las entradas
la ruta simplemente **no existe**, y no hay forma de reconstruirla sin acoplar un módulo puro a
un catálogo de runtime o migrar destructivamente el único archivo de datos del usuario.

## Decision

La identidad de aplicación en la agregación del historial pasa a ser el **nombre visible
normalizado**:

```js
groupKeyOf(entry) === 'name:' + String(entry.app ?? '').trim().toLowerCase()
```

`appId` **sale por completo de la clave de agrupación**.

Tres invariantes que este ADR fija y que hay que sostener:

1. **La clave nunca vuelve a ser `appId` desnudo.** Ese es el defecto que F1 corrigió y que
   este criterio no puede reintroducir por ninguna vía. La clave nueva usa siempre lo que F1
   ya usaba como degradación, ahora como caso único: no hay dos caminos.
2. **Dos nombres visibles distintos nunca se fusionan.** La normalización es exactamente
   `trim()` + `toLowerCase()`: no hay tabla de alias, ni heurística de sufijo, ni comparación
   difusa. `Chrome` y `Google Chrome` siguen siendo dos filas.
3. **El campo `appId` de la fila agregada deja de ser identificatorio.** Sobrevive en el shape
   `{ key, appId, app, durationMs }` con semántica redefinida: **primer `appId` no nulo entre
   los miembros, o `null`; informativo, nunca clave**. `key` es lo único que identifica una
   fila, y es lo que los `v-for` deben usar.

El rótulo de una fila con varias variantes de escritura se elige con el **mismo criterio que
`installed-apps-filter.js` ya aplica** para elegir entre accesos directos del mismo ejecutable
(fix F4, verificado en `installed-apps-filter.js:96-100`): gana el `app` más corto, y ante
empate de longitud se conserva el que ya ganaba, es decir el de primera aparición. Se reusa un
criterio existente en vez de inventar un segundo criterio de rotulado para el mismo proyecto.

## Consequences

**Positivas:**

- Un programa usado antes y después de la migración muestra su tiempo total en una sola barra
  y una sola fila. Medido sobre los datos reales: **14 filas → 11**, con la suma total de
  `durationMs` idéntica antes y después (nada de tiempo registrado se pierde ni se duplica).
- La identidad deja de depender del momento del registro. El historial migrado y el nuevo se
  comportan igual, que es lo que ADR-0007 buscaba y el criterio de ejecutable no lograba.
- Un único camino en la función: desaparece la rama de degradación y con ella la clase entera
  de defectos donde el resultado depende de si `appId` está presente.
- La corrección alcanza al gráfico y a la tabla "Por app" al mismo tiempo, porque ambos
  consumen el mismo agregador. No hay forma de que diverjan.

**Trade-offs:**

- **Dos programas legítimamente distintos que compartan nombre visible exacto se fusionan.**
  Es el riesgo real que el criterio de ejecutable evitaba. No se mitiga con código: se acota
  con verificación sobre datos reales (control negativo y positivo con `node -e`, mismo
  procedimiento que sustentó F1) y con la invariante 2, que impide que la fusión se extienda
  por heurística. Sobre las 44 entradas del usuario, ningún programa distinto se fusiona.
- **`Chrome` y `Google Chrome` siguen en dos barras.** Son dos nombres visibles distintos en
  los datos y el pedido original del usuario sugiere que espera verlos juntos. Queda fuera de
  alcance por decisión explícita: unirlos exige backfill de `appId` contra el catálogo de
  instaladas (IPC nuevo desde el historial y acoplamiento de un módulo puro a un catálogo de
  runtime) o una migración destructiva. Es un cambio aparte con su propio ADR si se pide.
- **`appId` queda como campo informativo en un shape público.** Un lector futuro puede
  confundirlo con un identificador y reintroducir F1 por esa vía. Se contiene con la
  invariante 3, escrita también en el comentario de cabecera del módulo.
- La entrada con nombre basura de la migración (el **string** `"null"`, 1 entrada, 16 s) sigue
  visible como una barra rotulada `null`. El agregador no filtra datos: un módulo puro que
  descarta entradas oculta el problema y borra tiempo registrado. Es basura de la migración
  (ADR-0007), no un defecto de agregación.

## Alternatives Considered

- **Conservar `appId` como clave y hacer backfill de las entradas migradas** contra el catálogo
  de aplicaciones instaladas: es la única alternativa basada en datos y la única que además
  uniría `Chrome` con `Google Chrome`. Se descarta para este cambio porque exige un canal IPC
  nuevo desde la ventana de historial y acopla `session-aggregate.js` —puro, sin dependencias,
  verificable con `node -e`— a un catálogo de runtime; o bien una migración destructiva sobre el
  único archivo de datos del usuario. Sigue siendo la vía correcta si el requerimiento aparece.
- **Clave híbrida**: agrupar por `appId` y, además, fusionar los `appId` distintos que compartan
  nombre normalizado. Se descarta porque produce exactamente el mismo resultado que la clave por
  nombre en todos los casos posibles (si comparten nombre normalizado, terminan en la misma
  fila), con una regla más y dos caminos en vez de uno. Complejidad sin efecto observable.
- **Tabla de alias** (`Chrome` → `Google Chrome`): lista arbitraria que no sale de los datos,
  a mantener para siempre, con una fuente de verdad nueva. Viola SSOT y YAGNI.
- **Heurística de sufijo por palabra** ("Google Chrome" termina en "Chrome"): funciona para el
  caso que motiva el pedido, pero su modo de falla es precisamente el que F1 existe para evitar
  (cualquier "X Client" contra un "Client" suelto). Se descarta por el modo de falla, no por el
  costo.
- **Eliminar `appId` del shape agregado** en vez de redefinirlo: es más limpio y ningún
  consumidor lo lee hoy (verificado: `ByAppView.vue:10` usa `row.key`, `UsageChart.vue:51,55`
  usan `app`/`durationMs`). Se descarta por respetar la decisión ya aprobada en la propuesta,
  pero conviene registrar el contra-argumento: un campo informativo con nombre de identificador
  es una invitación a usarlo como identificador. Si en algún momento se toca este shape por
  otra razón, quitarlo es la simplificación correcta.

## Relación con otros ADR

**No supersede a ninguno.** ADR-0007 decide el formato del historial y su migración, no el
criterio de agregación; su consecuencia (entradas migradas sin `appId`) es justamente el
contexto de esta decisión. ADR-0010 confina la librería de gráficos y no toca la agregación.

La supersesión que sí corresponde ocurre en la capa de specs y ya está aplicada:
[[usage-aggregation-by-visible-app-name]] supersede a [[usage-chart-by-interval]], y
[[judgment-fixes-sessions-groups-history-revised]] supersede a
[[judgment-fixes-sessions-groups-history]] retirando de ahí el requerimiento F1.
