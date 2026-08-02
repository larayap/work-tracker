---
type: adr
title: "El historial vive en sessions.json estructurado, migrado una sola vez desde usage-log.txt"
status: accepted
supersedes: null
superseded_by: null
amends: "[[0006-userdata-json-persistence]]"
created: "2026-08-02"
change_ref: "[[sessions-groups-history]]"
capability: "app-monitoring"
tags: [adr]
---

# El historial vive en sessions.json estructurado, migrado una sola vez desde usage-log.txt

## Context

`usage-log.txt` es texto plano con una línea por sesión, escrita por
`session-log.js::buildSessionLine` y leída con una expresión regular en
`background.js:215`. Escritura y lectura viven en módulos distintos y están acopladas por un
formato que ninguno de los dos declara: agregar un campo obliga a tocar los dos lados y a
mantenerlos sincronizados a mano.

ADR-0006 ya declaró esa fragilidad y la aceptó explícitamente: *"`usage-log.txt` sigue
siendo texto plano parseado con expresión regular… Se conserva por decisión explícita de
alcance: cambiar el formato obligaría a migrar el historial"*. La condición que sostenía esa
decisión era que ningún campo nuevo lo necesitara.

Este cambio la rompe por tres frentes a la vez:

- `inline-session-naming` agrega un nombre **escrito por el usuario**, que puede contener el
  separador `|` y romper el parseo. El riesgo que ADR-0006 aceptaba para nombres de programa
  —que el desarrollador no controla pero tampoco elige— pasa a ser texto arbitrario.
- `group-composition-and-drag` agrega `groupId` y `groupName` por entrada.
- `usage-chart-by-interval` exige consultar el historial por un rango de fechas arbitrario
  "sin que el tiempo de respuesta se degrade a medida que el historial crece", sobre un
  formato que hoy obliga a parsear el archivo entero con una regex por línea.

El historial real de producción tiene datos desde 2025-04 (verificado en el `userData` de
este entorno vía interop: 32 líneas, 9 días distintos, 10 programas). Es poco volumen pero es
irreemplazable: no hay forma de reconstruirlo si se pierde.

Tres hechos más, verificados sobre ese archivo real, que condicionan cualquier migración:

1. **La duración no se deduce de inicio y fin.** Existe la línea
   `Duración: 00:00:05 | Inicio: 11:41:06 | Fin: 11:42:24`: el reloj no cuenta mientras la
   fila está pausada, así que `fin - inicio` sobrestima. El campo `Duración` es el único dato
   autoritativo.
2. **Hay líneas con datos degradados**: `Aplicación: null | … | Inicio: 00:00:00`.
3. **Hay líneas duplicadas exactas** (tres entradas de Chrome idénticas): ninguna estrategia
   de idempotencia puede basarse en deduplicar por contenido.

## Decision

El historial pasa a un **único archivo `sessions.json` bajo `userData`**, un array de objetos
con esta forma:

```json
{
  "id": "1785685048769-0",
  "date": "2026-08-02",
  "appId": "c:\\program files\\…\\brave.exe",
  "app": "Brave",
  "startedAt": 1785685036000,
  "endedAt": 1785685048769,
  "durationMs": 12000,
  "sessionName": null,
  "groupId": null,
  "groupName": null
}
```

- `date` es **`YYYY-MM-DD` en hora local**, la misma que el usuario ve en el calendario. Ese
  formato hace que filtrar por cualquier intervalo sea una comparación de strings ordenada
  (`from <= date && date <= to`), sin librería de fechas y sin recorrer objetos `Date`.
- `startedAt`/`endedAt` son epoch en milisegundos: un solo número sin ambigüedad de zona
  horaria, que el renderer formatea a `HH:MM:SS` local al mostrarlo.
- `durationMs` es el tiempo acumulado que la fila estuvo en estado corriendo. **No es
  `endedAt - startedAt`** y nunca se deriva de esa resta.

