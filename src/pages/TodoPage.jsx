/**
 * Halaman Todo List — aktivitas harian yang disusun dan diselesaikan satu per satu.
 * Data di `state.todos` (LocalStorage `flo_todos`). Statistik dihitung dari data.
 */
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Card, Button, Field, Input, Select, cx } from '../components/ui.jsx';
import { Modal, ConfirmDialog } from '../components/Modal.jsx';
import {
  createTodo, updateTodo, toggleTodo, removeTodo, sortTodos, isOverdue, todaySummary,
  todosForDay, validateTodoInput, MAX_TODO_TITLE, MAX_TODO_DESC,
  TODO_CATEGORIES, TODO_PRIORITIES,
} from '../lib/todos.js';
import { todayISO, formatShort, parseISO } from '../lib/util.js';

const FILTERS = [
  { id: 'semua', label: 'Semua' },
  { id: 'hari-ini', label: 'Hari Ini' },
  { id: 'belum', label: 'Belum Selesai' },
  { id: 'selesai', label: 'Selesai' },
];

const CATEGORY_LABEL = Object.fromEntries(TODO_CATEGORIES.map((c) => [c.id, c.label]));
const PRIORITY_LABEL = Object.fromEntries(TODO_PRIORITIES.map((p) => [p.id, p.label]));

/** Warna lembut untuk prioritas (tidak mencolok). */
const PRIORITY_TONE = {
  tinggi: 'bg-danger-soft text-danger',
  sedang: 'bg-amber-soft text-amber',
  rendah: 'bg-sage-soft text-sage-dark',
};

const EMPTY_FORM = {
  title: '', description: '', date: '', time: '', category: 'rutinitas', priority: 'sedang',
};

/**
 * @param {Object} p
 * @param {Object} p.state
 * @param {(fn:(s:object)=>void)=>void} p.onMutate
 * @param {(msg:string, tone?:string)=>void} p.toast
 */
