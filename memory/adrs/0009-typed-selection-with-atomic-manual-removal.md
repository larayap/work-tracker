---
type: adr
title: "Selección tipada manual/auto, con la baja de la entrada manual resuelta dentro del mismo reductor"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-02"
change_ref: "[[sessions-groups-history]]"
capability: "app-monitoring"
tags: [adr]
---

# Selección tipada manual/auto, con la baja de la entrada manual resuelta dentro del mismo reductor

## Context

Hasta ahora la selección guardada era homogénea: todo programa agregado permanecía en ella
para siempre y volvía a generar fila cada vez que su proceso se abría. `row-lifecycle`
declaraba esa permanencia como incondicional.

`selection-type-manual-vs-auto` introduce una segunda modalidad, transitoria, y
`row-lifecycle-persistence-by-type` redefine la regla en consecuencia: una entrada de
modalidad manual **se da de baja de la selección guardada en el mismo instante en que su fila
sale del listado visible**, por cualquiera de los dos eventos de salida (el control de
detener o el cierre del proceso).

El problema no es representar la modalidad —un campo alcanza—, sino **dónde y cuándo se
aplica la baja**. El motor (ADR-0001) tiene un orden invariante dentro de cada tick:

```
1. reduceLifecycle(S_live, selección, filas) → inserciones y bajas de fila
2. reduceFocus(S_focus, filas)               → estado de las filas que sobrevivieron
```

y `reduceLifecycle`, tal como está escrito hoy (`monitor-engine.js:54-108`), hace tres cosas
en secuencia sobre el **mismo** arreglo `selection` que recibe: da de baja las filas cuyo PID
murió, vincula PIDs a filas que no lo tenían, y **evalúa altas recorriendo `selection`**.

Ahí está la carrera que `proposal.md` clasificó como riesgo de probabilidad **Alta**: si la
baja de la entrada manual de `selection` se hace fuera del reductor —después del tick, en el
listener del cierre, o en una pasada posterior— el propio tick que cerró la fila todavía ve
esa entrada en `selection` cuando llega al paso de altas, encuentra evidencia de vida en
`discovered` (la muestra de foco del mismo tick la puso ahí) y **vuelve a crear la fila que
se acaba de cerrar**. El resultado observable es una fila que renace en el mismo segundo y
una sesión fantasma de 0 a 1 segundos en el historial. Sin tests en el proyecto, ese defecto
solo aparece en uso real y es difícil de atribuir.

Existe además un segundo momento en que la modalidad importa y no hay tick de por medio: el
arranque. La misma spec exige que una entrada manual cuyo proceso ya no está en ejecución se
descarte de la selección **sin generar fila**, mientras que las automáticas permanecen sin
importar el estado de su proceso.

## Decision

La entrada de la selección guardada lleva un campo **`type: 'manual' | 'auto'`**, persistido
en `monitored-selection.json`. **La ausencia del campo se interpreta como `'auto'`**, y la
normalización ocurre una sola vez al cargar el archivo, de modo que ningún otro punto del
motor tiene que ramificar sobre un valor indefinido. Es un solo archivo y un solo camino de
escritura: ambas modalidades se persisten igual.

**La baja de la entrada manual se resuelve dentro de `reduceLifecycle`, en el mismo paso que
la baja de la fila y antes de evaluar altas.** El reductor cambia de contrato:

```
reduceLifecycle(sLive, selection, rows) → { rows, selection, closed }
```

y su orden interno queda fijado como invariante:

1. Se calculan las filas que salen por PID muerto (`closed`).
2. **En el mismo paso**, se produce `nextSelection` quitando las entradas de tipo `manual`
   correspondientes a esas filas.
3. Se vinculan PIDs a filas que no lo tenían.
4. Las altas se evalúan **sobre `nextSelection`**, nunca sobre la `selection` de entrada.

El reductor sigue siendo **puro**: no escribe a disco, no emite IPC y no muta sus argumentos.
Devuelve la selección nueva y es el orquestador del tick quien la asigna y la persiste, y solo
si cambió.

El mismo criterio se aplica al camino que no pasa por el tick: `closeRow(appId, motivo)` —el
control de detener— da de baja la entrada manual de la selección **dentro de la misma función
sincrónica** que quita la fila y registra la sesión, antes de devolver el control. No hay
ningún instante observable en que la fila ya no exista y la entrada manual todavía figure en
la selección.

Al arrancar, antes de encender el timer, se hace una **reconciliación única**: se enumeran los
procesos vivos una sola vez y se descartan las entradas `manual` que no tienen proceso
correspondiente. Las entradas `auto` no se tocan. La reconciliación corre antes de
`startEngine()`, de modo que el primer tick ya opera sobre una selección consistente.

