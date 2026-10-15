import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanTitle, cleanTime, validateTodoInput, createTodo, updateTodo, toggleTodo,
  removeTodo, todosForDay, sortTodos, isOverdue, todaySummary, normalizeTodos,
  MAX_TODO_TITLE, TODO_CATEGORIES, TODO_PRIORITIES,
} from '../todos.js';

const NOW = '2026-10-11';
const base = (over = {}) => ({
  title: 'Minum air putih', description: '', date: NOW, time: '',
  category: 'kesehatan', priority: 'sedang', ...over,
});
const T = (id, over = {}) => ({
  id, title: id, description: '', category: 'lainnya', priority: 'sedang',
  done: false, createdAt: '2026-10-01', updatedAt: '2026-10-01', date: NOW, ...over,
});

test('cleanTitle merapikan spasi dan menolak judul kosong', () => {
  assert.equal(cleanTitle('  beli   sabun  '), 'beli sabun');
  assert.equal(cleanTitle('   '), null);
  assert.equal(cleanTitle(42), null);
  assert.equal(cleanTitle('a'.repeat(MAX_TODO_TITLE + 9)).length, MAX_TODO_TITLE);
});

test('cleanTime hanya menerima HH:MM yang valid', () => {
  assert.equal(cleanTime('07:30'), '07:30');
  assert.equal(cleanTime('24:00'), null);
  assert.equal(cleanTime('7:30'), null);
  assert.equal(cleanTime('12:60'), null);
});

test('validateTodoInput: judul wajib, tanggal & waktu harus valid', () => {
  assert.equal(validateTodoInput(base({ title: '  ' })), 'Judul tugas wajib diisi.');
  assert.equal(validateTodoInput(base({ date: '2026-02-30' })), 'Tanggal tidak valid.');
  assert.equal(validateTodoInput(base({ time: '25:00' })), 'Waktu tidak valid. Gunakan format jam:menit.');
  assert.equal(validateTodoInput(base({ date: '', time: '08:00' })), 'Isi tanggal dulu sebelum memilih waktu.');
  assert.equal(validateTodoInput(base()), null);
  assert.equal(validateTodoInput(base({ date: '', time: '' })), null);
});

test('createTodo membuat tugas lengkap dengan id unik dan tanggal dibuat', () => {
  const a = createTodo(base({ time: '07:00', description: '  dua gelas  ' }), { now: NOW });
  const b = createTodo(base(), { now: NOW });
  assert.equal(a.description, 'dua gelas');
  assert.equal(a.time, '07:00');
  assert.equal(a.done, false);
  assert.equal(a.createdAt, NOW);
  assert.equal(a.updatedAt, NOW);
  assert.notEqual(a.id, b.id);
});

test('createTodo menolak isian tidak valid dan mengganti kategori/prioritas asing', () => {
  assert.equal(createTodo(base({ title: '' })), null);
  const t = createTodo(base({ category: 'entah', priority: 'x' }), { now: NOW });
  assert.equal(t.category, 'lainnya');
  assert.equal(t.priority, 'sedang');
});

test('createTodo tanpa tanggal tidak menyimpan waktu', () => {
  const t = createTodo(base({ date: '', time: '' }), { now: NOW });
  assert.equal(t.date, undefined);
  assert.equal(t.time, undefined);
});

test('updateTodo mengubah isi, mempertahankan id, status, dan createdAt', () => {
  const list = [T('a', { done: true, doneAt: '2026-10-10', createdAt: '2026-10-01' })];
  const out = updateTodo(list, 'a', base({ title: 'Baru', priority: 'tinggi' }), { now: '2026-10-12' });
  assert.equal(out[0].id, 'a');
  assert.equal(out[0].title, 'Baru');
  assert.equal(out[0].priority, 'tinggi');
  assert.equal(out[0].done, true);
  assert.equal(out[0].doneAt, '2026-10-10');
  assert.equal(out[0].createdAt, '2026-10-01');
  assert.equal(out[0].updatedAt, '2026-10-12');
});

