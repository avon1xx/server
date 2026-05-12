// ── NOTEBOOK ──
function renderNbDocs(filter) {
  const container = document.getElementById("nb-docs");
  if (!container) return;
  const docs = filter
    ? nbDocs.filter(d => d.name.toLowerCase().includes(filter) || d.text.toLowerCase().includes(filter))
    : nbDocs;
  container.innerHTML = docs.length
     ? docs.map((d,i) => `
        <div class="nb-doc" onclick="toggleNbDoc(${i})">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;min-width:0">
              <div class="nb-doc-name">${escH(d.name)}</div>
              <div class="nb-doc-meta">${d.size} · ${new Date(d.date).toLocaleDateString()}</div>
            </div>
            <button onclick="event.stopPropagation();deleteNbDoc('${d.id}')" title="Delete" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px;font-size:0.75rem;flex-shrink:0;line-height:1;transition:color 0.15s" onmouseover="this.style.color='var(--err)'" onmouseout="this.style.color='var(--muted)'">
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" style="width:9px;height:9px"><path d="M1 1l8 8M9 1L1 9"/></svg>
            </button>
          </div>
        </div>`).join("")
    : '<div class="nb-empty">No notebook files found.</div>';
}

function searchNotebook(q) { renderNbDocs(q ? q.toLowerCase() : ""); }

function toggleNbDoc(i) {
  const d = nbDocs[i];
  if (!d) return;
  attachCodeBlock(d.text, d.name.split(".").pop(), d.name);
}

function deleteNbDoc(id) {
  nbDocs = nbDocs.filter(d => d.id !== id);
  LS.set("nx3_nb", nbDocs);
  renderNbDocs($("nb-search").value);
}

async function handleNbFiles(input) {
  const files = [...input.files];
  for (const file of files) {
    await readFileForNb(file);
  }
  input.value = "";
  LS.set("nx3_nb", nbDocs);
  renderNbDocs();
}

function readFileForNb(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      nbDocs.push({
        id: "nb-"+Date.now()+Math.random(),
        name: file.name,
        text,
        size: formatBytes(file.size),
        date: Date.now()
      });
      resolve();
    };
    reader.onerror = () => resolve();
    reader.readAsText(file);
  });
}

function toggleNotebook() {
  const nb = document.getElementById("notebook-panel");
  const btn = document.getElementById("nb-btn");
  if (nb) nb.classList.toggle("open");
  if (btn) btn.classList.toggle("active");
  renderNbDocs();
}