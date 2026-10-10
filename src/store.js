/**
 * Store aplikasi Flo versi React.
 *
 * LocalStorage tetap menjadi sumber kebenaran (satu arah: tulis → simpan →
 * beritahu). Seluruh komponen membaca lewat `useFlo()` yang membungkus
 * `useSyncExternalStore`, sehingga render selalu konsisten dengan data tersimpan
 * dan tidak ada state ganda yang bisa saling mengalahkan.
 *
 * Modul logika murni (storage/cycle/util) dipakai apa adanya dari `src/lib`.
 */
import { useSyncExternalStore, useCallback, useMemo } from 'react';
import {
  loadState, saveState, clearAll, normalize, defaultState, KEYS,
} from './lib/storage.js';
import {
  computeCycles, buildCalendarModel, cycleStats, predictNextPeriod,
  cycleDayFor, buildCycleContext, predictionRange,
} from './lib/cycle.js';
import { toISO, monthName, daysInMonth } from './lib/util.js';

/** Nama hari Indonesia dengan urutan grid Senin→Minggu. */
const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/**
 * Ubah model kalender (Set tanggal) menjadi daftar bulan siap render.
 * `buildCalendarModel` mengembalikan Set; MiniCalendar ingin grid bulan, jadi
 * adaptasi dibuat di sini — mesin siklusnya sendiri tidak perlu diubah.
 *
 * Rentang bulan meliputi sejumlah bulan ke belakang dan ke depan dari bulan
 * hari ini, supaya tombol "Bulan sebelumnya" tetap berfungsi.
 *
 * @param {ReturnType<typeof buildCalendarModel>} model
 * @param {Date} today
 * @param {number} [monthsBack] jumlah bulan sebelum bulan hari ini
 * @param {number} [monthsAhead] jumlah bulan sesudah bulan hari ini
 * @returns {Array<{key:string,label:string,containsToday:boolean,cells:object[]}>}
 */
function calendarMonths(model, today, monthsBack = 12, monthsAhead = 12) {
  const todayIso = toISO(today);
  const months = [];
  for (let i = -monthsBack; i <= monthsAhead; i++) {
    const anchor = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const total = daysInMonth(year, month);
    const firstDow = new Date(year, month, 1).getDay(); // 0=Min
    const lead = (firstDow + 6) % 7; // geser ke urutan Senin
    const cells = [];

    for (let d = 1; d <= total; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let st = 'plain';
      if (model.periodDays?.has(iso)) st = 'period';
      else if (model.predictedDays?.has(iso)) st = 'predicted';
      else if (model.ovulationDays?.has(iso)) st = 'ovulation';
      else if (model.fertileDays?.has(iso)) st = 'fertile';
      cells.push({
        iso,
        day: d,
        dow: DOW[new Date(year, month, d).getDay() === 0 ? 6 : new Date(year, month, d).getDay() - 1],
        state: st,
        assumed: model.assumedDays?.has(iso) || false,
        isToday: iso === todayIso,
        inMonth: true,
      });
    }

    months.push({
      key: `${year}-${month}`,
      label: `${monthName(month)} ${year}`,
      containsToday: today.getFullYear() === year && today.getMonth() === month,
      cells,
    });
  }
  return months;
}

/** @type {import('../lib/storage.js').FloState} */
let state = loadState();

const listeners = new Set();

/** Beri tahu seluruh pelanggan bahwa state berubah. */
function emit() {
  listeners.forEach((fn) => fn());
}

/** Ambil snapshot saat ini (harus referensi stabil bila tidak berubah). */
function getSnapshot() {
  return state;
}

/**
 * Langganan perubahan state.
 * @param {() => void} fn
 */
