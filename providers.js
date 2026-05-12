// ── PROVIDERS AND MODELS ──
async function checkServer() {
  if (isGenerating) return;
  const prov = providers.find(p=>p.id===activeProvider) || providers[0];
  try {
    let url, headers = {};
    if (prov.type === "ollama") url = `${prov.url}/api/tags`;
    else { url = `${prov.url}/models`; if (prov.key) headers["Authorization"] = `Bearer ${prov.key}`; }
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000), headers });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (lastServerOk !== true) { lastServerOk = true; setSt("online","connected"); }
    const models = prov.type === "ollama"
      ? (data.models||[]).map(m=>m.name)
      : (data.data||[]).map(m=>m.id);
    populateModels(models);
  } catch {
    if (lastServerOk !== false) { lastServerOk = false; setSt("offline","server offline"); }
  }
}

function setSt(dot,txt) {
  const sdotEl = document.getElementById("sdot");
  const statusEl = document.getElementById("status-txt");
  if (sdotEl) sdotEl.className = "sdot "+dot;
  if (statusEl) statusEl.textContent = txt;
}
function setBusy() {
  const sdotEl = document.getElementById("sdot");
  if (sdotEl) sdotEl.className = "sdot busy";
  const statusEl = document.getElementById("status-txt");
  if (statusEl) statusEl.textContent = "generating…";
}
function restSt() {
  setSt(lastServerOk?"online":"offline", lastServerOk?"connected":"server offline");
}

function populateModels(list) {
  const modelSel = document.getElementById("model-sel");
  if (!modelSel) return;
  const prev = modelSel.value || currentModel;
  modelSel.innerHTML = "";
  if (!list.length) { modelSel.innerHTML='<option value="">No models</option>'; return; }
  list.forEach(n => {
    const o = document.createElement("option");
    o.value=n; o.textContent=n; modelSel.appendChild(o);
  });
  if (prev && [...modelSel.options].some(o=>o.value===prev)) modelSel.value = prev;
  currentModel = modelSel.value;
  LS.set("nx3_model", currentModel);
  updateModelUi();
}

function isVision(n) { const l=(n||"").toLowerCase(); return VISION_PATTERNS.some(p=>l.includes(p)); }

function updateModelUi() {
  const modelSel = document.getElementById("model-sel");
  if (modelSel) currentModel = modelSel.value;
  const vis = isVision(currentModel);
  const modelHint = document.getElementById("model-hint");
  if (modelHint) modelHint.textContent = currentModel || "no model";
  const visChip = document.getElementById("vision-chip");
  if (visChip) visChip.className = "vision-chip"+(vis?" show":"");
  const imgTool = document.getElementById("img-tool-btn");
  if (imgTool) imgTool.classList.toggle("disabled", !vis);

  const prov = providers.find(p=>p.id===activeProvider);
  const pt = document.getElementById("provider-tag");
  if (pt) {
    pt.className = "provider-tag provider-"+(prov?.type==="openai"
      ? (prov.id.includes("groq")?"groq":"openrouter") : "ollama");
    pt.textContent = (prov?.name||"Ollama").split(" ")[0].toUpperCase();
  }
  updateTokEst();
}

function onModelChange() {
  const modelSel = document.getElementById("model-sel");
  if (modelSel) LS.set("nx3_model", modelSel.value);
  updateModelUi();
}