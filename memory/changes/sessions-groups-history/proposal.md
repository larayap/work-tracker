---
type: proposal
change_name: "sessions-groups-history"
domain: "feature"
status: approved
iteration: 2
created: "2026-08-02"
updated: "2026-08-02"
tags: [proposal]
effort: "XL"
risks:
  - riesgo: "Ventana de carrera entre la baja de una entrada manual de `selection` y la re-evaluación de altas en el mismo tick de `reduceLifecycle`"
    probabilidad: "Alta"
    impacto: "La fila recién cerrada renace en el mismo segundo y se registra una sesión fantasma de 0-1s; sin tests, se detecta solo a mano"
    mitigacion: "Baja de `selection` y baja de `rows` en el mismo paso del reductor, antes de evaluar altas; el reductor sigue siendo puro y se verifica con entradas fabricadas"
  - riesgo: "Migración de `usage-log.txt` a JSON sobre datos reales de producción (registros desde 2025-04)"
    probabilidad: "Media"
    impacto: "Pérdida irrecuperable del historial del usuario si la migración falla a medias"
    mitigacion: "Migración one-shot idempotente: se escribe el JSON nuevo y recién entonces se renombra el `.txt` a `.bak`; nunca se borra el original"
  - riesgo: "Ausencia total de tests y CI en el proyecto sobre un cambio que toca el motor de monitoreo, la persistencia y el historial"
    probabilidad: "Alta"
    impacto: "Regresiones en `row-lifecycle`/`session-log-persistence` (specs ya completadas) que solo aparecen en uso real"
    mitigacion: "`sdd-verify` define plan de verificación manual por escenario; los reductores puros, el filtro y el agregador por intervalo se ejercitan con entradas fabricadas sin Windows"
  - riesgo: "`vuedraggable`/SortableJS cross-list sin precedente en el repo (los dos usos actuales son de lista única)"
    probabilidad: "Media"
    impacto: "Si `group` con `pull`/`put` no cubre mover una fila sin arrastrar el grupo, la etapa 5 necesita otra técnica y su estimación se rompe"
    mitigacion: "Validar la prop `group` con un prototipo mínimo en `sdd-design`, antes de comprometer el approach"
  - riesgo: "Alcance de 9 puntos en 6 etapas encadenadas, con la etapa 6 ampliada por el alcance día/mes/rango del gráfico"
    probabilidad: "Media"
    impacto: "El cambio queda a medias en una etapa intermedia y deja el historial en un formato migrado sin las vistas que lo consumen; el peso extra cae justo en la última etapa, la más expuesta a quedarse corta"
    mitigacion: "Secuencia con cortes limpios: cada etapa deja la app funcionando; las etapas 1-3 son entregables independientes de las 4-6, y la 6 se parte en 6a (vistas + gráfico del día) y 6b (alcance mes/rango), entregables por separado"
  - riesgo: "Lectura desincronizada entre el gráfico (alcance mes/rango) y las dos vistas de lista (siempre del día del calendario)"
    probabilidad: "Media"
    impacto: "El usuario compara el total del gráfico contra la lista de abajo y no cuadran, sin entender por qué"
    mitigacion: "Cabecera del gráfico rotulada siempre con el intervalo vigente (`Agosto 2026`, `12–19 ago`); con alcance `Día` el gráfico sigue al calendario y los números coinciden exactamente"
  - riesgo: "Costo cuadrático de `icon-cache.js::persistToDisk` al disparar ~106 `getIcon()` en la primera apertura del selector"
    probabilidad: "Media"
    impacto: "Jank visible al abrir el modal la primera vez tras instalar o actualizar la app"
    mitigacion: "Corregir el patrón de escritura (un volcado por tanda en vez de lectura+escritura por ícono) antes de cablear los íconos en el selector"
---

# Propuesta: sessions-groups-history

## Intent

Extender el widget "Aplicación" con control real sobre qué se monitorea (deseleccionar, y elegir entre monitoreo permanente o de una sola vez), con sesiones nombrables y agrupables, y convertir el historial en algo que se pueda leer: dos vistas y un gráfico con alcance día, mes o rango de fechas. En el camino se corrigen tres defectos de calidad de datos en el puente con Windows que hoy ensucian el selector (nombres corruptos, entradas que no son programas, ausencia de íconos).

## Decisiones tomadas

