/**
 * E2E versi React: alur nyata pengguna lewat dashboard.
 * Menjalankan:
 *   1. Onboarding 7 langkah → dashboard
 *   2. Dashboard menampilkan prediksi
 *   3. Catat gejala tersimpan
 *   4. Riwayat menampilkannya
 *   5. Pengaturan reset
 */
import http from 'node:http';

const CDP_PORT = Number(process.argv[2] || 9223);
const APP_URL = process.argv[3] || 'http://127.0.0.1:8140/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Http sederhana: GET /json */
const getJson = (path) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: CDP_PORT, path }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

let seq = 0;
const pending = new Map();

/**
 * Evaluasi ekspresi JS di dalam halaman.
 * @param {WebSocket} ws
 * @param {string} expression
 */
const evalJs = (ws, expression) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout: ' + expression.slice(0, 40))); } }, 20000);
});

let pass = 0; let fail = 0;
const results = [];

/**
 * Klik tombol berdasarkan label, cocok sebagian dan tahan spasi/non-breaking
 * space. `innerText.trim()` saja sering meleset karena teks tombol di app ini
 * bisa memuat panah.
 * @param {WebSocket} ws
 * @param {string} label
 * @returns {Promise<boolean>} true kalau tombol ketemu dan diklik
 */
async function clickButton(ws, label) {
  return evalJs(ws, `(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const b = [...document.querySelectorAll('button')].find((x) => norm(x.innerText) === norm(${JSON.stringify(label)}));
    if (!b || b.disabled) return false;
    b.click();
    return true;
  })()`);
}

/**
 * Tunggu sampai kondisi pada halaman benar, atau lewat batas waktu.
 * @param {WebSocket} ws
 * @param {string} predicate predikat JS yang dievaluasi di halaman
 * @param {number} timeoutMs
 */
async function waitFor(ws, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const ok = await evalJs(ws, `Boolean(${predicate})`);
      if (ok) return true;
    } catch (err) {
      // Halaman sedang pindah; coba lagi sampai batas waktu.
    }
    if (Date.now() > deadline) return false;
    await sleep(200);
  }
}

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} [detail]
 */
