/*
  Tests for the home page — the one screen the person this project exists for
  will ever look at.

  The page is split across four files now (markup, a pre-paint boot script, the
  behaviour, and the QR encoder), so these check both that each file holds up on
  its own and that they're actually wired to each other. Several assertions here
  exist to stop a specific regression coming back; those say so.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

const html = read("stack/home/index.html");
const app = read("stack/home/app.js");
const boot = read("stack/home/boot.js");

describe("home page — document basics", () => {
  it("has a doctype", () => assert.match(html, /^<!doctype html>/i));
  it("has a title", () => assert.match(html, /<title>.*Library.*<\/title>/i));
  it("has the viewport meta tag", () => assert.match(html, /name="viewport"/));
  it("declares a language", () => assert.match(html, /<html lang="en">/));

  it("tells the browser it supports both colour schemes", () => {
    // Without this the browser paints scrollbars and form controls light even
    // when the page is dark.
    assert.match(html, /<meta name="color-scheme" content="light dark">/);
  });

  it("sets a theme-colour for each scheme", () => {
    assert.match(html, /name="theme-color"[^>]*prefers-color-scheme: light/);
    assert.match(html, /name="theme-color"[^>]*prefers-color-scheme: dark/);
  });

  it("ships a favicon and the file exists", () => {
    assert.match(html, /rel="icon"/);
    assert.ok(existsSync(resolve(ROOT, "stack/home/favicon.ico")));
  });

  it("loads its scripts as separate files", () => {
    // The site's CSP forbids inline scripts; keeping them external is what
    // makes that policy possible.
    for (const src of ["boot.js", "qr.js", "app.js"]) {
      assert.match(html, new RegExp(`<script src="${src}"></script>`));
    }
  });

  it("has no inline script blocks", () => {
    const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [];
    assert.deepEqual(inline, [], "an inline script would be blocked by the CSP");
  });
});

describe("home page — the two big buttons", () => {
  it("has a card for each service", () => {
    assert.match(html, /id="link-storyteller"/);
    assert.match(html, /id="link-flowstate"/);
  });

  it("tags each card with the service it opens", () => {
    assert.match(html, /data-service="storyteller"/);
    assert.match(html, /data-service="flowstate"/);
  });

  it("gives every card an accessible name at runtime", () => {
    // The name carries the live status ("Focus Reader — Starting up"), so it
    // is set from app.js rather than baked into the markup.
    assert.match(app, /setAttribute\("aria-label", svc\.name \+ " — " \+ LABELS\[s\]\)/);
  });

  it("never marks a still-clickable card as aria-disabled", () => {
    // Regression guard: aria-disabled made the card unreachable to assistive
    // tech and to automation, while it still responded to a mouse click.
    // (Matches the call, not the word — the code explains itself in a comment.)
    assert.doesNotMatch(app, /setAttribute\(\s*["']aria-disabled/);
    assert.doesNotMatch(html, /aria-disabled=/);
  });

  it("starts each card in the checking state", () => {
    assert.match(html, /id="link-storyteller"[^>]*data-state="checking"/);
  });
});

describe("home page — live service status", () => {
  it("probes the same-origin health endpoints", () => {
    assert.match(app, /fetch\("up\/" \+ svc\.key/);
  });

  it("uses HEAD so a probe costs nothing but a status line", () => {
    assert.match(app, /method:\s*"HEAD"/);
  });

  it("treats a gateway error as 'not listening' and anything else as alive", () => {
    assert.match(app, /res\.status >= 502 && res\.status <= 504/);
  });

  it("refuses to open a service that isn't ready", () => {
    assert.match(app, /if \(state\[svc\.key\] === "ready"\) return;\s*\n\s*e\.preventDefault\(\);/);
  });

  it("explains itself rather than failing silently", () => {
    assert.match(app, /still starting up/);
    assert.match(app, /isn't running/);
  });

  it("gives a cold container engine a few minutes before giving up", () => {
    assert.match(app, /STARTUP_GRACE_MS\s*=\s*3 \* 60 \* 1000/);
  });

  it("polls quickly while waiting and slowly once settled", () => {
    assert.match(app, /POLL_BUSY_MS\s*=\s*2000/);
    assert.match(app, /POLL_IDLE_MS\s*=\s*20000/);
  });

  it("announces status changes to screen readers", () => {
    assert.match(html, /role="status"\s+aria-live="polite"/);
  });

  it("shows the same status in the help sheet", () => {
    assert.match(html, /id="diag-storyteller"/);
    assert.match(html, /id="diag-flowstate"/);
  });
});

describe("home page — configuration", () => {
  it("reads the real ports from the server instead of hardcoding them", () => {
    assert.match(app, /fetch\("config\.json"/);
  });

  it("still works if that request fails", () => {
    assert.match(app, /var config = \{ homePort: 8080, storytellerPort: 8001, flowstatePort: 8003/);
  });

  it("points links at whichever host served the page", () => {
    // So the page works both on the PC and from a tablet across the room.
    assert.match(app, /location\.hostname/);
  });

  it("has no hardcoded localhost link in the markup", () => {
    assert.doesNotMatch(html, /href="http:\/\/localhost/);
  });
});

describe("home page — reading on another device", () => {
  it("has a hand-off panel, hidden until there's an address worth showing", () => {
    assert.match(html, /<section class="handoff" id="handoff" hidden/);
  });

  it("builds the QR code from the LAN address", () => {
    assert.match(app, /MoonQR\.encode\(url\)/);
    assert.match(app, /config\.lanHost/);
  });

  it("doesn't offer to send you where you already are", () => {
    assert.match(app, /if \(host === location\.hostname\) return;/);
  });

  it("draws the code with a quiet zone", () => {
    // Scanners need the light margin; without it many simply won't lock on.
    assert.match(app, /var quiet = 4;/);
  });

  it("survives an address too long to encode", () => {
    assert.match(app, /catch \(e\) \{\s*\n\s*return; \/\/ an address too long/);
  });
});

describe("home page — legibility controls", () => {
  it("offers three text sizes", () => {
    for (const size of ["normal", "large", "largest"]) {
      assert.match(html, new RegExp(`data-size="${size}"`));
    }
  });

  it("scales the whole page from one number", () => {
    assert.match(html, /font-size: calc\(100% \* var\(--text-scale\)\)/);
    assert.match(html, /:root\[data-text="large"\]\s*\{\s*--text-scale: 1\.16/);
    assert.match(html, /:root\[data-text="largest"\]\s*\{\s*--text-scale: 1\.34/);
  });

  it("reports which size is selected", () => {
    assert.match(html, /aria-pressed="true"/);
    assert.match(app, /setAttribute\("aria-pressed"/);
  });

  it("remembers the choice", () => {
    assert.match(app, /localStorage\.setItem\("moon-text"/);
    assert.match(boot, /localStorage\.getItem\("moon-text"\)/);
  });
});

describe("home page — theme", () => {
  it("has a toggle", () => assert.match(html, /id="themeToggle"/));

  it("supports dark by preference and by choice", () => {
    assert.match(html, /prefers-color-scheme:\s*dark/);
    assert.match(html, /:root\[data-theme="dark"\]/);
  });

  it("lets an explicit light choice win over a dark OS", () => {
    assert.match(html, /:root:not\(\[data-theme="light"\]\)/);
  });

  it("remembers the choice", () => {
    assert.match(app, /localStorage\.setItem\("moon-theme"/);
    assert.match(boot, /localStorage\.getItem\("moon-theme"\)/);
  });

  it("applies the saved theme before the first paint", () => {
    // boot.js must be loaded in the head, ahead of the body, or the page
    // flashes light before turning dark.
    const head = html.slice(0, html.indexOf("</head>"));
    assert.match(head, /<script src="boot\.js"><\/script>/);
  });

  it("survives storage being unavailable", () => {
    assert.match(boot, /catch \(e\)/);
  });
});

describe("home page — accessibility and motion", () => {
  it("has a skip link", () => assert.match(html, /class="skip-link"/));

  it("shows a visible focus ring", () => assert.match(html, /:focus-visible/));

  it("honours prefers-reduced-motion", () => {
    assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
    const block = html.slice(html.indexOf("@media (prefers-reduced-motion: reduce)"));
    assert.match(block, /animation: none/);
  });

  it("hides decorative icons from screen readers", () => {
    const icons = html.match(/<span class="icon[^"]*"[^>]*>/g) || [];
    assert.ok(icons.length >= 2);
    for (const icon of icons) assert.match(icon, /aria-hidden="true"/);
  });

  it("uses drawn icons rather than emoji, which render differently everywhere", () => {
    assert.match(html, /<svg viewBox="0 0 32 32"/);
    assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}]/u);
  });

  it("closes the help sheet when the backdrop is clicked", () => {
    assert.match(app, /if \(e\.target === dlg\) dlg\.close\(\)/);
  });
});

describe("home page — theming tokens", () => {
  it("defines the palette as custom properties", () => {
    for (const token of ["--ink:", "--paper:", "--gold:", "--focus:", "--ok:"]) {
      assert.match(html, new RegExp(token.replace(/[-]/g, "\\$&")));
    }
  });

  it("gives every status state a colour", () => {
    for (const state of ["checking", "ready", "waking", "down"]) {
      assert.match(html, new RegExp(`\\.status\\[data-state="${state}"\\]`));
    }
  });
});
