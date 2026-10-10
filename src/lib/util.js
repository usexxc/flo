/**
 * Utilitas umum Flo.
 * Semua tanggal direpresentasikan sebagai Date pada tengah malam waktu lokal,
 * sehingga tidak ada pergeseran zona waktu saat disimpan sebagai 'YYYY-MM-DD'.
 * @module util
 */

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * Ubah 'YYYY-MM-DD' menjadi Date tengah malam lokal.
 * @param {string} iso
 * @returns {Date}
 */
export function parseISO(iso) {
  const p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

/**
 * Ubah Date menjadi 'YYYY-MM-DD' (waktu lokal).
 * @param {Date} date
 * @returns {string}
 */
export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @returns {string} tanggal hari ini sebagai 'YYYY-MM-DD'
 */
export function todayISO() {
  return toISO(new Date());
}

/**
 * Tambah sejumlah hari.
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Selisih hari antara dua tanggal (b - a).
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */
export function diffDays(a, b) {
  const ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
    - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  return Math.round(ms / 86400000);
}

/**
 * @param {string} iso
 * @returns {boolean} apakah string tanggal valid dan benar-benar ada di kalender
 */
export function isValidISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
  const d = parseISO(iso);
  return !Number.isNaN(d.getTime()) && toISO(d) === iso;
}

/** @param {Date} a @param {Date} b @returns {boolean} */
export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** @param {number} year @param {number} month 0-11 @returns {Date} */
export function startOfMonth(year, month) {
  return new Date(year, month, 1);
}

/** @param {number} year @param {number} month 0-11 @returns {number} */
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Matriks kalender 6 baris x 7 kolom, mulai hari Senin.
 * @param {number} year
 * @param {number} month 0-11
 * @returns {Date[][]}
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) row.push(addDays(start, w * 7 + d));
    weeks.push(row);
  }
  return weeks;
}

/** @param {Date} date @returns {string} contoh: '16 Oktober 2026' */
export function formatLong(date) {
  return `${date.getDate()} ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`;
}

/** @param {Date} date @returns {string} contoh: 'Kamis, 16 Oktober 2026' */
export function formatFull(date) {
  return `${DAYS_ID[date.getDay()]}, ${formatLong(date)}`;
}

/** @param {Date} date @returns {string} contoh: '16 Okt 2026' */
export function formatShort(date) {
  return `${date.getDate()} ${MONTHS_ID[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}

/** @param {Date} date @returns {string} contoh: 'Oktober 2026' */
export function formatMonthYear(date) {
  return `${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`;
}

/** @param {number} i 0-11 @returns {string} */
export function monthName(i) { return MONTHS_ID[i]; }

/** @param {number} i 0-6 @returns {string} */
export function dayShort(i) { return DAYS_SHORT[i]; }

/**
 * Jarak hari dalam kata.
 * @param {number} n
 * @returns {string} contoh: '8 hari lagi'
 */
export function humanDays(n) {
  if (n === 0) return 'hari ini';
  if (n === 1) return 'besok';
  if (n === -1) return 'kemarin';
  if (n < 0) return `${Math.abs(n)} hari lalu`;
  return `${n} hari lagi`;
}

/** @returns {string} id unik sederhana */
export function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/** @param {number} n @param {number} min @param {number} max @returns {number} */
export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

/** @param {number[]} arr @returns {number} rata-rata, 0 bila kosong */
export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** @param {number} n @returns {number} dibulatkan 1 desimal */
export function round1(n) { return Math.round(n * 10) / 10; }

/**
 * Tampilkan angka dengan koma sebagai pemisah desimal (kebiasaan Indonesia).
 * @param {number} n
 * @returns {string}
 */
export function num(n) { return String(n).replace('.', ','); }

/**
 * Amankan teks dari input pengguna sebelum dimasukkan ke HTML.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
