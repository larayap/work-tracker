---
type: clarifications
change_name: "open-source-readiness"
created: "2026-08-06"
status: open
tags: [change]
---

# Ambigüedades para resolver antes de sdd-spec

## 1. Clave de persistencia (`package.json.name`) — la decisión de fondo

**Contexto verificado**: `app.getPath('userData')` resuelve por `package.json.name`, no por
`productName`. Hoy los datos viven en `%APPDATA%/cronometro-apps/`. Hay releases publicadas
con 12 descargas acumuladas, así que existe base instalada de terceros.

- **A. Congelar `name` en `cronometro-apps`** y renombrar solo lo visible. Cero pérdida de
  datos, cero cambios en `src/`. Costo: incoherencia permanente entre `name` y la marca.
- **B. Renombrar `name` a `tickmark` + migración one-shot** que copie el directorio viejo al
  nuevo en el primer arranque. Coherencia total, pero toca `src/main/` y viola la invariante
  "este cambio no modifica el comportamiento de la aplicación".
- **C. Renombrar `name` y aceptar la pérdida.** Quien tenga Workout instalado abre Tickmark
  con el historial vacío, sin aviso.

**Recomendación: A**, con ADR que documente el congelamiento, y B registrada como issue de
roadmap para un cambio propio con su propia verificación.

## 2. Nombre del repositorio en GitHub

`tickmark` o `tickmark-app`. El dominio paraguas sugiere que puede haber más apps bajo la
misma marca en el futuro.

**Recomendación: `tickmark`** — es la app, no un catálogo. Es acción externa del usuario;
el pipeline no la ejecuta.

## 3. Versión de la primera release como Tickmark

`package.json.version` dice `1.0.0` pero la última publicada es `v1.0.1`: hay que reconciliar
antes de que el workflow valide tag contra versión. Los tags también son inconsistentes
(`v.1.0.0` vs `v1.0.1`).

**Recomendación: `1.1.0`** y convención fija `v<semver>` de aquí en adelante. Marca el
relanzamiento sin retroceder respecto de lo ya publicado.

## 4. Capturas de pantalla del README

El README propuesto las incluye. Requieren la máquina Windows del usuario con la app
corriendo — que es su escritorio en uso real, no un entorno dedicado.

**Recomendación**: que el usuario las provea y las deje en `docs/` o `.github/assets/`.
Alternativa: coordinar una ventana de tiempo con la máquina libre para capturarlas por
interop. Si ninguna sirve, el README se entrega sin capturas y queda como issue.

## 5. Titular de la autoría

`package.json.author` dice `Flama`; el `LICENSE` MIT llevaría titular `larayap`. Quedarían
dos identidades distintas en el mismo repo público.

**Recomendación**: alinear ambos a `larayap` (o al nombre legal si preferís que el copyright
sea nominal). Confirmar cuál.

---

## Iteración 1 — Respuestas (2026-08-06)

### Decisión sobre la propuesta: [R] Refinar

El usuario aprueba el fondo pero cambia el nombre del producto, lo que invalida el texto de
`proposal.md v1` (redactado íntegramente sobre "Tickmark") y modifica una invariante declarada.

### CAMBIO DE NOMBRE — reemplaza la decisión previa

El producto se llama **Work Tracker**, no Tickmark. Cascada:

- `productName` / `win.executableName`: `Work Tracker`
- `appId`: `com.worktracker.app`
- Repositorio GitHub destino: `work-tracker` (resuelve también la clarification 2)
- README, LICENSE, CONTRIBUTING y workflows se redactan con este nombre

**Trade-off advertido al usuario y asumido por él**: "work tracker" es un término saturado en
GitHub (decenas de repos homónimos), lo que reduce el descubrimiento orgánico que era el
objetivo declarado del cambio. El usuario decide igualmente.

### Clarification 1 — Clave de persistencia: opción **B** (renombrar + migrar)

`package.json.name` pasa de `cronometro-apps` a `work-tracker`, **con migración one-shot** que
copia `%APPDATA%/cronometro-apps/` a `%APPDATA%/work-tracker/` en el primer arranque.

**Consecuencia sobre el alcance**: la invariante "este cambio no modifica el comportamiento de
la aplicación" **se relaja de forma acotada y explícita** para este único ítem. La migración
toca `src/main/` y exige verificación propia en `sdd-verify` (idempotencia, arranque limpio sin
directorio previo, arranque con directorio previo, y no-destrucción del origen).

Existe precedente en el proyecto: ADR-0007 documenta una migración one-shot previa
(`usage-log.txt` legacy → `sessions.json` estructurado). El diseño debe seguir ese patrón, no
inventar uno nuevo.

### Clarification 2 — Nombre del repo: `work-tracker`

Deriva del nombre del producto. Sigue siendo acción externa del usuario; el pipeline no la ejecuta.

### Clarification 3 — Versión de la primera release: **2.0.0**

`package.json.version` pasa a `2.0.0`. Convención de tags fija `v<semver>` en adelante.

### Clarification 4 — Capturas del README: sin capturas por ahora

El README se entrega sin capturas y queda un issue de roadmap para que el usuario las agregue
desde su máquina Windows.

### Clarification 5 — Autoría: **larayap** en ambos

`package.json.author` pasa de `Flama` a `larayap`, y el copyright del `LICENSE` MIT lleva
`larayap`, año 2026.

### Contexto de rama (reportado por el usuario)

El usuario actualizó `main`. Verificado por el orquestador: `origin/main` está en `3e5be8f` y el
worktree `feature/open-source-readiness` parte exactamente de ese commit (0 commits de
diferencia en ambas direcciones). No se requiere rebase.
