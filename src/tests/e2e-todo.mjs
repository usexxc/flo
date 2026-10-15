/**
 * E2E Todo List (spesifikasi lengkap): tambah dengan semua field, filter,
 * edit, centang, dashboard "Aktivitas Hari Ini", hapus dengan konfirmasi,
 * dan data bertahan setelah muat ulang. Dev server 8140, CDP 9223.
 *   node src/tests/e2e-todo.mjs
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

const tab = await getJson('/json/new?' + encodeURIComponent(APP + '?todo2=' + Date.now()), 'PUT');
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
const clickButton = (label) => evalJs(`(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const b = [...document.querySelectorAll('button')].find((x) => norm(x.innerText) === ${JSON.stringify(label)});
  if (!b || b.disabled) return false; b.click(); return true;
})()`);
/** Isi field form (input/select/textarea) lewat setter React. */
const setValue = (id, value) => evalJs(`(() => {
  const i = document.getElementById(${JSON.stringify(id)});
  if (!i) return false;
  const proto = i.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
    : i.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(value)});
  i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  return true;
})()`);
const stored = (key) => evalJs(`(() => { try { return JSON.parse(localStorage.getItem(${JSON.stringify(key)})); } catch (e) { return null; } })()`);
const isoDay = (offset) => evalJs(`(() => { const d = new Date(); d.setDate(d.getDate() + ${offset});
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); })()`);
const todayIso = await isoDay(0);
const tomorrowIso = await isoDay(1);

// Seed: profil onboarding + satu siklus, tanpa tugas.
await evalJs(`(() => {
  localStorage.clear();
  localStorage.setItem('flo_profile', JSON.stringify({ onboarded: true, name: 'Uji', averageCycleLength: 28, averagePeriodLength: 5, cycleRegularity: 'teratur' }));
  localStorage.setItem('flo_periods', JSON.stringify([{ id: 'a', startDate: '2026-09-01', endDate: '2026-09-05', flow: 'medium' }]));
  return 1;
})()`);
await evalJs(`location.href = ${JSON.stringify(APP + '?run=' + Date.now())}`);
await sleep(2200);

// Dashboard tanpa tugas: kartu tidak tampil (perkiraan haid tetap utama).
const dashNoTodo = await evalJs(`[...document.querySelectorAll('h2')].some((h) => /Aktivitas Hari Ini/.test(h.innerText || ''))`);
check('dashboard tanpa tugas: kartu Aktivitas Hari Ini tidak tampil', dashNoTodo === false);

// Halaman Todo List.
await evalJs(`location.hash = '#/todo'`);
await sleep(500);
const bodyText = () => evalJs(`document.body.innerText`);
check('halaman Todo List: judul & subjudul', (await bodyText()).includes('Todo List') && (await bodyText()).includes('Susun aktivitasmu, selesaikan satu per satu.'));
check('ringkasan awal: belum ada tugas hari ini', (await bodyText()).includes('Belum ada tugas untuk hari ini.'));
check('tombol "Tambah Tugas" ada', await evalJs(`[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Tambah Tugas')`));

// Validasi: judul kosong.
await clickButton('Tambah Tugas');
await sleep(400);
await clickButton('Simpan Tugas');
await sleep(300);
check('judul kosong: pesan validasi tampil', (await bodyText()).includes('Judul tugas wajib diisi.'));
check('judul kosong: tidak tersimpan', ((await stored('flo_todos')) || []).length === 0);

// Validasi: waktu tanpa tanggal.
await setValue('todo-title', 'Olahraga ringan');
await setValue('todo-time', '07:00');
await clickButton('Simpan Tugas');
await sleep(300);
check('waktu tanpa tanggal ditolak', (await bodyText()).includes('Isi tanggal dulu sebelum memilih waktu.'));

// Tugas 1: lengkap, hari ini.
await setValue('todo-title', 'Minum air putih');
await setValue('todo-desc', 'Target 8 gelas');
await setValue('todo-date', todayIso);
await setValue('todo-time', '08:00');
await setValue('todo-category', 'kesehatan');
await setValue('todo-priority', 'tinggi');
await clickButton('Simpan Tugas');
await sleep(500);
const t1 = ((await stored('flo_todos')) || []).find((t) => t.title === 'Minum air putih');
check('tugas 1 tersimpan lengkap',
  Boolean(t1) && t1.description === 'Target 8 gelas' && t1.date === todayIso && t1.time === '08:00'
  && t1.category === 'kesehatan' && t1.priority === 'tinggi' && t1.done === false,
  JSON.stringify(t1));
