---
type: adr
title: "Persistencia local en archivos JSON bajo userData, escritos por el main process vía IPC"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-01"
change_ref: "[[app-detection-logos-audio]]"
capability: "app-monitoring"
tags: [adr]
---

# Persistencia local en archivos JSON bajo userData, escritos por el main process vía IPC

## Context

El cambio incorpora tres datos nuevos que sobreviven al cierre de la aplicación: la
selección guardada de programas a monitorear (`row-lifecycle`), los dos niveles de volumen
(`dual-volume-control`) y la caché del listado de aplicaciones instaladas junto con la caché
de íconos por ruta de ejecutable.

El proyecto ya tiene dos mecanismos de persistencia, ambos en el main process y bajo
`app.getPath('userData')`:

- `usage-log.txt` — texto plano, una línea por sesión, appendeado por `save-log-line` y
  parseado con expresión regular por `get-app-logs`.
- `pomodoro-sessions.json` — JSON, escrito por `save-sessions` y leído por `load-sessions`.

No existe `localStorage`, ni `electron-store`, ni ningún archivo de configuración. Hay
además un `src/utils/stateManager.js` que persiste un booleano en un `state.txt` ubicado
junto al propio módulo —dentro del bundle, no en `userData`— sin referencias detectadas en
el resto del código; está registrado como deuda y el cambio lo deja intacto.

## Decision

Todo dato persistente nuevo se guarda como **JSON en un archivo propio bajo
`app.getPath('userData')`**, leído y escrito **exclusivamente por el main process**, y
expuesto al renderer por IPC con el mismo patrón que ya usa el Pomodoro: `invoke` para leer,
`send` para guardar.

Archivos:

| Archivo | Contenido |
|---|---|
| `monitored-selection.json` | selección guardada de programas |
| `settings.json` | volumen maestro y volumen de sonidos de interacción |
| `installed-apps-cache.json` | último listado de aplicaciones instaladas enumerado |
| `app-icons-cache.json` | data URL de ícono por ruta de ejecutable |

Un archivo por concepto, no un archivo de configuración común: cada uno tiene su ciclo de
vida —la selección la edita el usuario, las cachés se regeneran solas— y mezclarlos haría
que regenerar una caché reescriba datos del usuario.

Un helper único de lectura y escritura JSON concentra el manejo de archivo ausente, JSON
corrupto y escritura. La lectura devuelve un valor por defecto ante cualquier fallo, sin
propagar el error: un archivo de caché ilegible se regenera y una selección ilegible arranca
vacía, en ambos casos con la aplicación funcionando.

`usage-log.txt` **conserva su formato actual**, línea a línea, sin migración de datos
históricos. Lo que cambia es quién escribe la línea: pasa del renderer al main process, que
es donde vive la sesión.

Ningún dato de estado en vivo se persiste: las filas del listado visible, el PID y el
acumulado de la sesión en curso existen solo en memoria. Solo persisten la intención del
usuario y las cachés.

## Consequences

**Positivas:**

- Un solo patrón de persistencia en todo el proyecto, el que ya existe, sin dependencias
  nuevas ni una segunda forma de guardar datos que mantener.
- El renderer no toca el sistema de archivos, coherente con que el main process sea la
  fuente de verdad del monitoreo.
- Los archivos son inspeccionables y editables a mano, útil para verificación manual, que es
  la única disponible mientras el proyecto no tenga tests.
- Separar archivos por concepto permite borrar una caché sin tocar la selección del usuario,
  que es el gesto natural de diagnóstico.
- Persistir solo la intención y no el estado en vivo evita el problema de reconstruir sesiones
  colgadas al arrancar: la aplicación arranca sin filas y el motor las produce observando el
  sistema.

**Trade-offs:**

- La escritura sin bloqueo ni escritura atómica admite corrupción si el proceso muere en
  mitad de un `writeFile`. La lectura tolerante lo degrada a "arranca con el valor por
  defecto", que para una caché es intrascendente y para la selección guardada significa
  perderla. El volumen de escrituras es bajo —solo cuando el usuario cambia algo— así que la
  ventana de exposición es angosta.
- Cuatro archivos en `userData` en vez de uno.
- `usage-log.txt` sigue siendo texto plano parseado con expresión regular, con la fragilidad
  que eso implica ante nombres de programa que contengan el separador. Se conserva por
  decisión explícita de alcance: cambiar el formato obligaría a migrar el historial.

## Alternatives Considered

- **`electron-store`**: resuelve escritura atómica, valores por defecto y esquema. Se
  descarta por sumar una dependencia para un problema que el proyecto ya resuelve con
  `fs` y `JSON`, e introducir un segundo patrón de persistencia conviviendo con el del
  Pomodoro.
- **`localStorage` en el renderer**: es lo más corto de escribir. Se descarta porque pondría
  la selección guardada en el proceso que ya no es fuente de verdad, y el motor de monitoreo
  del main la necesita para arrancar antes de que el renderer exista.
- **Un único archivo `settings.json` con todo adentro**: menos archivos. Se descarta porque
  mezcla datos del usuario con cachés regenerables, de modo que refrescar una caché
  reescribe el archivo que contiene la selección.
- **Reutilizar `src/utils/stateManager.js`**: existe y persiste estado. Se descarta porque
  escribe junto al propio módulo en vez de en `userData` —dentro del bundle empaquetado, que
  puede ser de solo lectura— y porque está declarado fuera de alcance como deuda a resolver
  aparte.
- **Persistir el estado en vivo del monitoreo** para restaurar filas al reiniciar: se
  descarta por YAGNI y por coherencia con las specs, que hacen aparecer la fila cuando se
  observa el proceso abierto. Restaurar filas exigiría además validar contra el sistema al
  arrancar, que es lo mismo que el motor hace por su cuenta.
