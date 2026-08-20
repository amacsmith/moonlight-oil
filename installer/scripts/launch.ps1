<#
  launch.ps1 — this is what the "Dad's Library" desktop shortcut runs.

  It is written to be clicked by someone who knows nothing about containers.
  It makes sure the engine is running, starts the library, waits until it's
  ready, and opens the web page. Safe to click any time; clicking twice is
  harmless.
#>
. "$PSScriptRoot\common.ps1"

$Host.UI.RawUI.WindowTitle = "Dad's Library"
Write-Banner "Getting your books ready..."
Write-Host "You can leave this window alone. It will open your library and then you can close it." -ForegroundColor Gray
Write-Host ""

# Make sure the runtime is on PATH even right after install (before a reboot).
$dockerBin = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
if ((Test-Path $dockerBin) -and ($env:PATH -notlike "*$dockerBin*")) {
    $env:PATH = "$dockerBin;$env:PATH"
}

$runtime = Get-Runtime
if (-not $runtime) {
    Write-Log "The container app isn't installed yet." 'ERROR'
    Write-Log "If you JUST installed, please RESTART the computer once, then click the shortcut again." 'WARN'
    Read-Host "Press Enter to close"
    exit 1
}

# --- Start the engine if it's asleep ---------------------------------------
if (-not (Test-EngineReady)) {
    Write-Log "Starting the engine (this can take a minute the first time)..."
    if ($runtime -eq 'docker') {
        $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
        if (Test-Path $dd) { Start-Process -FilePath $dd | Out-Null }
    } else {
        # Ensure a Podman machine exists, then start it.
        & podman machine inspect *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Preparing Podman for first use..."
            & podman machine init
        }
        & podman machine start *> $null
    }

    $deadline = (Get-Date).AddSeconds(240)
    while (-not (Test-EngineReady) -and (Get-Date) -lt $deadline) {
        Write-Host "  ...still waking up..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
}

if (-not (Test-EngineReady)) {
    Write-Log "The engine didn't start in time." 'ERROR'
    Write-Log "Try restarting the computer, then click the shortcut again." 'WARN'
    Read-Host "Press Enter to close"
    exit 1
}
Write-Log "Engine is running." 'OK'

# --- Start the library -----------------------------------------------------
try {
    Write-Log "Starting your library (the very first time builds it, which can take a few minutes)..."
    Invoke-Compose up -d
    Write-Log "Library is starting up." 'OK'
} catch {
    Write-Log "Couldn't start the library: $($_.Exception.Message)" 'ERROR'
    Read-Host "Press Enter to close"
    exit 1
}

# --- Open the home page once it answers ------------------------------------
$homePort = '8080'
$envFile = Join-Path $Global:MoonStack '.env'
if (Test-Path $envFile) {
    $m = Select-String -Path $envFile -Pattern '^HOME_PORT=(\d+)' | Select-Object -First 1
    if ($m) { $homePort = $m.Matches[0].Groups[1].Value }
}
$url = "http://localhost:$homePort"

Write-Log "Waiting for the library to be ready..."
if (Wait-ForUrl -Url $url -TimeoutSeconds 240) {
    Write-Log "Ready! Opening your library." 'OK'
    Start-Process $url
    Start-Sleep -Seconds 3
} else {
    Write-Log "It's taking longer than usual. Opening the page anyway — refresh if it's blank." 'WARN'
    Start-Process $url
    Read-Host "Press Enter to close"
}
exit 0
