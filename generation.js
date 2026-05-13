// ── PROMPT BUILDING AND GENERATION ──
function buildHowToPrompt(text, skill) {
  return `You are generating a structured How-To guide. Skill level: ${skill.toUpperCase()}.

Format your response as:
1. A brief overview (2-3 sentences)
2. Prerequisites (bullet list)
3. Step-by-step guide (numbered, with sub-steps where needed)
4. Common mistakes to avoid
5. Next steps / deeper exploration

Be procedural, precise, and include exact commands or tool names where relevant.
Do NOT invent commands or steps you are not certain about.

Task: ${text}`;
}

function buildResearchPrompt(text) {
  return `You are a research analyst performing deep research. Your output must:
- Clearly distinguish VERIFIED FACTS from INFERENCE or SPECULATION
- Flag any information that cannot be reliably verified with [UNCERTAIN]
- Identify contradictions or conflicting information
- Suggest 3-5 related topics for further research
- Cite your reasoning chain, not just conclusions

Research topic: ${text}`;
}

function injectAHM(text) {
  return `${text}

[Anti-hallucination instruction]: Only state facts you are highly confident about. For any uncertain claim, prefix with [UNCERTAIN]. For inferred information, prefix with [INFERRED]. Do not fabricate names, dates, statistics, or technical details. If you do not know something, say so explicitly.`;
}

