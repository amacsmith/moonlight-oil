import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const env = readFileSync(resolve(ROOT, "stack/.env.example"), "utf8");

describe(".env.example", () => {
  const required = [
    "HOME_PORT",
    "STORYTELLER_PORT",
    "READIUM_PORT",
    "FLOWSTATE_PORT",
    "STORYTELLER_SECRET_KEY",
    "STORYTELLER_LOG_LEVEL",
    "PUID",
    "PGID",
    "FLOWSTATE_REF",
    "LAN_HOST",
  ];

  for (const key of required) {
    it(`documents ${key}`, () => {
      assert.match(env, new RegExp(`^${key}=`, "m"));
    });
  }

  it("warns not to share the secret key", () => {
    assert.match(env, /replace-me|do not share/i);
  });

  it("explains that LAN_HOST is optional", () => {
    // It's blank until the launcher fills it in, and a blank value must not
    // read as "something is broken".
    assert.match(env, /LAN_HOST=\s*$/m);
    assert.match(env, /QR code/i);
  });
});
