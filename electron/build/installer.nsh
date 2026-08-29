; Desactive entierement la verification "application en cours" (bug electron-builder).
!macro customCheckAppRunning
!macroend

!macro customInit
  nsExec::ExecToLog 'taskkill /F /IM CineVault.exe /T'
  Sleep 1000
!macroend
