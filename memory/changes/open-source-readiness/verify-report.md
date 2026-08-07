---
type: verify-report
change_name: "open-source-readiness"
verdict: "PASS (PARTIAL por entorno en los ítems que exigen build de Windows o ejecución real de GitHub Actions)"
created: "2026-08-06"
tags: [change]
---

# Verify report — open-source-readiness

**Veredicto: PASS.** Todo lo verificable en este entorno (WSL2, sin Windows, sin GitHub Actions
real) pasa. Los ítems que por diseño (D-13) requieren nivel 2 (máquina Windows) o nivel 3 (CI
real) quedan **PARTIAL por entorno** — no por defecto de código — y así se declaran explícitamente
más abajo, spec por spec. Ninguno de los 6 escenarios críticos de migración de `userData` falla.
No se encontró ninguna violación de las invariantes de mayor riesgo (`productName` ausente,
techo ES2016, alcance de `src/`, enganche en `whenReady`).

## Qué se ejecutó

- `node -e` con un arnés de 6 escenarios (limpio, con datos previos, segundo arranque,
  no-destrucción del origen, ambas identidades con datos distintos, interrupción a mitad de
  copia) sobre `migrateUserDataAt()` real, en `/tmp/.../scratchpad/verify-migration/`. Nunca se
  tocó el `userData` real.
- `grep -rnE '\?\?|[a-zA-Z0-9_\)\]]\?\.'` sobre todo `src/main/*.js` + `src/background.js`: cero
  coincidencias.
- `python3 -c "import json..."` comparando `name`/`version`/`dependencies`/`devDependencies` entre
  `package.json` y `package-lock.json` (`packages[""]`): coinciden exactamente.
- `npm run lint -- --no-fix`: **0 errores, 1 warning** (`vue/no-deprecated-destroyed-lifecycle` en
  `CronometroManual.vue:76`, tal como predice ADR-0014).
- `git diff 3e5be8f..81e7fbf` completo, archivo por archivo, para verificar alcance.
- Simulación empírica del argumento de la desviación D-11: se ocultó
  `node_modules/electron/path.txt` y se corrió
  `node -e "require('vue-cli-plugin-electron-builder')"` — lanza
  `Error: Electron failed to install correctly...` antes de que cualquier lint corra. Se
  restauró el archivo de inmediato.
- Validación YAML de `lint.yml` y `release.yml` con `js-yaml`.
- Simulación bash de la guarda tag↔versión con `GITHUB_REF_NAME=v2.0.0` (pasa) y
  `GITHUB_REF_NAME=v1.9.9` (falla con exit 1), replicando el script real del workflow.
- Inspección de solo lectura vía `powershell.exe` (interop WSL2↔Windows) de
  `%APPDATA%\cronometro-apps` y `%APPDATA%\work-tracker` en la máquina del usuario: ninguno de
  los dos existe en esta máquina (no hay base instalada real aquí — build de Windows bloqueado,
  ver memoria del usuario), así que no hay verificación de nivel 2 posible en este equipo. No se
  escribió nada.
- Auditoría de grafo de specs para las 5 specs de `spec_refs`.

## Resultado por spec

### 1. `unified-product-identity` — PASS (2 de 5 AC quedan PARTIAL por entorno, no por defecto)

- [x] **Autoría consistente entre paquete y licencia.** `package.json.author: "larayap"` ==
  `LICENSE`: "Copyright (c) 2026 larayap". PASS.
- [x] **Repositorio reconocible desde el nombre del producto.** `package.json.repository:
  "github:larayap/work-tracker"`, `vue.config.js` `publish[0].repo: "work-tracker"`, README
  apunta a `github.com/larayap/work-tracker`. PASS.
- [x] **Ningún identificador conserva marcador de plantilla o nombre previo.** `grep` de
  `Workout`/`cronometro-apps`/`com.tuapp.cronometroapps`/`"Flama"` fuera de `memory/` (que
  documenta la decisión como historia) solo encuentra `src/main/userdata-migration.js`, donde
  `LEGACY_USERDATA_DIRNAME = 'cronometro-apps'` es intencional: es la clave para encontrar los
  datos viejos, no un residuo. PASS.
- [ ] **Instalador + acceso directo con el mismo nombre.** Título de ventana y tooltip de la
  bandeja verificados en código (`'Work Tracker'`); `productName`/`executableName` en
  `builderOptions` también. El instalador y el acceso directo reales solo se generan
  compilando en `windows-latest`. **PARTIAL por entorno.**
- [ ] **Versión declarada corresponde a una release publicada.** `version: "2.0.0"` y
  convención `v<semver>` declaradas y con guarda verificada; la release efectiva aún no se
  publicó (requiere empujar el tag `v2.0.0` y que CI corra). **PARTIAL por entorno.**

