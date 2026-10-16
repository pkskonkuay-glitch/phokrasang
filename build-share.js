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
  try { const r = await fetch(API + "?action=" + q, { redirect: "follow" }); const j = await r.json();
    // รับเฉพาะ {ok:true, items:[...]} กันกรณี Apps Script ตอบ error เป็น JSON แล้วไปลบหน้าแชร์/ทับไฟล์สำรอง
    if (j && j.ok === true && Array.isArray(j.items)) return j;
    console.warn("ข้าม", q, "— คำตอบไม่ถูกต้อง:", JSON.stringify(j).slice(0, 120)); return null; }
  catch (e) { console.warn("ข้าม", q, e.message); return null; }
}
const list = j => Array.isArray(j) ? j : (j && (j.items || j.rows || j.data || j.events || j.products)) || [];

// เรื่องเริ่มต้นอ่านจาก legacy-content.json (ไฟล์เดียวกับที่หน้าเว็บและ importLegacyContent ใช้) ไม่ดึงจาก index.html ด้วย regex แล้ว
// รหัสเรื่องคงเดิม (n0..n8 = ข่าว, a0..a4 = วิถีกวย) เพื่อให้ลิงก์แชร์เก่า s/n0.html ใช้ได้ต่อ
function seedItems() {
  let L = [];
  try { L = JSON.parse(fs.readFileSync(path.join(__dirname, "legacy-content.json"), "utf8")); }
  catch (e) { console.warn("ไม่พบ/อ่าน legacy-content.json ไม่ได้ ข้ามเรื่องเริ่มต้น:", e.message); return []; }
  let ni = 0, ai = 0;
  return (Array.isArray(L) ? L : []).filter(x => x && x.title).map(x => ({ k: x.kind === "วิถีกวย" ? "a" + ai++ : "n" + ni++, title: x.title, sum: x.sum, img: x.img, at: x.at }));
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
  const items = seedItems(), seen = new Set(items.map(i => i.k));
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
