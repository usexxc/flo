/**
 * Mesin siklus Flo — seluruh perhitungan murni (tanpa DOM, tanpa localStorage)
 * sehingga mudah diuji dan dipakai ulang.
 * Semua hasil prediksi bersifat PERKIRAAN berdasarkan data yang dicatat.
 * @module cycle
 */

import { addDays, diffDays, parseISO, toISO, mean, round1, clamp, num } from './util.js';

/** @typedef {'menstruasi'|'folikular'|'subur'|'ovulasi'|'luteal'|'pms'} PhaseKey */

/**
 * @typedef {Object} Period
 * @property {string} id
 * @property {string} startDate 'YYYY-MM-DD'
 * @property {string} [endDate] 'YYYY-MM-DD'
 * @property {'light'|'medium'|'heavy'} [flow]
 * @property {string} [notes]
 */

/**
 * @typedef {Object} Cycle
 * @property {string} id
 * @property {string} startDate awal siklus (hari pertama haid)
 * @property {string} endDate hari terakhir siklus (sehari sebelum haid berikutnya)
 * @property {number|null} cycleLength panjang siklus dalam hari, null bila belum berakhir
 * @property {number|null} periodLength lama menstruasi pada siklus ini
 * @property {boolean} ongoing siklus yang masih berjalan
 */

/** @typedef {{avgCycleLength:number, avgPeriodLength:number, cycleRegularity:string}} ProfileLite */

/**
 * Terima profil dalam dua bentuk: state aplikasi (averageCycleLength) maupun
 * bentuk ringkas (avgCycleLength), lalu kembalikan bentuk ringkas yang aman.
 * Mencegah NaN ketika perhitungan jatuh ke angka profil sebelum ada riwayat.
 * @param {Partial<ProfileLite> & {averageCycleLength?:number, averagePeriodLength?:number}} [profile]
 * @returns {ProfileLite}
 */
export function resolveProfile(profile = {}) {
  const cycle = Number(profile.avgCycleLength ?? profile.averageCycleLength);
  const period = Number(profile.avgPeriodLength ?? profile.averagePeriodLength);
  return {
    avgCycleLength: Number.isFinite(cycle) && cycle > 0 ? clamp(Math.round(cycle), 15, 60) : 28,
    avgPeriodLength: Number.isFinite(period) && period > 0 ? clamp(Math.round(period), 1, 15) : 5,
    cycleRegularity: profile.cycleRegularity || 'tidak-tahu',
  };
}

/** Keterangan tiap fase siklus untuk ditampilkan ke pengguna. */
export const PHASES = {
  menstruasi: {
    label: 'Menstruasi', tone: 'period',
    desc: 'Dinding rahim meluruh. Energi biasanya paling rendah di hari-hari awal.',
    tip: 'Istirahat cukup, jaga asupan air, dan hangatkan perut bila kram.',
  },
  folikular: {
    label: 'Fase Folikular', tone: 'follicular',
    desc: 'Tubuh bersiap melepas sel telur. Energi umumnya mulai naik.',
    tip: 'Waktu yang nyaman untuk aktivitas fisik dan mulai kebiasaan baru.',
  },
  subur: {
    label: 'Perkiraan Masa Subur', tone: 'fertile',
    desc: 'Perkiraan jendela subur berdasarkan panjang siklusmu. Ini estimasi, bukan kepastian.',
    tip: 'Cairan serviks biasanya lebih bening dan lentur di masa ini.',
  },
  ovulasi: {
    label: 'Perkiraan Ovulasi', tone: 'ovulation',
    desc: 'Perkiraan hari pelepasan sel telur, biasanya sekitar 14 hari sebelum haid berikutnya.',
    tip: 'Sebagian orang merasa nyeri ringan di satu sisi perut.',
  },
  luteal: {
    label: 'Fase Luteal', tone: 'luteal',
    desc: 'Setelah ovulasi, tubuh menyiapkan kemungkinan kehamilan.',
    tip: 'Nafsu makan bisa meningkat; pilih camilan yang bikin nyaman.',
  },
  pms: {
    label: 'Menjelang Menstruasi', tone: 'pms',
    desc: 'Hari-hari menjelang haid. Mood dan energi bisa naik-turun.',
    tip: 'Catat gejalanya supaya polamu makin mudah dikenali.',
  },
};

/**
 * Lama menstruasi sebuah catatan (inklusif).
 * @param {Period} period
 * @param {number} fallback lama default bila tanggal selesai belum diisi
 * @returns {number}
 */
