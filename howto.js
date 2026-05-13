/* ── HOW-TO TREE RENDERER ── */
 
let lastHowToText  = "";    // raw AI text of last how-to response
let lastHowToBlock = null;  // the DOM element of the tree block
 
function renderHowToTree(text, targetBlock) {
  lastHowToText = text;
 
  // Split on numbered sections or markdown headers only
  const sections = text.split(/\n(?=\d+\.\s|\#{1,3}\s)/);
  if (sections.length < 2) return;
 
  const isUpdate = !!targetBlock;
  const treeBlock = targetBlock || document.createElement("div");
  treeBlock.className = "msg-block ai howto-tree-block";
 
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
    const lines   = sec.split("\n").filter(Boolean);
    const rawHead = lines[0].replace(/^#+\s+|^\d+\.\s+/g, "").trim();
    const head    = rawHead.replace(/\*\*/g, "");
    const body    = lines.slice(1).join("\n");
 
    // Use a plain renderer so body is normal prose — NOT syntax-highlighted code
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
    const chatContainer = document.getElementById("chat");
    const bot = document.getElementById("vscroll-bot");
    if (chatContainer && bot) chatContainer.insertBefore(treeBlock, bot);
    lastHowToBlock = treeBlock;
  }
  scrollChat();
}
 
// Only one toggleHtNode — with null check
function toggleHtNode(header) {
  header.classList.toggle("open");
  if (header.nextElementSibling) header.nextElementSibling.classList.toggle("open");
}
 
// Only one setSkill — the in-place regeneration version
function setSkill(s) {
  currentSkill = s;
  document.querySelectorAll(".skill-btn").forEach(b =>
    b.classList.toggle("active", b.textContent === s)
  );
 
  if (!lastHowToBlock || !lastHowToText) return;
  if (isGenerating) return;
 
  const lastUser = [...history].reverse().find(m => m.role === "user");
  if (!lastUser) return;
 
  // Remove last assistant turn so we can replace it
  const lastAiIdx = history.map(m => m.role).lastIndexOf("assistant");
  if (lastAiIdx >= 0) history.splice(lastAiIdx, 1);
 
  // Show loading state inside the existing block
  lastHowToBlock.innerHTML = `
    <div class="msg-meta">
      <span class="mm-label">How-To Tree</span>
      <span style="color:var(--muted);font-size:0.62rem;margin-left:8px">regenerating for ${s}…</span>
    </div>
    <div class="msg-body" style="padding:10px;color:var(--muted);font-size:0.82rem">
      <div class="skill-selector">
        ${["beginner","intermediate","advanced","expert"].map(sk =>
          `<button class="skill-btn${sk===s?" active":""}" onclick="setSkill('${sk}')">${sk}</button>`
        ).join("")}
      </div>
      <div style="padding:20px 0;text-align:center">Generating ${s} guide…</div>
    </div>`;
 
  const targetBlock = lastHowToBlock;
  const rawPrompt   = lastUser.content.replace(/^You are generating[\s\S]*?Task: /m, "");
  const newPrompt   = buildHowToPrompt(rawPrompt, s);
 
  doGenerateInto(newPrompt, [], targetBlock);
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