check('tugas 1 punya id, createdAt, updatedAt', Boolean(t1?.id && t1?.createdAt && t1?.updatedAt));
check('tugas langsung muncul tanpa refresh', (await bodyText()).includes('Minum air putih'));

// Tugas 2: besok (tidak masuk "Hari Ini").
await clickButton('Tambah Tugas'); await sleep(300);
await setValue('todo-title', 'Kumpul laporan PKL');
await setValue('todo-date', tomorrowIso);
await setValue('todo-category', 'sekolah-kerja');
await setValue('todo-priority', 'sedang');
await clickButton('Simpan Tugas'); await sleep(400);

// Tugas 3: tanpa tanggal (tugas umum, tidak masuk "Hari Ini").
await clickButton('Tambah Tugas'); await sleep(300);
await setValue('todo-title', 'Baca buku');
await setValue('todo-category', 'personal');
await setValue('todo-priority', 'rendah');
await clickButton('Simpan Tugas'); await sleep(400);
check('tiga tugas tersimpan', ((await stored('flo_todos')) || []).length === 3);
check('ringkasan: 0 dari 1 tugas selesai, progres 0%',
  (await bodyText()).includes('0 dari 1 tugas selesai.') && (await bodyText()).includes('Progress 0%'));

// Filter status.
const tabFilter = (label) => evalJs(`(() => { const t = [...document.querySelectorAll('[role="tab"]')].find((x) => x.innerText.trim() === ${JSON.stringify(label)}); if (t) t.click(); return Boolean(t); })()`);
await tabFilter('Hari Ini'); await sleep(300);
let txt = await bodyText();
check('filter "Hari Ini": hanya tugas bertanggal hari ini', txt.includes('Minum air putih') && !txt.includes('Kumpul laporan PKL') && !txt.includes('Baca buku'));
await tabFilter('Semua'); await sleep(300);
txt = await bodyText();
check('filter "Semua": semua tugas tampil', txt.includes('Baca buku') && txt.includes('Kumpul laporan PKL'));

// Centang tugas 1 -> selesai.
await evalJs(`(() => { const c = document.querySelector('input[aria-label="Tandai selesai: Minum air putih"]'); if (c) c.click(); return 1; })()`);
await sleep(400);
const doneStored = ((await stored('flo_todos')) || []).find((t) => t.title === 'Minum air putih');
check('centang menandai selesai dan menyimpan doneAt', doneStored?.done === true && typeof doneStored?.doneAt === 'string');
txt = await bodyText();
check('ringkasan diperbarui: 1 dari 1 selesai, 100%', txt.includes('1 dari 1 tugas selesai.') && txt.includes('Progress 100%'));
await tabFilter('Selesai'); await sleep(300);
txt = await bodyText();
check('filter "Selesai": hanya yang selesai', txt.includes('Minum air putih') && !txt.includes('Baca buku'));
await tabFilter('Belum Selesai'); await sleep(300);
txt = await bodyText();
check('filter "Belum Selesai": tugas selesai tidak tampil', !txt.includes('Minum air putih') && txt.includes('Baca buku'));
await tabFilter('Semua'); await sleep(300);

// Filter kategori.
await setValue('todo-cat-filter', 'kesehatan'); await sleep(300);
txt = await bodyText();
check('filter kategori "Kesehatan"', txt.includes('Minum air putih') && !txt.includes('Baca buku'));
await setValue('todo-cat-filter', ''); await sleep(300);

// Edit: ubah judul & prioritas; status selesai dan createdAt harus tetap.
const beforeEdit = ((await stored('flo_todos')) || []).find((t) => t.title === 'Baca buku');
await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Ubah tugas: Baca buku'); if (b) b.click(); return 1; })()`);
await sleep(400);
check('form ubah terbuka dengan data lama', await evalJs(`document.getElementById('todo-title')?.value === 'Baca buku'`));
await setValue('todo-title', 'Baca novel');
await setValue('todo-priority', 'tinggi');
await clickButton('Simpan Tugas');
await sleep(400);
const edited = ((await stored('flo_todos')) || []).find((t) => t.title === 'Baca novel');
check('edit tersimpan (judul & prioritas)', edited?.priority === 'tinggi' && edited?.id === beforeEdit?.id);
check('edit mempertahankan createdAt', edited?.createdAt === beforeEdit?.createdAt);

