/**
 * vocab.gs — ระบบคำศัพท์กวย (Google Sheet แท็บ "คำศัพท์")
 * วางเป็นไฟล์ใหม่ในโปรเจกต์ KP-Backend แล้วเพิ่มบรรทัดเชื่อม 2 บรรทัดในไฟล์ รหัส.gs (ดูคู่มือ)
 *  - เว็บเรียก  ...exec?action=vocab        → คำที่แสดงต่อสาธารณะ (ไม่รวมคำที่ซ่อน)
 *  - หน้า admin เรียก adminVocabList / adminVocabSave / adminVocabDelete (ตรวจรหัสผู้ดูแลแล้วจากฟังก์ชัน admin เดิม)
 *  - vocabImport()  รันครั้งเดียว: นำคำจากไฟล์ kuy-vocab.csv บนเว็บเข้าแท็บ "คำศัพท์" (รันซ้ำได้ ไม่ซ้ำคำเดิม)
 * ใช้ตัวช่วยเดิมของระบบ: ss, P, now, cell, tstr, okUrl, folder, saveB64, cut, json
 */
const VOCAB_SHEET = "คำศัพท์", VTRASH_SHEET = "ถังขยะคำศัพท์";
const VKEYS = ["id", "cat", "emo", "th", "kuy", "ipa", "note", "img", "aud", "st", "src", "hide", "by", "upd"];
const VHEAD = ["รหัส", "หมวด", "อีโมจิ", "ความหมายไทย", "คำกวย (อักษรไทย)", "คำอ่าน/IPA", "อธิบาย",
  "ภาพ (ลิงก์ https หรือชื่อไฟล์ใน img/)", "เสียง (ลิงก์ https)", "สถานะ (ฉบับร่าง / ตรวจแล้ว)", "ที่มา", "ซ่อนจากเว็บ (พิมพ์ ใช่)", "ผู้แก้ไขล่าสุด", "อัปเดตล่าสุด"];
const VSTATUS = ["", "ฉบับร่าง", "ตรวจแล้ว"];

function vsh() {
  const b = ss(); let s = b.getSheetByName(VOCAB_SHEET);
  if (!s) {
    s = b.insertSheet(VOCAB_SHEET);
    s.getRange(1, 1, 1, VKEYS.length).setValues([VHEAD]); s.setFrozenRows(1);
    try { s.getRange(2, 1, Math.max(s.getMaxRows() - 1, 1), VKEYS.length).setNumberFormat("@"); } catch (e) {}
  }
  return s;
}
function vrows() {
  const s = vsh(), n = s.getLastRow(); if (n < 2) return [];
  return s.getRange(2, 1, n - 1, VKEYS.length).getValues().map((r, i) => { const o = { _row: i + 2 }; VKEYS.forEach((k, j) => o[k] = tstr(r[j])); return o; });
}
function vput(o) { vsh().getRange(o._row, 1, 1, VKEYS.length).setValues([VKEYS.map(k => o[k] == null ? "" : cell(o[k]))]); }
function vnextId() {
  const l = LockService.getScriptLock(); l.waitLock(15000);
  try { const n = (+P("VCOUNTER") || 0) + 1; PropertiesService.getScriptProperties().setProperty("VCOUNTER", String(n)); return String(n); }
  finally { l.releaseLock(); }
}
// แถวที่พิมพ์เองในชีตและยังไม่มีรหัส → ให้รหัสอัตโนมัติ
function vfill_(all) { all.filter(r => !r.id && r.th).forEach(r => { r.id = vnextId(); vput(r); }); return all; }
const vimgOk_ = u => /^https:\/\/\S+$/.test(u || "") || /^[\w.\-\u0E00-\u0E7F]+$/.test(u || "");
const vaudOk_ = u => /^https:\/\/\S+$/.test(u || "");
const vpub_ = r => ({ id: String(r.id), cat: r.cat, emo: r.emo, th: r.th, kuy: r.kuy, ipa: r.ipa, note: r.note,
  img: vimgOk_(r.img) ? r.img : "", aud: vaudOk_(r.aud) ? r.aud : "", st: r.st, src: r.src });
const vadm_ = r => Object.assign(vpub_(r), { hide: r.hide === "ใช่", by: r.by, upd: r.upd });

function vocabPublic() {
  return { ok: true, items: vfill_(vrows()).filter(r => r.id && r.th && r.cat && r.hide !== "ใช่").map(vpub_) };
}

