---
type: tech-context
change_name: "sessions-groups-history"
consulted_at: "2026-08-02"
source: "context7 (una sola consulta, [[0024-context7-tech-context-ssot]]) + verificación local contra los paquetes reales"
libraries:
  - "chart.js 4.5.1 (NUEVA)"
  - "vue-chartjs 5.3.4 (NUEVA)"
  - "vuedraggable 4.1.0 / sortablejs 1.14.0 (ya en el proyecto, uso nuevo cross-list)"
  - "v-calendar 3.1.2 (ya en el proyecto, uso nuevo de rango)"
  - "electron 13.6.9 (ciclo de vida: before-quit)"
tags: [tech-context]
---

# Tech Context: sessions-groups-history

Documentación vigente de las librerías que este cambio decide o extiende. Las fases
posteriores **no** re-consultan context7: este archivo es la fuente única.

Las versiones de las librerías ya presentes son las **resueltas en `package-lock.json`**
(lockfileVersion 3), no los rangos de `package.json`:

| Paquete | Rango en package.json | Resuelto en lock |
|---|---|---|
| `vue` | `^3.2.13` | **3.5.13** |
| `vuedraggable` | `^4.1.0` | 4.1.0 |
| `sortablejs` (transitiva) | — | **1.14.0** |
| `v-calendar` | `^3.1.2` | 3.1.2 |
| `electron` | `^13.0.0` | **13.6.9** |

---

## chart.js 4 (dependencia NUEVA)

**Versión objetivo**: `^4.5.1`. `engines` declara únicamente `pnpm >= 8` (restricción de
publicación del propio repo de chart.js, no un requisito de runtime: `npm install` la ignora).

**Resolución de módulo**: `main: ./dist/chart.cjs`, `module: ./dist/chart.js`. Webpack 5
(Vue CLI Service 5) resuelve `module` para el target browser. `vue.config.js` ya declara
`transpileDependencies: true`, así que Babel transpila el ESM de chart.js al target `es5`
del proyecto sin configuración adicional.

**Sin adaptador de fechas**: chart.js 4 exige `chartjs-adapter-*` **solo** para la escala
`time`. Este cambio agrega por aplicación sobre una escala `category` (D5b: el gráfico
responde "en qué gasté el tiempo", no "cuándo"), así que **no** hace falta ninguna
dependencia de fechas adicional.

### Barras horizontales

`indexAxis: 'y'` en `options` invierte la orientación (default `'x'`):

```javascript
const config = {
  type: 'bar',
  data,
  options: {
    indexAxis: 'y',
    elements: { bar: { borderWidth: 2 } },
    responsive: true,
    plugins: {
      legend: { position: 'right' },
      title: { display: true, text: 'Chart.js Horizontal Bar Chart' },
    },
  },
}
```

El dataset admite además `axis: 'y'` por dataset, pero con un único dataset `indexAxis`
en `options` alcanza.

### Ticks y ejes (namespace `options.scales[scaleId].ticks`)

| Opción | Tipo | Default | Nota |
|---|---|---|---|
| `display` | boolean | `true` | mostrar etiquetas de tick |
| `color` | Color | `Chart.defaults.color` | color de los ticks |
| `font` | Font | `Chart.defaults.font` | familia/tamaño |
| `callback` | function | — | devuelve la representación en texto del valor del tick |
| `padding` | number | `3` | separación de la etiqueta respecto del eje |

Título de eje: `options.scales.y.title = { display: true, text: '…' }`.

Los defaults globales de color y fuente se fijan una vez con `Chart.defaults.color` y
`Chart.defaults.font.family` — es el mecanismo para el tema oscuro sin repetir opciones por
gráfico.

---

## vue-chartjs 5 (dependencia NUEVA)

**Versión objetivo**: `^5.3.4`.

**peerDependencies** (verificadas en el registry):

```json
{ "chart.js": "^4.1.1", "vue": "^3.0.0-0 || ^2.7.0" }
```