// Tiga tugas tambahan hari ini (total 4 belum selesai hari ini, uji batas 3).
for (const title of ['Tugas hari ini A', 'Tugas hari ini B', 'Tugas hari ini C', 'Tugas hari ini D']) {
  await clickButton('Tambah Tugas'); await sleep(300);
  await setValue('todo-title', title);
  await setValue('todo-date', todayIso);
  await clickButton('Simpan Tugas'); await sleep(300);
}

// Dashboard: kartu Aktivitas Hari Ini.
await evalJs(`location.hash = '#/dashboard'`);
await sleep(700);
const dash = await evalJs(`(() => {
  const card = document.querySelector('[data-testid="today-todos"]');
  return {
    ada: Boolean(card),
    kotak: card ? card.querySelectorAll('input[type="checkbox"]').length : 0,
    teks: card?.innerText || '',
  };
})()`);
check('dashboard: kartu Aktivitas Hari Ini tampil', dash.ada);
check('dashboard: maksimal 3 tugas belum selesai', dash.kotak === 3, 'kotak=' + dash.kotak);
check('dashboard: menyebut sisa tugas di halaman Todo', dash.teks.includes('+1 tugas lainnya di halaman Todo List.'), dash.teks.slice(0, 80));
check('dashboard: tombol "Lihat Semua" ada', await evalJs(`[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Lihat Semua')`));
check('dashboard: perkiraan haid tetap ada', /haid (berikutnya )?diperkirakan/i.test(await bodyText()) || (await bodyText()).includes('Catat menstruasi untuk melihat perkiraan.'));

// Centang dari dashboard tanpa membuka halaman Todo.
const doneBeforeDash = ((await stored('flo_todos')) || []).filter((t) => t.done).length;
await evalJs(`(() => { const c = document.querySelector('input[aria-label="Tandai selesai: Tugas hari ini A"]'); if (c) c.click(); return 1; })()`);
await sleep(500);
const doneAfterDash = ((await stored('flo_todos')) || []).filter((t) => t.done).length;
check('centang dari dashboard menyelesaikan tugas', doneAfterDash === doneBeforeDash + 1, `${doneBeforeDash}->${doneAfterDash}`);
check('tugas selesai hilang dari kartu dashboard', await evalJs(`!document.querySelector('input[aria-label="Tandai selesai: Tugas hari ini A"]')`));

// Hapus dengan konfirmasi: batal dulu, lalu hapus.
await evalJs(`location.hash = '#/todo'`);
await sleep(500);
const openDel = (title) => evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify('Hapus tugas: ' + title)}); if (b) b.click(); return Boolean(b); })()`);
await openDel('Baca novel');
await sleep(400);
check('dialog "Hapus tugas ini?" muncul', (await bodyText()).includes('Hapus tugas ini?'));
check('batal hapus', await clickButton('Batal'));
await sleep(300);
const countBeforeDel = ((await stored('flo_todos')) || []).length;
check('batal menjaga tugas', countBeforeDel === 7, 'n=' + countBeforeDel);
await openDel('Baca novel');
await sleep(400);
check('konfirmasi hapus', await clickButton('Hapus'));
await sleep(400);
check('tugas terhapus dari penyimpanan', !((await stored('flo_todos')) || []).some((t) => t.title === 'Baca novel'));

// Bertahan setelah muat ulang.
await evalJs(`location.reload()`);
await sleep(2000);
await evalJs(`location.hash = '#/todo'`);
await sleep(500);
const afterReload = (await stored('flo_todos')) || [];
check('setelah muat ulang: data to-do utuh', afterReload.length === 6, 'n=' + afterReload.length);
check('setelah muat ulang: status selesai tetap', afterReload.find((t) => t.title === 'Minum air putih')?.done === true);

// Data menstruasi & profil tidak tersentuh.
const periods = (await stored('flo_periods')) || [];
const profile = (await stored('flo_profile')) || {};
check('data menstruasi tidak tersentuh', periods.length === 1 && periods[0].id === 'a');
check('profil/onboarding tidak tersentuh', profile.onboarded === true && profile.name === 'Uji');

console.log(fails.length ? `\nGAGAL: ${fails.length}` : '\nSEMUA LOLOS');
await evalJs(`localStorage.clear(); location.href = ${JSON.stringify(APP)}`);
ws.close();
process.exit(fails.length ? 1 : 0);