function vocabAdmin(b) {
  if (b.action === "adminVocabList") {
    const all = vfill_(vrows()), cats = [], seen = {};
    all.forEach(r => { if (r.cat && !seen[r.cat]) { seen[r.cat] = 1; cats.push({ cat: r.cat, emo: r.emo }); } });
    return { ok: true, items: all.filter(r => r.id && r.th).map(vadm_), cats: cats, total: all.length };
  }
  if (b.action === "adminVocabSave") return vocabSave_(b);
  if (b.action === "adminVocabDelete") return vocabDelete_(b);
  return { ok: false, error: "unknown vocab action" };
}

function vocabSave_(b) {
  const it = b.item || {}, th = String(it.th || "").trim(), cat = String(it.cat || "").trim();
  const emo = String(it.emo || "").trim(), kuy = String(it.kuy || "").trim(), ipa = String(it.ipa || "").trim();
  const note = String(it.note || "").trim(), src = String(it.src || "").trim(), st = String(it.st || "").trim();
  if (th.length < 1 || th.length > 120) return { ok: false, error: "ความหมายไทยต้องยาว 1–120 ตัวอักษร" };
  if (cat.length < 1 || cat.length > 40) return { ok: false, error: "กรุณาใส่หมวด (ไม่เกิน 40 ตัวอักษร)" };
  if (emo.length > 8) return { ok: false, error: "อีโมจิใส่ได้ 1–2 ตัว" };
  if (kuy.length > 120 || ipa.length > 120) return { ok: false, error: "คำกวย/คำอ่านยาวเกินไป" };
  if (note.length > 600) return { ok: false, error: "คำอธิบายยาวเกินไป (ไม่เกิน 600 ตัวอักษร)" };
  if (src.length > 300) return { ok: false, error: "ที่มายาวเกินไป (ไม่เกิน 300 ตัวอักษร)" };
  if (VSTATUS.indexOf(st) < 0) return { ok: false, error: "สถานะไม่ถูกต้อง" };
  let img = String(it.img || "").trim(), aud = String(it.aud || "").trim();
  if (img && !vimgOk_(img)) return { ok: false, error: "ภาพ: ใส่ลิงก์ https หรือชื่อไฟล์ในโฟลเดอร์ img เท่านั้น" };
  if (aud && !vaudOk_(aud)) return { ok: false, error: "เสียง: ต้องเป็นลิงก์ https" };
  const l = LockService.getScriptLock(); l.waitLock(20000);
  try {
    const all = vfill_(vrows());
    const r = it.id ? all.find(x => String(x.id) === String(it.id)) : null;
    if (it.id && !r) return { ok: false, error: "ไม่พบคำที่จะแก้ไข (อาจถูกลบไปแล้ว)" };
    const dup = all.find(x => x.th === th && x.cat === cat && (!r || String(x.id) !== String(r.id)));
    if (dup && !it.force) return { ok: false, dup: true, error: "มีคำว่า “" + th + "” ในหมวด “" + cat + "” อยู่แล้ว" };
    const id = r ? String(r.id) : vnextId();
    if (b.photo) { try { img = saveB64("V" + id, 1, b.photo); } catch (x) { return { ok: false, error: String(x.message || x) }; } }
    if (b.audio && b.audio.data) { try { aud = vsaveAudio_(id, b.audio.data); } catch (x) { return { ok: false, error: String(x.message || x) }; } }
    const o = Object.assign(r || { _row: vsh().getLastRow() + 1 },
      { id: id, cat: cat, emo: emo, th: th, kuy: kuy, ipa: ipa, note: note, img: img, aud: aud, st: st, src: src,
        hide: it.hide ? "ใช่" : "", by: String(b.by || "แอดมินเว็บ").slice(0, 40), upd: now() });
    vput(o);
    return { ok: true, item: vadm_(o) };
  } finally { l.releaseLock(); }
}

// ลบ: ย้ายแถวไปแท็บ "ถังขยะคำศัพท์" ก่อน (กู้คืนได้โดยคัดลอกแถวกลับ)
function vocabDelete_(b) {
  const id = String(b.id || "").trim(); if (!id) return { ok: false, error: "ไม่ระบุรหัสคำ" };
  const l = LockService.getScriptLock(); l.waitLock(20000);
  try {
    const r = vrows().find(x => String(x.id) === id); if (!r) return { ok: false, error: "ไม่พบคำนี้ (อาจถูกลบไปแล้ว)" };
    const book = ss(); let t = book.getSheetByName(VTRASH_SHEET);
    if (!t) { t = book.insertSheet(VTRASH_SHEET); t.getRange(1, 1, 1, VKEYS.length + 2).setValues([VHEAD.concat(["ลบเมื่อ", "ลบโดย"])]); t.setFrozenRows(1); }
    t.appendRow(VKEYS.map(k => r[k] == null ? "" : cell(r[k])).concat([now(), String(b.by || "แอดมินเว็บ").slice(0, 40)]));
    vsh().deleteRow(r._row);
    return { ok: true };
  } finally { l.releaseLock(); }
}

