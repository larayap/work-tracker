---
type: change-clarifications
change_name: "work-groups-history-time-format"
jira_key: "POM-1"
status: answered
iteration: 1
created: "2026-08-05"
updated: "2026-08-05"
tags: [change, clarifications]
---

# Clarificaciones: work-groups-history-time-format

## Iteración 1 — Preguntas (2026-08-05)

### Q1 — Tipografía: ¿toda la ventana o solo los nombres de aplicación?

La fuente decorativa que ves hoy no está puesta solo en los nombres de aplicación: está
declarada para toda la ventana del cronómetro, y los nombres de app simplemente la heredan.
No existe hoy ningún lugar donde esté acotada a "aplicaciones", así que hay que elegir el
alcance.

- **A) Toda la ventana del cronómetro pasa a la fuente normal.** Cambian los nombres de app,
  el título "Work", los nombres de sesión y el Pomodoro. Todo queda con una sola tipografía
  legible.
- **B) Solo los nombres de aplicación pasan a la fuente normal.** El título "Work" y el resto
  conservan la decorativa. Consecuencia: dos tipografías conviviendo en la misma ventana.

En ambos casos se propone además pasar el gráfico del historial a la fuente normal: hoy es el
único elemento de esa ventana con la decorativa y desentona con el resto, que ya usa la
normal. Si preferís que el gráfico la conserve, decilo.

**Recomendación**: A — es lo que resuelve "que se pueda ver bien" sin dejar una mezcla visual.

### Q2 — Historial: ¿qué "horas" hay que sacar?

Debajo del gráfico hay dos cosas distintas y el pedido admite las dos lecturas:

- **A) La regla de números al pie del gráfico** (00:00:00, 00:30:00, …) que sirve de escala a
  las barras. Sacarla deja las barras limpias; para ver el valor exacto de una barra pasás el
  mouse por encima y aparece el globito con el tiempo. Las dos listas de más abajo no cambian.
- **B) Las columnas de tiempo de las listas de abajo** ("Por app" y "Por sesión"). Sacarlas
  significa perder la única lectura exacta de cuánto duró cada aplicación y cada sesión.
- **C) Las dos.**

**Recomendación**: A. Si te referías a otra cosa que ves debajo del gráfico, describila y la
ubicamos.

### Q3 — "Gráficos más blancos": ¿solo las barras o toda la ventana?

- **A) Solo las barras.** Hoy son gris medio sobre fondo casi negro; pasan a un gris claro o
  casi blanco, bien contrastado. La ventana sigue oscura. Cambio chico y sin efectos
  colaterales.
- **B) Tema claro de toda la ventana de historial**: fondo, calendario y tablas además del
  gráfico. **Advertencia**: existe una regla vigente del proyecto que exige que la ventana de
  historial se abra oscura desde el primer instante, justamente para que no haya un destello
  blanco al abrirla. Ir a tema claro obliga a reescribir esa regla y convierte un ajuste chico
  en rehacer la paleta completa del historial.

**Recomendación**: A. Si querés B, se puede hacer, pero conviene tratarlo como un cambio
aparte con su propio alcance.

### Q4 — Apps duplicadas: ¿lo viste efectivamente?

La agrupación por aplicación **ya está implementada** para día, mes y rango: el historial suma
todo lo de una misma app en una sola barra. Además, esa agrupación se corrigió y se verificó
hace poco contra tus 32 registros reales, precisamente para que no se mezclen programas
distintos entre sí.

Antes de tocarla necesito saber:

1. ¿Viste realmente la misma aplicación repetida en dos barras del mismo gráfico?
2. Si sí: ¿cuál aplicación, y en qué vista (día, mes o rango)?
3. ¿Es una app que podrías tener instalada dos veces, o que reinstalaste en otra carpeta?

Si fue una suposición al escribir el ticket y no lo observaste, este punto ya está cumplido y
no se toca nada. Si lo observaste, con el nombre de la app se verifica primero contra tus
datos reales: cambiar la agrupación a ciegas arriesga volver a mezclar programas distintos,
que es exactamente el problema que ya se arregló.

### Decisión de diseño registrada (ítem 1) — objetable

No es una pregunta abierta: la propuesta ya toma una decisión, y la dejo acá para que la
objetes al aprobar si no te convence.

**Cómo se crearía el segundo grupo**: se mantiene el mismo gesto de hoy. La franja
"Arrastrá aquí para agrupar" pasa a ser permanente y queda debajo de los grupos que ya
existan, mientras te queden filas sueltas. Cuando soltás una fila en esa franja, se convierte
en un grupo con su nombre editable y aparece una franja vacía nueva debajo. Así el segundo
grupo se crea igual que el primero, sin botón nuevo.

**Por qué no un botón "+ nuevo grupo"**: un grupo solo existe mientras tenga filas adentro, así
que un botón crearía un grupo vacío que se borraría solo hasta que le sueltes algo. Además la
ventana es chica (500x333) y la barra de arriba ya tiene dos botones.

**Lo que cuesta**: la franja vacía ocupa un poco de alto fijo mientras tengas filas sueltas, y
como el monitor admite 4 filas a la vez, el máximo real son 4 grupos.

## Iteración 1 — Respuestas (2026-08-05)

### Q1 — Tipografía → **acotado a los títulos de sesión**

