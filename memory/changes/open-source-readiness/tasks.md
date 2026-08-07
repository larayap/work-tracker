---
type: tasks
change_name: "open-source-readiness"
domain: debt
created: "2026-08-06"
updated: "2026-08-06"
spec_refs: ["[[unified-product-identity]]", "[[legacy-userdata-one-shot-migration]]", "[[community-contribution-documents]]", "[[single-build-and-lint-pipeline]]", "[[pr-lint-and-tagged-release-workflow]]"]
adrs: ["[[0013-per-file-userdata-handover-on-identity-rename]]", "[[0014-single-build-toolchain-and-pinned-node]]"]
tags: [change]
---

# Tareas — open-source-readiness

## Orden de ejecución

```
Fase 1 (unified-product-identity, sin deps)
  ├─→ Fase 2 (legacy-userdata-one-shot-migration, depende de Fase 1)
  └─→ Fase 3 (single-build-and-lint-pipeline, sin deps duras — secuenciada acá
      porque comparte package.json con Fase 1 y cierra con la regeneración
      única del lock)
        └─→ Fase 5 (pr-lint-and-tagged-release-workflow, depende de Fases 1 y 3)
Fase 4 (community-contribution-documents, sin deps — puede correr en paralelo
        conceptual a 2/3/5; se lista después por prolijidad de lectura)
Fase 6 (issues de roadmap — housekeeping, no depende de nada, cierra el cambio)
```

Restricción transversal: **solo** `src/main/userdata-migration.js` (nuevo) y los tres
literales `Workout` de `src/background.js` (D-8) tocan `src/`. Ningún otro archivo de `src/`
se modifica en este cambio.

Techo sintáctico ES2016 (sin `??`, `?.`, `||=`, `&&=`, campos de clase, `Array.prototype.at`)
en todo archivo alcanzable desde `src/background.js` — aplica a Fase 2.

---

## Fase 1 — Identidad unificada del producto

**Spec**: [[unified-product-identity]] · **Depende de**: nada

- [x] **1.1 — Identidad en `package.json`** (`package.json`)
  - Qué hacer: cambiar `name: "cronometro-apps"` → `"work-tracker"`; `version: "1.0.0"` →
    `"2.0.0"`; `author: "Flama"` → `"larayap"`; `description` → una descripción real del
    producto (sugerida: `"Cronómetro de tiempo de uso de aplicaciones de escritorio para
    Windows, con historial, pomodoro y selección de programas monitoreados."`); agregar
    `"license": "MIT"`; agregar `"repository": "github:larayap/work-tracker"`. Mantener
    `"private": true`. **No tocar** `scripts`, `dependencies`, `devDependencies` ni
    `eslintConfig` todavía — eso es Fase 3. **No agregar** un campo `"productName"` (D-7/
    ADR-0013: `app.getName()` lo preferiría sobre `name` y movería `userData` a
    `%APPDATA%/Work Tracker`, huérfano del traspaso de Fase 2).
  - Criterio de completado: `node -e "const p=require('./package.json'); console.log(p.name, p.version, p.author, p.license, p.repository)"` imprime
    `work-tracker 2.0.0 larayap MIT github:larayap/work-tracker`; `p.productName` es
    `undefined`.

- [x] **1.2 — Identidad visible y publish en `vue.config.js`** (`vue.config.js`)
  - Qué hacer: dentro de `pluginOptions.electronBuilder.builderOptions`, cambiar
    `appId: 'com.tuapp.cronometroapps'` → `'com.worktracker.app'`; `productName: 'Workout'`
    → `'Work Tracker'`; `win.executableName: 'Workout'` → `'Work Tracker'`; dentro de
    `publish[0]`, `repo: 'cronometro-app'` → `'work-tracker'` y agregar
    `releaseType: 'release'` (D-11/ADR-0014: sin esto electron-builder publica en `draft`
    por defecto — verificado en `electron-publish/out/gitHubPublisher.js:52` — y el
    instalador no queda descargable). No tocar los bloques `mac`/`linux` comentados ni
    `nsis`.
  - Criterio de completado: grep de `Workout` y de `com.tuapp.cronometroapps` sobre
    `vue.config.js` no arroja resultados; `publish[0]` contiene `repo: 'work-tracker'` y
    `releaseType: 'release'`.

