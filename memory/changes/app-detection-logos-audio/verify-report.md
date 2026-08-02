---
type: verify-report
change_name: "app-detection-logos-audio"
created: "2026-08-01"
tags: [verify-report]
---

# Verify Report: app-detection-logos-audio (pasada 2)

**Fecha**: 2026-08-01
**Veredicto**: ⚠️ PARTIAL — causa exclusiva y declarada: limitación de entorno (sin Windows real). Ningún defecto de código pendiente. Enrutar como PASS.

Este documento reemplaza por completo el `verify-report.md` de la pasada 1 (veredicto ❌
FAIL). Los dos defectos que motivaron ese FAIL fueron corregidos por `sdd-apply` en los
commits `dc5d5d2` y `cdaf80b`, y esta pasada los verifica con evidencia propia — no repite
el reporte de `sdd-apply`, reproduce independientemente sus pasos y agrega verificaciones
adicionales (reactividad de Pinia, resolución de webpack sobre el `require` cruzado a
`public/`).

## Nota de entorno

WSL2/Linux, sin Windows real ni `powershell.exe`. No se pudo ejecutar la app ni el guion
manual de 26 puntos de `design.md`. Lo que sí se hizo en esta fase:

- Lectura completa del código de las 11 specs contra su implementación real.
- `npx eslint src --ext .js,.vue` — limpio.
- `npx vue-cli-service build` — renderer (index + history) compila sin errores.
- `npx vue-cli-service electron:build --dir` — build empaquetado real
  (`dist_electron/linux-unpacked/resources/app.asar`) generado de nuevo en esta pasada,
  independientemente del que generó `sdd-apply`.
- `npx asar extract` sobre ese `app.asar`, inspección directa de su contenido.
- Extracción y comparación byte a byte (`md5sum`) de los assets embebidos en el bundle
  compilado del renderer contra los archivos fuente.
- `node -e` directo sobre las funciones puras del motor y utilidades (`reduceLifecycle`,
  `reduceFocus`, `removeRow`, `buildSessionLine`, `filterInstalledApps`), reproduciendo los
  escenarios de la pasada 1 para confirmar que los dos commits de fix no rompieron nada.
- `node -e` con `@vue/reactivity` (la librería de reactividad que Pinia usa internamente)
  para confirmar el comportamiento exacto de la reactividad de Vue 3 sobre el que descansa
  el fix 2.
- Artefactos de build (`dist/`, `dist_electron/`) eliminados al cerrar; worktree limpio.

---

## Verificado OK (evidencia propia de esta pasada)

### Fix 1 — `icon-cache.js#getFallbackDataUrl`: `__static` en vez de `app.getAppPath()`

**Código actual** (`src/main/icon-cache.js:36`):
```js
const idkPath = path.join(__static, 'img', 'idk.png')
```

**Verificación independiente, no solo lectura**:

```
$ npx vue-cli-service electron:build --dir --linux dir
...
DONE  Build complete!
$ find dist_electron -iname "*.asar"
dist_electron/linux-unpacked/resources/app.asar
$ npx asar extract dist_electron/linux-unpacked/resources/app.asar /tmp/.../asar-extract
$ ls /tmp/.../asar-extract/img/
icon-work.png  idk.png
$ ls /tmp/.../asar-extract/src   →  No such file or directory
$ md5sum /tmp/.../asar-extract/img/idk.png public/img/idk.png
614c620cfb4892fa495ce8c8237784d1  /tmp/.../asar-extract/img/idk.png
614c620cfb4892fa495ce8c8237784d1  public/img/idk.png
```

`img/idk.png` está en la raíz del `app.asar`, junto a `icon-work.png` (el ícono de bandeja
que ya usaba el mismo patrón `__static`), con contenido idéntico byte a byte al archivo
fuente. Confirmado además que la raíz del asar **no contiene ningún directorio `src/`**
— la ruta vieja (`app.getAppPath() + 'src/assets/idk.png'`) nunca hubiera resuelto en
ningún build empaquetado, en ninguna plataforma; esto reproduce independientemente el
hallazgo de la pasada 1.

