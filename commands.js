// ── COMMAND PALETTE ──
const CMD_ITEMS = [
  { label:"New chat",           key:"N", action:() => { if (typeof newChat === "function") newChat(); } },
  { label:"Settings",           key:"S", action:() => openModal("settings-modal") },
  { label:"Source manager",     key:"R", action:() => openModal("sources-modal") },
  { label:"Toggle notebook",    key:"B", action:() => { if (typeof toggleNotebook === "function") toggleNotebook(); } },
  { label:"Export chat",        key:"E", action:() => { if (typeof exportChat === "function") exportChat(); } },
  { label:"Import chat",        key:"I", action:() => openModal("import-modal") },
  { label:"Mode: Chat",         key:"",  action:() => { if (typeof setMode === "function") setMode("chat"); } },
  { label:"Mode: How-To",       key:"",  action:() => { if (typeof setMode === "function") setMode("howto"); } },
  { label:"Mode: Research",     key:"",  action:() => { if (typeof setMode === "function") setMode("research"); } },
  { label:"Cycle theme",        key:"T", action:() => cycleTheme() },
  { label:"Toggle templates",   key:"",  action:() => { if (typeof toggleTemplates === "function") toggleTemplates(); } },
  { label:"Toggle streaming",   key:"",  action:() => { streamOn=!streamOn; LS.set("nx3_stream",streamOn); if (typeof appendSystem === "function") appendSystem(`Streaming ${streamOn?"on":"off"}`); } },
];

let cmdSel = 0;

function openCmd() {
  const palette = document.getElementById("cmd-palette");
  const input = document.getElementById("cmd-input");
  if (palette) palette.classList.add("open");
  if (input) { input.value = ""; input.focus(); }
  renderCmdResults("");
}

function closeCmd() {
  const palette = document.getElementById("cmd-palette");
  if (palette) palette.classList.remove("open");
}

function renderCmdResults(q) {
  const items = q
    ? CMD_ITEMS.filter(c => c.label.toLowerCase().includes(q.toLowerCase()))
    : CMD_ITEMS;
  cmdSel = 0;
  const el = document.getElementById("cmd-results");
  if (!el) return;
  el.innerHTML = items.map((c,i) => `
    <div class="cmd-item${i===0?" selected":""}" data-idx="${i}" onclick="execCmd(${CMD_ITEMS.indexOf(c)})">
      ${escH(c.label)}
      ${c.key ? `<span class="cmd-item-key">${c.key}</span>` : ""}
    </div>`).join("");
}

function execCmd(idx) {
  closeCmd();
  CMD_ITEMS[idx]?.action();
}

// Event listeners for command palette (attached after DOM ready, but we can add them now)
document.addEventListener("DOMContentLoaded", () => {
  const cmdInput = document.getElementById("cmd-input");
  if (cmdInput) {
    cmdInput.addEventListener("input", e => renderCmdResults(e.target.value));
    cmdInput.addEventListener("keydown", e => {
      const items = document.querySelectorAll("#cmd-results .cmd-item");
      if (e.key === "ArrowDown") { e.preventDefault(); cmdSel = Math.min(cmdSel+1, items.length-1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); cmdSel = Math.max(cmdSel-1, 0); }
      else if (e.key === "Enter") { e.preventDefault(); const sel = items[cmdSel]; if (sel) sel.click(); }
      else if (e.key === "Escape") closeCmd();
      items.forEach((el,i) => el.classList.toggle("selected", i===cmdSel));
    });
  }
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openCmd(); }
    if (e.key === "Escape" && document.getElementById("cmd-palette")?.classList.contains("open")) closeCmd();
  });
});