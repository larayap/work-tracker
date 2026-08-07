---
type: adr
title: "El traspaso de userData al renombrar la identidad se decide archivo por archivo, con copia atómica y origen intacto"
status: accepted
supersedes: null
superseded_by: null
amends: null
created: "2026-08-06"
change_ref: "[[open-source-readiness]]"
capability: "userdata-migration"
tags: [adr]
---

# El traspaso de userData al renombrar la identidad se decide archivo por archivo, con copia atómica y origen intacto

## Context

El producto se rebautiza como **Work Tracker** y `package.json.name` pasa de `cronometro-apps` a
`work-tracker`. Ese campo, y no `productName`, es el que determina `app.getPath('userData')`:
verificado extrayendo el `package.json` del `app.asar` instalado —declara `name: "cronometro-apps"`
y no tiene `productName`— y confirmado en el código del plugin, que copia el `package.json` del
proyecto al paquete sin inyectar campos (`vue-cli-plugin-electron-builder/index.js:159-173`).

Renombrar `name` reapunta la persistencia completa: la aplicación nueva mira
`%APPDATA%/work-tracker` mientras todos los datos del usuario siguen en
`%APPDATA%/cronometro-apps`. Hay base instalada real —releases `v.1.0.0` (11 descargas) y `v1.0.1`
(1)— y el historial de uso no se puede reconstruir. El instalador además deja Work Tracker
**junto a** Workout en vez de reemplazarlo, así que ambas identidades pueden convivir en el mismo
equipo.

El proyecto ya tiene un precedente de migración one-shot:
[[0007-structured-sessions-json-with-one-shot-migration]] fija el protocolo de tres pasos que
convierte `usage-log.txt` en `sessions.json`, con tres propiedades declaradas —one-shot,
idempotente y no destructiva— y publicación por renombre de un archivo ya completo.

Un hecho verificado impide traducir ese protocolo de forma literal: **Electron crea y puebla el
`userData` nuevo con estado propio de Chromium (`Cache/`, `Preferences`, `Local Storage/`) antes
de `whenReady`**. Una condición "si el directorio destino ya existe, no migrar" —el paso 1 de
ADR-0007 leído textualmente— nunca dispararía, y la migración sería código muerto que nadie
notaría hasta que un usuario reportara su historial vacío.

## Decision

El traspaso vive en **`src/main/userdata-migration.js`**, un módulo que solo usa `fs` y `path` del
núcleo de Node y que recibe las rutas por parámetro:
`migrateUserDataAt({ sourceDir, targetDir })`. `src/background.js` resuelve las rutas reales
—`path.join(app.getPath('appData'), 'cronometro-apps')` como origen y `app.getPath('userData')`
como destino— y lo invoca como **primera sentencia de `app.whenReady()`**, antes de
`createTray()`, de `createWindow()` y, por lo tanto, antes de `sessionLog.migrateLegacyLog()` y de
toda lectura de settings, cachés o selección monitoreada.

Es el mismo desdoblamiento de ADR-0007 (`session-log-parser.js` sin `electron` /
`session-log.js` resolviendo rutas) y por el mismo motivo declarado ahí: un módulo libre de
`electron` se puede ejercitar con `node -e`, que en este entorno de desarrollo (WSL2, sin build
posible) es la única verificación disponible.

**La condición es por archivo, no por directorio.** Se traspasan exactamente los ocho archivos que
la aplicación posee bajo `userData`, verificados uno a uno contra el código:

| Archivo | Dueño |
|---|---|
| `sessions.json` | `src/main/session-log.js:21` |
| `usage-log.txt` | `src/main/session-log.js:25` |
| `usage-log.txt.bak` | `src/main/session-log.js:29` |
| `settings.json` | `src/main/ipc-handlers.js:15` |
| `monitored-selection.json` | `src/main/monitor-engine.js:451` |
| `installed-apps-cache.json` | `src/main/installed-apps.js:29` |
| `app-icons-cache.json` | `src/main/icon-cache.js:93` |
| `pomodoro-sessions.json` | `src/background.js:212` |

**Cada archivo se copia solo si no existe en el destino.** De ahí salen, por construcción, las
tres propiedades de ADR-0007 y una cuarta regla que ADR-0007 no necesitaba enunciar: cuando ambas
identidades tienen datos, **el destino gana, archivo por archivo, sin fusión ni sobreescritura**.

