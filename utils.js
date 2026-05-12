// ── UTILITY FUNCTIONS ──
function escH(s) {
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function tstamp() {
  return new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"});
}

function formatBytes(b) {
  if (b < 1024) return b+"B";
  if (b < 1048576) return (b/1024).toFixed(1)+"KB";
  return (b/1048576).toFixed(1)+"MB";
}

function chunkText(text, chunkSize = 3000) {
  const paras = text.split(/\n\n+/);
  const chunks = [];
  let current = "";
  for (const p of paras) {
    if ((current + p).length > chunkSize && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current += (current ? "\n\n" : "") + p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function extractCodeMeta(text, lang) {
  if (!["py","js","ts","java","go","rs"].includes(lang)) return "";
  const fns=[],cls=[];
  text.split("\n").forEach(l => {
    const mf = l.match(/^\s*(def |function |const |let |fn )([a-zA-Z_]\w*)/);
    const mc = l.match(/^\s*(class |struct )([a-zA-Z_]\w*)/);
    if (mf) fns.push(mf[2]);
    if (mc) cls.push(mc[2]);
  });
  const parts=[];
  if (cls.length) parts.push(`${cls.length} class${cls.length>1?"es":""}: ${cls.slice(0,4).join(", ")}`);
  if (fns.length) parts.push(`${fns.length} fn${fns.length>1?"s":""}: ${fns.slice(0,5).join(", ")}`);
  return parts.join(" · ");
}

function detectLang(t) {
  const s = t.slice(0,400);
  if (/^(import |from |def |class |async def |#!.*python)/.test(s)) return "py";
  if (/^(function |const |let |var |import |export )/.test(s)||s.includes("=>")) return "js";
  if (/typescript|interface |type /.test(s)) return "ts";
  if (/^(#include|int main|void |std::)/.test(s)) return "cpp";
  if (/^(package |import "fmt"|func )/.test(s)) return "go";
  if (/^(use |fn |impl |pub struct|#\[)/.test(s)) return "rs";
  if (/^(<\?php|namespace |use )/.test(s)) return "php";
  if (/^\s*<[a-zA-Z]/.test(s)) return "html";
  if ((s.startsWith("{")||s.startsWith("["))&&s.includes(":")) return "json";
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE)/i.test(s)) return "sql";
  if (/^---\n|^\w+:\s/.test(s)&&s.includes("\n")) return "yaml";
  return "txt";
}

function tryJson(text) {
  const t=text.trim();
  if ((t.startsWith("{")||t.startsWith("["))&&t.length>5) {
    try {
      return `<div class="json-wrap">
        <div class="json-bar" onclick="toggleJson(this)">
          <span class="json-badge">JSON</span>
          <span style="font-size:0.68rem;color:var(--muted)">Structured response</span>
          <span class="json-toggle">▼</span>
        </div>
        <div class="json-body"><pre>${escH(JSON.stringify(JSON.parse(t),null,2))}</pre></div>
      </div>`;
    } catch{}
  }
  return null;
}

function copyCode(btn) {
  const raw=btn.closest(".code-wrap").querySelector("code").dataset.raw||"";
  const text=raw.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"');
  navigator.clipboard.writeText(text).catch(()=>{
    const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
  });
  btn.textContent="Copied!";btn.classList.add("ok");
  setTimeout(()=>{btn.textContent="Copy";btn.classList.remove("ok");},2000);
}

function dlCode(btn,ext) {
  const raw=btn.closest(".code-wrap").querySelector("code").dataset.raw||"";
  const text=raw.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"');
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([text],{type:"text/plain"}));
  a.download=`nexus.${ext}`;a.click();
}

function toggleJson(bar) {
  const body=bar.nextElementSibling;
  const hidden=body.style.display==="none";
  body.style.display=hidden?"block":"none";
  bar.querySelector(".json-toggle").textContent=hidden?"▼":"▶";
}