→ Compatible con el `vue@3.5.13` resuelto del proyecto y con `chart.js@^4.5.1`. **Ambas
peer deps deben declararse en `package.json`**: `vue-chartjs` no trae `chart.js` adentro.

### Registro tree-shakable (obligatorio desde v4)

`vue-chartjs` 5 no auto-registra nada de chart.js: hay que registrar explícitamente los
controladores/escalas/plugins que el gráfico usa.

```javascript
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale,
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)
```

Registrar de menos produce el error de runtime `"category" is not a registered scale`.

### Componente reactivo (Options API, que es el estilo del repo)

```vue
<template>
  <Bar :data="chartData" :options="chartOptions" />
</template>

<script>
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

export default {
  name: 'BarChart',
  components: { Bar },
  computed: {
    chartData() { return /* datos mutables */ },
    chartOptions() { return /* opciones mutables */ },
  },
}
</script>
```

- v5 usa la prop **`data`** (en v4 era `chart-data`). Los watchers internos del componente
  hacen el `chart.update()`; no hay que llamar nada a mano.
- **Warning `Target is readonly`**: aparece si se le pasa un valor reactivo de solo lectura.
  Se evita pasando un objeto derivado en un `computed` (que es lo que este diseño hace: el
  dataset se construye en un `computed` a partir del agregador puro), o clonando antes.

---

## vuedraggable 4.1.0 + sortablejs 1.14.0 (uso nuevo: cross-list)

Verificado **leyendo el código de los paquetes reales** descargados con `npm pack`
(`vuedraggable@4.1.0`, `sortablejs@1.14.0`), no solo la documentación.

### `group` como string habilita el cross-list por defecto

`sortablejs/modular/sortable.esm.js:1121` — `_prepareGroup(options)` normaliza
`group: 'x'` a `{ name: 'x', checkPull, checkPut }`, y `toFn` resuelve:

```javascript
var sameGroup = to.options.group.name && from.options.group.name
             && to.options.group.name === from.options.group.name;
if (value == null && (pull || sameGroup)) return true;   // pull/put null + mismo name ⇒ true
```

→ Dos `<draggable>` con **el mismo `group="…"` de tipo string** aceptan `pull` y `put`
entre sí sin configurar nada más. `pull`/`put` explícitos solo hacen falta para restringir
(`put: false`, listas de nombres, `clone`).

### Se arrastra exactamente un elemento

`sortable.esm.js:1447` — `dragEl = target`: un único elemento por gesto. El arrastre
múltiple vive en `MultiDragPlugin` (línea 3166), un plugin aparte que hay que montar con
`Sortable.mount(new MultiDrag())`; `vuedraggable` no lo monta.

