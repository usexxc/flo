/**
 * Uji mesin siklus Flo (logika murni, tanpa browser).
 * Jalankan: node --test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCycles, cycleStats, periodLength, predictNextPeriod, cycleDayFor,
  buildCycleContext, buildCalendarModel, dayStatus, averageCycleText, recentCycleAverage,
  resolveProfile,
} from '../cycle.js';
import { parseISO, toISO, addDays, diffDays, isValidISO, monthGrid, humanDays, num } from '../util.js';

/** @returns {import('../cycle.js').Period} */
function period(id, start, end, flow = 'medium') {
  return { id, startDate: start, endDate: end || '', flow, notes: '' };
}

const profile = { avgCycleLength: 28, avgPeriodLength: 5, cycleRegularity: 'teratur' };
const periods = [
  period('a', '2026-06-01', '2026-06-05'),
  period('b', '2026-06-29', '2026-07-03'),
  period('c', '2026-07-28', '2026-08-01'),
];

test('parseISO & toISO bolak-balik tanpa pergeseran zona waktu', () => {
  assert.equal(toISO(parseISO('2026-10-16')), '2026-10-16');
  assert.equal(parseISO('2026-03-01').getMonth(), 2);
  assert.equal(diffDays(parseISO('2026-10-01'), parseISO('2026-10-16')), 15);
});

test('validasi tanggal menolak tanggal yang tidak ada', () => {
  assert.equal(isValidISO('2026-02-30'), false);
  assert.equal(isValidISO('2026-13-01'), false);
  assert.equal(isValidISO('16-10-2026'), false);
  assert.equal(isValidISO('2026-02-28'), true);
  assert.equal(isValidISO(''), false);
});

test('periodLength inklusif dan memakai nilai default bila belum selesai', () => {
  assert.equal(periodLength(period('x', '2026-10-01', '2026-10-05')), 5);
  assert.equal(periodLength(period('x', '2026-10-01', '')), 5);
  assert.equal(periodLength(period('x', '2026-10-01', ''), 4), 4);
});

test('computeCycles membentuk siklus dari jarak antar hari pertama haid', () => {
  const cycles = computeCycles(periods, 5);
  assert.equal(cycles.length, 3);
  assert.equal(cycles[0].cycleLength, 28);
  assert.equal(cycles[1].cycleLength, 29);
  assert.equal(cycles[2].cycleLength, null);
  assert.equal(cycles[2].ongoing, true);
  assert.equal(cycles[0].endDate, '2026-06-28');
});

test('cycleStats memakai riwayat bila tersedia', () => {
  const stats = cycleStats(periods, profile);
  assert.equal(stats.closedCycles, 2);
  assert.equal(stats.avgCycleLength, 29);
  assert.equal(stats.shortest, 28);
  assert.equal(stats.longest, 29);
  assert.equal(stats.source, 'riwayat');
  assert.equal(stats.confidence, 'berkembang');
});

test('cycleStats jatuh ke angka profil bila belum ada riwayat', () => {
  const stats = cycleStats([period('a', '2026-10-01', '2026-10-05')], profile);
  assert.equal(stats.closedCycles, 0);
  assert.equal(stats.avgCycleLength, 28);
  assert.equal(stats.source, 'profil');
  assert.equal(stats.confidence, 'awal');
});

test('resolveProfile menerima bentuk state aplikasi (averageCycleLength)', () => {
  // Regresi: state aplikasi memakai averageCycleLength, mesin memakai avgCycleLength.
  // Tanpa penyesuaian, prediksi menghasilkan NaN saat belum ada siklus lengkap.
  const fromState = resolveProfile({ averageCycleLength: 30, averagePeriodLength: 6 });
  assert.equal(fromState.avgCycleLength, 30);
  assert.equal(fromState.avgPeriodLength, 6);
  const fromShort = resolveProfile({ avgCycleLength: 27, avgPeriodLength: 4 });
  assert.equal(fromShort.avgCycleLength, 27);
  assert.equal(fromShort.avgPeriodLength, 4);
});

test('resolveProfile memberi nilai aman bila data kosong atau tidak wajar', () => {
  const empty = resolveProfile({});
  assert.equal(empty.avgCycleLength, 28);
  assert.equal(empty.avgPeriodLength, 5);
  const weird = resolveProfile({ averageCycleLength: 'abc', averagePeriodLength: null });
  assert.equal(weird.avgCycleLength, 28);
  assert.equal(weird.avgPeriodLength, 5);
  const outOfRange = resolveProfile({ averageCycleLength: 900, averagePeriodLength: 0 });
  assert.equal(outOfRange.avgCycleLength, 60);
  assert.equal(outOfRange.avgPeriodLength, 5);
});

test('prediksi tetap benar saat profil memakai nama field state aplikasi', () => {
  const stateProfile = { averageCycleLength: 28, averagePeriodLength: 5, cycleRegularity: 'teratur' };
  const p = predictNextPeriod([period('a', '2026-09-18', '2026-09-22')], stateProfile, parseISO('2026-10-08'));
  assert.equal(p.date, '2026-10-16');
  assert.equal(p.daysUntil, 8);
  assert.equal(Number.isNaN(p.daysUntil), false);
  assert.equal(p.avgCycleLength, 28);
});

test('computeCycles aman bila avgPeriodLength tidak valid', () => {
  const cycles = computeCycles([period('a', '2026-10-01', '')], NaN);
  assert.equal(cycles[0].periodLength, 5);
  const cycles2 = computeCycles([period('a', '2026-10-01', '')], undefined);
  assert.equal(cycles2[0].periodLength, 5);
});

