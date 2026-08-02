---
type: adr
title: "La librería de gráficos entra al proyecto confinada al bundle de la ventana de historial"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-02"
change_ref: "[[sessions-groups-history]]"
capability: "history-window"
tags: [adr]
---

# La librería de gráficos entra al proyecto confinada al bundle de la ventana de historial

## Context

`usage-chart-by-interval` pide un gráfico de tiempo por aplicación sobre un intervalo
seleccionable —el día del calendario, el mes que lo contiene, o un rango arbitrario—, con el
área visible creciendo según la cantidad de aplicaciones y recorrible por desplazamiento.

El proyecto no tiene hoy ninguna librería de gráficos ni ningún dibujo de datos: la ventana de
historial es una tabla y un calendario. Sumar la primera fija un precedente para todo lo que
venga después, así que la decisión excede a esta feature.

Dos datos del entorno acotan el costo. `vue.config.js` declara `history` como página
independiente de `index`, con entries separados (`src/history/main.js` vs `src/main.js`): lo
que se importe desde la ventana de historial **no entra al bundle de la ventana del
cronómetro**, que es la que está siempre abierta. Y el gráfico agrega **por aplicación, no por
fecha** (D5b de la propuesta): el eje de categorías son nombres de programa y el de valores
son duraciones, así que no hay eje temporal y por lo tanto no hace falta ningún adaptador de
fechas.

La magnitud de los valores sí cambia con el alcance: el mismo gráfico tiene que ser legible
con minutos (un día) y con decenas de horas (un mes o un rango largo), es decir con ticks y
escalas que dejan de ser triviales de calcular a mano.

## Decision

Entran **`chart.js@^4` y `vue-chartjs@^5`** como dependencias nuevas, **importadas
exclusivamente desde `src/history/`**. Ningún módulo alcanzable desde `src/main.js` las
importa.

La invariante que este ADR fija y que hay que sostener: **la ventana del cronómetro no carga
código de graficado**. Si en el futuro hiciera falta un gráfico en la ventana principal, es
una decisión nueva que hay que tomar mirando el costo sobre el bundle que está siempre
abierto, no una consecuencia automática de que la librería ya esté en `package.json`.

El registro es tree-shakable y explícito, en un único módulo de la ventana de historial:
solo se registran los componentes que el gráfico usa (elemento de barra, escala de
categorías, escala lineal y tooltip). No se importa el bundle `auto` de chart.js.

El tema oscuro se resuelve con los **defaults globales** de chart.js (color y familia
tipográfica) fijados una sola vez, no repitiendo opciones en cada gráfico.

**No se agrega ningún adaptador de fechas.** Si en el futuro se quisiera una serie temporal
—el "cuándo" dentro del intervalo, explícitamente excluido del alcance— esa decisión traería
consigo su propia dependencia y su propio ADR.

## Consequences

**Positivas:**

- Ejes, escalas, ticks legibles y tooltips vienen resueltos, que es justamente el trabajo que
  se vuelve no trivial cuando el mismo gráfico tiene que servir para minutos y para decenas de
  horas según el alcance elegido.
- El costo de bundle cae entero sobre una ventana que se abre a demanda y se cierra, nunca
  sobre la que el usuario tiene siempre en pantalla.
- `vue-chartjs` expone componentes Vue con props reactivas, que encaja con el resto del stack
  (SFCs de Vue 3) sin envoltorios propios ni manejo manual del ciclo de vida del canvas.
- El registro explícito deja enumerable en un solo lugar qué partes de chart.js usa el
  proyecto, y hace que agregar un tipo de gráfico sea un cambio visible en vez de un import
  implícito.
- No sumar adaptador de fechas mantiene el árbol de dependencias en dos paquetes y evita
  arrastrar una librería de fechas entera por un gráfico que no tiene eje temporal.

**Trade-offs:**

- Son dos dependencias nuevas y del orden de 200KB para un gráfico de barras. El argumento no
  es que sean gratis: es que el costo está confinado y que el trabajo que reemplazan
  (escalas y ticks sobre magnitudes que varían dos órdenes) es el que más se paga en
  mantención.
- Las peer dependencies acoplan las versiones: `vue-chartjs@5` exige `chart.js@^4.1.1`.
  Actualizar una obliga a mirar la otra.
- La invariante de confinamiento no la impone ninguna herramienta: nada en el build impide
  que alguien importe `vue-chartjs` desde un componente del bundle principal. Se sostiene con
  este ADR y con la ubicación de los archivos, no con el compilador.
- `transpileDependencies: true` hace que Babel transpile el ESM de chart.js al target del
  proyecto, lo que agrega tiempo de build.
- La ventana de historial usa hoy `font-family: sans-serif`, mientras el resto de la
  aplicación carga `Architects Daughter` desde Google Fonts en `src/App.vue`. Aplicar la misma
  tipografía al gráfico obliga a importarla también en el bundle de historial, y esa importación
  depende de red: sin conexión, el gráfico y la ventana caen a la tipografía de respaldo. Es
  una limitación que la ventana principal ya tiene y que este cambio hereda, no una que
  introduzca.

## Alternatives Considered

- **SVG a mano**, sin ninguna dependencia: son unas ochenta líneas para un gráfico de barras
  simple y el control es total. Se descarta por costo de mantención, no por imposibilidad —y
  conviene ser preciso sobre el argumento: al agregar por aplicación y no por fecha, lo que
  chart.js aporta "gratis" es la escala de duración y el tooltip, **no** un eje de tiempo. Lo
  que inclina la decisión es que el mismo componente tiene que servir para tres alcances con
  magnitudes que difieren en dos órdenes, y calcular ticks legibles para eso a mano es el
  tipo de código que se rompe callado.
- **`uPlot`** (~40KB) o **`frappe-charts`**: más livianos. Se descartan porque el peso ya está
  confinado a una ventana que se abre a demanda, así que el ahorro no compra nada real,
  mientras que la API de más bajo nivel de uPlot sí cuesta más código propio para un caso que
  no tiene ninguna exigencia de rendimiento (un gráfico por apertura de ventana, no un
  dashboard en tiempo real).
- **Importar el bundle `chart.js/auto`** en vez de registrar componentes explícitamente: es
  una línea menos. Se descarta porque arrastra todos los tipos de gráfico y todos los plugins
  al bundle, y porque deja de ser visible qué usa realmente el proyecto.
- **Poner el gráfico en la ventana del cronómetro**: se descarta porque el intent lo pide en
  el historial y porque cargaría la librería en la ventana permanentemente abierta, que es
  justamente el costo que esta decisión evita.
