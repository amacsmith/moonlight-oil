<#
  install.ps1 — first-time setup, run once by the installer (elevated).

  It does the boring, error-prone parts so the family member never has to:
    1. Copies the app "stack" to a shared, writable folder and generates a
       secure secret key.
    2. Makes sure WSL2 (the Windows engine both Docker and Podman need) is on.
    3. Installs the container runtime — Docker Desktop by default, or Podman.

  A reboot may be required after WSL2 is first enabled; that's normal. The
  "Dad's Library" shortcut is written to cold-start everything afterwards, so
  the very first click just needs a little patience.
#>
param(
    [ValidateSet('docker','podman')]
    [string]$Runtime = 'docker',

    # The folder the installer laid the packaged template into (Inno passes {app}).
    [string]$TemplateDir = (Split-Path -Parent $PSScriptRoot)
)

. "$PSScriptRoot\common.ps1"

$rebootNeeded = $false

Write-Banner "Setting up Dad's Library"

# --- 1. Materialize the live stack + secrets -------------------------------
try {
    New-Item -ItemType Directory -Force -Path $Global:MoonStack | Out-Null
    Copy-Item -Path (Join-Path $TemplateDir 'stack\*') -Destination $Global:MoonStack -Recurse -Force
    foreach ($d in 'data\storyteller') {
        New-Item -ItemType Directory -Force -Path (Join-Path $Global:MoonStack $d) | Out-Null
    }

    $envFile = Join-Path $Global:MoonStack '.env'
    if (-not (Test-Path $envFile)) {
        $bytes  = New-Object 'System.Byte[]' 48
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $secret = ([Convert]::ToBase64String($bytes)) -replace '[^A-Za-z0-9]', ''

        @(
            "# Generated automatically on $(Get-Date -Format 'yyyy-MM-dd'). Do not share."
            "HOME_PORT=8080"
            "STORYTELLER_PORT=8001"
            "READIUM_PORT=8002"
            "FLOWSTATE_PORT=8003"
            "FLOWSTATE_REF=master"
            "STORYTELLER_SECRET_KEY=$secret"
            "STORYTELLER_LOG_LEVEL=info"
            "PUID=1000"
            "PGID=1000"
        ) | Set-Content -Path $envFile -Encoding ASCII
        Write-Log "Created settings and a private secret key." 'OK'
    } else {
        Write-Log "Existing settings kept (secret key preserved)." 'OK'
    }
} catch {
    Write-Log "Could not set up the app folder: $($_.Exception.Message)" 'ERROR'
    throw
}

# --- 2. Ensure WSL2 --------------------------------------------------------
Write-Banner "Checking the Windows engine (WSL2)"
try {
    & wsl.exe --status *> $null
    $wslOk = ($LASTEXITCODE -eq 0)
} catch { $wslOk = $false }

if ($wslOk) {
    Write-Log "WSL2 is already available." 'OK'
    try { & wsl.exe --set-default-version 2 *> $null } catch { }
} else {
    Write-Log "Turning on WSL2 (this is a one-time step)..."
    try {
        & wsl.exe --install --no-distribution
        if ($LASTEXITCODE -ne 0) { throw "wsl --install returned $LASTEXITCODE" }
        $rebootNeeded = $true
        Write-Log "WSL2 enabled. A restart will be needed." 'OK'
    } catch {
        # Fallback for older Windows builds: enable the features directly.
        Write-Log "Using the fallback method to enable WSL2..." 'WARN'
        & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Null
        & dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Null
        $rebootNeeded = $true
        Write-Log "WSL2 features enabled. A restart (and possibly a kernel update from Microsoft) will be needed." 'WARN'
    }
}

# --- 3. Install the container runtime --------------------------------------
Write-Banner "Installing the container runtime ($Runtime)"
$tmp = Join-Path $env:TEMP 'moonlight-oil-setup'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

if ($Runtime -eq 'docker') {
    $dockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if ((Test-CommandExists 'docker') -or (Test-Path $dockerExe)) {
        Write-Log "Docker Desktop is already installed." 'OK'
    } else {
        $installer = Join-Path $tmp 'DockerDesktopInstaller.exe'
        Write-Log "Downloading Docker Desktop (about 500 MB, please wait)..."
        Invoke-WebRequest -UseBasicParsing `
            -Uri 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' `
            -OutFile $installer
        Assert-ValidSignature $installer
        Write-Log "Installing Docker Desktop quietly..."
        Start-Process -FilePath $installer -ArgumentList 'install','--quiet','--accept-license' -Wait
        $rebootNeeded = $true
        Write-Log "Docker Desktop installed." 'OK'
    }
} else {
    if (Test-CommandExists 'podman') {
        Write-Log "Podman is already installed." 'OK'
    } else {
        Write-Log "Finding the latest Podman release..."
        try {
            $rel  = Invoke-RestMethod -UseBasicParsing -Uri 'https://api.github.com/repos/containers/podman/releases/latest' -Headers @{ 'User-Agent' = 'moonlight-oil' }
            $asset = $rel.assets | Where-Object { $_.name -match 'setup\.exe$' } | Select-Object -First 1
            if (-not $asset) { throw "No Windows setup.exe found in the latest release." }
            $installer = Join-Path $tmp $asset.name
            Write-Log "Downloading $($asset.name)..."
            Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $installer
            Assert-ValidSignature $installer
            Write-Log "Installing Podman quietly..."
            Start-Process -FilePath $installer -ArgumentList '/install','/quiet','/norestart' -Wait
            $rebootNeeded = $true
            Write-Log "Podman installed." 'OK'
        } catch {
            Write-Log "Automatic Podman install failed: $($_.Exception.Message)" 'ERROR'
            Write-Log "Install Podman manually from https://podman.io/ then re-run the shortcut." 'WARN'
        }
    }
}

# --- Done ------------------------------------------------------------------
Write-Banner "Setup complete"
if ($rebootNeeded) {
    Write-Log "Please RESTART the computer once. After that, open 'Dad's Library' from the desktop." 'WARN'
} else {
    Write-Log "All set. Open 'Dad's Library' from the desktop." 'OK'
}
Write-Log "A log of this setup is at: $Global:MoonLog"
exit 0
