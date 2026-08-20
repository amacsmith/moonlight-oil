# Testing

Two suites, answering two different questions.

The **validation suite** reads the source and checks it says the right things. It needs no Docker, no Windows and no dependencies, so it runs anywhere in about a quarter of a second.

The **browser suite** checks the home page actually *behaves*, by driving it in headless Chromium against a real Caddy container. That's a different question, and worth the extra machinery — see [why](#why-both) below.

## Validation Suite

```bash
npm test
```

186 tests using Node's built-in `node:test` runner.

### Compose Validation
- All three services (`home`, `storyteller`, `flowstate`) are defined
- Required ports, volumes and the bridge network are configured
- The `home` service mounts the Caddyfile, receives the real ports through its environment, and has a healthcheck
- The Caddyfile is **not** inside the served directory (it would be downloadable at `/Caddyfile`)

### Caddy Config Validation
- `/config.json` and `/up/<service>` exist and take their ports from the environment
- Every service the page probes has a matching proxy, and vice versa — the two lists are compared against each other, so adding one without the other fails
- Probes have dial and response timeouts, so a hung upstream can't leave the page saying *Checking…* forever
- The CSP forbids inline and third-party scripts, and the page and its scripts are served `no-cache`

Caddy itself is the real judge of validity, so CI also runs `caddy validate` against the file. Locally:

```bash
npm run caddy:check
```

### Home Page Validation
- Document basics: doctype, title, viewport, `color-scheme`, `theme-color`, favicon
- No inline `<script>` blocks anywhere — the CSP would block them
- Live status: probe endpoints, `HEAD` requests, the 502-means-not-listening rule, the startup grace period, poll intervals
- Cards refuse to open a service that isn't ready, and explain why
- Ports come from `/config.json`; no `http://localhost` in the markup
- Hand-off panel, QR quiet zone, and the "don't offer to send you where you already are" rule
- Three text sizes, scaled from one custom property, remembered across visits
- Theme: OS preference, explicit override, applied before first paint
- Accessibility: skip link, focus rings, reduced motion, decorative icons hidden, drawn icons rather than emoji

### QR Encoder
58 tests, because a QR code that is subtly wrong still *looks* like a QR code:

- **Spec constants.** Format bits for all eight masks and version bits for versions 7–10 are compared against the values printed in ISO/IEC 18004. The encoder derives them via BCH rather than tabulating them, so agreement is evidence rather than a tautology.
- **Reed-Solomon.** Every codeword block must have zero syndromes — exactly what a decoder computes before it trusts a symbol. Computed by an independent GF(256) implementation in the test file.
- **Placement.** The matrix is read back the way a decoder reads it (undo the mask, walk the zigzag) and must reproduce the codewords, then the payload string itself.
- **Structure.** Finder patterns in three corners, alternating timing patterns, the module that is always dark, size following 4V+17.
- **Capacity.** Version selection at each boundary, the switch to a 16-bit length field at version 10, exact-fit at 213 bytes, and a clear error at 214.
- **A golden matrix**, confirmed by decoding a rendered image with an independent decoder.

### Dockerfile Validation
- Multi-stage build; `CI=false` and `PUBLIC_URL=/` are set
- npm registry override is present (upstream's lockfile pins a dead mirror)
- nginx SPA fallback is configured

### Installer Scripts
- The Inno Setup `.iss` file has the sections it needs
- `common.ps1` defines every function the other scripts call
- `Get-LanAddress` skips loopback and link-local addresses and picks the interface carrying the default route, so it can't hand a tablet a Docker virtual adapter
- `Set-EnvValue` rewrites only the key it was given — the secret key lives in the same file
- `launch.ps1` writes `LAN_HOST` *before* `compose up`, or Caddy would never see it

### Environment Config
- `.env.example` documents every variable, including `LAN_HOST` and the fact that leaving it blank is fine

## Browser Suite

Needs Docker and Playwright.

```bash
npm run home:up         # start just the home service
npm run test:browser    # 22 checks in headless Chromium
npm run home:down
```

It deliberately runs with Storyteller and FlowState **down**. That isn't laziness about starting them — "not listening yet" is the state the home page exists to handle well, and it's the state the person this project is built for meets every cold morning.

The checks cover: no JavaScript errors, the saved theme applying before paint, both services reporting *Starting up…*, a not-ready card refusing to navigate and saying why, link ports coming from `/config.json`, the QR code rendering with a quiet zone and the right address, text size genuinely changing the rendered size and surviving a reload, the help sheet, the theme toggle, and a phone viewport with no sideways scrolling and comfortable tap targets.

### Why Both {#why-both}

Source-level tests can only confirm the code *says* the right thing. Two bugs sailed through every one of them and were caught the moment a browser ran the page:

1. **The CSP blocked the page's own startup script.** `boot.js` began life as an inline `<script>` in the head — the standard trick for applying a saved theme before first paint. The site's `script-src 'self'` policy refused to run it. Every source-level assertion still passed: the script was there, it read the right key, it set the right attribute. It simply never executed.

2. **`aria-disabled` on a still-clickable card.** Marking a not-ready card as disabled read well in the source and was wrong in practice: the card still responded to a mouse click, so assistive technology and automation were told it was inert while it wasn't. Playwright refused to click it, which is precisely what a screen reader user would have experienced.

Both are the kind of bug that only exists in the gap between what code says and what a browser does.

## Adding Tests

Validation tests live in `tests/*.test.mjs` and are plain Node scripts — no framework, no dependencies.

```bash
node --test tests/validate-qr.test.mjs
```

The browser suite is a single script at `tests/browser/home.e2e.mjs`. It expects the home service on port 8080; override with `HOME_URL`, `LAN_HOST` and `HOME_PORT` if yours differ.

When a test exists to stop a specific regression coming back, say so in a comment. A bare assertion tells the next person what broke but not why anyone cared.
