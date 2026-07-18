; Moonlight Oil — Windows installer source.
; Compiles to MoonlightOilSetup.exe with Inno Setup 6 (https://jrsoftware.org/isinfo.php).
; Build locally:   iscc installer\moonlight-oil.iss
; Or let the GitHub Actions workflow build it for you (see .github/workflows).

#define MyAppName "Moonlight Oil Library"
#define MyAppShortName "Dad's Library"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Moonlight Oil"

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\MoonlightOil
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=MoonlightOilSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Both Docker Desktop and Podman need 64-bit Windows 10/11 with WSL2.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Installing a container runtime + writing the all-users shortcut needs admin.
PrivilegesRequired=admin
SetupIconFile=assets\library.ico
UninstallDisplayIcon={app}\assets\library.ico
UninstallDisplayName={#MyAppName}
InfoAfterFile=AFTER_INSTALL.txt

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

; Radio-style choice of container engine (exclusive = pick one).
[Tasks]
Name: "runtime\docker"; Description: "Docker Desktop  —  easiest, just works (recommended)"; GroupDescription: "Which container engine should we install?"; Flags: exclusive
Name: "runtime\podman"; Description: "Podman  —  lightweight, no Docker account needed"; GroupDescription: "Which container engine should we install?"; Flags: exclusive unchecked

[Files]
Source: "scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "assets\*";  DestDir: "{app}\assets";  Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\stack\*"; DestDir: "{app}\stack";  Flags: recursesubdirs createallsubdirs ignoreversion
Source: "AFTER_INSTALL.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; The one icon the family member uses — on the desktop for everyone.
Name: "{commondesktop}\{#MyAppShortName}"; Filename: "powershell.exe"; \
    Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\launch.ps1"""; \
    WorkingDir: "{app}\scripts"; IconFilename: "{app}\assets\library.ico"; \
    Comment: "Open Dad's Library"
Name: "{autoprograms}\{#MyAppShortName}"; Filename: "powershell.exe"; \
    Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\launch.ps1"""; \
    WorkingDir: "{app}\scripts"; IconFilename: "{app}\assets\library.ico"
Name: "{autoprograms}\Stop {#MyAppShortName}"; Filename: "powershell.exe"; \
    Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\stop.ps1"""; \
    WorkingDir: "{app}\scripts"; IconFilename: "{app}\assets\library.ico"

[Run]
; First-time setup: WSL2 + the chosen runtime + secrets. Runs elevated.
Filename: "powershell.exe"; \
    Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\install.ps1"" -Runtime docker -TemplateDir ""{app}"""; \
    StatusMsg: "Setting up (installing Docker Desktop and WSL2 — this can take several minutes)..."; \
    Flags: waituntilterminated; Tasks: runtime\docker
Filename: "powershell.exe"; \
    Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\install.ps1"" -Runtime podman -TemplateDir ""{app}"""; \
    StatusMsg: "Setting up (installing Podman and WSL2 — this can take several minutes)..."; \
    Flags: waituntilterminated; Tasks: runtime\podman

[UninstallRun]
; Cleanly stop/remove containers on uninstall (books & settings are kept).
Filename: "powershell.exe"; \
    Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\scripts\uninstall.ps1"""; \
    Flags: waituntilterminated runhidden; RunOnceId: "MoonlightOilDown"
