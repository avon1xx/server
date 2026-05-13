// ── ATTACHMENTS, TOKEN ESTIMATION, STRIP MANAGEMENT ──
let strip; // initialized in events.js DOMContentLoaded

function addChip(id, label, onremove, prefix="") {
  let chip = document.getElementById(`chip-${id}`);
  if (!chip) {
    chip=document.createElement("div");
    chip.id=`chip-${id}`;
    chip.className="a-chip";
    if (strip) strip.appendChild(chip);
  }
  chip.innerHTML = `${prefix}${label}<button class="a-chip-x" onclick="${onremove}()">✕</button>`;
  if (strip) strip.classList.add("has");
}
function removeChip(id) {
  const chip = document.getElementById(`chip-${id}`);
  if (chip) chip.remove();
  if (strip && !strip.children.length) strip.classList.remove("has");
}

function updateTokEst() {
  const txt   = textarea ? textarea.value.length : 0;
  const files = pendingFiles.filter(Boolean).reduce((a,f)=>a+f.text.length,0);
  const imgs  = pendingImages.filter(Boolean).length * 512;
  const sys   = sysPrompt.length;
  const hist  = history.reduce((a,m)=>a+(m.content?.length||0),0);
  const est   = Math.round((txt+files+sys+hist)/4)+imgs+totalTokens;
  const tokEst = document.getElementById("tok-est");
  if (tokEst) {
    tokEst.textContent = est > 20 ? `~${est} tok` : "";
    tokEst.className   = est > ctxLimit*0.8 ? "warn" : "";
  }
}

function updateTokChip() {
  const chip = document.getElementById("tok-chip");
  if (chip) {
    chip.textContent = `${totalTokens} tok`;
    chip.className   = "token-chip"+(totalTokens > ctxLimit*0.8?" warn":"");
  }
}

async function handleImages(input) {
  if (!isVision(currentModel)) {
    if (typeof appendSystem === "function") appendSystem("Vision not available for this model. Switch to a vision-capable model.");
    input.value = ""; return;
  }
  const files = [...input.files];
  for (const file of files) {
    await processImage(file);
  }
  input.value = "";
  updateTokEst();
}

function processImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      let [w, h] = [img.width, img.height];
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX/w, MAX/h);
        w = Math.round(w*r); h = Math.round(h*r);
      }
      const c = document.createElement("canvas");
      c.width=w; c.height=h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      const dataUrl = c.toDataURL("image/jpeg", 0.85);
      const base64  = dataUrl.split(",")[1];
      pendingImages.push({ base64, name:file.name, dataUrl });
      addChip("img-"+pendingImages.length, `📷 ${file.name}`, `removeImg(${pendingImages.length-1})`,
        `<img class="a-img-prev" src="${dataUrl}"/>`);
      URL.revokeObjectURL(img.src);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = URL.createObjectURL(file);
  });
}

function removeImg(i) {
  pendingImages[i] = null;
  removeChip("img-"+( i +1));
  updateTokEst();
}

async function handleCodeFiles(input) {
  const files = [...input.files];
  for (const file of files) {
    await readAttachFile(file);
  }
  input.value = "";
  updateTokEst();
}

function readAttachFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const lang = file.name.split(".").pop().toLowerCase();
      attachCodeBlock(e.target.result, lang, file.name);
      resolve();
    };
    reader.onerror = () => resolve();
    reader.readAsText(file);
  });
}

function attachCodeBlock(text, lang, name) {
  const meta = extractCodeMeta(text, lang);
  const idx  = pendingFiles.length;
  pendingFiles.push({ text, name, lang, lines:text.split("\n").length, meta });
  addChip(`code-${idx}`, `📎 ${name} (${pendingFiles[idx].lines}L${lang&&lang!=="txt"?` · ${lang}`:""})`,
    `removeFile(${idx})`);
  updateTokEst();
}

function removeFile(i) {
  pendingFiles[i] = null;
  removeChip(`code-${i}`);
  updateTokEst();
}

// Paste detection for large text
if (textarea) {
  textarea.addEventListener("paste", e => {
    const txt = e.clipboardData.getData("text");
    if (txt.split("\n").length >= CODE_PASTE_LINES || txt.length >= CODE_PASTE_CHARS) {
      e.preventDefault();
      attachCodeBlock(txt, detectLang(txt), "pasted-code");
    }
  });
}