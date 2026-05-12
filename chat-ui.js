// ── CHAT UI HELPER FUNCTIONS ──
function appendSystem(text) {
  const chatContainer = document.getElementById("chat");
  if (!chatContainer) return;
  const b=document.createElement("div");b.className="msg-block system-msg";
  b.innerHTML=`<div class="msg-meta"><span class="mm-label">System</span><span class="mm-time">${tstamp()}</span></div>
    <div class="msg-body">${escH(text)}</div>`;
  const bot = document.getElementById("vscroll-bot");
  chatContainer.insertBefore(b, bot);
  scrollChat();
}

function appendError(text) {
  const chatContainer = document.getElementById("chat");
  if (!chatContainer) return;
  const b=document.createElement("div");b.className="msg-block error";
  b.innerHTML=`<div class="msg-meta"><span class="mm-label">Error</span><span class="mm-time">${tstamp()}</span></div>
    <div class="msg-body">${escH(text)}</div>`;
  const bot = document.getElementById("vscroll-bot");
  chatContainer.insertBefore(b, bot);
  scrollChat();
}

function buildUserHtml(text, imgs, files) {
  let html = text ? `<div>${escH(text)}</div>` : "";
  imgs.filter(Boolean).forEach(img =>
    html += `<div class="msg-img"><img src="${img.dataUrl}" alt="${escH(img.name)}"/></div>`
  );
  files.filter(Boolean).forEach(f => {
    const uid="ca-"+Date.now()+Math.random();
    html += `<div class="code-attach">
      <div class="code-attach-bar">
        <span class="ca-name">${escH(f.name)}</span>
        <span class="ca-meta">${f.lines}L${f.lang&&f.lang!=="txt"?` · ${f.lang}`:""}</span>
        ${f.meta?`<span class="ca-meta"> · ${escH(f.meta)}</span>`:""}
        <button class="ca-btn" onclick="this.nextElementSibling.classList.toggle('open');this.textContent=this.nextElementSibling.classList.contains('open')?'collapse':'expand'">expand</button>
      </div>
      <div class="code-attach-body"><pre>${escH(f.text)}</pre></div>
    </div>`;
  });
  return html;
}

