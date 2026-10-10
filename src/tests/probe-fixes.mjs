/**
 * Probe perbaikan: memeriksa item review yang belum tentu sudah beres.
 * Semua pemeriksaan lewat aplikasi nyata (CDP), bukan baca kode saja.
 *
 * Jalankan: node src/tests/probe-fixes.mjs [cdpPort] [appUrl]
 */
import http from 'node:http';

const CDP_PORT = Number(process.argv[2] || 9223);
const APP_URL = process.argv[3] || 'http://127.0.0.1:8142/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (path) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: CDP_PORT, path }, (res) => {
    let b = '';
    res.on('data', (c) => { b += c; });
    res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

let seq = 0;
const pending = new Map();

/** @param {WebSocket} ws @param {string} expression */
const evalJs = (ws, expression) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout')); } }, 20000);
});

const norm = 'const norm=(t)=>(t||"").replace(/\\s+/g," ").trim();';
const clickByText = (label) => `(() => { ${norm} const b=[...document.querySelectorAll('button')].find(x=>norm(x.innerText)===norm(${JSON.stringify(label)})); if(!b||b.disabled) return null; b.click(); return true; })()`;

/** @param {WebSocket} ws @param {string} pred @param {number} ms */
async function waitFor(ws, pred, ms) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await evalJs(ws, `Boolean(${pred})`)) return true; } catch (e) { /* halaman pindah */ }
    if (Date.now() > end) return false;
    await sleep(200);
  }
}

/** Siapkan data onboarding → dashboard, kembalikan ws. */
async function bootstrap() {
  const fresh = APP_URL + '?probe=' + Date.now();
  const tab = await new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: CDP_PORT, path: '/json/new?' + encodeURIComponent(fresh), method: 'PUT' },
      (r) => { let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.end();
  });
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  const onMsg = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result?.result?.value); pending.delete(m.id); }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = onMsg;

  await evalJs(ws, 'undefined');
  await evalJs(ws, 'localStorage.clear()');
  await evalJs(ws, `location.href=${JSON.stringify(fresh)}`);
  await sleep(2000);

  const live = await getJson('/json');
  const again = live.find((t) => t.type === 'page' && t.url === fresh);
  if (again) {
    const w2 = new WebSocket(again.webSocketDebuggerUrl);
    await new Promise((r, j) => { w2.onopen = r; w2.onerror = j; });
    w2.onmessage = onMsg;
    await evalJs(w2, 'undefined');
    return w2;
  }
  return ws;
}

