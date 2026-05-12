// ── SOURCE MANAGER UI AND FETCHING ──
function renderSourcesList() {
  const container = document.getElementById("sources-list");
  if (!container) return;
  container.innerHTML = sources.map((s,i) => `
    <div class="source-item">
      <input type="checkbox" class="source-enabled" ${s.enabled?"checked":""} onchange="sources[${i}].enabled=this.checked"/>
      <span class="source-name" title="${escH(s.url)}">${escH(s.name)}</span>
      <span class="source-type st-${s.type}">${s.type}</span>
      <button class="src-del" onclick="sources.splice(${i},1);renderSourcesList()">✕</button>
    </div>`).join("");
}

function addSource() {
  const urlInput = document.getElementById("new-src-url");
  const typeSel = document.getElementById("new-src-type");
  const url = urlInput ? urlInput.value.trim() : "";
  const type = typeSel ? typeSel.value : "web";
  if (!url) return;
  const name = url.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 40);
  sources.push({ id:"src-"+Date.now(), url, name, type, enabled:true });
  if (urlInput) urlInput.value = "";
  renderSourcesList();
}

async function fetchSourceContent(src) {
  try {
    let url = src.url;
    if (src.type === "wiki") {
      const title = url.split("/wiki/")[1] || "";
      if (title) {
        const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const d = await res.json();
          return `[Wikipedia: ${d.title}]\n${d.extract || ""}`.slice(0, 3000);
        }
      }
    }
    const proxyUrl = corsProxy + encodeURIComponent(url);
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error();
    const html = await res.text();
    const div = document.createElement("div");
    div.innerHTML = html;
    div.querySelectorAll("script,style,nav,footer,header").forEach(el=>el.remove());
    const text = (div.innerText || div.textContent || "").replace(/\s{3,}/g," ").trim();
    return `[Source: ${src.name}]\n${text.slice(0, 3000)}`;
  } catch { return null; }
}