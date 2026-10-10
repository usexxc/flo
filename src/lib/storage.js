/**
 * Lapisan penyimpanan Flo. Seluruh data disimpan di LocalStorage perangkat
 * pengguna — tidak ada pengiriman data ke server pada versi ini.
 *
 * Tiap kelompok data disimpan pada key terpisah:
 *
 *   flo_profile              profil pengguna + hasil onboarding
 *   flo_periods              daftar catatan menstruasi
 *   flo_symptoms             daftar catatan gejala
 *   flo_cycles               siklus yang sudah dihitung (cache turunan)
 *   flo_settings             pengaturan aplikasi, pengingat, penanda
 *   flo_onboarding_completed penanda onboarding sudah selesai
 *   flo_logs                 catatan harian (mood, energi, flow, catatan)
 *
 * Migrasi: bila ditemukan key lama `flo.data.v1` (versi awal), isinya
 * dipindahkan ke key-key di atas lalu key lama dihapus.
 * @module storage
 */

import { uid, todayISO } from './util.js';

/** Key lama sebelum pemisahan multi-key. */
export const STORAGE_KEY = 'flo.data.v1';
export const LEGACY_KEY = 'flo.data.v1';

/** @type {Record<string, string>} */
export const KEYS = {
  profile: 'flo_profile',
  periods: 'flo_periods',
  symptoms: 'flo_symptoms',
  cycles: 'flo_cycles',
  settings: 'flo_settings',
  onboarding: 'flo_onboarding_completed',
  logs: 'flo_logs',
};

/** Daftar seluruh key Flo di LocalStorage (untuk pengujian & reset). */
export const STORAGE_KEYS = Object.values(KEYS);

/** Penanda migrasi di dalam settings agar tidak diulang. */
const MIGRATED_FLAG = 'migratedFromLegacy';

/**
 * @typedef {Object} UserProfile
 * @property {string} name nama panggilan
 * @property {number} averageCycleLength rata-rata panjang siklus (hari)
 * @property {number} averagePeriodLength rata-rata lama menstruasi (hari)
 * @property {'teratur'|'tidak-teratur'|'tidak-tahu'} cycleRegularity
 * @property {string} lastPeriodStart hari pertama haid terakhir
 * @property {boolean} onboarded
 * @property {string[]} onboardingAnswers jawaban onboarding (untuk insight)
 * @property {ReminderSettings} reminderSettings
 */

/**
 * @typedef {Object} ReminderSettings
 * @property {boolean} periodApproaching pengingat perkiraan haid
 * @property {boolean} logPeriod pengingat mencatat haid
 * @property {boolean} logSymptoms pengingat mencatat gejala
 * @property {boolean} water pengingat minum air
 * @property {boolean} custom
 * @property {string} customText
 * @property {string} customTime 'HH:MM'
 * @property {string} notifyTime jam pengingat harian
 * @property {boolean} enabled master switch
 * @property {number} leadDays jumlah hari sebelum perkiraan haid
 */

/**
 * @typedef {Object} FloState
 * @property {number} version
 * @property {UserProfile} profile
 * @property {import('./cycle.js').Period[]} periods
 * @property {Object[]} symptoms
 * @property {Object[]} dailyLogs
 * @property {Object[]} cycles cache siklus yang sudah dihitung
 * @property {string[]} notified penanda pengingat yang sudah tampil
 */

/** @returns {ReminderSettings} */
export function defaultReminders() {
  return {
    enabled: false,
    periodApproaching: true,
    logPeriod: true,
    logSymptoms: true,
    water: false,
    custom: false,
    customText: 'Minum air 8 gelas hari ini',
    customTime: '10:00',
    notifyTime: '20:00',
    leadDays: 2,
  };
}

/**
 * State awal sebelum onboarding diisi.
 * @returns {FloState}
 */
export function defaultState() {
  return {
    version: 1,
    profile: {
      name: '',
      averageCycleLength: 28,
      averagePeriodLength: 5,
      cycleRegularity: 'tidak-tahu',
      lastPeriodStart: todayISO(),
      onboarded: false,
      onboardingAnswers: [],
      reminderSettings: defaultReminders(),
    },
    periods: [],
    symptoms: [],
    dailyLogs: [],
    cycles: [],
    notified: [],
  };
}

/* ---------------------------------------------------------------
 * Baca/tulis per key
 * ------------------------------------------------------------- */

