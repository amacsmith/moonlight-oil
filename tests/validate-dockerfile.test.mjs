import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const dockerfile = readFileSync(
  resolve(ROOT, "stack/flowstate/Dockerfile"),
  "utf8",
);

describe("FlowState Dockerfile", () => {
  it("uses a multi-stage build", () => {
    const froms = dockerfile.match(/^FROM\s/gm) || [];
    assert.ok(froms.length >= 2, "should have at least 2 FROM stages");
  });

  it("builds on Node 16", () => {
    assert.match(dockerfile, /FROM node:16/);
  });

  it("sets CI=false", () => {
    assert.match(dockerfile, /CI=false/);
  });

  it("sets PUBLIC_URL=/", () => {
    assert.match(dockerfile, /PUBLIC_URL=\//);
  });

  it("forces official npm registry", () => {
    assert.match(dockerfile, /NPM_CONFIG_REGISTRY=https:\/\/registry\.npmjs\.org/);
  });

  it("sets SKIP_PREFLIGHT_CHECK", () => {
    assert.match(dockerfile, /SKIP_PREFLIGHT_CHECK=true/);
  });

  it("removes stale lockfile", () => {
    assert.match(dockerfile, /rm -f package-lock\.json/);
  });

  it("uses nginx for serving", () => {
    assert.match(dockerfile, /FROM nginx:alpine/);
  });

  it("configures SPA fallback", () => {
    assert.match(dockerfile, /try_files/);
  });

  it("does not set --openssl-legacy-provider in ENV or NODE_OPTIONS", () => {
    assert.doesNotMatch(dockerfile, /^ENV.*openssl-legacy-provider/m);
    assert.doesNotMatch(dockerfile, /^ENV.*NODE_OPTIONS/m);
  });
});
