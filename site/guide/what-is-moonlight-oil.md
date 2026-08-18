# What is Moonlight Oil?

Moonlight Oil is a **one-click Windows installer** that turns a regular PC into a private, self-hosted home library. It was built for one specific use case: an 80-year-old father who just wants to click one icon and read his books.

## The Problem

Two great open-source reading apps exist:

| App | What it does | The catch |
|-----|-------------|-----------|
| [Storyteller](https://storyteller-platform.dev/) | Syncs ebooks with audiobook narration | Has a Docker self-hosting recipe, but you need to know Docker |
| [FlowState Reader](https://github.com/PeggyZWY/flowstate-webapp) | Calm, distraction-free focus reading | Only ships as a GitHub Pages site — no container at all |

Neither is something a non-technical person can set up alone. And running two separate apps means two setups, two URLs, two things to explain.

## The Solution

Moonlight Oil combines both apps behind **one big-button home page**, installs the container engine automatically, and wraps the whole thing in a standard Windows installer:

1. **Double-click** the `.exe`
2. **Pick** Docker or Podman
3. **Restart** once
4. **Click** the desktop icon — done

The family member sees one icon, one page, two big buttons. No terminal, no accounts, no cloud.

## What's Inside

```
MoonlightOilSetup.exe
├── Docker/Podman + WSL2 setup
├── Home page (Caddy) ─────────── port 8080
├── Storyteller ────────────────── port 8001
└── FlowState Reader ──────────── port 8003
```

Everything runs locally in containers. Books and settings persist in `C:\Users\Public\MoonlightOil` and survive reinstalls.

## Who is this for?

- A family member who wants to read, not troubleshoot
- Anyone who wants a turnkey local reading station
- Tinkerers who want a clean compose stack they can customize

If you're the tinkerer, skip ahead to [Running the Stack](/self-hosting/running-the-stack).
