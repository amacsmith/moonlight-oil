<#
  uninstall.ps1 — run by the uninstaller. Stops and removes the containers but
  DELIBERATELY KEEPS the books, settings, and secret key in
  C:\Users\Public\MoonlightOil so nothing is lost if it's reinstalled.
  It does NOT remove Docker/Podman (they may be used by other things).
#>
. "$PSScriptRoot\common.ps1"

Write-Banner "Removing Dad's Library"
try {
    Invoke-Compose down
    Write-Log "Containers removed." 'OK'
} catch {
    Write-Log "Nothing to remove, or the engine was off: $($_.Exception.Message)" 'WARN'
}
Write-Log "Your books and settings were kept at: $Global:MoonRoot"
Write-Log "Docker/Podman were left installed. Remove them from 'Add or remove programs' if you don't want them."
exit 0
