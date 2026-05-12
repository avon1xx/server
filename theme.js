// ── THEME ──
function initTheme() {
  const saved = LS.get("nx3_theme");
  if (saved !== null && THEMES.includes(saved)) {
    themeIdx = THEMES.indexOf(saved);
  }
  applyTheme();
}

function cycleTheme() {
  themeIdx = (themeIdx + 1) % THEMES.length;
  applyTheme();
  LS.set("nx3_theme", THEMES[themeIdx]);
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", THEMES[themeIdx]);
  const themeLabel = document.getElementById("theme-label");
  if (themeLabel) themeLabel.textContent = THEME_LABELS[themeIdx];
  const hljsLink = document.getElementById("hljs-theme");
  if (hljsLink) {
    hljsLink.href = themeIdx === 1
      ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css"
      : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css";
  }
}

function applyLite() {
  document.documentElement.setAttribute("data-perf","lite");
  const chip = document.getElementById("perf-chip");
  if (chip) chip.classList.add("show");
  streamOn = false; // auto-disable streaming in lite mode
}

function initPerf() {
  if (perfMode === "lite") { applyLite(); return; }
  if (perfMode === "full") return;
  const weak = (navigator.hardwareConcurrency || 4) <= 2
    || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  if (weak) applyLite();
}