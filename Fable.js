// 學術寓言 — iPhone 桌面小工具（Scriptable）
// 磚面：領域標籤 + 故事標題 + 一句鉤子（每天自動換一則）
// 點一下：開故事 → 讀完按「揭曉」才現出概念與隱喻對照 → 問「再抽一則？」
// 資料來源：GitHub 上的 fables.json（離線吃本地快取）
// 安裝：Scriptable App → 新增 Script → 貼上整段 → 命名「學術寓言」→ 回桌面長按加 Scriptable 小工具 → 選此腳本
// 可選：在小工具設定的 Parameter 填某個領域名（如「心理與認知」）只看該領域；留空＝全部

const DATA_URL = "https://raw.githubusercontent.com/b95202040/daily-fables/main/fables.json";

const fm = FileManager.local();
const dir = fm.joinPath(fm.documentsDirectory(), "fable_widget");
if (!fm.fileExists(dir)) fm.createDirectory(dir);
const cachePath = fm.joinPath(dir, "fables.json");
const statePath = fm.joinPath(dir, "state.json");

const DOMAIN_COLOR = {
  "經濟與賽局": "#1D9E75",
  "數學與物理": "#378ADD",
  "生物與演化": "#639922",
  "心理與認知": "#D4537E",
  "資訊與計算": "#7F77DD",
  "哲學與邏輯": "#BA7517",
};
function accentFor(d) { return new Color(DOMAIN_COLOR[d] || "#888780"); }

async function loadData() {
  try {
    const req = new Request(DATA_URL);
    req.timeoutInterval = 8;
    const data = await req.loadJSON();
    if (data && Array.isArray(data.fables) && data.fables.length) {
      fm.writeString(cachePath, JSON.stringify(data));
      return data;
    }
  } catch (e) { /* fall back to cache */ }
  if (fm.fileExists(cachePath)) {
    try { return JSON.parse(fm.readString(cachePath)); } catch (e) {}
  }
  return null;
}

function loadState() {
  try {
    if (fm.fileExists(statePath)) {
      const s = JSON.parse(fm.readString(statePath));
      if (s && typeof s === "object") return { recent: Array.isArray(s.recent) ? s.recent : [] };
    }
  } catch (e) {}
  return { recent: [] };
}
function saveState(s) { fm.writeString(statePath, JSON.stringify(s)); }

// 台灣日期序：每天換一則，磚面在同一天內穩定不亂跳
function dailyFable(fables) {
  const twDay = Math.floor((Date.now() + 8 * 3600 * 1000) / 86400000);
  return fables[twDay % fables.length];
}

// 點進去用：盡量不重複最近看過的
function drawFable(fables, state) {
  const recent = state.recent || [];
  let pool = fables.filter(f => !recent.includes(f.id));
  if (pool.length === 0) { pool = fables; state.recent = []; }
  const f = pool[Math.floor(Math.random() * pool.length)];
  state.recent = [...(state.recent || []), f.id].slice(-Math.max(1, Math.floor(fables.length * 0.7)));
  saveState(state);
  return f;
}

function currentFilter() {
  if (args.widgetParameter) return String(args.widgetParameter).trim();
  if (args.queryParameters && args.queryParameters.p) return String(args.queryParameters.p).trim();
  return "";
}
function applyDomainFilter(fables) {
  const p = currentFilter();
  if (!p) return fables;
  const f2 = fables.filter(x => x.domain === p);
  return f2.length ? f2 : fables;
}

