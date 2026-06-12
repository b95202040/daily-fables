// 好日曆 widget core —— 由 loader 自動抓最新版執行。
// 預設「文字模式」：手機原生渲染（銳利），仿日曆卡排版（左日期欄＋分隔線＋文眼＋呼吸分行內文＋農曆節氣），
// 21:00–05:00 自動換深色暖燭配色。點磚 → 直接開 IG 當天最新主文。
//
// Widget Parameter（長按 widget → 編輯 → Parameter）：
//   留空        = 文字模式，宋體（Songti TC，iOS 內建）
//   蘭陽 或 jf  = 文字模式，蘭陽明體（需先用 AnyFont 等安裝 fonts/ 內兩個 OTF）
//   卡面 或 img = 圖片卡模式（Mac 端蘭陽明體渲染圖，解析度受 iOS widget 縮放限制）

const BASE = "https://raw.githubusercontent.com/b95202040/daily-fables/main/";
const DATA_URL = BASE + "goodday.json";
const IMG_NAME = { small: "goodday_s.jpg", medium: "goodday_m.jpg", large: "goodday_l.jpg" };

const fm = FileManager.local();
const dir = fm.joinPath(fm.documentsDirectory(), "goodday_widget");
if (!fm.fileExists(dir)) fm.createDirectory(dir);
const cachePath = fm.joinPath(dir, "goodday.json");

const PAL_DAY = {
  bg: "#F4EFE5", ink: "#2E2C28", soft: "#4A463E", fade: "#8A8578", line: "#3E3C36",
};
const PAL_NIGHT = {
  bg: "#2B2824", ink: "#EDE4D2", soft: "#C9BCA4", fade: "#877E6C", line: "#A89C85",
};

// 晚安模式：21:00–05:00 深色暖燭配色（內容相同）
function isNightNow() {
  const h = new Date().getHours();
  return h >= 21 || h < 5;
}

function widgetParam() {
  return args.widgetParameter ? String(args.widgetParameter).trim() : "";
}

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

// ---------- 文字模式（預設） ----------

// 官方 logo lockup（好日曆＋GOODAY＋TM，黑+透明，顯示時染品牌淡色）。
// 靜態檔 cache-first：抓過一次就用本地，logo 更新時改檔名即可。
async function loadLogoImage() {
  const path = fm.joinPath(dir, "goodday_logo.png");
  if (fm.fileExists(path)) {
    try { return fm.readImage(path); } catch (e) {}
  }
  try {
    const req = new Request(BASE + "goodday_logo.png");
    req.timeoutInterval = 6;
    const img = await req.loadImage();
    if (img) { fm.writeImage(path, img); return img; }
  } catch (e) {}
  return null;
}

function makeFonts(useJf) {
  // 字體名不存在時 Scriptable 自動退系統字型，不會壞
  return {
    bold: (s) => new Font(useJf ? "jf-lanyangming-1.0-SemiBold" : "STSongti-TC-Bold", s),
    reg: (s) => new Font(useJf ? "jf-lanyangming-1.0-Book" : "STSongti-TC-Regular", s),
  };
}

