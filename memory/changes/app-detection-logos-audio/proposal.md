---
type: proposal
change_name: "app-detection-logos-audio"
domain: "feature"
status: approved
iteration: 4
created: "2026-08-01"
updated: "2026-08-01"
tags: [proposal]
effort: "XL"
risks:
  - riesgo: "El refactor del motor de monitoreo (mono-app → multi-app con dos estados) introduce regresiones en el conteo de tiempo, que es la función central de la app"
    probabilidad: "Alta"
    impacto: "Alto — la app deja de medir bien y no hay tests que lo detecten"
    mitigacion: "Aislar el refactor como primera fase entregable y verificable por sí sola, antes de montarle features encima; el estado de una fila viva depende de una sola señal (el foco) y el proceso vivo gobierna solo la existencia de la fila, así que la máquina de dos estados queda con transiciones enumerables; guion de verificación manual por transición y por evento de entrada/salida en sdd-verify"
  - riesgo: "Ausencia total de tests automatizados y CI: toda verificación es manual sobre una superficie que crece en 6 features"
    probabilidad: "Alta"
    impacto: "Alto — regresiones silenciosas y costo de verificación alto en cada fase"
    mitigacion: "sdd-verify define un guion manual reproducible por fase; extraer la lógica pura (formateo, acumulación, máquina de estados, filtrado de instaladas) a funciones testeables aunque el runner se agregue después"
  - riesgo: "El listado de apps instaladas no logra separar aplicaciones de usuario de runtimes, actualizadores, redistribuibles y servicios de fondo — es criterio de aceptación, no cosmética"
    probabilidad: "Media"
    impacto: "Alto — si el listado muestra basura, la feature se considera no cumplida"
    mitigacion: "Enumerar desde los accesos directos del Menú Inicio (no desde el registro crudo) y resolver cada uno a su .exe; descartes explícitos por SystemComponent, ruta de sistema, patrones de nombre y ejecutables sin target; buscador por texto; listado de procesos abiertos como segunda vía de selección"
  - riesgo: "El usuario intenta hacer click en el indicador ▶/⏸ porque hoy es un botón y mantiene su glifo"
    probabilidad: "Media"
    impacto: "Bajo — confusión acotada, sin pérdida de datos; y si el click cae en el ■ vecino, la sesión queda escrita al log y la fila vuelve sola al reabrir el programa"
    mitigacion: "Separarlo del bloque de controles y pegarlo al reloj, bajarle escala y contraste, sacarle área de click, hover y cursor; texto accesible de estado en vez de texto de acción"
  - riesgo: "app.getFileIcon devuelve un ícono genérico o de baja resolución para algunos ejecutables"
    probabilidad: "Media"
    impacto: "Bajo — degradación visual acotada"
    mitigacion: "Conservar idk.png como fallback y cachear el dataURL por ruta de ejecutable"
  - riesgo: "resizeWindow() de Menu.vue se comporta mal cuando el widget Aplicación cambia de alto al agregar o quitar programas"
    probabilidad: "Media"
    impacto: "Medio — ventana con tamaño incorrecto o saltos visuales al agregar o quitar filas"
    mitigacion: "Fila de altura fija (50px, la actual), límite duro de 4 programas y recálculo explícito del resize en cada entrada y salida de fila —incluida la salida por cierre de proceso, que ocurre sin intervención del usuario— y en el paso al estado vacío"
  - riesgo: "Declarar el cambio Windows-first deja los makers darwin/deb/rpm de forge.config.js sin camino real"
    probabilidad: "Baja"
    impacto: "Medio — soportar otro SO más adelante exige una rama de código nueva para detección y enumeración"
    mitigacion: "Aislar todo el código dependiente de SO detrás de un módulo único en el main process, para que un segundo SO sea aditivo y no un rediseño"
---

# Propuesta: app-detection-logos-audio

## Intent