export function periodLength(period, fallback = 5) {
  if (!period.endDate) return fallback;
  return diffDays(parseISO(period.startDate), parseISO(period.endDate)) + 1;
}

/**
 * Urutkan catatan menstruasi dari yang paling lama.
 * @param {Period[]} periods
 * @returns {Period[]}
 */
export function sortPeriods(periods) {
  return [...periods].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

/**
 * Bentuk daftar siklus dari catatan menstruasi.
 * Satu siklus dimulai pada hari pertama haid dan berakhir sehari sebelum haid berikutnya.
 * @param {Period[]} periods
 * @param {number} avgPeriodLength
 * @returns {Cycle[]}
 */
export function computeCycles(periods, avgPeriodLength = 5) {
  const fallback = Number.isFinite(Number(avgPeriodLength)) && Number(avgPeriodLength) > 0
    ? Math.round(Number(avgPeriodLength)) : 5;
  const sorted = sortPeriods(periods);
  /** @type {Cycle[]} */
  const cycles = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const start = parseISO(cur.startDate);
    const plen = periodLength(cur, fallback);
    if (next) {
      const nextStart = parseISO(next.startDate);
      const len = diffDays(start, nextStart);
      cycles.push({
        id: cur.id, startDate: cur.startDate, endDate: toISO(addDays(nextStart, -1)),
        cycleLength: len, periodLength: plen, ongoing: false,
      });
    } else {
      cycles.push({
        id: cur.id, startDate: cur.startDate, endDate: toISO(addDays(start, Math.max(plen, 1) - 1)),
        cycleLength: null, periodLength: plen, ongoing: true,
      });
    }
  }
  return cycles;
}

/**
 * Statistik siklus pengguna. Bila data belum cukup, nilai dari profil dipakai
 * sebagai perkiraan awal dan ditandai lewat `source`.
 * @param {Period[]} periods
 * @param {ProfileLite} profile
 * @returns {{avgCycleLength:number, avgPeriodLength:number, shortest:number|null,
 *   longest:number|null, closedCycles:number, variability:number|null, source:string,
 *   confidence:'awal'|'berkembang'|'personal'}}
 */
export function cycleStats(periods, profile) {
  const p = resolveProfile(profile);
  const cycles = computeCycles(periods, p.avgPeriodLength);
  const closed = cycles.filter((c) => c.cycleLength != null && c.cycleLength > 0);
  const lengths = closed.map((c) => c.cycleLength);
  const pLens = periods.filter((x) => x.endDate).map((x) => periodLength(x, p.avgPeriodLength));
  const avgCycleLength = lengths.length ? Math.round(mean(lengths)) : p.avgCycleLength;
  const avgPeriodLength = pLens.length ? Math.round(mean(pLens)) : p.avgPeriodLength;
  const shortest = lengths.length ? Math.min(...lengths) : null;
  const longest = lengths.length ? Math.max(...lengths) : null;
  const variability = lengths.length ? longest - shortest : null;
  let confidence = 'awal';
  if (closed.length >= 3) confidence = 'personal';
  else if (closed.length >= 1) confidence = 'berkembang';
  return {
    avgCycleLength: clamp(avgCycleLength, 15, 60),
    avgPeriodLength: clamp(avgPeriodLength, 1, 15),
    shortest, longest, closedCycles: closed.length, variability,
    source: lengths.length ? 'riwayat' : 'profil', confidence,
  };
}

/**
 * Rata-rata panjang siklus N siklus terakhir yang sudah selesai.
 * @param {Period[]} periods
 * @param {number} n
 * @param {number} fallback
 * @returns {number}
 */
export function recentCycleAverage(periods, n, fallback) {
  const closed = computeCycles(periods, fallback).filter((c) => c.cycleLength != null);
  const last = closed.slice(-n).map((c) => c.cycleLength);
  return last.length ? Math.round(mean(last)) : fallback;
}

/**
 * Daftar perkiraan awal siklus setelah catatan terakhir.
 * @param {Period[]} periods
 * @param {number} avgCycleLength
 * @param {Date} until batas akhir proyeksi
 * @returns {string[]} daftar tanggal 'YYYY-MM-DD'
 */
export function projectedStarts(periods, avgCycleLength, until) {
  const sorted = sortPeriods(periods);
  if (!sorted.length) return [];
  const step = clamp(Math.round(avgCycleLength), 15, 60);
  let cursor = parseISO(sorted[sorted.length - 1].startDate);
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < 60; i++) {
    cursor = addDays(cursor, step);
    if (cursor > until) break;
    out.push(toISO(cursor));
  }
  return out;
}

