; NSIS installer hooks for Clippster
; Copies FFmpeg DLLs from resources subdirectory to app directory
; Windows requires DLLs to be in the same directory as the executable

!macro NSIS_HOOK_POSTINSTALL
  CopyFiles /SILENT "$INSTDIR\ffmpeg-libs\*.dll" $INSTDIR
!macroend
