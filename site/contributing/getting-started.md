# Contributing

## Prerequisites

- **Git**
- **Docker** (or Podman) with Compose
- **Node.js 18+** (for the docs site)
- **Windows** with [Inno Setup 6](https://jrsoftware.org/isinfo.php) (only needed to compile the `.exe`)

## Clone and Run

```bash
git clone https://github.com/amacsmith/moonlight-oil.git
cd moonlight-oil

# Run the stack locally
cd stack
cp .env.example .env
# Set STORYTELLER_SECRET_KEY to any long random string
docker compose up -d
```

Open [http://localhost:8080](http://localhost:8080) to see the home page.

## Repository Layout

```
moonlight-oil/
├── installer/
│   ├── moonlight-oil.iss       # Inno Setup script → MoonlightOilSetup.exe
│   ├── AFTER_INSTALL.txt       # Post-install notice
│   ├── assets/library.ico      # Desktop icon
│   └── scripts/                # PowerShell: install, launch, stop, uninstall, common
├── stack/
│   ├── docker-compose.yml      # Home + Storyteller + FlowState
│   ├── .env.example            # Documented settings
│   ├── caddy/Caddyfile         # Static files + /config.json + /up/<service>
│   ├── home/                   # index.html, boot.js, app.js, qr.js
│   └── flowstate/Dockerfile    # Builds FlowState from source
├── site/                       # VitePress documentation site
├── tests/                      # Test suite
├── docs/                       # Standalone markdown guides
└── .github/workflows/          # CI/CD pipelines
```

## Run the Docs Site Locally

```bash
cd site
npm install
npm run dev
```

The docs site opens at `http://localhost:5173`.

## Build the Installer (Windows only)

```
iscc installer\moonlight-oil.iss
```

The `.exe` lands in `dist/`. Or let CI build it — every push produces a downloadable artifact.

## Run the Tests

```bash
npm test                        # from the repo root
```

See [Testing](/contributing/testing) for details on what's covered.