→ **El riesgo declarado en la propuesta ("si `group`/`pull`/`put` no cubre mover una fila
sin arrastrar el grupo completo") queda cerrado**: mover una fila individual es el
comportamiento por defecto, no una configuración.

### Actualización del modelo en cross-list (`vuedraggable/src/vuedraggable.js`)

```javascript
onDragAdd(evt) {                       // lista DESTINO
  const element = evt.item._underlying_vm_
  removeNode(evt.item)
  this.spliceList(newIndex, 0, element)
  this.emitChanges({ added: { element, newIndex } })
},
onDragRemove(evt) {                    // lista ORIGEN
  insertNodeAt(this.$el, evt.item, evt.oldIndex)
  this.spliceList(oldIndex, 1)
  this.emitChanges({ removed: { element, oldIndex } })
},
alterList(onList) {
  if (this.list) { onList(this.list); return }        // prop `list`: muta in-place
  const newList = [...this.modelValue]
  onList(newList)
  this.$emit('update:modelValue', newList)            // prop `modelValue`: emite copia
},
```

Consecuencias que este diseño usa:

1. **Cada `<draggable>` necesita su propio array**; un cross-list produce dos mutaciones
   independientes (una por lista) y **dos** eventos `change` (`removed` en la origen,
   `added` en la destino).
2. `emitChanges` se dispara dentro de un `nextTick`, así que el handler de `@change` corre
   después de que Vue aplicó la actualización del modelo local.
3. `vuedraggable` **manipula el DOM directamente** (`removeNode` / `insertNodeAt`) y luego
   espera que el modelo se actualice. Si el array vinculado se reemplaza desde afuera en
   medio de un gesto (que es exactamente lo que hace el snapshot de 1000ms del motor,
   ADR-0002), el DOM y el vdom quedan desalineados → de ahí la guarda `isDragging` que fija
   el diseño.
4. `evt.item._underlying_vm_` lo setea `onDragStart` mediante `this.clone(...)`: el elemento
   que llega a la lista destino es una **copia** del objeto, no la referencia original.

---

## v-calendar 3.1.2 (uso nuevo: selección de rango)

Verificado leyendo `dist/types/src/use/datePicker.d.ts` y `dist/es/index.js` del paquete real.

### Componentes globales

`app.use(VCalendar)` registra con prefijo `V` (default) los componentes `Calendar`,
`DatePicker`, `Popover`, `PopoverRow` (`dist/es/index.js:8254-8260`):

```javascript
const prefix = app.config.globalProperties.$VCalendar.componentPrefix   // 'V'
for (const componentKey in components) app.component(`${prefix}${componentKey}`, component)
```

→ En template: `<v-calendar>` (el que ya usa `HistoryView.vue`) y **`<v-date-picker>`**, ya
disponible sin instalar nada nuevo.

### API de rango en v3: modificador de `v-model`, no `is-range`

`datePicker.d.ts` declara:

```typescript
export interface ModelModifiers { number?: boolean; string?: boolean; range?: boolean }
export type DatePickerRangeObject = { start: …; end: … }
export type DatePickerModel = DatePickerDate | DatePickerRangeObject
export declare const propsDef: {
  mode: { type: StringConstructor; default: string }
  modelValue: { type: PropType<DatePickerModel> }
  modelModifiers: { type: PropType<ModelModifiers>; default: () => {} }
  isRange: BooleanConstructor        // legado v2, sigue existiendo
  …
}
```

→ La forma vigente en v3 es **`<v-date-picker v-model.range="range" />`** con
`range = { start: Date, end: Date }`. La prop `is-range` es el mecanismo de v2 (la
documentación que devuelve context7 corresponde mayormente a v2 y **no** debe copiarse tal
cual).

Props de presentación relevantes: `color`, `is-dark` (tema oscuro nativo del componente),
`columns`, `max-date`. El `HistoryView.vue` actual no usa `is-dark`: pinta el tema oscuro con
CSS propio (`.dark-calendar`), y ese sigue siendo el camino para no romper el look existente.

---

## Electron 13.6.9 — cierre de la aplicación

### `app.on('before-quit')`

Se emite antes de que la aplicación empiece a cerrar sus ventanas. `event.preventDefault()`
cancela el cierre. Patrón canónico de limpieza:

```javascript
app.on('before-quit', () => {
  clearInterval(progressInterval)   // limpieza sincrónica antes de terminar
})
```

### `will-quit`

Se emite cuando **todas las ventanas ya se cerraron** y la aplicación va a terminar;
`event.preventDefault()` también lo cancela.

### Advertencias que este diseño asume

- **`before-quit` y `will-quit` pueden NO emitirse en Windows** durante apagado, reinicio o
  cierre de sesión del usuario. Es una limitación documentada del propio Electron: una
  sesión abierta durante un apagado forzado se pierde igual (mismo comportamiento que hoy).
- `app.quit()` dispara la secuencia completa de eventos (`before-quit` → `will-quit` →
  `quit`); **`app.exit()` termina el proceso sin emitir ninguno** — no debe usarse en el
  camino de salida de esta app.
- El trabajo dentro de `before-quit` debe ser **sincrónico**: una escritura asíncrona
  (`fs.appendFile`, promesas encoladas) no tiene garantía de completarse antes de que el
  proceso termine. De ahí la decisión de que el volcado de sesiones abiertas use
  `fs.writeFileSync`.