/**
 * Konteks perhitungan: gabungan awal siklus aktual dan perkiraan.
 * @param {Period[]} periods
 * @param {ProfileLite} profile
 * @param {Date} today
 * @param {number} horizonMonths
 * @returns {{starts:{iso:string, projected:boolean}[], avgCycleLength:number, avgPeriodLength:number}}
 */
export function buildCycleContext(periods, profile, today, horizonMonths = 18) {
  const stats = cycleStats(periods, profile);
  const until = addDays(today, Math.round(horizonMonths * 30.5));
  const actual = sortPeriods(periods).map((p) => ({ iso: p.startDate, projected: false }));
  const projected = projectedStarts(periods, stats.avgCycleLength, until)
    .map((iso) => ({ iso, projected: true }));
  const starts = [...actual, ...projected]
    .sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
  return { starts, avgCycleLength: stats.avgCycleLength, avgPeriodLength: stats.avgPeriodLength };
}

/**
 * Informasi siklus untuk satu tanggal.
 * @param {string} dateISO
 * @param {{starts:{iso:string, projected:boolean}[], avgCycleLength:number, avgPeriodLength:number}} ctx
 * @returns {null|{cycleDay:number, cycleLength:number, cycleStart:string, projected:boolean,
 *   phase:PhaseKey, ovulationDay:number, fertileStart:number, fertileEnd:number, isLate:boolean, daysLate:number}}
 */
export function cycleDayFor(dateISO, ctx) {
  const d = parseISO(dateISO);
  let idx = -1;
  for (let i = 0; i < ctx.starts.length; i++) {
    if (parseISO(ctx.starts[i].iso) <= d) idx = i; else break;
  }
  if (idx < 0) return null;
  const start = ctx.starts[idx];
  // Awal perkiraan (projected) tidak boleh menjadi titik tumpu "hari ke-N":
  // saat haid telat, angka itu akan melompat ke siklus perkiraan dan
  // menyembunyikan keterlambatan. Kembalikan tumpuan ke awal catatan
  // menstruasi nyata terdekat sebelum tanggal ini.
  if (start.projected) {
    const anchor = [...ctx.starts.slice(0, idx + 1)].reverse().find((s) => !s.projected);
    if (!anchor) return null;
    return cycleDayInfo(parseISO(anchor.iso), d, ctx.avgCycleLength, ctx.avgPeriodLength, null);
  }
  const next = ctx.starts[idx + 1];
  const startDate = parseISO(start.iso);
  const cycleLength = next ? diffDays(startDate, parseISO(next.iso)) : ctx.avgCycleLength;
  return cycleDayInfo(startDate, d, cycleLength, ctx.avgPeriodLength, next);
}

/**
 * Hitung info hari siklus dari tanggal mulai & tanggal yang ditanyakan.
 * @param {Date} startDate
 * @param {Date} d tanggal yang ditanyakan
 * @param {number} cycleLength
 * @param {number} avgPeriodLength
 * @param {null|{iso:string, projected:boolean}} next awal siklus berikutnya (untuk
 *   menandai keterlambatan; null = belum tahu kapan berakhirnya)
 */
function cycleDayInfo(startDate, d, cycleLength, avgPeriodLength, next) {
  const cycleDay = diffDays(startDate, d) + 1;
  const ovulationDay = Math.max(8, cycleLength - 14);
  const fertileStart = Math.max(1, ovulationDay - 5);
  const fertileEnd = ovulationDay + 1;

  /** @type {PhaseKey} */
  let phase;
  if (cycleDay <= avgPeriodLength) phase = 'menstruasi';
  else if (cycleDay === ovulationDay) phase = 'ovulasi';
  else if (cycleDay >= fertileStart && cycleDay <= fertileEnd) phase = 'subur';
  else if (cycleDay >= cycleLength - 3) phase = 'pms';
  else if (cycleDay < ovulationDay) phase = 'folikular';
  else phase = 'luteal';

  return {
    cycleDay, cycleLength, cycleStart: toISO(startDate), projected: next ? next.projected : false,
    phase,
    ovulationDay, fertileStart, fertileEnd,
    isLate: cycleDay > cycleLength && !next,
    daysLate: cycleDay > cycleLength && !next ? cycleDay - cycleLength : 0,
  };
}