Confirmado también en `node_modules/vue-cli-plugin-electron-builder/index.js:613,618` que
`__static` se define como `__dirname` (raíz de `directories.app`) en build empaquetado, y
como la carpeta `public/` del proyecto en dev — coherente con el comentario del propio
`icon-cache.js` y con el patrón ya usado en `src/background.js:29,65` para `icon-work.png`.

Contra `tech-context.md` (SSOT de Electron 13): `nativeImage.createFromPath` y
`image.toDataURL()` están documentados con la firma usada; no se consultó context7.

**Acceptance criterion afectado** (`automatic-bw-icons`, "Un programa sin ícono útil
muestra la imagen de respaldo en vez de un espacio en blanco o roto"): **cumplido**, mecanismo
primario (`icon-cache.js`) y no solo por la redundancia de `AppRow.vue`.

### Decisión colateral — `AppRow.vue` requiere `../../public/img/idk.png`

Riesgo señalado en el encargo: un `require` del renderer cruzando a `public/` podría no ser
procesado por webpack (rompiendo el build o dejando un `src` vacío). Verificado contra el
**bundle compilado**, no por lectura:

```
$ npx vue-cli-service build   → compila sin errores
$ node -e "... extraer todos los data:image/png;base64,... de dist/js/index.*.js"
count: 2
0 len 3479   (md5 3c195dd9... → no es idk.png, es otro asset del bundle, manual.png)
1 len 1996   (md5 614c620c... → coincide exactamente con public/img/idk.png)
```

El segundo data URL embebido en el bundle del renderer es **byte a byte idéntico**
(`md5sum` igual) al `public/img/idk.png` fuente. Esto confirma que webpack sí resuelve y
procesa el `require('../../public/img/idk.png')` de `AppRow.vue` — lo trata como un módulo
de imagen (mismo `url-loader` que ya usaba `@/assets/idk.png` antes del cambio) y lo inlinea
como data URI porque está bajo el umbral de tamaño, exactamente el mismo resultado que
tenía el `require` anterior a `src/assets/`. No hay parpadeo en blanco: el `src` del `<img>`
nunca queda vacío.

`dist/img/idk.png` también aparece como archivo suelto en el build del renderer — eso es
la copia verbatim de `public/` que hace `vue-cli-service` (irrelevante para este `require`,
coexiste sin conflicto).

### Fix 2 — `monitoredApps.js#ensureIcon`: guard por `hasOwnProperty`

**Código actual** (`src/stores/monitoredApps.js:47`):
```js
if (!exePath || Object.prototype.hasOwnProperty.call(this.icons, exePath)) return
```

Confirmado contra `src/components/CronometroAplicacion.vue:73-76` que el defecto descrito
en la pasada 1 era real: `watch: { 'monitoredApps.rows'(rows) { rows.forEach(row =>
ensureIcon(row.exePath)) } }` se dispara en cada snapshot (cada tick, D2/D17, porque `rows`
se reemplaza por referencia). Con el guard viejo (`this.icons[exePath]` a secas), una
resolución legítima a `null` nunca "contaba" como resuelta y el IPC `get-app-icon` se
reemitía cada segundo. Con `hasOwnProperty`, una clave asignada en `null` cuenta como
resuelta y el guard corta correctamente.

**Reactividad de Vue 3/Pinia — verificado empíricamente, no asumido**:

```js
const { reactive, effect } = require('@vue/reactivity')
const state = reactive({ icons: {} })
let renders = 0
effect(() => { renders++; state.icons['a.exe'] })
// renders === 1
state.icons['a.exe'] = null   // asignación de clave NUEVA con valor null
// renders === 2   → el efecto se re-ejecutó: la asignación fue reactiva
// Object.prototype.hasOwnProperty.call(state.icons, 'a.exe') === true
```

Confirmado con la librería de reactividad real que Pinia usa internamente (Proxy-based,
Vue 3): a diferencia de Vue 2 (que requería `Vue.set`/`Vue.delete` para que la adición de
una clave nueva fuera reactiva), el Proxy de Vue 3 intercepta la asignación de una clave
inexistente igual que la de una existente — `this.icons[exePath] = dataUrl` sigue siendo
reactivo sin ninguna API adicional, tanto si `dataUrl` es una cadena como si es `null`. El
fix no introduce ningún problema de reactividad.

### Re-verificación de los 5 puntos de riesgo de la pasada 1 (sin regresión)

Ninguno de los archivos que implementan estos puntos (`src/main/monitor-engine.js`,
`src/main/session-log.js`, `src/main/installed-apps-filter.js`, `src/components/AppRow.vue`
salvo la línea del `require`) fue tocado por los dos commits de esta iteración —
confirmado por `git show --stat` de `dc5d5d2` y `cdaf80b`: solo tocan `icon-cache.js`,
`monitoredApps.js`, `AppRow.vue` (una línea) y el `git mv` del asset. Se repitieron, además,
las pruebas puras de la pasada 1 para descartar cualquier efecto colateral:

```
D6 pid:null no sale con lista vacía de vivos:            PASS
vinculación asigna pid sin resetear elapsedMs:            PASS
proceso muerto → closed (equivalencia ■/cierre):          PASS
removeRow saca fila y la retorna:                         PASS
reduceFocus: solo la fila enfocada corre:                 PASS
reduceFocus: sin match, todas pausadas:                   PASS
límite de 4: alta no ocurre con 4 filas ya presentes:     PASS
buildSessionLine: formato coincide con la regex real:     PASS
filterInstalledApps: Discord y Clip Studio sobreviven,
  actualizador se descarta:                                PASS
```

Los 5 puntos de riesgo (separación de las dos señales D1/ADR-0001, equivalencia ■/cierre de
proceso, selección guardada ≠ listado visible, indicador ▶/⏸ no interactivo, regla D6) se
confirman **sin regresión**. `AppRow.vue` sigue con `pointer-events: none` y sin `@click` en
`.status-indicator`; `aria-label` describe estado, no acción.

### Coherencia de Grafo de Specs

Repetida sobre las 11 specs de `spec_refs`: mismo resultado que la pasada 1, sin
inconsistencias.

- `row-lifecycle.depends_on = [two-state-row-machine, saved-selection-only-monitoring]` ↔
  ambas declaran `affects: [row-lifecycle]` ✅
- `two-state-row-machine.affects = [row-lifecycle, status-indicator-non-interactive]` ↔
  ambas declaran `depends_on` incluyendo `two-state-row-machine` ✅
- `session-log-persistence.depends_on = [row-lifecycle]` ↔ `row-lifecycle.affects` la
  incluye ✅
- `simultaneous-limit.depends_on = [row-lifecycle]` ↔ `row-lifecycle.affects` la incluye ✅
- `empty-state.depends_on = [row-lifecycle]` ↔ `row-lifecycle.affects` la incluye ✅
- `automatic-bw-icons.depends_on = [row-lifecycle]` ↔ `row-lifecycle.affects` la incluye ✅
- `installed-apps-listing-quality`: sin `depends_on`/`affects`; `related` simétrico con
  `saved-selection-only-monitoring` y `row-lifecycle` ✅
- `status-indicator-non-interactive.depends_on = [two-state-row-machine]` ↔ ya cubierto ✅
- `dual-volume-control`, `dark-loading-state`: sin `depends_on`/`affects` — nada que validar

**Resultado**: sin inconsistencias, sin WARN, sin FAIL. Grafo bidireccionalmente coherente
en las 11 specs.

### `verified_at`

Actualizado a `"2026-08-01"` en las 11 specs de `spec_refs` (validación principal PARTIAL
por causa exclusiva de entorno, tratada como PASS a efectos de este contrato).

---

## Cierre de acceptance criteria por spec

| Spec | Marcados `[x]` | Motivo de lo no marcado |
|---|---|---|
| `automatic-bw-icons` | 3/3 | — (spec del fix; los 3 quedan cerrados con la evidencia de esta pasada) |
| `row-lifecycle` | 6/6 | — |
| `two-state-row-machine` | 4/4 | — |
| `saved-selection-only-monitoring` | 4/4 | — |
| `session-log-persistence` | 5/5 | — |
| `simultaneous-limit` | 3/3 | — |
| `empty-state` | 4/4 | — |
| `status-indicator-non-interactive` | 4/4 | — |
| `dual-volume-control` | 4/4 | — |
| `dark-loading-state` | 2/2 | — |
| `installed-apps-listing-quality` | 1/4 | Ver "Pendiente de Windows" — 3 criterios describen datos reales del sistema (instaladas reales, listado completo sin ruido, procesos abiertos reales) que la función pura no puede sustituir |

Para los 10 primeros, el criterio de cierre fue: la cadena causal completa del
comportamiento descrito es verificable sin datos reales de Windows (lógica pura ejercitada
con `node -e`, lectura de código, o inspección del bundle/HTML compilado). Cuando el
criterio depende de que el sistema operativo real entregue datos concretos (lista de
programas instalados, procesos en ejecución), se dejó sin marcar aunque el mecanismo que
los consume esté probado.

---

## Pendiente de Windows

1. **`installed-apps-listing-quality`, criterio "Con Discord y Clip Studio instalados,
   ambos aparecen"**: requiere la enumeración real de accesos directos del Menú Inicio +
   correlación con el registro (`listInstalledCandidates`, Tarea 25). La función pura
   `filterInstalledApps` fue ejercitada con entradas fabricadas equivalentes (Discord sin
   marcas de descarte) y las deja pasar intactas, pero eso no reemplaza observar el listado
   real. **Cómo verificar en Windows**: abrir el selector de instaladas con Discord y Clip
   Studio Paint realmente instalados y confirmar que ambos aparecen.
2. **`installed-apps-listing-quality`, criterio "ninguna entrada runtime/actualizador/
   redistribuible/servicio"**: mismo motivo — la calidad del filtro sobre el universo
   completo de accesos directos reales del sistema no es observable sin ese sistema.
   **Cómo verificar**: recorrer el listado completo en un equipo con instalaciones típicas
   (Discord, navegadores, Office, etc.) y confirmar ausencia de runtimes/actualizadores.
3. **`installed-apps-listing-quality`, criterio "elegir desde procesos abiertos"**: la
   sintaxis PowerShell de `listInstalledCandidates` no es ejecutable en WSL2 (no hay
   `powershell.exe`), y el listado de procesos abiertos real depende de `active-win` sobre
   ventanas reales. El wiring de UI (`AppSelectorModal.vue`, tab "Procesos abiertos",
   `chooseOpenWindow` → `addApp`) está verificado por lectura de código, pero la elección
   real desde un proceso real no se puede reproducir. **Cómo verificar**: abrir un programa
   portable sin acceso directo reconocible, verificar que aparece en la pestaña "Procesos
   abiertos" y que se puede agregar desde ahí.
4. **Guion manual completo de `design.md` (26 puntos)**: percepción visual/auditiva real,
   comportamiento de `ResizeObserver`/`setContentSize` con la ventana real de Windows.
5. **`activeWin().owner.processId`**: si viene poblado al cambiar el foco entre programas
   reales — D4 ya lo trata como refuerzo no obligatorio, degrada sin romper si falta.
6. **Extracción real de `app.getFileIcon`**: si entrega ícono útil para la mayoría de
   programas reales de Windows (el mecanismo de extracción y el de respaldo ya están
   verificados independientemente; falta observar la tasa real de éxito de la extracción
   misma).

Ninguno de estos puntos es un defecto de código: todos son observaciones que solo un
entorno Windows real puede producir. No se atribuyen al veredicto como causa de FAIL.

## Defecto encontrado

Ninguno. Los dos defectos de la pasada 1 quedan corregidos y verificados con evidencia
propia de esta pasada (ver "Verificado OK" arriba). No se generó ninguna spec delta.

## Acciones Requeridas

Ninguna sobre código. El cambio queda listo para `sdd-archive` en cuanto el orquestador
complete el routing post-verify — las specs quedan en `status: review` (el cambio de
`status` a `completed` es responsabilidad de `sdd-archive`, no de esta fase).
