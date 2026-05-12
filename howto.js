/* ── HOW-TO TREE RENDERER ── */
// Plain renderer — no custom code-wrap, no syntax highlight inside tree nodes
const plainRenderer = new marked.Renderer();
marked.setOptions({ renderer: plainRenderer, breaks: true, gfm: true });
const plainParse = t => {
  const r = new marked.Renderer();
  return marked.parse(t, { renderer: r, breaks: true, gfm: true });
};
// Restore full renderer after plain parse
marked.setOptions({ renderer, breaks: true, gfm: true });

let lastHowToText = "";      // raw AI text of last how-to response
let lastHowToBlock = null;   // the DOM element of the tree block

function renderHowToTree(text, targetBlock) {
  lastHowToText = text;

  // Split on numbered sections or markdown headers only
  const sections = text.split(/\n(?=\d+\.\s|\#{1,3}\s)/);
  if (sections.length < 2) return;

  const isUpdate = !!targetBlock;
  const treeBlock = targetBlock || document.createElement("div");
  treeBlock.className = "msg-block ai howto-tree-block";

  const totalPages = sections.length;
  let treeHtml = `
    <div class="msg-meta">
      <span class="mm-label">How-To Tree</span>
      <span class="mm-time">${tstamp()}</span>
    </div>
    <div class="msg-body" style="padding:10px">
      <div class="skill-selector">
        ${["beginner","intermediate","advanced","expert"].map(s =>
          `<button class="skill-btn${s===currentSkill?" active":""}" onclick="setSkill('${s}')">${s}</button>`
        ).join("")}
      </div>
      <div class="howto-tree">`;

  sections.slice(0, 12).forEach((sec, i) => {
    const lines = sec.split("\n").filter(Boolean);
    const rawHead = lines[0].replace(/^#+\s+|^\d+\.\s+/g, "").trim();
    // Strip leftover ** from bold markdown in headers
    const head = rawHead.replace(/\*\*/g, "");
    const body = lines.slice(1).join("\n");
    // Use plain marked parse so body renders as normal prose, not code
    const bodyHtml = body.trim()
      ? marked.parse(body, { renderer: new marked.Renderer(), breaks: true, gfm: true })
      : "<p style='color:var(--muted);font-size:0.78rem'>No details for this step.</p>";

    treeHtml += `
      <div class="ht-node">
        <div class="ht-node-header" onclick="toggleHtNode(this)">
          <span class="ht-arrow">▶</span>
          <span class="ht-label">${escH(head)}</span>
          <span class="ht-badge">${i + 1}</span>
        </div>
        <div class="ht-node-body">${bodyHtml}</div>
      </div>`;
  });

  treeHtml += `</div></div>`;
  treeBlock.innerHTML = treeHtml;

  if (!isUpdate) {
    chat.insertBefore(treeBlock, $("vscroll-bot"));
    lastHowToBlock = treeBlock;
  }
  scrollChat();
}

function toggleHtNode(header) {
  header.classList.toggle("open");
  header.nextElementSibling.classList.toggle("open");
}

function setSkill(s) {
  currentSkill = s;
  document.querySelectorAll(".skill-btn").forEach(b => b.classList.toggle("active", b.textContent === s));

  // If there's an existing tree block, re-prompt and replace it in-place
  if (!lastHowToBlock || !lastHowToText) return;
  if (isGenerating) return;

  // Find the last user message to re-run
  const lastUser = [...history].reverse().find(m => m.role === "user");
  if (!lastUser) return;

  // Remove the last assistant entry from history so we can replace it
  const lastAiIdx = history.map(m => m.role).lastIndexOf("assistant");
  if (lastAiIdx >= 0) history.splice(lastAiIdx, 1);

  // Clear tree block content — show loading state in-place
  lastHowToBlock.innerHTML = `
    <div class="msg-meta"><span class="mm-label">How-To Tree</span><span style="color:var(--muted);font-size:0.62rem;margin-left:8px">regenerating for ${s}…</span></div>
    <div class="msg-body" style="padding:10px;color:var(--muted);font-size:0.82rem">
      <div class="skill-selector">
        ${["beginner","intermediate","advanced","expert"].map(sk =>
          `<button class="skill-btn${sk===s?" active":""}" onclick="setSkill('${sk}')">${sk}</button>`
        ).join("")}
      </div>
      <div style="padding:20px 0;text-align:center">Generating ${s} guide…</div>
    </div>`;

  const targetBlock = lastHowToBlock;
  const newPrompt = buildHowToPrompt(lastUser.content.replace(/^You are generating.*?Task: /s, ""), s);

  doGenerateInto(newPrompt, [], targetBlock);
}

function toggleHtNode(header) {
  header.classList.toggle("open");
  if (header.nextElementSibling) header.nextElementSibling.classList.toggle("open");
}

function prevHowToVersion() {
  if (currentHowToVersion <= 0) return;
  currentHowToVersion--;
  rerenderHowToVersion();
}

function nextHowToVersion() {
  if (currentHowToVersion >= howToVersions.length - 1) return;
  currentHowToVersion++;
  rerenderHowToVersion();
}

function rerenderHowToVersion() {
  const latest = howToVersions[currentHowToVersion];
  if (!latest) return;
  document.querySelectorAll(".howto-tree-wrap").forEach(el => el.remove());
  renderHowToTree(latest);
}

async function setSkill(s) {
  currentSkill = s;
  document.querySelectorAll(".skill-btn").forEach(b => {
    b.classList.toggle("active", b.textContent.trim().toLowerCase() === s);
  });
  if (!lastHowToPrompt || isGenerating) return;
  await doGenerate(lastHowToPrompt, [], "howto");
}