/**
 * Perkiraan menstruasi berikutnya.
 * @param {Period[]} periods
 * @param {ProfileLite} profile
 * @param {Date} today
 * @returns {null|{date:string, daysUntil:number, isLate:boolean, lateBy:number,
 *   avgCycleLength:number, confidence:string, source:string, predictedStarts:string[]}}
 */
export function predictNextPeriod(periods, profile, today) {
  const sorted = sortPeriods(periods);
  if (!sorted.length) return null;
  const stats = cycleStats(periods, profile);
  const step = stats.avgCycleLength;
  const lastStart = parseISO(sorted[sorted.length - 1].startDate);
  const firstPrediction = addDays(lastStart, step);
  const daysUntil = diffDays(today, firstPrediction);
  // Bila perkiraan pertama sudah lewat dan belum ada catatan baru, tampilkan
  // sebagai keterlambatan — bukan diam-diam menggeser siklus.
  const isLate = daysUntil < 0;
  let future = firstPrediction;
  let guard = 0;
  while (future <= today && guard < 60) { future = addDays(future, step); guard++; }
  const predictedStarts = [toISO(future)];
  for (let i = 0; i < 5; i++) predictedStarts.push(toISO(addDays(parseISO(predictedStarts[i]), step)));
  return {
    date: toISO(isLate ? firstPrediction : firstPrediction),
    daysUntil, isLate, lateBy: isLate ? -daysUntil : 0,
    avgCycleLength: step, confidence: stats.confidence, source: stats.source,
    predictedStarts, nextFutureDate: toISO(future),
  };
}

/**
 * Perkiraan hari ovulasi & masa subur untuk siklus yang sedang berjalan.
 * @param {Period[]} periods
 * @param {ProfileLite} profile
 * @param {Date} today
 * @returns {null|{cycleStart:string, ovulationDate:string, fertileStart:string, fertileEnd:string}}
 */
export function currentFertility(periods, profile, today) {
  const ctx = buildCycleContext(periods, profile, today, 2);
  const info = cycleDayFor(toISO(today), ctx);
  if (!info) return null;
  const start = parseISO(info.cycleStart);
  return {
    cycleStart: info.cycleStart,
    ovulationDate: toISO(addDays(start, info.ovulationDay - 1)),
    fertileStart: toISO(addDays(start, info.fertileStart - 1)),
    fertileEnd: toISO(addDays(start, info.fertileEnd - 1)),
  };
}

/**
 * Model kalender: himpunan tanggal untuk tiap status.
 *
 * `monthsBack` membuat horizon mulai dari sejumlah bulan sebelum hari ini,
 * sehingga kalender bisa menampilkan riwayat (bukan hanya prediksi).
 * @param {Period[]} periods
 * @param {ProfileLite} profile
 * @param {Date} today
 * @param {number} monthsAhead
 * @param {number} [monthsBack]
 * @returns {{periodDays:Set<string>, assumedDays:Set<string>, predictedDays:Set<string>,
 *   fertileDays:Set<string>, ovulationDays:Set<string>}}
 */
export function buildCalendarModel(periods, profile, today, monthsAhead = 12, monthsBack = 0) {
  const ctx = buildCycleContext(periods, profile, today, monthsAhead);
  const periodDays = new Set();
  const assumedDays = new Set();
  const predictedDays = new Set();
  const fertileDays = new Set();
  const ovulationDays = new Set();

  for (const p of sortPeriods(periods)) {
    const s = parseISO(p.startDate);
    const len = periodLength(p, ctx.avgPeriodLength);
    for (let i = 0; i < len; i++) {
      const iso = toISO(addDays(s, i));
      periodDays.add(iso);
      if (!p.endDate) assumedDays.add(iso);
    }
  }
  for (const st of ctx.starts.filter((x) => x.projected)) {
    const s = parseISO(st.iso);
    for (let i = 0; i < ctx.avgPeriodLength; i++) predictedDays.add(toISO(addDays(s, i)));
  }
  const horizonEnd = addDays(today, Math.round(monthsAhead * 30.5));
  // Cursor mulai dari catatan paling awal (bukan `today`), sehingga periode
  // masa lalu juga ikut diberi penanda masa subur/ovulasi.
  let cursor = ctx.starts.length ? parseISO(ctx.starts[0].iso) : today;
  for (let i = 0; i < 2400 && cursor <= horizonEnd; i++) {
    const iso = toISO(cursor);
    const info = cycleDayFor(iso, ctx);
    if (info) {
      if (info.phase === 'ovulasi') ovulationDays.add(iso);
      if (info.cycleDay >= info.fertileStart && info.cycleDay <= info.fertileEnd) fertileDays.add(iso);
    }
    cursor = addDays(cursor, 1);
  }
  for (const iso of periodDays) { predictedDays.delete(iso); }
  for (const iso of periodDays) { fertileDays.delete(iso); ovulationDays.delete(iso); }

  return { periodDays, assumedDays, predictedDays, fertileDays, ovulationDays };
}

