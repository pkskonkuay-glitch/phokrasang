/* ที่นี่โพธิ์กระสังข์ — ให้เว็บเปิดเร็วและเปิดได้แม้สัญญาณอ่อน
   เปลี่ยนเลขเวอร์ชันด้านล่างทุกครั้งที่อัปโหลดไฟล์ชุดใหม่ เพื่อให้เครื่องผู้ใช้ล้างของเก่า */
const V = "kp-2569-10-13-a";
const CORE = ["./", "index.html", "privacy.html", "manifest.webmanifest",
  "fonts/Boon-Regular.woff2", "fonts/Boon-Bold.woff2", "icons/icon-192.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;   // ข้อมูลแจ้งเหตุ/แผนที่/YouTube ไปเครือข่ายตามปกติ
  if (r.mode === "navigate") {                                      // หน้าเว็บ: ลองโหลดใหม่ก่อน ถ้าไม่มีสัญญาณใช้ของที่เก็บไว้
    e.respondWith(fetch(r).then(x => { const c = x.clone(); caches.open(V).then(k => k.put(r, c)); return x; })
      .catch(() => caches.match(r).then(m => m || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(r).then(m => {                         // ฟอนต์/รูป: ใช้ของที่เก็บไว้ทันที แล้วอัปเดตเงียบ ๆ
    const f = fetch(r).then(x => { if (x.ok) { const c = x.clone(); caches.open(V).then(k => k.put(r, c)); } return x; }).catch(() => m);
    return m || f;
  }));
});