- [x] **1.3 — Título del documento en `public/index.html`** (`public/index.html`)
  - Qué hacer: `<title>Workout</title>` (línea 8) → `<title>Work Tracker</title>`.
  - Criterio de completado: `grep -n "Workout" public/index.html` no encuentra nada.

- [x] **1.4 — Literales de presentación en `src/background.js`** (`src/background.js`)
  - Qué hacer (excepción acotada D-8 — únicos literales de `src/` fuera del módulo de
    traspaso que este cambio toca, sin efecto sobre lógica): línea 34,
    `tray.setToolTip('Workout')` → `tray.setToolTip('Work Tracker')`; línea 65,
    `title: 'Workout',` dentro del `new BrowserWindow({...})` → `title: 'Work Tracker',`.
    No tocar ningún otro literal del archivo (el título de `historyWindow` en línea 190,
    `'Historial'`, describe la ventana y no el producto — queda igual, fuera de alcance).
  - Criterio de completado: `grep -n "Workout" src/background.js` no encuentra nada;
    `grep -n "Historial" src/background.js` sigue encontrando la línea 190 sin cambios.

- [x] **1.5 — Verificación de consistencia de identidad** (lectura, sin archivo propio)
  - Qué hacer: confirmar que ningún identificador público del producto conserva el nombre
    previo: `grep -rn "Workout\|cronometro-apps\|com\.tuapp\.cronometroapps" package.json
    vue.config.js public/index.html src/background.js` no debe encontrar nada. Los
    identificadores internos `Cronometro*` (nombres de componente, clases CSS) **no** se
    tocan — no son identidad pública (D-8) y quedan fuera de este chequeo.
  - Criterio de completado: el grep de arriba retorna vacío en los 4 archivos listados;
    cierra la Acceptance Criteria de la spec "ningún identificador público conserva un
    marcador de plantilla o un nombre previo" para esos 4 archivos (el resto de la spec —
    `productName`/`appId`/versión en el instalador real — se verifica en niveles 2/3 de D-13,
    fuera de WSL2).

---

## Fase 2 — Traspaso único de `userData`

**Spec**: [[legacy-userdata-one-shot-migration]] · **Depende de**: Fase 1 (el origen del
traspaso se calcula porque `package.json.name` ya cambió)

Prioridad `critical` en la spec: opera sobre datos irreemplazables de una base instalada real
(releases `v.1.0.0`/`v1.0.1`, 12 descargas). Ver ADR-0013 para el razonamiento completo.

- [x] **2.1 — [TDD] Arnés de verificación de los 6 escenarios, antes del código**
  (script temporal, no versionado — vive fuera del repo, p. ej. en un directorio de
  scratch, y se descarta al terminar la fase)
  - Qué hacer: escribir un script `node -e` (o un archivo `.js` temporal ejecutado con
    `node`) que construya pares de directorios origen/destino bajo un `tmpdir` del sistema
    y ejercite `migrateUserDataAt({ sourceDir, targetDir })` contra los 6 escenarios de la
    spec:
    (a) sin origen → `{ copied: [], skipped: [], failed: [] }` y el destino no se crea con
    contenido nuevo; (b) origen poblado con los 8 archivos → aparecen en destino con
    contenido byte-idéntico; (c) segunda corrida sobre el mismo par → `copied` vacío,
    destino sin cambios; (d) el origen conserva contenido y `mtime` tras el traspaso;
    (e) ambos poblados con contenido distinto en el mismo archivo → el destino sobrevive
    sin alteración; (f) crear a mano un `<archivo>.migrating` huérfano en destino antes de
    correr → la corrida completa la copia real y no deja temporales al final. Correrlo
    primero contra el módulo inexistente (Task 2.2 aún no escrita) confirma el fallo en
    rojo — es la señal de que el arnés efectivamente ejercita el código y no un stub.
  - Criterio de completado: el script existe, cubre los 6 escenarios (a)-(f) uno por uno, y
    al ejecutarlo antes de la Task 2.2 falla por módulo inexistente (rojo confirmado).

