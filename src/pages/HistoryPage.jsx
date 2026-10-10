/**
 * Halaman Riwayat — daftar siklus sebelumnya dan catatan gejala/harian.
 */
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Card, cx, Notice } from '../components/ui.jsx';
import { formatFull, formatLong, parseISO } from '../lib/util.js';
import { sortPeriods } from '../lib/cycle.js';
import { FLOW_LABEL } from '../lib/catalog.js';
import { ConfirmDialog } from '../components/Modal.jsx';

/**
 * @param {Object} p
 * @param {Object} p.state
 * @param {(fn:(s:object)=>void)=>void} p.onMutate
 * @param {(msg:string, tone?:string)=>void} p.toast
 */
export default function HistoryPage({ state, onMutate, toast }) {
  const [filter, setFilter] = useState('siklus');

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[1.45rem] font-black tracking-[-0.5px] text-ink">Riwayat</h1>
        <p className="text-[0.9375rem] text-ink-3">Semua catatanmu, dari siklus sampai gejala harian.</p>
      </header>

      <div role="tablist" aria-label="Jenis riwayat" className="flex flex-wrap gap-1.5">
        {[
          { id: 'siklus', label: 'Siklus', icon: 'drop' },
          { id: 'gejala', label: 'Gejala', icon: 'heart' },
          { id: 'harian', label: 'Catatan harian', icon: 'note' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.875rem] font-extrabold transition-colors duration-150',
              filter === t.id ? 'bg-berry border-berry/30 text-white shadow-soft-1' : 'bg-surface border-line text-ink-2 hover:bg-surface-2',
            )}
          >
            <Icon name={t.icon} className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {filter === 'siklus' ? <CycleList state={state} onMutate={onMutate} toast={toast} /> : null}
      {filter === 'gejala' ? <SymptomList state={state} /> : null}
      {filter === 'harian' ? <DailyList state={state} /> : null}
    </div>
  );
}
/**
 * Daftar siklus dengan tombol hapus.
 * @param {Object} p
 * @param {Object} p.state
 */
