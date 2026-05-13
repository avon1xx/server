// ── EVENT BINDING AND INITIALIZATION ──
document.addEventListener("DOMContentLoaded", () => {
  // Assign DOM globals
  chatEl = document.getElementById("chat");
  textarea = document.getElementById("prompt-input");
  if (textarea) {
  textarea.addEventListener("paste", e => {
    const txt = e.clipboardData.getData("text");
    if (txt.split("\n").length >= CODE_PASTE_LINES || txt.length >= CODE_PASTE_CHARS) {
      e.preventDefault();
      attachCodeBlock(txt, detectLang(txt), "pasted-code");
    }
  });
}
  sendBtn = document.getElementById("send-btn");
  modelSel = document.getElementById("model-sel");
  sdot = document.getElementById("sdot");
  statusTxt = document.getElementById("status-txt");
  strip = document.getElementById("attach-strip");


  // Ensure functions are globally accessible for inline handlers
  window.closeModal = closeModal;
  window.openModal = openModal;
  window.saveSettings = saveSettings;
  window.addProvider = addProvider;
  window.applyPersona = applyPersona;
  window.addSource = addSource;
  window.handleImportDrop = handleImportDrop;
  window.handleImportFile = handleImportFile;
  window.toggleSidebar = toggleSidebar;
  window.closeSidebar = closeSidebar;
  window.cycleTheme = cycleTheme;
  window.toggleNotebook = toggleNotebook;
  window.toggleTemplates = toggleTemplates;
  window.setMode = setMode;
  window.newChat = newChat;
  window.exportChat = exportChat;
  window.onModelChange = onModelChange;
  window.handleImages = handleImages;
  window.handleCodeFiles = handleCodeFiles;
  window.handleNbFiles = handleNbFiles;
  window.searchNotebook = searchNotebook;
  window.toggleMic = toggleMic;
  window.copyMsg = copyMsg;
  window.regenMsg = regenMsg;
  window.copyCode = copyCode;
  window.dlCode = dlCode;
  window.toggleJson = toggleJson;
  window.removeImg = removeImg;
  window.removeFile = removeFile;
  window.toggleHtNode = toggleHtNode;
  window.setSkill = setSkill;
  window.prevHowToVersion = prevHowToVersion;
  window.nextHowToVersion = nextHowToVersion;

  /* ── DRAG & DROP TO UPLOAD ── */
// Covers: local files dragged in, AND images dragged from other websites
const dropZone = document.getElementById("chat");

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", e => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", async e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");

  const items = [...(e.dataTransfer.items || [])];
  const files = [...(e.dataTransfer.files || [])];

  // Handle items (supports dragged images from web pages)
  for (const item of items) {
    if (item.kind === "string" && item.type === "text/uri-list") {
      item.getAsString(async url => {
        // Image URL dragged from another website
        if (/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(url)) {
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            const file = new File([blob], url.split("/").pop() || "dropped-image.png", { type: blob.type });
            await processImage(file);
            appendSystem(`Loaded image from URL: ${url.slice(0,60)}`);
          } catch { appendSystem(`Could not load image from URL: ${url.slice(0,60)}`); }
        }
      });
      continue;
    }
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (!file) continue;
      if (file.type.startsWith("image/")) {
        await processImage(file);
      } else {
        await readAttachFile(file);
      }
    }
  }

  // Fallback for browsers that only expose files
  if (!items.length) {
    for (const file of files) {
      if (file.type.startsWith("image/")) await processImage(file);
      else await readAttachFile(file);
    }
  }

  updateTokEst();
});

  window.addEventListener("error", e => {
    console.error("Nexus caught error:", e.message);
    if (isGenerating) {
      isGenerating = false;
      const sendBtn = document.getElementById("send-btn");
      if (sendBtn) {
        sendBtn.textContent = "Send";
        sendBtn.className = "";
      }
      if (typeof restSt === "function") restSt();
      appendError("Render error occurred. Previous message may be incomplete. Error: " + e.message);
    }
  });

  window.addEventListener("unhandledrejection", e => {
    console.error("Nexus caught rejection:", e.reason);
    if (isGenerating) {
      isGenerating = false;
      const sendBtn = document.getElementById("send-btn");
      if (sendBtn) {
        sendBtn.textContent = "Send";
        sendBtn.className = "";
      }
      if (typeof restSt === "function") restSt();
      appendError("Unhandled rejection: " + (e.reason?.message || e.reason));
    }
  });

  // Sidebar toggle for mobile
  const sbToggle = document.getElementById("sb-toggle");
  if (sbToggle) sbToggle.addEventListener("click", toggleSidebar);

  // Template rendering
  renderTemplates();
  function renderTemplates() {
    const bar = document.getElementById("tpl-bar");
    if (!bar) return;
    bar.innerHTML = TEMPLATES.map(t =>
      `<button class="tpl-chip" onclick="insertTemplate(${JSON.stringify(t.text)})">${escH(t.label)}</button>`
    ).join("");
  }
  window.insertTemplate = (txt) => {
    if (textarea) {
      textarea.value = txt;
      textarea.focus();
      textarea.dispatchEvent(new Event("input"));
      textarea.style.borderColor = "var(--c1)";
      setTimeout(() => { textarea.style.borderColor = ""; }, 600);
      autoResize();
    }
  };
  function autoResize() {
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  
  }

  // Send button / Enter
  if (sendBtn) sendBtn.addEventListener("click", () => {
    if (isGenerating) abortCtrl?.abort();
    else handleSend();
  });
  if (textarea) {
    textarea.addEventListener("keydown", e => {
      if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); handleSend(); }
    });
  }

  // Make handleSend globally available for voice etc.
  window.handleSend = handleSend;
  async function handleSend() {
    if (isGenerating) return;
    const raw = textarea ? textarea.value.trim() : "";
    const imgs  = pendingImages.filter(Boolean);
    const files = pendingFiles.filter(Boolean);
    if (!raw && !imgs.length && !files.length) return;
    if (!currentModel) { appendSystem("No model selected. Is the server running?"); return; }

    const imgSnap  = [...imgs];
    const fileSnap = [...files];
    if (textarea) {
      textarea.value="";
      textarea.style.height="46px";
    }
    pendingImages=[];
    pendingFiles=[];
    if (strip) { strip.innerHTML=""; strip.classList.remove("has"); }

    let apiText = raw;
    fileSnap.forEach(f => {
      apiText += `\n\n--- File: ${f.name}${f.lang&&f.lang!=="txt"?` (${f.lang})`:""} ---\n${f.text}\n--- end ---`;
    });

    const userBlock=document.createElement("div");
    userBlock.className="msg-block user";
    userBlock.innerHTML=`<div class="msg-meta"><span class="mm-label">You</span><span class="mm-time">${tstamp()}</span></div>
      <div class="msg-body">${buildUserHtml(raw,imgSnap,fileSnap)}</div>`;
    const chatContainer = document.getElementById("chat");
    const bot = document.getElementById("vscroll-bot");
    if (chatContainer) chatContainer.insertBefore(userBlock, bot);
    scrollChat();

    history.push({role:"user",content:apiText});

    let finalApiText = apiText;
    if (currentMode==="howto") finalApiText = buildHowToPrompt(apiText, currentSkill);
    else if (currentMode==="research") finalApiText = buildResearchPrompt(apiText);
    if (ahmOn) finalApiText = injectAHM(finalApiText);

    const enabledSrcs = sources.filter(s=>s.enabled);
    if (enabledSrcs.length > 0) {
      appendSystem(`Fetching ${enabledSrcs.length} source(s)…`);
      const ctxParts = await Promise.all(enabledSrcs.map(fetchSourceContent));
      const srcCtx = ctxParts.filter(Boolean).join("\n\n---\n\n");
      if (srcCtx) finalApiText = `[Fetched source context]:\n${srcCtx}\n\n[User query]:\n${finalApiText}`;
    }

    await doGenerate(finalApiText, imgSnap, currentMode);
  }

  // Set mode function
  window.setMode = function(m) {
    currentMode = m;
    ["chat","howto","research"].forEach(id => {
      const tab = document.getElementById(`tab-${id}`);
      if (tab) tab.classList.toggle("active", id===m);
    });
    const hints = { chat:"Type a prompt…", howto:"Enter a skill or task for a step-by-step guide…", research:"Enter a research topic…" };
    if (textarea) textarea.placeholder = hints[m] + " (Enter to send, Shift+Enter for newline, ⌘K for commands)";
  };

  window.toggleTemplates = function() {
    const bar = document.getElementById("tpl-bar");
    const btn = document.getElementById("tpl-btn");
    if (bar) bar.classList.toggle("show");
    if (btn) btn.classList.toggle("active");
  };

/* ── MINIMAL MODE ── */
let minimalOn = LS.get("nx3_minimal") || false;

function toggleMinimal() {
  minimalOn = !minimalOn;
  LS.set("nx3_minimal", minimalOn);
  applyMinimal();
}

function applyMinimal() {
  document.body.classList.toggle("minimal", minimalOn);
  $("minimal-btn").classList.toggle("active", minimalOn);
}

/* ── REASONING PANEL ── */
let reasoningOpen = false;

function toggleReasoning() {
  reasoningOpen = !reasoningOpen;
  const panel = $("reasoning-panel");
  const btn   = $("reason-btn");
  panel.style.width = reasoningOpen ? "260px" : "0";
  btn.classList.toggle("active", reasoningOpen);
}

function appendReasoning(text) {
  const el = $("reasoning-content");
  if (!el) return;
  el.textContent += text;
  el.scrollTop = el.scrollHeight;
}

function clearReasoning() {
  const el = $("reasoning-content");
  if (el) el.textContent = "";
}

  // Initialize everything
  initTheme();
  applyMinimal();
  initPerf();
  renderHistory();
  renderNbDocs();
  checkServer();
  setInterval(checkServer, 15000);
});