- [x] **2.2 — [TDD] Implementar `src/main/userdata-migration.js`**
  (`src/main/userdata-migration.js`, nuevo)
  - Qué hacer, siguiendo D-1 a D-6 / ADR-0013 al pie de la letra:
    - Módulo libre de `electron`: solo `require('fs')` y `require('path')`. Las rutas
      llegan por parámetro, nunca `app.getPath()`.
    - Exports: `LEGACY_USERDATA_DIRNAME = 'cronometro-apps'`; `OWNED_FILES` = array con
      exactamente estos 8 nombres: `sessions.json`, `usage-log.txt`, `usage-log.txt.bak`,
      `settings.json`, `monitored-selection.json`, `installed-apps-cache.json`,
      `app-icons-cache.json`, `pomodoro-sessions.json`; `migrateUserDataAt({ sourceDir,
      targetDir })` → `{ copied, skipped, failed }` (arrays de nombres de archivo).
    - Si `sourceDir` no existe: retorna de inmediato con las tres listas vacías, sin crear
      ni tocar nada.
    - `fs.mkdirSync(targetDir, { recursive: true })` antes del bucle (autosuficiencia para
      el arnés de la Task 2.1, D-5).
    - Por cada archivo de `OWNED_FILES`: si no existe en `sourceDir` → `skipped`; si existe
      en `sourceDir` y ya existe en `targetDir` → `skipped` (el destino gana, sin fusión ni
      sobreescritura); si existe en `sourceDir` y no en `targetDir` → copiar con
      `fs.copyFileSync(source, target + '.migrating')` seguido de
      `fs.renameSync(target + '.migrating', target)`, y sumar a `copied`.
    - Cada archivo dentro de su propio `try/catch` (un fallo no bloquea a los otros 7);
      además el cuerpo completo en un `try/catch` exterior. La función **nunca lanza**: un
      fallo por archivo va a `failed` con el detalle del error.
    - El origen nunca se modifica: solo `fs.existsSync` y `fs.copyFileSync` en modo lectura
      sobre `sourceDir`. Sin `unlink`, sin `rename` sobre el origen.
    - Sintaxis: techo ES2016 estricto (nada de `??`, `?.`, `||=`, `&&=`, campos de clase,
      `Array.prototype.at`) — usar `const`/`let`, arrow functions, template literals,
      destructuring, `forEach`, `try/catch`, igual que el resto de `src/main/*.js`.
  - Criterio de completado: correr el arnés de la Task 2.1 contra esta implementación real
    — los 6 escenarios (a)-(f) pasan en verde, sin modificar el arnés para que pase.

- [x] **2.3 — Invocar el traspaso en `app.whenReady()`** (`src/background.js`)
  - Qué hacer: agregar `const userDataMigration = require('./main/userdata-migration.js')`
    junto a los demás `require` de `main/` (líneas 11-14). Dentro de
    `app.whenReady().then(async () => { ... })` (línea 134), como **primera sentencia del
    callback**, antes de la instalación de Vue Devtools, de `globalShortcut.register`, de
    `createTray()` y de `createWindow()`:
    ```js
    const result = userDataMigration.migrateUserDataAt({
      sourceDir: path.join(app.getPath('appData'), userDataMigration.LEGACY_USERDATA_DIRNAME),
      targetDir: app.getPath('userData'),
    })
    console.log(`Traspaso de userData: ${result.copied.length} copiado(s), ${result.skipped.length} omitido(s).`)
    if (result.failed.length > 0) {
      console.error('Traspaso de userData — archivos fallidos:', result.failed)
    }
    ```
    **No** ubicarlo dentro de `createWindow()`: es reentrante (lo llaman `whenReady`,
    `showMainWindow()` y el handler de `activate`), así que correría más de una vez por
    proceso sin necesidad.
  - Criterio de completado: lectura manual confirma que la invocación es la primera
    sentencia ejecutable del callback de `whenReady` (antes de cualquier otra línea del
    cuerpo existente); `userdata-migration.js` no se importa ni se invoca desde ningún otro
    punto del arranque.

- [x] **2.4 — Confirmar el techo sintáctico ES2016 en lo agregado**
  (`src/main/userdata-migration.js`, `src/background.js`)
  - Qué hacer: revisión manual línea por línea del módulo nuevo y de las líneas agregadas en
    `background.js` (Task 2.3): cero apariciones de `??`, `?.`, `||=`, `&&=`, campos de
    clase o `Array.prototype.at`. Recordatorio operativo: `npm run build` **no** detecta
    este techo — solo compila el renderer; la comprobación real exige `npm run
    electron:serve` o `npm run electron:build`, que no corren en WSL2.
  - Criterio de completado: revisión manual sin hallazgos. Queda registrado que la
    compilación real del bundle del main (niveles 2 y 3 de D-13 — máquina Windows del
    usuario o CI) se difiere a `sdd-verify`, no a esta fase.

