/*
  Tests for the Caddy config.

  Caddy itself is the real judge of whether this file is valid, and CI runs
  `caddy validate` against it. What these tests protect is the *contract* the
  home page depends on: the endpoint names, the ports coming from the
  environment rather than being written down twice, and the header policy that
  lets the page ship without inline scripts.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const caddyfile = readFileSync(resolve(ROOT, "stack/caddy/Caddyfile"), "utf8");
const app = readFileSync(resolve(ROOT, "stack/home/app.js"), "utf8");

describe("Caddyfile — server setup", () => {
  it("listens on port 80 inside the container", () => {
    assert.match(caddyfile, /^:80 \{/m);
  });

  it("serves the home directory", () => {
    assert.match(caddyfile, /root \* \/usr\/share\/caddy/);
    assert.match(caddyfile, /file_server/);
  });

  it("turns off the admin API and TLS machinery", () => {
    // This only ever serves one PC's living room; neither is wanted here.
    assert.match(caddyfile, /admin off/);
    assert.match(caddyfile, /auto_https off/);
  });
});

describe("Caddyfile — runtime configuration", () => {
  it("exposes /config.json", () => {
    assert.match(caddyfile, /handle \/config\.json \{/);
  });

  it("takes every port from the environment", () => {
    for (const key of ["HOME_PORT", "STORYTELLER_PORT", "FLOWSTATE_PORT"]) {
      assert.match(caddyfile, new RegExp(`\\{\\$${key}:\\d+\\}`), `${key} should have an env default`);
    }
  });

  it("passes the LAN address through for the QR code", () => {
    assert.match(caddyfile, /\{\$LAN_HOST:\}/);
  });

  it("never caches the config", () => {
    const block = caddyfile.slice(caddyfile.indexOf("handle /config.json"));
    assert.match(block.slice(0, 300), /Cache-Control "no-store"/);
  });

  it("emits the keys the page actually reads", () => {
    const line = caddyfile.match(/respond `(\{.*\})`/);
    assert.ok(line, "the config response should be a JSON literal");
    for (const key of ["homePort", "storytellerPort", "flowstatePort", "lanHost"]) {
      assert.ok(line[1].includes(`"${key}"`), `config.json should include ${key}`);
      assert.ok(app.includes(key), `app.js should use ${key}`);
    }
  });
});

describe("Caddyfile — liveness probes", () => {
  for (const service of ["storyteller", "flowstate"]) {
    it(`proxies /up/${service}`, () => {
      assert.match(caddyfile, new RegExp(`handle /up/${service} \\{`));
    });
  }

  it("proxies to the containers by name on the internal network", () => {
    assert.match(caddyfile, /reverse_proxy \{\$STORYTELLER_UPSTREAM:storyteller:8001\}/);
    assert.match(caddyfile, /reverse_proxy \{\$FLOWSTATE_UPSTREAM:flowstate:80\}/);
  });

  it("rewrites the probe to the service root", () => {
    const probes = caddyfile.match(/handle \/up\/\w+ \{[\s\S]*?\n\t\}/g) || [];
    assert.equal(probes.length, 2);
    for (const probe of probes) assert.match(probe, /rewrite \* \//);
  });

  it("bounds how long a probe can hang", () => {
    // A stuck upstream must not leave the page saying "Checking…" forever.
    assert.match(caddyfile, /dial_timeout 2s/);
    assert.match(caddyfile, /response_header_timeout 4s/);
  });

  it("covers exactly the services the page probes", () => {
    const declared = [...caddyfile.matchAll(/handle \/up\/(\w+) \{/g)].map((m) => m[1]).sort();
    const probed = [...app.matchAll(/\{ key: "(\w+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(declared, probed, "every probed service needs a proxy, and vice versa");
  });
});

describe("Caddyfile — headers", () => {
  it("sets a content security policy", () => {
    assert.match(caddyfile, /Content-Security-Policy/);
  });

  it("forbids inline and third-party scripts", () => {
    const csp = caddyfile.match(/Content-Security-Policy "([^"]+)"/)[1];
    assert.match(csp, /script-src 'self'/);
    assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), "inline scripts must stay blocked");
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
  });

  it("allows inline styles, which the page does use", () => {
    const csp = caddyfile.match(/Content-Security-Policy "([^"]+)"/)[1];
    assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  });

  it("stops browsers guessing content types", () => {
    assert.match(caddyfile, /X-Content-Type-Options "nosniff"/);
  });

  it("serves the page and its scripts without caching", () => {
    // Otherwise an update leaves Dad looking at yesterday's page. "/" matters
    // as much as "/index.html" — the bare path is how he actually arrives.
    const block = caddyfile.slice(caddyfile.indexOf("@page"));
    assert.match(block, /@page path \/ \/index\.html \/app\.js \/qr\.js/);
    assert.match(block, /header @page Cache-Control "no-cache"/);
  });
});
