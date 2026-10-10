/**
 * Uji tata letak mobile: pada tiap ukuran layar dan tiap halaman, pastikan
 * konten terbawah TIDAK tertutup bottom nav (nav fixed di bawah).
 *
 * Mengukur tinggi nyata nav, lalu memastikan elemen terbawah konten berhenti
 * di atas batas atas nav. Juga memeriksa horizontal overflow.
 *
 * Jalankan (server dev di 8140, Chromium CDP di 9223, satu per satu):
 *   node src/tests/layout-mobile.mjs
 */
import http from 'node:http';

const CDP_PORT = Number(process.env.CDP_PORT || 9223);
const APP = process.env.APP_URL || 'http://127.0.0.1:8140/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ukuran layar umum (lebar × tinggi CSS px). */
const VIEWPORTS = [
  { name: 'kecil 320×568', w: 320, h: 568 },
  { name: 'HP 360×740', w: 360, h: 740 },
  { name: 'HP 390×844', w: 390, h: 844 },
  { name: 'HP besar 430×932', w: 430, h: 932 },
  { name: 'tablet 768×1024', w: 768, h: 1024 },
];

/** Halaman yang diuji lewat hash routing. */
const PAGES = ['dashboard', 'calendar', 'history', 'insight', 'settings'];

const fails = [];
const check = (name, ok, extra = '') => {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? ` [${extra}]` : ''));
  if (!ok) fails.push(name);
};

const getJson = (path, method = 'GET') => new Promise((resolve, reject) => {
  const r = http.request({ host: '127.0.0.1', port: CDP_PORT, path, method }, (res) => {
    let b = '';
    res.on('data', (c) => { b += c; });
    res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
  });
  r.on('error', reject);
  r.end();
});

const tab = await getJson('/json/new?' + encodeURIComponent(APP + '?layout=' + Date.now()), 'PUT');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let seq = 0;
const pend = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
};
await new Promise((r) => { ws.onopen = r; });

const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pend.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); reject(new Error('timeout ' + method)); } }, 15000);
});
const evalJs = async (expression) => {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true });
  return r.result?.value;
};

// Data seed: profil sudah onboarding dan ada satu siklus, supaya shell + semua
// halaman punya konten nyata (bukan layar kosong).
await evalJs(`(() => {
  localStorage.setItem('flo_profile', JSON.stringify({ onboarded: true, name: 'Uji', averageCycleLength: 28, averagePeriodLength: 5, cycleRegularity: 'teratur' }));
  localStorage.setItem('flo_periods', JSON.stringify([
    { id: 'a', startDate: '2026-09-01', endDate: '2026-09-05', flow: 'medium' },
    { id: 'b', startDate: '2026-09-29', endDate: '2026-10-03', flow: 'medium' },
  ]));
  return 1;
})()`);
await evalJs(`location.reload()`);
await sleep(2200);

/**
 * Ukur: batas atas nav, dan elemen konten terbawah (di dalam <main>).
 * Mengabaikan elemen yang tersembunyi (display:none / ukuran nol).
 */
const MEASURE = `(() => {
  const nav = document.querySelector('nav[aria-label="Navigasi bawah"]');
  const main = document.querySelector('main');
  if (!nav || !main) return { ok: false, reason: 'nav/main tidak ada' };
  const navStyle = getComputedStyle(nav);
  const navVisible = navStyle.display !== 'none' && navStyle.visibility !== 'hidden';
  const navTop = nav.getBoundingClientRect().top;
  let maxBottom = 0;
  let last = '';
  for (const el of main.querySelectorAll('*')) {
    if (el.closest('[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    // Dekorasi absolut (lingkaran latar, dll.) bukan konten; lewati.
    if (st.position === 'absolute' && el.parentElement && el.closest('.absolute')) continue;
    if (r.bottom > maxBottom) { maxBottom = r.bottom; last = el.tagName + '.' + (el.className?.toString().slice(0, 40) || ''); }
  }
  const docW = document.documentElement.scrollWidth;
  const vw = window.innerWidth;
  return {
    ok: true,
    navVisible,
    navTop: Math.round(navTop),
    navHeight: Math.round(nav.getBoundingClientRect().height),
    contentBottom: Math.round(maxBottom),
    clearance: Math.round(navTop - maxBottom),
    lastEl: last,
    hOverflow: docW - vw,
  };
})()`;

for (const vp of VIEWPORTS) {
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 768,
  });
  for (const page of PAGES) {
    await evalJs(`location.hash = '#/${page}'`);
    await sleep(700);
    // Gulir ke paling bawah supaya elemen terakhir benar-benar di viewport;
    // tanpa ini posisinya di luar layar dan hasilnya tidak berarti.
    await evalJs(`window.scrollTo(0, document.documentElement.scrollHeight)`);
    await sleep(300);
    const m = await evalJs(MEASURE);
    if (!m?.ok) { check(`${vp.name} / ${page}: ukur`, false, m?.reason || 'gagal'); continue; }
    if (vp.w >= 1024) continue; // nav disembunyi di layar lebar; tidak relevan
    check(`${vp.name} / ${page}: nav tampil`, m.navVisible);
    // Konten terbawah harus berhenti di atas nav (clearance >= 0).
    check(`${vp.name} / ${page}: konten tidak tertutup nav`, m.clearance >= 0,
      `clearance=${m.clearance}px nav=${m.navHeight}px terbawah=${m.lastEl}`);
    check(`${vp.name} / ${page}: tidak ada scroll horizontal`, m.hOverflow <= 0,
      `overflow=${m.hOverflow}px`);
  }
}

await cdp('Emulation.clearDeviceMetricsOverride');
console.log(fails.length ? `\nGAGAL: ${fails.length}` : '\nSEMUA LOLOS');
ws.close();
process.exit(fails.length ? 1 : 0);
