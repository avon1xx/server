// ── SIDEBAR TOGGLE FUNCTIONS ──
function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const isMob = window.innerWidth <= 640;
  if (isMob) {
    sb.classList.toggle("open");
    const closeBtn = document.getElementById("sb-close-btn");
    if (closeBtn) closeBtn.style.display = sb.classList.contains("open") ? "flex" : "none";
  } else {
    sb.classList.toggle("collapsed");
  }
}

function closeSidebar() {
  const sb = document.getElementById("sidebar");
  sb.classList.remove("open");
  const closeBtn = document.getElementById("sb-close-btn");
  if (closeBtn) closeBtn.style.display = "none";
}

// Make globally available
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;