---

## Fase 3 — Un único camino de build y una única configuración de lint

**Spec**: [[single-build-and-lint-pipeline]] · **Depende de**: nada (secuenciada después de
Fase 1 porque comparte `package.json` y cierra con la única regeneración del lock)

- [x] **3.1 — Crear `.nvmrc`** (`.nvmrc`, nuevo)
  - Qué hacer: contenido exacto `16.20.2` (D-10/ADR-0014: última mayor de Node con OpenSSL
    1.1.1, requisito duro del webpack 4.47.0 anidado que arma el bundle del main —
    `ERR_OSSL_EVP_UNSUPPORTED` en Node 17+).
  - Criterio de completado: `cat .nvmrc` imprime `16.20.2` sin saltos de línea extra
    significativos.

- [x] **3.2 — Eliminar `forge.config.js`** (`forge.config.js`, borrar)
  - Qué hacer: borrar el archivo completo. Es el sistema de build inactivo — nunca produjo
    binarios (el `app.asar` instalado lleva la firma de `vue-cli-plugin-electron-builder`).
  - Criterio de completado: el archivo no existe en el worktree.

- [x] **3.3 — Baja de scripts, dependencias y `eslintConfig` en `package.json`**
  (`package.json`)
  - Qué hacer: quitar del bloque `scripts` las claves `start`, `package`, `make`. Quitar de
    `dependencies` las claves `@shopify/draggable` y `electron-squirrel-startup`
    (verificado sin ninguna referencia en `src/` — distinto de `vuedraggable`, que sí se
    usa en `Menu.vue`, `CronometroAplicacion.vue` y `CronometroPomodoro.vue`, y que se
    conserva). Quitar de `devDependencies` las 8 claves: `@electron-forge/cli`,
    `@electron-forge/maker-deb`, `@electron-forge/maker-rpm`, `@electron-forge/maker-squirrel`,
    `@electron-forge/maker-zip`, `@electron-forge/plugin-auto-unpack-natives`,
    `@electron-forge/plugin-fuses`, `@electron/fuses`. Quitar el bloque completo
    `"eslintConfig": { ... }` (líneas 69-82 en el estado actual). **No** tocar los campos de
    identidad ya editados en la Task 1.1.
  - Criterio de completado:
    `node -e "const p=require('./package.json'); console.log(!('eslintConfig' in p), !('start' in p.scripts), !('@shopify/draggable' in p.dependencies), !('electron-squirrel-startup' in p.dependencies), !Object.keys(p.devDependencies).some(k=>k.startsWith('@electron-forge')||k==='@electron/fuses'))"`
    imprime `true` cinco veces.

- [x] **3.4 — Unificar ESLint en `.eslintrc.js`** (`.eslintrc.js`)
  - Qué hacer: cambiar `extends: ['plugin:vue/essential', 'eslint:recommended']` →
    `extends: ['plugin:vue/vue3-essential', 'eslint:recommended']`. Agregar dentro de
    `rules` la entrada `'vue/no-deprecated-destroyed-lifecycle': 'warn'`, con un comentario
    inmediatamente arriba que explique: en Vue 3 el hook `beforeDestroy` de
    `src/components/CronometroManual.vue:76` no se registra (`@vue/runtime-core` lo
    desestructura pero nunca lo pasa a `registerLifecycleHook`), así que el `clearInterval`
    de ese componente nunca corre al desmontar; corregirlo cambiaría el comportamiento de
    la aplicación, fuera del único ítem para el que este cambio relaja esa invariante
    (D-9/ADR-0014); el fix queda como issue de roadmap (Fase 6). **No** corregir
    `CronometroManual.vue` en este cambio — cambiaría comportamiento fuera de alcance.
  - Criterio de completado: `npm run lint -- --no-fix` termina con código de salida 0 y
    exactamente un warning, `vue/no-deprecated-destroyed-lifecycle` en
    `src/components/CronometroManual.vue:76`; cero errores.