La copia es atómica por archivo: `fs.copyFileSync(source, target + '.migrating')` seguido de
`fs.renameSync` sobre el destino final, el mismo patrón que `json-store.js::writeJsonAtomic` y que
la publicación de `sessions.json` en ADR-0007. El archivo destino solo aparece completo; no existe
ningún instante en que un lector vea un JSON a medio copiar. Un temporal sobreviviente a una
interrupción se sobrescribe y se renombra en el arranque siguiente, así que el estado se
autolimpia sin código de limpieza.

**El origen nunca se toca**: solo `existsSync` y lectura. No hay `unlink`, ni `rename`, ni
escritura sobre `%APPDATA%/cronometro-apps`, que queda como respaldo permanente.

**Los errores no interrumpen el arranque.** `migrateUserDataAt` nunca lanza: envuelve cada archivo
en su propio `try/catch`, devuelve `{ copied, skipped, failed }` y el llamador registra el
resultado por consola. Un archivo que falla deja el destino ausente, así que el arranque siguiente
lo reintenta solo. Es la misma tolerancia que ADR-0006 fijó para la lectura de JSON.

**Dos condiciones que esta decisión omitía y que sdd-judgment (iteración 1) incorporó** — las dos
nacen del mismo hecho: `usage-log.txt` es el único de los ocho archivos con un consumidor que lo
muta dentro del mismo arranque (el paso 3 de ADR-0007 lo renombra a `usage-log.txt.bak`).

1. **El reintento automático exige que ADR-0007 no publique un `sessions.json` vacío.** El paso 1
   de ADR-0007 lo publicaba aunque no hubiera nada que migrar, y ese archivo vacío bloquea la
   absorción para siempre. Un fallo transitorio al copiar `usage-log.txt` en el primer arranque
   se volvía así pérdida permanente de visibilidad del historial. `session-log.js::migrateLegacyLog()`
   pasa a correr el protocolo de ADR-0007 **solo cuando existe un `usage-log.txt` que migrar**;
   `jsonStore.readJson` ya tolera el archivo ausente, así que el resto de la aplicación no nota
   la diferencia. Residuo aceptado: si el fallo coincide con un arranque en que el usuario cierra
   alguna sesión, `appendSessions` crea el `sessions.json` y el log que llegue después no se
   absorbe — mismo caso que el tercer trade-off de más abajo, con la misma recuperación manual.
2. **La condición de traspaso de `usage-log.txt` mira también su `.bak`.** Preguntando solo por
   `usage-log.txt`, el arranque siguiente al traspaso lo encontraba ausente del destino —ADR-0007
   ya lo había renombrado— y lo volvía a copiar: el traspaso dejaba de ser one-shot y el destino
   quedaba con el log duplicado. La presencia del `.bak` en el destino es evidencia de traspaso
   consumado tanto como la del log mismo.

**El estado de Chromium no se copia**: es estado regenerable de otra identidad de aplicación.

**Invariante que esta decisión impone al resto del proyecto**: `package.json` **no declara
`productName`**. `app.getName()` lo prefiere sobre `name`, así que agregarlo movería el `userData`
a `%APPDATA%/Work Tracker` y dejaría huérfano este traspaso. El nombre visible del producto vive
solo en `builderOptions` de `vue.config.js`.

**Techo sintáctico**: el módulo entra al bundle del main process, que arma un webpack 4.47.0 con
acorn 6.4.2 anidados y sin loader de Babel. Se escribe con la sintaxis ya presente en
`src/main/*.js` y sin `??` ni `?.`.

## Consequences

**Positivas:**

- Quien viene de la identidad anterior conserva historial, preferencias, selección guardada,
  sesiones de pomodoro y cachés sin hacer nada, y las dos migraciones se encadenan en el mismo
  arranque: el `usage-log.txt` traído se parsea acto seguido por el protocolo de ADR-0007.
- El directorio viejo sobrevive como respaldo verificable a mano, que es el modo de verificación
  del proyecto mientras no haya tests.
- La regla "el destino gana" es total: no hay caso sin definir, ni fusión que inventar, ni orden
  de precedencia que recordar.
- La lógica queda ejercitable con `node -e` sobre directorios temporales, así que los seis
  escenarios de la spec se verifican de forma determinista sin compilar la aplicación.