| # | Decisión | Posición |
|---|---|---|
| D1 | Persistencia del historial | **Migrar a JSON.** `sessions.json` con una entrada por sesión (`{ id, date, appId, app, startedAt, endedAt, durationMs, sessionName, groupId, groupName }`). Migración one-shot de `usage-log.txt` al arrancar; el `.txt` se renombra a `.bak` y deja de leerse. **Una sola fuente**, no dos parsers conviviendo. El parser regex de `background.js:215` muere; lectura y escritura pasan a vivir en el mismo módulo. `date` se guarda como `YYYY-MM-DD`, lo que vuelve el filtro por intervalo una comparación de strings ordenada, sin librería de fechas. |
| D2 | Selección manual/transitoria | Campo `type: 'manual' \| 'auto'` en cada entrada de `monitored-selection.json`; sin `type` = `'auto'` (retrocompatible). **Ambos tipos se persisten** — un tipo manual sobrevive el reinicio del cronómetro, no el cierre del programa monitoreado. Regla única: *una entrada manual se da de baja de la selección en el primer instante en que su proceso deja de estar en ejecución, o cuando el usuario presiona ■*. Al reabrir el cronómetro, si el proceso sigue vivo la fila renace; si no, la entrada se descarta en el primer tick. **Esto modifica `row-lifecycle`**: su regla "el programa permanece en la selección guardada tras detener o cerrar" pasa a valer solo para `auto`. La "una sola lista" del cambio anterior sigue siendo una sola lista con un campo más, no dos listas. |
| D2b | Elección del tipo en la UI | Un **toggle único** arriba del listado del modal (`Agregar como: Permanente / Solo esta vez`), aplicado al próximo agregado; default `Permanente`. No dos botones por fila: el modal tiene 300px y 106 entradas. Las filas manuales se distinguen en el widget con un marcador discreto. |
| D2c | Cierre del cronómetro | Hoy salir de la app **pierde la sesión en curso** (no hay `before-quit`; verificado en `background.js:260`). Entra en alcance: al salir se cierran y registran todas las filas abiertas. Sin esto, D2 no tiene semántica definible. |
| D3 | Modelo de grupo | Un grupo **es una sesión con nombre que contiene N filas**, viva mientras existan sus filas — no una entidad persistente reutilizable. Se materializa como `groupId` + `groupName` en cada fila y en cada entrada del log. **Cada app conserva su propio reloj y su propia entrada**: el grupo no fusiona duraciones. El total del grupo es derivado — se calcula sobre las entradas del intervalo consultado, no se persiste (SSOT) — y se define como la **suma** de duraciones, no como tiempo de reloj de pared. El límite de 4 filas simultáneas no cambia. |
| D3b | UX del arrastre | Dos `<draggable>` con la misma prop `group`: el listado suelto y el contenedor de grupo. El contenedor aparece como franja delgada cuando hay ≥2 filas ("Arrastrá aquí para agrupar") y se convierte en cabecera con nombre editable al recibir la primera fila. Sacar una fila = arrastrarla de vuelta. Sin gestos exóticos (nada de soltar una fila sobre otra). |
| D4 | Nombrar la sesión | **Nunca se interrumpe el flujo.** Agregar una app no abre ningún prompt. El nombre se pone después, sobre una fila o grupo ya existente: click en la etiqueta → input inline, Enter confirma, Esc cancela. Editable mientras la sesión esté abierta; al cerrarse queda congelado en la entrada del log. Sin nombre = `null`, comportamiento idéntico al actual. |
| D5 | Historial | Dos vistas bajo el mismo calendario, **ancladas al día seleccionado**. **Por aplicación/día** (la actual, se conserva con su colapso por programa: responde "cuánto usé cada programa ese día"). **Por sesión**: lista cronológica del día, una entrada por sesión con nombre, rango horario y duración; las agrupadas se muestran como bloque con sus filas hijas. **El selector de alcance (D5b) gobierna solo el gráfico, no las listas.** Razón: la vista por app bajo alcance de mes sería literalmente el mismo dato que el gráfico en forma de tabla (duplicación), y la vista por sesión bajo un mes sería una lista de cientos de filas que ninguna pregunta del intent pide. El pedido del usuario habló de los gráficos; extender el alcance a las listas es construir de más (YAGNI). Si más adelante hace falta, el agregador por intervalo ya estará hecho y la extensión es barata. |
| D5b | Gráfico: forma y alcance | **Un solo gráfico con tres alcances.** Barras horizontales de tiempo por aplicación, sobre el **intervalo** seleccionado: `Día` (el día del calendario), `Mes` (el mes del día del calendario) o `Rango` (selección de rango nativa de `v-calendar`, ya en uso en la vista). El día es el caso degenerado del intervalo, así que hay **una sola forma de gráfico, un solo dataset y un solo agregador** para los tres alcances. Descartada la serie temporal por día para mes/rango: responde "cuándo gasté el tiempo", y el calendario ya responde eso; la pregunta que el usuario formuló es "en qué gasté el tiempo este mes", que es exactamente la barra por app. El alto del canvas crece con la cantidad de apps del intervalo y el contenedor scrollea — sin top-N ni categoría "Otras", que descartarían datos por una regla arbitraria. `chart.js` 4 + `vue-chartjs` 5 — el bundle `history` es independiente del principal, así que los ~200KB no tocan la ventana del cronómetro. Tema oscuro plano, `font.family: Architects Daughter`, sin grid ni ejes decorativos. |
| D6 | Caché corrupta | **Ambas cosas**: `[Console]::OutputEncoding = UTF8` en las dos invocaciones PowerShell (causa raíz) **y** `schemaVersion` en `installed-apps-cache.json` — versión ausente o vieja invalida la caché y fuerza reenumeración antes de servir datos. La invalidación puntual sola deja al usuario viendo lo corrupto en la primera apertura; el fix de encoding solo no autorepara lo que ya está en disco (confirmado: el userData de este entorno lo tiene corrupto ahora). |