- [x] **3.5 — Borrar los 6 PNG sin referencias en `src/assets/`** (`src/assets/`, borrar)
  - Qué hacer: borrar `Blender.png`, `CLIP STUDIO PAINT.png`, `Google Chrome.png`,
    `Toom Boom Storyboard Pro.png`, `Toon Boom Harmony Premium.png`, `VEGAS Pro.png`.
    Conservar `manual.png` (usado en `src/components/TitleBar.vue:10`, verificado por grep).
  - Criterio de completado: `ls src/assets/` solo lista `manual.png`; `npm run lint --
    --no-fix` sigue en 0 errores (ninguna referencia rota).

- [x] **3.6 — Ignorar `.sdd/` en control de versiones** (`.gitignore`)
  - Qué hacer: agregar la línea `/.sdd` a `.gitignore` (sección "Electron-builder output" u
    otra, sin reordenar el resto del archivo).
  - Criterio de completado: `git check-ignore -v .sdd` (corrido desde la raíz del repo, no
    del worktree) confirma que `.gitignore` lo captura.

- [x] **3.7 — Regenerar `package-lock.json`** (`package-lock.json`) — **depende de** Task 1.1
  y Task 3.3 (todos los cambios de `package.json` ya aplicados)
  - Qué hacer: correr `npm install --package-lock-only` desde la raíz del worktree. Es
    obligatorio: cambiar `name`/`version` y dar de baja 10 paquetes desalinea el lock
    (`lockfileVersion: 3` declara `name`/`version` en su raíz y en `packages[""]`), y **`npm
    ci` falla ante esa desalineación** — sin este paso, los dos workflows de Fase 5 mueren
    en la instalación.
  - Criterio de completado: `package-lock.json` queda versionado con `name: "work-tracker"`
    y `version: "2.0.0"` tanto en la raíz como en `packages[""]`; ninguna entrada de los 10
    paquetes dados de baja en la Task 3.3 aparece en el árbol resuelto
    (`node -e "console.log(Object.keys(require('./package-lock.json').packages).some(k=>k.includes('@electron-forge')||k.includes('@electron/fuses')||k.includes('@shopify/draggable')||k.includes('electron-squirrel-startup')))"`
    imprime `false`).

---

## Fase 4 — Documentos comunitarios

**Spec**: [[community-contribution-documents]] · **Depende de**: nada (sin código; usa el
nombre de producto de Fase 1 y el `.nvmrc` de Fase 3 como referencias de contenido, no como
bloqueo de ejecución)

- [x] **4.1 — Crear `LICENSE`** (`LICENSE`, nuevo)
  - Qué hacer: texto completo de la licencia MIT, con `Copyright (c) 2026 larayap`.
  - Criterio de completado: el archivo existe, contiene el texto MIT estándar íntegro y esa
    línea exacta de copyright.

- [x] **4.2 — Reescribir `README.md`** (`README.md`)
  - Qué hacer: reemplazar íntegramente la plantilla por defecto de Vue CLI. Cubrir: qué hace
    la aplicación; para quién es; que es Windows-only y por qué (referenciar ADR-0004);
    instalación desde el instalador publicado en Releases; compilación desde el código
    fuente usando la versión de Node declarada en `.nvmrc` (`nvm use`, `npm ci`, `npm run
    electron:build`); stack (Electron 13, Vue 3.2, Pinia); una mención breve de qué es
    `memory/` (con puntero a la explicación completa en `CONTRIBUTING.md`, para no duplicar
    contenido — SSOT); licencia (referencia a `LICENSE`, MIT). Sin capturas de pantalla
    (Clarification 4 — issue de roadmap, Fase 6). En español.
  - Criterio de completado: `grep -i "vue-cli\|This project"` (frases típicas de la
    plantilla de Vue CLI) no encuentra nada; el documento cubre las 6 secciones listadas.

- [x] **4.3 — Crear `CONTRIBUTING.md`** (`CONTRIBUTING.md`, nuevo)
  - Qué hacer: cubrir entorno de desarrollo (`.nvmrc`, `npm ci`, `npm run electron:serve`,
    advertencia explícita de que la aplicación solo corre en Windows — ADR-0004);
    Conventional Commits **en inglés**; convención de ramas `feature/*`; `npm run lint --
    --no-fix` con el motivo (autofix cambiaría comportamiento — D-9); una sección que
    explica que `memory/` es el conocimiento del proyecto (specs y ADRs del pipeline SDD),
    no código de la aplicación.
  - Criterio de completado: el documento cubre las 5 secciones listadas.

