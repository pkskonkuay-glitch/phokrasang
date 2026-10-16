// ตรวจว่าเรื่องเริ่มต้น 14 เรื่องใน legacy-content.json อยู่ในหลังบ้าน (Sheet) ครบหรือยัง
// ใช้: node check-legacy.js   (รันในโฟลเดอร์เว็บ หลังบอต build-share สร้าง data/content.json แล้ว)
// ถ้าขึ้น "พร้อมตัด" ครบทุกเรื่อง แปลว่าเลิกพึ่ง legacy-content.json ได้อย่างปลอดภัย
const fs = require("fs");
const L = JSON.parse(fs.readFileSync("legacy-content.json", "utf8"));
let C;
try { C = JSON.parse(fs.readFileSync("data/content.json", "utf8")); } catch (e) { console.error("อ่าน data/content.json ไม่ได้ (ต้องรัน build-share ให้ได้ไฟล์นี้ก่อน):", e.message); process.exit(2); }
const items = (C && C.items) || [];
const today = new Date().toISOString().slice(0, 10);
let miss = 0, noimg = 0, noexp = 0;
console.log("ใน Sheet มีเนื้อหา " + items.length + " รายการ\n");
L.forEach(x => {
  const s = items.find(i => i.title === x.title);
  const flags = [];
  if (!s) { flags.push("❌ ยังไม่อยู่ใน Sheet"); miss++; }
  else {
    if (x.img && !s.img) { flags.push("⚠️ ไม่มีรูป (หน้าเว็บจะใช้รูปจากไฟล์เริ่มต้น ถ้าตัดไฟล์ รูปจะหาย)"); noimg++; }
    if (!s.exp && /พ่นปุ๋ย|ฝนตกหนัก|ส่งใจเชียร์|เอเชียนเกมส์/.test(x.title)) { flags.push("🕒 ข่าวชั่วคราวแต่ยังไม่ใส่วันหมดอายุ"); noexp++; }
    if (!flags.length) flags.push("✅ พร้อมตัด");
  }
  console.log(flags.join(" ") + "  " + x.title.slice(0, 50));
});
console.log("\nสรุป: ขาดใน Sheet " + miss + " | ไม่มีรูป " + noimg + " | ยังไม่ใส่วันหมดอายุ " + noexp);
console.log(miss === 0 && noimg === 0 ? "→ ตัด legacy-content.json ได้ (แจ้งให้ผมทำขั้นตอนตัด)" : "→ ยังไม่ควรตัด: แก้ตามรายการด้านบนก่อน (เพิ่มเรื่อง/รูปในหน้า admin หรือรัน importLegacyContent)");
