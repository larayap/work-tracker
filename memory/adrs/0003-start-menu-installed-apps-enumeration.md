---
type: adr
title: "Enumeración de apps instaladas desde los accesos directos del Menú Inicio, con filtrado puro y caché revalidada"
status: accepted
supersedes: null
superseded_by: null
created: "2026-08-01"
change_ref: "[[app-detection-logos-audio]]"
capability: "app-installed-selector"
tags: [adr]
---

# Enumeración de apps instaladas desde los accesos directos del Menú Inicio, con filtrado puro y caché revalidada

## Context

`installed-apps-listing-quality` eleva la calidad del listado a criterio de aceptación: un
listado que muestre runtimes, actualizadores, redistribuibles o servicios de fondo se
considera incumplido. El listado debe mostrar el nombre legible que el propio programa
presenta, admitir filtrado por texto y ofrecer el listado de procesos abiertos como segunda
vía.

La fuente habitual para enumerar software instalado en Windows son las claves
`…\Uninstall` del registro. Devuelven todo lo que declaró un desinstalador: redistribuibles
de Visual C++, parches `KB######`, runtimes, componentes de sistema. Muchas entradas no
apuntan a un ejecutable lanzable, sino a una cadena de desinstalación. Partir de ahí obliga
a construir un filtro que separe la basura del contenido, y el resultado del filtro es
exactamente lo que decide si la feature sirve.

El listado además tiene que entregar tres datos que consumen otras piezas del cambio: el
nombre legible que se muestra en la fila, la ruta del ejecutable —que alimenta tanto la
extracción del ícono como la correlación con el proceso— y una identidad estable para
deduplicar y para persistir la selección guardada.

El proyecto ya usa PowerShell vía `child_process.exec` como puente al sistema operativo en
`get-open-windows`, sin dependencias nativas.

## Decision

La **fuente del listado son los accesos directos `.lnk` del Menú Inicio**, recorridos
recursivamente sobre las dos raíces:

- `%ProgramData%\Microsoft\Windows\Start Menu\Programs`
- `%APPDATA%\Microsoft\Windows\Start Menu\Programs`

El razonamiento es de calidad de fuente antes que de filtrado: un `.lnk` en el Menú Inicio
es lo que el instalador decidió que un humano tiene que poder abrir. Los redistribuibles,
los actualizadores y los runtimes no ponen uno. La decisión cambia el problema de filtrar
ruido a no producirlo.

Cada acceso directo se resuelve a su ejecutable con
`WScript.Shell.CreateShortcut(path).TargetPath`, que entrega en una sola pasada el nombre
legible del acceso directo, la ruta del ejecutable y la carpeta que lo contiene.

El **registro se usa como enriquecimiento, no como fuente**: aporta `Publisher` para mostrar
y desempatar homónimos, y las marcas `SystemComponent`, `ParentKeyName`, `ParentDisplayName`
y `ReleaseType` para descartar. Se consulta sobre las tres raíces habituales `HKLM`,
`HKLM\WOW6432Node` y `HKCU`.

**Un único proceso PowerShell** produce el recorrido de las dos raíces, la resolución de
todos los accesos directos con un solo objeto COM y la lectura de las claves de registro, y
devuelve datos crudos en JSON. No se invoca PowerShell por acceso directo.

