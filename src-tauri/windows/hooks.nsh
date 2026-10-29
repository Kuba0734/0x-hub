; NSIS installer hooks (see tauri.conf.json > bundle.windows.nsis.installerHooks).
; Remove the per-user Explorer integration that 0x-hub can create at runtime.
!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\*\shell\0x-hub"
  Delete "$APPDATA\Microsoft\Windows\SendTo\0x-hub.lnk"
!macroend
