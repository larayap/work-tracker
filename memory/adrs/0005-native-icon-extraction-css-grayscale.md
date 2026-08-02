---
type: adr
title: "Íconos extraídos con app.getFileIcon, cacheados por ruta de ejecutable y renderizados en gris por CSS"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-01"
change_ref: "[[app-detection-logos-audio]]"
capability: "app-icons"
tags: [adr]
---

# Íconos extraídos con app.getFileIcon, cacheados por ruta de ejecutable y renderizados en gris por CSS

## Context

El ícono de cada programa depende hoy de que alguien haya cargado a mano un PNG en
`src/assets/` con el nombre exacto que Windows reporta para el proceso —de ahí archivos como
`CLIP STUDIO PAINT.png` o `Google Chrome.png`— y de un `require` dinámico en el componente
con `idk.png` como respaldo cuando el archivo no existe. Es mantenimiento manual del
desarrollador y solo funciona para los programas previstos de antemano.

`automatic-bw-icons` pide obtener el ícono del propio ejecutable, mostrarlo en escala de
grises de forma uniforme, conservar una imagen de respaldo cuando la extracción no entrega
un ícono útil y evitar repetir la extracción en aperturas sucesivas.

Hay una condición que restringe el diseño: el ícono también se necesita para programas de la
selección guardada cuyo proceso todavía no está abierto —el selector muestra aplicaciones
instaladas, y una fila puede existir antes de que el programa arranque. La extracción no
puede depender de que haya un proceso vivo.

Electron 13 expone `app.getFileIcon(path, options)`, que devuelve una promesa de
`NativeImage`, y `nativeImage#toDataURL()`. `NativeImage` no atraviesa el IPC: el Structured
Clone Algorithm no lo serializa.

## Decision

La extracción vive en el **main process**: `app.getFileIcon(exePath, { size: 'normal' })`
produce un `NativeImage` que se serializa con `toDataURL()`. La clave de todo el pipeline es
la **ruta del ejecutable**, que es el mismo dato con el que el motor correlaciona procesos y
el mismo que entrega el selector de instaladas.

La caché es de **dos niveles y con clave `exePath` normalizada a minúsculas**: un mapa en
memoria para el acceso del proceso en curso, y un archivo JSON en `userData` que sobrevive
al reinicio. La caché en disco es la que permite mostrar el ícono de un programa de la
selección guardada apenas arranca la app, sin volver a tocar el sistema de archivos.

La extracción se dispara por **ruta y no por fila**: cualquier ruta conocida —de una fila
viva o de una entrada de la selección guardada sin fila— es extraíble, porque el ejecutable
existe en el disco con independencia de que haya un proceso corriendo.

El **respaldo** es `src/assets/idk.png`, que ya cumple ese papel. Se usa cuando
`getFileIcon` rechaza, cuando la imagen resultante responde `isEmpty()`, o cuando la entrada
no tiene ruta de ejecutable resoluble. La decisión se toma en el main y el renderer recibe
un valor u otro sin ramificar.

La **conversión a escala de grises se hace en el renderer con `filter: grayscale(1)`**. El
dato que viaja y se cachea es el ícono original a color; el gris es tratamiento visual.

Los íconos **no viajan en el snapshot de estado**. El snapshot lleva `exePath` por fila; el
renderer pide por un canal propio los íconos de las rutas que todavía no tiene y los guarda
en su store.

## Consequences

**Positivas:**

- Ningún ícono depende de un archivo cargado a mano con el nombre exacto del programa.
- Sin dependencias nuevas: `app.getFileIcon` y `nativeImage` son API estándar de Electron 13,
  y `filter: grayscale()` es CSS.
- El tratamiento gris es uniforme por construcción, no por preparación de cada asset.
- La caché en disco por ruta cumple el requisito de no repetir la extracción en aperturas
  sucesivas y hace que el ícono esté disponible antes de que el programa se abra.
- Mantener el ícono a color en la caché deja abierto mostrarlo a color sin volver a
  extraerlo, y hace del gris un parámetro de presentación y no una propiedad del dato.
- Sacar los íconos del snapshot mantiene el mensaje de estado pequeño: un data URL de ícono
  pesa varios kilobytes y el snapshot se emite cada segundo.

**Trade-offs:**

- `getFileIcon` en Windows entrega 32x32 con `size: 'normal'`, y la fila muestra 32px, así
  que no hay margen para escalar sin pixelar si el diseño visual crece.
- Algunos ejecutables devuelven un ícono genérico del shell en vez del suyo. El respaldo no
  cubre ese caso porque la imagen no está vacía: se muestra el genérico. Es degradación
  visual acotada y declarada como riesgo de la propuesta.
- El gris por CSS es solo visual: si en el futuro hiciera falta el bitmap ya en gris —para
  el ícono de bandeja, por ejemplo— habría que procesarlo aparte.
- La caché en disco crece con cada ruta distinta vista y no se purga. Con el volumen
  esperado —decenas de entradas de unos kilobytes— no justifica una política de expiración.

## Alternatives Considered

- **Conversión a gris en el main process**, entregando al renderer un bitmap ya desaturado:
  daría un dato consistente en cualquier contexto de uso. Se descarta porque `nativeImage`
  no expone manipulación de píxeles y habría que convertir a buffer y aplicar luminancia a
  mano, o sumar una dependencia de procesamiento de imágenes, pesada y con compilación
  nativa que complica el empaquetado. El caso que lo justificaría —gris real fuera de un
  `<img>`— no existe en este cambio.
- **Extraer el ícono en el renderer**: se descarta porque `app.getFileIcon` es API del main
  process y el acceso al sistema de archivos pertenece a ese lado.
- **Cachear por nombre de programa en vez de por ruta**: sería consistente con el mapeo
  actual de assets. Se descarta porque el nombre no identifica un ejecutable —dos
  instalaciones distintas pueden compartirlo— y porque la ruta ya es la clave de
  correlación del motor y del selector, así que usarla mantiene una sola identidad en todo
  el cambio.
- **Incluir el ícono en el snapshot de estado**: evita un canal. Se descarta porque
  multiplicaría por mil el tamaño de un mensaje que se emite cada segundo, para un dato que
  cambia una vez por programa.
- **Precargar el ícono de toda la selección guardada al arrancar**: se descarta por
  innecesario. La caché en disco ya resuelve el arranque, y las rutas nuevas se piden cuando
  aparecen.
