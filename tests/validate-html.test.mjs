import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(ROOT, "stack/home/index.html"), "utf8");

describe("home page HTML", () => {
  it("has a doctype", () => {
    assert.match(html, /^<!doctype html>/i);
  });

  it("has a title", () => {
    assert.match(html, /<title>.*Library.*<\/title>/i);
  });

  it("has the viewport meta tag", () => {
    assert.match(html, /name="viewport"/);
  });

  it("has the storyteller card", () => {
    assert.match(html, /id="link-storyteller"/);
  });

  it("has the flowstate card", () => {
    assert.match(html, /id="link-flowstate"/);
  });

  it("has aria-label on cards", () => {
    const cards = html.match(/<a class="card"[^>]*/g) || [];
    assert.ok(cards.length >= 2, "should have at least 2 cards");
    for (const card of cards) {
      assert.match(card, /aria-label="/, `card missing aria-label: ${card}`);
    }
  });

  it("has the theme toggle button", () => {
    assert.match(html, /id="themeToggle"/);
  });

  it("has the help dialog", () => {
    assert.match(html, /<dialog/);
    assert.match(html, /id="helpDialog"/);
  });

  it("uses dynamic hostname, not hardcoded localhost in links", () => {
    assert.match(html, /location\.hostname/);
  });

  it("defines CSS custom properties for theming", () => {
    assert.match(html, /--ink:/);
    assert.match(html, /--paper:/);
    assert.match(html, /--gold:/);
  });

  it("has dark theme support", () => {
    assert.match(html, /data-theme="dark"/);
    assert.match(html, /prefers-color-scheme:\s*dark/);
  });

  it("has prefers-reduced-motion support", () => {
    assert.match(html, /prefers-reduced-motion/);
  });

  it("has focus-visible outlines", () => {
    assert.match(html, /focus-visible/);
  });

  it("stores theme preference in localStorage", () => {
    assert.match(html, /localStorage/);
  });
});
