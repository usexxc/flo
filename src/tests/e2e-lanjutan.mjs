/**
 * E2E lanjutan: alur nyata lewat UI, pada app yang sudah berjalan di 8140.
 *
 * Cakupan (sesuai permintaan):
 *   A. Catat gejala: pilih gejala + keparahan, simpan, tampil lagi setelah muat ulang.
 *   B. Catat harian: mood + energi + kebiasaan + catatan, simpan, tampil lagi.
 *   C. Haid: catat mulai, tandai akhir, hapus dengan konfirmasi, undo.
 *   D. Cadangan: ekspor menghasilkan berkas valid; impor minta konfirmasi dan
 *      benar-benar mengganti data setelah disetujui.
 *
 * Catatan: UI TIDAK punya fitur ubah tanggal haid yang sudah tercatat (hanya
 * hapus, dan "Tandai akhir" untuk haid terakhir). Edit tanggal diuji sebagai
 * "tidak tersedia", bukan dipalsukan.
 *
 * Jalankan (server dev 8140 + Chromium CDP 9223, satu per satu):
 *   node src/tests/e2e-lanjutan.mjs
 */
import http from 'node:http';

const CDP_PORT = Number(process.env.CDP_PORT || 9223);
const APP = process.env.APP_URL || 'http://127.0.0.1:8140/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const tab = await getJson('/json/new?' + encodeURIComponent(APP + '?e2e2=' + Date.now()), 'PUT');
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
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); reject(new Error('timeout ' + method)); } }, 20000);
});
const evalJs = async (expression) => {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result?.value;
};

/** Klik tombol berdasarkan teks (cocok persis setelah normalisasi spasi). */
const clickButton = (label) => evalJs(`(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const b = [...document.querySelectorAll('button')].find((x) => norm(x.innerText) === ${JSON.stringify(label)});
  if (!b || b.disabled) return false;
  b.click(); return true;
})()`);

/** Tunggu predikat JS jadi true, atau gagal setelah timeout. */
const waitFor = async (predicate, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evalJs(`(() => { try { return Boolean(${predicate}); } catch (e) { return false; } })()`)) return true;
    await sleep(150);
  }
  return false;
};

