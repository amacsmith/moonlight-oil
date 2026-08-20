# Shared helpers for the Moonlight Oil scripts.
# Dot-source this from the other scripts:  . "$PSScriptRoot\common.ps1"

$ErrorActionPreference = 'Stop'

# Where the live, running copy of the stack lives. C:\Users\Public is shared and
# writable by any account on the PC, so both the (elevated) installer and the
# (normal) desktop shortcut can reach it. This avoids Program Files permission
# headaches and per-user path mismatches.
$Global:MoonRoot  = Join-Path $env:PUBLIC 'MoonlightOil'
$Global:MoonStack = Join-Path $Global:MoonRoot 'stack'
$Global:MoonLog   = Join-Path $Global:MoonRoot 'moonlight-oil.log'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = "{0}  [{1}]  {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    try {
        New-Item -ItemType Directory -Force -Path $Global:MoonRoot | Out-Null
        Add-Content -Path $Global:MoonLog -Value $line
    } catch { }
    switch ($Level) {
        'ERROR' { Write-Host $Message -ForegroundColor Red }
        'WARN'  { Write-Host $Message -ForegroundColor Yellow }
        'OK'    { Write-Host $Message -ForegroundColor Green }
        default { Write-Host $Message }
    }
}

# A big, friendly banner — reassuring for a non-technical user watching.
function Write-Banner {
    param([string]$Text)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor DarkCyan
    Write-Host ("  " + $Text) -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor DarkCyan
    Write-Host ""
}

function Test-CommandExists {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# Refuse to run a downloaded installer unless it carries a valid Authenticode
# signature. TLS only proves *where* the file came from; this proves the file
# is genuinely from a trusted publisher and hasn't been tampered with.
function Assert-ValidSignature {
    param([string]$Path)
    $sig = Get-AuthenticodeSignature -FilePath $Path
    if ($sig.Status -ne 'Valid') {
        throw "Refusing to run '$Path': Authenticode status is '$($sig.Status)'. Downloaded installer is not trusted."
    }
    Write-Log "Verified publisher signature: $($sig.SignerCertificate.Subject)" 'OK'
}

# Which container runtime is installed? Prefer Docker, fall back to Podman.
function Get-Runtime {
    if (Test-CommandExists 'docker')  { return 'docker' }
    if (Test-CommandExists 'podman')  { return 'podman' }
    return $null
}

# Run a `compose` command against our stack with whichever runtime is present.
# Works with `docker compose`, `podman compose`, and legacy `podman-compose`.
function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $runtime = Get-Runtime
    if (-not $runtime) { throw "No container runtime found (need Docker or Podman)." }

    Push-Location $Global:MoonStack
    try {
        if ($runtime -eq 'docker') {
            & docker compose @Args
        } else {
            # Newer Podman ships `podman compose`; older setups use podman-compose.
            & podman compose @Args 2>$null
            if ($LASTEXITCODE -ne 0 -and (Test-CommandExists 'podman-compose')) {
                & podman-compose @Args
            }
        }
        if ($LASTEXITCODE -ne 0) { throw "compose $($Args -join ' ') failed (exit $LASTEXITCODE)." }
    } finally {
        Pop-Location
    }
}

# Is the container engine actually up and answering?
function Test-EngineReady {
    $runtime = Get-Runtime
    if (-not $runtime) { return $false }
    try { & $runtime info *> $null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}

# Poll a URL until it responds or we give up.
function Wait-ForUrl {
    param([string]$Url, [int]$TimeoutSeconds = 180)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 *> $null
            return $true
        } catch {
            Start-Sleep -Seconds 3
        }
    }
    return $false
}
