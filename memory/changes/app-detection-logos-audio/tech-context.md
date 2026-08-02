---
type: tech-context
change_name: "app-detection-logos-audio"
consulted_at: "2026-08-01"
source: context7
libraries:
  - name: "electron"
    version_in_project: "^13.0.0"
    context7_id: "/electron/electron"
  - name: "howler"
    version_in_project: "^2.2.4"
    context7_id: "/goldfire/howler.js"
  - name: "pinia"
    version_in_project: "^3.0.2"
    context7_id: "/websites/pinia_vuejs"
  - name: "active-win"
    version_in_project: "^8.2.1"
    context7_id: null
tags: [tech-context]
---

# Tech Context: app-detection-logos-audio

Consulta única a context7 con fecha **2026-08-01**. Las fases posteriores del pipeline
consumen este archivo y no repiten la consulta.

> **Nota de versión**: el proyecto fija `electron: ^13.0.0`. La documentación de context7
> corresponde a la rama `main` de Electron. Cada API listada abajo incluye la verificación
> explícita de disponibilidad en Electron 13; las APIs posteriores a 13 quedan marcadas
> como no utilizables y con su alternativa.

---

## Electron 13 — `/electron/electron`

### `app.getFileIcon(path[, options])`

Obtiene el ícono asociado a una ruta. En Windows recupera el ícono específico del archivo
o de su extensión.

```
app.getFileIcon(path[, options]) → Promise<NativeImage>

path    (string)  requerido — ruta al archivo
options (Object)  opcional
  size  (string)  'small'  → 16x16
                  'normal' → 32x32   (default)
                  'large'  → 48x48 en Linux, 32x32 en Windows, sin soporte en macOS
```

Disponibilidad en Electron 13: **sí**. La firma basada en Promise existe desde Electron 5;
en 13 es la única forma (la variante con callback quedó removida). Corre únicamente en el
**main process**.

Uso en este cambio: extracción del ícono real del ejecutable de cada programa monitoreado.

### `nativeImage` — instancia y serialización

```
image.toDataURL([options]) → string
  options.scaleFactor (Number) opcional, default 1.0
  Devuelve "data:image/png;base64,…" — preserva la información de colorspace del PNG

image.isEmpty() → boolean
  true cuando la imagen no tiene contenido útil

nativeImage.createFromPath(path) → NativeImage
  Devuelve una imagen vacía si la ruta no existe, no se puede leer o no es una imagen válida
```

Disponibilidad en Electron 13: **sí** para las tres.

`image.toDataURL()` es el puente para mandar el ícono por IPC: un `NativeImage` no es
serializable por el Structured Clone Algorithm, un data URL sí.

`image.isEmpty()` es el predicado de "no hay ícono útil" que dispara la imagen de respaldo.

### `nativeImage.createThumbnailFromPath(path, size)` — NO disponible en Electron 13

```
nativeImage.createThumbnailFromPath(path, size) → Promise<NativeImage>
```

Introducida después de Electron 13. **No se usa en este cambio.** La alternativa vigente es
`app.getFileIcon`, que cubre el caso (ícono del ejecutable) sin depender de esta API.

### `BrowserWindow` — mostrar la ventana sin destello

Documentación de Electron, sección *Showing the window gracefully*:

> Para evitar un destello visual al cargar una página se usa el evento `ready-to-show`, que
> se emite cuando el proceso de renderizado pintó la página por primera vez. Mostrar la
> ventana después de ese evento garantiza que no haya destello. Como alternativa, para apps
> complejas donde `ready-to-show` puede llegar tarde, se define `backgroundColor` cercano al
> fondo de la app para mostrar la ventana de inmediato. **Definir `backgroundColor` es
> recomendable incluso cuando se usa `ready-to-show`**, para una sensación más nativa.

```javascript
const win = new BrowserWindow({ show: false, backgroundColor: '#1b1b1b' })
win.once('ready-to-show', () => { win.show() })
```

Evento `ready-to-show`: se emite cuando la página web se renderizó y la ventana puede
mostrarse sin destello. Usar el evento implica que el renderer se considera visible y pinta
aunque `show` sea `false`. El evento no se emite si `paintWhenInitiallyHidden` es `false`
(opción que este proyecto no usa).

Disponibilidad en Electron 13: **sí** para `backgroundColor`, `show: false` y
`ready-to-show`. `mainWindow` del proyecto ya usa `backgroundColor: '#0f0f0f'` y
`show: false`.

### IPC — `ipcMain` / `ipcRenderer`