La prohibición que este ADR agrega, en la misma línea que la de ADR-0001: **ningún camino
puede quitar una fila del listado visible sin resolver, en la misma operación, qué pasa con
su entrada en la selección guardada**. Las dos bajas son un solo hecho, no dos efectos
coordinados.

## Consequences

**Positivas:**

- La carrera desaparece por construcción, no por orden de invocación: cuando el paso de altas
  recorre la selección, la entrada manual ya no está ahí. No hay ventana temporal que cerrar
  ni guarda defensiva que recordar mantener.
- El reductor sigue siendo puro y determinista, así que la regla completa se ejercita con
  entradas fabricadas sin Windows y sin timers — que es la única red de verificación
  disponible mientras el proyecto no tenga runner de tests.
- La retrocompatibilidad es gratis y verificable: el `monitored-selection.json` real de este
  entorno tiene tres entradas sin campo `type`, y todas se leen como `auto`, que es
  exactamente el comportamiento que tenían.
- Un solo archivo y un solo camino de escritura para las dos modalidades: no aparece una
  segunda ruta de persistencia que mantener sincronizada.
- La modalidad viaja en el snapshot, así que el marcador visual de la fila manual es una
  proyección más y no obliga al renderer a recordar cómo se agregó cada programa.

**Trade-offs:**

- `reduceLifecycle` devuelve ahora tres cosas en vez de dos y su contrato es más ancho: pasa
  de gobernar solo la existencia de filas a gobernar también la vigencia de entradas de la
  selección. Es más superficie en la pieza más delicada del motor, y el argumento de por qué
  esa responsabilidad vive ahí y no afuera es este ADR, no el código.
- La transitoriedad queda sostenida por la lógica del reductor y no por el almacenamiento: si
  el reductor falla, la entrada manual queda pegada en disco y reaparece como si fuera
  automática. La alternativa —no persistirla nunca— hacía imposible ese modo de falla, a costa
  de matar una sesión transitoria en curso por un reinicio del cronómetro que no tiene nada
  que ver con el programa monitoreado.
- La reconciliación de arranque agrega una enumeración de procesos antes de encender el
  motor, es decir latencia en el camino de inicio. Solo se paga si hay al menos una entrada
  manual guardada.
- Entre que la ventana carga y la reconciliación termina, el primer snapshot puede mostrar
  brevemente una entrada manual que está por descartarse. Se corrige sola en el push
  siguiente.

## Alternatives Considered

- **Baja de la entrada manual fuera del reductor**, en el listener de cierre de fila o en una
  pasada posterior del tick: es la forma que primero sugiere el código actual, porque
  `closeRow` ya existe y ya registra la sesión. Se descarta porque es exactamente la carrera
  que la propuesta clasificó como riesgo Alta: el paso de altas del mismo tick vuelve a ver la
  entrada y recrea la fila.
- **Filtrar en el paso de altas** los `appId` que acaban de cerrarse, dejando la baja de
  `selection` para después: cierra la ventana dentro del tick sin cambiar el contrato del
  reductor. Se descarta porque la corrección pasa a depender de una lista de exclusión que
  hay que recordar propagar en cada camino nuevo de cierre; la baja en el mismo paso no
  necesita que nadie recuerde nada.
- **Entradas manuales que nunca tocan disco**, viviendo solo en el arreglo en memoria: hace
  imposible que una entrada manual quede pegada, y resuelve "no reaparece" de forma más
  fuerte. Se descarta —decisión del usuario en la iteración 1 de la propuesta— porque mata una
  sesión transitoria en curso ante un reinicio del cronómetro, y porque introduce una
  asimetría de persistencia (dos rutas de escritura sobre el mismo concepto) sin que el
  requisito la pida.
- **Dos arreglos de selección separados** (`autoSelection` y `manualSelection`) en vez de un
  campo: hace la modalidad estructural e imposible de confundir. Se descarta porque duplica
  cada recorrido de la selección en el motor y en el snapshot, y porque el cambio anterior ya
  fijó "una sola lista" como forma: una lista con un campo más sigue siendo una sola lista.
- **Reconciliación de arranque por tick en vez de una vez**, dejando que el motor descarte las
  manuales muertas cuando le toque descubrir: no agrega latencia al arranque. Se descarta
  porque el descubrimiento está condicionado y corre cada 5 ticks, así que una entrada manual
  muerta puede sobrevivir varios segundos en la selección y llegar al renderer, contradiciendo
  el escenario "reiniciar el cronómetro con el programa manual ya cerrado no deja rastro".
