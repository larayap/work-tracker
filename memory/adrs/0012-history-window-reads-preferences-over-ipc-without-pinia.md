---
type: adr
title: "La ventana de historial lee las preferencias por IPC en su shell, sin montar Pinia en ese bundle"
status: accepted
supersedes: null
superseded_by: null
amends: "[[0010-charting-library-confined-to-history-bundle]]"
created: "2026-08-05"
change_ref: "[[work-groups-history-time-format]]"
capability: "app-settings"
tags: [adr]
---

# La ventana de historial lee las preferencias por IPC en su shell, sin montar Pinia en ese bundle

## Context

[[configurable-time-format-preference]] agrega una preferencia de usuario (formato de hora
12h/24h) cuyo **único consumidor** es el rango horario de la vista por sesión, que vive en la
ventana de historial (`src/history/BySessionView.vue`).

Las preferencias existentes (volumen) viven en `useSettingsStore` (Pinia), que se monta en la
ventana del cronómetro. El reflejo natural es reusar ese store en la ventana de historial. Al
mapear el costo real aparecen dos hechos que lo desaconsejan:

1. **La ventana de historial no monta Pinia.** `src/history/main.js` es
   `createApp(HistoryView)` + `app.use(VCalendar)`. Usar el store obliga a agregar
   `createPinia()` a ese entry.
2. **`@/stores/settings` importa `@/plugins/sound`**, que en el tope del módulo construye
   cinco objetos `Howl` con `preload: true`. Importar el store desde la ventana de historial
   arrastra `howler` y los cinco `.mp3` al bundle de esa ventana y **precarga cinco audios en
   una ventana que no emite ningún sonido**.

El segundo punto es la imagen espejo del problema que ADR-0010 resuelve. Ese ADR fija que la
ventana del cronómetro —siempre abierta— no carga código de graficado. La dirección inversa
—qué del bundle del cronómetro se filtra hacia el historial— no estaba cubierta por ninguna
decisión.

El otro dato del entorno que acota la decisión: `background.js` crea una `BrowserWindow`
**nueva en cada apertura** del historial (`ipcMain.on('open-history-window')`, sin reutilizar
ninguna referencia). Cada apertura es un renderer nuevo que corre su `created()`.

## Decision

**La ventana de historial no monta Pinia.** Las preferencias que necesita las lee por IPC en
su shell (`HistoryView.vue`), con el canal `get-settings` que ya existe, y las baja a los
componentes hijos por prop.

Eso mantiene intacta la arquitectura ya vigente de esa ventana (D-10): `HistoryView.vue` es el
**único punto de IPC**, y `ByAppView`/`BySessionView`/`UsageChart` son componentes de
presentación pura que reciben todo por prop.

El store Pinia conserva la preferencia para el lado **escritor** (`OpcionesPanel.vue`, en la
ventana del cronómetro). No son dos fuentes de verdad: la fuente es `settings.json` en el main
(ADR-0006) y las dos ventanas la leen por el mismo canal.

El flujo de preferencia queda así, y es el que hay que sostener para cualquier preferencia
futura que la ventana de historial necesite:

```
settings.json (userData, main)                 ← SSOT (ADR-0006)
  ├─ get-settings  → useSettingsStore.load()   → OpcionesPanel (lee y escribe)
  └─ get-settings  → HistoryView.data()        → prop → BySessionView (solo lee)
```

**El canal es de tipo pull, no push.** No se agrega ninguna difusión de "settings cambiaron"
hacia los renderers.

## Consequences

**Positivas:**

- El bundle de historial no incorpora `pinia`, `howler` ni los cinco `.mp3`, y no precarga
  audio en una ventana muda.
- No se toca el entry `src/history/main.js` ni el ciclo de vida de esa ventana.
- El contrato de presentación pura de los hijos del historial se mantiene: `BySessionView`
  recibe el formato por prop y sigue siendo verificable con props fabricadas.
- Agregar una segunda preferencia al historial es una línea más en el mismo `created()`, sin
  decisión nueva.

**Trade-offs:**

- **La preferencia se lee en la apertura de la ventana, no en vivo.** Una ventana de historial
  que ya está abierta cuando el usuario cambia el formato en el panel de Opciones sigue
  mostrando el formato anterior hasta que se la cierra y se la vuelve a abrir. La lectura
  literal del escenario de la spec (*"todo horario de reloj que la aplicación muestre a partir
  de ese momento"*) se cumple para toda ventana abierta después del cambio, no para una ya
  abierta. Es el trade-off explícito de esta decisión, no un olvido: la alternativa está
  evaluada más abajo.
- Dos lugares del código leen `get-settings` (el store y el shell del historial). Es
  duplicación de **llamada**, no de fuente: el default y el archivo siguen siendo únicos y
  viven en el main.
- La invariante no la impone ninguna herramienta: nada en el build impide importar el store
  desde `src/history/`. Se sostiene con este ADR y con la ubicación de los archivos, igual que
  ADR-0010.

## Alternatives Considered

- **Montar Pinia en `src/history/main.js` y usar `useSettingsStore`**: es la opción de menos
  líneas y da reactividad entre ventanas… que igual no existe, porque dos `BrowserWindow` son
  dos procesos de renderizado con dos instancias de Pinia distintas: el store del historial no
  se entera de un cambio hecho en el store del cronómetro. Se descarta porque paga el costo de
  bundle (howler + cinco audios precargados) sin comprar el beneficio que aparenta.
- **Refactorizar `stores/settings.js` para que no importe `@/plugins/sound`** (mover la
  aplicación del volumen a quien llama las acciones) y recién entonces usar el store en el
  historial: elimina el arrastre de audio, pero deja igual el problema de las dos instancias de
  Pinia, agrega Pinia al bundle del historial y toca un módulo que hoy funciona, por una
  preferencia con un solo consumidor. Se descarta por YAGNI.
- **Difundir `settings-updated` desde `save-settings` a todos los renderers** (unas seis
  líneas: `webContents.getAllWebContents().forEach(...)` en el main y un `ipcRenderer.on` en el
  shell del historial): resolvería la ventana ya abierta. Se descarta porque agrega una
  superficie arquitectónica nueva —un canal push de configuración main→renderers, que hoy no
  existe: el flujo de settings es enteramente pull— por un caso de uso que exige tener las dos
  ventanas abiertas a la vez y cambiar la preferencia en el medio. Queda registrado como la
  mitigación exacta a aplicar si el usuario objeta el comportamiento; el costo de aplicarla
  después es el mismo que aplicarla ahora.
