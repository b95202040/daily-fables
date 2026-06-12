// 學術寓言 loader —— 貼一次就好，之後永遠不用再動這支。
// 它每次執行會去 repo 抓最新的 fable_core.js 來跑；所有改動都在 repo 端，手機自動更新。
// 安裝：Scriptable → 新增 Script → 貼上整段 → 命名「學術寓言」→ 桌面加 Scriptable 小工具選它。

const CORE_URL = "https://raw.githubusercontent.com/b95202040/daily-fables/main/fable_core.js";
const fm = FileManager.local();
const dir = fm.joinPath(fm.documentsDirectory(), "fable_widget");
if (!fm.fileExists(dir)) fm.createDirectory(dir);
const corePath = fm.joinPath(dir, "fable_core.js");

try {
  const req = new Request(CORE_URL);
  req.timeoutInterval = 8;
  const txt = await req.loadString();
  if (txt && txt.indexOf("module.exports") >= 0) fm.writeString(corePath, txt);
} catch (e) { /* 連不到就用上次快取的版本 */ }

if (fm.fileExists(corePath)) {
  globalThis.__fableScriptName = Script.name();
  const mod = importModule(corePath);
  await mod.run();
} else {
  if (config.runsInWidget) {
    const w = new ListWidget();
    w.addText("學術寓言");
    const t = w.addText("第一次請連網路開一次"); t.font = Font.systemFont(11);
    Script.setWidget(w);
  }
  Script.complete();
}
