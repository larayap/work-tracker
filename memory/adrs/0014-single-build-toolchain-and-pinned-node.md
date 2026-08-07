---
type: adr
title: "Un único camino de build sobre vue-cli-plugin-electron-builder, con Node fijado en .nvmrc y una sola configuración de ESLint"
status: accepted
supersedes: null
superseded_by: null
amends: null
created: "2026-08-06"
change_ref: "[[open-source-readiness]]"
capability: "build-toolchain"
tags: [adr]
---

# Un único camino de build sobre vue-cli-plugin-electron-builder, con Node fijado en .nvmrc y una sola configuración de ESLint

## Context

El repositorio declara **dos sistemas de build**: `vue-cli-plugin-electron-builder` (scripts
`electron:serve` / `electron:build`) y electron-forge (`forge.config.js` sin personalizar, siete
paquetes `@electron-forge/*`, `@electron/fuses` y los scripts `start`/`package`/`make`). Solo el
primero produjo binarios: el `app.asar` instalado lleva su firma —`main: background.js`,
`dependencies` podadas a las externals—, que es exactamente lo que hace
`vue-cli-plugin-electron-builder/index.js:159-173`. Forge nunca empaquetó nada, y sus makers
`deb`/`rpm`/`zip@darwin` producirían binarios rotos en una aplicación Windows-only
([[0004-os-dependent-code-single-module]]).

La configuración de ESLint también está duplicada, con reglas distintas: `.eslintrc.js` extiende
`plugin:vue/essential` (Vue 2) y `package.json.eslintConfig` extiende `plugin:vue/vue3-essential`.
Por el orden de precedencia de ESLint gana `.eslintrc.js`, de modo que una aplicación Vue 3.5 se
lintea hoy con el conjunto de reglas de Vue 2 y la configuración de `package.json` no se aplica
nunca.

El proyecto pasa a tener CI, así que la versión de Node deja de ser un detalle de cada máquina y
se vuelve parte del contrato de build. No había ninguna declarada.

## Decision

**Un solo sistema de build: `vue-cli-plugin-electron-builder`.** Se elimina `forge.config.js`, los
siete paquetes `@electron-forge/*`, `@electron/fuses` y los scripts `start`/`package`/`make`.
Migrar hacia forge se descarta: reescribiría el pipeline del main process y es inverificable en el
entorno de desarrollo actual (WSL2, sin build de Windows).

**Node 16.20.2, declarado una sola vez en `.nvmrc`** y consumido por los dos workflows con
`node-version-file: .nvmrc`, además de por quien clona el repositorio. El motivo es una
restricción dura del toolchain: el bundle del main process lo arma el **webpack 4.47.0 anidado**
dentro de `vue-cli-plugin-electron-builder`, que hashea con `md4`; desde Node 17, OpenSSL 3
rechaza ese algoritmo y el build falla con `ERR_OSSL_EVP_UNSUPPORTED`. Node 16 es la última mayor
con OpenSSL 1.1.1 y su npm 8 lee el `lockfileVersion: 3` del proyecto sin problema.

**Una sola configuración de ESLint: `.eslintrc.js`**, con `extends` corregido a
`plugin:vue/vue3-essential`. Se elimina el bloque `eslintConfig` de `package.json`. Se conserva el
archivo `.eslintrc.js` porque es el que ESLint ya elige, porque contiene ajustes que la copia de
`package.json` no tiene —`globals.__static`, `parser: 'vue-eslint-parser'`, `ecmaVersion`,
`sourceType`— y porque admite comentarios, donde queda documentada la excepción siguiente.

El cambio a `vue3-essential` produce **un único error nuevo** en todo `src/`, medido ejecutando
ESLint con ambas configuraciones: `vue/no-deprecated-destroyed-lifecycle` en
`src/components/CronometroManual.vue:76`. Señala un defecto real —en Vue 3 el hook `beforeDestroy`
no se registra, así que ese `clearInterval` nunca corre al desmontar—, y corregirlo cambia el
comportamiento de la aplicación, que este cambio no hace fuera del traspaso de `userData`. La
regla queda declarada en `'warn'` con un comentario que explica el hallazgo: CI queda verde
—ESLint termina con código 0 ante advertencias—, la señal sigue visible en cada ejecución y el
arreglo se hace en su propio cambio.

**El lint se ejecuta con `--no-fix`.** `vue-cli-service lint` corrige por defecto, y esa regla es
autocorregible: `npm run lint` a secas renombraría el hook y cambiaría el comportamiento sin que
nadie lo pida.

**Dos workflows.** `lint.yml` corre en `ubuntu-latest` sobre cada pull request con `npm ci` —sin
`--ignore-scripts`— y `npm run lint -- --no-fix`. `release.yml` corre en `windows-latest` ante un
tag `v*`, valida el tag contra `package.json.version` **antes** de compilar, y publica con
`npm run electron:build -- --publish always` y `GH_TOKEN`.

