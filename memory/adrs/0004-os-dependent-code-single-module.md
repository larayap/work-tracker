---
type: adr
title: "Todo el código dependiente del sistema operativo vive en un módulo único del main process"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-01"
change_ref: "[[app-detection-logos-audio]]"
capability: "app-monitoring"
tags: [adr]
---

# Todo el código dependiente del sistema operativo vive en un módulo único del main process

## Context

El cambio se declara Windows-first de forma explícita, decisión que el usuario confirmó en
la primera iteración de la propuesta. La detección de procesos ya es Windows-only —
`get-open-windows` ejecuta PowerShell— y la enumeración de aplicaciones instaladas solo
tiene camino razonable en Windows.

Al mismo tiempo, `forge.config.js` declara makers para `darwin`, `deb` y `rpm`. Es intención
declarada y no soporte real: esa toolchain ni siquiera compila el renderer. La contradicción
está registrada como deuda y queda fuera del alcance del cambio.

El cambio suma superficie dependiente del sistema operativo en tres frentes nuevos: el
descubrimiento de aperturas de proceso, la enumeración de accesos directos del Menú Inicio
con lectura de registro, y la extracción de íconos del ejecutable. Si esas piezas se
escriben donde se necesitan, quedan repartidas entre el motor de monitoreo, el selector y el
pipeline de íconos, y soportar un segundo sistema operativo pasa a ser un rediseño en vez de
una suma.

## Decision

Todo el código que depende del sistema operativo vive en **un único módulo del main
process**, `src/main/platform-windows.js`. Ningún otro archivo del proyecto ejecuta
PowerShell, invoca binarios del sistema, lee el registro ni asume separadores de ruta,
variables de entorno o convenciones de nombre de Windows.

El módulo expone una interfaz definida por capacidades, no por mecanismo. Cada función
describe qué información entrega, no cómo la obtiene:

| Capacidad | Qué entrega |
|---|---|
| ventana en foco | programa dueño del primer plano, con ruta de ejecutable y PID |
| procesos en ejecución | pares de nombre de imagen y PID de los procesos vivos |
| liveness de un PID | si ese PID sigue correspondiendo a un proceso vivo |
| ventanas abiertas | programas con ventana visible, con nombre legible, ruta y PID |
| aplicaciones instaladas | entradas crudas de acceso directo enriquecidas con registro |
| ícono de un ejecutable | ícono asociado a una ruta, serializado |

Los consumidores —motor de monitoreo, selector de instaladas, caché de íconos— importan
únicamente esa interfaz.

El filtrado de las entradas crudas del selector queda **fuera** del módulo, en una función
pura sin dependencia del sistema operativo. La frontera es deliberada: el módulo obtiene
datos del sistema, el criterio de qué es una aplicación de usuario es lógica del producto.

Soportar un segundo sistema operativo consiste en escribir otro módulo que satisfaga la
misma interfaz y elegirlo por `process.platform`. Este cambio no escribe ese módulo ni la
selección: el punto de extensión es la interfaz, no un mecanismo de resolución construido de
antemano.

## Consequences

**Positivas:**

- La superficie dependiente del sistema operativo es enumerable leyendo un archivo, y crece
  solo por ahí.
- El motor de monitoreo, la pieza más riesgosa del cambio, queda escrito contra una
  interfaz de datos y se razona sin Windows de por medio.
- El filtrado del selector, que es criterio de aceptación de una feature, queda verificable
  con entradas fabricadas.
- Un segundo sistema operativo es aditivo: otro módulo con la misma interfaz, sin tocar
  motor, selector ni UI.
- El diagnóstico de fallos de plataforma tiene un solo lugar donde mirar.

**Trade-offs:**

- La interfaz se diseña con un solo implementador conocido, así que puede filtrar supuestos
  de Windows en su forma —nombres de imagen con extensión `.exe`, por ejemplo. Es un riesgo
  aceptado: la alternativa es diseñar contra un implementador imaginario.
- El módulo concentra responsabilidades heterogéneas —foco, procesos, registro, íconos— que
  solo comparten el hecho de hablar con el sistema operativo. Es cohesión por eje de
  variación, no por dominio, y es exactamente la que hace barato el cambio de plataforma.
- Una capa de indirección entre el consumidor y la llamada al sistema, con su costo de
  lectura cuando se depura un valor concreto.

## Alternatives Considered

- **Escribir cada llamada al sistema donde se necesita**: es lo que hace el código actual y
  no cuesta nada hoy. Se descarta porque el cambio triplica esa superficie y la reparte
  entre tres consumidores, con lo cual la mitigación del riesgo de plataforma —declarada en
  la propuesta— dejaría de ser barata.
- **Rama por sistema operativo desde el arranque**, con implementaciones para macOS y Linux
  en este cambio: se descarta porque duplica la superficie de la feature más riesgosa sin un
  usuario que la pida, y porque el proyecto no tiene soporte real de otro sistema operativo
  hoy. La decisión la tomó el usuario en la iteración 1 de la propuesta.
- **Un mecanismo de resolución por plataforma construido ahora** —registro de
  implementaciones, carga dinámica por `process.platform`— con un solo implementador:
  infraestructura sin segundo caso. Se descarta por YAGNI. El punto de extensión que importa
  es la interfaz, y esa sí queda definida.
