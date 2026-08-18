import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const yml = readFileSync(resolve(ROOT, "stack/docker-compose.yml"), "utf8");

describe("docker-compose.yml", () => {
  it("defines the home service", () => {
    assert.match(yml, /^\s+home:/m);
  });

  it("defines the storyteller service", () => {
    assert.match(yml, /^\s+storyteller:/m);
  });

  it("defines the flowstate service", () => {
    assert.match(yml, /^\s+flowstate:/m);
  });

  it("uses the official storyteller image", () => {
    assert.match(
      yml,
      /registry\.gitlab\.com\/storyteller-platform\/storyteller/,
    );
  });

  it("uses caddy for the home page", () => {
    assert.match(yml, /caddy:2-alpine/);
  });

  it("defines a bridge network", () => {
    assert.match(yml, /driver:\s*bridge/);
  });

  it("maps the home port", () => {
    assert.match(yml, /HOME_PORT.*:80/);
  });

  it("maps the storyteller port", () => {
    assert.match(yml, /STORYTELLER_PORT.*:8001/);
  });

  it("maps the flowstate port", () => {
    assert.match(yml, /FLOWSTATE_PORT.*:80/);
  });

  it("requires STORYTELLER_SECRET_KEY", () => {
    assert.match(yml, /STORYTELLER_SECRET_KEY/);
  });

  it("mounts storyteller data volume", () => {
    assert.match(yml, /\.\/data\/storyteller/);
  });

  it("builds flowstate from context", () => {
    assert.match(yml, /context:\s*\.\/flowstate/);
  });
});
