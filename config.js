/* config.js — ไฟล์ตั้งค่ากลางของ "ที่นี่โพธิ์กระสังข์"
   แก้ค่าที่นี่ที่เดียว index.html / admin.html / vocab.html / sw.js / build-share.js อ่านจากไฟล์นี้
   ห้ามใส่รหัสลับ (ADMIN_TOKEN, LINE_TOKEN) ในไฟล์นี้ เพราะทุกคนเปิดอ่านได้
   เลขเวอร์ชันของ service worker อยู่ที่ version.js (บอต build-share เขียนให้ ไม่ต้องแก้ และไม่อยู่ในไฟล์นี้แล้ว) */
(function (g) {
  g.KP_CONFIG = {
    base: "https://pkskonkuay-glitch.github.io/phokrasang/",
    apiUrl: "https://script.google.com/macros/s/AKfycbwVYSnBo5ArYjcj-C2Noh7YuS6fcNOGaq-WRi3IbVPi7Jw8-6usFshzZS6qNE58JWXE1w/exec",
    lineId: "@825crkiu",
    lineUrl: "https://line.me/R/ti/p/%40825crkiu",
    fbUrl: "https://www.facebook.com/kuayphokrasang",
    ytList: "https://www.youtube.com/playlist?list=PLcx0VcPxAS-YBE3kPqCb6frGimv_bNlaS",
    ytFirst: "https://www.youtube.com/watch?v=ySVkiyR5XGM&list=PLcx0VcPxAS-YBE3kPqCb6frGimv_bNlaS",
    email: "pkskonkuay@gmail.com",
    gc: "kuayphokrasang",
    heroLock: "n0"   /* รหัสเรื่องที่ล็อกไว้ช่องที่ 6 ของหน้าแรก n0 = เรื่อง 250 ล้านบาท ตั้งเป็น "" เมื่อไม่ต้องการล็อก */
  };
})(typeof self !== "undefined" ? self : this);

/* KP_GEO — ค้นหาชื่อสถานที่ → พิกัด ใช้ร่วมกันทั้ง index.html (แจ้งเหตุปักหมุด) และ admin.html (ใส่ตำแหน่งในเนื้อหา)
   ค้นพร้อมกัน 2 แหล่งข้อมูลเปิด (OpenStreetMap Nominatim + Photon) แล้วรวมผล เรียงตามชื่อที่ตรง และใกล้จุดกึ่งกลางแผนที่ ไม่ต้องมีรหัส/คีย์ */
