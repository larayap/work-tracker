---
type: adr
title: "Nombre de sesión y grupo son metadata sobre entradas del historial, no entidades propias"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-02"
change_ref: "[[sessions-groups-history]]"
capability: "session-groups"
tags: [adr]
---

# Nombre de sesión y grupo son metadata sobre entradas del historial, no entidades propias

## Context

El cambio introduce dos conceptos nuevos que el usuario percibe como "cosas": una sesión con
nombre y un grupo que junta varias aplicaciones bajo una misma actividad. La forma obvia de
modelarlos es como entidades: una colección de grupos con su identidad, su nombre y sus
miembros, persistida en su propio archivo, y una colección de sesiones que los referencia.

Las specs empujan en la dirección contraria y lo dicen de forma explícita:

- `group-composition-and-drag` — *"un grupo es una sesión con nombre que contiene varias
  filas, viva mientras existan sus filas, no una carpeta reutilizable entre días"*, con dos
  prohibiciones adicionales: no anidar grupos y no reutilizar la identidad de un grupo entre
  días ni después de vaciarse.
- La misma spec fija que **cada fila conserva su propio reloj y su propia entrada de
  historial**, y que el total del grupo se calcula *"como la suma de las duraciones de sus
  entradas para el período consultado, sin persistir ese total en ningún lado"*.
- `inline-session-naming` — el nombre es editable mientras la sesión está abierta y queda
  **congelado** en la entrada del historial cuando la sesión se cierra.

Hay además una restricción arquitectónica dura ya vigente: ADR-0002 fija que el main process
es la única fuente de verdad del monitoreo y que el renderer es una proyección de un snapshot
completo que se reemplaza entero en cada tick. Cualquier estado de grupo que el renderer
sostenga por su cuenta reintroduce exactamente la clase de divergencia que ese ADR eliminó. Y
ADR-0006 fija que ningún estado en vivo del monitoreo se persiste: las filas, el PID y el
acumulado de la sesión existen solo en memoria.

Al mismo tiempo, el gesto que crea un grupo es un arrastre, y `vuedraggable` exige mutar un
array local para funcionar (verificado en `tech-context.md`: `onDragAdd`/`onDragRemove`
splicean la lista vinculada y manipulan el DOM directamente). Hay una tensión real entre lo
que la librería necesita y quién es dueño del estado.

## Decision

**El grupo y el nombre de sesión no son entidades: son campos.**

En vivo, `groupId`, `groupName` y `sessionName` son **propiedades de la fila** en el estado en
memoria del main process, exactamente al mismo nivel que `elapsedMs` o `pid`. No existe una
colección de grupos, ni un archivo de grupos, ni una tabla de sesiones abiertas. Un grupo
existe si y solo si hay al menos una fila con ese `groupId`; su nombre es el `groupName` que
comparten esas filas. Vaciarlo lo extingue sin ninguna acción de limpieza, porque no había
nada que limpiar.

Al cerrarse una sesión, esos tres campos **se copian a la entrada del historial** y quedan
congelados ahí. Esa copia es la única forma persistente que tiene un grupo. No se persiste
ningún total, ningún índice de grupos ni ninguna referencia cruzada.

**Todo total de grupo es derivado.** En cualquier vista, el total de un grupo se calcula
sumando `durationMs` de las entradas con ese `groupId` dentro del período consultado. La
regla es la suma de duraciones, no el tiempo de reloj de pared cubierto: dos filas del mismo
grupo corriendo en tramos solapados suman sus duraciones.

**La pertenencia a un grupo es una intención, no una mutación del renderer.** El arrastre no
cambia el estado: emite `set-row-group(appId, groupId)` hacia el main, que aplica el cambio y
emite el snapshot siguiente. El renderer sostiene arrays locales derivados del snapshot
únicamente porque `vuedraggable` los necesita para operar, y esos arrays se reconstruyen
desde cada snapshot recibido: el resultado optimista del arrastre se descarta y se reemplaza
por el autoritativo. Si el main no acepta el cambio, la interfaz se corrige sola en el
siguiente tick sin ningún camino de rollback escrito a mano.

## Consequences

**Positivas:**

- El desglose por aplicación que el intent pide guardar queda disponible sin trabajo extra:
  cada fila ya escribía su propia entrada, y el grupo solo le agrega una etiqueta.