/**
 * Baca sebuah key JSON dari LocalStorage dengan aman.
 * @param {string} key
 * @param {any} fallback
 * @returns {any}
 */
function readKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (err) {
    console.warn(`Data Flo pada key "${key}" tidak dapat dibaca.`, err);
    return fallback;
  }
}

/**
 * Tulis sebuah key JSON ke LocalStorage.
 * @param {string} key
 * @param {any} value
 * @returns {boolean} berhasil atau tidak
 */
function writeKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('Data Flo tidak dapat disimpan (penyimpanan penuh atau diblokir).', err);
    return false;
  }
}

/**
 * Hapus sebuah key.
 * @param {string} key
 */
function dropKey(key) {
  try { localStorage.removeItem(key); } catch (err) { console.warn(err); }
}

/**
 * Pindahkan data dari key lama `flo.data.v1` ke key-key terpisah. Dijalankan
 * sekali; penanda di `flo_settings` mencegah pengulangan.
 * @returns {boolean} true bila migrasi terjadi
 */
function migrateFromLegacy() {
  let raw = null;
  try { raw = localStorage.getItem(LEGACY_KEY); } catch (err) { return false; }
  if (!raw) return false;

  const settings = readKey(KEYS.settings, {});
  if (settings && settings[MIGRATED_FLAG]) return false;

  /** @type {any} */
  let legacy = null;
  try { legacy = JSON.parse(raw); } catch (err) {
    console.warn('Data lama Flo tidak dapat dibaca, memulai dari awal.', err);
    writeKey(KEYS.settings, { ...settings, [MIGRATED_FLAG]: true });
    return false;
  }
  if (!legacy || typeof legacy !== 'object') {
    writeKey(KEYS.settings, { ...settings, [MIGRATED_FLAG]: true });
    return false;
  }

  const base = defaultState();
  const profile = { ...base.profile, ...(legacy.profile || {}) };
  profile.reminderSettings = { ...base.profile.reminderSettings, ...((legacy.profile || {}).reminderSettings || {}) };
  if (!Array.isArray(profile.onboardingAnswers)) profile.onboardingAnswers = [];

  writeKey(KEYS.profile, profile);
  writeKey(KEYS.periods, Array.isArray(legacy.periods) ? legacy.periods.filter((p) => p && p.startDate) : []);
  writeKey(KEYS.symptoms, Array.isArray(legacy.symptoms) ? legacy.symptoms : []);
  writeKey(KEYS.logs, Array.isArray(legacy.dailyLogs) ? legacy.dailyLogs : []);
  writeKey(KEYS.settings, {
    ...settings,
    notified: Array.isArray(legacy.notified) ? legacy.notified : [],
    [MIGRATED_FLAG]: true,
  });
  if (profile.onboarded) writeKey(KEYS.onboarding, true);
  dropKey(LEGACY_KEY);
  return true;
}

/**
 * Normalkan satu catatan harian dari format lama maupun baru.
 *
 * Versi vanilla menyimpan `notes` dan `habits` sebagai OBJEK, sementara
 * versi React memakai `note` (string) dan `habits` sebagai himpunan id.
 * Tanpa normalisasi ini, `new Set(objek)` melempar TypeError sehingga form
 * harian crash, dan catatan lama tidak muncul karena field-nya `notes`.
 *
 * @param {unknown} raw
 * @returns {Object|null} entri harian yang sudah dinormalkan
 */
function normalizeDailyLog(raw) {
  if (!raw || typeof raw !== 'object' || !raw.date) return null;
  /** @type {any} */
  const l = raw;
  // `notes` (lama) → `note` (baru); objek tidak bisa dipakai sebagai teks.
  const note = typeof l.note === 'string'
    ? l.note
    : typeof l.notes === 'string'
      ? l.notes
      : '';
  // `habits` boleh berupa objek {id:true}, array id, atau himpunan.
  const habits = {};
  if (l.habits && typeof l.habits === 'object') {
    for (const [k, v] of Object.entries(l.habits)) {
      if (v) habits[k] = true;
    }
  } else if (Array.isArray(l.habits)) {
    for (const id of l.habits) {
      if (typeof id === 'string') habits[id] = true;
    }
  }
  return {
    id: typeof l.id === 'string' ? l.id : uid(),
    date: String(l.date).slice(0, 10),
    mood: l.mood || '',
    energy: l.energy || '',
    flow: l.flow || '',
    note,
    habits,
  };
}

