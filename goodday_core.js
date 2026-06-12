// 好日曆 widget core —— 由 loader 自動抓最新版執行。
// 預設「文字模式」：手機原生渲染（銳利），仿日曆卡排版（左日期欄＋分隔線＋文眼＋呼吸分行內文＋農曆節氣
// ＋右緣 GOODAY 直排浮水印＋好日曆中文字標），21:00–05:00 自動換深色暖燭配色。
// 右上角小天氣：手機端定位 + open-meteo（免金鑰），30 分鐘快取；抓不到就不顯示。
// 點磚 → 直接開 IG 當天最新主文。
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
  bg: "#F4EFE5", ink: "#2E2C28", soft: "#4A463E", fade: "#8A8578", line: "#3E3C36", wm: "#D8D3C6",
};
const PAL_NIGHT = {
  bg: "#2B2824", ink: "#EDE4D2", soft: "#C9BCA4", fade: "#877E6C", line: "#A89C85", wm: "#3C3832",
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

// 靜態資產 cache-first：抓過一次就用本地（更新時改檔名）
async function loadAsset(name) {
  const path = fm.joinPath(dir, name);
  if (fm.fileExists(path)) {
    try { return fm.readImage(path); } catch (e) {}
  }
  try {
    const req = new Request(BASE + name);
    req.timeoutInterval = 6;
    const img = await req.loadImage();
    if (img) { fm.writeImage(path, img); return img; }
  } catch (e) {}
  return null;
}

// ---------- 天氣（手機本地） ----------

const WX_SYMBOL = {
  0: "sun.max", 1: "sun.max", 2: "cloud.sun", 3: "cloud",
  45: "cloud.fog", 48: "cloud.fog",
  51: "cloud.drizzle", 53: "cloud.drizzle", 55: "cloud.drizzle",
  56: "cloud.sleet", 57: "cloud.sleet",
  61: "cloud.rain", 63: "cloud.rain", 65: "cloud.heavyrain",
  66: "cloud.sleet", 67: "cloud.sleet",
  71: "cloud.snow", 73: "cloud.snow", 75: "cloud.snow", 77: "cloud.snow",
  80: "cloud.rain", 81: "cloud.rain", 82: "cloud.heavyrain",
  85: "cloud.snow", 86: "cloud.snow",
  95: "cloud.bolt", 96: "cloud.bolt.rain", 99: "cloud.bolt.rain",
};

function wxSymbolName(code) {
  let s = WX_SYMBOL[code] || "cloud";
  if (isNightNow() && (code === 0 || code === 1)) s = "moon.stars";
  return s;
}

const wxPath = fm.joinPath(dir, "weather.json");
const locPath = fm.joinPath(dir, "location.json");

function readJSON(path) {
  try {
    if (fm.fileExists(path)) return JSON.parse(fm.readString(path));
  } catch (e) {}
  return null;
}

// 把可能卡死的 promise 包上時限（定位被拒時 Location.current() 會 hang 不返回）
function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let done = false;
    Timer.schedule(ms, false, () => { if (!done) { done = true; resolve(null); } });
    promise.then((v) => { if (!done) { done = true; resolve(v); } })
      .catch(() => { if (!done) { done = true; resolve(null); } });
  });
}

async function fetchWeatherByCoords(lat, lon, timeoutSec) {
  const u = "https://api.open-meteo.com/v1/forecast?latitude=" + lat.toFixed(3)
    + "&longitude=" + lon.toFixed(3) + "&current=temperature_2m,weather_code&timezone=auto";
  const req = new Request(u);
  req.timeoutInterval = timeoutSec;
  const j = await req.loadJSON();
  const c = {
    ts: Date.now(),
    temp: Math.round(j.current.temperature_2m),
    code: j.current.weather_code,
  };
  fm.writeString(wxPath, JSON.stringify(c));
  return c;
}