/* ── GENERATE INTO EXISTING BLOCK (for in-place How-To skill switching) ── */
async function doGenerateInto(apiText, imgs, targetBlock) {
  isGenerating = true;

  // Always look up sendBtn from DOM — never rely on the module-level variable here
  const _sb = document.getElementById("send-btn");
  if (_sb) { _sb.textContent = "Stop"; _sb.className = "stop"; }

  setBusy();
  abortCtrl = new AbortController();
  if (typeof clearReasoning === "function") clearReasoning();

  const prov     = providers.find(p => p.id === activeProvider) || providers[0];
  const endpoint = prov.type === "ollama"
    ? `${prov.url}/api/chat`
    : `${prov.url}/chat/completions`;
  const headers  = { "Content-Type": "application/json" };
  if (prov.key) headers["Authorization"] = `Bearer ${prov.key}`;

  const messages = [{ role: "user", content: apiText }];
  const body     = prov.type === "ollama"
    ? { model: currentModel, messages, stream: streamOn }
    : { model: currentModel, messages, stream: streamOn, max_tokens: 2048 };

  let acc = "";
  try {
    const res = await fetch(endpoint, {
      method: "POST", headers,
      body: JSON.stringify(body),
      signal: abortCtrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (streamOn) {
      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = dec.decode(value, { stream: true }).split("\n").filter(l => l.trim());
        for (const line of lines) {
          try {
            const raw = line.startsWith("data: ") ? line.slice(6) : line;
            if (raw === "[DONE]") break;
            const j   = JSON.parse(raw);
            const tok = j.message?.content || j.response || j.choices?.[0]?.delta?.content || "";
            if (tok) acc += tok;
          } catch {}
        }
      }
    } else {
      const j = await res.json();
      acc = j.message?.content || j.choices?.[0]?.message?.content || "";
    }

    history.push({ role: "assistant", content: acc });
    renderHowToTree(acc, targetBlock);
    if (typeof saveSession === "function") saveSession();

  } catch (e) {
    if (e.name !== "AbortError") {
      targetBlock.innerHTML += `<div style="color:var(--err);padding:8px;font-size:0.8rem">Error: ${e.message}</div>`;
    }
  } finally {
    isGenerating = false;
    const _sb2 = document.getElementById("send-btn");
    if (_sb2) { _sb2.textContent = "Send"; _sb2.className = ""; }
    restSt();
  }
}

/* ── MAIN GENERATE ── */
async function doGenerate(apiText, imgs, mode) {
  isGenerating = true;
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) { sendBtn.textContent = "Stop"; sendBtn.className = "stop"; }
  setBusy();
  abortCtrl = new AbortController();

  const prov = providers.find(p => p.id === activeProvider) || providers[0];

  // AI bubble
  const aiBlock = document.createElement("div");
  aiBlock.className = "msg-block ai";
  aiBlock.innerHTML = `
    <div class="msg-meta">
      <span class="mm-label">Nexus</span>
      <span class="mm-model">${escH(currentModel)}</span>
      <span id="s-stats" class="mm-stats"></span>
      <span class="mm-time">${tstamp()}</span>
      <div class="msg-actions">
        <button class="ma-btn" onclick="navHistory(this,-1)" title="Previous response">←</button>
        <button class="ma-btn" onclick="navHistory(this,+1)" title="Next response">→</button>
        <button class="ma-btn" onclick="copyMsg(this)">Copy</button>
        <button class="ma-btn" onclick="regenMsg(this)">Regen</button>
      </div>
    </div>
    <div class="msg-body scursor" id="ai-live"></div>`;

  const chatContainer = document.getElementById("chat");
  const bot           = document.getElementById("vscroll-bot");
  if (chatContainer && bot) chatContainer.insertBefore(aiBlock, bot);

  const liveEl  = aiBlock.querySelector("#ai-live");
  const statsEl = aiBlock.querySelector("#s-stats");
  scrollChat();

  let acc = "", tStart = Date.now(), tokCount = 0;

  try {
    const messages = [];
    if (sysPrompt) messages.push({ role: "system", content: sysPrompt });

    // Sliding window — last 20 turns
    const window20 = history.slice(-20);
    window20.forEach(m => {
      if (m.role === "user" && m === history[history.length - 1]) {
        messages.push({ role: "user", content: apiText });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    });

    if (imgs.length > 0 && prov.type === "ollama") {
      messages[messages.length - 1].images = imgs.map(i => i.base64);
    }

    const endpoint = prov.type === "ollama"
      ? `${prov.url}/api/chat`
      : `${prov.url}/chat/completions`;

    const headers = { "Content-Type": "application/json" };
    if (prov.key) headers["Authorization"] = `Bearer ${prov.key}`;
    if (prov.id.includes("openrouter")) {
      headers["HTTP-Referer"] = window.location.href;
      headers["X-Title"]     = "Nexus v3";
    }

    const body = prov.type === "ollama"
      ? { model: currentModel, messages, stream: streamOn }
      : { model: currentModel, messages, stream: streamOn, max_tokens: 2048 };

    const res = await fetch(endpoint, {
      method: "POST", headers,
      body: JSON.stringify(body),
      signal: abortCtrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    if (streamOn) {
      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = dec.decode(value, { stream: true }).split("\n").filter(l => l.trim());
        for (const line of lines) {
          try {
            const raw = line.startsWith("data: ") ? line.slice(6) : line;
            if (raw === "[DONE]") break;
            const j = JSON.parse(raw);

            // Capture reasoning tokens (thinking models)
            const thinking = j.message?.thinking || j.thinking || "";
            if (thinking && typeof appendReasoning === "function") appendReasoning(thinking);

            const tok = j.message?.content || j.response || j.choices?.[0]?.delta?.content || "";
            if (tok) {
              acc += tok; tokCount++;
              if (liveEl) liveEl.innerHTML = tryJson(acc.trim()) || marked.parse(acc);
              scrollChat();
              if (tokCount % 10 === 0 && statsEl) {
                const elapsed = (Date.now() - tStart) / 1000;
                statsEl.textContent = `· ${(tokCount / elapsed).toFixed(1)} tok/s`;
              }
            }

            const isDone = j.done || j.choices?.[0]?.finish_reason === "stop";
            if (isDone) {
              const ec = j.eval_count    || j.usage?.completion_tokens;
              const pc = j.prompt_eval_count || j.usage?.prompt_tokens;
              if (ec) {
                totalTokens += ec + (pc || 0);
                updateTokChip();
                if (statsEl) statsEl.textContent = `· ${ec} tok · ${(ec / ((Date.now() - tStart) / 1000)).toFixed(1)} tok/s`;
              }
            }
          } catch {}
        }
      }
    } else {
      const j = await res.json();
      acc = j.message?.content || j.choices?.[0]?.message?.content || "";
    }

    if (liveEl) {
      liveEl.classList.remove("scursor");
      liveEl.innerHTML = tryJson(acc.trim()) || marked.parse(acc);
    }

    if (mode === "howto" && typeof renderHowToTree === "function") renderHowToTree(acc);

    history.push({ role: "assistant", content: acc });
    if (typeof saveSession === "function") saveSession();
    pruneOldMessages();

  } catch (e) {
    if (liveEl) liveEl.classList.remove("scursor");
    if (e.name === "AbortError") {
      if (liveEl) liveEl.innerHTML += `<br><span style="color:var(--muted);font-size:0.78rem">— stopped —</span>`;
      if (acc) history.push({ role: "assistant", content: acc });
    } else {
      aiBlock.remove();
      appendError(
        `Could not reach server at ${providers.find(p => p.id === activeProvider)?.url || "?"}\n\n` +
        `Error: ${e.message}\n\nCheck:\n• Server is running\n• OLLAMA_ORIGINS includes this domain\n• URL in Settings is correct`
      );
    }
  } finally {
    isGenerating = false;
    const _sb = document.getElementById("send-btn");
    if (_sb) { _sb.textContent = "Send"; _sb.className = ""; }
    if (liveEl) liveEl.id = "";
    restSt();
    scrollChat();
    updateTokEst();
  }
}