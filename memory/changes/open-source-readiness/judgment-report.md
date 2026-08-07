---
type: judgment-report
change_name: "open-source-readiness"
verdict: "PASS"
iterations: 2
trigger: "proposal.effort = L (oráculo C2)"
judges: ["Judge A — Correctness & Compliance", "Judge B — Security & Robustness"]
created: "2026-08-06"
tags: [change]
---

# Judgment report — open-source-readiness

**Veredicto global: PASS**, tras dos iteraciones y tres fixes de código.

Dos jueces independientes, sin conocimiento el uno del otro, revisaron el cambio en la
iteración 1. **Ambos encontraron por separado el mismo defecto `critical` y el mismo defecto
`medium`**, con el mismo escenario de falla y la misma causa raíz — la señal más fuerte que
este formato puede producir. El `PASS` de `sdd-verify` era correcto sobre todo lo que había
verificado, pero ejercitó `migrateUserDataAt()` **aislada**; el defecto vive en el
encadenamiento con la migración preexistente de ADR-0007, que corre en el mismo arranque sobre
los mismos archivos.

En la iteración 2, los dos jueces verificaron los fixes de forma adversarial y **ambos
retornaron `pass`**, confirmando que el crítico y el medio quedan cerrados. En esa misma
iteración los dos encontraron —de nuevo por separado— una regresión `low` introducida por el
propio fix, que se corrigió y se verificó.

---

## Causa raíz común

`usage-log.txt` es **el único de los ocho archivos traspasados que tiene un consumidor que lo
muta dentro del mismo arranque**: el paso 3 de ADR-0007 lo renombra a `usage-log.txt.bak`
después de parsearlo, y el paso 1 publica `sessions.json`. El traspaso usaba "el archivo no
está en el destino" como clave de idempotencia, y esa clave la invalida ADR-0007 unos
milisegundos después, en el mismo arranque. Ni el diseño ni el ADR ni la verificación previa
habían modelado esa interacción.

---

## Hallazgos de la iteración 1

### `confirmed` — los dos jueces, por separado

#### C1 · `critical` · Un fallo transitorio al copiar `usage-log.txt` volvía el historial permanentemente inaccesible

`src/main/session-log.js` · `src/main/userdata-migration.js`

Secuencia reproducida por los dos jueces con arneses independientes sobre los módulos reales:

1. **Arranque 1** — el traspaso falla al copiar `usage-log.txt` (EACCES por antivirus, ENOSPC,
   EPERM). El error se captura por diseño, va a `failed`, y **el arranque continúa**.
   `migrateLegacyLogAt` no encuentra log, y el paso 1 de ADR-0007 publica igual
   `sessions.json = []`.
2. **Arranque 2** — el bloqueo ya no está: el log se copia bien. Pero `sessions.json` ya
   existe, así que ADR-0007 **no lo parsea** y lo renombra a `.bak`.
3. Resultado: historial en 0 entradas, de forma permanente, sin reintento posible.

Viola el Requirement `SHALL completar en un arranque posterior cualquier dato que haya quedado
pendiente de traspasar por una interrupción anterior`, el Scenario "El traspaso se interrumpe a
mitad de camino", y falsifica D-5 de `design.md` ("un fallo transitorio se cura solo"). Los
datos no se destruyen —el origen queda intacto— pero el usuario ve su historial vacío y
recuperarlo exige cirugía manual de archivos. **`critical` por operar sobre datos
irreemplazables de una base instalada real.**

#### C2 · `medium` · El traspaso no era one-shot: recopia de `usage-log.txt` en el segundo arranque

`src/main/userdata-migration.js`

En el **camino feliz, sin ningún error**, así que afectaba al 100 % de la base instalada
(origen con `usage-log.txt` y sin `sessions.json`). Arranque 1: se copia el log, ADR-0007 lo
absorbe y lo renombra a `.bak`. Arranque 2: el traspaso lo encuentra ausente del destino y
**lo vuelve a copiar**. El destino queda con el log y su `.bak` de contenido idéntico, de forma
permanente.

Viola el Requirement `SHALL realizar este traspaso como una operación que corre una sola vez` y
el Scenario "Segundo arranque no repite el traspaso" (*"sin alteración ni duplicación"*), ambos
marcados `[x]` por fases anteriores. Efecto de segundo orden: ese log rezagado quedaba como
cebo para ADR-0007 — si el usuario borrara alguna vez su `sessions.json`, el arranque siguiente
resucitaría el historial legado descartando todo lo grabado desde el traspaso.

