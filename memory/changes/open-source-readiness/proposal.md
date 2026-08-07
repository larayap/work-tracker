---
type: proposal
change_name: "open-source-readiness"
domain: debt
status: approved
iteration: 2
created: "2026-08-06"
updated: "2026-08-06"
effort: L
risks:
  - nombre: "La migración pierde o duplica datos de la base instalada"
    probabilidad: Media
    impacto: Alto
  - nombre: "Se implementa la condición de migración a nivel de directorio y nunca dispara"
    probabilidad: Media
    impacto: Alto
  - nombre: "El workflow de release no compila a la primera"
    probabilidad: Alta
    impacto: Medio
  - nombre: "La migración no se puede verificar localmente (WSL2, sin build)"
    probabilidad: Alta
    impacto: Medio
  - nombre: "postinstall rompe el job de lint en Linux"
    probabilidad: Media
    impacto: Bajo
  - nombre: "El lint verde en CI no refleja el lint local por la doble config ESLint"
    probabilidad: Media
    impacto: Medio
  - nombre: "Work Tracker queda instalado junto a Workout con datos ya migrados"
    probabilidad: Alta
    impacto: Bajo
  - nombre: "Rename del repo no ejecutado, el release publica al repo viejo"
    probabilidad: Baja
    impacto: Medio
tags: [change]
---

# Propuesta — open-source-readiness (iteración 2)

## Intent

El repo se presenta como **Work Tracker**: proyecto open source con licencia MIT, README
real, guías de contribución, un único sistema de build y releases automatizadas desde CI.
La identidad del paquete se unifica bajo el nombre nuevo y el historial de los usuarios ya
instalados viaja con ellos mediante una migración one-shot.

## Hallazgos que corrigen el input

Verificados contra el worktree y contra la instalación real en Windows (interop WSL2):

1. **`userData` lo determina `package.json.name`, no `productName`.** El `package.json`
   extraído del `app.asar` instalado declara `name: "cronometro-apps"` y **no** tiene campo
   `productName`; electron-builder 22.14.13 no inyecta el `productName` de `builderOptions`
   en el paquete. Por eso los datos viven en `%APPDATA%/cronometro-apps/`, con escrituras
   de hoy. Renombrar `name` a `work-tracker` **reapunta la persistencia completa**: es lo
   que obliga a migrar.
2. **Sí existen releases con instalador**: `v.1.0.0` (11 descargas) y `v1.0.1` (1), con
   asset `Workout.Setup.*.exe`. La base instalada de terceros es real, así que la migración
   opera sobre datos que no se pueden reconstruir.
3. **Ruta de instalación** = `%LOCALAPPDATA%\Programs\{name}\{productName}`: Work Tracker se
   instala **junto a** Workout, sin reemplazarlo. Con `name` renombrado ya no comparten
   `userData`, de ahí que la copia sea necesaria y que el original deba quedar intacto.
4. No hay `electron-updater` en dependencias: renombrar el repo no afecta el runtime de la
   base instalada, solo el destino del `publish` de electron-builder.
5. **Residuo no listado**: `electron-squirrel-startup` está en `dependencies` sin referencias
   en `src/` y viaja dentro del asar. Se da de baja junto con forge.
6. **Doble fuente de config ESLint**: `.eslintrc.js` (`plugin:vue/essential`) y
   `package.json.eslintConfig` (`plugin:vue/vue3-essential`), con reglas distintas.
7. **Deriva de versión**: `package.json.version` es `1.0.0` con `v1.0.1` publicada, y los
   tags son inconsistentes (`v.1.0.0` vs `v1.0.1`).
8. `memory/` son 36 archivos trackeados; `.sdd/` no está trackeado **ni ignorado**.

## Scope

**Frente 1 — Higiene**: `LICENSE` (MIT, `larayap`, 2026), `README.md` reescrito
(qué hace, Windows-only, instalación desde Releases, build desde código, stack, licencia)
**sin capturas** por ahora, `CONTRIBUTING.md` (entorno, commits, ramas, qué es `memory/`),
`CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md`,
`.github/PULL_REQUEST_TEMPLATE.md`.