/**
 * Ringkasan status satu tanggal untuk kalender.
 * @param {string} iso
 * @param {ReturnType<typeof buildCalendarModel>} model
 * @returns {'period'|'assumed'|'predicted'|'ovulation'|'fertile'|'normal'}
 */
export function dayStatus(iso, model) {
  if (model.periodDays.has(iso)) return model.assumedDays.has(iso) ? 'assumed' : 'period';
  if (model.predictedDays.has(iso)) return 'predicted';
  if (model.ovulationDays.has(iso)) return 'ovulation';
  if (model.fertileDays.has(iso)) return 'fertile';
  return 'normal';
}

/**
 * Teks ringkas prediksi untuk dashboard.
 * @param {ReturnType<typeof predictNextPeriod>} prediction
 * @returns {string}
 */
export function predictionHeadline(prediction) {
  if (!prediction) return 'Catat menstruasi pertamamu untuk mulai melihat perkiraan.';
  const d = parseISO(prediction.date);
  if (prediction.daysUntil === 0) return `Haid berikutnya diperkirakan hari ini (${d.getDate()} ${d.getMonth() + 1}).`;
  if (prediction.daysUntil === 1) return 'Haid berikutnya diperkirakan besok.';
  if (prediction.daysUntil > 1) return `Haid berikutnya diperkirakan dalam ${prediction.daysUntil} hari.`;
  return 'Perkiraan haid berikutnya sudah lewat. Catat bila haidmu sudah mulai.';
}

/**
 * Rata-rata panjang siklus dengan satu angka desimal, mis. 28,5 hari.
 * @param {number[]} lengths
 * @returns {string}
 */
export function averageCycleText(lengths) {
  if (!lengths.length) return '-';
  return `${num(round1(mean(lengths)))} hari`;
}

/**
 * Rentang perkiraan haid berikutnya. Untuk siklus yang tidak teratur (atau
 * belum cukup data), satu tanggal pasti bisa menyesatkan — tampilkan rentang.
 *
 * Lebar rentang ditentukan oleh keteraturan dan variasi riwayat:
 * - teratur         : variasi nyata, minimal 3 hari
 * - tidak teratur   : variasi nyata, minimal 5 hari
 * - tidak tahu      : 5 hari
 * Bila sudah ada 2+ siklus tercatat, variasi dihitung dari rentang
 * terpendek–terpanjang; jika tidak, memakai angka keteraturan saja.
 *
 * @param {Period[]} periods
 * @param {ProfileLite} profile
 * @param {Date} today
 * @returns {null|{start:string, end:string, avgDate:string, span:number, basis:string}}
 */
export function predictionRange(periods, profile, today) {
  const pred = predictNextPeriod(periods, profile, today);
  if (!pred) return null;
  const p = resolveProfile(profile);
  const stats = cycleStats(periods, profile);

  // Label "siklusmu belum teratur" hanya boleh muncul bila memang tidak teratur.
  // Karena itu 'teratur' tidak menampilkan rentang (spread 0), 'tidak-tahu'
  // menampilkan rentang kecil, dan 'tidak-teratur' rentang lebar.
  let spread = 0;
  if (p.cycleRegularity === 'tidak-teratur') spread = 2;
  else if (p.cycleRegularity === 'tidak-tahu') spread = 1;

  if (stats.closedCycles >= 2 && stats.variability != null) {
    // Variasi nyata dari riwayat lebih bisa dipercaya daripada asumsi.
    spread = Math.max(spread, Math.min(2, Math.ceil(stats.variability / 2)));
  }
  if (spread < 1) return null;
  const center = parseISO(pred.date);
  return {
    start: toISO(addDays(center, -spread)),
    end: toISO(addDays(center, spread)),
    avgDate: pred.date,
    spread,
    span: spread * 2 + 1,
    basis: stats.closedCycles >= 2 ? 'riwayat' : 'profil',
  };
}
