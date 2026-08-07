# Work Tracker

Cronómetro de tiempo de uso de aplicaciones de escritorio para Windows, con historial,
pomodoro y selección de programas monitoreados.

## Qué hace

Work Tracker corre en la bandeja del sistema y mide cuánto tiempo pasás con cada aplicación
de escritorio abierta y en foco. Elegís qué programas monitorear, revisás el historial de uso
por día y por aplicación, y usás el temporizador Pomodoro integrado sin salir de la misma
herramienta.

## Para quién es

Para cualquier persona que quiera entender en qué reparte su tiempo frente a aplicaciones de
escritorio en Windows: quien factura por horas, quien quiere poner límites a una app puntual,
o quien simplemente quiere datos en vez de intuición.

## Sistema operativo

**Solo Windows.** La detección de la ventana en foco, la enumeración de aplicaciones
instaladas y la extracción de íconos se apoyan en mecanismos específicos de Windows
(PowerShell, registro del sistema) concentrados en un único módulo del main process —
ver [ADR-0004](memory/adrs/0004-os-dependent-code-single-module.md). No hay soporte para
macOS ni Linux hoy.

## Instalación

Descargá el instalador (`.exe`) más reciente desde la sección
[Releases](https://github.com/larayap/work-tracker/releases) del repositorio y ejecutalo.

## Compilar desde el código fuente

Requiere la versión de Node declarada en [`.nvmrc`](.nvmrc) (Node 16.20.2 — el bundle del
main process lo arma un webpack 4 anidado que no soporta versiones más nuevas de OpenSSL).

```bash
nvm use
npm ci
npm run electron:build
```

El instalador queda en `dist_electron/`. Para desarrollo con recarga en caliente:

```bash
npm run electron:serve
```

## Stack

- [Electron](https://www.electronjs.org/) 13
- [Vue](https://vuejs.org/) 3.2
- [Pinia](https://pinia.vuejs.org/) como store

## Sobre `memory/`

El directorio `memory/` en la raíz del repositorio no es código de la aplicación: es el
conocimiento acumulado del proyecto (specs, decisiones de arquitectura, historial de cambios)
que produce y consume el pipeline de desarrollo interno del equipo. Un colaborador externo
puede ignorarlo por completo. El detalle está en
[`CONTRIBUTING.md`](CONTRIBUTING.md#sobre-memory).

## Licencia

[MIT](LICENSE) — Copyright (c) 2026 larayap.