## Scope

**Incluye:** los 9 puntos del intent, con el gráfico ampliado a tres alcances (día/mes/rango) según la enmienda de la iteración 1, más tres adiciones que salen del mismo hallazgo: deduplicación por `appId` en el listado de instaladas (3 duplicados reales, mismo módulo y misma spec que P8); corrección del patrón de escritura de `icon-cache.js::persistToDisk` (prerequisito real de P9); cierre y registro de sesiones abiertas al salir de la app (prerequisito de D2).

**Excluye explícitamente:** introducir test runner o CI; anidar grupos o hacerlos reutilizables entre días; serie temporal por fecha dentro del intervalo (el gráfico agrega por app, no por día) y exportación de datos; alcance mes/rango en las dos vistas de lista (D5); lazy-loading por viewport de íconos (se resuelve por raíz); cambiar el límite de 4 filas simultáneas; integrar el historial con `pomodoro-sessions.json`; remover dependencias muertas (`@shopify/draggable`, `fluid-dnd`), assets PNG huérfanos y el modal de historial muerto de `CronometroAplicacion.vue` — deuda ya registrada, cambio aparte; soporte macOS/Linux del fix de encoding (Windows por definición); revalidar `monitored-selection.json` contra nombres corruptos preexistentes (el usuario re-agrega la app afectada).

## Approach Propuesto

Seis etapas encadenadas por acoplamiento real, no por orden del intent. Las etapas 1-3 y 4-6 son dos bloques entregables por separado.

1. **Calidad de datos Windows (P7, P8)** — encoding UTF-8, `schemaVersion`, filtro `.exe`, dedup. Prerequisito de la 2: no tiene sentido pedir el ícono de una entrada con `exePath` corrupto o de un `.chm`.
2. **Íconos en el selector (P9)** — primero el volcado por tanda en `persistToDisk`, después `ensureIcon` sobre el listado ya limpio.
3. **Selección (P1, P2)** — toggle de deselección en `choose()` (el IPC y el store ya existen: es cablear la UI), campo `type`, orden de operaciones del reductor. Va después de la 2 porque ambas tocan `AppSelectorModal.vue`.
4. **Persistencia estructurada (P3)** — `sessions.json`, migración, nombre de sesión. Prerequisito duro de 5 y 6.
5. **Grupos (P4)** — cross-list drag & drop, `groupId` en filas y en el log.
6. **Historial (P5, P6)** — sobre el formato de la 4 y el `groupId` de la 5, en dos cortes entregables:
   - **6a** — las dos vistas del día y el gráfico de barras por app del día. Deja el historial completo y usable.
   - **6b** — selector de alcance, `v-calendar` en modo rango y agregador por intervalo. El gráfico de 6a se generaliza: mismo componente, mismo dataset, la única diferencia es el par de fechas que entra al agregador.

## Esfuerzo Estimado

**XL** — nueve puntos sobre ~12 archivos, con una migración de formato de datos reales de producción, una dependencia nueva, un patrón de drag & drop sin precedente en el repo, y dos specs completadas (`row-lifecycle`, `session-log-persistence`) que este cambio modifica en su semántica. Sin tests ni CI, el costo de verificación es manual y no despreciable.

