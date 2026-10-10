import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNewPeriodStart, diffDays, MIN_CYCLE_DAYS } from '../periodRules.js';

const P = (startDate, endDate = '') => ({ id: startDate, startDate, endDate });

test('boleh mencatat haid pertama di data kosong', () => {
  assert.equal(checkNewPeriodStart([], '2026-10-01'), null);
});

test('boleh backfill haid yang lebih lama dari haid terakhir', () => {
  const periods = [P('2026-10-01', '2026-10-05')];
  assert.equal(checkNewPeriodStart(periods, '2026-08-01', { minCycle: MIN_CYCLE_DAYS }), null);
});

test('menolak tanggal di dalam haid yang sudah selesai', () => {
  const r = checkNewPeriodStart([P('2026-10-01', '2026-10-05')], '2026-10-03');
  assert.equal(r.reason, 'inside');
});

test('menolak tanggal di dalam haid yang belum ditandai selesai (15 hari)', () => {
  const r = checkNewPeriodStart([P('2026-10-01')], '2026-10-12');
  assert.equal(r.reason, 'inside');
  assert.equal(checkNewPeriodStart([P('2026-10-01')], '2026-10-20'), null);
});

test('menolak haid yang terlalu dekat dengan haid sebelumnya', () => {
  const r = checkNewPeriodStart([P('2026-09-01', '2026-09-05')], '2026-09-08');
  assert.equal(r.reason, 'too-close-before');
  assert.equal(r.days, 7);
});

test('menolak haid yang terlalu dekat dengan haid sesudahnya (backfill)', () => {
  const r = checkNewPeriodStart([P('2026-10-01', '2026-10-05')], '2026-09-25');
  assert.equal(r.reason, 'too-close-after');
  assert.equal(r.days, 6);
});

test('tepat MIN_CYCLE_DAYS dari kedua sisi tetap boleh', () => {
  const periods = [P('2026-09-01', '2026-09-05'), P('2026-10-01', '2026-10-05')];
  assert.equal(checkNewPeriodStart(periods, '2026-09-11'), null);
});

test('diffDays selalu bilangan bulat dan bertanda', () => {
  assert.equal(diffDays('2026-10-10', '2026-10-01'), 9);
  assert.equal(diffDays('2026-10-01', '2026-10-10'), -9);
});