**Lectura y escritura vuelven a vivir en el mismo módulo.** El parser regex de
`background.js` se elimina; `session-log.js` pasa a ser dueño del archivo completo y expone
las consultas por IPC. La asimetría escritura-en-un-módulo / lectura-en-otro desaparece.

La **migración es one-shot, idempotente y no destructiva**, con este orden invariante al
arrancar, antes de que el motor pueda cerrar ninguna sesión:

1. Si `sessions.json` ya existe → no se migra nada.
2. Si no existe: se parsea `usage-log.txt` completo (si falta, el resultado es `[]`), se
   escribe en `sessions.json.tmp` y recién entonces se renombra a `sessions.json`.
3. Si `usage-log.txt` existe y `usage-log.txt.bak` no, se renombra el original a `.bak`.

Los pasos 2 y 3 son independientes e idempotentes, y **el archivo original nunca se borra**.
Una interrupción antes del renombre del paso 2 deja el `.txt` intacto y sin migrar; una
interrupción entre el 2 y el 3 deja el JSON completo y el `.txt` todavía presente, que el
siguiente arranque resuelve. No existe un estado intermedio con un `sessions.json` a medio
escribir, porque el archivo solo aparece por un renombre de un archivo ya completo.

La reconstrucción de campos en la migración fija reglas explícitas: `durationMs` sale del
campo `Duración`; `startedAt` se reconstruye desde `date` + `Inicio` en hora local, restando
un día si `Inicio > Fin` (sesión que cruzó medianoche); `sessionName`, `groupId` y `groupName`
quedan en `null`; las líneas que no parsean se descartan contando cuántas fueron. Las líneas
duplicadas se migran tal cual: son datos del usuario, no ruido a corregir.

`usage-log.txt` **deja de leerse por completo** una vez migrado. No hay fusión de dos fuentes.

## Consequences

**Positivas:**

- Agregar un campo al historial deja de ser un ejercicio de regex coordinado entre dos
  módulos: es una clave más en un objeto.
- Un nombre de sesión con `|`, comillas o saltos de línea deja de poder romper el historial;
  `JSON.stringify` lo resuelve por construcción.
- Filtrar por un intervalo arbitrario es una comparación de strings sobre `date`, así que el
  gráfico por día, por mes y por rango salen del mismo mecanismo sin código específico por
  alcance.
- El archivo sigue siendo inspeccionable y editable a mano, que es la forma de verificación
  disponible mientras el proyecto no tenga tests.
- El historial se puede mantener parseado en memoria en el main y escribir de una sola vez,
  lo que habilita el cierre sincrónico de sesiones en `before-quit` (ADR-0009 depende de esto).

**Trade-offs:**

- Cada cierre de sesión reescribe el archivo entero en vez de appendear una línea. Con el
  volumen real —unas pocas sesiones por hora sobre decenas de kilobytes— es intrascendente,
  pero es un costo que crece linealmente con el historial y que el append no tenía.
- El formato deja de ser legible de un vistazo desde cualquier editor de texto: pasa de una
  línea autoexplicativa por sesión a JSON indentado.
- La migración toca datos reales una sola vez y no tiene segunda oportunidad. El protocolo la
  hace reintentable mientras falle, pero si produce entradas mal reconstruidas y el `.txt` ya
  fue renombrado, corregirlas exige rehacer la migración a mano desde el `.bak`.
- La reconstrucción de `startedAt` en las entradas migradas es aproximada: el formato viejo
  solo guardaba `HH:MM:SS`, así que el instante exacto de inicio de una sesión histórica que
  cruzó medianoche se infiere, no se lee.
- Queda un archivo más en `userData` (el `.bak`), que nadie limpia.

## Relación con ADR-0006