El **filtrado vive en JavaScript, en una función pura** que recibe las entradas crudas y
devuelve el listado final. No vive en el script PowerShell. La tabla de descartes que fija
`proposal.md` —accesos directos sin `.exe` existente, targets bajo `\Windows\`, `\System32\`
o `\WinSxS\`, subcarpetas de herramientas del sistema, nombres de ejecutable con patrón de
actualizador o instalador, entradas con `SystemComponent = 1`, parches colgados de un
producto padre— es el cuerpo de esa función.

El sesgo del filtro es hacia el **falso negativo**: ante clasificación ambigua se deja fuera
la entrada. La vía de procesos abiertos compensa el caso de la app legítima que no aparece.

La enumeración es **perezosa con caché en disco y revalidación en segundo plano**: la primera
petición enumera y persiste el resultado en `userData`; las siguientes devuelven la caché de
inmediato y disparan una reenumeración cuyo resultado se empuja al renderer cuando termina.
Las peticiones concurrentes comparten la misma promesa en vuelo.

## Consequences

**Positivas:**

- La fuente resuelve el criterio de aceptación antes que el filtro: Discord y Clip Studio
  ponen acceso directo en el Menú Inicio, los redistribuibles de Visual C++ no.
- Una sola pasada entrega los tres datos que consumen tres features distintas —nombre
  legible, ruta de ejecutable e identidad— sin correlacionar fuentes.
- El filtro es una función pura sin dependencia del sistema operativo, así que se verifica
  con entradas fabricadas y queda listo para un runner de tests sin tocar el motor.
- Un solo spawn de PowerShell por enumeración mantiene el costo acotado pese a que el
  recorrido puede tocar cientos de accesos directos.
- La caché revalidada resuelve la latencia sin introducir lógica de expiración: la primera
  apertura del selector muestra estado de carga, todas las siguientes son instantáneas, y el
  listado se pone al día solo cuando el usuario instala algo nuevo.
- El listado no depende de que el programa esté abierto, que es la condición para que la
  fila aparezca sola cuando el programa se abre.

**Trade-offs:**

- Una aplicación portable o instalada sin acceso directo no aparece en el listado. Es la
  consecuencia buscada del sesgo hacia el falso negativo, y se compensa con la vía de
  procesos abiertos dentro del mismo selector.
- Las aplicaciones de la Microsoft Store quedan fuera: sus accesos directos no resuelven a
  un `.exe` y por lo tanto no hay ícono que extraer ni proceso que correlacionar. Está
  declarado como exclusión de alcance.
- La primera apertura del selector paga la enumeración completa con un estado de carga
  visible. La caché en disco acota el costo a una vez por instalación.
- El filtro por patrones de nombre de ejecutable es heurístico: un programa legítimo llamado
  con alguno de esos patrones se pierde. El sesgo declarado acepta ese costo.

## Alternatives Considered

- **Enumerar desde las claves `Uninstall` del registro como fuente principal**: es la vía
  habitual y la que `sdd-explore` evaluó primero. Se descarta porque devuelve el universo
  completo de lo que declaró un desinstalador —redistribuibles, parches, runtimes— y muchas
  entradas no apuntan a un ejecutable lanzable, de modo que la calidad del listado queda
  enteramente en manos del filtro. Partir del Menú Inicio deja al registro haciendo lo que
  hace bien: enriquecer y marcar descartes.
- **Mantener solo el listado de procesos abiertos** y renombrar la UX: es la opción de costo
  cero, ya implementada. Se descarta porque no permite elegir un programa que todavía no
  está abierto, que es la condición de la que depende que la fila aparezca sola al abrirlo.
  El listado de procesos abiertos se conserva como segunda vía dentro del mismo selector.
- **Un proceso PowerShell por acceso directo** para resolver el `TargetPath`: es la forma
  directa de escribirlo. Se descarta por costo: cientos de spawns donde alcanza con uno que
  reutiliza un único objeto COM.
- **Filtrar dentro del script PowerShell**: reduce el volumen de datos que cruza la frontera.
  Se descarta porque enterraría el criterio de aceptación de la feature en una cadena de
  texto sin forma de verificarlo sin Windows, y porque el volumen que cruza es despreciable.
- **Caché con expiración por tiempo o control manual de refresco**: son las dos formas
  clásicas de manejar la obsolescencia. Se descartan frente a la revalidación en segundo
  plano, que es más simple —no hay umbral que elegir ni control que explicar— y deja el
  listado al día sin intervención del usuario.