function cardTextWidget(d, fam, useJf, logoImg) {
  const night = isNightNow();
  const pal = night ? PAL_NIGHT : PAL_DAY;
  const F = makeFonts(useJf);
  const C = (hex) => new Color(hex);
  const large = fam === "large";

  const w = new ListWidget();
  w.backgroundColor = C(pal.bg);

  if (fam === "small") {
    w.setPadding(12, 12, 12, 12);
    const top = w.addText(`${d.display_date}　${d.weekday}`);
    top.font = F.reg(11); top.textColor = C(pal.fade); top.centerAlignText();
    w.addSpacer();
    const yan = w.addText(d.wenyan || "");
    yan.font = F.bold(20); yan.textColor = C(pal.ink);
    yan.lineLimit = 3; yan.minimumScaleFactor = 0.7; yan.centerAlignText();
    w.addSpacer();
    if (d.lunar) {
      const lu = w.addText(d.lunar + (d.term ? "・" + d.term : ""));
      lu.font = F.reg(9); lu.textColor = C(pal.fade);
      lu.lineLimit = 1; lu.minimumScaleFactor = 0.7; lu.centerAlignText();
    }
    return w;
  }

  // medium / large：左日期欄 ＋ 分隔線 ＋ 右文眼內文
  w.setPadding(large ? 18 : 12, 16, large ? 18 : 12, 14);
  const outer = w.addStack();
  outer.layoutHorizontally();
  outer.centerAlignContent();

  const colW = large ? 104 : 92;
  const left = outer.addStack();
  left.layoutVertically();
  left.size = new Size(colW, 0);

  const ym = left.addText(`${(d.date || "").slice(0, 4)} 年 ${(d.date || "").slice(5, 7)} 月`);
  ym.font = F.reg(large ? 12 : 10); ym.textColor = C(pal.ink); ym.centerAlignText();
  left.addSpacer(large ? 8 : 4);
  const day = left.addText(String(parseInt((d.date || "--").slice(8, 10), 10) || ""));
  day.font = F.bold(large ? 56 : 42); day.textColor = C(pal.ink); day.centerAlignText();
  left.addSpacer(large ? 8 : 4);
  const wd = left.addText(d.weekday || "");
  wd.font = F.reg(large ? 14 : 12); wd.textColor = C(pal.ink); wd.centerAlignText();
  if (d.lunar) {
    left.addSpacer(large ? 8 : 5);
    const lu = left.addText(d.lunar);
    lu.font = F.reg(large ? 11 : 9); lu.textColor = C(pal.fade); lu.centerAlignText();
    if (d.term) {
      const te = left.addText(d.term);
      te.font = F.reg(large ? 11 : 9); te.textColor = C(pal.fade); te.centerAlignText();
      te.lineLimit = 1; te.minimumScaleFactor = 0.7;
    }
  }

  outer.addSpacer(large ? 16 : 12);
  const rule = outer.addStack();
  rule.backgroundColor = C(pal.line);
  rule.size = new Size(1, large ? 280 : 116);
  outer.addSpacer(large ? 18 : 13);

  const right = outer.addStack();
  right.layoutVertically();

  const yan = right.addText(d.wenyan || "");
  yan.font = F.bold(large ? 27 : 19); yan.textColor = C(pal.ink);
  yan.lineLimit = large ? 2 : 1; yan.minimumScaleFactor = 0.62;
  right.addSpacer(large ? 12 : 6);

  const lines = (d.quote_lines && d.quote_lines.length)
    ? d.quote_lines : [(d.quote || "").trim()];
  const quote = right.addText(lines.slice(0, large ? 8 : 4).join("\n"));
  quote.font = F.reg(large ? 16 : 13); quote.textColor = C(pal.soft);
  quote.lineLimit = large ? 9 : 4; quote.minimumScaleFactor = 0.8;

  right.addSpacer();
  if (logoImg) {
    const li = right.addImage(logoImg);
    li.imageSize = new Size(large ? 110 : 92, large ? 12 : 10); // lockup 比例 9.18
    li.tintColor = C(pal.fade);
    li.leftAlignImage();
  } else {
    const brand = right.addText("好日曆 GOODAY™");
    brand.font = F.reg(large ? 11 : 9); brand.textColor = C(pal.fade);
  }

  return w;
}

// ---------- 圖片卡模式（Parameter「卡面」/「img」啟用） ----------

async function loadCardImage(ver) {
  const fam = config.widgetFamily || "medium";
  let name = IMG_NAME[fam] || IMG_NAME.medium;
  if (isNightNow()) name = name.replace(".jpg", "_night.jpg");
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

// ---------- 鎖定畫面（iOS 16+） ----------

function accessoryWidget(d, fam) {
  const w = new ListWidget();
  w.addAccessoryWidgetBackground = true;
  if (d.ig_url) w.url = d.ig_url;
  if (fam === "accessoryInline") {
    w.addText("好日曆・" + (d.wenyan || ""));
    return w;
  }
  if (fam === "accessoryCircular") {
    const t = w.addText((d.wenyan || "宜").charAt(0));
    t.font = Font.boldSystemFont(26);
    t.centerAlignText();
    return w;
  }
  // accessoryRectangular
  w.setPadding(2, 6, 2, 6);
  const top = w.addText(`${d.display_date} ${d.weekday}` + (d.lunar ? "・" + d.lunar : ""));
  top.font = Font.mediumSystemFont(11);
  top.lineLimit = 1;
  top.minimumScaleFactor = 0.8;
  w.addSpacer(2);
  const yan = w.addText(d.wenyan || "");
  yan.font = Font.boldSystemFont(16);
  yan.lineLimit = 2;
  yan.minimumScaleFactor = 0.8;
  w.addSpacer();
  return w;
}

module.exports.run = async function () {
  const data = await loadData();
  const fam = config.widgetFamily || "";
  if (config.runsInWidget && fam.indexOf("accessory") === 0) {
    let w;
    if (data) {
      w = accessoryWidget(data, fam);
    } else {
      w = new ListWidget();
      w.addAccessoryWidgetBackground = true;
      w.addText("好日曆");
    }
    w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
    Script.setWidget(w);
    Script.complete();
    return;
  }
  if (config.runsInWidget) {
    let w;
    if (!data) {
      w = new ListWidget();
      w.backgroundColor = new Color(PAL_DAY.bg);
      const t1 = w.addText("好日曆"); t1.textColor = new Color(PAL_DAY.ink);
      const t2 = w.addText("第一次請連網路開一次");
      t2.font = Font.systemFont(11); t2.textColor = new Color(PAL_DAY.fade);
    } else {
      const p = widgetParam();
      const imgMode = p.indexOf("卡") >= 0 || p.toLowerCase().indexOf("img") >= 0;
      const useJf = p.indexOf("蘭") >= 0 || p.toLowerCase().indexOf("jf") >= 0;
      if (imgMode) {
        const img = await loadCardImage(data.updated);
        if (img) {
          w = new ListWidget();
          w.backgroundImage = img;
          w.setPadding(0, 0, 0, 0);
        } else {
          w = cardTextWidget(data, config.widgetFamily || "medium", useJf, await loadLogoImage());
        }
      } else {
        w = cardTextWidget(data, config.widgetFamily || "medium", useJf, await loadLogoImage());
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