function CycleList({ state, onMutate, toast }) {
  const periods = useMemo(
    () => sortPeriods(state.periods).slice().reverse(),
    [state.periods],
  );
  // Id periode yang menunggu konfirmasi hapus, dan periode yang baru dihapus
  // (untuk undo).
  const [pendingDelete, setPendingDelete] = useState(null);
  const [lastDeleted, setLastDeleted] = useState(null);

  /**
   * Hapus satu entri siklus. Minta konfirmasi dulu — data haid tidak bisa
   * dibuat ulang, dan satu ketukan salah pada tombol kecil itu langsung
   * menghapus riwayat berbulan-bulan.
   * @param {string} id
   */
  function remove(id) {
    setPendingDelete(id);
  }

  /** Kembali ke riwayat yang barusan dihapus (undo). */
  function undoDelete() {
    if (!lastDeleted) return;
    onMutate((s) => {
      const next = [...s.periods, lastDeleted];
      next.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
      s.periods = next;
    });
    setLastDeleted(null);
    toast('Catatan dikembalikan.', 'ok');
  }

  /** Jalankan penghapusan setelah dikonfirmasi. */
  function confirmDelete() {
    if (!pendingDelete) return;
    const target = state.periods.find((p) => p.id === pendingDelete) || null;
    onMutate((s) => {
      s.periods = s.periods.filter((p) => p.id !== pendingDelete);
    });
    setLastDeleted(target);
    setPendingDelete(null);
    toast('Catatan siklus dihapus.', 'warn');
  }

  /** Pemberitahuan undo setelah penghapusan. */
  function undoNotice() {
    if (!lastDeleted) return null;
    return (
      <Notice tone="warn" icon="alert">
        <span className="block">Catatan menstruasi {formatLong(parseISO(lastDeleted.startDate))} dihapus.</span>
        <button
          type="button"
          onClick={undoDelete}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-surface px-3 py-1.5 text-[0.8125rem] font-extrabold text-ink-2 hover:bg-surface-2 transition-colors"
        >
          <Icon name="history" className="w-3.5 h-3.5" />
          Kembalikan
        </button>
      </Notice>
    );
  }

  /** Dialog konfirmasi sebelum menghapus. */
  function confirmDialog() {
    return (
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus catatan siklus ini?"
        text="Catatan menstruasi yang dihapus memengaruhi perhitungan siklus dan prediksi ke depan."
        confirmLabel="Ya, hapus"
        cancelLabel="Batal"
        danger
        onResolve={(ok) => { if (ok) confirmDelete(); else setPendingDelete(null); }}
      />
    );
  }

  if (!periods.length && !lastDeleted) {
    return (
      <Card>
        <EmptyState icon="drop" title="Belum ada siklus">
          Catat tanggal menstruasimu di halaman <strong>Catat</strong> untuk mulai melihat riwayat dan prediksi.
        </EmptyState>
      </Card>
    );
  }

  if (!periods.length) {
    // Semua periode sudah dihapus, tapi undo masih bisa ditarik.
    return (
      <div className="space-y-2.5">
        {undoNotice()}
        <Card>
          <EmptyState icon="drop" title="Belum ada siklus">
            Catat tanggal menstruasimu di halaman <strong>Catat</strong> untuk mulai melihat riwayat dan prediksi.
          </EmptyState>
        </Card>
        {confirmDialog()}
      </div>
    );
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {periods.map((p) => (
        <div key={p.id || p.startDate} className="rounded-[22px] border border-line bg-surface p-4 shadow-soft-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-berry-soft px-2.5 py-1 text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-berry">
                <Icon name="drop" className="w-3.5 h-3.5" />
                Menstruasi
              </span>
              <p className="mt-2 text-[1.0625rem] font-extrabold tracking-[-0.2px] text-ink">{formatLong(parseISO(p.startDate))}</p>
              <p className="text-[0.8125rem] text-ink-3">
                {!p.endDate
                  ? 'Masih berjalan'
                  : p.endDate === p.startDate
                    ? '1 hari'
                    : `${diffTo(p.endDate, p.startDate) + 1} hari`}
                {p.flow ? ` · ${FLOW_LABEL[p.flow] || p.flow}` : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Hapus siklus ${formatLong(parseISO(p.startDate))}`}
              onClick={() => remove(p.id)}
              className="grid place-items-center w-9 h-9 rounded-[12px] border border-line text-ink-3 hover:bg-danger-soft hover:text-danger transition-colors shrink-0"
            >
              <Icon name="trash" className="w-[1.05rem] h-[1.05rem]" />
            </button>
          </div>
        </div>
      ))}
      {undoNotice()}
      {confirmDialog()}
    </div>
  );
}
/** Daftar gejala per hari (diurutkan terbaru). */
function SymptomList({ state }) {
  const rows = useMemo(() => {
    const map = new Map();
    state.symptoms.forEach((s) => {
      const entry = map.get(s.date) || { date: s.date, items: [], severity: s.severity };
      entry.items.push(s.symptom);
      map.set(s.date, entry);
    });
    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [state.symptoms]);

  if (!rows.length) {
    return (
      <Card>
        <EmptyState icon="heart" title="Belum ada gejala tercatat" />
      </Card>
    );
  }

  return (
    <div className="grid gap-2.5">
      {rows.map((r) => (
        <div key={r.date} className="flex flex-wrap items-center gap-3 rounded-[20px] border border-line bg-surface p-4">
          <span className="grid place-items-center w-10 h-10 rounded-[14px] bg-sage-soft text-sage-dark shrink-0">
            <Icon name="heart" className="w-[1.25rem] h-[1.25rem]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-extrabold text-ink">{formatFull(parseISO(r.date))}</p>
            <p className="text-[0.875rem] text-ink-2">{r.items.join(', ')}</p>
          </div>
          {r.severity ? (
            <span className="rounded-full bg-amber-soft px-2.5 py-1 text-[0.75rem] font-extrabold text-amber capitalize">{r.severity}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Daftar catatan harian. */
function DailyList({ state }) {
  const rows = useMemo(
    () => [...state.dailyLogs].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [state.dailyLogs],
  );

  if (!rows.length) {
    return (
      <Card>
        <EmptyState icon="note" title="Belum ada catatan harian" />
      </Card>
    );
  }

  return (
    <div className="grid gap-2.5">
      {rows.map((r) => (
        <div key={r.id || r.date} className="rounded-[20px] border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-[14px] bg-plum-soft text-plum shrink-0">
              <Icon name="note" className="w-[1.25rem] h-[1.25rem]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-extrabold text-ink">{formatFull(parseISO(r.date))}</p>
              <p className="text-[0.875rem] text-ink-2">
                {[r.mood, r.energy ? `Energi ${r.energy}` : null].filter(Boolean).join(' · ') || 'Tanpa detail'}
              </p>
            </div>
          </div>
          {r.habits?.length ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {r.habits.map((h) => (
                <span key={h} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[0.75rem] font-bold text-ink-2">
                  <Icon name="check" className="w-3 h-3" />
                  {h}
                </span>
              ))}
            </div>
          ) : null}
          {r.note ? <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink-2 italic">“{r.note}”</p> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Selisih hari antara dua tanggal ISO.
 * @param {string} a
 * @param {string} b
 */
function diffTo(a, b) {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
}

/** Keadaan kosong. */
function EmptyState({ icon, title, children }) {
  return (
    <div className="py-8 px-4 text-center">
      <span className="grid place-items-center w-14 h-14 rounded-[20px] bg-berry-soft text-berry mx-auto mb-3.5">
        <Icon name={icon} className="w-7 h-7" />
      </span>
      <h2 className="text-[1.15rem] font-extrabold tracking-[-0.3px] text-ink">{title}</h2>
      {children ? <p className="mt-1.5 text-[0.9375rem] text-ink-2">{children}</p> : null}
    </div>
  );
}
