; Autoarranque opt-in con Windows (installer-opt-in-autostart). Se incluye vía
; `nsis.include` en vue.config.js. electron-builder inyecta este archivo con
; `!include` como parte del "sharedHeader" del script generado — es decir,
; ANTES de que `installer.nsi` haga `!include "common.nsh"` / `!include
; "MUI2.nsh"` (ver app-builder-lib/out/targets/nsis/NsisTarget.js,
; computeCommonInstallerScriptHeader()). Por eso todo el código que depende de
; esas plantillas (${PRODUCT_NAME}, ${APP_EXECUTABLE_FILENAME}, ${isUpdated},
; nsDialogs, los mensajes BST_*/BM_*) vive DENTRO de los tres macros de abajo:
; un `!macro ... !macroend` solo guarda texto, sin compilarlo, hasta que algo
; hace `!insertmacro` — y esos `!insertmacro` ocurren mucho más tarde en el
; script (assistedInstaller.nsh, installSection.nsh, uninstaller.nsh), ya con
; MUI2/common/nsDialogs incluidos. Declarar código NSIS real (no envuelto en
; un macro) a este nivel del archivo rompería el build por referenciar
; símbolos que todavía no existen.

Var /GLOBAL AutostartCheckbox_State
Var /GLOBAL AutostartCheckbox_Handle

; ---------------------------------------------------------------------------
; A1 — Página con la casilla de autoarranque, insertada después de elegir la
; carpeta de instalación (hook customPageAfterChangeDir, ya definido por
; electron-builder en assistedInstaller.nsh:44-46).
; ---------------------------------------------------------------------------
!macro customPageAfterChangeDir
  !include "nsDialogs.nsh"

  Page custom AutostartPageCreate AutostartPageLeave

  Function AutostartPageCreate
    ; Estado inicial de la casilla: refleja si YA existe la entrada Run de
    ; una instalación previa. HKCU literal, no SHELL_CONTEXT (D4 de la
    ; propuesta): el arranque automático se registra siempre a nivel de
    ; usuario, sin importar si esta instalación es per-user o per-machine.
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
    ${If} $0 != ""
      StrCpy $AutostartCheckbox_State ${BST_CHECKED}
    ${Else}
      StrCpy $AutostartCheckbox_State ${BST_UNCHECKED}
    ${EndIf}

    nsDialogs::Create 1018
    Pop $0

    ${NSD_CreateCheckbox} 0u 0u 100% 12u "Iniciar ${PRODUCT_NAME} automáticamente al iniciar sesión en Windows"
    Pop $AutostartCheckbox_Handle
    ${NSD_SetState} $AutostartCheckbox_Handle $AutostartCheckbox_State

    nsDialogs::Show
  FunctionEnd

  Function AutostartPageLeave
    ${NSD_GetState} $AutostartCheckbox_Handle $AutostartCheckbox_State
  FunctionEnd
!macroend

; ---------------------------------------------------------------------------
; A2 — Escribe o borra la entrada Run según el estado final de la casilla
; (hook customInstall, installSection.nsh:78-80: corre después de
; installApplicationFiles, con $INSTDIR ya resuelto).
; ---------------------------------------------------------------------------
!macro customInstall
  ${If} $AutostartCheckbox_State == ${BST_CHECKED}
    ; Sin argumentos en el valor (D4): la visibilidad al arrancar la decide
    ; `startupVisibility` (preferencia persistida, sección B), no un flag de
    ; línea de comandos como `--hidden`. Comillas obligatorias: el ejecutable
    ; lleva espacio en el nombre ("Work Tracker.exe").
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  ${Else}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  ${EndIf}
!macroend

; ---------------------------------------------------------------------------
; A3 — Quita la entrada Run al desinstalar, salvo que la desinstalación sea
; parte de una actualización (hook customUnInstall, uninstaller.nsh:114-116).
; Sin el guard ${ifNot} ${isUpdated}, cada actualización (que corre el
; desinstalador de la versión vieja con --updated antes de reinstalar)
; apagaría el arranque automático en cada release nueva — mismo patrón que
; usa electron-builder para `isDeleteAppData` en uninstaller.nsh:82.
; ---------------------------------------------------------------------------
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
  ${endIf}
!macroend