test('rata-rata siklus desimal dihitung benar (28,5 hari)', () => {
  assert.equal(averageCycleText([28, 29, 27, 30]), '28,5 hari');
  assert.equal(averageCycleText([]), '-');
});

test('recentCycleAverage memakai N siklus terakhir', () => {
  const many = [
    period('1', '2026-01-01', '2026-01-05'),
    period('2', '2026-01-30', '2026-02-03'),
    period('3', '2026-03-01', '2026-03-05'),
  ];
  assert.equal(recentCycleAverage(many, 1, 28), 30);
  assert.equal(recentCycleAverage([], 3, 28), 28);
});

test('prediksi berikutnya = hari pertama terakhir + rata-rata siklus', () => {
  const today = parseISO('2026-08-10');
  const p = predictNextPeriod(periods, profile, today);
  assert.equal(p.date, '2026-08-26'); // 28 Juli + 29 hari
  assert.equal(p.daysUntil, 16);
  assert.equal(p.isLate, false);
  assert.equal(p.avgCycleLength, 29);
});

test('prediksi menandai keterlambatan tanpa menggeser tanggal diam-diam', () => {
  const today = parseISO('2026-09-05');
  const p = predictNextPeriod(periods, profile, today);
  assert.equal(p.date, '2026-08-26');
  assert.equal(p.isLate, true);
  assert.equal(p.lateBy, 10);
});

test('prediksi kosong bila belum ada catatan menstruasi', () => {
  assert.equal(predictNextPeriod([], profile, new Date()), null);
});

test('cycleDayFor menghitung hari siklus, fase, dan jendela subur', () => {
  const ctx = buildCycleContext(periods, profile, parseISO('2026-08-10'), 6);
  // siklus 28 Juli - 25 Agustus (29 hari), ovulasi hari ke-15
  const info = cycleDayFor('2026-08-02', ctx);
  assert.equal(info.cycleDay, 6);
  assert.equal(info.phase, 'folikular');
  assert.equal(info.ovulationDay, 15);
  assert.equal(info.fertileStart, 10);
  assert.equal(info.fertileEnd, 16);
  const ov = cycleDayFor('2026-08-11', ctx);
  assert.equal(ov.cycleDay, 15);
  assert.equal(ov.phase, 'ovulasi');
  assert.equal(cycleDayFor('2026-08-12', ctx).phase, 'subur');
  assert.equal(cycleDayFor('2026-07-29', ctx).phase, 'menstruasi');
  assert.equal(cycleDayFor('2026-08-25', ctx).phase, 'pms');
});

test('fase menstruasi memakai rata-rata lama menstruasi', () => {
  const ctx = buildCycleContext(periods, profile, parseISO('2026-08-10'), 6);
  assert.equal(cycleDayFor('2026-08-01', ctx).phase, 'menstruasi');
  assert.equal(cycleDayFor('2026-08-05', ctx).phase, 'folikular');
});

test('tanggal sebelum catatan pertama tidak punya info siklus', () => {
  const ctx = buildCycleContext(periods, profile, parseISO('2026-08-10'), 6);
  assert.equal(cycleDayFor('2026-01-01', ctx), null);
});

test('kalender menandai menstruasi, prediksi, ovulasi, dan masa subur', () => {
  const model = buildCalendarModel(periods, profile, parseISO('2026-08-10'), 3);
  assert.equal(dayStatus('2026-07-28', model), 'period');
  assert.equal(dayStatus('2026-08-11', model), 'ovulation');
  assert.equal(dayStatus('2026-08-12', model), 'fertile');
  assert.equal(dayStatus('2026-08-26', model), 'predicted');
  assert.equal(dayStatus('2026-08-27', model), 'predicted');
  assert.equal(dayStatus('2026-08-24', model), 'normal');
});

test('tanggal tanpa endDate ditandai sebagai perkiraan (assumed)', () => {
  const model = buildCalendarModel([period('a', '2026-08-01', '')], profile, parseISO('2026-08-10'), 2);
  assert.equal(dayStatus('2026-08-01', model), 'assumed');
  assert.equal(dayStatus('2026-08-05', model), 'assumed');
  assert.equal(dayStatus('2026-08-06', model), 'normal');
});

test('tanggal menstruasi aktual tidak dobel dengan prediksi', () => {
  const model = buildCalendarModel(periods, profile, parseISO('2026-08-10'), 2);
  assert.ok(model.periodDays.size > 0);
  assert.ok(model.predictedDays.size > 0);
  for (const iso of model.periodDays) {
    assert.equal(model.predictedDays.has(iso), false);
    assert.equal(model.fertileDays.has(iso), false);
  }
});

test('monthGrid selalu 6x7 dan mulai hari Senin', () => {
  const grid = monthGrid(2026, 9);
  assert.equal(grid.length, 6);
  assert.equal(grid[0].length, 7);
  assert.equal(grid[0][0].getDay(), 1);
  assert.equal(grid[0][0].getDate(), 28);
});

test('helper tanggal berbahasa Indonesia', () => {
  assert.equal(humanDays(0), 'hari ini');
  assert.equal(humanDays(1), 'besok');
  assert.equal(humanDays(-2), '2 hari lalu');
  assert.equal(num(28.5), '28,5');
  assert.equal(toISO(addDays(parseISO('2026-12-31'), 1)), '2027-01-01');
});
