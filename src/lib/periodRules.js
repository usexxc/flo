/**
 * Aturan validasi catatan haid baru. Murni (tanpa React/LocalStorage) supaya
 * bisa diuji unit.
 *
 * Haid baru ditolak bila:
 *  1. jatuh di dalam haid lain (yang masih berjalan atau sudah ditandai selesai);
 *  2. berjarak kurang dari `minCycle` hari dari awal haid sebelumnya; atau
 *  3. berjarak kurang dari `minCycle` hari sebelum awal haid berikutnya.
 *
 * Aturan 2 dan 3 memeriksa haid TERDEKAT di kedua sisi, bukan haid terbaru
 * saja. Dengan begitu backfill (mencatat haid lama) tetap bisa dilakukan.
 * @module lib/periodRules
 */
import { parseISO, addDays } from './util.js';

/** Batas atas durasi haid (hari), dipakai bila haid belum ditandai selesai. */
export const MAX_PERIOD_DAYS = 15;

/** Jarak siklus minimum (hari) antara dua awal haid. */
export const MIN_CYCLE_DAYS = 10;

/**
 * Selisih hari (a − b) untuk dua tanggal ISO.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function diffDays(a, b) {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
}

/**
 * Periksa apakah `date` boleh dijadikan awal haid baru.
 * @param {Array<{id?:string,startDate:string,endDate?:string}>} periods
 * @param {string} date tanggal ISO yang ingin dicatat
 * @param {{maxDays?:number,minCycle?:number}} [opts]
 * @returns {null | {reason:'inside'|'too-close-before'|'too-close-after', period:object, days?:number}}
 *   null bila boleh; selain itu alasan penolakan beserta haid yang bentrok.
 */
export function checkNewPeriodStart(periods, date, opts = {}) {
  const maxDays = opts.maxDays ?? MAX_PERIOD_DAYS;
  const minCycle = opts.minCycle ?? MIN_CYCLE_DAYS;
  const t = parseISO(date);

  const clash = periods.find((p) => {
    const s = parseISO(p.startDate);
    const e = p.endDate ? parseISO(p.endDate) : addDays(s, maxDays - 1);
    return t >= s && t <= e;
  });
  if (clash) return { reason: 'inside', period: clash };

  const before = periods
    .filter((p) => p.startDate < date)
    .reduce((best, p) => (!best || p.startDate > best.startDate ? p : best), null);
  if (before) {
    const days = diffDays(date, before.startDate);
    if (days < minCycle) return { reason: 'too-close-before', period: before, days };
  }

  const after = periods
    .filter((p) => p.startDate > date)
    .reduce((best, p) => (!best || p.startDate < best.startDate ? p : best), null);
  if (after) {
    const days = diffDays(after.startDate, date);
    if (days < minCycle) return { reason: 'too-close-after', period: after, days };
  }

  return null;
}