### 2. `legacy-userdata-one-shot-migration` — PASS (los 6 escenarios, nivel 1)

Los 6 escenarios se ejercitaron con `node -e` contra `migrateUserDataAt()` real:

1. **Arranque limpio**: `sourceDir` ausente → `{copied:[], skipped:[], failed:[]}`, no crea el
   directorio destino. PASS.
2. **Arranque con datos previos**: los 8 `OWNED_FILES` se copian completos, contenido idéntico
   byte a byte al origen. PASS.
3. **Segundo arranque no repite**: `skipped.length === 8`, `mtimeMs` de los 8 archivos destino
   sin cambios entre la primera y la segunda corrida (no hay reescritura). PASS.
4. **Origen intacto**: `mtimeMs` y contenido del origen sin cambios después del traspaso — la
   función solo hace `existsSync`/`copyFileSync` de lectura sobre el origen. PASS.
5. **Datos distintos en ambas identidades**: con contenido `SOURCE-*` en el origen y
   `TARGET-*` en el destino para los 8 archivos, el resultado deja el destino intacto
   (`TARGET-*`) y el origen intacto (`SOURCE-*`); nada se copia, nada se fusiona. PASS.
6. **Interrupción a mitad de copia**: se dejó un `.migrating` huérfano con contenido basura
   para un archivo, simulando un corte entre `copyFileSync` y `renameSync`. La corrida
   siguiente sobrescribe el temporal y publica el contenido correcto; no queda ningún
   `.migrating` residual; una tercera corrida es no-op. PASS.

**Invariantes de mayor riesgo, verificadas aparte:**

- **Lista de 8 archivos completa**: `grep -rn "getPath('userData')" src/` da exactamente las 8
  claves de `OWNED_FILES` (`sessions.json`, `usage-log.txt`, `usage-log.txt.bak`,
  `settings.json`, `monitored-selection.json`, `installed-apps-cache.json`,
  `app-icons-cache.json`, `pomodoro-sessions.json`) — sin un noveno archivo huérfano.
- **`package.json` no declara `productName`**: confirmado con `json.load` (`'productName' in
  d` → `False`). El nombre visible vive solo en `vue.config.js.builderOptions.productName`, tal
  como exige la invariante de ADR-0013.
- **El enganche es la primera sentencia de `app.whenReady().then(async () => {...})`**,
  antes de `createTray()` y `createWindow()` (confirmado leyendo `src/background.js` completo).
  No está en `createWindow()` (reentrante).
- **Techo ES2016**: cero `??`/`?.` en `userdata-migration.js` ni en ningún archivo alcanzable
  desde `src/background.js` (`src/main/*.js` completo).

