// 學術寓言 core —— 由 loader 自動抓取最新版執行。
// 改這支、push 到 repo，手機下次跑就是新版，不用再貼 Scriptable。
// 磚面：領域+標題+鉤子（每天換一則），點磚帶 id 直接跑。
// 點進去：一頁式 WebView —— 故事 → 往下捲即揭曉概念與對照 → 頁內「再抽一則」。

const DATA_URL = "https://raw.githubusercontent.com/b95202040/daily-fables/main/fables.json";

const fm = FileManager.local();
const dir = fm.joinPath(fm.documentsDirectory(), "fable_widget");
if (!fm.fileExists(dir)) fm.createDirectory(dir);
const cachePath = fm.joinPath(dir, "fables.json");

const DOMAIN_COLOR = {
  "經濟與賽局": "#1D9E75", "數學與物理": "#378ADD", "生物與演化": "#639922",
  "心理與認知": "#D4537E", "資訊與計算": "#7F77DD", "哲學與邏輯": "#BA7517",
  "社會與行為": "#D85A30", "歷史與地理": "#5F5E5A",
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
  } catch (e) {}
  if (fm.fileExists(cachePath)) {
    try { return JSON.parse(fm.readString(cachePath)); } catch (e) {}
  }
  return null;
}

function dailyFable(fables) {
  const twDay = Math.floor((Date.now() + 8 * 3600 * 1000) / 86400000);
  return fables[twDay % fables.length];
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

function scriptName() {
  if (typeof globalThis !== "undefined" && globalThis.__fableScriptName) return globalThis.__fableScriptName;
  return Script.name();
}

function buildWidget(f) {
  const small = (config.widgetFamily || "medium") === "small";
  const w = new ListWidget();
  w.backgroundColor = Color.dynamic(new Color("#ffffff"), new Color("#1b1b1d"));
  w.setPadding(14, 16, 14, 16);
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  w.url = "scriptable:///run?scriptName=" + encodeURIComponent(scriptName())
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
  const foot = w.addText("點一下 · 讀故事");
  foot.font = Font.systemFont(small ? 9 : 11);
  foot.textColor = Color.gray();
  return w;
}

function deckHTML(fables, startId) {
  const dataJson = JSON.stringify(fables).replace(/</g, "\\u003c");
  const startJson = JSON.stringify(startId || "");
  const colorJson = JSON.stringify(DOMAIN_COLOR);
  return `<!DOCTYPE html><html lang="zh-Hant"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  :root{ --bg:#fff; --fg:#111; --muted:#666; --hint:#9a9a9a; --card:#f6f6f4; --line:#e6e6e3; }
  @media (prefers-color-scheme: dark){ :root{ --bg:#000; --fg:#f0f0f0; --muted:#a8a8ad; --hint:#6e6e73; --card:#141414; --line:#2a2a2a; } }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body{ margin:0; height:100%; }
  body{ background:var(--bg); color:var(--fg); font:17px/1.85 -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif;
        -webkit-text-size-adjust:100%; padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left); }
  #wrap{ max-width:680px; margin:0 auto; min-height:100%; display:flex; flex-direction:column; }
  main{ flex:1; padding:22px 20px 104px; }
  .tag{ font-size:13px; font-weight:600; }
  h1{ font-size:27px; font-weight:700; line-height:1.3; margin:6px 0 18px; }
  .story p{ font-size:18px; margin:0 0 16px; }
  .sep{ text-align:center; color:var(--hint); font-size:13px; letter-spacing:.2em; margin:30px 0 14px; }
  .card{ background:var(--card); border-radius:16px; padding:18px 18px 8px; }
  .lbl{ font-size:12px; font-weight:600; letter-spacing:.06em; margin-bottom:6px; }
  .concept{ font-size:20px; font-weight:700; line-height:1.4; margin-bottom:10px; }
  .rt{ font-size:16px; color:var(--muted); margin-bottom:4px; }
  .map{ display:flex; gap:9px; align-items:flex-start; padding:11px 0; border-top:1px solid var(--line); }
  .map .s{ flex:1; font-size:15px; }
  .map .a{ font-weight:700; }
  .map .c{ flex:1.15; font-size:15px; color:var(--muted); }
  .punch{ font-size:17px; font-weight:600; line-height:1.7; margin:22px 2px 8px; }
  .bar{ position:sticky; bottom:0; padding:12px 20px calc(14px + env(safe-area-inset-bottom));
        background:linear-gradient(to top, var(--bg) 72%, transparent); }
  .next{ width:100%; padding:16px; border:none; border-radius:14px; font-size:17px; font-weight:600; color:#fff; }
  .next:active{ opacity:.75; }
</style></head><body>
<div id="wrap"><main id="m"></main><div class="bar"><button class="next" id="next">再抽一則</button></div></div>
<script>
const FABLES = ${dataJson};
const COLORS = ${colorJson};
let START = ${startJson};
let recent = [];
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function pick(startId){
  if(startId){ const f = FABLES.find(x=>x.id===startId); if(f) return f; }
  let pool = FABLES.filter(f=>!recent.includes(f.id));
  if(!pool.length){ pool = FABLES; recent = []; }
  return pool[Math.floor(Math.random()*pool.length)];
}
function show(f){
  recent.push(f.id);
  const cap = Math.max(1, Math.floor(FABLES.length*0.7));
  while(recent.length > cap) recent.shift();
  const hex = COLORS[f.domain] || "#888780";
  const story = String(f.story).split(/\\n\\n+/).map(p=>"<p>"+esc(p)+"</p>").join("");
  const maps = (f.mappings||[]).map(m=>'<div class="map"><div class="s">'+esc(m.story)+'</div><div class="a" style="color:'+hex+'">→</div><div class="c">'+esc(m.concept)+'</div></div>').join("");
  document.getElementById("m").innerHTML =
    '<div class="tag" style="color:'+hex+'">'+esc(f.domain)+'</div>'+
    '<h1>'+esc(f.title)+'</h1>'+
    '<div class="story">'+story+'</div>'+
    '<div class="sep">· · ·　往下是揭曉　· · ·</div>'+
    '<div class="card">'+
      '<div class="lbl" style="color:'+hex+'">這是什麼</div>'+
      '<div class="concept">'+esc(f.concept)+'</div>'+
      '<div class="rt">'+esc(f.reveal_concept)+'</div>'+
      '<div class="lbl" style="color:'+hex+';margin-top:14px">故事 → 學理</div>'+
      maps+
    '</div>'+
    '<div class="punch">'+esc(f.punchline)+'</div>';
  document.getElementById("next").style.background = hex;
  window.scrollTo(0,0);
}
document.getElementById("next").onclick = ()=> show(pick(null));
show(pick(START)); START="";
</script></body></html>`;
}

module.exports.run = async function () {
  const data = await loadData();
  if (!data) {
    if (config.runsInWidget) {
      const w = new ListWidget();
      w.addText("讀不到寓言");
      const t = w.addText("第一次請連網路打開一次"); t.font = Font.systemFont(11);
      Script.setWidget(w);
    } else {
      const a = new Alert(); a.title = "讀不到資料"; a.message = "請確認網路後再試。"; a.addAction("好"); await a.presentAlert();
    }
    Script.complete();
    return;
  }
  const fables = applyDomainFilter(data.fables);
  if (config.runsInWidget) {
    Script.setWidget(buildWidget(dailyFable(fables)));
    Script.complete();
    return;
  }
  const startId = (args.queryParameters && args.queryParameters.id) || dailyFable(fables).id;
  const wv = new WebView();
  await wv.loadHTML(deckHTML(fables, startId));
  await wv.present(true);
  Script.complete();
};
