// Reproduksi bug laporan: kalender hilang + halaman Wawasan blank.
// State: 3 periode historis -> buka dashboard, lalu navigasi Calendar & Insight.
import http from 'node:http';

const CDP_PORT = Number(process.argv[2] || 9223);
const APP = process.argv[3] || 'http://127.0.0.1:8142/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (path, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: CDP_PORT, path, method }, (res) => {
    let b = '';
    res.on('data', (c) => { b += c; });
    res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
  });
  req.on('error', reject);
  req.end();
});

const tab = await getJson(`/json/new?${encodeURIComponent(APP + '?bug=1')}`, 'PUT');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seq = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push((d.exception?.description || d.text || '').split('\n').slice(0, 3).join(' | '));
  }
  if (m.method === 'Console.messageAdded' && m.params.message.level === 'error') {
    errors.push(m.params.message.text);
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++seq; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params }));
});
const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true })
  .then((r) => r.result?.result?.value);

await send('Runtime.enable');
await send('Console.enable');
await send('Page.enable');

// Seed data realistis (user sudah onboarding, 3 periode).
await ev(`(() => {
  localStorage.clear();
  localStorage.setItem('flo_profile', JSON.stringify({
    name: 'Nazril', averageCycleLength: 29, averagePeriodLength: 5,
    cycleRegularity: 'teratur', lastPeriodStart: '2026-09-05', onboarded: true,
  }));
  localStorage.setItem('flo_onboarding_completed', '1');
  localStorage.setItem('flo_periods', JSON.stringify([
    { id: 'a', startDate: '2026-07-10', endDate: '2026-07-14', flow: 'medium' },
    { id: 'b', startDate: '2026-08-08', endDate: '2026-08-12', flow: 'medium' },
    { id: 'c', startDate: '2026-09-05', endDate: '2026-09-09', flow: 'medium' },
  ]));
  return 1;
})()`);
await ev(`location.href = ${JSON.stringify(APP + '?bug=2')}`);
await sleep(1800);

/** @returns {Promise<object>} */
async function snap(label) {
  const r = await ev(`(() => {
    const root = document.querySelector('#root');
    return {
      label: ${JSON.stringify(label)},
      rootLen: root ? root.innerHTML.length : 0,
      text: (document.body.innerText || '').slice(0, 700),
      hasKalender: /Kalender/.test(document.body.innerText),
      hasWawasan: /Wawasan/.test(document.body.innerText),
      buttons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean),
    };
  })()`);
  console.log('=== ' + r.label + ' ===');
  console.log(JSON.stringify(r, null, 1));
  return r;
}

const dash = await snap('dashboard');

// Navigasi ke Kalender
await ev(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Kalender')?.click()`);
await sleep(700);
const cal = await snap('calendar page');

// Navigasi ke Wawasan
await ev(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Wawasan')?.click()`);
await sleep(900);
const ins = await snap('insight page');

console.log('=== ERRORS ===');
console.log(errors.length ? errors.join('\n') : '(bersih)');

await send('Target.closeTarget', { targetId: tab.id }).catch(() => {});
ws.close();
process.exit(0);