export default function TodoPage({ state, onMutate, toast }) {
  const today = todayISO();
  const [filter, setFilter] = useState('semua');
  const [catFilter, setCatFilter] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [pendingDelete, setPendingDelete] = useState(null);

  const all = state.todos || [];
  const summary = useMemo(() => todaySummary(all, today), [all, today]);

  const visible = useMemo(() => {
    let list = all;
    if (filter === 'hari-ini') list = todosForDay(list, today);
    if (filter === 'belum') list = list.filter((t) => !t.done);
    if (filter === 'selesai') list = list.filter((t) => t.done);
    if (catFilter) list = list.filter((t) => t.category === catFilter);
    return sortTodos(list);
  }, [all, filter, catFilter, today]);

  /** Simpan dari form (tambah atau ubah). Mengembalikan false bila gagal. */
  const save = (input) => {
    if (editing === 'new') {
      const todo = createTodo(input, { now: today });
      if (!todo) return false;
      onMutate((s) => { s.todos = [...(s.todos || []), todo]; });
      toast('Tugas ditambahkan.', 'ok');
    } else {
      const next = updateTodo(all, editing, input, { now: today });
      if (!next) return false;
      onMutate((s) => { s.todos = next; });
      toast('Tugas diperbarui.', 'ok');
    }
    setEditing(null);
    return true;
  };

  const toggle = (id) => {
    onMutate((s) => { s.todos = toggleTodo(s.todos || [], id, today); });
  };

  const confirmRemove = () => {
    const id = pendingDelete;
    setPendingDelete(null);
    if (!id) return;
    onMutate((s) => { s.todos = removeTodo(s.todos || [], id); });
    toast('Tugas dihapus.', 'warn');
  };

  const editingTodo = editing && editing !== 'new' ? all.find((t) => t.id === editing) : null;
  const pendingTitle = pendingDelete ? all.find((t) => t.id === pendingDelete)?.title : '';
  const percent = summary.percent;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.45rem] font-black tracking-[-0.5px] text-ink">Todo List</h1>
          <p className="text-[0.9375rem] text-ink-3">Susun aktivitasmu, selesaikan satu per satu.</p>
        </div>
        <Button icon="plus" onClick={() => setEditing('new')}>Tambah Tugas</Button>
      </header>

      {/* Ringkasan hari ini */}
      <Card>
        <p className="text-[0.8125rem] font-extrabold uppercase tracking-[0.08em] text-ink-3">Aktivitas Hari Ini</p>
        <p className="mt-1 text-[1.05rem] font-bold text-ink">
          {summary.total === 0
            ? 'Belum ada tugas untuk hari ini.'
            : `${summary.done} dari ${summary.total} tugas selesai.`}
        </p>
        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Progres aktivitas hari ini"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="h-full rounded-full bg-berry transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1.5 text-[0.8125rem] font-semibold text-ink-3">Progress {percent}%</p>
      </Card>

      {/* Filter status */}
      <div role="tablist" aria-label="Filter tugas" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cx(
              'rounded-full border px-3.5 py-2 text-[0.875rem] font-extrabold transition-colors duration-150',
              filter === f.id ? 'bg-berry border-berry/30 text-white shadow-soft-1' : 'bg-surface border-line text-ink-2 hover:bg-surface-2',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Field id="todo-cat-filter" label="Kategori">
        <Select id="todo-cat-filter" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">Semua kategori</option>
          {TODO_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </Field>

      {/* Daftar */}
      {visible.length === 0 ? (
        <Card className="text-center">
          <p className="text-[1rem] font-extrabold text-ink">
            {all.length === 0 ? 'Belum ada tugas hari ini.' : 'Tidak ada tugas yang cocok dengan filter.'}
          </p>
          {all.length === 0 ? (
            <>
              <p className="mt-1 text-[0.9375rem] text-ink-3">Tambahkan aktivitas kecil untuk memulai harimu.</p>
              <div className="mt-3">
                <Button icon="plus" onClick={() => setEditing('new')}>Tambah Tugas</Button>
              </div>
            </>
          ) : null}
        </Card>
      ) : (
        <ul className="grid gap-2.5">
          {visible.map((t) => {
            const overdue = isOverdue(t, today);
            return (
              <li key={t.id}>
                <Card className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-berry"
                    checked={t.done}
                    aria-label={`Tandai selesai: ${t.title}`}
                    onChange={() => toggle(t.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <span className={cx(
                      'block break-words text-[0.9375rem] font-bold',
                      t.done ? 'text-ink-3 line-through' : 'text-ink',
                    )}
                    >
                      {t.title}
                    </span>
                    {t.description ? (
                      <span className="mt-0.5 block break-words text-[0.8125rem] text-ink-3">{t.description}</span>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.75rem] font-bold">
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-2">{CATEGORY_LABEL[t.category]}</span>
                      <span className={cx('rounded-full px-2 py-0.5', PRIORITY_TONE[t.priority])}>
                        Prioritas {PRIORITY_LABEL[t.priority]}
                      </span>
                      {t.date ? (
                        <span className="inline-flex items-center gap-1 text-ink-3">
                          <Icon name="clock" className="h-3.5 w-3.5" />
                          {formatShort(parseISO(t.date))}{t.time ? `, ${t.time}` : ''}
                        </span>
                      ) : null}
                      {t.done ? <span className="text-sage-dark">Selesai</span> : null}
                      {overdue ? <span className="text-danger">Terlambat</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`Ubah tugas: ${t.title}`}
                      onClick={() => setEditing(t.id)}
                      className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus tugas: ${t.title}`}
                      onClick={() => setPendingDelete(t.id)}
                      className="rounded-full p-2 text-ink-3 transition-colors hover:bg-surface-2 hover:text-danger"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <TodoFormModal
        key={editing || 'closed'}
        open={Boolean(editing)}
        initial={editingTodo}
        onClose={() => setEditing(null)}
        onSave={save}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus tugas ini?"
        text={pendingTitle ? `"${pendingTitle}" akan dihapus permanen.` : 'Tugas ini akan dihapus.'}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        danger
        onResolve={(ok) => { if (ok) confirmRemove(); else setPendingDelete(null); }}
      />
    </div>
  );
}

/**
 * Form tambah/ubah tugas. Dipasang ulang (key) setiap dibuka, sehingga isian
 * selalu dimulai dari data yang benar.
 */
function TodoFormModal({ open, initial, onClose, onSave }) {
  const [form, setForm] = useState(() => (initial ? {
    title: initial.title,
    description: initial.description || '',
    date: initial.date || '',
    time: initial.time || '',
    category: initial.category,
    priority: initial.priority,
  } : EMPTY_FORM));
  const [error, setError] = useState('');

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setError(''); };

  const submit = (e) => {
    e.preventDefault();
    const problem = validateTodoInput(form);
    if (problem) { setError(problem); return; }
    if (!onSave(form)) setError('Tugas tidak dapat disimpan. Periksa isiannya.');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Ubah Tugas' : 'Tambah Tugas'}
      subtitle="Judul wajib diisi. Tugas yang punya tanggal akan muncul di hari itu."
    >
      <form className="grid gap-3" onSubmit={submit} noValidate>
        <Field id="todo-title" label="Judul tugas">
          <Input id="todo-title" value={form.title} maxLength={MAX_TODO_TITLE} onChange={set('title')} placeholder="Contoh: Minum air putih" autoFocus />
        </Field>
        <Field id="todo-desc" label="Deskripsi" hint="Opsional">
          <textarea
            id="todo-desc"
            value={form.description}
            maxLength={MAX_TODO_DESC}
            onChange={set('description')}
            rows={2}
            className="w-full rounded-[16px] border border-line-2 bg-surface px-3.5 py-2.5 text-[0.9375rem] font-semibold text-ink focus:border-berry focus:outline-none"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="todo-date" label="Tanggal" hint="Opsional">
            <Input id="todo-date" type="date" value={form.date} onChange={set('date')} />
          </Field>
          <Field id="todo-time" label="Waktu" hint="Opsional, isi setelah tanggal">
            <Input id="todo-time" type="time" value={form.time} onChange={set('time')} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="todo-category" label="Kategori">
            <Select id="todo-category" value={form.category} onChange={set('category')}>
              {TODO_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <Field id="todo-priority" label="Prioritas">
            <Select id="todo-priority" value={form.priority} onChange={set('priority')}>
              {TODO_PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </Field>
        </div>
        {error ? <p role="alert" className="text-[0.8125rem] font-bold text-danger">{error}</p> : null}
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" icon="check">Simpan Tugas</Button>
        </div>
      </form>
    </Modal>
  );
}