**Frente 2 — Identidad, migración y limpieza**: `package.json.name` = `work-tracker`,
`version` = `2.0.0`, `author` = `larayap`, `description` y `repository` actualizados;
`productName` y `win.executableName` = `Work Tracker`; `appId` = `com.worktracker.app`;
**migración one-shot de `userData`** (ver abajo); baja de `@shopify/draggable` y
`electron-squirrel-startup`; borrado de los 6 PNG muertos (`manual.png` intacto); borrado de
`forge.config.js`, de las 7 devDependencies `@electron-forge/*` + `@electron/fuses` y de los
scripts `start`/`package`/`make`; unificación de la config ESLint en una sola fuente;
`.sdd/` agregado a `.gitignore`.

> **La invariante "este cambio no modifica el comportamiento de la aplicación" se relaja de
> forma acotada y explícita para un único ítem: la migración de `userData`.** Es el único
> código de `src/main/` que este cambio toca. Todo el resto de `src/` (componentes, stores,
> historial, utils, plugins, sonidos, `manual.png`) permanece intacto.

**Frente 3 — CI**: workflow `lint` en PR (`ubuntu-latest`, `npm ci --ignore-scripts`) y
workflow `release` por tag `v*` (`windows-latest`, `npm run electron:build -- --publish always`
con `GITHUB_TOKEN`), validando que el tag coincida con `package.json.version`.

**Fuera de alcance** (issues de roadmap): Electron 13 EOL y migración de `remote`, reemplazo
de `vue-cli-plugin-electron-builder`, test runner, i18n, sitio web, capturas del README.

## Approach y trade-offs explícitos

**Build — se conserva `vue-cli-plugin-electron-builder`, se elimina electron-forge.** Es el
flujo que produjo los binarios publicados (el asar instalado lleva su firma: `main:
background.js`, deps podadas a las externals). Forge nunca empaquetó nada y sus makers
`deb`/`rpm`/`zip@darwin` producirían binarios rotos en una app Windows-only (ADR-0004).
*Trade-off*: se hereda una dependencia sin mantenimiento upstream, con webpack 4 anidado y el
techo ES2016 del main process. Migrar a forge se descarta: reescribiría el pipeline del main
y es **inverificable localmente** en WSL2. La deuda queda documentada, no resuelta.

**Migración de `userData` — patrón ADR-0007, adaptado a un hallazgo que lo obliga.**
La migración corre en el arranque, **antes** de `sessionLog.migrateLegacyLog()`
(`background.js:90`) y de cualquier lectura de settings, cachés o selección monitoreada.
Como `app.getPath('userData')` ya resuelve al directorio nuevo, el origen se calcula
explícitamente como `path.join(app.getPath('appData'), 'cronometro-apps')`.

*Hallazgo que condiciona el diseño*: Electron crea y puebla el `userData` nuevo con estado
propio de Chromium (`Cache/`, `Preferences`, `Local Storage/`) **antes** de `whenReady`. Una
regla "migrar solo si el directorio destino no existe" —traducción literal del paso 1 de
ADR-0007— **nunca dispararía**. La condición es por archivo, no por directorio: se copian
solo los 8 archivos que la app posee (`sessions.json`, `settings.json`,
`monitored-selection.json`, `app-icons-cache.json`, `installed-apps-cache.json`,
`pomodoro-sessions.json`, `usage-log.txt`, `usage-log.txt.bak`), y **cada archivo se copia
solo si no existe en destino**. Eso conserva las tres propiedades del ADR-0007: one-shot,
idempotente y no destructiva —el directorio origen nunca se toca—, y define por construcción
el caso de ambos directorios poblados: **el destino gana siempre, archivo por archivo**, sin
fusión ni sobreescritura silenciosa. La copia usa tmp + rename por archivo, igual que el
`writeJsonAtomic` que ya usa el proyecto.

