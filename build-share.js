// สร้างหน้าแชร์รายเรื่อง s/<key>.html (ภาพปก+หัวข้อ+สรุปของเรื่องนั้น) ให้ LINE/Facebook อ่านได้
// ใช้: node build-share.js   (Node 18+)
// รหัสออก: 0 = ปกติ | 3 = ดึงข้อมูลบางส่วนไม่ได้ต่อเนื่องเกิน STALE_H ชั่วโมง (ไฟล์ที่ได้ยังถูกบันทึก แต่ให้ Action แจ้งเตือน) | อื่น ๆ = สคริปต์พัง
const fs = require("fs"), path = require("path"), vm = require("vm");
const crypto = require("crypto");
// ค่ากลางอ่านจาก config.js ที่เดียว (ไม่ต้องแก้ลิงก์ซ้ำในไฟล์นี้)
const CONFIG_PATH = path.join(__dirname, "config.js");
const KP = (() => { const g = {}; vm.runInNewContext(fs.readFileSync(CONFIG_PATH, "utf8"), { self: g }); return g.KP_CONFIG; })();
const BASE = KP.base, API = KP.apiUrl;
const DEFAULT_IMG = BASE + "share.png";
const SITE = "ที่นี่โพธิ์กระสังข์";
const STALE_H = 6;       // ดึงข้อมูลกลุ่มใดไม่ได้ต่อเนื่องเกินกี่ชั่วโมง ถึงให้ build ขึ้นสีแดง (กันเตือนถี่จากอาการสะดุดชั่วคราวของ Apps Script)
const HEARTBEAT_H = 6;   // ไฟล์ data/_status.json เขียนใหม่เมื่อสถานะเปลี่ยน หรืออย่างน้อยทุกกี่ชั่วโมง (ไม่เขียนทุก 30 นาที จะได้ไม่เกิด commit รัว ๆ)
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
// แฮชสั้นจากชื่อเรื่อง ใช้ตั้งรหัสให้เรื่องเริ่มต้นที่ยังไม่มี legacyKey (ต้องเหมือน H36 ใน index.html ทุกตัวอักษร)
const hash36 = s => { let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(36); };
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

// ===== รหัสเรื่องเริ่มต้น (n0..n8 = ข่าว, a0..a4 = วิถีกวย) =====
// เดิมตั้งรหัสตามลำดับในไฟล์ ถ้าสลับ/ลบเรื่อง ลิงก์ที่แชร์ไปแล้วจะชี้ผิดเรื่อง ตอนนี้ล็อกรหัสไว้ 2 ที่:
//   1) legacy-content.json: ช่อง legacyKey ของแต่ละเรื่อง
//   2) data/legacy-keys.json: แผนที่ รหัส → ชื่อเรื่อง ที่อยู่ถาวร แม้ตัด legacy-content.json ทิ้งแล้ว ลิงก์เก่ายังใช้ได้
const readJson = (...p) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, ...p), "utf8")); } catch (e) { return null; } };
const titleOf = v => typeof v === "string" ? v : (v && v.title) || "";
// ชื่อสำรอง (alt): ชื่อเรื่องที่แก้ในหน้า admin แล้ว ให้รหัสเก่า n0/a0… ยังหาเรื่องเจอทั้งชื่อเดิมและชื่อใหม่
const altsOf = v => (v && Array.isArray(v.alt)) ? v.alt.filter(Boolean) : [];
function seedItems() {
  const L = readJson("legacy-content.json");
  if (!Array.isArray(L)) { console.warn("ไม่พบ/อ่าน legacy-content.json ไม่ได้ ใช้เฉพาะแผนที่รหัสใน data/legacy-keys.json"); return []; }
  return L.filter(x => x && x.title).map(x => ({ k: x.legacyKey || "l-" + hash36(x.title), title: x.title, sum: x.sum, img: x.img, at: x.at }));
}
// รหัสใน legacy-keys.json ที่ยังไม่มีในรายการ (เพราะตัด legacy-content.json แล้ว) → หาเรื่องจากหลังบ้านด้วยชื่อ แล้วสร้างหน้าแชร์รหัสเดิมต่อ
function keyedFromContent(have, contentItems) {
  const K = readJson("data", "legacy-keys.json") || {}, out = [];
  Object.keys(K).forEach(k => {
    if (have.has(k)) return;
    const t = titleOf(K[k]); if (!t) return;
    const ts = [t, ...altsOf(K[k])];
    const x = contentItems.find(i => ts.some(z => i.title === z || i.title === "ข่าวเก่า: " + z));
    if (x) out.push({ k, title: x.title, sum: x.sum, img: x.img, at: x.at });
  });
  return out;
}