/**
 * Pastikan state yang dibaca punya semua field yang dibutapkan.
 * @param {unknown} raw
 * @returns {FloState}
 */
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const s = /** @type {any} */ (raw);
  const profile = s.profile && typeof s.profile === 'object' ? s.profile : {};
  return {
    version: 1,
    profile: { ...base.profile, ...profile, reminderSettings: { ...base.profile.reminderSettings, ...(profile.reminderSettings || {}) } },
    periods: Array.isArray(s.periods) ? s.periods.filter((p) => p && p.startDate) : [],
    symptoms: Array.isArray(s.symptoms) ? s.symptoms.filter((x) => x && x.date) : [],
    dailyLogs: Array.isArray(s.dailyLogs)
      ? s.dailyLogs.map(normalizeDailyLog).filter(Boolean)
      : [],
    cycles: Array.isArray(s.cycles) ? s.cycles : [],
    notified: Array.isArray(s.notified) ? s.notified : [],
  };
}

/**
 * Baca state dari LocalStorage (semua key digabung).
 * @returns {FloState}
 */
export function loadState() {
  migrateFromLegacy();
  const settings = readKey(KEYS.settings, {}) || {};
  return normalize({
    version: 1,
    profile: readKey(KEYS.profile, null),
    periods: readKey(KEYS.periods, []),
    symptoms: readKey(KEYS.symptoms, []),
    dailyLogs: readKey(KEYS.logs, []),
    cycles: readKey(KEYS.cycles, []),
    notified: Array.isArray(settings.notified) ? settings.notified : [],
  });
}

/**
 * Simpan state ke LocalStorage, dipisah per key. Daftar siklus dihitung ulang
 * di sini sehingga `flo_cycles` selalu konsisten dengan catatan menstruasi.
 * @param {FloState} state
 * @returns {boolean} berhasil atau tidak
 */
export function saveState(state) {
  const settings = readKey(KEYS.settings, {}) || {};
  settings.notified = Array.isArray(state.notified) ? state.notified : [];
  settings[MIGRATED_FLAG] = true;

  let ok = true;
  ok = writeKey(KEYS.profile, state.profile) && ok;
  ok = writeKey(KEYS.periods, state.periods) && ok;
  ok = writeKey(KEYS.symptoms, state.symptoms) && ok;
  ok = writeKey(KEYS.cycles, state.cycles) && ok;
  ok = writeKey(KEYS.logs, state.dailyLogs) && ok;
  ok = writeKey(KEYS.settings, settings) && ok;
  if (state.profile && state.profile.onboarded) {
    ok = writeKey(KEYS.onboarding, true) && ok;
  } else {
    dropKey(KEYS.onboarding);
  }
  return ok;
}

/**
 * Hapus seluruh data Flo dari perangkat (semua key).
 */
export function clearState() {
  clearAll();
}

/**
 * Hapus seluruh key Flo dari perangkat.
 */
export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('flo.') || k.startsWith('flo_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch (err) { console.warn(err); }
}

/**
 * Apakah aplikasi berjalan di dalam cangkang Android (APK)? Di WebView, unduhan
 * blob tidak ditangani sama sekali sehingga tombol Export akan diam-diam gagal.
 * @returns {boolean}
 */
export function hasNativeBridge() {
  return typeof window !== 'undefined' && typeof window.FloNative?.saveDataFile === 'function';
}

/**
 * Ekspor seluruh data sebagai file JSON. Daftar siklus ikut disertakan sebagai
 * data turunan supaya berkas cadangan lengkap, meskipun di aplikasi siklus
 * selalu dihitung ulang dari catatan menstruasi (satu sumber kebenaran).
 *
 * Di browser berkas diunduh lewat blob. Di APK berkas disimpan lewat jembatan
 * native karena WebView tidak menangani unduhan blob.
 *
 * @param {FloState} state
 * @param {import('./cycle.js').Cycle[]} [cycles]
 * @returns {string} keterangan lokasi berkas untuk ditampilkan ke pengguna
 */