Convertir el widget "Aplicación" de un cronómetro de una sola app con logos cargados a mano en un panel que muestra varios programas a la vez, con íconos extraídos automáticamente del ejecutable y en blanco y negro, arranque y detención automáticos según el ciclo de vida del proceso, y un botón cuadrado que saca el programa del listado guardando su sesión. Se suma una pantalla de Opciones (hoy inexistente) con control de volumen, y se corrige el destello blanco al abrir la ventana de historial.

## Scope

**Incluye:**

- **Motor de monitoreo multi-app** en `src/background.js`: el estado global único (`cronometroInterval`, `currentAppName`) pasa a un mapa por app; el evento IPC `app-active` se extiende para llevar `appName` y `pid` además de `isActive`.
- **Dos estados por fila** (corriendo / pausado) como modelo explícito en el main process, con sus transiciones. Reemplaza al actual "hay intervalo / no hay intervalo". El estado de una fila viva depende únicamente del foco.
- **Solo se monitorea el listado del usuario.** El conjunto de programas monitoreados es exactamente el que el usuario armó — vía el selector de instaladas o agregando manualmente. La app **no** agrega filas por su cuenta: detectar el foco de un programa que no está en la selección guardada no produce ningún efecto (ni fila nueva, ni sesión, ni línea en el log). Es requisito, no supuesto.
- **Auto-arranque y auto-stop por proceso**: verificación de proceso vivo, separada de la señal de foco, y aplicada solo a programas de la selección guardada. El proceso vivo gobierna la **existencia de la fila**: abrirse la crea con sesión nueva, cerrarse la cierra, la persiste en `usage-log.txt` y saca la fila del listado visible.
- **Dos eventos sacan la fila del listado visible, con el mismo efecto**: el usuario presiona ■, o el proceso se cierra. En ambos casos se cierra la sesión, se escribe al log y se quita la fila, sin sacar el programa de la selección guardada.
- **Selector de apps instaladas** (Windows), con el criterio de aceptación de calidad de listado descrito más abajo.
- **Íconos automáticos B/N**: `app.getFileIcon(exePath)` en main → `toDataURL()` por IPC → render con `filter: grayscale(1)`. Reemplaza el mapeo estático `require('@/assets/{app}.png')`.
- **Store Pinia de apps monitoreadas** con límite duro de 4 programas simultáneos, y la UI multi-programa dentro del widget.
- **Pantalla de Opciones** nueva, accesible desde el ícono `faGear` de `TitleBar.vue` (ya importado y sin uso), con control de volumen persistido con el mismo patrón IPC + JSON que usa el Pomodoro.
- **Fix del flash blanco**: `backgroundColor: '#1b1b1b'` + `show: false` / `ready-to-show` en la `BrowserWindow` de historial, más el color de fondo inline en `public/history.html`.

**Excluye explícitamente** (decilo si querés alguno adentro):

- **Deuda de Electron Forge**: `forge.config.js` y los scripts `start`/`package`/`make` quedan tal cual, sin funcionar. El flujo activo sigue siendo `vue-cli-plugin-electron-builder`.
- **`src/utils/stateManager.js`**: no se toca ni se borra, aunque parece código muerto.
- **Unificación del modal duplicado**: el picker de `TitleBar.vue` (pin sobre app) sigue con su propio código. Solo se reescribe el picker del widget Aplicación, porque cambia de función.
- **Soporte macOS/Linux**: la detección ya es Windows-only hoy y sigue siéndolo.
- **Apps de la Microsoft Store (UWP)**: quedan fuera del selector de instaladas. No tienen `.exe` resoluble, así que no hay ícono que extraer ni proceso que detectar con el mecanismo actual.
- **Formato de `usage-log.txt`**: se mantiene tal cual (una línea por sesión, ya lleva el nombre de la app), sin migración de datos históricos.
- **Tests automatizados y CI**: no se agregan en este cambio.
- **Sistema de tokens/design system**: se respetan los estilos `scoped` actuales, sin introducir variables CSS compartidas.
- **Rediseño de `HistoryView.vue`**: solo el fix del destello, no cambios de contenido ni vista multi-app en el calendario.

## Approach Propuesto