(function (g) {
  function jget(u) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, 9000);
    return fetch(u, { signal: c.signal }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error("http"); return r.json(); },
      function (e) { clearTimeout(t); throw e; });
  }
  function nom(q, near) {
    var u = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=th,kh&accept-language=th&q=" + encodeURIComponent(q);
    if (near) u += "&viewbox=" + [near.lng - 1.2, near.lat + 1.2, near.lng + 1.2, near.lat - 1.2].join(",");
    return jget(u).then(function (L) {
      return (L || []).map(function (x) {
        var p = String(x.display_name || "").split(",");
        return { name: String(x.name || p[0] || "").trim(), label: p.slice(0, 3).join(", ").trim(), lat: +x.lat, lon: +x.lon };
      });
    });
  }
  function pho(q, near) {
    var u = "https://photon.komoot.io/api/?limit=8&q=" + encodeURIComponent(q);
    if (near) u += "&lat=" + near.lat + "&lon=" + near.lng;
    return jget(u).then(function (j) {
      return ((j && j.features) || []).map(function (f) {
        var p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
        return { name: String(p.name || "").trim(), label: [p.name, p.district || p.locality, p.county, p.state].filter(Boolean).join(", "), lat: +c[1], lon: +c[0] };
      });
    });
  }
  function dm(a, b, c, d) {
    var x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180 * Math.cos(a * Math.PI / 180);
    return Math.sqrt(x * x + y * y) * 6371000;
  }
  function one(q, near) {
    var fail = 0, w = function (p) { return p.then(function (x) { return x; }, function () { fail++; return []; }); };
    return Promise.all([w(nom(q, near)), w(pho(q, near))]).then(function (a) { return { list: a[0].concat(a[1]), fail: fail }; });
  }
  function search(q, near) {
    q = String(q || "").replace(/\s+/g, " ").trim();
    var core = q.replace(/^(น้ำตก|วัด|โรงเรียน|โรงพยาบาล|บ้าน|ตำบล|อำเภอ|ถนน|ต\.|อ\.|ถ\.)\s*/, "").trim();
    return one(q, near).then(function (r) {
      if (r.list.length || !core || core === q) return r;
      return one(core, near);
    }).then(function (r) {
      var out = [];
      r.list.forEach(function (x) {
        if (!(x.lat > 4 && x.lat < 22 && x.lon > 96 && x.lon < 107)) return;
        if (out.some(function (y) { return dm(x.lat, x.lon, y.lat, y.lon) < 120; })) return;
        out.push(x);
      });
      out.forEach(function (x) {
        x.hit = (x.name && (x.name.indexOf(q) >= 0 || q.indexOf(x.name) >= 0)) ? 0 : 1;
        x.d = near ? dm(near.lat, near.lng, x.lat, x.lon) : 0;
      });
      out.sort(function (a, b) { return a.hit - b.hit || a.d - b.d; });
      if (!out.length && r.fail >= 2) throw new Error("offline");
      return out;
    });
  }
  g.KP_GEO = { search: search };
})(typeof self !== "undefined" ? self : this);

/* KP_VCAT_OLD — ตารางแปลงชื่อหมวดคำศัพท์ชุดเก่า (59 หมวด และ 5 หมวดที่ยุบรวมในรอบ v14) → ชื่อหมวดปัจจุบัน (35 หมวด)
   ใช้กับค่า “หมวดในหน้าคำศัพท์” (vcat) และ “| ชื่อหมวด” ในช่องคำศัพท์ของแต่ละเรื่องที่ยังเป็นชื่อเก่าในชีต จึงไม่ต้องแก้ชีตทีละแถว
   ชื่อที่ไม่อยู่ในตาราง (เป็นชื่อปัจจุบันอยู่แล้ว หรือหมวดใหม่ที่แอดมินตั้งเอง) จะคืนค่าเดิม
   เพิ่มชื่อเก่าอื่นที่พบภายหลังได้ที่นี่ที่เดียว (index.html และ vocab.html ใช้ตารางนี้ร่วมกัน) */
