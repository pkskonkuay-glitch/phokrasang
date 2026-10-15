// สร้างหน้าแชร์รายเรื่อง s/<key>.html (ภาพปก+หัวข้อ+สรุปของเรื่องนั้น) ให้ LINE/Facebook อ่านได้
// ใช้: node build-share.js   (Node 18+)
const fs = require("fs"), path = require("path"), vm = require("vm");
const BASE = "https://pkskonkuay-glitch.github.io/phokrasang/";
const API = "https://script.google.com/macros/s/AKfycbwVYSnBo5ArYjcj-C2Noh7YuS6fcNOGaq-WRi3IbVPi7Jw8-6usFshzZS6qNE58JWXE1w/exec";
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
  const add = it => { if (it.k && !seen.has(it.k) && it.title) { seen.add(it.k); items.push(it); } };
  const [c, e, p] = await Promise.all([api("content"), api("events"), api("products")]);
  list(c).forEach(x => add({ k: "c" + x.id, title: x.title, sum: x.sum, img: x.img }));
  list(e).forEach(x => add({ k: "ev-" + x.id, title: x.title, sum: x.sum || x.story, img: x.img }));
  list(p).forEach(x => add({ k: "p-" + x.id, title: x.title, sum: x.desc || x.story, img: x.img }));
  const dir = path.join(__dirname, "s"); fs.mkdirSync(dir, { recursive: true });
  const keep = new Set(items.map(i => i.k + ".html"));
  const dyn = c || e || p;   // ถ้าดึงข้อมูลไม่ได้เลย ไม่ลบไฟล์เก่า
  if (dyn) fs.readdirSync(dir).filter(f => f.endsWith(".html") && !keep.has(f)).forEach(f => fs.unlinkSync(path.join(dir, f)));
  items.forEach(it => fs.writeFileSync(path.join(dir, it.k + ".html"), page(it)));
  console.log("สร้างหน้าแชร์ " + items.length + " เรื่อง");
})();
