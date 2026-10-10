/**
 * Audit UI terukur (bukan visual) — dijalankan di dalam halaman via CDP.
 * Memeriksa:
 *   1. Elemen keluar viewport (horizontal overflow)
 *   2. Teks terpotong (nowrap yang meluber)
 *   3. Kontras warna tiap pasangan teks/latar (WCAG AA)
 *   4. Ukuran target sentuh minimal
 *
 * Catatan: latar bergradasi tidak bisa dihitung dari satu warna, sehingga
 * pasangan teks di atas gradien dilewati (bukan kegagalan nyata).
 */
const CDP_PORT = process.env.CDP_PORT || '9223';
const URL = process.argv[2] || `http://127.0.0.1:8142/?audit=1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} url
 * @returns {Promise<object>} laporan
 */
async function audit(url) {
  const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  await sleep(1800);

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++seq;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Runtime.enable');

  const expression = `(() => {
    const results = { overflowX: 0, clipped: [], contrast: [], smallTargets: [] };
    results.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;

    /** @param {string} color @returns {[number,number,number,number]|null} */
    const parseRGB = (color) => {
      const m = color.match(/rgba?\\(([^)]+)\\)/);
      if (!m) return null;
      const [r, g, b, a = '1'] = m[1].split(',').map((x) => parseFloat(x));
      return [r, g, b, a];
    };
    /** @param {number} c @returns {number} */
    const lum = (c) => {
      const f = c / 255;
      return f <= 0.03928 ? f / 12.92 : Math.pow((f + 0.055) / 1.055, 2.4);
    };
    /** @param {number[]} rgb @returns {number} */
    const relLum = (rgb) => 0.2126 * lum(rgb[0]) + 0.7152 * lum(rgb[1]) + 0.0722 * lum(rgb[2]);
    /** @returns {{fg:number,bg:number}|null} */
    const colors = (el) => {
      const st = getComputedStyle(el);
      const fg = parseRGB(st.color);
      if (!fg) return null;
      let bgEl = el;
      let bg = null;
      while (bgEl && bgEl !== document.documentElement) {
        const parsed = parseRGB(getComputedStyle(bgEl).backgroundColor);
        if (parsed && parsed[3] > 0.5) { bg = parsed; break; }
        bgEl = bgEl.parentElement;
      }
      if (!bg) { const b = parseRGB(getComputedStyle(document.body).backgroundColor); bg = b || [255, 255, 255, 1]; }
      return { fg: relLum(fg), bg: relLum(bg) };
    };

    const nodes = document.querySelectorAll('h1,h2,h3,h4,p,span,strong,label,button,a,li');
    for (const el of nodes) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const text = (el.textContent || '').trim();
      if (!text || text.length > 40) continue;

      const c = colors(el);
      if (c) {
        const l1 = Math.max(c.fg, c.bg);
        const l2 = Math.min(c.fg, c.bg);
        const ratio = (l1 + 0.05) / (l2 + 0.05);
        const size = parseFloat(st.fontSize);
        const bold = Number(st.fontWeight) >= 700;
        const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        // Lewati teks di atas gradien: tidak terukur dari backgroundColor polos.
        let ancestor = el;
        let hasGradient = false;
        while (ancestor && ancestor !== document.documentElement) {
          if (getComputedStyle(ancestor).backgroundImage.includes('gradient')) { hasGradient = true; break; }
          ancestor = ancestor.parentElement;
        }
        if (ratio < need && !hasGradient) {
          results.contrast.push({
            text: text.slice(0, 30), ratio: Math.round(ratio * 100) / 100, need,
            size, weight: st.fontWeight, color: st.color,
          });
        }
      }

      const isOverflow = st.overflow === 'visible' && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0;
      if (isOverflow && st.whiteSpace === 'nowrap') {
        results.clipped.push({ text: text.slice(0, 30), tag: el.tagName, sw: el.scrollWidth, cw: el.clientWidth });
      }
    }

    for (const b of document.querySelectorAll('button, [role="button"], a')) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 28 || r.height < 28) {
        results.smallTargets.push({ label: (b.innerText || b.ariaLabel || '').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    return results;
  })()`;

  const res = await send('Runtime.evaluate', { expression, returnByValue: true });
  await send('Target.closeTarget', { targetId: tab.id }).catch(() => {});
  ws.close();
  return res.result.result.value;
}

try {
  const r = await audit(URL);
  console.log('overflowX:', r.overflowX);
  console.log('contrast lemah:', r.contrast.length);
  r.contrast.slice(0, 12).forEach((c) => console.log('   ', JSON.stringify(c)));
  console.log('teks terpotong:', r.clipped.length);
  r.clipped.slice(0, 8).forEach((c) => console.log('   ', JSON.stringify(c)));
  console.log('target kecil:', r.smallTargets.length);
  r.smallTargets.slice(0, 8).forEach((c) => console.log('   ', JSON.stringify(c)));
  console.log(`RINGKAS: ovf=${r.overflowX} contrast=${r.contrast.length} clip=${r.clipped.length} small=${r.smallTargets.length}`);
  process.exit(r.contrast.length + r.clipped.length + r.smallTargets.length + (r.overflowX ? 1 : 0) ? 1 : 0);
} catch (e) {
  console.error('AUDIT ERROR:', e.message);
  process.exit(1);
}