#### C3 · `low` · `publish.repo` apunta a un repositorio que todavía no existe

`vue.config.js:74` · `package.json`

`publish[0].repo: 'work-tracker'` y `repository: 'github:larayap/work-tracker'`, pero el remoto
real es `larayap/cronometro-app`. El `GITHUB_TOKEN` de Actions está acotado al repositorio que
corre el workflow, así que empujar `v2.0.0` antes de renombrar el repositorio en GitHub gasta
una compilación completa de Windows y recién entonces falla con 404. **No es un defecto de
código: es un prerrequisito operativo**, y está en la lista de acciones para el usuario más
abajo.

### `suspect` — un solo juez

| # | Sev. | Juez | Hallazgo | Resolución |
|---|---|---|---|---|
| S1 | `medium` | A | `verify-report.md` afirma que no hay base instalada real en esta máquina. **Es falso**: `%APPDATA%\cronometro-apps` existe con los 7 archivos de datos reales del usuario. Sobre esa observación falsa descansaba la justificación "PARTIAL por entorno" del nivel 2. | Registrado. El juez sí hizo la verificación de nivel 2 alcanzable y **ambas invariantes quedaron confirmadas empíricamente** (ver abajo), así que la conclusión no cambia. |
| S2 | `medium` | B | `permissions` ausente en `lint.yml` y `persist-credentials` por defecto en ambos checkouts: `npm ci` ejecuta scripts de ~1650 paquetes de terceros con el token en `.git/config`. | **Corregido** (F3). |
| S3 | `medium` | B | Un fallo del traspaso es inobservable en el binario empaquetado: `console.error` no tiene consola en una app NSIS del subsistema GUI, y no hay log persistente. | Documentado, no corregido: añadir logging persistente es maquinaria nueva fuera del alcance. Con C1 cerrado, el reintento sí funciona solo. **Roadmap.** |
| S4 | `medium` | B | Abrir el repositorio publica el correo personal en 83 de 86 commits, la ruta `C:\Users\Luis Araya\...` en `memory/observations.md`, y `/home/larayap/...` en el frontmatter de 30 specs. No hay credenciales ni secretos en ningún blob. | **Decisión del usuario**, no un fix de código. Ver acciones más abajo. |
| S5 | `low` | A | El enlace relativo `../CONTRIBUTING.md` del PR template no resuelve en el cuerpo de un PR (404). | **Corregido** (F5). |
| S6 | `low` | B | Las dos identidades conviven sin aviso: quien siga abriendo la versión vieja fragmenta su historial en silencio. | **Corregido** (F4, sección nueva en `README.md`). |
| S7 | `low` | B | Un `.migrating` que quede como **directorio** bloquea ese archivo para siempre; la afirmación de autolimpieza del ADR es incondicional y no lo es. | Documentado. Probabilidad muy baja, no destructivo, el archivo queda en `failed`. |
| S8 | `low` | B | ADR-0014 no registra que el binario publicado sigue con los fuses de Electron por defecto, y que electron-builder 22 no puede reponerlos (`electronFuses` llegó en v24). Verificado que **no es una regresión**: forge nunca empaquetó, los fuses jamás estuvieron activos. | Documentado. **Roadmap.** |

---

## Fixes aplicados

**Commit `5453d15`** — `fix(userdata): make the legacy log handover truly one-shot and self-healing`

- **F1 (cierra C1)** · `src/main/session-log.js` — `migrateLegacyLog()` ejecuta el protocolo de
  ADR-0007 **solo cuando existe un `usage-log.txt` que migrar**. Publicar un `sessions.json`
  vacío cuando no hay nada que migrar era lo que convertía un fallo de E/S transitorio en
  pérdida permanente. `jsonStore.readJson` ya tolera el archivo ausente (ADR-0006) y
  `appendSessions` lo crea en el primer cierre de sesión, así que el resto de la aplicación no
  nota la diferencia.
- **F2 (cierra C2)** · `src/main/userdata-migration.js` — `isAlreadyInTarget()`: la presencia
  del `.bak` en el destino cuenta como evidencia de traspaso consumado.
