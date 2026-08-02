---
type: adr
title: "Motor de monitoreo con dos señales separadas sobre un único timer"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-01"
change_ref: "[[app-detection-logos-audio]]"
capability: "app-monitoring"
tags: [adr]
---

# Motor de monitoreo con dos señales separadas sobre un único timer

## Context

El motor de monitoreo actual vive en `src/background.js` como una variable global
`cronometroInterval` más un `currentAppName`, y evalúa una sola condición por tick:

```javascript
if (winInfo && winInfo.owner && winInfo.owner.name === appName) { …isActive: true }
else { …isActive: false }
```

Ese predicado único mezcla dos preguntas distintas: *¿este programa sigue abierto?* y
*¿este programa tiene el foco ahora?*. Cuando el usuario cambia de ventana, el predicado
responde `false` y el renderer lo interpreta como "pausar", indistinguible de "el programa
se cerró". De esa fusión sale el bug de pausa que motiva el cambio, y sobre ella conviven
hoy dos mecanismos de pausa desacoplados —el botón manual y el foco— peleando por las
mismas variables de instancia del componente.

Las specs separan explícitamente los dos ejes:

- `row-lifecycle` — el proceso vivo gobierna **la existencia** de la fila: entra al
  abrirse, sale al cerrarse.
- `two-state-row-machine` — el foco gobierna **el estado** de una fila que ya existe:
  corriendo o pausado, sin tercer estado.
- `saved-selection-only-monitoring` — ambos ejes se aplican exclusivamente a los programas
  de la selección guardada.

`sdd-spec` marcó como riesgo del cambio que implementar ambas reglas como un único chequeo
combinado reintroduce el acoplamiento que causó el bug original.

El motor pasa además de una app a cuatro simultáneas, así que la decisión de cómo se
observan las señales determina también el costo de CPU: hoy ya corre un `setInterval` de
1000ms que llama `activeWin()`, y `active-win` en Windows resuelve la ventana en foco
invocando un binario nativo, es decir con costo de spawn por llamada.

## Decision

El main process sostiene **un único timer de 1000ms** y, dentro de cada tick, muestrea
**dos señales independientes** que alimentan **dos reductores independientes** aplicados en
orden fijo.

Las señales se definen por la pregunta que responden, no por la fuente que las produce:

| Señal | Pregunta que responde | Efecto único |
|---|---|---|
| `S_live(programa)` | ¿existe un proceso en ejecución para este programa? | existencia de la fila |
| `S_focus` | ¿qué programa es dueño de la ventana en primer plano ahora? | estado de las filas vivas |

Fuentes que alimentan `S_live`, todas equivalentes entre sí:

1. `process.kill(pid, 0)` sobre el PID de cada fila con PID asignado — verificación de
   liveness sin spawn, ejecutada en cada tick.
2. Enumeración de procesos del sistema cada 5 ticks, y solo cuando hace falta descubrir
   aperturas: existe algún programa de la selección guardada sin fila y el listado visible
   está por debajo del límite de 4.
3. El PID y la ruta observados en la muestra de `activeWin()`: una ventana en foco es
   evidencia directa de que su proceso está vivo.

Fuente que alimenta `S_focus`: exclusivamente la muestra de `activeWin()` del tick.

Orden de aplicación dentro del tick, invariante:

1. `reduceLifecycle(S_live, selecciónGuardada, filas)` → inserciones y bajas de fila, con
   apertura y cierre de sesión y escritura al log en las bajas.
2. `reduceFocus(S_focus, filas)` → asigna `corriendo` a como máximo una fila y `pausado` al
   resto.

El orden garantiza que una fila que entra en este tick reciba su estado de la misma muestra
de foco, y que una fila que sale nunca reciba estado.

La prohibición explícita que este ADR fija: **ningún predicado del motor combina las dos
señales en una sola decisión**. Un chequeo de la forma `focoActual === programa` no decide
jamás si la fila existe, y la liveness del proceso no decide jamás si la fila acumula.

## Consequences

**Positivas:**

- El bug de pausa desaparece por construcción: perder el foco solo puede producir la
  transición `corriendo → pausado`, porque el reductor de foco no tiene acceso al conjunto
  de filas como algo que pueda modificar en tamaño.
- La máquina queda con transiciones enumerables y verificables a mano, que es la única red
  disponible dado que el repositorio no tiene tests.
- El costo de CPU no crece respecto de hoy en el caso común: sigue habiendo un `activeWin()`
  por segundo, y la verificación de liveness de hasta cuatro filas por tick es una llamada
  de sistema sin spawn.
- El descubrimiento de aperturas se apaga solo cuando todos los programas de la selección
  ya tienen fila, que es el estado estacionario del uso normal.
- Un único timer significa un único punto donde suspender el motor: mientras la selección
  guardada está vacía no hay timer corriendo, a diferencia de hoy que arranca por IPC del
  renderer.

**Trade-offs:**

- El descubrimiento de aperturas tiene una latencia de hasta 5 segundos: un programa que se
  abre puede tardar ese tiempo en mostrar su fila, y esos segundos no se cuentan en la
  sesión. Se acepta porque la alternativa —enumerar procesos cada segundo— multiplica por
  cinco el costo de la pieza más cara del tick para ganar una precisión que el usuario no
  percibe en un reloj de resolución de segundos.
- El PID de Windows admite reutilización, así que `process.kill(pid, 0)` puede reportar como
  viva una fila cuyo proceso murió y cuyo PID fue reasignado dentro de la ventana de
  polling. La enumeración cada 5 ticks valida el par `(pid, nombre de imagen)` de cada fila y
  corrige el caso, que además exige una reutilización de PID en menos de cinco segundos.
- Mantener dos reductores separados es más código que un `if` combinado, y nada en el
  lenguaje impide que alguien vuelva a fusionarlos en el futuro. La separación se sostiene
  con la estructura de módulos y con este ADR, no con el compilador.

## Alternatives Considered

- **Un solo chequeo combinado por app** (`vivo && conFoco → corriendo`, si no `pausado`, y
  la fila sale cuando el chequeo falla N veces): es la forma actual generalizada a N apps.
  Se descarta porque es exactamente la fusión que produjo el bug: obliga a distinguir "falló
  porque perdió el foco" de "falló porque se cerró" con heurísticas de conteo, y esas
  heurísticas son el estado intermedio que `two-state-row-machine` prohíbe.
- **Dos timers independientes**, uno de foco y uno de proceso, cada uno con su período:
  separa las señales pero duplica los puntos de arranque, parada y guardas de solapamiento,
  y abre la posibilidad de que los dos reductores se apliquen en orden indeterminado — con
  lo cual una fila puede recibir estado después de haber salido del listado. Se descarta por
  costo de sincronización sin beneficio: un timer alcanza para muestrear ambas señales.
- **Detección por eventos del sistema operativo** (suscripción WMI a
  `Win32_ProcessStartTrace` / `Win32_ProcessStopTrace`) en vez de polling: elimina la
  latencia de descubrimiento y el polling de liveness. Se descarta por costo y fragilidad —
  exige sostener un proceso PowerShell de larga vida, el acceso a esas clases WMI depende de
  privilegios, y el fallo se manifiesta como ausencia silenciosa de eventos, que es
  indistinguible de "no pasó nada". El polling falla de forma ruidosa y verificable a mano.
- **Enumerar procesos en cada tick sin la guarda de necesidad**: simplifica la lógica del
  motor a costa de un spawn por segundo permanente. Se descarta porque la guarda es una
  condición de dos términos y el ahorro es el 100% de la pieza más cara en el estado
  estacionario.