(function (g) {
  g.KP_VCAT_OLD = {
 "ทักทายและมารยาท": "ประโยคและการทักทาย",
 "คนและสรรพนาม": "คนและกลุ่มคน",
 "ครอบครัว": "ครอบครัวและเครือญาติ",
 "ตัวเลขและการนับ": "ตัวเลข ปริมาณ และหน่วยวัด",
 "เวลาและวัน": "เวลา วัน และเดือน",
 "ธรรมชาติ": "ธรรมชาติ ดวงดาว ภัยธรรมชาติ",
 "ฟ้าฝนและฤดู": "การทำนา ฤดูกาล เกษตร",
 "สัตว์เลี้ยง": "สัตว์เลี้ยงและช้าง",
 "สัตว์ป่าและแมลง": "สัตว์ป่า นก แมลง สัตว์น้ำ",
 "ครัวและภาชนะ": "บ้านเรือนและครัว",
 "บ้านและเรือน": "บ้านเรือนและครัว",
 "ผ้าไหมและการทอ": "ผ้าไหม การทอ ย้อมสี",
 "จักสานและเครื่องมือจับสัตว์น้ำ": "จักสาน เครื่องมือ วัสดุ",
 "จักสานและเครื่องมือ": "จักสาน เครื่องมือ วัสดุ",
 "เกษตรและการทำนา": "การทำนา ฤดูกาล เกษตร",
 "ความเชื่อและพิธีกรรม": "ความเชื่อ พิธีกรรม เหตุการณ์ในชีวิต",
 "สุขภาพและสมุนไพร": "สุขภาพ สมุนไพร อาการเจ็บป่วย",
 "ทิศทางและสถานที่": "ทิศทาง ตำแหน่ง และสถานที่",
 "คำถามและคำชี้": "คำถาม คำชี้ และคำเชื่อม",
 "ดนตรีและการละเล่น": "การละเล่นและของเล่น",
 "เสื้อผ้าและเครื่องแต่งกาย": "การแต่งกายและของใช้ส่วนตัว",
 "เครื่องมือและของใช้": "จักสาน เครื่องมือ วัสดุ",
 "ปริมาณและหน่วยวัด": "ตัวเลข ปริมาณ และหน่วยวัด",
 "ตำแหน่งและบุพบท": "ทิศทาง ตำแหน่ง และสถานที่",
 "คำเชื่อมและคำช่วย": "คำถาม คำชี้ และคำเชื่อม",
 "ประโยคที่ใช้บ่อย": "ประโยคและการทักทาย",
 "สัตว์น้ำและปลา": "สัตว์ป่า นก แมลง สัตว์น้ำ",
 "ป่าและอาหารป่า": "ป่า ที่ดิน แหล่งน้ำ",
 "เทคโนโลยีและของสมัยใหม่": "การสื่อสาร เสียง และเทคโนโลยี",
 "เหตุการณ์สำคัญในชีวิต": "ความเชื่อ พิธีกรรม เหตุการณ์ในชีวิต",
 "ที่ดินและแหล่งน้ำ": "ป่า ที่ดิน แหล่งน้ำ",
 "วัสดุและสิ่งของ": "จักสาน เครื่องมือ วัสดุ",
 "ดวงดาวและท้องฟ้า": "ธรรมชาติ ดวงดาว ภัยธรรมชาติ",
 "อวัยวะและอาการเจ็บป่วย": "สุขภาพ สมุนไพร อาการเจ็บป่วย",
 "การสื่อสารและเสียง": "การสื่อสาร เสียง และเทคโนโลยี",
 "สถานที่ในชุมชน": "ทิศทาง ตำแหน่ง และสถานที่",
 "วันและเดือน": "เวลา วัน และเดือน",
 "ของใช้ส่วนตัว": "การแต่งกายและของใช้ส่วนตัว",
 "ชาติพันธุ์และกลุ่มคนใกล้เคียง": "คนและกลุ่มคน",
 "ย้อมสีธรรมชาติ": "ผ้าไหม การทอ ย้อมสี",
 "ภัยธรรมชาติและการเตือนภัย": "ธรรมชาติ ดวงดาว ภัยธรรมชาติ",
 "ข้าวและอาหารพื้นถิ่นเพิ่มเติม": "อาหารและการกิน",
 "ความรู้สึกและคำพูดในชีวิตประจำวัน": "อารมณ์และความรู้สึก",
 "การกระทำ": "คำกริยาที่ใช้บ่อย",
 "อาชีพและงานชุมชน": "คนและกลุ่มคน",
 "การปกครอง สังคม และกติกา": "คนและกลุ่มคน",
 "ชายแดนและการข้ามแดน": "ทิศทาง ตำแหน่ง และสถานที่",
 "นิทานและเรื่องเล่า": "ความเชื่อ พิธีกรรม เหตุการณ์ในชีวิต",
 "สถานที่ ป่าชุมชน และศาลปู่ตา": "ป่า ที่ดิน แหล่งน้ำ"
};
  g.KP_vcat = function (c) { c = String(c == null ? "" : c).trim(); return Object.prototype.hasOwnProperty.call(g.KP_VCAT_OLD, c) ? g.KP_VCAT_OLD[c] : c; };
})(typeof self !== "undefined" ? self : this);