function scrollChat() {
  const chatContainer = document.getElementById("chat");
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Virtual scroll pruning
const VIRT_WINDOW = 60;
let allMessages = [];

function pruneOldMessages() {
  const chatContainer = document.getElementById("chat");
  if (!chatContainer) return;
  const msgs = chatContainer.querySelectorAll(".msg-block:not(.system-msg)");
  if (msgs.length > VIRT_WINDOW) {
    const toRemove = msgs.length - VIRT_WINDOW;
    for (let i=0;i<toRemove;i++) {
      allMessages.push(msgs[i].outerHTML);
      msgs[i].remove();
    }
    if (!document.getElementById("load-older-btn")) {
      const btn=document.createElement("button");
      btn.id="load-older-btn";
      btn.style.cssText="display:block;margin:8px auto;background:transparent;border:1px dashed var(--border2);color:var(--muted);font-size:0.68rem;padding:5px 14px;border-radius:3px;cursor:pointer;";
      btn.textContent=`↑ Show ${allMessages.length} older messages`;
      btn.onclick=loadOlderMessages;
      const first = chatContainer.querySelector(".msg-block");
      chatContainer.insertBefore(btn, first);
    } else {
      const btn = document.getElementById("load-older-btn");
      if (btn) btn.textContent=`↑ Show ${allMessages.length} older messages`;
    }
  }
}

function loadOlderMessages() {
  const btn=document.getElementById("load-older-btn");
  if (btn) btn.remove();
  const frag=document.createDocumentFragment();
  allMessages.forEach(html => {
    const div=document.createElement("div");div.innerHTML=html;
    frag.appendChild(div.firstChild);
  });
  allMessages=[];
  const chatContainer = document.getElementById("chat");
  const first = chatContainer ? chatContainer.querySelector(".msg-block") : null;
  if (first) chatContainer.insertBefore(frag, first);
}

function copyMsg(btn) {
  const text=btn.closest(".msg-block").querySelector(".msg-body").innerText;
  navigator.clipboard.writeText(text).catch(()=>{});
  btn.textContent="Copied!";
  setTimeout(()=>btn.textContent="Copy",2000);
}

function regenMsg(btn) {
  if (isGenerating) return;
  const block = btn.closest(".msg-block.ai");
  const lastUser = [...history].reverse().find(m => m.role === "user");
  if (!lastUser) return;
  const lastAiIdx = history.map(m => m.role).lastIndexOf("assistant");
  if (lastAiIdx >= 0) history.splice(lastAiIdx, 1);

  // Bootstrap history array on this block if not done yet
  if (!block._responses) {
    block._responses = [block.querySelector(".msg-body").innerHTML];
    block._rIdx = 0;
  }

  // Run a new generation, push result into block._responses
  doGenerateRegen(lastUser.content, [], currentMode, block);
}

async function doGenerateRegen(apiText, imgs, mode, targetBlock) {
  isGenerating = true;
  sendBtn.textContent = "Stop"; sendBtn.className = "stop";
  setBusy();
  abortCtrl = new AbortController();

  const prov = providers.find(p => p.id === activeProvider) || providers[0];
  const endpoint = prov.type === "ollama" ? `${prov.url}/api/chat` : `${prov.url}/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (prov.key) headers["Authorization"] = `Bearer ${prov.key}`;

  const messages = [];
  if (sysPrompt) messages.push({ role: "system", content: sysPrompt });
  messages.push({ role: "user", content: apiText });
  const body = prov.type === "ollama"
    ? { model: currentModel, messages, stream: streamOn }
    : { model: currentModel, messages, stream: streamOn, max_tokens: 2048 };

  const liveEl = targetBlock.querySelector(".msg-body");
  liveEl.classList.add("scursor");
  liveEl.innerHTML = "";

  let acc = "";
  try {
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: abortCtrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (streamOn) {
      const reader = res.body.getReader(), dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = dec.decode(value, { stream: true }).split("\n").filter(l => l.trim());
        for (const line of lines) {
          try {
            const raw = line.startsWith("data: ") ? line.slice(6) : line;
            if (raw === "[DONE]") break;
            const j = JSON.parse(raw);
            const tok = j.message?.content || j.response || j.choices?.[0]?.delta?.content || "";
            if (tok) { acc += tok; liveEl.innerHTML = tryJson(acc.trim()) || marked.parse(acc); scrollChat(); }
          } catch {}
        }
      }
    } else {
      const j = await res.json();
      acc = j.message?.content || j.choices?.[0]?.message?.content || "";
    }
    liveEl.classList.remove("scursor");
    const finalHtml = tryJson(acc.trim()) || marked.parse(acc);
    liveEl.innerHTML = finalHtml;
    // Push into history array
    targetBlock._responses.push(finalHtml);
    targetBlock._rIdx = targetBlock._responses.length - 1;
    // Update arrow opacity
    const arrowBtns = targetBlock.querySelectorAll(".ma-btn");
    arrowBtns[0].style.opacity = "1";
    arrowBtns[1].style.opacity = "0.3";
    history.push({ role: "assistant", content: acc });
    saveSession();
  } catch (e) {
    liveEl.classList.remove("scursor");
    if (e.name !== "AbortError") liveEl.innerHTML = `<span style="color:var(--err)">Error: ${e.message}</span>`;
  } finally {
    isGenerating = false; sendBtn.textContent = "Send"; sendBtn.className = "";
    restSt(); updateTokEst();
  }
}

/* ── RESPONSE HISTORY NAV (← →) ── */
// Each AI block stores an array of past responses for that turn
function navHistory(btn, dir) {
  const block = btn.closest(".msg-block.ai");
  if (!block) return;
  const body = block.querySelector(".msg-body");
  if (!block._responses) {
    // Bootstrap with current content
    block._responses = [body.innerHTML];
    block._rIdx = 0;
  }
  const newIdx = block._rIdx + dir;
  if (newIdx < 0 || newIdx >= block._responses.length) return;
  block._rIdx = newIdx;
  body.innerHTML = block._responses[newIdx];
  // Update arrow states
  const btns = block.querySelectorAll(".ma-btn");
  btns[0].style.opacity = newIdx === 0 ? "0.3" : "1";
  btns[1].style.opacity = newIdx === block._responses.length - 1 ? "0.3" : "1";
}