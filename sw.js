/* ที่นี่โพธิ์กระสังข์ — ให้เว็บเปิดเร็วและเปิดได้แม้สัญญาณอ่อน
   เปลี่ยนเลขเวอร์ชันด้านล่างทุกครั้งที่อัปโหลดไฟล์ชุดใหม่ เพื่อให้เครื่องผู้ใช้ล้างของเก่า */
try { importScripts("config.js"); } catch (e) {}                    // ค่ากลาง + เลขเวอร์ชัน (build-share.js เลื่อนให้เองเมื่อไฟล์หลักเปลี่ยน)
const V = (self.KP_CONFIG && self.KP_CONFIG.version) || "kp-fallback";
const CORE = ["./", "index.html", "config.js", "vocab.html", "privacy.html", "manifest.webmanifest",
  "fonts/Boon-Regular.woff2", "fonts/Boon-Bold.woff2", "icons/icon-192.png"];
const MAX = 60;   // เก็บไฟล์ในเครื่องไม่เกินกี่รายการ (กันแคชบวมเมื่อใช้ไปนาน ๆ)
const trim = c => c.keys().then(ks => ks.length > MAX ? Promise.all(ks.slice(0, ks.length - MAX).map(k => c.delete(k))) : 0);
self.addEventListener("install", e => {
  // เก็บทีละไฟล์: ไฟล์ไหนหาไม่เจอ (ฟอนต์/ไอคอน) ข้ามไปเฉย ๆ ไม่ทำให้ติดตั้งทั้งชุดล้ม (เดิมใช้ addAll ซึ่งล้มทั้งหมดถ้าขาดไฟล์เดียว)
  e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(err => console.warn("sw: เก็บไฟล์ไม่ได้ ข้ามไป →", u, err && err.message))))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;   // ข้อมูลแจ้งเหตุ/แผนที่/YouTube ไปเครือข่ายตามปกติ
  if (u.pathname.indexOf("/s/") >= 0) return;                       // หน้าแชร์รายเรื่อง: ไปเครือข่ายเสมอ ไม่เก็บแคช
  if (/\/admin\.html$/.test(u.pathname)) return;
  if (/\/(config\.js|data\/[^/]+\.json)$/.test(u.pathname)) {          // ค่ากลาง/ข้อมูล: ลองโหลดใหม่ก่อนเสมอ (แก้ลิงก์แล้วต้องเห็นผลทันที)
    e.respondWith(fetch(r).then(x => { if (x.ok) { const c = x.clone(); caches.open(V).then(k => k.put(r, c)); } return x; }).catch(() => caches.match(r)));
    return;
  }                    // หน้าแอดมิน: ไม่เก็บแคช
  if (r.mode === "navigate") {                                      // หน้าเว็บ: ลองโหลดใหม่ก่อน ถ้าไม่มีสัญญาณใช้ของที่เก็บไว้
    const key = new Request(u.origin + u.pathname);                 // ตัด ?s=line&src=... ออก เก็บหน้าละ 1 ชุด ไม่งอกเป็นร้อยชุด
    e.respondWith(fetch(r).then(x => { if (x.ok) { const c = x.clone(); caches.open(V).then(k => k.put(key, c)); } return x; })
      .catch(() => caches.match(key).then(m => m || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(r).then(m => {                         // ฟอนต์/รูป: ใช้ของที่เก็บไว้ทันที แล้วอัปเดตเงียบ ๆ
    const f = fetch(r).then(x => { if (x.ok) { const c = x.clone(); caches.open(V).then(k => k.put(r, c).then(() => trim(k))); } return x; }).catch(() => m);
    return m || f;
  }));
});
