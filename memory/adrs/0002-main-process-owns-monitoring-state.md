---
type: adr
title: "El main process es la fuente de verdad del monitoreo; el renderer proyecta un snapshot completo"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-01"
change_ref: "[[app-detection-logos-audio]]"
capability: "app-monitoring"
tags: [adr]
---

# El main process es la fuente de verdad del monitoreo; el renderer proyecta un snapshot completo

## Context

El estado del cronómetro vive hoy repartido entre los dos procesos. El main sostiene
`cronometroInterval` y `currentAppName`; el renderer sostiene `time`, `running`,
`intervalId`, `startTime` y `selectedApp` como datos de instancia del componente, y los
actualiza por dos caminos distintos —el botón manual y el evento `app-active`— que escriben
sobre las mismas variables sin coordinarse. `sdd-explore` documentó la consecuencia: el
`running` del renderer y el `cronometroInterval` del main pueden quedar en estados
incompatibles, y la escritura de la sesión al log la produce el renderer en `reset()`, con
los datos que él tiene.

Ese reparto ya falla con una app. Con hasta cuatro filas y con sesiones que se cierran por
eventos que solo el main observa —el proceso se cerró— deja de ser viable: si el renderer
sostiene el tiempo acumulado, el cierre de un proceso obliga a una ida y vuelta IPC para
pedirle al renderer el valor a registrar, y el registro queda condicionado a que el renderer
esté vivo y responda.

`session-log-persistence` exige que cada sesión se registre en el instante del cierre de
proceso o del gesto de detener. `two-state-row-machine` exige que como máximo una fila esté
en `corriendo` en todo momento. Ambas son invariantes globales sobre el conjunto de filas,
no propiedades de una fila aislada.

Un dato relevante para dimensionar: el reloj de la fila muestra `HH:MM:SS`, resolución de
segundos. El `setInterval` de 10ms que hoy actualiza `time` en el renderer produce cien
actualizaciones por segundo para un dígito que cambia una vez por segundo.

## Decision

El **main process es la única fuente de verdad** del monitoreo. Sostiene la selección
guardada, el listado visible de filas, el estado de cada fila, el tiempo acumulado de cada
sesión y la escritura de la línea al log.

El tiempo se acumula por reloj de pared, no por conteo de ticks: mientras una fila está en
`corriendo`, cada tick suma `now - lastTickAt` a su acumulado. Un tick que llega tarde suma
lo que corresponde y un tick perdido no pierde tiempo.

El **renderer es una proyección**. En cada tick y en cada transición, el main empuja por un
único canal un **snapshot completo** del estado observable: las filas con su estado y su
acumulado, la selección guardada y el indicador de límite alcanzado. El store del renderer
aplica el snapshot con una única mutación de reemplazo y no deriva ni conserva estado propio
sobre el monitoreo.

El renderer no sostiene reloj: formatea `elapsedMs` del snapshot a `HH:MM:SS`. La cadencia
de 1 segundo del snapshot coincide con la resolución de lo que se muestra.

Las acciones del usuario viajan como intenciones al main —agregar a la selección, quitar de
la selección, detener una fila— y su efecto vuelve reflejado en el snapshot siguiente, que
el main emite de inmediato tras aplicar la intención en vez de esperar al próximo tick.

Los íconos quedan fuera del snapshot: viajan por un canal propio de petición y respuesta,
cacheados en el renderer por ruta de ejecutable.

## Consequences

**Positivas:**

- Desaparece la clase de bug que motiva el cambio: no hay dos copias del estado que puedan
  divergir, porque el renderer no tiene copia sino proyección.
- Las invariantes globales —como máximo una fila corriendo, como máximo cuatro filas— se
  imponen en un solo lugar y son verificables leyendo un solo módulo.
- El cierre de sesión y la escritura al log ocurren en el proceso que observa el evento, sin
  ida y vuelta ni dependencia de que el renderer responda. Una sesión se registra aunque la
  ventana esté oculta en la bandeja.
- El snapshot completo hace innecesaria toda reconciliación incremental en el renderer: no
  hay eventos que puedan llegar fuera de orden, perderse o duplicarse, porque cada mensaje
  describe el estado entero. Con cuatro filas el payload es despreciable.
- El `setInterval` de 10ms del renderer desaparece, junto con las cien actualizaciones por
  segundo que producía para un dígito que cambia una vez por segundo.
- La lógica de acumulación y de formateo queda en funciones puras del main, testeables en
  cuanto el proyecto incorpore un runner.

**Trade-offs:**

- El reloj de la fila avanza con la cadencia del snapshot, así que la latencia del IPC se
  suma al instante en que el dígito cambia en pantalla. Sobre una resolución de segundos, un
  jitter de decenas de milisegundos es imperceptible.
- Todo cambio en la forma del snapshot es un cambio de contrato entre los dos procesos y
  obliga a tocar ambos lados. Es el costo de tener un solo contrato en vez de varios.
- El main crece: absorbe responsabilidad que hoy está en el componente. `background.js` deja
  de ser el archivo único del main y pasa a ser el arranque de un conjunto de módulos.

## Alternatives Considered

- **Eventos incrementales por app** (`app-active` extendido con `appName`, `pid` e
  `isActive`, tal como lo esbozó `proposal.md` en su sección de alcance): mantiene el canal
  actual y le agrega identidad. Se descarta porque deja al renderer la reconstrucción del
  estado a partir de una secuencia de eventos, que es precisamente el mecanismo que hoy
  produce divergencia. La necesidad que el esbozo declara —que cada evento sea atribuible a
  un programa concreto— queda cubierta: el snapshot lleva `appId` y `pid` por fila. El cambio
  es de mecanismo, no de comportamiento observable.
- **Reloj en el renderer con resincronización periódica**: el renderer interpola localmente
  y el main corrige cada segundo. Se descarta porque agrega interpolación, corrección de
  deriva y una segunda acumulación que puede discrepar de la que se escribe al log, todo
  para ganar suavidad en un dígito de segundos que no la necesita.
- **Estado en el renderer y main como sensor mudo**: el main solo reporta señales y el
  renderer decide todo. Se descarta porque el cierre de proceso y la escritura de la sesión
  quedarían condicionados a que el renderer esté vivo y responda, y porque las invariantes
  globales volverían a vivir en un componente de UI.