test('updateTodo menolak isian tidak valid dan tidak mengubah daftar', () => {
  const list = [T('a', { title: 'Lama' })];
  assert.equal(updateTodo(list, 'a', base({ title: '' })), null);
  assert.equal(list[0].title, 'Lama');
  assert.equal(updateTodo(list, 'tidak-ada', base()), null);
});

test('toggleTodo menandai selesai lalu membatalkan, tanpa menghapus', () => {
  const list = [T('a'), T('b')];
  const done = toggleTodo(list, 'a', '2026-10-11');
  assert.equal(done.length, 2);
  assert.equal(done[0].done, true);
  assert.equal(done[0].doneAt, '2026-10-11');
  const undone = toggleTodo(done, 'a', '2026-10-12');
  assert.equal(undone[0].done, false);
  assert.equal(undone[0].doneAt, undefined);
  assert.equal(list[0].done, false);
});

test('removeTodo menghapus hanya id yang dimaksud', () => {
  assert.deepEqual(removeTodo([T('a'), T('b')], 'a').map((t) => t.id), ['b']);
});

test('todosForDay hanya mengambil tugas bertanggal hari itu; tugas tanpa tanggal tidak ikut', () => {
  const list = [T('hari-ini'), T('besok', { date: '2026-10-12' }), T('umum', { date: undefined })];
  assert.deepEqual(todosForDay(list, NOW).map((t) => t.id), ['hari-ini']);
});

test('sortTodos: belum selesai dulu, lalu jam, lalu prioritas', () => {
  const list = [
    T('selesai', { done: true, time: '06:00' }),
    T('siang-rendah', { time: '12:00', priority: 'rendah' }),
    T('pagi', { time: '07:00', priority: 'rendah' }),
    T('pagi-tinggi', { time: '07:00', priority: 'tinggi' }),
  ];
  assert.deepEqual(sortTodos(list).map((t) => t.id),
    ['pagi-tinggi', 'pagi', 'siang-rendah', 'selesai']);
});

test('isOverdue: hanya tugas belum selesai yang tanggalnya sudah lewat', () => {
  assert.equal(isOverdue(T('x', { date: '2026-10-09' }), NOW), true);
  assert.equal(isOverdue(T('x', { date: '2026-10-09', done: true }), NOW), false);
  assert.equal(isOverdue(T('x', { date: undefined }), NOW), false);
});

test('todaySummary menghitung hanya tugas hari ini, dengan persen', () => {
  const list = [
    T('a', { done: true }), T('b'), T('c', { date: '2026-10-12' }), T('d', { date: undefined }),
  ];
  assert.deepEqual(todaySummary(list, NOW), { total: 2, done: 1, open: 1, percent: 50 });
  assert.deepEqual(todaySummary([], NOW), { total: 0, done: 0, open: 0, percent: 0 });
});

test('normalizeTodos membaca data lama (dueDate) dan membuang entri rusak', () => {
  const out = normalizeTodos([
    { id: 'lama', title: ' Belanja ', done: true, createdAt: '2026-10-01', dueDate: '2026-10-11', doneAt: '2026-10-11' },
    { id: 'tanpa-judul', title: '   ' },
    { title: 'tanpa-id' },
    null,
    'bukan-objek',
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Belanja');
  assert.equal(out[0].date, '2026-10-11');
  assert.equal(out[0].category, 'lainnya');
  assert.equal(out[0].priority, 'sedang');
  assert.equal(out[0].updatedAt, '2026-10-01');
  assert.equal(out[0].doneAt, '2026-10-11');
});

test('normalizeTodos: waktu tanpa tanggal dibuang, input bukan array jadi kosong', () => {
  const [t] = normalizeTodos([{ id: 'x', title: 'y', time: '08:00' }]);
  assert.equal(t.time, undefined);
  assert.deepEqual(normalizeTodos(undefined), []);
});

test('daftar kategori dan prioritas sesuai spesifikasi', () => {
  assert.deepEqual(TODO_CATEGORIES.map((c) => c.label),
    ['Rutinitas', 'Kesehatan', 'Perawatan Diri', 'Pekerjaan / Sekolah', 'Personal', 'Lainnya']);
  assert.deepEqual(TODO_PRIORITIES.map((p) => p.label), ['Tinggi', 'Sedang', 'Rendah']);
});