function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Simpan state ke LocalStorage lalu beritahu pelanggan.
 *
 * `useSyncExternalStore` hanya me-render ulang bila `getSnapshot()`
 * mengembalikan referensi BERBEDA. Mutasi di tempat (`s.periods.push(...)`)
 * membuat `state` tetap objek yang sama, sehingga perubahan tidak terlihat
 * sampai halaman dimuat ulang. Karena itu state selalu dibekukan menjadi objek
 * baru di sini sebelum disimpan.
 * @param {boolean} [silent] true bila hanya perlu menyimpan tanpa render ulang
 * @returns {boolean} apakah penyimpanan berhasil
 */
function commit(silent = false) {
  // flo_cycles adalah data turunan: selalu dihitung ulang dari catatan
  // menstruasi sebelum disimpan, sehingga cache tidak pernah usang.
  try {
    state.cycles = computeCycles(state.periods, state.profile.averagePeriodLength);
  } catch (err) {
    console.warn('Siklus tidak dapat dihitung ulang saat menyimpan.', err);
  }
  // Bekukan menjadi referensi baru supaya useSyncExternalStore mendeteksi
  // perubahan. JSON round-trip memastikan tidak ada objek berbagi referensi
  // dengan snapshot lama.
  state = JSON.parse(JSON.stringify(state));
  const ok = saveState(state);
  if (!silent) emit();
  return ok;
}

/**
 * Jalankan mutasi pada state lalu simpan. Fungsi `fn` boleh memakai mutasi
 * biasa (push/splice/assign) — `commit()` yang mengubah referensi state.
 * @param {(s:import('../lib/storage.js').FloState)=>void} fn
 */
export function mutate(fn) {
  fn(state);
  commit();
}

/**
 * Ganti seluruh state (dipakai impor data).
 * @param {import('../lib/storage.js').FloState|unknown} next
 */
export function replaceState(next) {
  state = normalize(next);
  commit();
}

/**
 * Reset total: hapus seluruh data dari LocalStorage dan kembalikan aplikasi ke
 * kondisi awal. Penyimpanan sengaja dibiarkan kosong — persis seperti kunjungan
 * pertama — sehingga tidak ada sisa data pengguna di perangkat.
 */
export function resetAll() {
  clearAll();
  state = defaultState();
  emit();
}

/**
 * Reset onboarding saja: pengguna kembali ke alur 7 pertanyaan tetapi catatan
 * menstruasi/gejala yang sudah ada tetap dipertahankan.
 */
export function restartOnboarding() {
  state.profile.onboarded = false;
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(KEYS.onboarding); } catch (err) { console.warn(err); }
  }
  commit();
}

/**
 * Baca state + turunannya. Dipakai di dalam komponen React.
 * @param {Date} [today]
 */
export function useFlo(today = new Date()) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const todayKey = toISO(today);
  const derived = useMemo(() => {
    const d = {
      todayIso: todayKey,
      stats: cycleStats(snap.periods, snap.profile),
      prediction: predictNextPeriod(snap.periods, snap.profile, today),
      ctx: buildCycleContext(snap.periods, snap.profile, today, 14),
      model: calendarMonths(
        buildCalendarModel(snap.periods, snap.profile, today, 12, 12), today,
      ),
      range: predictionRange(snap.periods, snap.profile, today),
      todayLog: snap.dailyLogs.find((l) => l.date === todayKey) || null,
      todaySymptoms: snap.symptoms.filter((s) => s.date === todayKey),
    };
    d.info = cycleDayFor(todayKey, d.ctx);
    return d;
    // `snap` adalah objek state yang diganti penuh setiap mutasi, jadi cukup
  }, [snap, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { state: snap, d: derived };
}

/**
 * Aksi tulis yang stabil (tidak berubah antar render).
 */
export function useFloActions() {
  const write = useCallback((fn) => { mutate(fn); }, []);
  const replace = useCallback((next) => { replaceState(next); }, []);
  const reset = useCallback(() => { resetAll(); }, []);
  const restart = useCallback(() => { restartOnboarding(); }, []);
  return useMemo(
    () => ({ mutate: write, replaceState: replace, resetAll: reset, restartOnboarding: restart }),
    [write, replace, reset, restart],
  );
}
