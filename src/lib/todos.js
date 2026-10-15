/**
 * Daftar Todo List pribadi. Murni (tanpa React/LocalStorage) supaya bisa diuji unit.
 * Disimpan di state Flo sebagai `todos` (key LocalStorage `flo_todos`), terpisah
 * dari data menstruasi, gejala, dan pengaturan.
 * @module lib/todos
 */
import { uid, todayISO, isValidISO } from './util.js';

/** Panjang maksimum judul (karakter). */
export const MAX_TODO_TITLE = 120;
/** Panjang maksimum deskripsi (karakter). */
export const MAX_TODO_DESC = 500;

/** Kategori yang tersedia. Kunci disimpan; label ditampilkan. */
export const TODO_CATEGORIES = [
  { id: 'rutinitas', label: 'Rutinitas' },
  { id: 'kesehatan', label: 'Kesehatan' },
  { id: 'perawatan-diri', label: 'Perawatan Diri' },
  { id: 'sekolah-kerja', label: 'Pekerjaan / Sekolah' },
  { id: 'personal', label: 'Personal' },
  { id: 'lainnya', label: 'Lainnya' },
];

/** Prioritas yang tersedia. Urutan dari yang paling mendesak. */
export const TODO_PRIORITIES = [
  { id: 'tinggi', label: 'Tinggi', rank: 0 },
  { id: 'sedang', label: 'Sedang', rank: 1 },
  { id: 'rendah', label: 'Rendah', rank: 2 },
];

const CATEGORY_IDS = TODO_CATEGORIES.map((c) => c.id);
const PRIORITY_IDS = TODO_PRIORITIES.map((p) => p.id);

/** Format jam HH:MM (00:00–23:59). */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * @typedef {Object} Todo
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} [date] ISO tanggal tugas. Tanpa tanggal = tugas umum.
 * @property {string} [time] HH:MM, opsional
 * @property {string} category
 * @property {string} priority 'rendah' | 'sedang' | 'tinggi'
 * @property {boolean} done
 * @property {string} createdAt ISO tanggal dibuat
 * @property {string} updatedAt ISO tanggal terakhir diubah
 * @property {string} [doneAt] ISO tanggal selesai
 */

/** @param {unknown} raw @returns {string|null} */
export function cleanTitle(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.slice(0, MAX_TODO_TITLE);
}

/** @param {unknown} raw @returns {string} */
function cleanDescription(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_TODO_DESC);
}

/** @param {unknown} raw @returns {string|null} HH:MM atau null */
export function cleanTime(raw) {
  if (typeof raw !== 'string' || !TIME_RE.test(raw)) return null;
  return raw;
}

/**
 * Validasi isian dari form. Mengembalikan pesan kesalahan pertama, atau null
 * bila valid. Dipakai sebelum menyimpan agar UI bisa menampilkan alasannya.
 * @param {{title?:unknown, date?:unknown, time?:unknown}} input
 * @returns {string|null}
 */
export function validateTodoInput(input) {
  if (!cleanTitle(input.title)) return 'Judul tugas wajib diisi.';
  if (input.date && !isValidISO(input.date)) return 'Tanggal tidak valid.';
  if (input.time && !cleanTime(input.time)) return 'Waktu tidak valid. Gunakan format jam:menit.';
  if (input.time && !input.date) return 'Isi tanggal dulu sebelum memilih waktu.';
  return null;
}

/**
 * Bentuk entri tugas yang sudah dirapikan dari isian form. Mengembalikan null
 * bila validasi gagal.
 * @param {Object} input
 * @param {{now?:string, id?:string}} [opts]
 * @returns {Todo|null}
 */
function buildTodo(input, opts = {}) {
  if (validateTodoInput(input)) return null;
  const now = opts.now || todayISO();
  const todo = {
    id: opts.id || uid(),
    title: cleanTitle(input.title),
    description: cleanDescription(input.description),
    category: CATEGORY_IDS.includes(input.category) ? input.category : 'lainnya',
    priority: PRIORITY_IDS.includes(input.priority) ? input.priority : 'sedang',
    done: false,
    createdAt: opts.createdAt || now,
    updatedAt: now,
  };
  if (input.date) todo.date = input.date;
  const time = cleanTime(input.time);
  if (time && todo.date) todo.time = time;
  return todo;
}

/**
 * Buat tugas baru. Null bila isian tidak valid.
 * @param {Object} input
 * @param {{now?:string}} [opts]
 * @returns {Todo|null}
 */
export function createTodo(input, opts = {}) {
  return buildTodo(input, { now: opts.now });
}

