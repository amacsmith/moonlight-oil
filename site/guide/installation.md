# Installation

## Download

Grab `MoonlightOilSetup.exe` from the latest [GitHub Release](https://github.com/amacsmith/moonlight-oil/releases) or from the **Artifacts** section of any CI run.

## Requirements

- **Windows 10** (version 2004+) or **Windows 11**, 64-bit
- At least **4 GB RAM** (8 GB recommended)
- ~2 GB free disk space for Docker/Podman + the stack
- An internet connection for the first-time setup

## Install Steps

1. Double-click `MoonlightOilSetup.exe`.
2. Click **Yes** if Windows asks to allow changes.
3. Choose your container engine:
   - **Docker Desktop** (recommended) — easiest, just works
   - **Podman** — lightweight, no Docker account needed
4. Click **Next**, then **Install**.
5. Wait for the setup to complete (downloads ~500 MB on first run).
6. **Restart the computer once** when prompted.

After the restart, the **Dad's Library** icon appears on the desktop.

## What the Installer Does

Under the hood, the installer:

1. Enables **WSL2** (Windows Subsystem for Linux 2)
2. Downloads and silently installs Docker Desktop or Podman (with Authenticode signature verification)
3. Copies the app stack to `C:\Users\Public\MoonlightOil`
4. Generates a cryptographically secure `STORYTELLER_SECRET_KEY`
5. Creates the desktop shortcut

## Uninstalling

Use **Add or remove programs** in Windows Settings. The uninstaller:

- Stops and removes the containers
- **Keeps your books and settings** in `C:\Users\Public\MoonlightOil`
- Does **not** remove Docker/Podman (they may be used by other things)

To fully clean up, manually delete `C:\Users\Public\MoonlightOil` after uninstalling.
