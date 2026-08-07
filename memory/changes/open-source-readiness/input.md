---
type: external-input
domain: debt
change_name: "open-source-readiness"
created: "2026-08-06"
---

# Input externo para open-source-readiness

## Estado actual

El repo `cronometro-app` es un proyecto personal publicado en GitHub
(`git@github.com:larayap/cronometro-app.git`) que funciona pero carece de todo lo que
un tercero necesita para usarlo, contribuir o redistribuirlo.

**Bloqueadores de participación externa:**

- **Sin `LICENSE`**. Por defecto legal el código queda bajo "todos los derechos
  reservados": nadie puede forkear, contribuir ni redistribuir de forma lícita.
- **`README.md` es la plantilla por defecto de Vue CLI** (`npm install`, `npm run serve`,
  enlace a la Configuration Reference). No explica qué hace la app, para quién es, en qué
  sistema operativo corre, ni cómo instalarla desde un binario.
- **Sin `CONTRIBUTING.md`, sin `CODE_OF_CONDUCT.md`, sin `.github/`** (plantillas de
  issue y PR ausentes).
- **Sin releases publicadas y sin CI**: no existe `.github/workflows/`. Una persona que
  no programa no tiene ningún artefacto descargable.

**Identidad del producto fragmentada en tres nombres distintos:**

| Ubicación | Valor actual |
|---|---|
| `package.json` → `name` | `cronometro-apps` |
| `vue.config.js` → `productName` / `win.executableName` | `Workout` |
| `vue.config.js` → `appId` | `com.tuapp.cronometroapps` |
| Repo GitHub | `cronometro-app` |

El `appId` conserva el marcador `tuapp` de la plantilla original.

**Residuos técnicos verificados:**

- `@shopify/draggable` en `dependencies` sin ninguna referencia en `src/` (grep sin
  resultados) — el drag & drop activo usa `vuedraggable`.
- 6 PNG sin referencias en `src/assets/`: `Blender.png`, `CLIP STUDIO PAINT.png`,
  `Google Chrome.png`, `Toom Boom Storyboard Pro.png`,
  `Toon Boom Harmony Premium.png`, `VEGAS Pro.png`. Quedaron obsoletos cuando la
  extracción nativa de íconos (ADR-0005) reemplazó los logos estáticos.
  `manual.png` SÍ sigue en uso (7 referencias) — es el ícono del modo manual.
- **Dos sistemas de build conviven**: `@electron-forge/cli` 7.7 (`start`/`package`/`make`)
  y `vue-cli-plugin-electron-builder` (`electron:build`/`electron:serve`). Un
  contribuidor externo no puede saber cuál es el flujo real.
- `forge.config.js` declara makers `@electron-forge/maker-deb`,
  `@electron-forge/maker-rpm` y `@electron-forge/maker-zip` para `darwin`, pese a que la
  app es Windows-only de facto: todo el código dependiente del SO vive en
  `src/main/platform-windows.js` (PowerShell + `tasklist` + registro de Windows,
  ADR-0004). Esos tres makers producirían binarios rotos.

## Estado deseado

El repo se presenta como **Tickmark**, un proyecto open source listo para recibir
usuarios y contribuidores, sin cambiar el comportamiento de la aplicación.

1. **Higiene del repo**
   - `LICENSE` con el texto MIT, titular `larayap`, año 2026.
   - `README.md` real: qué hace la app, para quién, capturas, requisito **Windows-only**
     explícito, instalación desde Releases para usuarios finales y desde el código para
     desarrolladores, stack, licencia y forma de apoyar el proyecto.
   - `CONTRIBUTING.md`: cómo levantar el entorno, convención de commits, convención de
     ramas, y una explicación de qué es el directorio `memory/` para que un contribuidor
     externo no lo confunda con código de la aplicación.
   - `CODE_OF_CONDUCT.md` (Contributor Covenant).
   - `.github/ISSUE_TEMPLATE/` (reporte de fallo y solicitud de función) y
     `.github/PULL_REQUEST_TEMPLATE.md`.