/**
 * Ubah tugas yang sudah ada. Mempertahankan id, status selesai, dan createdAt.
 * Null bila isian tidak valid.
 * @param {Todo[]} todos
 * @param {string} id
 * @param {Object} input
 * @param {{now?:string}} [opts]
 * @returns {Todo[]|null} daftar baru, atau null bila gagal
 */
export function updateTodo(todos, id, input, opts = {}) {
  const current = todos.find((t) => t.id === id);
  if (!current) return null;
  const rebuilt = buildTodo(input, {
    id, now: opts.now, createdAt: current.createdAt,
  });
  if (!rebuilt) return null;
  rebuilt.done = current.done;
  if (current.done && current.doneAt) rebuilt.doneAt = current.doneAt;
  return todos.map((t) => (t.id === id ? rebuilt : t));
}

/**
 * Ubah status selesai/belum. Tidak mengubah input. Tidak menghapus tugas.
 * @param {Todo[]} todos
 * @param {string} id
 * @param {string} [today]
 * @returns {Todo[]}
 */
export function toggleTodo(todos, id, today = todayISO()) {
  return todos.map((t) => {
    if (t.id !== id) return t;
    if (t.done) {
      const { doneAt, ...rest } = t;
      return { ...rest, done: false, updatedAt: today };
    }
    return { ...t, done: true, doneAt: today, updatedAt: today };
  });
}

/**
 * Hapus tugas berdasarkan id.
 * @param {Todo[]} todos
 * @param {string} id
 * @returns {Todo[]}
 */
export function removeTodo(todos, id) {
  return todos.filter((t) => t.id !== id);
}

/**
 * Tugas hari ini: yang bertanggal sama dengan `today`. Tugas tanpa tanggal
 * TIDAK ikut, sesuai aturan (baru tampil setelah dijadwalkan).
 * @param {Todo[]} todos
 * @param {string} today
 * @returns {Todo[]}
 */
export function todosForDay(todos, today) {
  return todos.filter((t) => t.date === today);
}

/**
 * Urutan tampil: belum selesai dulu; lalu tanggal dan jam paling awal; lalu
 * prioritas tertinggi; lalu yang paling baru dibuat. Tidak mengubah input.
 * @param {Todo[]} todos
 * @returns {Todo[]}
 */
export function sortTodos(todos) {
  const rank = (p) => TODO_PRIORITIES.find((x) => x.id === p)?.rank ?? 1;
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.date || '9999-12-31';
    const bd = b.date || '9999-12-31';
    if (ad !== bd) return ad < bd ? -1 : 1;
    const at = a.time || '99:99';
    const bt = b.time || '99:99';
    if (at !== bt) return at < bt ? -1 : 1;
    if (rank(a.priority) !== rank(b.priority)) return rank(a.priority) - rank(b.priority);
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

/**
 * Tugas lewat tenggat: belum selesai dan tanggalnya sebelum `today`. Hanya
 * penanda; tugas tidak pernah dihapus otomatis.
 * @param {Todo} t
 * @param {string} today
 * @returns {boolean}
 */
export function isOverdue(t, today) {
  return !t.done && Boolean(t.date) && t.date < today;
}

/**
 * Ringkasan untuk hari ini (total, selesai, belum, persen).
 * @param {Todo[]} todos
 * @param {string} today
 * @returns {{total:number, done:number, open:number, percent:number}}
 */
export function todaySummary(todos, today) {
  const list = todosForDay(todos, today);
  const done = list.filter((t) => t.done).length;
  const total = list.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, open: total - done, percent };
}

/**
 * Normalkan daftar tugas dari penyimpanan/impor. Membuang entri yang rusak dan
 * mengisi default untuk field yang belum ada (data lama tetap terbaca).
 * Data lama memakai `dueDate`; dibaca sebagai `date`.
 * @param {unknown} raw
 * @returns {Todo[]}
 */
export function normalizeTodos(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string') continue;
    const title = cleanTitle(t.title);
    if (!title) continue;
    const createdAt = isValidISO(t.createdAt) ? t.createdAt : todayISO();
    const todo = {
      id: t.id,
      title,
      description: cleanDescription(t.description),
      category: CATEGORY_IDS.includes(t.category) ? t.category : 'lainnya',
      priority: PRIORITY_IDS.includes(t.priority) ? t.priority : 'sedang',
      done: t.done === true,
      createdAt,
      updatedAt: isValidISO(t.updatedAt) ? t.updatedAt : createdAt,
    };
    const date = isValidISO(t.date) ? t.date : isValidISO(t.dueDate) ? t.dueDate : null;
    if (date) todo.date = date;
    const time = cleanTime(t.time);
    if (time && todo.date) todo.time = time;
    if (todo.done && isValidISO(t.doneAt)) todo.doneAt = t.doneAt;
    out.push(todo);
  }
  return out;
}