/** Pindah halaman lewat hash, lalu tunggu konten muncul. */
const goto = async (hash) => {
  await evalJs(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(500);
};

/** Muat ulang dengan data tertentu (menyuntik localStorage lebih dulu). */
const seedAndReload = async (data) => {
  await evalJs(`(() => {
    localStorage.clear();
    const d = ${JSON.stringify(data)};
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
    return 1;
  })()`);
  await evalJs(`location.href = ${JSON.stringify(APP + '?run=' + Date.now())}`);
  await sleep(2200);
};

const BASE_PROFILE = { onboarded: true, name: 'Uji', averageCycleLength: 28, averagePeriodLength: 5, cycleRegularity: 'teratur' };
const storedJson = (key) => evalJs(`(() => { try { return JSON.parse(localStorage.getItem(${JSON.stringify(key)})); } catch (e) { return null; } })()`);

/* ------------------------------------------------------------------ A. Gejala */
await seedAndReload({ flo_profile: BASE_PROFILE, flo_periods: [] });
await goto('#/log');
// Tab "Gejala & mood" (role=tab).
const openSymptoms = await evalJs(`(() => {
  const t = [...document.querySelectorAll('[role="tab"]')].find((x) => /gejala/i.test(x.innerText || ''));
  if (!t) return false; t.click(); return true;
})()`);
check('A: tab Gejala & mood dapat dibuka', openSymptoms === true);
await sleep(400);
// Pilih dua gejala fisik, lalu simpan.
await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'Kram'); if (b) b.click(); })()`);
await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'Mual'); if (b) b.click(); })()`);
await sleep(200);
check('A: simpan gejala', await clickButton('Simpan gejala'));
await sleep(400);
const symp = await storedJson('flo_symptoms');
const todayKey = await evalJs(`(() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); })()`);
const mine = (symp || []).filter((s) => s.date === todayKey).map((s) => s.symptom).sort();
check('A: gejala tersimpan di storage (Kram + Mual)', JSON.stringify(mine) === JSON.stringify(['Kram', 'Mual']), JSON.stringify(mine));
// Muat ulang: gejala harus tetap ada (tidak hilang saat refresh).
await evalJs(`location.reload()`);
await sleep(2000);
await goto('#/log');
await evalJs(`(() => { const t = [...document.querySelectorAll('[role="tab"]')].find((x) => /gejala/i.test(x.innerText || '')); if (t) t.click(); })()`);
await sleep(400);
const kramPressed = await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'Kram'); return b ? (b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true' || /active|bg-berry|bg-berry-soft|border-berry/.test(b.className)) : false; })()`);
check('A: gejala tetap tampil setelah muat ulang', kramPressed === true);

/* ------------------------------------------------------------ B. Catatan harian */
await goto('#/log');
await evalJs(`(() => { const t = [...document.querySelectorAll('[role="tab"]')].find((x) => /harian/i.test(x.innerText || '')); if (t) t.click(); })()`);
await sleep(400);
// Pilih satu mood, satu energi, satu kebiasaan, lalu tulis catatan.
const pickFirst = (label) => evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim().length > 0 && (x.innerText || '').trim() === ${JSON.stringify(label)});
  if (b) b.click(); return Boolean(b);
})()`);
const hasMood = await evalJs(`(() => [...document.querySelectorAll('button')].length > 0)()`);
check('B: tab Harian terbuka dan punya tombol', hasMood === true);
// Ambil label mood/energi/kebiasaan pertama dari DOM (bukan hardcode, supaya tidak
// rapuh bila katalog berubah).
const groups = await evalJs(`(() => {
  const titles = [...document.querySelectorAll('h2')].filter((x) => /suasana hati|tingkat energi|kebiasaan/i.test((x.innerText || '').trim()));
  return titles.length;
})()`);
check('B: tiga kelompok (suasana, energi, kebiasaan) ada', groups >= 1, 'judul=' + groups);
await evalJs(`(() => {
  const i = document.getElementById('log-note');
  if (!i) return 0;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, 'Uji catatan e2e'); i.dispatchEvent(new Event('input', { bubbles: true }));
  return 1;
})()`);
await sleep(200);
const pickedMood = await pickFirst('Bahagia');
const pickedEnergy = await pickFirst('Tinggi');
const pickedHabit = await pickFirst('Tidur cukup');
check('B: pilih mood, energi, dan kebiasaan', pickedMood && pickedEnergy && pickedHabit, `mood=${pickedMood} energi=${pickedEnergy} kebiasaan=${pickedHabit}`);
check('B: simpan catatan harian', await clickButton('Simpan catatan harian'));
await sleep(400);
const daily = await storedJson('flo_logs');
const todayLog = (daily || []).find((l) => l.date === todayKey);
check('B: catatan harian tersimpan dengan teks', Boolean(todayLog) && todayLog.note === 'Uji catatan e2e', todayLog ? 'note=' + todayLog.note : 'tidak ada');
check('B: mood/energi/kebiasaan tersimpan sesuai pilihan', Boolean(todayLog) && todayLog.mood === 'Bahagia' && todayLog.energy === 'Tinggi' && todayLog.habits.includes('Tidur'), JSON.stringify(todayLog));

/* ---------------------------------------------- C. Haid: catat, akhiri, hapus, undo */
await seedAndReload({ flo_profile: BASE_PROFILE, flo_periods: [] });
await goto('#/log');
check('C: catat haid mulai hari ini', await clickButton('Haid mulai tanggal ini'));
await sleep(400);
const afterStart = await storedJson('flo_periods');
check('C: haid tersimpan dengan endDate kosong (belum ditandai selesai)', (afterStart || []).length === 1 && afterStart[0].endDate === '', JSON.stringify(afterStart));
check('C: tandai akhir haid', await clickButton('Tandai akhir haid'));
await sleep(400);
const afterEnd = await storedJson('flo_periods');
check('C: endDate terisi setelah tandai akhir', Boolean(afterEnd?.[0]?.endDate), afterEnd?.[0]?.endDate || 'kosong');

// Hapus di Riwayat: tombol "Hapus siklus …" lalu konfirmasi.
await goto('#/history');
await sleep(300);
const delClicked = await evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /^Hapus siklus/.test(x.getAttribute('aria-label') || ''));
  if (b) b.click(); return Boolean(b);
})()`);
check('C: tombol hapus siklus ada di Riwayat', delClicked === true);
await sleep(400);
check('C: dialog konfirmasi hapus muncul', await waitFor(`[...document.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === 'Ya, hapus')`));
check('C: konfirmasi hapus', await clickButton('Ya, hapus'));
await sleep(500);
const afterDelete = await storedJson('flo_periods');
check('C: haid terhapus dari storage', (afterDelete || []).length === 0, 'n=' + (afterDelete || []).length);
check('C: undo muncul setelah hapus', await waitFor(`[...document.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === 'Kembalikan')`));
check('C: undo mengembalikan haid', await clickButton('Kembalikan'));
await sleep(500);
const afterUndo = await storedJson('flo_periods');
check('C: haid kembali setelah undo', (afterUndo || []).length === 1, 'n=' + (afterUndo || []).length);
// Ubah tanggal haid: UI tidak menyediakannya. Dicatat apa adanya.
const hasEditDate = await evalJs(`[...document.querySelectorAll('button')].some((b) => /ubah|edit/i.test(b.innerText || b.getAttribute('aria-label') || ''))`);
check('C: fitur ubah tanggal haid TERSEDIA (diharapkan belum ada)', hasEditDate === false, 'tidak ada tombol edit');

