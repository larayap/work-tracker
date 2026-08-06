---
type: change-tech-context
change_name: "work-groups-history-time-format"
libraries: ["chart.js@^4.5.1", "vue-chartjs@^5.3.4", "vuedraggable@^4.1.0 (vue.draggable.next)"]
source: context7
consulted_at: "2026-08-05"
created: "2026-08-05"
updated: "2026-08-05"
tags: [change, tech-context]
---

# Contexto técnico de librerías — work-groups-history-time-format

Consulta única a context7 (`2026-08-05`) sobre las tres librerías externas que el alcance
toca. Solo se registra lo que el diseño usa; no es un resumen de la documentación.

## chart.js 4 — `/websites/chartjs`

**Visibilidad de un eje completo (ítem 2).** La opción canónica es `display` a nivel de la
escala, no a nivel de ticks:

> *"The `display` option controls the global visibility of the axis. It can be set to `true`
> to show, `false` to hide, or `'auto'` to show only if at least one associated dataset is
> visible."* — `axes/cartesian/linear.html`, común a todos los ejes cartesianos.

Consecuencia para el diseño: `scales.x.display: false` oculta la escala **entera** (línea,
grilla y ticks). Con eso, `scales.x.grid.display` y `scales.x.ticks.callback` quedan sin
efecto y son código muerto — se retiran. `scales.y` no se toca: los nombres de aplicación
tienen que seguir visibles.

**Color de barras (ítem 7).** `backgroundColor` por dataset es la vía documentada; acepta un
color único para todas las barras o un array de colores por barra
(`general/colors.html`, `charts/bar.html`). El diseño usa un color único: el gráfico tiene un
solo dataset y las barras no codifican categorías por color.

**No aplica a este cambio**: `ChartJS.defaults.color` y `ChartJS.defaults.font.family` siguen
fijados una sola vez a nivel de módulo (ADR-0010); ninguno de los dos cambia acá — la
tipografía del gráfico se conserva decorativa por decisión explícita del usuario (Q1).

## vue-chartjs 5

Sin hallazgo nuevo: el componente `<Bar :data :options>` ya está en uso y ninguno de los dos
cambios (ítem 2 y 7) altera cómo se le pasan los datos. El `computed` sobre `aggregateByApp`
que evita el warning `Target is readonly` sigue siendo necesario y no se toca.

## vuedraggable 4 — `/sortablejs/vue.draggable.next`

**N listas con arrastre cruzado (ítem 1).** El patrón documentado es exactamente el que este
diseño necesita: varias instancias de `<draggable>`, cada una con su propio `v-model`, todas
compartiendo el mismo nombre de `group`. No hay límite de instancias ni API especial para
"muchas listas": es la misma que para dos.

```vue
<draggable v-model="list1" item-key="id" :group="{ name: 'items', pull: true, put: true }">
<draggable v-model="list2" item-key="id" :group="{ name: 'items', pull: true, put: true }">
```

El código actual usa la forma corta `group="monitored-rows"` (string), equivalente a
`{ name, pull: true, put: true }`. Se conserva.

**Eventos.** Los emitidos son `start`, `end`, `change`, `add`, `remove`, `update`. `change`
trae `{ added, removed, moved }` con `{ element, newIndex/oldIndex }`.

> *"Key events emitted by Vue.Draggable.Next are start (drag begins), end (drag ends), change
> (list modified with added/removed/moved data), add, remove, update."*

Lo que la documentación **no** fija y el diseño sí necesita resolver: el orden relativo entre
`change` y `end` dentro de un mismo gesto. SortableJS despacha `onAdd`/`onRemove`/`onUpdate`
antes de `onEnd` en su `_onDrop`, de modo que `@change` (donde se emite la intención por IPC)
corre **antes** que `@end` (donde se libera la guarda). El diseño de la guarda diferida
(§ Ítem 1) depende de ese orden y por eso lo deja escrito como supuesto verificable en la
prueba manual, no como hecho documentado por la librería.

**`item-key` es obligatorio.**

> *"The `itemKey` prop is mandatory for accurate Vue key tracking and essential for correct
> list updates."*

Se conserva `item-key="appId"` en todas las listas: `appId` es único en todo el listado
(clave de fila del motor), también entre listas distintas.

**Trampa documentada, relevante al refactor**: *"Avoid using `list` and `modelValue` props
simultaneously to prevent console errors."* El código usa `v-model` (es decir `modelValue`);
el refactor a N contenedores mantiene `v-model` y **no** introduce la prop `list`, ni siquiera
para la franja vacía.