- [x] **4.4 — Crear `CODE_OF_CONDUCT.md`** (`CODE_OF_CONDUCT.md`, nuevo)
  - Qué hacer: adoptar el Contributor Covenant 2.1 íntegro. Canal de contacto: perfil de
    GitHub del mantenedor (`@larayap`) — **no** una dirección de correo.
  - Criterio de completado: el documento existe, es la versión 2.1 del Contributor
    Covenant, y no contiene ninguna dirección de correo electrónico.

- [x] **4.5 — Crear plantilla de reporte de fallo**
  (`.github/ISSUE_TEMPLATE/bug_report.md`, nuevo)
  - Qué hacer: plantilla guiada que pida: descripción del fallo, pasos para reproducir,
    comportamiento esperado vs. observado, versión de la aplicación, sistema operativo.
  - Criterio de completado: el archivo existe con esos campos guiados.

- [x] **4.6 — Crear plantilla de propuesta de función**
  (`.github/ISSUE_TEMPLATE/feature_request.md`, nuevo)
  - Qué hacer: plantilla guiada que pida: problema que la función resuelve, descripción de
    la función propuesta, alternativas consideradas (opcional).
  - Criterio de completado: el archivo existe con esos campos guiados.

- [x] **4.7 — Crear plantilla de Pull Request**
  (`.github/PULL_REQUEST_TEMPLATE.md`, nuevo)
  - Qué hacer: plantilla que guíe qué describir antes de que se revise el cambio: qué
    resuelve, cómo se probó, checklist de lint pasado (`npm run lint -- --no-fix`).
  - Criterio de completado: el archivo existe y guía la descripción del cambio propuesto.

---

## Fase 5 — CI: lint en cada PR y release por tag

**Spec**: [[pr-lint-and-tagged-release-workflow]] · **Depende de**: Fase 1 (versión e
identidad declaradas) y Fase 3 (lock regenerado, `.nvmrc` existente, lint unificado)

- [x] **5.1 — Crear `.github/workflows/lint.yml`** (`.github/workflows/lint.yml`, nuevo)
  - Qué hacer: `on: pull_request` (target `main`) más `push` a `main`; `runs-on:
    ubuntu-latest`. Pasos: `actions/checkout@v4`; `actions/setup-node@v4` con
    `node-version-file: .nvmrc` y `cache: npm`; `npm ci --ignore-scripts` (el
    `postinstall` corre `electron-builder install-app-deps`, innecesario para lintear y
    costoso/roto en Linux — `active-win@8.2.1` trae un binding nativo); `npm run lint --
    --no-fix`.
  - Criterio de completado: el YAML es válido; los pasos reproducen exactamente lo que
    `npm run lint -- --no-fix` corrido a mano en la Task 3.4 ya verificó (0 errores, 1
    warning esperado).

- [x] **5.2 — Crear `.github/workflows/release.yml`**
  (`.github/workflows/release.yml`, nuevo)
  - Qué hacer: `on: push` de tags `v*`; `runs-on: windows-latest` (único runner donde el
    target `nsis` produce el instalador — ADR-0004); `permissions: contents: write`. Pasos
    en este orden exacto:
    1. `actions/checkout@v4`.
    2. `actions/setup-node@v4` con `node-version-file: .nvmrc`.
    3. **Guarda tag↔versión, antes de compilar** (`shell: bash`): comparar
       `$GITHUB_REF_NAME` contra `v$(node -p "require('./package.json').version")`; si
       difieren, `exit 1`. Va antes de cualquier instalación o build para que una etiqueta
       inconsistente no produzca ningún artefacto (electron-builder no lee el tag: arma el
       nombre de la release como `v` + `package.json.version`).
    4. `npm ci` **con** scripts (sin `--ignore-scripts`): acá sí se necesita
       `electron-builder install-app-deps` para que el binding nativo de `active-win`
       quede construido contra el ABI de Electron.
    5. `npm run electron:build -- --publish always`, con `env: GH_TOKEN:
       ${{ secrets.GITHUB_TOKEN }}`.
  - Criterio de completado: el YAML es válido; el paso 3 (guarda) aparece antes que
    cualquier paso de instalación con scripts o de build; `releaseType: 'release'` ya
    quedó declarado en `vue.config.js` en la Task 1.2 (sin esto la release queda en
    `draft`, invisible para quien no sea mantenedor).

