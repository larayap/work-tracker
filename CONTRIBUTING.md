# Contribuir a Work Tracker

Gracias por considerar aportar a Work Tracker. Esta guía cubre cómo levantar el entorno de
desarrollo, qué convenciones seguir y qué es el directorio `memory/` que vas a ver en la raíz
del repositorio.

## Entorno de desarrollo

**La aplicación solo corre en Windows** — ver [ADR-0004](memory/adrs/0004-os-dependent-code-single-module.md).
Desarrollar o probar cambios requiere una máquina Windows.

Usá la versión de Node declarada en [`.nvmrc`](.nvmrc):

```bash
nvm use
npm ci
npm run electron:serve
```

`npm run electron:serve` levanta la aplicación con recarga en caliente contra tu `%APPDATA%`
real.

## Convención de mensajes de cambio

[Conventional Commits](https://www.conventionalcommits.org/), **en inglés**. Ejemplos:
`feat(pomodoro): add pause button`, `fix(session-log): handle missing usage-log.txt`.

## Convención de ramas

`feature/<descripción-corta>` para cualquier trabajo en curso, ramificado desde `main`.

## Verificación de estilo de código

```bash
npm run lint -- --no-fix
```

**Usá siempre `--no-fix`.** `vue-cli-service lint` corrige automáticamente por defecto, y una
de las reglas activas (`vue/no-deprecated-destroyed-lifecycle`, ver más abajo) es
autocorregible: el autofix renombraría un hook de ciclo de vida y cambiaría el comportamiento
de la aplicación sin que nadie lo pida. El mismo comando corre en integración continua ante
cada Pull Request.

## Sobre `memory/`

`memory/` no es código de la aplicación: es el conocimiento del proyecto que produce y
consume el pipeline de desarrollo interno del equipo (specs de comportamiento, decisiones de
arquitectura registradas como ADR, historial de cambios). No hace falta leerlo ni entenderlo
para contribuir código — un Pull Request no necesita tocarlo. Si te interesa el razonamiento
detrás de una decisión de diseño puntual, ahí está documentado.

## Abrir una contribución

Usá la plantilla que aparece al abrir el Pull Request. Antes de pedir revisión, confirmá que
`npm run lint -- --no-fix` termina sin errores.

## Roadmap conocido

Los siguientes ítems quedan fuera del alcance del trabajo de apertura a código abierto y
están documentados acá para quien quiera tomarlos como una futura contribución:

1. **Electron 13 está fuera de soporte (EOL)** y el módulo `remote` que usa hoy
   (`src/components/Menu.vue`, `src/components/TitleBar.vue`, `src/history/TitleBar.vue`) se
   removió en Electron 14. Subir de versión mayor exige migrar a `@electron/remote` o a IPC
   directo.
2. **`vue-cli-plugin-electron-builder` no tiene mantenimiento activo upstream.** Evaluar un
   reemplazo es un cambio propio, con su propia verificación.
3. **No hay un test runner formal.** Hoy la única verificación disponible es manual o vía
   integración continua.
4. **No hay internacionalización (i18n).** La interfaz está enteramente en español
   hardcodeado; un proyecto con vocación de comunidad externa eventualmente la necesita.
5. **El README no tiene capturas de pantalla.** Quedan pendientes de que se agreguen desde una
   máquina Windows real.
6. **El hook `beforeDestroy` de `src/components/CronometroManual.vue` está deprecado en
   Vue 3** y nunca se registra (`@vue/runtime-core` lo desestructura pero no lo pasa a
   `registerLifecycleHook`), así que el `clearInterval` de ese componente no corre al
   desmontar. La regla de lint que lo señala está en `warn` a propósito — corregirlo
   (`beforeDestroy` → `beforeUnmount`) cambia el comportamiento de la aplicación y merece su
   propio cambio con su propia verificación.
