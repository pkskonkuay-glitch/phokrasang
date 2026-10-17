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
