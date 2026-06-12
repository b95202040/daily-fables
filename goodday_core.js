// 好日曆 widget core —— 由 loader 自動抓最新版執行。
// 磚面＝Mac 端用蘭陽明體渲染好的日曆卡（goodday_s/m/l.jpg），手機免裝字體。
// 點磚 → 直接開 IG 當天最新主文。改這支、跑 deploy_core.sh push，手機下次刷新生效。

const BASE = "https://raw.githubusercontent.com/b95202040/daily-fables/main/";
const DATA_URL = BASE + "goodday.json";
const IMG_NAME = { small: "goodday_s.jpg", medium: "goodday_m.jpg", large: "goodday_l.jpg" };

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

async function loadCardImage(ver) {
  const fam = config.widgetFamily || "medium";
  const name = IMG_NAME[fam] || IMG_NAME.medium;
  const path = fm.joinPath(dir, name);
  try {
    const req = new Request(BASE + name + "?v=" + encodeURIComponent(ver || "0"));
    req.timeoutInterval = 8;
    const img = await req.loadImage();
    if (img) { fm.writeImage(path, img); return img; }
  } catch (e) {}
  if (fm.fileExists(path)) {
    try { return fm.readImage(path); } catch (e) {}
  }
  return null;
}

// 文字版 fallback（圖抓不到且無快取時，維持紙感配色）
function textWidget(d) {
  const fam = config.widgetFamily || "medium";
  const small = fam === "small";
  const w = new ListWidget();
  w.backgroundColor = new Color("#F4EFE5");
  w.setPadding(16, 18, 16, 18);
  const ink = new Color("#2E2C28");
  const soft = new Color("#4A463E");
  const fade = new Color("#8A8578");

  const head = w.addStack();
  head.centerAlignContent();
  const brand = head.addText("好日曆");
  brand.font = Font.mediumSystemFont(small ? 10 : 12);
  brand.textColor = fade;
  head.addSpacer();
  const dateTxt = head.addText(`${d.display_date} ${d.weekday}`);
  dateTxt.font = Font.mediumSystemFont(small ? 10 : 12);
  dateTxt.textColor = fade;
  w.addSpacer(small ? 6 : 9);

  const yanText = (d.wenyan || "").trim();
  const quoteText = (d.quote_lines || []).join("\n") || (d.quote || "").trim();
  if (yanText) {
    const yan = w.addText(yanText);
    yan.font = Font.boldSystemFont(small ? 17 : fam === "large" ? 26 : 21);
    yan.textColor = ink;
    yan.lineLimit = 2;
    yan.minimumScaleFactor = 0.7;
    if (quoteText) w.addSpacer(small ? 5 : 8);
  }
  if (quoteText && !small) {
    const quote = w.addText(quoteText);
    quote.font = Font.systemFont(fam === "large" ? 17 : 14);
    quote.textColor = soft;
    quote.lineLimit = fam === "large" ? 9 : 4;
  }
  w.addSpacer();
  return w;
}

module.exports.run = async function () {
  const data = await loadData();
  if (config.runsInWidget) {
    const w0 = new ListWidget();
    let w = w0;
    if (!data) {
      w.backgroundColor = new Color("#F4EFE5");
      const t1 = w.addText("好日曆"); t1.textColor = new Color("#2E2C28");
      const t2 = w.addText("第一次請連網路開一次");
      t2.font = Font.systemFont(11); t2.textColor = new Color("#8A8578");
    } else {
      const img = await loadCardImage(data.updated);
      if (img) {
        w = new ListWidget();
        w.backgroundImage = img;
        w.setPadding(0, 0, 0, 0);
      } else {
        w = textWidget(data);
      }
      if (data.ig_url) w.url = data.ig_url; // 點磚直接開 IG 主文
    }
    w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
    Script.setWidget(w);
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
