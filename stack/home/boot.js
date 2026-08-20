/*
  boot.js — runs before the first paint, and does nothing else.

  Restoring the saved theme and text size has to happen before the browser
  paints, or the page flashes light-then-dark on every visit. That normally
  argues for an inline <script> in the head, but the Content-Security-Policy
  this site ships with refuses inline scripts. A tiny same-origin file loaded
  synchronously gets the same result without poking a hole in the policy.
*/
(function () {
  try {
    var theme = localStorage.getItem("moon-theme");
    if (theme) document.documentElement.setAttribute("data-theme", theme);

    var size = localStorage.getItem("moon-text");
    if (size && size !== "normal") document.documentElement.setAttribute("data-text", size);
  } catch (e) {
    // Private browsing, or storage switched off. The defaults are fine.
  }
})();