**`npm ci` en `lint.yml` corre con scripts, no con `--ignore-scripts` como preveía este ADR en su
versión original (D-11).** `--ignore-scripts` rompe el lint, no solo lo hace más lento: `vue-cli-service`
carga en el arranque, para cualquier comando, **todos** los plugins instalados —lint incluido, no
solo `electron:build`— y `vue-cli-plugin-electron-builder/index.js` reexporta a nivel de módulo
`testWithSpectron` (línea 710: `module.exports.testWithSpectron = require('./lib/testWithSpectron')`),
cuyo primer `require` es `require('electron')` (`lib/testWithSpectron.js:2`). El paquete `electron`
resuelve su binario leyendo `node_modules/electron/path.txt`
(`node_modules/electron/index.js:9-18`), un archivo que solo escribe el `postinstall` propio de
`electron` — el mismo que `--ignore-scripts` omite. Verificado de forma directa: con `path.txt`
renombrado fuera del camino, `node -e "require('vue-cli-plugin-electron-builder')"` lanza
`Error: Electron failed to install correctly, please delete node_modules/electron and try
installing again` antes de que `vue-cli-service lint` llegue a ejecutar una sola regla. La premisa
original de D-11 —que el `postinstall` del proyecto (`electron-builder install-app-deps`) es "el"
costo a evitar en Linux— pasaba por alto que el problema no es ese `postinstall`, sino el de
`electron` mismo, que `--ignore-scripts` desactiva junto con todos los demás. `active-win@8.2.1` sí
compila sin incidentes contra Node 16 en un runner Linux equivalente a `ubuntu-latest` (~12s), así
que dejar los scripts activos no reintroduce el costo que D-11 buscaba evitar.

Dos detalles que la publicación exige y que no son evidentes: electron-builder **no lee el tag**
—arma el nombre de la release como `v` + `package.json.version`—, de donde la guarda previa es lo
único que impide publicar una release con un nombre distinto del tag empujado; y el publicador de
GitHub usa `draft` cuando no se le dice otra cosa
(`electron-publish/out/gitHubPublisher.js:52`), así que el bloque `publish` declara
`releaseType: 'release'` para que el instalador quede efectivamente descargable.

## Consequences

**Positivas:**

- Un colaborador encuentra un único camino de build y un único conjunto de reglas de estilo, con
  el mismo resultado en su máquina y en CI.
- La versión de Node deja de ser folclore oral: `.nvmrc` la declara una vez y la usan el
  desarrollador, el job de lint y el job de release.
- El lint pasa a aplicar las reglas de la versión de Vue que el proyecto realmente usa.
- El paquete distribuible adelgaza: ocho dependencias de desarrollo y dos de producción menos.
- La publicación de releases deja de ser manual, y una etiqueta inconsistente falla antes de
  producir cualquier artefacto.

**Trade-offs:**

- Se hereda una dependencia de build sin mantenimiento upstream, con webpack 4 anidado y el techo
  sintáctico que impone al main process. La deuda queda documentada, no resuelta.
- Node 16 está fuera de soporte. Se acepta porque el job compila una aplicación de escritorio desde
  un lockfile fijo, no expone un servicio, y porque la alternativa sostiene la misma dependencia
  vieja con una variable de entorno mágica en cada job.
- Un defecto real de `CronometroManual.vue` queda declarado como advertencia en vez de corregido.
- El job de release depende de que `active-win@8.2.1` resuelva o compile su binding nativo en
  `windows-latest`: es el paso con más probabilidad de fallar la primera vez.

## Alternatives Considered

- **Migrar a electron-forge y dar de baja el plugin de Vue CLI**: forge está mantenido y el plugin
  no. Se descarta porque reescribiría el pipeline del main process de una aplicación que ya publica
  binarios con el otro camino, y porque el resultado es inverificable localmente en WSL2 — el
  riesgo se pagaría entero en la máquina de los usuarios.
- **Conservar los dos sistemas de build**: cero trabajo. Se descarta porque es exactamente lo que
  la spec prohíbe: un colaborador no puede saber cuál es el camino real, y los makers de forge
  producirían binarios rotos para una aplicación Windows-only.
- **`package.json.eslintConfig` como fuente única**: concentra la configuración en un archivo menos.
  Se descarta porque perdería `globals.__static` y la declaración explícita de parser, no admite
  comentarios y no es la que ESLint elige hoy.
- **Corregir `beforeDestroy` → `beforeUnmount` en `CronometroManual.vue`**: deja el lint limpio sin
  excepciones. Se descarta porque cambia el comportamiento de la aplicación —el `clearInterval`
  pasaría a ejecutarse— fuera del único ítem para el que este cambio relajó esa invariante.
- **Silenciar la regla con `'off'`**: mismo efecto sobre CI, menos ruido. Se descarta porque borra
  la señal de un defecto real en vez de dejarla a la vista hasta que se corrija.
- **Node 18 o 20 con `NODE_OPTIONS=--openssl-legacy-provider`**: usa una versión con soporte. Se
  descarta como decisión primaria por sumar una variable de entorno a cada job para sostener la
  misma dependencia vieja. Queda registrada como contingencia si `actions/setup-node` deja de
  resolver Node 16.
- **Publicar la release como borrador y confirmarla a mano** (el comportamiento por defecto de
  electron-builder): da una última revisión antes de exponer el binario. Se descarta porque el
  criterio de aceptación pide que el instalador quede disponible al empujar el tag, y porque el
  borrador es invisible para cualquiera que no sea mantenedor — el fallo sería silencioso.