- Un fallo parcial se cura solo en el arranque siguiente, sin marcas de estado ni banderas
  persistidas.

**Trade-offs:**

- Quedan dos directorios en `%APPDATA%` y nadie limpia el viejo. Es el mismo costo que ADR-0007
  aceptó con `usage-log.txt.bak`, y el precio de no destruir nada.
- La lista de ocho archivos es explícita: un archivo nuevo bajo `userData` que se agregue en el
  futuro y no se sume a `OWNED_FILES` no se traspasa. Se prefiere sobre copiar el directorio
  entero, que arrastraría el estado de Chromium de otra identidad.
- Existe un caso en que el usuario no ve su historial aunque nada se pierda: si el destino ya
  tiene un `sessions.json` (por ejemplo, porque se abrió la versión nueva antes de instalar) y el
  origen solo tiene `usage-log.txt`, ese `usage-log.txt` se copia y ADR-0007 lo renombra a `.bak`
  sin parsearlo, porque `sessions.json` ya existe. Los datos siguen en el origen intacto y en el
  `.bak`, pero recuperarlos exige acción manual. Es la consecuencia directa de "el destino gana" y
  se acepta: la alternativa —acoplar la decisión de `usage-log.txt` a la de `sessions.json`—
  reintroduciría la fusión que esta decisión elimina.
- Dos instancias simultáneas de la aplicación escribirían el mismo temporal. El resultado sigue
  siendo un archivo completo, porque solo un renombre publica y ninguno publica contenido parcial,
  pero la aplicación no toma un lock de instancia única.

## Alternatives Considered

- **Condición por directorio** (traducción literal del paso 1 de ADR-0007): "si
  `%APPDATA%/work-tracker` no existe, copiar todo". Es la lectura natural del precedente y **está
  muerta desde el primer arranque**: Electron ya creó y pobló ese directorio antes de `whenReady`.
  El modo de falla es silencioso —código que nunca corre, sin error visible— y el síntoma solo
  aparece en la máquina de un usuario con datos.
- **Migración destructiva (mover el directorio o borrar el origen al terminar)**: deja `%APPDATA%`
  limpio, sin el directorio huérfano. Se descarta porque elimina el respaldo justo en la operación
  que puede destruir datos irrecuperables, y porque una interrupción a mitad de un movimiento deja
  el conjunto partido entre dos ubicaciones sin forma de saber cuál manda.
- **Fusionar contenidos cuando ambos directorios tienen datos**: parece más "completo". Se
  descarta porque fusionar exige decidir, por cada archivo, qué gana —¿el más reciente? ¿el más
  largo?— y en el historial la fusión significa mezclar dos arrays de sesiones con `id` generados
  por contadores que reinician en cada arranque, es decir, duplicados imposibles de distinguir de
  sesiones reales. ADR-0007 ya rechazó deduplicar por contenido por el mismo motivo.
- **Copiar el directorio entero de forma recursiva**: menos código que enumerar ocho nombres. Se
  descarta porque arrastra el estado de Chromium de la identidad anterior —`Cache/`,
  `Local Storage/`, `Preferences`, `Network Persistent State`— sobre el que Electron ya escribió en
  el destino: mezclar dos perfiles de Chromium es una fuente de fallos difusos a cambio de cero
  beneficio para el usuario, que no tiene datos propios ahí.
- **No migrar y aceptar la pérdida** (opción C de las clarifications): cero código y cero riesgo de
  implementación. La descartó el usuario en la iteración 1: hay base instalada de terceros y el
  historial no se reconstruye.
- **Congelar `package.json.name` en `cronometro-apps`** (opción A, la recomendada por el pipeline):
  cero pérdida de datos y cero código nuevo, a cambio de una incoherencia permanente entre la clave
  de persistencia y la marca. El usuario eligió la opción B con la consecuencia declarada de relajar
  de forma acotada la invariante "este cambio no modifica el comportamiento de la aplicación".
- **Migrar dentro de `createWindow()` en vez de en `whenReady`**: quedaría junto a
  `sessionLog.migrateLegacyLog()`, que es el otro paso de migración. Se descarta porque
  `createWindow()` es reentrante —lo llaman `whenReady`, `showMainWindow()` y el handler de
  `activate`—, así que el traspaso correría más de una vez por proceso sin ganar nada.