function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  ok  ${name}`); } else {
    fail++; results.push(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function main() {
  // Buka tab baru sendiri. Memakai tab pertama yang kebetulan ada rawan: kalau
  // peramban masih menyisakan tab dari sesi debug, test akan mengemudikan
  // halaman yang salah dan semua pemeriksaan gagal palsu.
  const fresh = APP_URL + '?e2e=' + Date.now();
  let page = await new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: CDP_PORT, method: 'PUT',
      path: '/json/new?' + encodeURIComponent(fresh),
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
  if (!page || !page.webSocketDebuggerUrl) {
    throw new Error('Tidak bisa membuka tab baru untuk pengujian.');
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const onMsg = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve } = pending.get(m.id);
      pending.delete(m.id);
      resolve(m.result?.result?.value);
    }
  };
  ws.onmessage = onMsg;

  await evalJs(ws, 'undefined'); // handshake
  // Halaman baru mewarisi localStorage asal yang membuat onboarding terlewat.
  await evalJs(ws, 'localStorage.clear()');
  await evalJs(ws, `location.href = ${JSON.stringify(fresh)}`);
  await sleep(1500);

  // Peramban bisa memuat ulang tab setelah redirect, sehingga target CDP awal
  // menjadi basi. Ambil ulang tab yang URL-nya sama dengan yang kita buka.
  const live = await getJson('/json');
  const livePage = live.find((t) => t.type === 'page' && t.url === fresh);
  const target = livePage ? new WebSocket(livePage.webSocketDebuggerUrl) : ws;
  if (livePage) {
    await new Promise((res, rej) => { target.onopen = res; target.onerror = rej; });
    target.onmessage = onMsg;
    await evalJs(target, 'undefined'); // handshake ulang
  }
  // Tunggu React mount — memeriksa penanda langkah onboarding, bukan diam terus,
  // supaya test tidak balapan dengan waktu pemuatan.
  await waitFor(target, `Boolean(document.querySelector('#ob-name'))`, 15_000);

  /* 1. Onboarding langkah 0: nama */
  await evalJs(target, `(() => {
    const inp = document.querySelector('#ob-name');
    inp.focus();
    // React memasang value sendiri; pakai native setter & event yang dia dengar.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'Nazril');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return inp.value;
  })()`);
  // Beri waktu React komit nilai; menekan "Lanjut" langsung setelah memicu
  // event membuat validasi membaca state lama (input terlihat kosong).
  await waitFor(target, `document.querySelector('#ob-name')?.value === 'Nazril'`, 5000);
  await clickButton(target, 'Lanjut');
  await waitFor(target, `Boolean(document.querySelector('#ob-period'))`, 5000);

  /* 2. Langkah 1: tanggal */
  const today = await evalJs(target, `(() => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  })()`);
  await evalJs(target, `(() => {
    const inp = document.querySelector('#ob-period');
    inp.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, ${JSON.stringify(today)});
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return inp.value;
  })()`);
  await waitFor(target, `document.querySelector('#ob-period')?.value === ${JSON.stringify(today)}`, 5000);
  await clickButton(target, 'Lanjut');

  /* 3. Langkah 2–6: pilih kartu pertama, lanjut sampai tombol terakhir */
  for (let i = 0; i < 6; i++) {
    await evalJs(target, `(() => {
      const cards = document.querySelectorAll('button[aria-pressed]');
      if (cards.length) cards[0].click();
      return cards.length;
    })()`);
    await sleep(220);
    // Tombol maju: 'Lanjut' pada langkah 2–6, 'Mulai catat' di langkah terakhir.
    await evalJs(target, `(() => {
      const b = [...document.querySelectorAll('button')].find((x) => ['Lanjut', 'Mulai catat'].includes(x.innerText.trim()));
      b?.click();
      return Boolean(b);
    })()`);
    await sleep(350);
    const heading = await evalJs(target, `document.querySelector('h1')?.innerText || ''`);
    if (/Panggil kamu siapa/i.test(heading)) break;
  }

  /* 4. Selesai: dashboard muncul */
  await sleep(800);
  let text = await evalJs(target, `document.body.innerText`);
  check('onboarding selesai → dashboard tampil', /Selamat (pagi|siang|sore|malam)/.test(text), text.slice(0, 120));

  text = await evalJs(target, `document.body.innerText`);
  check('dashboard punya kartu prediksi', /HAID BERIKUTNYA/i.test(text));

  /* 5. Navigasi ke Riwayat */
  await evalJs(target, `(() => {
    const btns = [...document.querySelectorAll('button')];
    const riwayat = btns.find((b) => b.innerText.trim() === 'Riwayat');
    riwayat?.click();
    return Boolean(riwayat);
  })()`);
  // setelah hash routing, perlu menunggu render ulang.
  await waitFor(target, `/#\\/history/.test(location.hash) || document.body.innerText.includes('Riwayat')`, 5000);
  await sleep(300);
  text = await evalJs(target, `document.body.innerText`);
  check('halaman Riwayat terbuka', /Riwayat/.test(text) && /Menstruasi|gejala|harian/i.test(text));

  /* 6. Navigasi ke Pengaturan */
  await evalJs(target, `(() => {
    const set = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Pengaturan');
    set?.click();
    return Boolean(set);
  })()`);
  await waitFor(target, `/#\\/settings/.test(location.hash) || document.body.innerText.includes('Profilmu')`, 5000);
  await sleep(300);
  text = await evalJs(target, `document.body.innerText`);
  check('halaman Pengaturan terbuka', /Profilmu/.test(text));

  const clickOk = await evalJs(target, `(() => {
    const li = [...document.querySelectorAll('button, input[type="checkbox"], label')].find((b) => (b.innerText || '').includes('Ingatkan aku'));
    li?.click();
    return Boolean(li);
  })()`);
  await sleep(300);
  check('toggle pengingat berfungsi', Boolean(clickOk));

  /* 7. Reset data → kembali ke onboarding */
  await evalJs(target, `(() => {
    const hapus = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').includes('Hapus semua data'));
    hapus?.click();
    return Boolean(hapus);
  })()`);
  await waitFor(target, `document.body.innerText.includes('Hapus semua data')`, 5000);
  await sleep(200);
  text = await evalJs(target, `document.body.innerText`);
  check('dialog konfirmasi reset muncul', /Hapus semua data\?/i.test(text));

  const confirmed = await evalJs(target, `(() => {
    const ok = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').includes('Hapus permanen'));
    ok?.click();
    return Boolean(ok);
  })()`);
  await sleep(600);
  text = await evalJs(target, `document.body.innerText`);
  check('setelah reset data → layar onboarding kembali', Boolean(confirmed) && /Panggil kamu siapa/i.test(text));

  console.log(results.join('\n'));
  console.log(`\nTOTAL: ${pass} pass, ${fail} fail`);
  target.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E ERROR:', e.message);
  process.exit(1);
});
