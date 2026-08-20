/*
  Drives the real home page in a real browser against a real Caddy container.

  The file-level tests next door read the source and check it says the right
  things. This one checks the page *behaves* — which is a different question,
  and the one that matters. Two bugs that every source-level test waved through
  were caught here: a Content-Security-Policy that blocked the page's own
  pre-paint script, and an aria-disabled attribute that made a still-clickable
  card unreachable.

  Expects the `home` service to be up on port 8080 with LAN_HOST set, and with
  the two library services deliberately absent — "not listening yet" is the
  state worth testing, because it's the one Dad meets every cold morning.

      docker compose -f stack/docker-compose.yml up -d home
      node tests/browser/home.e2e.mjs
*/
import { chromium } from "playwright";

const BASE = process.env.HOME_URL || "http://localhost:8080/";
const LAN = process.env.LAN_HOST || "192.168.1.42";
const PORT = process.env.HOME_PORT || "8080";

const failures = [];
let checks = 0;

function check(name, ok, detail = "") {
  checks++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 1100, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (m) => {
    // The probes are *expected* to fail here; that's the scenario. Everything
    // else is a genuine error.
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) {
      consoleErrors.push(m.text());
    }
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // --- the page runs at all ---------------------------------------------
  check("no JavaScript errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  // A CSP that blocks boot.js is invisible until you check the effect.
  const themeApplied = await page.evaluate(() => {
    localStorage.setItem("moon-theme", "dark");
    return true;
  });
  await page.reload({ waitUntil: "networkidle" });
  const themeAttr = await page.getAttribute("html", "data-theme");
  check("saved theme is applied before paint", themeApplied && themeAttr === "dark", String(themeAttr));
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // --- status ------------------------------------------------------------
  for (const [id, label] of [["storyteller", "Read & Listen"], ["flowstate", "Focus Reader"]]) {
    const text = (await page.textContent(`#status-${id} .status-text`)).trim();
    check(`${label} reports it is still starting`, text === "Starting up…", text);
  }

  const cardState = await page.getAttribute("#link-storyteller", "data-state");
  check("card carries the not-ready state", cardState === "waking", String(cardState));

  const label = await page.getAttribute("#link-storyteller", "aria-label");
  check("accessible name includes the status", /Starting up/.test(label), label);

  const disabled = await page.getAttribute("#link-storyteller", "aria-disabled");
  check("card is not marked aria-disabled", disabled === null, String(disabled));

  // --- the thing this is all for ----------------------------------------
  const before = page.url();
  await page.click("#link-storyteller");
  await page.waitForTimeout(500);
  check("clicking a service that isn't up does NOT navigate", page.url() === before, page.url());
  check(
    "and says why",
    /still starting up/i.test(await page.textContent("#live")),
    await page.textContent("#live"),
  );

  // --- configuration ------------------------------------------------------
  const href = await page.getAttribute("#link-storyteller", "href");
  check("link port comes from /config.json", /:8001$/.test(href), href);

  // --- hand-off -----------------------------------------------------------
  check("hand-off panel is shown", await page.isVisible("#handoff"));
  const addr = await page.textContent("#handoffAddr");
  check("hand-off shows the LAN address", addr === `http://${LAN}:${PORT}`, addr);
  const qr = await page.innerHTML("#qr");
  check("QR code rendered as SVG", qr.includes("<svg") && qr.includes("<path"));

  const quiet = await page.evaluate(() => {
    const svg = document.querySelector("#qr svg");
    return svg ? svg.getAttribute("viewBox") : null;
  });
  check("QR has a quiet zone", /^0 0 (\d+) \1$/.test(quiet || ""), String(quiet));

  // --- legibility ---------------------------------------------------------
  const size = () => page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector("h1")).fontSize));
  const normal = await size();
  await page.click('.sizes button[data-size="largest"]');
  await page.waitForTimeout(200);
  check("largest setting really enlarges the text", (await size()) > normal, `${normal} -> ${await size()}`);

  await page.reload({ waitUntil: "networkidle" });
  check("text size survives a reload", (await page.getAttribute("html", "data-text")) === "largest");
  await page.click('.sizes button[data-size="normal"]');
  await page.waitForTimeout(200);

  // --- help ---------------------------------------------------------------
  await page.click("#helpBtn");
  await page.waitForTimeout(300);
  check("help sheet opens", await page.isVisible("#helpDialog"));
  check(
    "help sheet shows the same live status",
    (await page.textContent("#diag-storyteller")).trim() === "Starting up…",
  );
  await page.click("#helpClose");
  await page.waitForTimeout(200);
  check("help sheet closes", !(await page.isVisible("#helpDialog")));

  // --- theme --------------------------------------------------------------
  await page.click("#themeToggle");
  await page.waitForTimeout(250);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("theme toggle darkens the page", bg === "rgb(20, 23, 29)", bg);

  await context.close();

  // --- phone --------------------------------------------------------------
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const small = await phone.newPage();
  await small.goto(BASE, { waitUntil: "networkidle" });
  await small.waitForTimeout(800);
  const scrollWidth = await small.evaluate(() => document.documentElement.scrollWidth);
  check("no sideways scrolling on a phone", scrollWidth <= 390, `scrollWidth=${scrollWidth}`);

  const tap = await small.evaluate(() => {
    const r = document.querySelector("#link-storyteller").getBoundingClientRect();
    return Math.min(r.width, r.height);
  });
  check("cards are a comfortable tap target", tap >= 44, `${Math.round(tap)}px`);
  await phone.close();
} finally {
  await browser.close();
}

console.log(
  failures.length === 0
    ? `\nAll ${checks} browser checks passed.`
    : `\n${failures.length} of ${checks} browser checks FAILED:\n  - ${failures.join("\n  - ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