// เก็บไฟล์เสียงที่อัปโหลดจากหน้า admin ลง Drive (โฟลเดอร์เดียวกับรูป) คืนลิงก์
function vaudioExt_(bytes) {
  const g = i => bytes[i] & 255;
  if (bytes.length > 12 && g(4) === 0x66 && g(5) === 0x74 && g(6) === 0x79 && g(7) === 0x70) return "m4a";
  if (g(0) === 0x49 && g(1) === 0x44 && g(2) === 0x33) return "mp3";
  if (g(0) === 0xFF && (g(1) & 0xE0) === 0xE0) return "mp3";
  if (g(0) === 0x4F && g(1) === 0x67 && g(2) === 0x67 && g(3) === 0x53) return "ogg";
  if (g(0) === 0x52 && g(1) === 0x49 && g(2) === 0x46 && g(3) === 0x46) return "wav";
  return "";
}
function vsaveAudio_(id, b64) {
  const bytes = Utilities.base64Decode(String(b64).replace(/^data:[^,]*,/, ""));
  if (!bytes || bytes.length < 200) throw new Error("ไฟล์เสียงว่างหรือเล็กเกินไป");
  if (bytes.length > 8 * 1024 * 1024) throw new Error("ไฟล์เสียงใหญ่เกิน 8 MB (ตัดให้สั้นลงหรือแปลงเป็น mp3)");
  const ext = vaudioExt_(bytes); if (!ext) throw new Error("รับเฉพาะไฟล์เสียง m4a, mp3, ogg, wav");
  const mime = { m4a: "audio/mp4", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav" }[ext];
  const f = folder().createFile(Utilities.newBlob(bytes, mime, "vocab-" + id + "-" + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd-HHmmss") + "." + ext));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/file/d/" + f.getId() + "/view";
}

/* ---------- นำเข้าจาก kuy-vocab.csv (รันครั้งเดียวหลังวางไฟล์นี้) ---------- */
function vcsv_(t) {
  const r = []; let w = [], f = "", q = false; t = t.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { w.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; w.push(f); f = ""; r.push(w); w = []; }
    else f += c;
  }
  if (f || w.length) { w.push(f); r.push(w); }
  return r;
}
function vocabImport() {
  const site = P("SITE_URL").trim().replace(/\/?$/, "/");
  if (!okUrl(site)) { Logger.log("SITE_URL ไม่ถูกต้อง ต้องเป็นลิงก์ https เช่น https://ชื่อ.github.io/โฟลเดอร์/"); return; }
  const res = UrlFetchApp.fetch(site + "kuy-vocab.csv?t=" + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) { Logger.log("ไม่พบไฟล์ kuy-vocab.csv บนเว็บ (รหัส " + res.getResponseCode() + ") ต้องอัปโหลดไฟล์ไว้ที่โฟลเดอร์เดียวกับ index.html ก่อน"); return; }
  const rows = vcsv_(res.getContentText()).slice(1).filter(r => r[2]);
  const have = {}; vrows().forEach(x => have[x.cat + "|" + x.th] = 1);
  const s = vsh(); const out = []; let skip = 0;
  rows.forEach(r => {
    const key = r[0] + "|" + r[2]; if (have[key]) { skip++; return; } have[key] = 1;
    const o = { id: vnextId(), cat: r[0], emo: r[1], th: r[2], kuy: r[3] || "", ipa: r[4] || "", note: r[5] || "", img: r[6] || "", aud: r[7] || "", st: r[8] || "", src: r[9] || "", hide: "", by: "นำเข้าจากไฟล์ csv", upd: now() };
    out.push(VKEYS.map(k => cell(o[k] == null ? "" : o[k])));
  });
  if (out.length) s.getRange(s.getLastRow() + 1, 1, out.length, VKEYS.length).setValues(out);
  Logger.log("นำเข้า " + out.length + " คำ (ข้าม " + skip + " คำที่มีอยู่แล้ว) จากทั้งหมด " + rows.length + " คำในไฟล์");
}