export function exportData(state, cycles = []) {
  const payload = {
    app: 'Flo', version: 1, exportedAt: new Date().toISOString(),
    data: state,
    cycles,
  };
  const json = JSON.stringify(payload, null, 2);
  const fileName = `flo-data-${todayISO()}.json`;

  if (hasNativeBridge()) {
    try {
      return window.FloNative.saveDataFile(fileName, json);
    } catch (err) {
      console.warn('Penyimpanan lewat jembatan native gagal, memakai unduhan biasa.', err);
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

/**
 * Impor data dari file JSON hasil ekspor.
 * @param {string} text isi file
 * @returns {FloState} state yang sudah dinormalkan
 * @throws {Error} bila format tidak dikenali
 */
export function importData(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (err) { throw new Error('File tidak dapat dibaca. Pastikan file JSON hasil ekspor Flo.'); }
  const raw = parsed && parsed.data ? parsed.data : parsed;
  if (!raw || typeof raw !== 'object' || (!Array.isArray(raw.periods) && !raw.profile)) {
    throw new Error('Struktur data tidak dikenali. Gunakan file hasil ekspor Flo.');
  }
  const state = normalize(raw);
  state.profile.onboarded = true;
  return state;
}

/**
 * Catat/ubah data harian (mood, energi, flow, catatan, kebiasaan) untuk satu tanggal.
 * @param {FloState} state
 * @param {string} date
 * @param {Object} patch
 * @returns {Object} entri harian hasil penggabungan
 */
export function upsertDailyLog(state, date, patch) {
  let entry = state.dailyLogs.find((l) => l.date === date);
  if (!entry) {
    entry = { id: uid(), date, mood: '', energy: '', flow: '', notes: '', habits: {} };
    state.dailyLogs.push(entry);
  }
  Object.assign(entry, patch);
  if (patch.habits) entry.habits = { ...entry.habits, ...patch.habits };
  return entry;
}

/**
 * Hapus entri harian bila seluruh isinya kosong.
 * @param {FloState} state
 * @param {string} date
 * @returns {boolean} true bila entri dihapus
 */
export function pruneDailyLog(state, date) {
  const i = state.dailyLogs.findIndex((l) => l.date === date);
  if (i < 0) return false;
  const l = state.dailyLogs[i];
  const habits = Object.values(l.habits || {}).filter(Boolean).length;
  const empty = !l.mood && !l.energy && !l.flow && !l.notes && habits === 0;
  if (empty) { state.dailyLogs.splice(i, 1); return true; }
  return false;
}

/**
 * Tambah atau perbarui catatan gejala pada satu tanggal.
 * @param {FloState} state
 * @param {string} date
 * @param {string} category
 * @param {string} symptom
 * @param {boolean} active
 * @param {string} severity
 * @param {string} notes
 */
export function toggleSymptom(state, date, category, symptom, active, severity = 'ringan', notes = '') {
  const i = state.symptoms.findIndex((s) => s.date === date && s.category === category && s.symptom === symptom);
  if (active && i < 0) {
    state.symptoms.push({ id: uid(), date, category, symptom, severity, notes });
  } else if (active && i >= 0) {
    state.symptoms[i].severity = severity;
    state.symptoms[i].notes = notes;
  } else if (!active && i >= 0) {
    state.symptoms.splice(i, 1);
  }
}

/**
 * Daftar gejala pada satu tanggal.
 * @param {FloState} state
 * @param {string} date
 * @returns {Object[]}
 */
export function symptomsOn(state, date) {
  return state.symptoms.filter((s) => s.date === date);
}

/**
 * Tambah catatan menstruasi baru.
 * @param {FloState} state
 * @param {{startDate:string, endDate?:string, flow?:string, notes?:string}} data
 * @returns {import('./cycle.js').Period}
 */
export function addPeriod(state, data) {
  const p = {
    id: uid(),
    startDate: data.startDate,
    endDate: data.endDate || '',
    flow: data.flow || 'medium',
    notes: data.notes || '',
  };
  state.periods.push(p);
  return p;
}

/**
 * Perbarui catatan menstruasi.
 * @param {FloState} state
 * @param {string} id
 * @param {{startDate:string, endDate?:string, flow?:string, notes?:string}} data
 * @returns {boolean} ditemukan atau tidak
 */
export function updatePeriod(state, id, data) {
  const p = state.periods.find((x) => x.id === id);
  if (!p) return false;
  p.startDate = data.startDate;
  p.endDate = data.endDate || '';
  p.flow = data.flow || 'medium';
  p.notes = data.notes || '';
  return true;
}

/**
 * Hapus catatan menstruasi.
 * @param {FloState} state
 * @param {string} id
 * @returns {boolean}
 */
export function deletePeriod(state, id) {
  const i = state.periods.findIndex((p) => p.id === id);
  if (i < 0) return false;
  state.periods.splice(i, 1);
  return true;
}
