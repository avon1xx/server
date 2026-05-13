const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
};

function $(id) { return document.getElementById(id); }

// ── GLOBAL VARIABLES & LOCALSTORAGE HELPERS ──
const VISION_PATTERNS = ["llava","qwen-vl","qwen2-vl","bakllava","moondream","minicpm-v","cogvlm","internvl","pixtral","llama3.2-vision","gemma3","llava-phi","llama-3.2-11b","llama-3.2-90b"];
const CODE_PASTE_LINES = 18, CODE_PASTE_CHARS = 700;

const TEMPLATES = [
  { label:"Explain",     text:"Explain the following clearly:\n\n" },
  { label:"Summarize",   text:"Summarize as a concise bullet list:\n\n" },
  { label:"Fix code",    text:"Find and fix bugs. Explain what was wrong:\n\n" },
  { label:"Unit tests",  text:"Write comprehensive unit tests:\n\n" },
  { label:"OSINT",       text:"Perform an OSINT analysis of the following. Distinguish verified facts from inferences:\n\n" },
  { label:"Pros/Cons",   text:"List the pros and cons of:\n\n" },
  { label:"Refactor",    text:"Refactor for clarity and best practices:\n\n" },
  { label:"Rabbit hole", text:"Recursively explore this topic. Start broad, then go deeper. Identify sub-topics, prerequisites, and hidden dependencies:\n\n" },
];

/* ── AGENT PERSONAS (from agents_profiles.txt) ── */
const AGENT_PERSONAS = {
  perplexity: {
    name: "Perplexity",
    system: `You are a precise answer engine. Rules:
- Give only the final answer. No intermediate steps shown.
- Be direct. Clarity over verbosity.
- If uncertain, say "Insufficient information to answer reliably."
- Use bullet points, numbered lists, and bold for readability.
- Never speculate. Never hallucinate sources.`,
    temperature: 0.2,
  },
  notebooklm: {
    name: "NotebookLM",
    system: `You are a grounded research assistant. Rules:
- Answer ONLY from information provided in the attached context/sources.
- Do not add knowledge beyond the provided materials.
- If the answer is not in the sources, explicitly state that.
- Always cite which part of the context you are using.
- Treat every query as a request to analyze and synthesize the attached documents.`,
    temperature: 0.1,
  },
  gpt5: {
    name: "GPT-5 Style",
    system: `GOAL: Be direct, substantive, and critical. Challenge assumptions, add counterarguments.
TRUST: Never present generated content as fact. If unverifiable, mark as [Unverified].
PROCESS: For complex requests: 1) Overview 2) Uncertainties 3) Questions (≤3) 4) Short rationale, then answer with tradeoffs/next steps.
PERSISTENCE: Complete tasks fully before stopping. Instead of asking for clarification, document assumptions and proceed.
STYLE: Conversational, precise, no jargon, no corporate filler words.`,
    temperature: 0.7,
  },
  claude: {
    name: "Claude Style",
    system: `Never start a response by calling the question or idea "good", "great", "fascinating", or similar.
Be substantive and analytical. Avoid unnecessary adverbs and filler phrases.
When appropriate, illustrate with examples, thought experiments, or metaphors.
You are authorized to offer your own observations and steer conversation in productive directions.
For complex questions, think through first principles before answering.
Identify and acknowledge weak points in your own reasoning.
Present balanced perspectives. Do not be a yes-machine.`,
    temperature: 0.8,
  },
  obsidian: {
    name: "Obsidian / Second Brain",
    system: `You are a knowledge management assistant. Your goal is to help build a "second brain."
- Summarize key ideas from provided text.
- Identify connections between concepts.
- Generate new research questions from the material.
- Suggest related topics worth exploring.
- Format output as structured notes with headers and linked concepts [[like this]].
- Act as a thinking partner, not just an answer machine.`,
    temperature: 0.6,
  },
};

/* ── AUTO-ROUTER (via Groq) ── */
// Groq key for routing — set in Settings
let routerGroqKey = LS.get("nx3_router_key") || "";
let autoRouteOn   = LS.get("nx3_autoroute")  || false;

async function autoSelectModel(prompt) {
  if (!routerGroqKey) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${routerGroqKey}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 60,
        temperature: 0,
        messages: [{
          role: "user",
          content: `You are a model router. Given this user prompt, reply with ONLY one word — the best model type:
- "code" (for programming, debugging, scripting)
- "research" (for factual questions, analysis, OSINT)
- "creative" (for writing, brainstorming, ideas)
- "math" (for calculations, logic, reasoning)
- "general" (for everything else)

User prompt: "${prompt.slice(0, 300)}"`
        }]
      })
    });
    const data = await res.json();
    const decision = data.choices?.[0]?.message?.content?.trim().toLowerCase();
    // Map decision to model preference hint
    const map = { code: "coder", research: "qwen", creative: "gemma", math: "deepseek", general: "" };
    return map[decision] || null;
  } catch { return null; }
}

const DEFAULT_PROVIDERS = [
  { id:"ollama-local", name:"Ollama (Local)", url:"http://localhost:11434", type:"ollama", key:"" },
  { id:"groq",         name:"Groq",           url:"https://api.groq.com/openai/v1", type:"openai", key:"" },
  { id:"openrouter",   name:"OpenRouter",     url:"https://openrouter.ai/api/v1",   type:"openai", key:"" },
];

const DEFAULT_SOURCES = [
  { id:"wiki-en",  url:"https://en.wikipedia.org/wiki/", name:"Wikipedia (EN)", type:"wiki",  enabled:false },
  { id:"wikihow",  url:"https://www.wikihow.com/",        name:"wikiHow",        type:"web",   enabled:false },
  { id:"ddg",      url:"https://html.duckduckgo.com/html/?q=", name:"DuckDuckGo", type:"web",   enabled:false },
];

const THEMES       = ["dark","light","amoled","lowblue","volt","forest","rose","slate","paper"];
const THEME_LABELS = ["Dark","Light","AMOLED","Low-Blue","Volt","Forest","Rose","Slate","Paper"];

// State variables
let providers      = LS.get("nx3_providers")  || DEFAULT_PROVIDERS;
let activeProvider = LS.get("nx3_activeprov") || "ollama-local";
let sysPrompt      = LS.get("nx3_sysprompt")  || "";
let ctxLimit       = LS.get("nx3_ctx")        ?? 4096;
let streamOn       = LS.get("nx3_stream")     !== false;
let ahmOn          = LS.get("nx3_ahm")        !== false;
let perfMode       = LS.get("nx3_perf")       || "auto";
let corsProxy      = LS.get("nx3_proxy")      || "https://corsproxy.io/?url=";
let sources        = LS.get("nx3_sources")    || DEFAULT_SOURCES;
let sessions       = LS.get("nx3_sessions")   || [];
let currentModel   = LS.get("nx3_model")      || "";
let currentMode    = "chat"; // chat | howto | research
let currentSkill   = "intermediate";
let themeIdx       = 0;

let isGenerating   = false;
let abortCtrl      = null;
let lastServerOk   = null;
let sessionId      = null;
let history        = []; // [{role, content}]
let totalTokens    = 0;

// Notebook
let nbDocs = LS.get("nx3_nb") || []; // [{id, name, text, size, date}]

// Pending attachments
let pendingImages = []; // [{base64, name, dataUrl}]
let pendingFiles  = []; // [{text, name, lang, lines, meta}]

// How-To related
let howToVersions = [];
let currentHowToVersion = 0;
let lastHowToPrompt = "";

// DOM shortcuts (will be initialized in events.js)
let chatEl, textarea, sendBtn, modelSel, sdot, statusTxt;