2. **Limpieza técnica sin cambio de comportamiento**
   - Identidad unificada bajo `Tickmark` en `package.json` y `vue.config.js`
     (`name`, `productName`, `executableName`, `appId`, `description`, campo `repository`).
   - `@shopify/draggable` eliminada de `dependencies`.
   - Los 6 PNG sin referencias eliminados; `manual.png` intacto.
   - Un solo sistema de build. La evidencia apunta a `vue-cli-plugin-electron-builder`
     como el flujo activo real: `vue.config.js` tiene `pluginOptions.electronBuilder`
     completo (target `nsis`, `icon`, bloque `publish` a GitHub), `package.json` declara
     `"main": "background.js"` (el bundle que genera ese plugin), y no existe ninguna
     referencia a electron-forge en `src/` ni `public/`. `forge.config.js` es la
     plantilla por defecto sin personalizar.

3. **CI + releases**
   - Workflow de lint que corre en cada Pull Request.
   - Workflow de release que compila el instalador `.exe` en `windows-latest` y lo
     publica en GitHub Releases al empujar un tag.

## Archivos/módulos afectados

**Nuevos:**
- `LICENSE`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/` (lint en PR + release por tag)

**Modificados:**
- `README.md` (reescritura completa)
- `package.json` (`name`, `description`, `author`, `repository`, scripts, `dependencies`)
- `vue.config.js` (`appId`, `productName`, `executableName`, bloque `publish`)

**Eliminados:**
- `forge.config.js`
- `src/assets/Blender.png`
- `src/assets/CLIP STUDIO PAINT.png`
- `src/assets/Google Chrome.png`
- `src/assets/Toom Boom Storyboard Pro.png`
- `src/assets/Toon Boom Harmony Premium.png`
- `src/assets/VEGAS Pro.png`

**Intocables (invariante de este cambio):** todo `src/main/`, `src/components/`,
`src/stores/`, `src/history/`, `src/utils/`, `src/plugins/`, `src/sounds/` y
`src/assets/manual.png`. Este cambio no modifica el comportamiento de la aplicación.

## Justificación de prioridad

El objetivo declarado del usuario es convertir el proyecto en una app comunitaria y
sostenerla con donaciones. Los cuatro frentes están ordenados por lo que bloquea a quién:

1. **`LICENSE` es el bloqueador duro.** Sin licencia explícita, la participación externa
   es legalmente inviable. Cuesta un archivo y desbloquea todo lo demás.
2. **`README` + Releases son el bloqueador del usuario final.** La audiencia objetivo
   (gente que usa Blender, Clip Studio Paint, Toon Boom o VEGAS Pro y quiere medir sus
   horas) no compila desde el código fuente. Sin un `.exe` descargable y un README que
   explique qué es la app, el repo solo alcanza a programadores.
3. **La limpieza técnica es el bloqueador del contribuidor.** Dos sistemas de build
   compitiendo y makers que generan binarios rotos hacen que el primer intento de
   compilar de un tercero falle o produzca algo inservible.
4. **El costo es bajo y el riesgo acotado**: ningún ítem toca la lógica de la
   aplicación, por lo que el riesgo de regresión funcional se concentra únicamente en
   el renombrado de identidad del paquete y en la eliminación del sistema de build
   inactivo.

## Restricciones

- **Entorno**: el usuario trabaja en WSL2. El instalador `.exe` NO se puede compilar ni
  verificar localmente; la verificación del frente 3 depende de la ejecución en CI
  (`windows-latest`).
- **Fuera de alcance de este cambio** (documentar como issues o roadmap, no resolver):
  - Electron 13 (2021, EOL, sin parches de seguridad). Subirlo exige migrar el módulo
    `remote`, removido en Electron 14, usado en `src/components/Menu.vue:55`,
    `src/components/TitleBar.vue:84` y `src/history/TitleBar.vue:23`.
  - `vue-cli-plugin-electron-builder` está sin mantenimiento.
  - Sin tests automatizados ni test runner.
  - UI 100% en español hardcodeada.
  - El sitio web estático y la integración de donaciones viven en OTRO repo.