Esta decisión **no supersede** a [[0006-userdata-json-persistence]]: lo enmienda en una sola
cláusula. Todo lo que ADR-0006 decidió sigue vigente y este cambio lo obedece —un archivo
JSON por concepto bajo `userData`, escrito exclusivamente por el main process, con el helper
único de lectura tolerante, y sin persistir estado en vivo del monitoreo. `sessions.json` es
un archivo más que sigue exactamente ese patrón.

Lo único que queda revocado es la cláusula *"`usage-log.txt` conserva su formato actual,
línea a línea, sin migración de datos históricos"* y el trade-off asociado. Marcar ADR-0006
entero como superseded dejaría sin ADR vigente a `monitored-selection.json`, `settings.json`,
las dos cachés y la regla de no persistir estado en vivo, que es una pérdida de información
mayor que la que se corrige. ADR-0006 queda con `status: accepted` y un puntero `amended_by`
hacia este ADR en la cláusula afectada.

## Alternatives Considered

- **Extender la línea de texto con dos campos más** (`| Sesión: … | Grupo: …`): es el cambio
  de menor tamaño y no exige migrar nada. Se descarta porque el nombre de sesión lo escribe
  el usuario: un `|` en el nombre corrompe el parseo de esa línea y, dependiendo de dónde
  caiga, de todas las siguientes. ADR-0006 aceptó ese riesgo para nombres de programa; acá el
  texto es arbitrario, y el modo de falla es pérdida silenciosa de historial.
- **JSON solo para lo nuevo, `usage-log.txt` legado leído en paralelo**: evita migrar. Se
  descarta porque deja dos fuentes que toda vista del historial debe fusionar para siempre, y
  la fusión tiene que resolver el mismo problema de reconstrucción de campos que la migración
  —pero en cada lectura y no una sola vez—. Además duplica el lugar donde se decide qué es
  una entrada válida.
- **Escritura atómica en cada append** (tmp + rename por cada sesión cerrada) en vez de solo
  en la migración: haría cada cierre a prueba de corte de energía. Se descarta por YAGNI
  frente al patrón que ADR-0006 ya declaró aceptable para el resto de los archivos: la
  ventana de exposición es de milisegundos y el dato en riesgo es una sesión, no el historial.
  La atomicidad se reserva para la migración, que es la operación que sí puede destruir
  datos irrecuperables.

  > **Corrección parcial ([[judgment-fixes-sessions-groups-history]]#F3, 2026-08-02)**: la
  > premisa de este párrafo era incorrecta. El dato en riesgo ante una interrupción **no** es
  > una sesión: `appendSessions` reescribe el archivo `sessions.json` **completo** en cada
  > cierre (según la Decision de este mismo ADR, arriba), así que una interrupción a mitad de
  > esa escritura corrompe todo el historial acumulado, no solo la entrada que se estaba
  > cerrando — agravado porque uno de los llamadores es el cierre síncrono de `before-quit`,
  > el instante de mayor probabilidad de interrupción del ciclo de vida completo. Se aplica
  > tmp+rename a `session-log.js::appendSessions` (vía `jsonStore.writeJsonAtomic`), sin
  > extenderlo al resto de los consumidores de `jsonStore.writeJson` (selección monitoreada,
  > settings, cachés): ahí el trade-off original sigue siendo válido, porque cada uno de esos
  > archivos sí reescribe una entidad chica, no un historial que crece sin límite.
- **SQLite u otra base embebida**: resuelve consultas por rango sin leer todo el archivo. Se
  descarta por desproporción —el historial real son decenas de kilobytes— y porque
  introduciría una dependencia nativa con compilación por plataforma en un proyecto que hoy
  no tiene ninguna, contra el criterio de ADR-0006 de no sumar un segundo patrón de
  persistencia.
- **Deduplicar las líneas repetidas durante la migración**: el archivo real tiene tres
  entradas idénticas de Chrome. Se descarta porque no hay forma de distinguir un duplicado
  espurio de dos sesiones reales con los mismos valores, y descartar datos del usuario por
  una heurística es peor que conservar un duplicado.