function page(it) {
  const title = clip(it.title, 90) + " | " + SITE;
  const desc = clip(it.sum || it.title, 200);
  const img = absImg(it.img);
  const url = BASE + "s/" + encodeURIComponent(it.k) + ".html";
  const read = BASE + "#/read/" + encodeURIComponent(it.k);
  const dest = BASE + "?s=\u0000#/read/" + encodeURIComponent(it.k);
  const date = (String(it.at || "").match(/^\d{4}-\d{2}-\d{2}/) || [])[0];
  // ข้อมูลโครงสร้างบทความ ให้ Google เข้าใจว่าหน้านี้คือเรื่องอะไร (หน้านี้ยังเด้งไปเว็บหลักสำหรับคนทั่วไป จึงไม่รับประกันอันดับ)
  const org = { "@type": "Organization", name: SITE, url: BASE, logo: { "@type": "ImageObject", url: BASE + "icons/icon-512.png" } };
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: clip(it.title, 110), description: desc, image: [img],
    inLanguage: "th", isAccessibleForFree: true, mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: SITE, url: BASE }, publisher: org };
  if (date) { ld.datePublished = date; ld.dateModified = date; }
  const ldJson = JSON.stringify(ld).replace(/</g, "\\u003c");
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
<script type="application/ld+json">${ldJson}</script>
<script>var t=(location.search.match(/[?&]s=([a-z]+)/)||[])[1]||"link";location.replace(${JSON.stringify(dest)}.replace("\\u0000",t))</script>
<noscript><meta http-equiv="refresh" content="0;url=${esc(read)}"></noscript>
</head><body style="font:18px/1.7 system-ui,sans-serif;max-width:640px;margin:0 auto;padding:16px">
<p><a href="${esc(BASE)}">${SITE}</a></p>
<h1 style="font-size:26px;line-height:1.35">${esc(it.title)}</h1>
<p><img src="${esc(img)}" alt="${esc(clip(it.title, 90))}" style="max-width:100%;height:auto;border-radius:12px"></p>
<p>${esc(desc)}</p>
<p><a href="${esc(read)}">อ่านเรื่องเต็มที่เว็บ ${SITE}</a></p>
</body></html>
`;
}

(async () => {
  const dd = path.join(__dirname, "data"); fs.mkdirSync(dd, { recursive: true });
  const [c, e, p, lf, v] = await Promise.all([api("content"), api("events"), api("products"), api("life"), api("vocab")]);
  const got = { content: c, events: e, products: p, life: lf, vocab: v };
  const names = Object.keys(got), failed = names.filter(k => !got[k]);

  // ===== สถานะการดึงข้อมูล → data/_status.json (หน้า admin อ่านไปแสดงว่า "ไฟล์สำรองเช็กล่าสุดเมื่อไร / กลุ่มไหนดึงไม่ได้") =====
  const sp = path.join(dd, "_status.json"), prev = readJson("data", "_status.json") || {};
  const nowIso = new Date().toISOString();
  const failedSince = {}; failed.forEach(k => { failedSince[k] = (prev.failedSince && prev.failedSince[k]) || nowIso; });
  const counts = {}; names.forEach(k => { counts[k] = got[k] ? list(got[k]).length : (prev.counts && prev.counts[k] != null ? prev.counts[k] : null); });
  const sig = JSON.stringify([failed, failedSince, counts]), psig = JSON.stringify([prev.failed || [], prev.failedSince || {}, prev.counts || {}]);
  const age = prev.generatedAt ? Date.now() - Date.parse(prev.generatedAt) : Infinity;
  if (sig !== psig || !(age < HEARTBEAT_H * 36e5)) fs.writeFileSync(sp, JSON.stringify({ generatedAt: nowIso, failed, failedSince, counts }));
  const stale = failed.filter(k => Date.now() - Date.parse(failedSince[k]) > STALE_H * 36e5);
  const finish = () => { if (stale.length) { console.error("⚠️ ดึงข้อมูลกลุ่ม [" + stale.join(", ") + "] ไม่ได้ต่อเนื่องเกิน " + STALE_H + " ชั่วโมง — ไฟล์ data/ ของกลุ่มนี้อาจเก่า ตรวจ Apps Script (Deploy → Manage deployments) ตาม RECOVERY.md"); process.exitCode = 3; } };
  if (failed.length === names.length) {
    // Apps Script ล่มทั้งหมด: ไม่แตะหน้าแชร์/sitemap/ไฟล์สำรอง (ไม่งั้น sitemap จะเหลือแต่เรื่องเริ่มต้น) แล้วรอรอบถัดไป
    console.error("❌ ดึงข้อมูลจาก Apps Script ไม่ได้เลยสักกลุ่ม (" + failed.join(", ") + ") ข้ามรอบนี้ ไม่แก้ไฟล์อื่น");
    return finish();
  }
  if (failed.length) console.warn("ดึงไม่ได้รอบนี้ (ใช้ไฟล์เดิมต่อ): " + failed.join(", "));

  // กลุ่มที่ดึงไม่ได้รอบนี้ → ใช้ data/<กลุ่ม>.json เดิมสร้าง sitemap/หน้าแชร์ต่อ (ไม่ให้ URL หายจาก sitemap)
  const c2 = c || readJson("data", "content.json"), e2 = e || readJson("data", "events.json"), p2 = p || readJson("data", "products.json"), lf2 = lf || readJson("data", "life.json");
  const items = seedItems(), seen = new Set(items.map(i => i.k));
  { // เรื่องเริ่มต้นที่แก้ชื่อในหน้า admin แล้ว: หน้าแชร์ใช้ชื่อ/สรุป/รูปล่าสุดจากหลังบ้าน (จับคู่ด้วยชื่อเดิมหรือชื่อสำรอง)
    const K0 = readJson("data", "legacy-keys.json") || {};
    items.forEach(i => { const ts = [i.title, ...altsOf(K0[i.k])]; const x = list(c2).find(c => ts.some(z => c.title === z || c.title === "ข่าวเก่า: " + z)); if (x) { i.title = x.title; i.sum = x.sum || i.sum; i.img = x.img || i.img; } });
  }
  const add = it => { if (it.k && !seen.has(it.k) && it.title) { seen.add(it.k); items.push(it); } };
  keyedFromContent(seen, list(c2)).forEach(add);   // รหัสเก่า (n0/a0…) ที่เรื่องย้ายไปอยู่หลังบ้านแล้ว
  list(c2).filter(x => x.kind !== "คลิป").forEach(x => add({ k: "c" + x.id, title: x.title, sum: x.sum, img: x.img, at: x.at }));
  list(e2).forEach(x => add({ k: "ev-" + x.id, title: x.title, sum: x.sum || x.story, img: x.img }));
  list(p2).forEach(x => add({ k: "p-" + x.id, title: x.title, sum: x.desc || x.story, img: x.img }));
  list(lf2).forEach(x => add({ k: "lf-" + x.id, title: x.title, sum: x.sum || x.story, img: x.img }));   // วิถีชีวิตกวย (ดุงกวย/กัวออ/จาเอม)
  // ===== ข้อ 14: ส่งออกข้อมูลเป็นไฟล์นิ่ง data/*.json (หน้าเว็บใช้สำรองเมื่อ Apps Script ช้า/ล่ม) =====
  const dump = (name, j) => { if (j) fs.writeFileSync(path.join(dd, name + ".json"), JSON.stringify(j)); };
  names.forEach(k => dump(k, got[k]));
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
  const VER_PATH = path.join(__dirname, "version.js");   // แยกจาก config.js เพื่อไม่ให้บอตกับคนแก้ไฟล์เดียวกันชนกัน
  let curVer = ""; try { curVer = fs.readFileSync(VER_PATH, "utf8"); } catch (_) {}
  if (!curVer.includes('"' + ver + '"')) {
    fs.writeFileSync(VER_PATH, '/* version.js — เลขเวอร์ชันแคชของ service worker บอต build-share เขียนไฟล์นี้เองเมื่อไฟล์หลักเปลี่ยน ห้ามแก้เอง */\nself.KP_VERSION = "' + ver + '";\n');
    console.log("เลื่อนเวอร์ชัน → " + ver);
  }
  const dir = path.join(__dirname, "s"); fs.mkdirSync(dir, { recursive: true });
  const keep = new Set(items.map(i => i.k + ".html"));
  // ลบหน้าที่ไม่มีในข้อมูลแล้ว "เฉพาะกลุ่มที่ดึงข้อมูลสำเร็จรอบนี้" (กลุ่มไหนดึงไม่ได้ เก็บหน้าเก่าของกลุ่มนั้นไว้ ไม่ลบมั่ว)
  // หน้ารหัสเรื่องเริ่มต้น (n*/a*/l-*) ไม่ถูกลบเลย เพราะลิงก์ที่แชร์ไปแล้วต้องเปิดได้ตลอด
  const okGroup = f => f.startsWith("ev-") ? !!e : f.startsWith("p-") ? !!p : f.startsWith("lf-") ? !!lf : /^c\d/.test(f) ? !!c : false;
  fs.readdirSync(dir).filter(f => f.endsWith(".html") && !keep.has(f) && okGroup(f)).forEach(f => fs.unlinkSync(path.join(dir, f)));
  items.forEach(it => fs.writeFileSync(path.join(dir, it.k + ".html"), page(it)));
  console.log("สร้างหน้าแชร์ " + items.length + " เรื่อง");
  finish();
})();