El eje del cambio es un solo refactor del motor de monitoreo en el main process, del que dependen cuatro de las seis features. Hoy `background.js` sostiene literalmente una variable global por app monitoreada, así que multi-programa, auto-stop por proceso y la salida de fila no son features separables: las tres exigen el mismo cambio de modelo. Sobre ese motor se apoyan después los íconos y el selector de instaladas, mientras que volumen y fix del calendario se trabajan en paralelo porque no lo tocan.

### Alcance de SO — Windows-first explícito

Todo el código de detección ya es Windows (`Get-Process` vía PowerShell) y la enumeración de instalados solo tiene camino razonable en Windows. Los makers darwin/deb/rpm de `forge.config.js` son intención declarada, no soporte real: el toolchain de Forge ni siquiera compila el renderer. Abrir una rama por SO ahora duplicaría la superficie de la feature más riesgosa sin un usuario que la pida. La mitigación es barata: todo lo dependiente de SO vive en un módulo único, de modo que agregar macOS mañana sea aditivo.

### Semántica del conteo

**Todas las filas del listado se muestran siempre; el reloj de la fila que tiene el foco avanza; las demás se muestran en pausa.** Es la misma semántica que la app tiene hoy con una sola app —poner Chrome y que sume solo cuando realmente estás en Chrome—, extendida a varias filas visibles al mismo tiempo.

Se separan dos ejes que hoy están enredados en las mismas variables, y cada uno gobierna una cosa distinta:

- El **proceso vivo** define si la fila existe, y con ella la sesión: el programa abre su fila y su sesión al abrirse, y al cerrarse la sesión se cierra —persistiéndose en `usage-log.txt`— y la fila sale del listado.
- El **foco** define cuál de las filas presentes acumula en este segundo.

Cada eje tiene un único efecto: existencia el primero, estado el segundo. Ninguna fila visible tiene el proceso cerrado, así que el estado nunca depende de la señal de proceso.

### Selección guardada y listado visible

Son dos cosas distintas y conviene nombrarlas por separado, porque la salida de una fila actúa sobre una y no sobre la otra:

- La **selección guardada** es el conjunto de programas que el usuario eligió (por el selector de instaladas o manualmente). Persiste entre sesiones de la app.
- El **listado visible** son las filas que el widget muestra en este momento. Una fila entra al listado al agregar el programa, o cuando un programa de la selección guardada se detecta abierto. Sale del listado cuando el usuario presiona ■ o cuando su proceso se cierra.

Un programa puede estar en la selección guardada sin tener fila. Eso es exactamente lo que producen el ■ y el cierre del proceso.

### Los dos estados por fila

| Estado | Condición | El reloj | Indicador |
|--------|-----------|----------|-----------|
| **corriendo** | la fila está en el listado y el programa tiene el foco | avanza | glifo play |
| **pausado** | la fila está en el listado y el programa no tiene el foco | quieto | glifo pausa |

Toda fila del listado tiene su proceso vivo: es condición de existencia, no de estado.

Transiciones:

- `corriendo → pausado`: el programa pierde el foco.
- `pausado → corriendo`: el programa gana el foco.
- **Entrada al listado**: el usuario agrega el programa, o un programa de la selección guardada pasa de cerrado a abierto. La fila entra en `corriendo` si tiene el foco en ese instante, en `pausado` si no.
- **Salida del listado**: el usuario presiona ■, o el proceso del programa se cierra. No es un estado: la fila deja de existir.

No hay un tercer estado. Ni el ■ ni el cierre del proceso producen un estado nuevo: producen la salida de la fila, y el conteo lo gobierna el foco sin excepciones. Eso es lo que permite modelar el motor como una máquina de dos estados en la que **el estado de una fila viva es función directa de una sola señal (el foco)**, mientras la otra señal observable (proceso vivo) decide únicamente si la fila está o no en el listado.

**Una sola lista.** El listado del usuario *es* el listado de arranque automático: todo programa de la selección guardada abre su fila solo cuando se abre. No se introduce un flag por programa para distinguir "automático" de "manual".

