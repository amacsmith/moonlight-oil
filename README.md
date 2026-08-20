# Moonlight Oil 🌙

**One double-click installer that turns a Windows PC into a private home library
for someone who isn't technical.**

Built for an 80-year-old dad: he clicks one icon, his books open. No accounts,
no terminal, no cloud. Everything runs on his own computer in containers.

It bundles two open-source reading apps behind a single big-button home page:

| App | What it does | Self-hosted |
|-----|--------------|-------------|
| [**Storyteller**](https://storyteller-platform.dev/docs/installation/self-hosting/) | Reads your ebooks with the audiobook narration in sync | ✅ official image |
| [**FlowState Reader**](https://github.com/PeggyZWY/flowstate-webapp) | Calm, distraction-free focus reading | ✅ built from source |

## The "combine to improve" idea

Storyteller ships a clean, declarative **docker-compose** self-hosting recipe.
FlowState is a lovely little app but only shipped as a GitHub Pages site with no
container. Moonlight Oil takes Storyteller's compose approach and extends it to
**both** apps in one stack, then hides the whole thing behind:

- a **single installer** that also sets up the container engine and WSL2, and
- a **single large-print home page** so there's one icon to click, not two setups.

That's the improvement: the non-technical person gets one turnkey thing instead
of two half-technical ones.

## How a family member uses it

1. Download `MoonlightOilSetup.exe` and double-click it.
2. Pick Docker (recommended) or Podman, click Next, wait.
3. Restart the PC once (only the first time).
4. Double-click **Dad's Library** on the desktop. Done.

The full, gentle walkthrough is in [`docs/for-dad.md`](docs/for-dad.md).

## What the installer does under the hood

- Turns on **WSL2** (the Windows engine both Docker and Podman use).
- Installs **Docker Desktop** or **Podman** silently.
- Copies the stack to `C:\Users\Public\MoonlightOil`, generates a secure
  `STORYTELLER_SECRET_KEY`, and creates the desktop shortcut.
- The shortcut runs [`launch.ps1`](installer/scripts/launch.ps1), which
  cold-starts the engine, runs `compose up -d`, waits until the page answers,
  and opens the browser.

Details for tinkerers: [`docs/self-hosting.md`](docs/self-hosting.md).

## Repository layout

```
installer/
  moonlight-oil.iss      Inno Setup script → compiles to MoonlightOilSetup.exe
  AFTER_INSTALL.txt      the friendly "you're done, restart once" note
  assets/library.ico     desktop icon
  scripts/               PowerShell: install, launch, stop, uninstall, common
stack/
  docker-compose.yml     home + Storyteller + FlowState
  .env.example           documented settings (installer generates the real .env)
  home/index.html        the big-button landing page
  flowstate/Dockerfile   builds FlowState Reader from source
site/                    VitePress documentation site
tests/                   validation test suite (node:test)
docs/                    standalone markdown guides
.github/workflows/       CI pipelines (build + test)
```

## Building the installer yourself

You don't have to — every push builds `MoonlightOilSetup.exe` in GitHub Actions
(download it from the run's **Artifacts**, or from a `v*` tag's Release). To
build locally on Windows with [Inno Setup 6](https://jrsoftware.org/isinfo.php):

```
iscc installer\moonlight-oil.iss
```

The `.exe` lands in `dist\`.

## Running the tests

```bash
npm test
```

60 validation tests check the compose config, HTML, Dockerfile, installer scripts,
and environment file — no Docker required.

## Documentation site

```bash
cd site
npm install
npm run dev
```

Builds with VitePress. Covers architecture, installation, self-hosting, branching
strategy, CI/CD, and testing.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branching strategy, CI checks,
and how to set up locally.

## Credits & licensing

This project only **orchestrates** other people's work — it doesn't copy their
code. Storyteller and FlowState Reader are each under their own licenses; please
respect them. FlowState is fetched and built from its upstream repository at
image-build time.