Respuesta literal del usuario: *"Solo me referia a los titulos de las sesiones igual deja lo
demas con la tipogrtafia"*.

Es decir: **ni A (global) ni B tal como fue planteada**. El alcance es el título de sesión, y
todo lo demás (título "Work", Pomodoro, etc.) **conserva la fuente decorativa**.

**Hallazgo del orquestador al mapear ese alcance** (verificado en código, no asumido):

- En `src/components/AppRow.vue:24-27` el título de sesión y el nombre de aplicación son
  **el mismo elemento**: `<span class="app-name">{{ displayName }}</span>` con
  `displayName() { return this.row.sessionName || this.row.name }` (línea 90-91). El elemento
  muestra el título de sesión si existe y cae al nombre de la app si no.
  **Consecuencia**: no se pueden separar por CSS. Cambiar `.app-name` cubre ambos casos, que es
  el resultado deseado — cuando el usuario nombró la sesión ve su título en fuente legible, y
  cuando no la nombró ve el nombre de la app en fuente legible.
- `.app-name-input` (línea 170) es el campo de edición de ese mismo título → mismo tratamiento.
- En el historial, `BySessionView.vue:9,20` (`.entry-name`) muestra `sessionName || app`, pero
  esa ventana **ya usa `sans-serif`** — no requiere cambio.

**Alcance resultante del ítem 4**: override local de `font-family` en `.app-name` y
`.app-name-input` de `AppRow.vue`. NO se toca `App.vue` (la global sigue decorativa), NO se toca
`CronometroPomodoro.vue`.

**Pendiente de decisión heredada**: el usuario no se pronunció sobre la fuente del gráfico
(`ChartJS.defaults.font.family` en `UsageChart.vue`). Dado que pidió explícitamente conservar la
decorativa en todo lo demás, el criterio conservador es **no tocarla** en este cambio. Queda
registrado como decisión objetable, no como pregunta abierta nueva.

### Q2 — Horas del historial → **A: la regla del pie del gráfico**

Se oculta el eje de duración de `UsageChart.vue` (`scales.x`). Las dos listas de abajo
(`ByAppView`/`BySessionView`) **no se tocan**. El tooltip conserva el valor exacto.

### Q3 — Gráficos más blancos → **A: solo las barras**

Sube el brillo de `backgroundColor` de las barras sobre el fondo oscuro actual. La ventana sigue
oscura. **`dark-loading-state` no se toca** y R3 queda descartado.

### Q4 — Apps duplicadas → **"No estoy seguro, verificá vos"** → VERIFICADO: el problema EXISTE

El orquestador verificó `C:\Users\Luis Araya\AppData\Roaming\cronometro-apps\sessions.json`
(44 entradas reales). **La hipótesis de `sdd-explore` era la equivocada, pero hay un problema
real y confirmado, por otra causa.**

`groupKeyOf(entry)` = `entry.appId != null ? entry.appId : "name:" + entry.app`
[fuente: código `src/utils/session-aggregate.js:26-28`].

Distribución real de `appId` por nombre visible en los datos del usuario:

| App | appId distintos | Efecto en el gráfico |
|---|---|---|
| `Google Chrome` | `null` + `c:\program files\google\chrome\application\chrome.exe` | **2 barras con el mismo rótulo** |
| `Firefox` | `null` + `c:\program files\mozilla firefox\firefox.exe` | **2 barras con el mismo rótulo** |
| `League of Legends` | `null` + `c:\riot games\league of legends\leagueclientux.exe` | **2 barras con el mismo rótulo** |
| `Chrome` | `null` | barra aparte de `Google Chrome` — **nombre visible distinto para el mismo navegador** |
| `Brave`, `Discord`, `Microsoft Teams`, `Spotify`, `Visual Studio Code` | solo `null` | una barra cada una, correcto |
| `Access` | solo ruta real | una barra, correcto |
| `null` (literal) | `null` | entrada con nombre nulo — caso borde a revisar |

**Causa raíz**: no son dos instalaciones ni una reinstalación (la hipótesis explorada). Es la
**convivencia de entradas migradas del formato viejo** (`usage-log.txt`, sin `appId`, ADR-0007)
**con entradas nuevas** (con ruta de ejecutable) **para la misma aplicación**. Las primeras
degradan a `name:Google Chrome` y las segundas usan la ruta: dos claves, dos barras.

**Restricción que sigue vigente**: la solución NO es agrupar por `appId` desnudo — eso es
exactamente lo que el fix F1 corrigió (colapsaba TODOS los programas migrados en una sola fila).
La unificación tiene que ser por **nombre visible normalizado**, preservando el criterio de F1
de no fusionar programas legítimamente distintos.

**Caso adicional detectado**: `Chrome` vs `Google Chrome` son dos nombres visibles distintos en
los datos. Unificar solo por nombre exacto NO los junta. Resolver esto exige normalización de
nombres (o mapeo), que es una decisión de alcance a evaluar — el usuario pidió "todos los chrome
en una barra", lo que sugiere que sí espera que se junten.

**Efecto sobre el alcance**: el ítem 3 pasa de "verificación sin cambio de código" a **cambio
confirmado en `src/utils/session-aggregate.js`**, con reestimación de esfuerzo. R4 sube su
probabilidad: ahora se toca el agregador de verdad.