### Qué saca una fila del listado

**Dos eventos sacan la fila, y hacen exactamente lo mismo**: el usuario presiona ■, o el proceso del programa se cierra. En ambos casos, en un solo gesto: se cierra la sesión en curso, se escribe su línea en `usage-log.txt` y se quita la fila. El widget se reacomoda y la ventana se redimensiona. La única diferencia entre ambos es quién los dispara: uno es intención del usuario, el otro es el ciclo de vida del proceso.

**El programa sigue en la selección guardada en los dos casos.** Cuando ese programa se abre de nuevo, su fila reaparece sola y su reloj arranca en `00:00:00`. Es lo que concilia los requisitos que venían de iteraciones distintas: cerrar el programa y presionar ■ cortan de verdad —no congelan ni dejan una sesión colgada— y el auto-reinicio por ciclo de vida del proceso se conserva sin necesidad de volver a agregar el programa con el `+`.

Para sacar un programa de la selección guardada —que deje de reaparecer— el gesto es el mismo que para agregarlo: el modal del `+`, donde queda desmarcado.

**Estado vacío.** Al salir la última fila —por ■ o por cierre de proceso—, el widget vuelve a verse como hoy sin programas: un `00:00:00` y el `+`. No se muestra ningún mensaje ni ilustración; es el mismo reposo que la app tiene hoy al arrancar, y era lo pedido explícitamente ("si solo quedaba un programa sí dejalo en 0 todo").

### Persistencia: una sesión por aparición de fila

El reloj de una fila muestra **el tiempo acumulado de la sesión en curso**, es decir desde que esa fila apareció — no el acumulado del día. La regla es una sola y cubre todos los casos:

| Evento | Sesión | Reloj de la fila |
|--------|--------|------------------|
| La fila aparece (agregada o proceso abierto) | se abre una sesión | arranca en `00:00:00` |
| El programa tiene el foco | la sesión acumula | avanza |
| El programa pierde el foco | la sesión sigue abierta, sin acumular | quieto |
| El proceso se cierra | la sesión se cierra y se escribe al log | la fila desaparece |
| El usuario presiona ■ | la sesión se cierra y se escribe al log | la fila desaparece |
| El proceso se vuelve a abrir | reaparece la fila con una sesión nueva | arranca en `00:00:00` |

Una sesión se escribe en `usage-log.txt` en los dos únicos casos que la cierran, que son también los dos que sacan la fila: **el proceso se cierra** o **el usuario presiona ■**. El formato del archivo no cambia (una línea por sesión, con el nombre de la app), así que un programa usado en varios tramos produce varias líneas del mismo día. No molesta: el historial ya agrega por día y por app, y N líneas suman igual que una.

La consecuencia de mostrar la sesión y no el día es que el widget deja de ser el lugar donde se lee el total diario; ese total vive en el historial, que ya existe y ya agrega. El widget responde "cuánto llevo en esto ahora", que es la pregunta que se hace mirando la fila.

### Calidad del listado de instaladas — criterio de aceptación

Pediste separar procesos random de aplicaciones reales (Discord, Clip Studio). Eso deja de ser una mitigación y pasa a ser criterio de aceptación: **un listado que muestre runtimes, actualizadores, redistribuibles o servicios de fondo no cumple.**

La heurística propuesta invierte la fuente habitual. En vez de leer las claves `Uninstall` del registro y después tratar de filtrar la basura, se enumera desde **los accesos directos del Menú Inicio**:

- `%ProgramData%\Microsoft\Windows\Start Menu\Programs` (todos los usuarios)
- `%APPDATA%\Microsoft\Windows\Start Menu\Programs` (usuario actual)

El razonamiento: un `.lnk` en el Menú Inicio es la señal más fuerte de "aplicación de usuario" que existe en Windows, porque es exactamente lo que el instalador decidió que un humano tiene que poder abrir. Discord y Clip Studio ponen uno; los redistribuibles de Visual C++, los actualizadores y los runtimes no. Es la diferencia entre filtrar ruido y no producirlo.