*Trade-off*: quedan dos directorios en `%APPDATA%` y nadie limpia el viejo — el mismo costo
que ADR-0007 aceptó con `usage-log.txt.bak`, y el precio de la no-destrucción.

**Casos que `sdd-verify` debe cubrir**: (a) arranque limpio sin directorio previo → no se
copia nada y la app arranca vacía; (b) arranque con directorio previo poblado → los 8
archivos aparecen en destino con contenido idéntico; (c) segundo arranque → no se copia nada
y no se altera lo existente (idempotencia); (d) el directorio origen queda intacto tras la
migración; (e) ambos directorios poblados con contenidos distintos → el destino se conserva
sin cambios; (f) interrupción a mitad de copia → el arranque siguiente completa lo faltante
sin dejar archivos a medio escribir.

**Renombrado**: `2.0.0` queda semánticamente justificado por la migración de datos, y no
colisiona con los tags publicados. `appId` nuevo implica AppUserModelID nuevo: los anclajes
a la barra de tareas y las notificaciones de la instalación vieja no se heredan. *Trade-off
advertido y asumido por el usuario*: "work tracker" está saturado en GitHub, lo que reduce
el descubrimiento orgánico que era parte del objetivo del cambio.

**Releases**: dispara `push` de tag `v<semver>`; SSOT de versión = `package.json.version`;
`publish` se reapunta a `work-tracker` cuando el rename externo esté hecho.

**Dependencia externa (no la ejecuta el pipeline)**: renombrar el repo en GitHub a
`work-tracker`. Las tareas que dependen de ella (`publish.repo`, URLs y badges del README)
se escriben con el nombre destino y quedan bloqueadas hasta que el usuario lo confirme.

**`memory/` y `.sdd/`**: `memory/` permanece versionado — es el conocimiento del proyecto
(12 ADRs, specs por capability) y borrarlo destruye trazabilidad; `CONTRIBUTING.md` explica
que no es código de la app. `.sdd/` (worktrees efímeros) pasa a `.gitignore`.

## Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| La migración pierde o duplica datos de la base instalada (12 descargas, historial irreconstruible) | Media | Alto | Copia no destructiva con tmp+rename por archivo; el origen sobrevive como respaldo; los 6 casos de verificación de arriba |
| Se implementa la condición de migración a nivel de directorio y nunca dispara (Electron ya creó el destino) | Media | Alto | Regla por archivo declarada en el diseño y verificada por el caso (b) |
| El workflow de release no compila a la primera (toolchain jamás ejecutado en Actions; Node, `postinstall`, `active-win`) | Alta | Medio | Pinear Node en CI; iterar contra tags de prueba `v0.0.0-ciN` en pre-releases borrables |
| La migración no se puede verificar localmente (WSL2, sin build) | Alta | Medio | Verificación sobre el `userData` real vía interop, coordinando ventana con el usuario; o diferir a un `.exe` de pre-release |
| `postinstall` (`electron-builder install-app-deps`) rompe el job de lint en Linux | Media | Bajo | `npm ci --ignore-scripts` en lint |
| El lint verde en CI no refleja el lint local por la doble config ESLint | Media | Medio | Unificar en un archivo antes de escribir el workflow |
| Work Tracker queda instalado junto a Workout con datos ya migrados | Alta | Bajo | Nota en el release: el historial viaja solo; desinstalar Workout es seguro |
| Rename del repo no ejecutado → el release publica al repo viejo | Baja | Medio | Declarado como dependencia externa bloqueante |

## Esfuerzo

**L**, en el extremo alto del rango. Frente 1 = S-M (contenido, sin riesgo técnico).
Frente 2 = **M** (sube desde S: incorpora código nuevo en `src/main/` que opera sobre datos
irreemplazables, con seis casos de verificación propios). Frente 3 = M-L. El riesgo deja de
estar concentrado en CI y ahora se reparte entre dos frentes, ambos con el mismo agravante:
ninguno se verifica localmente en WSL2.
