// ตรวจว่าเรื่องเริ่มต้น 14 เรื่องใน legacy-content.json อยู่ในหลังบ้าน (Sheet) ครบหรือยัง และลิงก์เก่าจะไม่พังเมื่อตัดไฟล์
// ใช้: node check-legacy.js   (รันในโฟลเดอร์เว็บ หลังบอต build-share สร้าง data/content.json แล้ว)
// รหัสออก: 0 = ตัด legacy-content.json ได้ | 1 = ยังไม่ควรตัด | 2 = อ่านไฟล์ที่จำเป็นไม่ได้
const fs = require("fs");
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));
let L, C, K = {};
try { L = readJson("legacy-content.json"); } catch (e) { console.error("อ่าน legacy-content.json ไม่ได้:", e.message); process.exit(2); }
try { C = readJson("data/content.json"); } catch (e) { console.error("อ่าน data/content.json ไม่ได้ (ต้องรัน build-share ให้ได้ไฟล์นี้ก่อน):", e.message); process.exit(2); }
try { K = readJson("data/legacy-keys.json"); } catch (e) { /* ไม่มีไฟล์ = รายงานเป็นปัญหาด้านล่าง */ }
const items = (C && C.items) || [];
const norm = s => String(s || "").replace(/\s+/g, " ").trim();
const titleOf = v => typeof v === "string" ? v : (v && v.title) || "";
// จับคู่กับหลังบ้านแบบเดียวกับที่หน้าเว็บทำ: ชื่อตรงกัน → "ข่าวเก่า: " + ชื่อ → ชื่อเดียวกันหลังตัดช่องว่างซ้ำ
const findInSheet = t => items.find(i => i.title === t) || items.find(i => i.title === "ข่าวเก่า: " + t) || items.find(i => norm(i.title) === norm(t) || norm(i.title) === "ข่าวเก่า: " + norm(t));
let miss = 0, noimg = 0, noexp = 0, nokey = 0, keyprob = 0, nostub = 0;
const seenKey = new Set();
console.log("ใน Sheet มีเนื้อหา " + items.length + " รายการ\n");
L.forEach(x => {
  const flags = [], k = x.legacyKey;
  // --- รหัสลิงก์ (n0/a0…) ต้องล็อกไว้ ไม่งั้นลิงก์ที่แชร์แล้วอาจชี้ผิดเรื่องเมื่อลำดับในไฟล์เปลี่ยน ---
  if (!k) { flags.push("🔑 ยังไม่มี legacyKey ในไฟล์"); nokey++; }
  else {
    if (seenKey.has(k)) { flags.push("🔑 legacyKey ซ้ำ: " + k); keyprob++; }
    seenKey.add(k);
    if (titleOf(K[k]) !== x.title) { flags.push("🔑 data/legacy-keys.json ไม่มีรหัส " + k + " หรือชื่อไม่ตรงกับไฟล์นี้"); keyprob++; }
    if (!fs.existsSync("s/" + k + ".html")) { flags.push("📄 ยังไม่มีหน้าแชร์ s/" + k + ".html (รอบอต build-share รอบถัดไป)"); nostub++; }
  }
  const s = findInSheet(x.title);
  if (!s) { flags.push("❌ ยังไม่อยู่ใน Sheet"); miss++; }
  else {
    if (x.img && !s.img) { flags.push("⚠️ ไม่มีรูป (หน้าเว็บจะใช้รูปจากไฟล์เริ่มต้น ถ้าตัดไฟล์ รูปจะหาย)"); noimg++; }
    if (!s.exp && /พ่นปุ๋ย|ฝนตกหนัก|ส่งใจเชียร์|เอเชียนเกมส์/.test(x.title)) { flags.push("🕒 ข่าวชั่วคราวแต่ยังไม่ใส่วันหมดอายุ"); noexp++; }
  }
  if (!flags.length) flags.push("✅ พร้อมตัด");
  console.log(flags.join(" ") + "  [" + (k || "-") + "] " + x.title.slice(0, 50));
});
// รหัสใน legacy-keys.json ที่ไม่มีเรื่องในไฟล์ legacy-content.json แล้ว (เช่นเคยลบเรื่องออก) — ไม่เป็นปัญหา แค่แจ้งให้ทราบ
Object.keys(K).filter(k => !seenKey.has(k)).forEach(k => console.log("ℹ️ รหัส " + k + " อยู่ใน legacy-keys.json แต่ไม่มีในไฟล์ legacy-content.json (ลิงก์เก่ายังเปิดได้ถ้าเรื่องอยู่ในหลังบ้าน)"));
console.log("\nสรุป: ขาดใน Sheet " + miss + " | ไม่มีรูป " + noimg + " | ยังไม่ใส่วันหมดอายุ " + noexp + " | ไม่มี legacyKey " + nokey + " | รหัสมีปัญหา " + keyprob + " | รอสร้างหน้าแชร์ " + nostub);
const ready = miss === 0 && noimg === 0 && nokey === 0 && keyprob === 0 && nostub === 0;
console.log(ready
  ? "→ ตัด legacy-content.json ได้ (ลิงก์เก่า n0/a0… ยังเปิดได้ผ่าน data/legacy-keys.json + เรื่องในหลังบ้าน) แจ้งให้ผมทำขั้นตอนตัด"
  : "→ ยังไม่ควรตัด: แก้ตามรายการด้านบนก่อน (เพิ่มเรื่อง/รูปในหน้า admin หรือรัน importLegacyContent)");
process.exit(ready ? 0 : 1);