Cada `.lnk` se resuelve a su ejecutable con `WScript.Shell.CreateShortcut(...).TargetPath` vía PowerShell —el mismo mecanismo que la app ya usa para `Get-Process`, sin dependencias nativas nuevas— y eso entrega de una sola pasada las tres cosas que el resto de las features necesitan: el **nombre legible** (el del acceso directo: "Clip Studio Paint", no `CLIPStudioPaint_1.13.2`), la **ruta del ejecutable** (que alimenta tanto `app.getFileIcon` como el match de proceso) y la **identidad** para deduplicar. Una fuente, tres consumidores.

Se descarta, con el motivo:

| Se descarta | Por qué |
|-------------|---------|
| Accesos directos que no resuelven a un `.exe` existente | Sin ejecutable no hay ícono ni proceso detectable: la fila no podría funcionar |
| Targets bajo `\Windows\`, `\System32\`, `\WinSxS\` | Herramientas del sistema, no aplicaciones que el usuario cronometre |
| Subcarpetas `Accessories`, `Administrative Tools`, `Windows Tools`, `Windows PowerShell`, `Startup` | Son el cajón de herramientas del SO, no apps de usuario |
| Ejecutables cuyo nombre matchea `*update*`, `*setup*`, `*install*`, `unins*`, `*crashpad*`, `*helper*`, `*service*` | Actualizadores, instaladores y procesos auxiliares |
| Entradas con `SystemComponent = 1` en su clave `Uninstall` | Es la marca con la que Microsoft indica "no mostrar al usuario"; captura redistribuibles y piezas de sistema que igual dejaron acceso directo |
| Entradas con `ParentKeyName` / `ParentDisplayName`, `ReleaseType` de update/hotfix, o nombre tipo `KB######` | Parches colgados de un producto padre |
| Apps de la Microsoft Store (UWP) | No exponen `.exe` resoluble; quedan fuera de scope declarado |

El registro sigue usándose, pero **como enriquecimiento, no como fuente**: aporta `Publisher` (útil para mostrar y desempatar homónimos) y la marca `SystemComponent` para descartar. La consulta se hace por ruta de ejecutable o por nombre, sobre las tres raíces habituales (`HKLM`, `HKLM\WOW6432Node`, `HKCU`).

El sesgo es deliberadamente hacia el falso negativo: es preferible que se escape una app portable sin acceso directo —que igual podés agregar desde el listado de procesos abiertos, que se conserva como segunda vía— a que aparezcan 400 filas de ruido. Se suma un buscador por texto en el modal.

**Cómo se verifica**: con Discord y Clip Studio instalados, ambos aparecen en el listado; y una revisión del listado completo no encuentra ninguna entrada de categoría runtime, redistribuible, actualizador o servicio de fondo.

### Límite de programas simultáneos — 4

La fila mide 50px (es la altura que `.controls` ya tiene hoy); con el encabezado, el widget llega a unos 210px con 4 programas. La ventana se redimensiona sola en `Menu.vue` y el menú usa `scroll-snap-type: y mandatory`, donde cada widget es un punto de anclaje: si el widget Aplicación supera el alto de un viewport de snap, el snap deja de leerse como "un widget por pantalla" y la interacción se rompe. Con 4 el widget convive con Manual y Pomodoro sin scroll interno. 4 también es coherente con el uso real: monitorear más de cuatro programas a la vez es supervisión, no cronometraje.

### Volumen — dos controles

Un master global (`Howler.volume()`) que baja todo, y un control separado para los sonidos de interacción (`add`, `popUp`, `pressButton`, `deleteItem`) relativo al master. La alarma de fin de sesión (`endSession`) queda solo bajo el master. El motivo es funcional: la alarma es una señal que tiene que escucharse, los clics son decoración y son justamente lo que se quiere bajar sin perder la alarma. Un control único obligaría a elegir entre "silencio" y "alarma audible". Dos sliders, una sola implementación.

### Presentación multi-programa

