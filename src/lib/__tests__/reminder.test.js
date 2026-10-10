import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueReminders, runReminders, notificationPermission } from '../reminder.js';
import { DEFAULT_LEAD_DAYS } from '../reminder.js';

/**
 * @typedef {{ periods?: Array<{startDate?:string,start?:string}>,
 *             dailyLogs?: Array<{date:string}>,
 *             symptoms?: Array<{date:string}>,
 *             notified?: string[],
 *             profile?: Record<string, unknown> }} StateLike
 */

/** State minimum yang bisa dihitung `predictNextPeriod`. */
const baseState = () => {
  const today = new Date();
  const d = (n) => {
    const x = new Date(today);
    x.setDate(x.getDate() - n);
    const p = (v) => String(v).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  };
  return {
    profile: { averageCycleLength: 28, averagePeriodLength: 5 },
    // Haid terakhir 14 hari lalu → diperkirakan mulai lagi dalam 14 hari.
    periods: [{ startDate: d(14) }],
    dailyLogs: [],
    symptoms: [],
    notified: [],
  };
};

test('tidak memunculkan apa pun kalau pengingat dimatikan', () => {
  const state = baseState();
  state.profile.reminderSettings = { enabled: false };
  const out = dueReminders({ state, today: new Date() });
  assert.equal(out.length, 0);
});

test('pengingat "catat harian" muncul saat belum ada log hari ini', () => {
  const out = dueReminders({ state: baseState(), today: new Date() });
  const kinds = out.map((r) => r.kind);
  assert.ok(kinds.includes('log-today'), `kinds=${kinds.join(',')}`);
});

test('pengingat harian hilang setelah ada log di hari ini', () => {
  const state = baseState();
  const p = (v) => String(v).padStart(2, '0');
  const t = new Date();
  state.dailyLogs = [{ date: `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}` }];
  const out = dueReminders({ state, today: t });
  assert.ok(!out.some((r) => r.kind === 'log-today'));
});

test('tidak muncul dua kali pada hari yang sama', () => {
  const today = new Date();
  const p = (v) => String(v).padStart(2, '0');
  const key = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;

  const state = baseState();
  let mutated = null;
  const onMutate = (fn) => { mutated = fn; fn(state); };

  const first = runReminders({ state, today, onMutate });
  const second = runReminders({ state, today, onMutate });

  assert.ok(first.length > 0, 'panggilan pertama harus memunculkan pengingat');
  assert.equal(second.length, 0, 'panggilan kedua tidak boleh memunculkan lagi');
  assert.ok((state.notified || []).length > 0, 'kunci sudah-tampil harus tersimpan');
});

test('penanda sudah-tampil dipangkas saat daftarnya terlalu panjang', () => {
  const state = baseState();
  state.notified = Array.from({ length: 260 }, (_, i) => `old:${i}:2020-01-01`);
  const before = state.notified.length;
  runReminders({ state, today: new Date(), onMutate: (fn) => fn(state) });
  // Pemangkasan terjadi saat baris berikutnya perlu dicatat.
  runReminders({ state, today: new Date(), onMutate: (fn) => fn(state) });
  assert.ok(state.notified.length <= before, 'daftar tidak boleh tumbuh tanpa batas');
});

test('izin notifikasi dilaporkan tanpa melempar di lingkungan non-peramban', () => {
  // Di Node tidak ada `window`, jadi harus jatuh ke 'unsupported' — bukan error.
  assert.equal(notificationPermission(), 'unsupported');
});

test('leadDays dihormati dan dibatasi', () => {
  const state = baseState();
  state.profile.reminderSettings = { leadDays: 3 };
  const out = dueReminders({ state, today: new Date() });
  // Tidak ada haid dalam 3 hari (siklus 28, terakhir 14 hari lalu), jadi
  // pengingat periode tidak muncul — hanya log harian.
  assert.ok(out.every((r) => r.kind !== 'period-approaching'));
  assert.equal(DEFAULT_LEAD_DAYS, 2);
});
