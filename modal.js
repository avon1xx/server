// ── MODAL FUNCTIONS ──
function openModal(id) {
  if (id === "settings-modal") loadSettingsModal();
  if (id === "sources-modal")  renderSourcesList();
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("open");
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("open");
}
document.querySelectorAll(".modal-overlay").forEach(m =>
  m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); })
);

function loadSettingsModal() {
  renderProviders();
  refreshProviderSel();
  const sysInput = document.getElementById("sys-prompt-input");
  if (sysInput) sysInput.value = sysPrompt;
  const ctxInput = document.getElementById("ctx-input");
  if (ctxInput) ctxInput.value = ctxLimit;
  const streamSel = document.getElementById("stream-toggle");
  if (streamSel) streamSel.value = streamOn ? "true" : "false";
  const ahmSel = document.getElementById("ahm-toggle");
  if (ahmSel) ahmSel.value = ahmOn ? "true" : "false";
  const perfSel = document.getElementById("perf-toggle");
  if (perfSel) perfSel.value = perfMode;
  const proxyInput = document.getElementById("proxy-input");
  if (proxyInput) proxyInput.value = corsProxy;
}

function renderProviders() {
  const list = document.getElementById("providers-list");
  if (!list) return;
  list.innerHTML = providers.map((p,i) => `
    <div style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
      <input class="field-input" value="${escH(p.name)}" placeholder="Name" oninput="providers[${i}].name=this.value" style="width:120px;flex-shrink:0"/>
      <input class="field-input" value="${escH(p.url)}" placeholder="URL" oninput="providers[${i}].url=this.value" style="flex:1"/>
      <input class="field-input" value="${escH(p.key)}" placeholder="API key" type="password" oninput="providers[${i}].key=this.value" style="width:110px;flex-shrink:0"/>
      <button class="btn btn-danger" style="padding:6px 8px" onclick="providers.splice(${i},1);renderProviders()" ${providers.length===1?"disabled":""}>✕</button>
    </div>`).join("");
}

function refreshProviderSel() {
  const sel = document.getElementById("active-provider-sel");
  if (!sel) return;
  sel.innerHTML = providers.map(p =>
    `<option value="${p.id}"${p.id===activeProvider?" selected":""}>${escH(p.name)}</option>`
  ).join("");
}

function addProvider() {
  providers.push({ id:"custom-"+Date.now(), name:"Custom", url:"http://localhost:11434", type:"ollama", key:"" });
  renderProviders(); refreshProviderSel();
}

function applyPersona() {
  const sel = document.getElementById("persona-sel");
  const v = sel ? sel.value : "";
  const sysInput = document.getElementById("sys-prompt-input");
  if (v && sysInput) sysInput.value = v;
}

function saveSettings() {
  const sysInput = document.getElementById("sys-prompt-input");
  if (sysInput) sysPrompt = sysInput.value?.trim() || sysPrompt;
  const ctxInput = document.getElementById("ctx-input");
  if (ctxInput) ctxLimit = parseInt(ctxInput.value) || ctxLimit;
  const streamSel = document.getElementById("stream-toggle");
  if (streamSel) streamOn = streamSel.value === "true";
  const ahmSel = document.getElementById("ahm-toggle");
  if (ahmSel) ahmOn = ahmSel.value === "true";
  const perfSel = document.getElementById("perf-toggle");
  if (perfSel) perfMode = perfSel.value || perfMode;
  const proxyInput = document.getElementById("proxy-input");
  if (proxyInput) corsProxy = proxyInput.value?.trim() || corsProxy;
  const activeSel = document.getElementById("active-provider-sel");
  if (activeSel) activeProvider = activeSel.value || activeProvider;
  LS.set("nx3_providers",  providers);
  LS.set("nx3_activeprov", activeProvider);
  LS.set("nx3_sysprompt",  sysPrompt);
  LS.set("nx3_ctx",        ctxLimit);
  LS.set("nx3_stream",     streamOn);
  LS.set("nx3_ahm",        ahmOn);
  LS.set("nx3_perf",       perfMode);
  LS.set("nx3_proxy",      corsProxy);
  LS.set("nx3_sources",    sources);
  if (perfMode==="lite") applyLite();
  else document.documentElement.removeAttribute("data-perf");
  closeModal("settings-modal");
  closeModal("sources-modal");
  lastServerOk = null;
  if (typeof checkServer === "function") checkServer();
}