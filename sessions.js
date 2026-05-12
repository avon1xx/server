// ── SESSIONS, HISTORY, EXPORT/IMPORT ──
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}

function newChat() {
  if (history.length) saveSession();
  sessionId=null; history=[]; totalTokens=0; updateTokChip();
  allMessages=[];
  const chatContainer = document.getElementById("chat");
  if (chatContainer) {
    chatContainer.innerHTML=`<div id="vscroll-top"></div>
      <div class="msg-block system-msg"><div class="msg-meta"><span class="mm-label">System</span></div>
      <div class="msg-body">New session started.</div></div>
      <div id="vscroll-bot"></div>`;
  }
  if (window.innerWidth<=640 && typeof closeSidebar === "function") closeSidebar();
}

function saveSession() {
  if (!history.length) return;
  const title=history.find(m=>m.role==="user")?.content?.slice(0,55)||"Chat";
  const id=sessionId||genId();
  sessionId=id;
  const existing=sessions.findIndex(s=>s.id===id);
  const s={id,title,date:new Date().toISOString(),model:currentModel,messages:[...history]};
  if (existing>=0)sessions[existing]=s; else sessions.unshift(s);
  if (sessions.length>50)sessions=sessions.slice(0,50);
  LS.set("nx3_sessions",sessions);
  renderHistory();
}

function loadSession(id) {
  const s=sessions.find(s=>s.id===id);if(!s)return;
  if (history.length)saveSession();
  sessionId=id; history=[...s.messages]; totalTokens=0;
  allMessages=[];
  const chatContainer = document.getElementById("chat");
  if (chatContainer) {
    chatContainer.innerHTML=`<div id="vscroll-top"></div><div id="vscroll-bot"></div>`;
    history.forEach(m=>{
      if(m.role==="user"){
        const b=document.createElement("div");b.className="msg-block user";
        b.innerHTML=`<div class="msg-meta"><span class="mm-label">You</span></div><div class="msg-body">${escH(m.content)}</div>`;
        chatContainer.insertBefore(b,document.getElementById("vscroll-bot"));
      } else if(m.role==="assistant"){
        const b=document.createElement("div");b.className="msg-block ai";
        const jh=tryJson(m.content.trim());
        b.innerHTML=`<div class="msg-meta"><span class="mm-label">Nexus</span><div class="msg-actions"><button class="ma-btn" onclick="copyMsg(this)">Copy</button><button class="ma-btn" onclick="regenMsg(this)">Regen</button></div></div>
          <div class="msg-body">${jh||marked.parse(m.content)}</div>`;
        chatContainer.insertBefore(b,document.getElementById("vscroll-bot"));
      }
    });
  }
  scrollChat();
  pruneOldMessages();
  renderHistory();
  if (window.innerWidth<=640 && typeof closeSidebar === "function") closeSidebar();
}

function deleteSession(id,e) {
  e.stopPropagation();
  sessions=sessions.filter(s=>s.id!==id);
  LS.set("nx3_sessions",sessions);
  if(sessionId===id)newChat(); else renderHistory();
}

function renderHistory() {
  const list=document.getElementById("history-list");
  if(!list) return;
  list.innerHTML="";
  if(!sessions.length){
    list.innerHTML=`<div style="font-size:0.68rem;color:var(--muted);padding:8px 10px;text-align:center">No saved sessions</div>`;
    return;
  }
  sessions.forEach(s=>{
    const el=document.createElement("div");
    el.className="history-item"+(s.id===sessionId?" active":"");
    const d=new Date(s.date);
    const dt=d.toLocaleDateString("en",{month:"short",day:"numeric"});
    el.innerHTML=`<span class="h-title" title="${escH(s.title)}">${escH(s.title)}</span>
      <span class="h-date">${dt}</span>
      <button class="h-del" onclick="deleteSession('${s.id}',event)" title="Delete">
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" style="width:9px;height:9px"><path d="M1 1l8 8M9 1L1 9"/></svg>
      </button>`;
    el.addEventListener("click",()=>loadSession(s.id));
    list.appendChild(el);
  });
}

function exportChat() {
  if (!history.length){alert("Nothing to export.");return;}
  const title=history.find(m=>m.role==="user")?.content?.slice(0,60)||"nexus-chat";
  let md=`---\ntitle: "${escH(title)}"\nmodel: ${currentModel}\ndate: ${new Date().toISOString()}\nsession: ${sessionId||"—"}\n---\n\n`;
  history.forEach(m=>{md+=`## ${m.role==="user"?"You":"Nexus"}\n\n${m.content}\n\n---\n\n`;});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([md],{type:"text/markdown"}));
  a.download=`nexus-${Date.now()}.md`;a.click();
}

function handleImportDrop(e) {
  e.preventDefault();
  const dz = document.getElementById("import-dz");
  if (dz) dz.style.borderColor="var(--border2)";
  const f=e.dataTransfer.files[0];if(f)importFile(f);
}
function handleImportFile(input){const f=input.files[0];if(f)importFile(f);input.value="";}
function importFile(file) {
  const r=new FileReader();
  r.onload=e=>{
    const msgs=[];
    e.target.result.split(/^## /m).filter(Boolean).forEach(s=>{
      const lines=s.split("\n");
      const role=lines[0].trim().toLowerCase()==="you"?"user":"assistant";
      const content=lines.slice(2).join("\n").replace(/\n---\n?$/,"").trim();
      if(content)msgs.push({role,content});
    });
    if(!msgs.length){alert("Could not parse file.");return;}
    if(history.length)saveSession();
    sessionId=null;history=msgs;
    loadSession(saveAndGetId());
    closeModal("import-modal");
  };
  r.readAsText(file);
}
function saveAndGetId(){saveSession();return sessionId;}