// widget 專用：⚠️ 絕不呼叫定位（widget 內定位會 hang 到 script timeout）。
// 用 App 內檢測存下的座標查天氣；沒做過檢測 → 不顯示天氣。
async function loadWeatherWidget() {
  const c = readJSON(wxPath);
  if (c && Date.now() - c.ts < 30 * 60 * 1000) return c; // 30 分鐘快取
  const loc = readJSON(locPath);
  if (!loc) return c;
  try { return await fetchWeatherByCoords(loc.lat, loc.lon, 4); } catch (e) {}
  return c; // 過期快取也比沒有好
}

// App 內手動執行的自我檢測：唯一會要定位的地方（首次觸發 iOS 權限詢問），座標存給 widget 用
async function weatherSelfTest() {
  Location.setAccuracyToKilometer();
  const loc = await withTimeout(Location.current(), 12000);
  if (!loc) {
    return {
      ok: false,
      msg: "定位逾時或被拒（12 秒內拿不到）。請檢查：設定 → 隱私權與安全性 → 定位服務 → 最上面總開關要開 → 列表找 Scriptable → 改「使用 App 期間」。改完把 Scriptable 滑掉重開、再跑一次。",
    };
  }
  fm.writeString(locPath, JSON.stringify({ lat: loc.latitude, lon: loc.longitude, ts: Date.now() }));
  try {
    const c = await fetchWeatherByCoords(loc.latitude, loc.longitude, 8);
    return { ok: true, msg: "定位＋天氣都正常：現在 " + c.temp + "°（" + wxSymbolName(c.code) + "）。\n磚面右上角下次刷新就會顯示；換城市時再跑一次本檢測即可更新定位。" };
  } catch (e) {
    return { ok: false, msg: "定位成功，但天氣服務連不上，widget 稍後會自動再試。\n(" + e + ")" };
  }
}

function addWeatherRow(w, wx, colorHex, pt) {
  if (!wx) return;
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.addSpacer();
  const sym = SFSymbol.named(wxSymbolName(wx.code));
  sym.applyFont(Font.systemFont(pt));
  const ic = row.addImage(sym.image);
  ic.imageSize = new Size(pt + 2, pt + 2);
  ic.tintColor = new Color(colorHex);
  row.addSpacer(3);
  const t = row.addText(String(wx.temp) + "°");
  t.font = Font.mediumSystemFont(pt - 1);
  t.textColor = new Color(colorHex);
}

// ---------- 文字模式（預設） ----------

function makeFonts(useJf) {
  // 字體名不存在時 Scriptable 自動退系統字型，不會壞
  return {
    bold: (s) => new Font(useJf ? "jf-lanyangming-1.0-SemiBold" : "STSongti-TC-Bold", s),
    reg: (s) => new Font(useJf ? "jf-lanyangming-1.0-Book" : "STSongti-TC-Regular", s),
  };
}