El punto de partida es la fila que ya existe, no una fila nueva. Hoy `.controls` es un flex de 50px con `+` · [slot de ícono de 32px] · `00:00:00` (`.display`, 2rem, ancho fijo `8ch`) · ■ · ▶. Esa fila se repite hacia abajo, una por programa del listado, hasta 4.

**La fila final es**: logo B/N · nombre · reloj · indicador ▶/⏸ (no interactivo) · ■ (único botón de la fila).

**El `+` sube al encabezado, esquina superior derecha.** Es la única acción del widget que no pertenece a ningún programa, así que no tiene sentido repetida por fila. Arriba a la izquierda ya vive el botón de historial (`.button-history`, posicionado con `position: absolute; left: 0; top: 0`) y al centro el título "Work": la esquina superior derecha es el espejo exacto de ese patrón, se implementa con la misma regla cambiando `left` por `right`, deja el título centrado intacto y —clave— **queda fija mientras la lista crece hacia abajo**, así que su posición no se mueve al agregar o quitar programas. Al llegar a 4 se atenúa y deja de responder.

**El logo B/N ocupa el slot que deja el `+`.** El componente ya tiene `.app-icon-inline` a 32px inmediatamente después del `+`; sacando el `+`, el ícono pasa a ser el primer elemento de la fila sin mover nada más. Se renderiza con `filter: grayscale(1)`, con `idk.png` de fallback.

**El nombre va a la derecha del logo, en la misma línea**, a 1rem en "Architects Daughter" (el tamaño que `.selected-app` ya declara), alineado a la izquierda, truncado con elipsis, dentro de un bloque de **ancho fijo**. El ancho fijo es lo que hace que la lista se lea como lista: todos los relojes quedan alineados en columna sin importar el largo de los nombres, y el `8ch` del `.display` se conserva tal cual. Con un solo programa el widget se ve casi igual que hoy.

**Los dos estados se distinguen sin color de acento**, respetando el tema plano (`#0f0f0f`, texto `#e7e7e7`/`#f0f0f0`):

- **corriendo**: fila a contraste pleno (logo al 100%, reloj `#f0f0f0`), indicador con glifo de play. La señal principal es que los dígitos se mueven.
- **pausado**: logo, nombre, reloj e indicador atenuados (~55%), reloj quieto, indicador con glifo de pausa. Se lee como "está abierto, esperando que vuelvas".

El ■ mantiene contraste pleno en ambos estados: es un control siempre disponible y su disponibilidad no depende del estado de la fila.

#### El indicador ▶/⏸ no puede parecer un botón

Es la decisión de diseño más delicada de la fila. Hoy ▶ y ■ son dos botones de aspecto idéntico —mismo tamaño, mismo color, mismo `scale(1.2)` al hover— y a partir de ahora uno es el único control de la fila y el otro es un dato. Si conservan el mismo aspecto, el usuario va a intentar clickear el indicador; con el ■ al lado sacando la fila, un click equivocado en la vecindad tiene costo, aunque acotado: la sesión queda escrita en el log y la fila vuelve sola la próxima vez que el programa se abra.

Sacarle el `@click` no alcanza: un glifo de play del tamaño de un botón, junto a un botón, se lee como botón. La resolución combina cuatro movimientos, todos dentro del tema plano y sin introducir color de acento:

1. **Reagrupar por proximidad.** El indicador se pega al reloj, sin separación, formando un solo bloque de lectura ("cuánto llevás" + "está corriendo o no"); el ■ se va al borde derecho de la fila, separado por un gap explícito. Lo que está junto al dato se lee como dato; lo que está aislado en la zona de acción se lee como acción. Es el movimiento más barato y el que más trabaja: la agrupación se percibe antes que cualquier detalle del glifo.
2. **Bajar escala y peso.** El glifo del indicador cae a ~12px contra los 18px del ■, y toma el color del reloj de su propio estado en vez de un color propio. En un tema sin acentos, tamaño y contraste son los dos ejes disponibles, y un glifo notoriamente más chico que el botón vecino ya no compite por ser presionado.
3. **Sacar el área y todo el feedback.** Sin padding ni caja propia, `cursor: default`, `pointer-events: none`, sin hover, sin `scale(1.2)`, sin `:active`. El hover es donde el usuario verifica la hipótesis "esto es un botón"; si el puntero no cambia y nada se mueve, la hipótesis muere en el primer intento y no se repite.
4. **Cambiar el texto accesible de acción a estado.** El ■ lleva `title="Quitar del listado"` —verbo, acción. El indicador lleva `aria-label`/`title` de estado: "Contando" / "En pausa" —sin verbo imperativo. Además de accesibilidad, es coherencia: si el tooltip dice qué es y no qué hace, el elemento no promete interacción.