```
ipcMain.handle(channel, listener)
  listener(event, ...args) → Promise<any> | any
  Responde a ipcRenderer.invoke(channel, ...args)
  Los errores lanzados en el handler se serializan: solo viaja la propiedad `message`

ipcMain.on(channel, listener)
  listener(event, ...args)
  Responde a ipcRenderer.send(channel, ...args) — sin valor de retorno

webContents.send(channel, ...args)
  Empuja un mensaje del main al renderer
```

```javascript
// Renderer
ipcRenderer.invoke('some-name', someArgument).then((result) => { /* … */ })
// Main
ipcMain.handle('some-name', async (event, someArgument) => {
  return await doSomeWork(someArgument)
})
```

Los argumentos se serializan con el **Structured Clone Algorithm**: objetos planos, arrays,
números, strings y booleanos viajan; objetos DOM, funciones, instancias de clase con
prototipo y `NativeImage` lanzan excepción o pierden identidad. Todo payload de este cambio
se define como objeto plano.

Disponibilidad en Electron 13: **sí**. `ipcMain.handle`/`ipcRenderer.invoke` existen desde
Electron 7. El proyecto ya los usa (`get-open-windows`, `load-sessions`, `get-app-logs`).

---

## howler 2.2 — `/goldfire/howler.js`

### Volumen global

```javascript
import { Howl, Howler } from 'howler'

Howler.volume()      // lee el volumen global
Howler.volume(0.5)   // fija el volumen global de todos los sonidos
Howler.mute(true)    // silencia todo
```

Definición de la documentación oficial:

> `volume([volume])` — Get/set the **global volume for all sounds, relative to their own
> volume**. Volume from `0.0` to `1.0`.

La relación es **multiplicativa**: el volumen efectivo de un sonido es
`Howler.volume() × howl.volume()`. Ese es exactamente el modelo de dos controles que pide
`dual-volume-control`.

### Volumen por instancia `Howl`

```javascript
const sound = new Howl({ src: ['audio.mp3'], volume: 0.8 })

sound.volume()        // lee el volumen del grupo
sound.volume(0.5)     // fija el volumen del grupo (afecta todos sus sonidos)
sound.volume(id)      // lee el volumen de una instancia concreta
sound.volume(0.3, id) // fija el volumen de una instancia concreta
```

`volume([volume], [id])`: sin `id`, todos los sonidos del grupo cambian su volumen relativo
al propio. El proyecto usa un `Howl` por sonido, así que `howl.volume(v)` es el control por
sonido.

Aplicación en este cambio:
- `Howler.volume(master)` → control maestro, afecta los cinco sonidos.
- `howl.volume(interaccion)` sobre `add`, `popUp`, `pressButton`, `deleteItem` → control de
  sonidos de interacción.
- `endSession` conserva `volume(1)` → queda regido solo por el maestro.

---

## Pinia 3 — `/websites/pinia_vuejs`

### Option Store (el estilo que usa el proyecto en `src/stores/menu.js`)

```javascript
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0, name: 'Eduardo' }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
  actions: {
    increment() {
      this.count++   // acceso directo al estado vía `this`
    },
  },
})
```

Las actions admiten cualquier cantidad de argumentos y pueden ser `async`. Como dependen de
`this`, no se escriben como arrow functions.

### Consumo desde Options API

```javascript
import { mapActions } from 'pinia'
import { useCounterStore } from '../stores/counter'

export default {
  methods: {
    ...mapActions(useCounterStore, ['increment']),
    ...mapActions(useCounterStore, { myOwnName: 'increment' }),
  },
}
```

El proyecto usa hoy la vía directa (`appStore: useAppStore()` en `data()`), que sigue siendo
válida y es la que este cambio mantiene por consistencia.

---

## active-win 8 — sin cobertura en context7

La búsqueda de `active-win` en context7 no devuelve la librería (los resultados son
homónimos sin relación: `x-win`, `active_merchant`, `active_scaffold`). No hay documentación
vigente que persistir para esta dependencia.

Contrato observado en el código del proyecto, que es la referencia disponible:

```javascript
const activeWin = require('active-win')
const winInfo = await activeWin()
// winInfo.owner.name → nombre del proceso propietario de la ventana en foco
// winInfo.owner.path → ruta del ejecutable
```

`src/background.js:156-170` usa `winInfo.owner.name` y `winInfo.owner.path` en producción,
así que ambos campos están confirmados por uso.

`winInfo.owner.processId` figura en la documentación pública de la librería pero **no está
confirmado por uso en este repositorio**. El diseño lo trata como dato deseable y define
`owner.path` como clave primaria de correlación, de modo que la ausencia de `processId`
degrada sin romper. `sdd-apply` verifica la presencia del campo en la primera ejecución.
