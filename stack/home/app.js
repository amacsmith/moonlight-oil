/*
  app.js — the behaviour behind the front door.

  Four jobs, in rough order of how much they matter to the person using this:

    1. Never let Dad click through to a service that isn't listening yet.
       Cold-booting the container engine takes a minute, and a browser error
       page is a dead end for someone who won't think to retry.
    2. Get the library onto whatever he actually likes reading on, via a QR
       code that carries the address across without anyone typing an IP.
    3. Let him make the text bigger, and remember that he did.
    4. Stay out of the way otherwise.
*/
(function () {
  "use strict";

  // Fallbacks for the case where /config.json can't be reached — someone has
  // opened the file directly, say. The page still works, it just trusts the
  // stock ports.
  var config = { homePort: 8080, storytellerPort: 8001, flowstatePort: 8003, lanHost: "" };

  var SERVICES = [
    { key: "storyteller", portKey: "storytellerPort", name: "Read & Listen Together" },
    { key: "flowstate",   portKey: "flowstatePort",   name: "Focus Reader" }
  ];

  // How long we're willing to call a missing service "starting up" before
  // admitting it probably isn't coming. Cold Docker starts can genuinely take
  // this long on an old PC.
  var STARTUP_GRACE_MS = 3 * 60 * 1000;
  var POLL_BUSY_MS = 2000;
  var POLL_IDLE_MS = 20000;

  var startedAt = Date.now();
  var state = {};
  var live = document.getElementById("live");

  function $(id) { return document.getElementById(id); }

  function announce(msg) {
    if (live) live.textContent = msg;
  }

  // -----------------------------------------------------------------------
  // Service status
  // -----------------------------------------------------------------------

  var LABELS = {
    checking: "Checking…",
    ready:    "Ready",
    waking:   "Starting up…",
    down:     "Not running"
  };

  function paintService(svc) {
    var s = state[svc.key] || "checking";
    var card = $("link-" + svc.key);
    var pill = $("status-" + svc.key);
    var diag = $("diag-" + svc.key);

    if (card) card.setAttribute("data-state", s);
    if (pill) {
      pill.setAttribute("data-state", s);
      var text = pill.querySelector(".status-text");
      if (text) text.textContent = LABELS[s];
    }
    if (diag) diag.textContent = LABELS[s];

    // The state rides along in the accessible name, so a screen reader hears
    // "Focus Reader, Starting up" rather than an unqualified link. Deliberately
    // NOT aria-disabled: the card still responds to a click, and answers with
    // an explanation — marking it disabled while it stays operable would be a
    // lie to assistive tech.
    if (card) card.setAttribute("aria-label", svc.name + " — " + LABELS[s]);
  }

  function probe(svc) {
    return fetch("up/" + svc.key, { method: "HEAD", cache: "no-store" })
      .then(function (res) {
        // Caddy answers 502/503/504 when the container behind it isn't
        // listening. Anything else means something is home, even a 404.
        return !(res.status >= 502 && res.status <= 504);
      })
      .catch(function () { return false; });
  }

  function refresh() {
    var checks = SERVICES.map(function (svc) {
      return probe(svc).then(function (up) {
        var before = state[svc.key];
        var after = up ? "ready"
                  : (Date.now() - startedAt < STARTUP_GRACE_MS ? "waking" : "down");
        state[svc.key] = after;
        if (before !== after) {
          paintService(svc);
          if (after === "ready" && before && before !== "checking") {
            announce(svc.name + " is ready.");
          }
        }
        return after;
      });
    });

    Promise.all(checks).then(function (results) {
      var allReady = results.every(function (r) { return r === "ready"; });
      window.setTimeout(refresh, allReady ? POLL_IDLE_MS : POLL_BUSY_MS);
    });
  }

  // -----------------------------------------------------------------------
  // Links
  // -----------------------------------------------------------------------

  function wireLinks() {
    // Point at whatever host is serving this page, so the same page works on
    // the PC itself and from a tablet across the room.
    var host = location.hostname || "localhost";

    SERVICES.forEach(function (svc) {
      var card = $("link-" + svc.key);
      if (!card) return;
      card.href = "http://" + host + ":" + config[svc.portKey];

      card.addEventListener("click", function (e) {
        if (state[svc.key] === "ready") return;
        e.preventDefault();
        var why = state[svc.key] === "down"
          ? svc.name + " isn't running. Close this window and click the Dad's Library icon again."
          : svc.name + " is still starting up. It will say Ready in a moment.";
        announce(why);
        var pill = $("status-" + svc.key);
        if (pill) {
          pill.style.transition = "none";
          pill.style.transform = "scale(1.12)";
          window.setTimeout(function () {
            pill.style.transition = "transform .25s ease";
            pill.style.transform = "";
          }, 10);
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Hand-off to a phone or tablet
  // -----------------------------------------------------------------------

  function renderHandoff() {
    var panel = $("handoff");
    var host = config.lanHost;
    if (!panel || !host || typeof MoonQR === "undefined") return;

    // No point offering to send you where you already are.
    if (host === location.hostname) return;

    var url = "http://" + host + ":" + config.homePort;
    var code;
    try {
      code = MoonQR.encode(url);
    } catch (e) {
      return; // an address too long to encode is not worth a broken panel
    }

    var quiet = 4;
    var span = code.size + quiet * 2;
    var target = $("qr");
    target.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + span + ' ' + span + '" ' +
      'width="100%" height="100%" shape-rendering="crispEdges" role="presentation">' +
      '<rect width="' + span + '" height="' + span + '" fill="#ffffff"/>' +
      '<g transform="translate(' + quiet + ' ' + quiet + ')" fill="#000000">' +
      '<path d="' + MoonQR.toPath(code) + '"/></g></svg>';

    target.setAttribute("aria-label", "QR code for " + url);
    $("handoffAddr").textContent = url;
    panel.hidden = false;
  }

  // -----------------------------------------------------------------------
  // Appearance
  // -----------------------------------------------------------------------

  var SUN = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.6" fill="currentColor"/>' +
    '<path d="M12 1.8v2.6M12 19.6v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M1.8 12h2.6M19.6 12h2.6' +
    'M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  var MOON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M20.5 15.3A8.8 8.8 0 0 1 8.7 3.5a8.8 8.8 0 1 0 11.8 11.8Z" fill="currentColor"/></svg>';

  function setupTheme() {
    var root = document.documentElement;
    var btn = $("themeToggle");
    var icon = $("themeIcon");
    var text = $("themeText");

    function effective() {
      var set = root.getAttribute("data-theme");
      if (set) return set;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function paint() {
      var dark = effective() === "dark";
      // The button offers the *other* mode, so it says what you'll get.
      icon.innerHTML = dark ? SUN : MOON;
      text.textContent = dark ? "Light" : "Dark";
      btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    }

    paint();
    btn.addEventListener("click", function () {
      var next = effective() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("moon-theme", next); } catch (e) {}
      paint();
    });
  }

  function setupTextSize() {
    var root = document.documentElement;
    var buttons = document.querySelectorAll(".sizes button");
    var current = root.getAttribute("data-text") || "normal";

    function paint() {
      Array.prototype.forEach.call(buttons, function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-size") === current));
      });
    }

    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener("click", function () {
        current = b.getAttribute("data-size");
        if (current === "normal") root.removeAttribute("data-text");
        else root.setAttribute("data-text", current);
        try { localStorage.setItem("moon-text", current); } catch (e) {}
        paint();
        announce("Text size: " + current);
      });
    });

    paint();
  }

  function setupGreeting() {
    var h = new Date().getHours();
    $("greeting").textContent =
      h < 5  ? "Reading late tonight?" :
      h < 12 ? "Good morning" :
      h < 18 ? "Good afternoon" :
               "Good evening";
  }

  function setupHelp() {
    var dlg = $("helpDialog");
    var open = $("helpBtn");
    var close = $("helpClose");
    if (!dlg || !open) return;

    open.addEventListener("click", function () {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    });
    close.addEventListener("click", function () { dlg.close(); });

    // Clicking the dimmed area outside the sheet closes it — the backdrop is
    // part of the dialog element, so a click landing on the element itself
    // (rather than its contents) means the user clicked outside.
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });
  }

  // -----------------------------------------------------------------------

  function start() {
    setupGreeting();
    setupTheme();
    setupTextSize();
    setupHelp();

    SERVICES.forEach(function (svc) {
      state[svc.key] = "checking";
      paintService(svc);
    });

    fetch("config.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (loaded) {
        if (loaded) {
          for (var k in loaded) {
            if (Object.prototype.hasOwnProperty.call(loaded, k)) config[k] = loaded[k];
          }
        }
        wireLinks();
        renderHandoff();
        refresh();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