function buildWidget(f) {
  const family = config.widgetFamily || "medium";
  const small = family === "small";
  const w = new ListWidget();
  w.backgroundColor = Color.dynamic(new Color("#ffffff"), new Color("#1b1b1d"));
  w.setPadding(14, 16, 14, 16);
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  // 點磚 → 直接跑本 script，並帶上磚上這一則的 id（讓點進去就是同一則）
  w.url = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name())
        + "&id=" + encodeURIComponent(f.id)
        + "&p=" + encodeURIComponent(args.widgetParameter ? String(args.widgetParameter).trim() : "");

  const pill = w.addText(f.domain);
  pill.font = Font.mediumSystemFont(small ? 10 : 12);
  pill.textColor = accentFor(f.domain);

  w.addSpacer(small ? 5 : 7);
  const title = w.addText(f.title);
  title.font = Font.boldSystemFont(small ? 16 : 21);
  title.textColor = Color.dynamic(new Color("#111111"), new Color("#f5f5f7"));
  title.lineLimit = 1;

  w.addSpacer(small ? 5 : 7);
  const hook = w.addText(f.hook);
  hook.font = Font.systemFont(small ? 12 : 15);
  hook.textColor = Color.dynamic(new Color("#444444"), new Color("#c7c7cc"));
  hook.lineLimit = small ? 3 : 4;

  w.addSpacer();
  const foot = w.addText("點一下 · 揭曉概念");
  foot.font = Font.systemFont(small ? 9 : 11);
  foot.textColor = Color.gray();
  return w;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function readerHTML(f) {
  const hex = DOMAIN_COLOR[f.domain] || "#888780";
  const story = String(f.story).split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join("");
  const maps = (f.mappings || []).map(m =>
    `<div class="map"><div class="ms">${esc(m.story)}</div><div class="ar">→</div><div class="mc">${esc(m.concept)}</div></div>`
  ).join("");
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light dark; }
  body { font: -apple-system-body; margin:0; padding:22px 20px 40px; line-height:1.85;
         background:#fff; color:#111; -webkit-text-size-adjust:100%; }
  @media (prefers-color-scheme: dark){ body{ background:#000; color:#eee; } .card{ background:#141414 !important; } .map{ border-color:#2a2a2a !important; } }
  .tag { display:inline-block; font-size:13px; font-weight:600; color:${hex}; margin-bottom:4px; }
  h1 { font-size:26px; font-weight:700; margin:2px 0 18px; }
  p { font-size:18px; margin:0 0 16px; }
  .btn { display:block; width:100%; box-sizing:border-box; margin:14px 0 8px; padding:15px;
         font-size:17px; font-weight:600; text-align:center; border:none; border-radius:14px;
         color:#fff; background:${hex}; }
  #reveal { display:none; margin-top:10px; }
  .card { background:#f6f6f4; border-radius:16px; padding:18px 18px 8px; margin-top:8px; }
  .lbl { font-size:13px; font-weight:600; color:${hex}; letter-spacing:.04em; margin-bottom:6px; }
  .concept { font-size:19px; font-weight:700; margin-bottom:10px; }
  .reveal-text { font-size:16px; color:inherit; opacity:.9; margin-bottom:6px; }
  .map { display:flex; align-items:flex-start; gap:8px; padding:11px 0; border-top:1px solid #e6e6e3; }
  .ms { flex:1; font-size:15px; }
  .ar { color:${hex}; font-weight:700; }
  .mc { flex:1.1; font-size:15px; opacity:.85; }
  .punch { font-size:17px; font-weight:600; margin:22px 2px 0; line-height:1.7; }
  .hint { text-align:center; color:#999; font-size:13px; margin-top:6px; }
</style></head><body>
  <div class="tag">${esc(f.domain)}</div>
  <h1>${esc(f.title)}</h1>
  ${story}
  <button class="btn" onclick="document.getElementById('reveal').style.display='block'; this.style.display='none'; window.scrollBy(0,260);">🔓 揭曉這是什麼概念</button>
  <div class="hint">先想想，再揭曉</div>
  <div id="reveal">
    <div class="card">
      <div class="lbl">這是什麼</div>
      <div class="concept">${esc(f.concept)}</div>
      <div class="reveal-text">${esc(f.reveal_concept)}</div>
      <div class="lbl" style="margin-top:14px;">故事 → 學理</div>
      ${maps}
    </div>
    <div class="punch">${esc(f.punchline)}</div>
  </div>
</body></html>`;
}

async function presentReader(f) {
  const wv = new WebView();
  await wv.loadHTML(readerHTML(f));
  await wv.present(true);
}

// ---- main ----
const data = await loadData();
if (!data) {
  if (config.runsInWidget) {
    const w = new ListWidget();
    w.addText("讀不到寓言");
    w.addText("第一次請連網路打開一次").font = Font.systemFont(11);
    Script.setWidget(w);
  } else {
    const a = new Alert(); a.title = "讀不到資料"; a.message = "請確認網路，或稍後再試。"; a.addAction("好"); await a.presentAlert();
  }
  Script.complete();
} else {
  const fables = applyDomainFilter(data.fables);
  if (config.runsInWidget) {
    Script.setWidget(buildWidget(dailyFable(fables)));
    Script.complete();
  } else {
    // 在 App 內（點開）：先給磚面那一則（用帶過來的 id），再進「再抽一則」迴圈
    const state = loadState();
    const startId = (args.queryParameters && args.queryParameters.id) || null;
    let f = (startId && fables.find(x => x.id === startId)) || dailyFable(fables);
    state.recent = [...(state.recent || []), f.id];
    let again = true;
    while (again) {
      await presentReader(f);
      const a = new Alert();
      a.title = "再抽一則？";
      a.addAction("好，再來");
      a.addCancelAction("夠了");
      again = (await a.presentAlert()) === 0;
      if (again) f = drawFable(fables, state);
    }
    Script.complete();
  }
}