Alternativas consideradas y descartadas: reemplazar el glifo por un punto o LED (más inequívoco como indicador, pero perdés el par play/pausa que pediste explícitamente y que ya es vocabulario de la app); usar color para marcar "corriendo" (rompe el tema plano y agrega un acento que hoy no existe en ninguna parte); dejar el ▶ como botón deshabilitado (sigue siendo un botón, y uno roto: comunica "podrías, pero no").

## Esfuerzo Estimado

**XL** — Son seis features sobre un mismo componente y un mismo main process, con un refactor de modelo de estado de por medio (mono-app con "hay intervalo / no hay intervalo" → multi-app con máquina de dos estados y ciclo de vida de fila, en renderer *y* en main), dos superficies IPC nuevas (extracción de íconos, enumeración de instalados), una pantalla de la app que hoy no existe (Opciones) con su propia persistencia, y cero infraestructura de tests para respaldar el refactor. Las features baratas (volumen S, íconos S, flash XS) no compensan que el núcleo (features 2, 3, 4 y 5 juntas) sea L por sí solo. El selector de instaladas se mantiene dentro del cambio, como pediste.

Que el estado dependa de una sola señal baja el riesgo del refactor pero no la estimación: el costo estaba en pasar de estado global único a estado por app con dos señales que hay que observar igual —proceso para la existencia de la fila, foco para su estado—, no en la cantidad de estados.

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| El refactor del motor mono-app → multi-app con dos estados introduce regresiones en el conteo, que es la función central | Alta | Alto | Aislar el refactor como primera fase entregable y verificable sola; estado de fila viva dependiente solo del foco y proceso vivo como condición de existencia; transiciones y ciclo de vida de fila enumerados; guion de verificación manual por transición y por entrada/salida |
| Sin tests automatizados ni CI: toda verificación es manual sobre 6 features | Alta | Alto | Guion manual reproducible por fase; extraer lógica pura (formateo, acumulación, estados, filtrado) a funciones testeables |
| El listado de instaladas no separa apps de usuario de runtimes, updaters y servicios — es criterio de aceptación | Media | Alto | Enumerar desde accesos directos del Menú Inicio y resolver a `.exe`; tabla de descartes explícita; buscador; procesos abiertos como segunda vía |
| El usuario intenta clickear el indicador ▶/⏸ porque hoy es un botón | Media | Bajo | Agruparlo con el reloj y alejarlo del ■; escala y contraste menores; sin área de click, hover ni cursor; texto accesible de estado. Si el click cae en el ■, la sesión queda en el log y la fila vuelve sola al reabrir el programa |
| `app.getFileIcon` devuelve ícono genérico o de baja resolución en algunos ejecutables | Media | Bajo | Mantener `idk.png` como fallback y cachear el dataURL por ruta |
| `resizeWindow()` se comporta mal con el widget de alto variable | Media | Medio | Fila de alto fijo (50px), límite duro de 4 apps, recálculo explícito en cada entrada y salida de fila —incluida la salida por cierre de proceso— y en el paso al estado vacío |
| Windows-first deja sin camino los makers darwin/deb/rpm | Baja | Medio | Aislar el código dependiente de SO en un módulo único del main process |

## Secuencia de Trabajo Propuesta