- [x] **5.3 — Verificar localmente lo que WSL2 permite** (sin archivo propio)
  - Qué hacer: no hay forma de ejercitar `windows-latest` ni el runner de GitHub Actions en
    este entorno. Verificar con `node -e` los dos casos de la guarda del paso 3 de la Task
    5.2 de forma aislada: (i) simular `GITHUB_REF_NAME=v2.0.0` contra `package.json.version
    = "2.0.0"` → el script de comparación no debe fallar; (ii) simular
    `GITHUB_REF_NAME=v9.9.9` contra la misma versión → el script debe terminar con código
    de salida distinto de 0. Confirmar también que `npm run lint -- --no-fix` (ya corrido en
    la Task 3.4) es representativo de lo que correrá `lint.yml`.
  - Criterio de completado: los dos casos de la guarda verificados localmente con el
    resultado esperado en cada uno. El disparo real de ambos workflows (PR real y tag real
    contra `windows-latest`) queda para `sdd-verify`, apoyado en la ejecución de GitHub
    Actions — no en un build local (state.md §Entorno).

---

## Fase 6 — Issues de roadmap (housekeeping de cierre)

No depende de ninguna fase anterior en términos de código, pero se ejecuta al final porque
consolida la deuda que las Fases 1-5 dejaron documentada explícitamente como fuera de
alcance.

- [x] **6.1 — Consolidar los issues de roadmap del cambio**
  - Qué hacer: dejar registrados, en un único lugar verificable — issues de GitHub abiertos
    en `sdd-archive` si el pipeline lo soporta, o en su defecto una sección explícita
    "Roadmap conocido" al final de `CONTRIBUTING.md` (Task 4.3) — los 6 ítems que este
    cambio deja fuera de alcance, ya documentados en `observations.md` y en `proposal.md`
    §Scope:
    1. **Electron 13 EOL** y migración del módulo `remote` (removido en Electron 14), usado
       hoy en `src/components/Menu.vue:55`, `src/components/TitleBar.vue:84` y
       `src/history/TitleBar.vue:23`, a `@electron/remote` o IPC directo.
    2. **`vue-cli-plugin-electron-builder` sin mantenimiento upstream** — evaluar reemplazo
       en un cambio propio, con su propia verificación (inverificable en WSL2).
    3. **Ausencia de test runner formal** — la única verificación disponible hoy es manual
       (`node -e`) o vía CI.
    4. **Ausencia de i18n** — la interfaz está 100% en español hardcodeado; un proyecto
       open source con vocación de comunidad externa eventualmente lo necesita.
    5. **Capturas de pantalla del README** (Clarification 4) — quedan pendientes de que el
       usuario las provea desde su máquina Windows; el README de la Task 4.2 se entrega sin
       ellas por decisión ya tomada.
    6. **El bug de `beforeDestroy` en `src/components/CronometroManual.vue:76`**
       (Task 3.4/D-9/ADR-0014): la regla de lint queda en `warn` con el defecto real
       documentado; el fix (`beforeDestroy` → `beforeUnmount`) cambia comportamiento y
       exige su propio cambio con su propia verificación.
  - Criterio de completado: los 6 ítems quedan enumerados en un único lugar verificable
    (issues de GitHub o sección de `CONTRIBUTING.md`); ninguno se resuelve dentro de este
    cambio.

---

## Nota de cierre — verificación por niveles (D-13)

`sdd-verify` no puede compilar el instalador `.exe` en WSL2. Los criterios de completado de
arriba ya distinguen lo verificable localmente (nivel 1: lógica pura con `node -e`, lint,
grep de literales) de lo que queda pendiente para:

- **Nivel 2** (`npm run electron:serve` contra el `%APPDATA%` real, vía interop con la
  máquina Windows del usuario — coordinar ventana de tiempo, esa máquina es su escritorio en
  uso): confirma que el traspaso de la Fase 2 corre de verdad contra datos reales, y que
  `app.getName()` en desarrollo resuelve `work-tracker` (el plugin copia el `package.json`
  del proyecto a `dist_electron/`).
- **Nivel 3** (CI en `windows-latest`, único runner que compila el target `nsis`): valida el
  frente completo de la Fase 5 — lint en PR y el flujo de release por tag, incluida la
  resolución real del binding nativo de `active-win`.

No hay tarea de esta lista que dependa de esos dos niveles para considerarse completada según
su propio criterio local; son responsabilidad explícita de `sdd-verify`.