La enmienda del gráfico no cambia el tier, pero consume el margen que quedaba dentro de XL: agrega el selector de alcance, el modo rango de `v-calendar` y un agregador que filtra por intervalo en vez de por día. Es contenido y aditivo — una sola forma de gráfico para los tres alcances (D5b) y listas que no cambian (D5) —, pero cae entero sobre la etapa 6, que ya era la última. De ahí el corte 6a/6b: el historial queda entregable aunque el alcance ampliado se corra de tiempo.

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Carrera entre la baja de una entrada manual de `selection` y la re-evaluación de altas en el mismo tick | Alta | Fila renacida y sesión fantasma de 0-1s; sin tests se detecta solo a mano | Baja de `selection` y de `rows` en el mismo paso del reductor, antes de evaluar altas |
| Migración de `usage-log.txt` sobre datos reales desde 2025-04 | Media | Pérdida irrecuperable del historial del usuario | Migración one-shot idempotente; el `.txt` se renombra a `.bak`, nunca se borra |
| Ausencia de tests y CI sobre motor, persistencia e historial | Alta | Regresiones en specs ya completadas, visibles solo en uso real | Plan de verificación manual por escenario en `sdd-verify`; reductores, filtro y agregador por intervalo con entradas fabricadas |
| `vuedraggable` cross-list sin precedente en el repo | Media | Si `group`/`pull`/`put` no cubre el caso, la etapa 5 cambia de técnica y de estimación | Prototipo mínimo de validación en `sdd-design` antes de comprometer el approach |
| Alcance de 9 puntos en 6 etapas, con la etapa 6 ampliada por el alcance día/mes/rango | Media | El cambio queda a medias con el historial migrado y sin vistas que lo consuman; el peso extra cae en la última etapa | Cortes limpios por etapa; bloques 1-3 y 4-6 entregables por separado, y la 6 partida en 6a (vistas + gráfico del día) y 6b (alcance mes/rango) |
| Lectura desincronizada entre el gráfico (mes/rango) y las listas (siempre del día) | Media | El usuario compara totales que no cuadran y no entiende por qué | Cabecera del gráfico rotulada con el intervalo vigente; con alcance `Día` el gráfico sigue al calendario y los números coinciden |
| Costo cuadrático de `persistToDisk` con ~106 íconos | Media | Jank en la primera apertura del selector tras instalar o actualizar | Volcado por tanda antes de cablear los íconos |

## Trade-offs

- **A favor de migrar a JSON (D1)**: una sola fuente y un solo lector; agregar `sessionName` y `groupId` deja de ser un ejercicio de regex, y filtrar por intervalo arbitrario sobre `date` en `YYYY-MM-DD` es una comparación de strings. **En contra**: hay que migrar datos reales una vez y hacerlo bien; el formato de texto era legible a ojo desde cualquier editor y deja de serlo.
- **A favor de persistir las entradas manuales (D2)**: un solo archivo y un solo camino de escritura; reiniciar el cronómetro no mata una sesión transitoria que sigue en curso. **En contra**: la "transitoriedad" pasa a ser una regla del reductor y no una propiedad del almacenamiento — si el reductor falla, la entrada manual queda pegada en disco.
- **A favor de que el grupo no fusione relojes (D3)**: cero cambios en `session-log-persistence`, y el desglose por app queda disponible gratis. **En contra**: el "tiempo del grupo" es siempre derivado, así que dos filas del mismo grupo con tramos solapados suman más que el reloj de pared; la regla queda declarada (suma), pero es una lectura que hay que explicar en la UI.
- **A favor de una sola forma de gráfico para los tres alcances (D5b)**: un componente, un dataset y un agregador que solo cambia el par de fechas de entrada; el mes y el rango se entregan casi gratis una vez hecho el día. **En contra**: se pierde el "cuándo" dentro del intervalo — un mes con 40 horas de un editor no dice si fueron cinco días intensos o veinte parejos. Es información real que el gráfico no muestra y que el calendario solo responde día por día.
- **A favor de limitar el alcance al gráfico y dejar las listas por día (D5)**: evita duplicar el gráfico en forma de tabla y evita una lista de cientos de sesiones; el cambio queda acotado a lo que el usuario pidió. **En contra**: queda una asimetría en la pantalla — el gráfico puede mostrar un mes mientras las listas de abajo muestran un día. Se mitiga con el rótulo del intervalo, pero la asimetría existe.
- **A favor de `chart.js` (D5b)**: ejes, escalas y tooltips gratis, aislado del bundle principal; con alcance mes/rango la magnitud de las duraciones salta de minutos a decenas de horas y los ticks dejan de ser triviales de calcular a mano. **En contra**: ~200KB y una dependencia nueva para un gráfico de barras. Y hay que ser preciso sobre el argumento: la enmienda **no** trae un eje temporal — al agregar por app y no por fecha, el "gratis" que aporta `chart.js` es la escala de duración y el tooltip, no un eje de tiempo. El SVG a mano sigue siendo viable; se descarta por costo de mantención, no por imposibilidad.
- **A favor de la secuencia por acoplamiento**: cada etapa entra sobre una base ya limpia. **En contra**: los puntos que más se notan en la UI (grupos, historial) quedan al final, así que el valor visible llega tarde.
