/**
 * Pengingat lokal.
 *
 * Dua saluran, keduanya tanpa server:
 *  1. Notifikasi sistem lewat `Notification API` (perlu izin pengguna).
 *  2. Papan pengingat di dalam aplikasi, selalu tampil walau izin notifikasi
 *     ditolak — supaya fiturnya tidak cuma pajangan.
 *
 * Setiap pengingat yang sudah tampil dicatat di `state.notified` (format
 * `${jenis}:${tanggal}:${tanggalHariIni}`) agar tidak muncul berulang di hari
 * yang sama.
 * @module reminder
 */

import { toISO } from './util.js';
import { predictNextPeriod } from './cycle.js';

/** Hari sebelum perkiraan haid saat pengingat mulai muncul. */
export const DEFAULT_LEAD_DAYS = 2;

/** Jenis pengingat yang dikenali. */
const KINDS = ['period-approaching', 'period-late', 'log-today'];

/**
 * Izin notifikasi sistem pada peramban ini.
 * @returns {'unsupported'|'default'|'granted'|'denied'}
 */
export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Minta izin notifikasi. Hanya boleh dipanggil dari aksi pengguna (klik) —
 * peramban menolak permintaan di luar gesture.
 * @returns {Promise<'unsupported'|'default'|'granted'|'denied'>}
 */
export async function requestNotificationPermission() {
  if (notificationPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.warn('Izin notifikasi tidak dapat diminta.', err);
    return notificationPermission();
  }
}

/**
 * Tampilkan satu notifikasi sistem bila izin sudah diberikan.
 * @param {string} title
 * @param {string} body
 */
function notify(title, body) {
  if (notificationPermission() !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: 'flo-reminder' });
    // Tutup otomatis supaya tidak menumpuk di tray.
    setTimeout(() => n.close(), 12_000);
  } catch (err) {
    console.warn('Notifikasi tidak dapat ditampilkan.', err);
  }
}

/**
 * Susun daftar pengingat yang berlaku untuk hari ini.
 *
 * Aturan:
 *  - `period-approaching` : haid diperkirakan mulai dalam `leadDays` hari.
 *  - `period-late`        : perkiraan sudah lewat dan belum dicatat.
 *  - `log-today`          : belum ada catatan harian apa pun untuk hari ini.
 *
 * @param {Object} p
 * @param {import('./storage.js').FloState} p.state
 * @param {Date} p.today
 * @returns {Array<{kind:string, title:string, body:string, key:string}>}
 */
export function dueReminders({ state, today }) {
  const out = [];
  const settings = state.profile?.reminderSettings || {};
  if (settings.enabled === false) return out;

  const todayKey = toISO(today);
  const leadDays = Number.isFinite(Number(settings.leadDays))
    ? Math.max(1, Math.min(14, Number(settings.leadDays)))
    : DEFAULT_LEAD_DAYS;

  const add = (kind, title, body) => {
    const key = `${kind}:${body === '' ? todayKey : ''}:${todayKey}`;
    out.push({ kind, title, body, key });
  };

  if (settings.periodApproaching !== false || settings.logPeriod !== false) {
    const pred = predictNextPeriod(state.periods, state.profile, today);
    if (pred) {
      if (pred.isLate && pred.lateBy > 0) {
        if (settings.periodApproaching !== false) {
          add('period-late', 'Haid diperkirakan sudah lewat',
            `Sudah ${pred.lateBy} hari lewat dari perkiraan. Catat kalau haidmu sudah mulai.`);
        }
      } else if (pred.daysUntil >= 0 && pred.daysUntil <= leadDays) {
        if (settings.periodApproaching !== false) {
          add('period-approaching',
            pred.daysUntil === 0 ? 'Haid diperkirakan mulai hari ini' : 'Haid diperkirakan sebentar lagi',
            pred.daysUntil === 0
              ? 'Siapkan catatanmu dan periksa lagi sinyal tubuhmu.'
              : `Perkiraan haid berikutnya ${pred.daysUntil} hari lagi.`);
        }
      }
    }
  }

  const logged = state.dailyLogs.some((l) => l.date === todayKey)
    || state.symptoms.some((s) => s.date === todayKey);
  if (!logged && settings.logPeriod !== false) {
    add('log-today', 'Catat harianmu', 'Belum ada catatan untuk hari ini.');
  }

  // Saring yang sudah tampil hari ini.
  const seen = new Set(state.notified || []);
  return out.filter((r) => !seen.has(r.key));
}

/**
 * Tampilkan pengingat yang belum pernah muncul hari ini, lalu catat kuncinya.
 *
 * @param {Object} p
 * @param {import('./storage.js').FloState} p.state
 * @param {Date} p.today
 * @param {(fn:(s:object)=>void)=>void} p.onMutate
 * @returns {Array<{kind:string,title:string,body:string,key:string}>} yang ditampilkan
 */
export function runReminders({ state, today, onMutate }) {
  const due = dueReminders({ state, today });
  if (!due.length) return [];

  for (const r of due) notify(r.title, r.body);

  onMutate((s) => {
    const keys = new Set(s.notified || []);
    for (const r of due) keys.add(r.key);
    // Buang penanda lebih tua dari seminggu agar LocalStorage tidak membengkak.
    s.notified = [...keys].slice(-200);
  });

  return due;
}

/**
 * Aktifkan pengingat sekaligus meminta izin notifikasi.
 * @returns {Promise<'unsupported'|'default'|'granted'|'denied'>}
 */
export async function enableReminders() {
  return requestNotificationPermission();
}

/**
 * Keterangan status izin untuk ditampilkan ke pengguna.
 * @returns {{tone:'ok'|'warn'|'danger', text:string}}
 */
export function reminderPermissionNotice() {
  switch (notificationPermission()) {
    case 'granted':
      return { tone: 'ok', text: 'Notifikasi sistem aktif. Pengingat juga tetap tampil di dalam aplikasi.' };
    case 'denied':
      return { tone: 'warn', text: 'Notifikasi sistem diblokir di pengaturan peramban. Pengingat tetap tampil di dalam aplikasi.' };
    case 'unsupported':
      return { tone: 'warn', text: 'Peramban ini tidak mendukung notifikasi sistem. Pengingat tampil di dalam aplikasi.' };
    default:
      return { tone: 'warn', text: 'Izin notifikasi belum diberikan. Pengingat tetap tampil di dalam aplikasi.' };
  }
}