function cardTextWidget(d, fam, useJf, assets) {
  const night = isNightNow();
  const pal = night ? PAL_NIGHT : PAL_DAY;
  const F = makeFonts(useJf);
  const C = (hex) => new Color(hex);
  const large = fam === "large";

  const w = new ListWidget();
  w.backgroundColor = C(pal.bg);

  if (fam === "small") {
    w.setPadding(10, 12, 12, 12);
    addWeatherRow(w, assets.wx, pal.fade, 10);
    w.addSpacer(2);
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

  // medium / large：左日期欄 ＋ 分隔線（偏左） ＋ 右文眼內文 ＋ 右緣浮水印
  w.setPadding(large ? 12 : 8, 16, large ? 16 : 10, 10);
  addWeatherRow(w, assets.wx, pal.fade, large ? 12 : 11);
  w.addSpacer();
  const outer = w.addStack();
  outer.layoutHorizontally();
  outer.centerAlignContent();

  const colW = large ? 92 : 78;
  const left = outer.addStack();
  left.layoutVertically();
  left.size = new Size(colW, 0);

  const ym = left.addText(`${(d.date || "").slice(0, 4)} 年 ${(d.date || "").slice(5, 7)} 月`);
  ym.font = F.reg(large ? 12 : 10); ym.textColor = C(pal.ink); ym.centerAlignText();
  ym.lineLimit = 1; ym.minimumScaleFactor = 0.75;
  left.addSpacer(large ? 8 : 4);
  const day = left.addText(String(parseInt((d.date || "--").slice(8, 10), 10) || ""));
  day.font = F.bold(large ? 54 : 40); day.textColor = C(pal.ink); day.centerAlignText();
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

  outer.addSpacer(large ? 14 : 10);
  const rule = outer.addStack();
  rule.backgroundColor = C(pal.line);
  rule.size = new Size(1, large ? 280 : 116);
  outer.addSpacer(large ? 20 : 16);

  const right = outer.addStack();
  right.layoutVertically();

  const yan = right.addText(d.wenyan || "");
  yan.font = F.bold(large ? 27 : 19); yan.textColor = C(pal.ink);
  yan.lineLimit = large ? 2 : 1; yan.minimumScaleFactor = 0.62;
  right.addSpacer(large ? 12 : 6);

  const lines = (d.quote_lines && d.quote_lines.length)
    ? d.quote_lines : [(d.quote || "").trim()];
  const quote = right.addText(lines.slice(0, large ? 8 : 4).join("\n"));
  quote.font = F.reg(large ? 16 : 12); quote.textColor = C(pal.soft);
  quote.lineLimit = large ? 9 : 4; quote.minimumScaleFactor = 0.8;

  // 好日曆中文字標：與內文拉開距離（再往下移）
  right.addSpacer(large ? 26 : 18);
  if (assets.logo) {
    const li = right.addImage(assets.logo);
    li.imageSize = new Size(large ? 41 : 34, large ? 12 : 10); // 中文字標比例 3.40
    li.tintColor = C(pal.fade);
    li.leftAlignImage();
  } else {
    const brand = right.addText("好日曆");
    brand.font = F.reg(large ? 11 : 9); brand.textColor = C(pal.fade);
  }

  // 右緣 GOODAY 直排浮水印（官方英文字標）
  outer.addSpacer();
  if (assets.wm) {
    const wm = outer.addImage(assets.wm);
    wm.imageSize = large ? new Size(34, 262) : new Size(16, 123); // 條比例 0.13
    wm.tintColor = C(pal.wm);
  }

  w.addSpacer();
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
      const wx = await loadWeatherWidget();
      if (imgMode) {
        const img = await loadCardImage(data.updated);
        if (img) {
          w = new ListWidget();
          w.backgroundImage = img;
          w.setPadding(10, 12, 10, 12);
          // 天氣是手機端資訊，疊在卡面右上角
          addWeatherRow(w, wx, isNightNow() ? PAL_NIGHT.fade : PAL_DAY.fade,
                        (config.widgetFamily === "large") ? 12 : 11);
          w.addSpacer();
        } else {
          const assets = { wx, logo: await loadAsset("goodday_logo_zh.png"), wm: await loadAsset("goodday_wm.png") };
          w = cardTextWidget(data, config.widgetFamily || "medium", useJf, assets);
        }
      } else {
        const assets = { wx, logo: await loadAsset("goodday_logo_zh.png"), wm: await loadAsset("goodday_wm.png") };
        w = cardTextWidget(data, config.widgetFamily || "medium", useJf, assets);
      }
      if (data.ig_url) w.url = data.ig_url; // 點磚直接開 IG 主文
    }
    w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
    Script.setWidget(w);
    Script.complete();
    return;
  }
  // 在 App 內手動執行：先做天氣自我檢測（首次觸發定位權限詢問）→ 再選擇開 IG 主文
  const t = await weatherSelfTest();
  const a = new Alert();
  a.title = t.ok ? "天氣功能正常 ✓" : "天氣還不能用";
  a.message = t.msg;
  if (data && data.ig_url) a.addAction("開今天的主文");
  a.addCancelAction("關閉");
  const idx = await a.presentAlert();
  if (idx === 0 && data && data.ig_url) Safari.open(data.ig_url);
  Script.complete();
};
