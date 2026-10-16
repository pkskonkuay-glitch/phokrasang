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
