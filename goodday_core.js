// 好日曆 widget core —— 由 loader 自動抓最新版執行。
// 改這支、跑 deploy_core.sh push 到 repo，手機下次刷新就是新版。
// 磚面：日期 + 文眼 + 金句（來自 Sheet 當日真源）。點磚 → 直接開 IG 當天最新主文。

const DATA_URL = "https://raw.githubusercontent.com/b95202040/daily-fables/main/goodday.json";

const fm = FileManager.local();
const dir = fm.joinPath(fm.documentsDirectory(), "goodday_widget");
if (!fm.fileExists(dir)) fm.createDirectory(dir);
const cachePath = fm.joinPath(dir, "goodday.json");

async function loadData() {
  try {
    const req = new Request(DATA_URL + "?t=" + Date.now());
    req.timeoutInterval = 8;
    const data = await req.loadJSON();
    // 防空：遠端內容壞掉/空白 → 視同抓取失敗，退回本地快取
    if (data && ((data.wenyan || "").trim() || (data.quote || "").trim())) {
      fm.writeString(cachePath, JSON.stringify(data));
      return data;
    }
  } catch (e) {}
  if (fm.fileExists(cachePath)) {
    try { return JSON.parse(fm.readString(cachePath)); } catch (e) {}
  }
  return null;
}

function buildWidget(d) {
  const fam = config.widgetFamily || "medium";
  const small = fam === "small";
  const large = fam === "large";

  const w = new ListWidget();
  w.backgroundColor = Color.dynamic(new Color("#fffdf8"), new Color("#1b1b1d"));
  w.setPadding(14, 16, 14, 16);
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  if (d.ig_url) w.url = d.ig_url; // 點磚直接開 IG 主文

  const accent = Color.dynamic(new Color("#B8433A"), new Color("#E0766E"));
  const fg = Color.dynamic(new Color("#1c1c1e"), new Color("#f5f5f7"));
  const muted = Color.dynamic(new Color("#5a5a5e"), new Color("#c0c0c6"));

  // 頂列：品牌 + 日期
  const head = w.addStack();
  head.centerAlignContent();
  const brand = head.addText("好日曆");
  brand.font = Font.mediumSystemFont(small ? 10 : 12);
  brand.textColor = muted;
  head.addSpacer();
  const dateTxt = head.addText(`${d.display_date} ${d.weekday}`);
  dateTxt.font = Font.mediumSystemFont(small ? 10 : 12);
  dateTxt.textColor = muted;

  w.addSpacer(small ? 6 : 9);

  const yanText = (d.wenyan || "").trim();
  const quoteText = (d.quote || "").trim();

  // 文眼（空則略過，金句放大補位）
  if (yanText) {
    const yan = w.addText(yanText);
    yan.font = Font.boldSystemFont(small ? 16 : large ? 24 : 20);
    yan.textColor = accent;
    yan.lineLimit = 2;
    yan.minimumScaleFactor = 0.7;
    if (quoteText) w.addSpacer(small ? 5 : 8);
  }

  // 金句（空則只顯示文眼）
  if (quoteText) {
    const quote = w.addText(quoteText);
    quote.font = yanText
      ? Font.systemFont(small ? 12 : large ? 17 : 14)
      : Font.boldSystemFont(small ? 14 : large ? 20 : 17);
    quote.textColor = yanText ? fg : accent;
    quote.lineLimit = yanText ? (small ? 3 : large ? 9 : 4) : (small ? 4 : large ? 10 : 5);
  }

  w.addSpacer();

  if (!small) {
    const foot = w.addText("點一下 · 看今天的主文");
    foot.font = Font.systemFont(11);
    foot.textColor = Color.gray();
  }
  return w;
}

module.exports.run = async function () {
  const data = await loadData();
  if (config.runsInWidget) {
    if (!data) {
      const w = new ListWidget();
      w.addText("好日曆");
      const t = w.addText("第一次請連網路開一次"); t.font = Font.systemFont(11);
      Script.setWidget(w);
    } else {
      Script.setWidget(buildWidget(data));
    }
    Script.complete();
    return;
  }
  // 在 App 內手動執行：直接開 IG 主文
  if (data && data.ig_url) {
    Safari.open(data.ig_url);
  } else {
    const a = new Alert(); a.title = "讀不到資料"; a.message = "請確認網路後再試。"; a.addAction("好"); await a.presentAlert();
  }
  Script.complete();
};
