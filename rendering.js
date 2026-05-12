// ── CUSTOM MARKED RENDERER FOR CODE BLOCKS ──
const renderer = new marked.Renderer();
renderer.code = function(token) {
  const raw  = typeof token==="object" ? token.text||"" : token;
  const lang = typeof token==="object" ? token.lang||"" : "";
  let hi="";
  try {
    hi = lang && hljs.getLanguage(lang)
      ? hljs.highlight(raw,{language:lang}).value
      : hljs.highlightAuto(raw).value;
  } catch { hi=escH(raw); }
  return `<div class="code-wrap">
    <div class="code-bar">
      <span class="code-lang-tag">${lang||"code"}</span>
      <button class="cbb" onclick="copyCode(this)">Copy</button>
      <button class="cbb" onclick="dlCode(this,'${lang||'txt'}')">↓</button>
    </div>
    <pre><code class="hljs" data-raw="${escH(raw)}">${hi}</code></pre>
  </div>`;
};
marked.setOptions({ renderer, breaks:true, gfm:true });

// Click to copy AI bubble content
document.addEventListener("click", e => {
  const bubble=e.target.closest(".msg-block.ai .msg-body");
  if(!bubble||e.target.closest("button")||e.target.closest("a"))return;
  navigator.clipboard.writeText(bubble.innerText).catch(()=>{});
});