- `sessions-json-persistence` no necesita ninguna forma especial para las entradas agrupadas:
  son entradas normales con dos campos más.
- No hay ciclo de vida de grupo que gestionar —ni creación explícita, ni borrado, ni
  huérfanos, ni referencias colgadas cuando una fila se cierra—. La extinción de un grupo
  vacío es una consecuencia de la definición, no una rutina.
- Un total derivado no puede quedar desincronizado de sus partes, que es el modo de falla
  clásico de persistir agregados (SSOT).
- El modelo soporta más de un grupo simultáneo sin cambios: `groupId` por fila ya lo permite.
  Que la interfaz de este cambio muestre un solo contenedor es una decisión de alcance de la
  UI, no un límite del modelo.
- El estado de grupo sigue viviendo donde ADR-0002 puso todo el estado de monitoreo, así que
  no aparece una segunda fuente de verdad en el renderer.

**Trade-offs:**

- Un grupo no sobrevive al cierre de sus filas ni al reinicio de la aplicación. El usuario que
  arma la misma agrupación todos los días la arma de nuevo cada vez. Es la consecuencia
  buscada de "no es una carpeta reutilizable", pero es fricción real y repetida.
- El total del grupo puede superar el tiempo de reloj de pared cuando dos filas del grupo
  corrieron en paralelo. La regla está declarada, pero es una lectura que la interfaz tiene
  que explicar; un usuario que sume mentalmente lo que vio en pantalla puede no reconocer el
  número.
- Renombrar un grupo obliga a escribir `groupName` en todas sus filas miembro en vez de en un
  solo lugar. Con un máximo de cuatro filas es intrascendente, pero es duplicación de un dato
  en memoria, sostenida por la invariante de que solo el main lo modifica.
- El arrastre tiene una ventana en la que el DOM optimista y el estado autoritativo pueden
  discrepar, y el snapshot que se emite cada segundo puede reemplazar el array vinculado en
  medio de un gesto. Exige una guarda explícita que suspenda la reconstrucción mientras hay
  un arrastre en curso: es complejidad que un modelo con estado propio en el renderer no
  tendría.

## Alternatives Considered

- **Grupo como entidad persistida** en su propio archivo, con identidad estable y miembros
  reutilizables entre días: es lo que un usuario podría esperar de la palabra "grupo". Se
  descarta porque las specs lo prohíben explícitamente ("no es una carpeta reutilizable") y
  porque introduce todo un ciclo de vida —crear, editar, borrar, resolver miembros que ya no
  existen— para una capacidad que nadie pidió. YAGNI.
- **El grupo tiene su propio reloj y registra una entrada agregada**: es la lectura más
  natural de "sesión de grupo" y produce un total exacto de reloj de pared. Se descarta
  porque pierde el desglose por aplicación, que es justamente lo que el punto 4 del intent
  pide guardar, y porque obligaría a `sessions-json-persistence` a manejar dos tipos de
  entrada.
- **Persistir el total del grupo** junto con las entradas para no recalcularlo: se descarta
  por SSOT. Un total persistido y sus partes pueden divergir; el cálculo sobre cuatro filas
  como máximo no tiene ningún costo que lo justifique.
- **Total del grupo como tiempo de reloj de pared cubierto** (unión de intervalos en vez de
  suma): es más honesto sobre "cuánto rato estuve en esto". Se descarta porque exige resolver
  solapamientos sobre entradas que solo guardan inicio, fin y duración —y la duración ya
  excluye las pausas, así que la unión de los intervalos `[inicio, fin]` no es el tiempo
  realmente contado—. El resultado sería un número que no se deriva de ningún dato guardado.
- **Estado de grupo en el store del renderer, sincronizado hacia el main**: es lo que la
  ergonomía de `vuedraggable` sugiere (vincular `v-model` y listo). Se descarta porque
  contradice ADR-0002 de forma directa: el snapshot de 1000ms reemplaza el estado del store
  entero, así que un `groupId` que viva solo en el renderer se pierde en el siguiente tick, y
  hacerlo sobrevivir exigiría exceptuar `rows` de la mutación de reemplazo —que es la
  propiedad que hace que el store no pueda divergir del motor—.