- **F3 (cierra S2)** · `permissions: contents: read` en `lint.yml`; `persist-credentials: false`
  en el `actions/checkout` de ambos workflows.
- **F4 (cierra S6)** · `README.md`: sección "Si venís de una versión anterior (Workout)".
- **F5 (cierra S5)** · `.github/PULL_REQUEST_TEMPLATE.md`: enlace absoluto.

**Commit `778328e`** — `fix(userdata): do not read a handed-over .bak as proof the log was handed over`

- **F6 (cierra R1, la regresión de la iteración 2)** · `usage-log.txt.bak` es **también** uno de
  los ocho archivos traspasados, así que un origen con log y respaldo a la vez puede dejar el
  `.bak` en el destino mientras la copia del log falla; F2 leía ese `.bak` recién copiado como
  "ya traspasado" y el log no se reintentaba nunca. El `.bak` ahora cuenta como evidencia
  **solo si el origen no trae un `.bak` propio**.
- **F7** · Precondición del llamador documentada en `migrateLegacyLogAt` mismo, y corrección de
  la descripción del protocolo en ADR-0007 (que seguía diciendo "si falta, el resultado es
  `[]`", ya falso).

También se corrigieron las afirmaciones que los jueces probaron falsas en `design.md` (D-5) y en
ADR-0013, en vez de dejarlas en el registro.

---

## Iteración 2 — verificación adversarial de los fixes

Los dos jueces volvieron a revisar, cada uno con arneses propios, sin conocer el resultado del
otro. **Ambos: `pass`.**

| | Judge A | Judge B |
|---|---|---|
| ¿F1 cierra el crítico? | **sí** | **sí** |
| ¿F2 cierra el medio? | **sí** | **sí** |
| Regresiones | una, `low`, angosta (R1) | ninguna crítica; R1 `low` |

Verificaciones que pasaron limpias en la iteración 2: los 6 Scenarios de la spec de migración;
todos los consumidores de `sessions.json` (ninguno asume que el archivo exista — `readSessions`
y `listSessionDates` operan sobre el array en memoria, y el renderer solo usa IPC); el contrato
"`migrateUserDataAt` nunca lanza" sostenido en 16 estados patológicos de sistema de archivos
(`.bak` como directorio, symlinks colgantes y circulares, `chmod 000`, `.migrating` huérfano
como archivo/directorio/solo-lectura, `sourceDir === targetDir`, tamaño 0); ambos workflows
parsean y ningún paso posterior al checkout necesita credenciales de git; la guarda tag↔versión
sigue antes de compilar y `releaseType: 'release'` sigue en su lugar; techo ES2016 sobre el
cierre transitivo del bundle del main; y `npm run lint -- --no-fix` con exit 0.

### R1 · `low` · `confirmed` — regresión introducida por F2, corregida por F6

Los dos jueces la describieron con el mismo escenario. Corregida en `778328e` y verificada con
un arnés que encadena los dos módulos reales: el reintento vuelve para un origen con ambos
archivos, y el segundo arranque sigue sin recopiar el log para la forma que tiene la base
instalada real. No afectaba a la base instalada (su origen solo tiene `usage-log.txt`).

### Hallazgos `suspect` nuevos de la iteración 2 — no bloqueantes

| # | Sev. | Juez | Hallazgo | Resolución |
|---|---|---|---|---|
| S9 | `medium` | B | `migrateLegacyLog()` no tiene `try/catch`: si `migrateLegacyLogAt` lanza (EPERM/EBUSY del antivirus sobre el archivo recién creado, o dos instancias sin `requestSingleInstanceLock`), la promesa de `createWindow()` se rechaza y el usuario queda con una ventana en blanco. | **Documentado, deliberadamente no corregido.** Un `try/catch` ingenuo cambiaría un fallo visible y auto-recuperable por uno silencioso: hoy la excepción aborta *antes* de `loadSelection()`, así que el motor nunca arranca y ningún `appendSessions` puede escribir. Es comportamiento preexistente; este cambio solo aumenta la exposición. **Roadmap, con el trade-off explícito.** |
| S10 | `low` | A | Con un origen que trae log **y** `.bak`, el destino conserva un `usage-log.txt` sin absorber (el paso 3 de ADR-0007 no renombra si el `.bak` ya está). Es comportamiento preexistente de ADR-0007, no una regresión. | Comentario del fix corregido para no sobrevender el alcance. |
| S11 | `low` | B | El invariante de F1 vive en el llamador mientras `migrateLegacyLogAt` conserva intacta la rama que originó el crítico; en un proyecto sin tests, el único guardián es una línea en otro archivo. | **Corregido** (F7): precondición documentada en la función misma y en ADR-0007. |
| S12 | `low` | B | `design.md` D-11, ADR-0014 y la spec de release no mencionan el endurecimiento de CI de F3; el rationale vive solo en los comentarios del YAML. | Documentado acá. |

---

## Sobre el `PARTIAL por entorno` heredado de `sdd-verify`

`sdd-verify` declaró PARTIAL por entorno el instalador `.exe`, la ejecución real de GitHub
Actions y la migración end-to-end contra una base instalada real. **Son límites de WSL2, no
defectos de código, y no bloquean.** Dos precisiones honestas:

1. **La premisa de uno de esos PARTIAL era falsa** (S1): sí hay base instalada real en esta
   máquina. Judge A la usó y confirmó **empíricamente** dos invariantes que hasta entonces solo
   estaban verificadas por lectura:
   - extrajo el `package.json` del `app.asar` instalado: declara `name: "cronometro-apps"` y
     **no tiene `productName`**, pese a que ese build sí declaraba `productName: 'Workout'` en
     `builderOptions` — confirma que el plugin no lo inyecta y que la clave de `userData` de la
     app instalada será `work-tracker`;
   - contrastó `OWNED_FILES` contra el `%APPDATA%\cronometro-apps` real: los 7 archivos de datos
     presentes están todos en la lista, sin un noveno huérfano.
2. **Lo que sigue sin ejercitarse** es la integración real con `app.whenReady()` de Electron en
   Windows y la ejecución real de los dos workflows. La lógica quedó exhaustivamente probada de
   forma determinista sobre los módulos reales.

---

## Residuo declarado y aceptado

Queda un camino que los fixes **no cierran**, declarado de forma explícita en el código, en
`design.md` D-5 y en ADR-0013:

> Si la copia de `usage-log.txt` falla en el **primer** arranque **y** el usuario cierra alguna
> sesión antes de reiniciar, `appendSessions` crea un `sessions.json` propio y el log que llegue
> después ya no se absorbe.

El dato **no se destruye**: el origen queda intacto por diseño y el log llega al destino como
`.bak`. Recuperarlo exige acción manual. Es el mismo residuo que ADR-0013 ya declara y acepta
bajo la regla "el destino gana"; **cerrarlo exigiría la fusión de historiales que ADR-0013
descartó con fundamento** (ids generados por contadores que reinician en cada arranque,
duplicados indistinguibles de sesiones reales). Los dos jueces verificaron que el residuo está
honestamente enunciado y bien acotado.

---

## Acciones que quedan para el usuario (no son código)

1. **Renombrar el repositorio de GitHub a `work-tracker` antes de empujar el tag `v2.0.0`** (C3).
   Sin eso, `release.yml` compila entero y falla con 404 al publicar. También hace resolver el
   enlace del PR template.
2. **Decidir sobre los datos personales antes de hacer público el repositorio** (S4): el correo
   `l.arayapardo.dev@gmail.com` en 83 commits, la ruta con el nombre real de la cuenta de Windows
   en `memory/observations.md`, y las rutas locales en el frontmatter de 30 specs. No hay
   credenciales ni secretos. Reescribir la historia es destructivo y quedó fuera del alcance:
   **es una decisión, no un defecto**.
3. **Verificar el traspaso en la primera instalación real** contra `%APPDATA%\cronometro-apps`,
   que en esta máquina sí existe con datos reales.

## Roadmap sugerido (fuera del alcance de este cambio)

- `vue/no-deprecated-destroyed-lifecycle` en `CronometroManual.vue:76` — defecto real, hoy en
  `warn` por decisión de ADR-0014.
- Logging persistente para el traspaso (S3) y `try/catch` en `migrateLegacyLog()` con manejo
  explícito del arranque fallido (S9).
- `vue-router` y `vue3-datepicker`: candidatas a dependencias muertas, preexistentes
  (identificadas por `sdd-verify`).
- Hardening de Electron: el binario corre con `nodeIntegration: true` y `contextIsolation: false`
  y sin fuses (S8); reponerlos exige subir electron-builder de mayor.
