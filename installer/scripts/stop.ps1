<#
  stop.ps1 — gently stop the library. Books and settings are kept.
  Wired to a "Stop Dad's Library" Start Menu entry for the rare case it's wanted.
#>
. "$PSScriptRoot\common.ps1"

Write-Banner "Stopping the library"
try {
    Invoke-Compose stop
    Write-Log "Stopped. Your books and settings are safe." 'OK'
} catch {
    Write-Log "Nothing was running, or it couldn't stop cleanly: $($_.Exception.Message)" 'WARN'
}
Start-Sleep -Seconds 2