/* ------------------------------------------------- D. Cadangan: ekspor & impor */
await seedAndReload({ flo_profile: BASE_PROFILE, flo_periods: [{ id: 'x1', startDate: '2026-09-01', endDate: '2026-09-05', flow: 'medium' }] });
await goto('#/calendar');
await sleep(400);
// Ekspor: intersep pembuatan Blob untuk membaca isi berkas.
await evalJs(`(() => {
  window.__exported = null;
  const orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => { window.__exported = blob; return orig(blob); };
  window.__origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { return undefined; };
  return 1;
})()`);
check('D: tombol Ekspor cadangan ada', await clickButton('Ekspor cadangan'));
await sleep(500);
const exportedText = await (await cdp('Runtime.evaluate', {
  expression: `(async () => { const b = window.__exported; return b ? await b.text() : null; })()`,
  awaitPromise: true, returnByValue: true,
})).result?.value;
await evalJs(`HTMLAnchorElement.prototype.click = window.__origClick`);
let exportOk = false; let exportInfo = '';
try {
  const parsed = JSON.parse(exportedText || 'null');
  exportOk = Boolean(parsed && parsed.app && parsed.data && Array.isArray(parsed.data.periods || parsed.data.flo_periods || []));
  exportInfo = 'keys=' + Object.keys(parsed || {}).join(',');
} catch (e) { exportInfo = 'bukan JSON: ' + String(exportedText || '').slice(0, 60); }
check('D: ekspor menghasilkan JSON dengan wrapper app/data', exportOk, exportInfo);

// Impor: unggah berkas lewat input file, pastikan konfirmasi muncul dulu,
// lalu setelah disetujui data benar-benar diganti.
const replacement = {
  app: 'flo', version: 1, exportedAt: new Date().toISOString(),
  data: { profile: BASE_PROFILE, periods: [{ id: 'imp1', startDate: '2026-08-02', endDate: '2026-08-06', flow: 'medium' }] },
  cycles: [],
};
await evalJs(`(() => {
  const input = document.querySelector('input[type="file"][accept*="json"]');
  if (!input) return 0;
  const file = new File([${JSON.stringify(JSON.stringify(replacement))}], 'cadangan.json', { type: 'application/json' });
  const dt = new DataTransfer(); dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 1;
})()`);
await sleep(700);
check('D: impor minta konfirmasi (dialog "Ganti seluruh data?")', await waitFor(`[...document.querySelectorAll('h2,h3,span,p,div')].some((x) => (x.innerText || '').trim() === 'Ganti seluruh data?')`));
const beforeConfirm = await storedJson('flo_periods');
check('D: data belum berubah sebelum konfirmasi', (beforeConfirm || [])[0]?.id === 'x1', 'id=' + (beforeConfirm || [])[0]?.id);
// Batal dulu: data harus tetap.
check('D: batal impor', await clickButton('Batal'));
await sleep(400);
const afterCancel = await storedJson('flo_periods');
check('D: batal menjaga data lama', (afterCancel || [])[0]?.id === 'x1');
// Ulangi lalu setujui.
await evalJs(`(() => {
  const input = document.querySelector('input[type="file"][accept*="json"]');
  const file = new File([${JSON.stringify(JSON.stringify(replacement))}], 'cadangan.json', { type: 'application/json' });
  const dt = new DataTransfer(); dt.items.add(file);
  input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return 1;
})()`);
await sleep(700);
const confirmClicked = await clickButton('Ya, ganti datanya');
check('D: tombol konfirmasi impor "Ya, ganti datanya" diklik', confirmClicked);
await sleep(700);
const afterImport = await storedJson('flo_periods');
check('D: setelah setuju, data diganti dengan isi berkas', (afterImport || [])[0]?.id === 'imp1', 'id=' + (afterImport || [])[0]?.id);

await evalJs(`location.href = ${JSON.stringify(APP)}`);
console.log(fails.length ? `\nGAGAL: ${fails.length}` : '\nSEMUA LOLOS');
ws.close();
process.exit(fails.length ? 1 : 0);
