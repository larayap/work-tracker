---
type: change-state
change_name: "open-source-readiness"
domain: "debt"
status: active
fast_path: "spec-first"
current_phase: sdd-archive
phases_completed: [sdd-init, sdd-propose, sdd-spec, sdd-design, sdd-tasks, sdd-apply, sdd-verify, sdd-judgment]
spec_refs: ["[[unified-product-identity]]", "[[legacy-userdata-one-shot-migration]]", "[[community-contribution-documents]]", "[[single-build-and-lint-pipeline]]", "[[pr-lint-and-tagged-release-workflow]]"]
worktree: "/home/larayap/cronometro-app/.sdd/worktrees/open-source-readiness"
feature_branch: "feature/open-source-readiness"
integration_target: "main"
mr: ""
mr_status: pending
mr_error: ""
created: "2026-08-06"
updated: "2026-08-06"
apply_commits: ["69e698b", "8bb03a7", "319d1f3", "a692240", "81e7fbf"]
judgment_commits: ["5453d15", "778328e"]
judgment_verdict: "PASS"
judgment_iterations: 2
adrs: ["[[0013-per-file-userdata-handover-on-identity-rename]]", "[[0014-single-build-toolchain-and-pinned-node]]"]
tags: [change]
proposal_status: approved
proposal_iteration: 2
clarifications_open: 0
---

## Intent

Preparar el repo para ser un proyecto open source comunitario, rebautizado como
**Work Tracker** (hoy: repo `cronometro-app`, package name `cronometro-apps`, productName
`Workout`).

Decisiones ya tomadas por el usuario (no re-abrir):
- Nombre del producto y del repo: **Work Tracker** (repo destino `work-tracker`)
- Licencia: **MIT**, titular `larayap`, año 2026
- Versión de la primera release con el nombre nuevo: **2.0.0**, convención de tags `v<semver>`
- Marca: un dominio paraguas con subpáginas por app. La web estática es OTRO REPO y queda
  FUERA del alcance de este cambio.

Alcance en tres frentes:
1. **Higiene del repo**: LICENSE MIT, README.md real sin capturas (hoy es la plantilla por
   defecto de Vue CLI), CONTRIBUTING.md, CODE_OF_CONDUCT.md, plantillas de issue/PR en
   `.github/`.
2. **Identidad, migración y limpieza**: renombrar a Work Tracker (`package.json` name a
   `work-tracker`, `productName` y `executableName` a `Work Tracker`, `appId` a
   `com.worktracker.app`, `author` a `larayap`), **migración one-shot de `userData`** de
   `%APPDATA%/cronometro-apps/` a `%APPDATA%/work-tracker/` siguiendo el patrón de ADR-0007,
   quitar `@shopify/draggable` y `electron-squirrel-startup` (sin uso en `src/`), borrar 6
   PNG muertos en `src/assets/` (`Blender.png`, `CLIP STUDIO PAINT.png`,
   `Google Chrome.png`, `Toom Boom Storyboard Pro.png`, `Toon Boom Harmony Premium.png`,
   `VEGAS Pro.png` — `manual.png` SÍ se usa), consolidar en UN sistema de build
   (`vue-cli-plugin-electron-builder`), unificar la config de ESLint, ignorar `.sdd/`.
3. **CI + releases**: GitHub Actions que lintee en PR y que compile el instalador `.exe`
   en `windows-latest` publicándolo en Releases por tag.

**Invariante relajada de forma acotada**: la migración de `userData` es el único ítem que
toca `src/main/` y el único que modifica comportamiento. Todo el resto de `src/` permanece
intacto.

## Path Inference

- Inferred: spec-first (rule 5)
- Signals: S1=N, S2=Y, S3=N
- Override: none

## Entorno

- El usuario trabaja en WSL2. El build del instalador `.exe` (electron-builder, target
  `nsis`) NO se puede verificar localmente en este entorno — solo es verificable en CI
  (`windows-latest`). `sdd-verify` debe apoyarse en la ejecución de GitHub Actions, no en
  una build local, para validar el frente 3 (CI + releases).