**Nivel 2 (integración real contra `%APPDATA%` en Windows) — PARTIAL por entorno**: la máquina
Windows disponible por interop no tiene base instalada real (ni `cronometro-apps` ni
`work-tracker` existen bajo `%APPDATA%` ahí — coincide con la nota de memoria "Probar en Windows
está bloqueado"), así que no hay forma de ejercitar el traspaso contra datos reales en este
entorno. La lógica pura queda exhaustivamente probada; la integración con `app.whenReady()` real
de Electron no.

### 3. `community-contribution-documents` — PASS, 6/6 AC

- **LICENSE**: MIT completo, `Copyright (c) 2026 larayap`. PASS.
- **README.md**: describe qué hace, para quién, SO requerido (Windows, con la razón —
  ADR-0004), instalación desde binario (`Releases`) y compilación desde código (`.nvmrc`,
  `npm ci`, `npm run electron:build`). PASS.
- **CONTRIBUTING.md**: entorno de desarrollo (`nvm use`, `npm ci`, `electron:serve`),
  Conventional Commits en inglés con ejemplos, convención de ramas
  (`feature/<descripción-corta>`), y una sección `## Sobre memory/` que aclara que no es
  código de la app. PASS.
- **CODE_OF_CONDUCT.md**: Contributor Covenant completo (135 líneas), no un stub. PASS.
- **`.github/ISSUE_TEMPLATE/bug_report.md` y `feature_request.md`**: ambos con frontmatter
  (`name`, `about`, `title`, `labels`) y secciones guiadas. PASS.
- **`.github/PULL_REQUEST_TEMPLATE.md`**: guía qué describir + checklist con lint y
  convenciones. PASS.

### 4. `single-build-and-lint-pipeline` — PASS, 3/5 AC marcados (2 quedan honestamente sin marcar, no PARTIAL por entorno sino por alcance de auditoría — igual que sdd-apply)

- [x] **Único sistema de build**: `forge.config.js` no existe en el árbol de trabajo, los 7
  paquetes `@electron-forge/*` + `@electron/fuses` no están en `package.json`, los scripts
  `start`/`package`/`make` no existen. PASS.
- [x] **Mismo lint en cualquier entorno**: un solo `.eslintrc.js` con `extends:
  ['plugin:vue/vue3-essential', 'eslint:recommended']`; `package.json` ya no tiene bloque
  `eslintConfig`. Ejecutado localmente: 0 errores, 1 warning documentado. PASS.
- [x] **`.sdd/` no rastreado**: `.gitignore` tiene `/.sdd`; `git ls-files .sdd` no devuelve nada.
  PASS.
- [ ] **Toda dependencia declarada tiene uso real**: verificado solo para las 2 que Task 3.3
  identificó y removió (`@shopify/draggable`, `electron-squirrel-startup` — confirmado
  ausentes de `package.json` y sin referencias en `src/`). Hice un spot-check adicional sobre
  las ~35 dependencias restantes (`grep` de cada nombre contra `src/`, `vue.config.js`,
  `babel.config.cjs`, `public/`) y encontré **dos candidatas a no usadas y no tocadas por este
  cambio**: `vue-router` y `vue3-datepicker` — cero referencias en ningún `.vue`/`.js` de
  `src/`, ni como import ni como `createRouter`/`useRouter`. Son preexistentes al cambio, están
  fuera del alcance aprobado (Task 3.3 solo cubrió las 2 dependencias ya removidas) y no las
  toco. Quedan registradas como hallazgo para un cambio futuro, no como FAIL de este. El AC
  sigue sin marcar, correctamente.
- [ ] **Todo recurso gráfico versionado tiene referencia real**: verificado solo para
  `src/assets/*.png` (los 6 PNG muertos removidos, `manual.png` intacto — confirmado
  `file src/assets/manual.png` da PNG válido 32×32 y `git log` lo muestra sin tocar desde su
  commit original). Sin auditoría de `public/*.png`/`*.ico`, fuera del alcance de Task 3.5. AC
  sin marcar, correctamente.

### 5. `pr-lint-and-tagged-release-workflow` — PASS a nivel de configuración; 3/3 AC quedan PARTIAL por entorno (nivel 3, requieren CI real)

- **YAML válido**: ambos workflows parsean sin error (`js-yaml`).
- **Guarda tag↔versión antes de compilar**: el step "Verificar que el tag coincide con
  `package.json.version`" es el primero después de `setup-node` en `release.yml`, antes de
  `npm ci` y de `electron:build`. Simulado con `GITHUB_REF_NAME=v2.0.0` (pasa, exit 0) y
  `GITHUB_REF_NAME=v1.9.9` (falla, exit 1) usando el mismo script bash del workflow. PASS.
- **`releaseType: 'release'` explícito**: presente en `vue.config.js` →
  `builderOptions.publish[0].releaseType`. Sin esto, electron-builder publica en `draft` por
  defecto (confirmado en `tech-context.md`, línea 36-37, contra el código instalado de
  `electron-publish`). PASS.
- [ ] Los 3 acceptance criteria de esta spec (verificación visible en la contribución, release
  publicada al taggear una versión válida, ninguna release con tag inválido) exigen la
  ejecución real de GitHub Actions (`ubuntu-latest`/`windows-latest`), inalcanzable desde
  WSL2. **PARTIAL por entorno** en los 3, tal como ya declaraba sdd-apply. La configuración que
  los produciría está verificada pieza por pieza (arriba).

## Desviación declarada por sdd-apply: `npm ci` sin `--ignore-scripts` en `lint.yml`

**Verificada y confirmada justificada.** El argumento de sdd-apply es correcto, verificado de
forma empírica, no solo leído:

`vue-cli-service` carga en el arranque **todos** los plugins instalados, para cualquier
comando — no solo para `electron:build`. `vue-cli-plugin-electron-builder/index.js` hace, a
nivel de módulo (línea 710): `module.exports.testWithSpectron =
require('./lib/testWithSpectron')`. `lib/testWithSpectron.js` hace, en su primera línea:
`const electronPath = require('electron')`. El paquete `electron` resuelve su ruta leyendo
`node_modules/electron/path.txt` (`node_modules/electron/index.js:9-18`), archivo que solo
escribe el **postinstall propio de `electron`** — exactamente el que `--ignore-scripts` omite.

Prueba directa: oculté `node_modules/electron/path.txt`, corrí
`node -e "require('vue-cli-plugin-electron-builder')"` y obtuve
`Error: Electron failed to install correctly, please delete node_modules/electron and try
installing again` — antes de que una sola regla de ESLint se evalúe. Restauré el archivo de
inmediato.

La premisa original de D-11/ADR-0014 (que el costo a evitar en Linux era el `postinstall` del
propio proyecto, `electron-builder install-app-deps`) pasaba por alto que el `require('electron')`
transitivo ocurre *antes*, en la carga del plugin, y que ese require depende del postinstall de
`electron` mismo, no del proyecto. `--ignore-scripts` corta ambos a la vez y rompe el lint job
completo, no solo lo abarata.

**Acción tomada**: actualicé `memory/adrs/0014-single-build-toolchain-and-pinned-node.md` —
sección "Decision" — para reemplazar la premisa original por la cadena de causalidad verificada
arriba, dejando `.github/workflows/lint.yml` y el ADR coherentes entre sí. No hizo falta una
spec delta: es una corrección de una ADR ya aceptada, no un fallo de un Scenario.

## Coherencia de Grafo de Specs

Para las 5 specs de `spec_refs`, revisé cada arista `depends_on`/`affects` declarada:

- `legacy-userdata-one-shot-migration` `depends_on: [[unified-product-identity]]` ↔
  `unified-product-identity` `affects: [[legacy-userdata-one-shot-migration]]`. Simétrico. OK.
- `pr-lint-and-tagged-release-workflow` `depends_on: [[unified-product-identity]],
  [[single-build-and-lint-pipeline]]` ↔ ambas declaran
  `affects: [[pr-lint-and-tagged-release-workflow]]`. Simétrico. OK.
- `unified-product-identity` `affects: [[community-contribution-documents]]` ↔
  `community-contribution-documents` no tiene `depends_on` hacia ella, pero sí la tiene en
  `related`. Cumple la regla (metadata, no FAIL). OK, sin corrección necesaria.
- `legacy-userdata-one-shot-migration` `affects: [[sessions-json-persistence]],
  [[row-lifecycle-persistence-by-type]], [[configurable-time-format-preference]]` — **las tres
  specs existen** (`memory/specs/app-monitoring/sessions-json-persistence.md`,
  `memory/specs/app-monitoring/row-lifecycle-persistence-by-type.md`,
  `memory/specs/app-settings/configurable-time-format-preference.md`), pero ninguna tenía la
  referencia de vuelta (ni en `depends_on` ni en `related`) — son specs completadas antes de
  que este cambio existiera. **Inconsistencia solo de metadata → WARN, no FAIL.** Cumple las
  tres condiciones para corrección automática (validación principal PASS, inconsistencia
  unívoca, solo metadata) → corregida (ver abajo).

## Correcciones de Metadata

Agregué `[[legacy-userdata-one-shot-migration]]` al campo `related` (frontmatter + sección
prosa `## Related`) de las tres specs que `legacy-userdata-one-shot-migration` declara en
`affects` y que no tenían la referencia de vuelta:

- `memory/specs/app-monitoring/sessions-json-persistence.md`
- `memory/specs/app-monitoring/row-lifecycle-persistence-by-type.md`
- `memory/specs/app-settings/configurable-time-format-preference.md`

`updated` de las tres se llevó a `2026-08-06`.

## Alcance sobre `src/` — confirmado

`git diff 3e5be8f..81e7fbf -- src/` toca exactamente:

- `src/main/userdata-migration.js` (nuevo, 110 líneas)
- `src/background.js`: el `require` del módulo nuevo, el enganche de 8 líneas dentro de
  `app.whenReady().then()` como primera sentencia, y **tres literales de presentación**:
  `tray.setToolTip('Work Tracker')`, `title: 'Work Tracker'` (BrowserWindow), y el `<title>`
  de `public/index.html`
- 6 PNG muertos borrados en `src/assets/` (`Blender.png`, `CLIP STUDIO PAINT.png`,
  `Google Chrome.png`, `Toom Boom Storyboard Pro.png`, `Toon Boom Harmony Premium.png`,
  `VEGAS Pro.png`); `src/assets/manual.png` intacto

Ningún otro archivo de `src/` cambió. Sin violación de alcance.

## Riesgos identificados

1. **`vue-router` y `vue3-datepicker` parecen dependencias muertas**, preexistentes al cambio y
   fuera de su alcance aprobado. No se tocaron. Candidatas para un cambio de limpieza futuro.
2. **Nivel 2 y nivel 3 de D-13 (máquina Windows real, CI real) siguen sin ejercitarse.** La
   máquina Windows disponible por interop no tiene base instalada real para probar la migración
   contra datos reales, y GitHub Actions no puede correr desde este entorno. Recomendado:
   validar en la primera instalación real del usuario y en el primer PR/tag reales antes de
   confiar el criterio de aceptación completo de `unified-product-identity` (AC1, AC3) y de
   `pr-lint-and-tagged-release-workflow` (los 3 AC) como cerrado.
3. **`active-win@8.2.1` en `windows-latest`** es, según el propio ADR-0014, "el paso con más
   probabilidad de fallar la primera vez" en `release.yml` — no verificable desde aquí.

Ninguno de estos tres riesgos es un defecto de código introducido por este cambio; los tres son
límites de entorno o deuda preexistente ya señalada por el propio ADR/spec.
