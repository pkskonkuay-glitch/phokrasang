// สร้างหน้าแชร์รายเรื่อง s/<key>.html (ภาพปก+หัวข้อ+สรุปของเรื่องนั้น) ให้ LINE/Facebook อ่านได้
// ใช้: node build-share.js   (Node 18+)
const fs = require("fs"), path = require("path"), vm = require("vm");
const crypto = require("crypto");
// ค่ากลางอ่านจาก config.js ที่เดียว (ไม่ต้องแก้ลิงก์ซ้ำในไฟล์นี้)
const CONFIG_PATH = path.join(__dirname, "config.js");
const KP = (() => { const g = {}; vm.runInNewContext(fs.readFileSync(CONFIG_PATH, "utf8"), { self: g }); return g.KP_CONFIG; })();
const BASE = KP.base, API = KP.apiUrl;
const DEFAULT_IMG = BASE + "share.png";
const SITE = "ที่นี่โพธิ์กระสังข์";
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const absImg = u => {
  if (!u) return DEFAULT_IMG;
  if (/^https:\/\//.test(u)) return u;
  if (/^(data:|http:)/.test(u)) return DEFAULT_IMG;
  u = u.replace(/^\.?\//, "");
  return BASE + (/^img\//.test(u) ? u : "img/" + u).split("/").map(encodeURIComponent).join("/");
};
async function api(q) {
  try { const r = await fetch(API + "?action=" + q, { redirect: "follow" }); const j = await r.json(); return j; }
  catch (e) { console.warn("ข้าม", q, e.message); return null; }
}
const list = j => Array.isArray(j) ? j : (j && (j.items || j.rows || j.data || j.events || j.products)) || [];

function staticItems() {
  const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const g = re => { const m = src.match(re); return m ? m[0] : ""; };
  const code = [
    "const CFG={fbUrl:'',ytList:''};",
    g(/const F=CFG\.fbUrl,P=CFG\.ytList;/),
    g(/const CC=\{.*?\};\n/s),
    g(/const N=\(.*?\n/),
    g(/const news=\[[\s\S]*?\)\];/),
    g(/const A=\(.*?\n/),
    g(/const arts=\[[\s\S]*?\)\];/),
    g(/const FI=\{.*?\};/), g(/const PH=\{.*?\};/),
    "({news,arts,FI,PH})"
  ].join("\n");
  const r = vm.runInNewContext(code, {});
  const out = [];
  r.news.forEach((o, i) => { const k = "n" + i; out.push({ k, title: o.title, sum: o.sum, img: r.PH[k] || r.FI[k] || o.img }); });
  r.arts.forEach((o, i) => { const k = "a" + i; out.push({ k, title: o.title, sum: o.sum, img: r.PH[k] || r.FI[k] || o.img }); });
  return out;
}

function page(it) {
  const title = clip(it.title, 90) + " | " + SITE;
  const desc = clip(it.sum || it.title, 200);
  const img = absImg(it.img);
  const url = BASE + "s/" + encodeURIComponent(it.k) + ".html";
  const dest = BASE + "?s=\u0000#/read/" + encodeURIComponent(it.k);
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article"><meta property="og:locale" content="th_TH"><meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(clip(it.title, 90))}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(clip(it.title, 90))}">
<meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<script>var t=(location.search.match(/[?&]s=([a-z]+)/)||[])[1]||"link";location.replace(${JSON.stringify(dest)}.replace("\\u0000",t))</script>
<noscript><meta http-equiv="refresh" content="0;url=${esc(BASE + "#/read/" + encodeURIComponent(it.k))}"></noscript>
</head><body><p><a href="${esc(BASE + "#/read/" + encodeURIComponent(it.k))}">${esc(it.title)}</a></p></body></html>
`;
}

(async () => {
  const items = staticItems(), seen = new Set(items.map(i => i.k));
  // กันกรณี regex ดึงข่าว/บทความจาก index.html พลาดหลังแก้โครงสร้าง: เทียบกับจำนวนครั้งก่อน
  try {
    const sf = path.join(__dirname, "data", "static-count.txt"), prev = parseInt(fs.readFileSync(sf, "utf8"), 10) || 0;
    if (prev && items.length < prev * 0.7) { console.error("ERROR: staticItems ลดจาก " + prev + " เหลือ " + items.length + " — โครงสร้าง index.html อาจเปลี่ยน หยุดเพื่อไม่ให้ลบหน้าแชร์"); process.exit(1); }
    fs.mkdirSync(path.dirname(sf), { recursive: true }); fs.writeFileSync(sf, String(items.length));
  } catch (_) {}
  const add = it => { if (it.k && !seen.has(it.k) && it.title) { seen.add(it.k); items.push(it); } };
  const [c, e, p, lf] = await Promise.all([api("content"), api("events"), api("products"), api("life")]);
  list(c).filter(x => x.kind !== "คลิป").forEach(x => add({ k: "c" + x.id, title: x.title, sum: x.sum, img: x.img, at: x.at }));
  list(e).forEach(x => add({ k: "ev-" + x.id, title: x.title, sum: x.sum || x.story, img: x.img }));
  list(p).forEach(x => add({ k: "p-" + x.id, title: x.title, sum: x.desc || x.story, img: x.img }));
  list(lf).forEach(x => add({ k: "lf-" + x.id, title: x.title, sum: x.sum || x.story, img: x.img }));   // วิถีชีวิตกวย (ดุงกวย/กัวออ/จาเอม)
  // ===== ข้อ 14: ส่งออกข้อมูลเป็นไฟล์นิ่ง data/*.json (หน้าเว็บใช้สำรองเมื่อ Apps Script ช้า/ล่ม) =====
  const dd = path.join(__dirname, "data"); fs.mkdirSync(dd, { recursive: true });
  const dump = (name, j) => { if (j) fs.writeFileSync(path.join(dd, name + ".json"), JSON.stringify(j)); };
  dump("content", c); dump("events", e); dump("products", p); dump("life", lf);
  dump("vocab", await api("vocab"));
  // ===== sitemap.xml =====
  const today = new Date().toISOString().slice(0, 10);
  const lm = d => { const m = String(d || "").match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : today; };
  const urls = [[BASE, today], [BASE + "vocab.html", today], [BASE + "privacy.html", today]].concat(items.map(i => [BASE + "s/" + encodeURIComponent(i.k) + ".html", lm(i.at)]));
  fs.writeFileSync(path.join(__dirname, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(u => "<url><loc>" + esc(u[0]) + "</loc><lastmod>" + u[1] + "</lastmod></url>").join("\n") + "\n</urlset>\n");
  fs.writeFileSync(path.join(__dirname, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: " + BASE + "sitemap.xml\n");
  // ===== เลื่อนเลขเวอร์ชันของ service worker อัตโนมัติ เมื่อไฟล์หลักเปลี่ยน =====
  const h = crypto.createHash("sha1");
  ["index.html", "vocab.html", "privacy.html", "sw.js", "manifest.webmanifest"].forEach(f => { try { h.update(fs.readFileSync(path.join(__dirname, f))); } catch (_) {} });
  const ver = "kp-" + h.digest("hex").slice(0, 8);
  let cf = fs.readFileSync(CONFIG_PATH, "utf8");
  if (!cf.includes('version: "' + ver + '"')) { cf = cf.replace(/version:\s*"[^"]*"/, 'version: "' + ver + '"'); fs.writeFileSync(CONFIG_PATH, cf); console.log("เลื่อนเวอร์ชัน → " + ver); }
  const dir = path.join(__dirname, "s"); fs.mkdirSync(dir, { recursive: true });
  const keep = new Set(items.map(i => i.k + ".html"));
  // ลบหน้าที่ไม่มีในข้อมูลแล้ว "เฉพาะกลุ่มที่ดึงข้อมูลสำเร็จรอบนี้" (กลุ่มไหนดึงไม่ได้ เก็บหน้าเก่าของกลุ่มนั้นไว้ ไม่ลบมั่ว)
  const okGroup = f => f.startsWith("ev-") ? !!e : f.startsWith("p-") ? !!p : f.startsWith("lf-") ? !!lf : f.startsWith("c") ? !!c : false;
  fs.readdirSync(dir).filter(f => f.endsWith(".html") && !keep.has(f) && okGroup(f)).forEach(f => fs.unlinkSync(path.join(dir, f)));
  items.forEach(it => fs.writeFileSync(path.join(dir, it.k + ".html"), page(it)));
  console.log("สร้างหน้าแชร์ " + items.length + " เรื่อง");
})();
