---
type: tech-context
change_name: "open-source-readiness"
created: "2026-08-06"
source: "código instalado en node_modules/ del proyecto (versiones fijadas por package-lock.json, lockfileVersion 3)"
tags: [change]
---

# Contexto técnico de librerías externas — open-source-readiness

Cada afirmación de abajo está verificada leyendo el código realmente instalado, no documentación.
Las versiones están fijadas por `package-lock.json`, así que ese código es la fuente autoritativa
para este cambio; no se consultó context7 porque la documentación pública describe versiones
actuales y este toolchain está anclado varias mayores atrás.

## vue-cli-plugin-electron-builder 2.1.1

- **Empaqueta copiando el `package.json` del proyecto** (`index.js:159-173`), quitando de
  `dependencies` todo lo que no sea external. No inyecta `productName` ni ningún otro campo. De ahí
  que `app.getName()` —y por lo tanto `app.getPath('userData')`— resuelva por `package.json.name`.
- En desarrollo copia el `package.json` del proyecto a `dist_electron/` (`index.js:309`), así que
  `electron:serve` usa el mismo nombre de aplicación —y el mismo `userData`— que el paquete
  instalado.
- `electron:build` parsea los argumentos crudos con la configuración yargs de electron-builder
  (`index.js:86-89`): acepta todas las opciones de CLI de electron-builder, incluida
  `--publish always`.
- El bundle del main process lo arma un **webpack 4.47.0 con acorn 6.4.2 anidados**, sin loader de
  Babel para `.js`. Consecuencias: `??` y `?.` rompen el build con `Module parse failed`; object
  spread (ES2018) sí compila (`src/main/ipc-handlers.js:63-66` es la prueba en el propio
  repositorio); y `npm run build` **no** compila el main, solo el renderer.
- webpack 4 hashea con `md4`: bajo Node 17 o superior, OpenSSL 3 rechaza ese algoritmo y el build
  falla con `ERR_OSSL_EVP_UNSUPPORTED`. Es la restricción que fija Node 16 en CI.

## electron-builder 22.14.13

- El publicador de GitHub usa **`draft` por defecto**
  (`electron-publish/out/gitHubPublisher.js:52`: `options.draft === false ? "release" : "draft"`).
  Para que el instalador quede descargable hace falta `releaseType: 'release'` explícito en el
  bloque `publish`.
- El orden de resolución del tipo de release es `EP_DRAFT` → `EP_PRE_RELEASE` → `releaseType` de la
  configuración → `prerelease` → default. Un `releaseType` configurado gana sobre la detección
  automática de prerelease por versión.
- **El tag lo calcula, no lo lee**: `this.tag = v${version}` a partir de `package.json.version`, y
  lanza si la versión empieza con `v`. Sin una guarda propia en el workflow, un tag que no coincida
  con la versión declarada publicaría igual, con el nombre derivado de la versión.
- El token se toma de `GH_TOKEN` o `GITHUB_TOKEN` (`app-builder-lib/out/publish/PublishManager.js:344`).

## eslint 7.32.0 + eslint-plugin-vue 8.7.1

- Precedencia de configuración: `.eslintrc.js` gana sobre `package.json.eslintConfig`, así que hoy
  la configuración de `package.json` no se aplica nunca.
- Medición directa sobre todo `src/` del worktree: con `plugin:vue/essential`, cero errores; con
  `plugin:vue/vue3-essential`, **un solo error** —`vue/no-deprecated-destroyed-lifecycle` en
  `src/components/CronometroManual.vue:76`—, marcado como autocorregible.
- `vue-cli-service lint` corrige por defecto: en CI y en implementación se usa `--no-fix`.

## vue 3.5.13

- `@vue/runtime-core` desestructura `beforeDestroy` pero **nunca lo registra**: solo
  `beforeUnmount` llega a `registerLifecycleHook`. El hook deprecado es código muerto en Vue 3, no
  un alias.

## active-win 8.2.1

- Trae `binding.gyp` y un script `install` con `node-pre-gyp install --fallback-to-build`: la
  instalación descarga un binario precompilado o compila `sources/windows/main.cc`. El job de lint
  lo evita con `npm ci --ignore-scripts`; el de release lo necesita, junto con
  `electron-builder install-app-deps`, para que el binding quede construido contra el ABI de
  Electron.

## npm / lockfile

- `package-lock.json` es `lockfileVersion: 3`, legible por npm 7 en adelante (Node 16 trae npm 8).
- Su raíz y su entrada `packages[""]` declaran `name` y `version`: cambiar la identidad en
  `package.json` sin regenerar el lock desalinea ambos archivos y **`npm ci` falla**.
- El registro npm es alcanzable desde este entorno, así que
  `npm install --package-lock-only` se puede ejecutar durante la implementación.