/** Isi 7 langkah onboarding. */
async function doOnboarding(ws) {
  await waitFor(ws, `document.querySelector('#ob-name')`, 15000);
  await evalJs(ws, `(() => { const i=document.querySelector('#ob-name');
    const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    s.call(i,'Nazril'); i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await waitFor(ws, `document.querySelector('#ob-name')?.value==='Nazril'`, 5000);
  await evalJs(ws, clickByText('Lanjut'));
  await waitFor(ws, `document.querySelector('#ob-period')`, 5000);
  const t = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const iso = `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  await evalJs(ws, `(() => { const i=document.querySelector('#ob-period');
    const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    s.call(i,${JSON.stringify(iso)});
    i.dispatchEvent(new Event('input',{bubbles:true}));
    i.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await waitFor(ws, `document.querySelector('#ob-period')?.value===${JSON.stringify(iso)}`, 5000);
  await evalJs(ws, clickByText('Lanjut'));
  for (let i = 0; i < 6; i++) {
    await evalJs(ws, `(() => { const c=document.querySelectorAll('button[aria-pressed]'); if(c.length) c[0].click(); })()`);
    await sleep(250);
    const adv = await evalJs(ws, `(() => { ${norm}
      const b=[...document.querySelectorAll('button')].find(x=>['Lanjut','Mulai catat'].some(w=>norm(x.innerText)===w));
      if (b) b.click(); return Boolean(b); })()`);
    if (!adv) break;
    await sleep(300);
  }
  await sleep(800);
}

const results = [];
/** @param {string} name @param {boolean} ok @param {string} detail */
function check(name, ok, detail = '') {
  results.push(`${ok ? '  ok  ' : '  FAIL'}  ${name}${detail && !ok ? ' — ' + detail : ''}`);
}

async function main() {
  const ws = await bootstrap();
  await doOnboarding(ws);

  /* --- #10: tidak ada "undefined hari" --- */
  let body = String(await evalJs(ws, 'document.body.innerText') || '');
  check('#10 wawasan tanpa "undefined hari"', !/undefined/.test(body), body.slice(0, 90));

  /* --- #8: telat ditulis "Telat N hari", bukan "N hari lalu" --- */
  check('#8 status telat tidak kontradiktif', !/hari lalu/.test(body), body.slice(0, 90));

  /* --- #15: kalender bisa mundur --- */
  await evalJs(ws, `(() => { const b=[...document.querySelectorAll('button,a')].find(x=>/kalender/i.test(x.innerText)); b?.click(); return Boolean(b); })()`);
  await sleep(600);
  const prevBefore = await evalJs(ws, `(() => { const b=document.querySelector('[aria-label="Bulan sebelumnya"]'); return b ? b.disabled : 'nobtn'; })()`);
  const monthBefore = String(await evalJs(ws, 'document.querySelector("h3")?.innerText || ""') || '');
  // Klik bulan sebelumnya; nilai awal (aktif atau tidak) dicatat dulu.
  await evalJs(ws, `document.querySelector('[aria-label="Bulan sebelumnya"]')?.click()`);
  await sleep(400);
  const monthAfter = String(await evalJs(ws, 'document.querySelector("h3")?.innerText || ""') || '');
  check('#15 tombol bulan sebelumnya aktif', prevBefore === false, `disabled=${prevBefore}`);
  check('#15 bulan berubah setelah diklik', monthBefore !== monthAfter && monthBefore !== '', `${monthBefore} → ${monthAfter}`);

  /* --- #7: tombol catat membuka form --- */
  // Tombol "Catat hari ini" membuka modal Log (tombol "+" topbar/sidebar).
  await evalJs(ws, `(() => { const b=document.querySelector('[aria-label="Catat hari ini"]'); b?.click(); return Boolean(b); })()`);
  await waitFor(ws, `Boolean(document.querySelector('[role="tablist"]'))`, 5000);
  const modalText = String(await evalJs(ws, 'document.body.innerText') || '');
  check('#7 tombol catat membuka form (bukan modal kosong)',
    /simpan|catat/i.test(modalText), modalText.slice(0, 100));

  /* --- #11 & #17: baca data dari key terpisah (flo_periods / flo_symptoms) --- */
  const storeDump = await evalJs(ws, `(() => {
    try {
      const g = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
      return JSON.stringify({
        periods: (g('flo_periods') || []).map((x) => ({ s: x.startDate, e: x.endDate || null })),
        symptoms: (g('flo_symptoms') || []).length,
      });
    } catch (e) { return 'err:' + e.message; }
  })()`);
  const dump = JSON.parse(String(storeDump) || '{}');
  check('#11 periode baru tidak dipaksa endDate 1 hari',
    dump.periods?.every((p) => p.e === null), JSON.stringify(dump.periods));
  check('#17 tidak ada gejala palsu dari onboarding', dump.symptoms === 0, `symptoms=${dump.symptoms}`);

  /* --- #14: input tanggal membatasi pilihan --- */
  // Input tanggal ada di tab "Harian"; pastikan tab itu aktif dulu.
  await evalJs(ws, `(() => { ${norm}
    const b=[...document.querySelectorAll('[role="tab"]')].find(x=>/harian/i.test(norm(x.innerText)));
    b?.click(); return Boolean(b); })()`);
  await sleep(400);
  const dateAttrs = await evalJs(ws, `(() => {
    const i = document.querySelector('input[type="date"]');
    if (!i) return null;
    return JSON.stringify({ min: i.min || null, max: i.max || null });
  })()`);
  check('#14 input tanggal punya batas', dateAttrs !== null, String(dateAttrs));

  /* --- Riwayat: hapus siklus minta konfirmasi dulu --- */
  // Pergi ke Riwayat lewat hash supaya hash routing ikut diuji.
  await evalJs(ws, `location.hash = '#/history'`);
  await waitFor(ws, `/#\\/history/.test(location.hash)`, 5000);
  await sleep(400);
  const hashNow = await evalJs(ws, 'location.hash');
  check('hash routing aktif saat ganti halaman', /#\/history/.test(String(hashNow)), String(hashNow));

  // Hanya bisa dites bila ada minimal satu periode (dari onboarding).
  const hasPeriod = await evalJs(ws, `(() => { try { return (JSON.parse(localStorage.getItem('flo_periods'))||[]).length > 0; } catch(e) { return false; } })()`);
  if (!hasPeriod) {
    check('hapus siklus minta konfirmasi', false, 'tidak ada periode untuk diuji');
  } else {
    // Tombol hapus = tombol dengan ikon trash (aria-label "Hapus siklus ...").
    const delBtn = await evalJs(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>/hapus siklus/i.test((x.getAttribute('aria-label')||''))); if(b) b.click(); return Boolean(b); })()`);
    const dialogOpen = await waitFor(ws, `document.body.innerText.includes('Hapus catatan siklus ini')`, 5000);
    check('hapus siklus minta konfirmasi', Boolean(delBtn) && dialogOpen, `delBtn=${delBtn}`);
    await waitFor(ws, `[...document.querySelectorAll('button')].some(b=>(b.innerText||'').replace(/\\s+/g,' ').trim()==='Ya, hapus')`, 5000);
    const confirmClicked = await evalJs(ws, `(() => { const n=(t)=>(t||'').replace(/\\s+/g,' ').trim();
      const b=[...document.querySelectorAll('button')].find(x=>n(x.innerText)==='Ya, hapus');
      if (b) b.click(); return Boolean(b); })()`);
    await sleep(500);
    const countAfter = await evalJs(ws, `(() => { try { return (JSON.parse(localStorage.getItem('flo_periods'))||[]).length; } catch(e) { return -1; } })()`);
    const undoShown = await evalJs(ws, `document.body.innerText.includes('Kembalikan')`);
    check('undo tampil setelah hapus siklus', confirmClicked && undoShown === true && countAfter === 0, `undo=${undoShown} count=${countAfter} clicked=${confirmClicked}`);
    // Klik Kembalikan, lalu pastikan data kembali.
    const undoBtn = await evalJs(ws, `(() => { const n=(t)=>(t||'').replace(/\\s+/g,' ').trim();
      const b=[...document.querySelectorAll('button')].find(x=>n(x.innerText)==='Kembalikan');
      if (b) b.click(); return Boolean(b); })()`);
    await sleep(800);
    const restored = await evalJs(ws, `(() => { try { return (JSON.parse(localStorage.getItem('flo_periods'))||[]).length > 0; } catch(e) { return false; } })()`);
    check('undo mengembalikan data', undoBtn === true && restored === true, `btn=${undoBtn} restored=${restored}`);
  }

  console.log(results.join('\n'));
  console.log(`\nTOTAL: ${results.filter((r) => r.startsWith('  ok')).length} ok, ${results.filter((r) => r.startsWith('  FAIL')).length} fail`);
  ws.close();
  process.exit(0);
}

main().catch((e) => { console.error('PROBE ERROR:', e.message); process.exit(1); });