1. **Independientes, en paralelo desde el arranque**: fix del flash blanco del calendario (XS) y Opciones + volumen (S). No tocan el motor, se verifican de inmediato y dan valor visible temprano.
2. **Motor multi-app en el main process**: mapa por app, contrato IPC `app-active` con `appName`/`pid`, máquina de dos estados gobernada solo por el foco, ciclo de vida de fila (entra por agregado o proceso abierto; sale por ■ o por cierre de proceso, con el mismo efecto en ambos), chequeo de proceso vivo separado del foco y usado como condición de existencia de la fila, escritura al log en los dos eventos de salida, y la restricción de que solo se procesan programas de la selección guardada. Es la base de las features 2, 3, 4 y 5. Se verifica todavía con una sola app monitoreada, para aislar regresiones antes de sumar UI.
3. **Store Pinia + UI multi-programa** en el widget: fila repetida, `+` al encabezado, los dos estados visuales, el indicador ▶/⏸ no interactivo, el ■ como único botón de fila, salida de fila por ambos eventos, estado vacío, límite de 4 y resize de `Menu.vue` ajustado.
4. **Íconos automáticos B/N**, ya con el modelo por app en pie (cada fila trae su `exePath`, que es de donde sale el ícono).
5. **Selector de apps instaladas + auto-arranque**, último por ser lo más caro y lo que más se beneficia de que todo lo anterior esté estable. Se cierra con la verificación del criterio de calidad del listado.

## Trade-offs

- **A favor**: se resuelve la causa raíz de la pausa que no funciona (hoy hay dos mecanismos desacoplados peleando por las mismas variables) en vez de parchear el síntoma; los íconos dejan de ser mantenimiento manual del desarrollador; el motor queda con un modelo que soporta crecer.
- **A favor**: cada señal observable gobierna una sola cosa — el foco determina el estado de una fila viva, el proceso vivo determina si la fila existe. El estado deja de depender de dos señales combinadas, no hay flags de runtime que persistir ni limpiar, y ninguna fila visible puede quedar con el proceso cerrado. Es la versión más simple del motor que cumple lo pedido, y la más fácil de verificar a mano.
- **A favor**: la fila repetida y la enumeración por Menú Inicio reutilizan estructura que ya existe (`.controls` con su slot de ícono, el patrón de esquina absoluta de `.button-history`, PowerShell como puente al SO), así que el costo está en el motor y no en inventar UI ni dependencias.
- **En contra**: es un cambio grande sin red de tests, sobre el componente más crítico de la app. Cuatro de las seis features no son entregables por separado: o se hace el refactor del motor, o no se hace ninguna de ellas.
- **En contra**: el reloj de la fila muestra la sesión en curso y no el total del día, así que para saber cuánto llevás en Chrome hoy hay que abrir el historial. Es lo pedido ("queda en cero y ya") y es coherente con la salida de fila, pero implica que el widget no responde la pregunta del día.
- **En contra**: las filas aparecen y desaparecen solas. El listado se reacomoda —y la ventana se redimensiona— sin que el usuario toque nada, cada vez que abre o cierra uno de sus programas. Es la contracara de que el ciclo de vida del proceso gobierne la existencia de la fila, y exige que el recálculo de tamaño sea confiable también fuera de la interacción directa.
- **En contra**: el ■ no tiene confirmación y convive con un indicador de aspecto vecino, así que un click accidental es posible. El costo es bajo: hace lo mismo que cerrar el programa —cierra y registra la sesión— y la fila vuelve sola la próxima vez que el programa se abra, así que no hay pérdida de datos ni hay que volver a agregar el programa. Lo que se pierde es el tramo en curso, que queda partido en dos líneas del log en vez de una.
- **En contra**: el sesgo del filtrado hacia el falso negativo significa que alguna app instalada legítima puede no aparecer en el selector (portables, o instaladores que no dejan acceso directo). Se compensa con la vía de procesos abiertos, pero es una limitación real y asumida a cambio de que el listado sea usable.
- **En contra**: Windows-first cierra explícitamente lo que `forge.config.js` insinúa. Es una decisión consciente, no un olvido.
