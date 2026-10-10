/**
 * Kalender satu bulan penuh gaya Google Calendar: judul bulan di tengah,
 * tombol panah untuk ganti bulan, grid tanggal memenuhi lebar penuh.
 * Penanda haid, masa subur, perkiraan haid, dan hari ini.
 */
import { useEffect, useCallback, useState } from 'react';
import { Icon } from './Icon.jsx';
import { cx } from './ui.jsx';

const DAYS_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** Minggu(0) diambil sebagai indeks 0. */
const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * @param {Object} p
 * @param {Object} p.model hasil calendarMonths() — array bulan
 * @param {(iso:string)=>void} [p.onPick]
 * @param {string} [p.selected]
 * @param {boolean} [p.compact] sembunyikan legenda bawah
 */
export function MiniCalendar({ model, onPick, selected, compact }) {
  // `model` sudah berupa array bulan dari calendarMonths(); toleransi bila
  // pemanggil masih mengirim bentuk lama {months:[…]}.
  const months = Array.isArray(model) ? model : (model?.months || []);

  // Indeks bulan yang sedang tampil; mulai dari bulan yang berisi hari ini.
  const todayIndex = Math.max(0, months.findIndex((m) => m.containsToday));
  const [cursor, setCursor] = useState(todayIndex);

  // Kembali ke bulan hari ini setiap kali data model berubah.
  useEffect(() => {
    setCursor(Math.max(0, months.findIndex((m) => m.containsToday)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // Geser keyboard: ArrowLeft / ArrowRight ganti bulan.
  const onKeyDown = useCallback((e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setCursor((c) =>
      e.key === 'ArrowLeft'
        ? Math.max(0, c - 1)
        : Math.min(months.length - 1, c + 1),
    );
  }, [months.length]);

  const step = useCallback((dir) => {
    setCursor((c) => Math.max(0, Math.min(months.length - 1, c + dir)));
  }, [months.length]);

  const canPrev = cursor > 0;
  const canNext = months.length > 0 && cursor < months.length - 1;
  const month = months[cursor] || null;
  const startDow = month && month.cells[0] ? DOW.indexOf(month.cells[0].dow) : 0;

  return (
    <div className="w-full">
      {/* Bar judul bulan + tombol ganti bulan */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          aria-label="Bulan sebelumnya"
          onClick={() => step(-1)}
          disabled={!canPrev}
          className={cx(
            'grid place-items-center w-9 h-9 rounded-full border border-line text-ink-2 transition-colors',
            canPrev ? 'bg-surface hover:bg-surface-2' : 'opacity-35 cursor-not-allowed',
          )}
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
        </button>

        <h3 className="text-[1.0625rem] font-extrabold tracking-[-0.2px] text-ink text-center truncate" aria-live="polite">
          {month?.label || '—'}
        </h3>

        <button
          type="button"
          aria-label="Bulan berikutnya"
          onClick={() => step(1)}
          disabled={!canNext}
          className={cx(
            'grid place-items-center w-9 h-9 rounded-full border border-line text-ink-2 transition-colors',
            canNext ? 'bg-surface hover:bg-surface-2' : 'opacity-35 cursor-not-allowed',
          )}
        >
          <Icon name="chevronRight" className="w-4 h-4" />
        </button>
      </div>

      {/* Nama hari */}
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-[0.625rem] font-extrabold uppercase tracking-wide text-ink-3/80 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Grid tanggal: memenuhi lebar penuh */}
      <div
        className="grid grid-cols-7 gap-0.5 outline-none"
        tabIndex={0}
        role="application"
        aria-label="Pilih tanggal"
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: startDow }).map((_, i) => <div key={`pad-${i}`} />)}
        {month?.cells.map((cell) => {
          const state = cell.state; // 'period' | 'predicted' | 'ovulation' | 'fertile' | 'plain'
          const isToday = cell.isToday;
          const isSel = selected === cell.iso;
          const tone =
            state === 'period' ? 'bg-berry text-white border-transparent'
              : state === 'predicted' ? 'bg-berry-soft text-berry-dark border-berry/30'
                : state === 'ovulation' ? 'bg-sage-dark text-white border-transparent'
                  : state === 'fertile' ? 'bg-sage-soft text-sage-dark border-sage/35'
                    : 'bg-surface text-ink-2 border-line';
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onPick?.(cell.iso)}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${cell.day} ${month.label}`}
              className={cx(
                'relative grid place-items-center aspect-square rounded-[10px] border text-[0.8125rem] font-bold transition-all duration-150 hover:scale-[1.06] active:scale-95',
                tone,
                isToday && 'ring-2 ring-berry ring-offset-1 ring-offset-surface',
                isSel && 'ring-2 ring-plum ring-offset-1 ring-offset-surface',
                !cell.inMonth && 'opacity-30 pointer-events-none',
              )}
            >
              <span className={cx(isToday && 'font-black')}>{cell.day}</span>
              {state === 'ovulation' ? (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-plum" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      {!compact ? (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3 text-[0.625rem] font-bold text-ink-3">
          <Legend color="bg-berry" label="Haid" />
          <Legend color="bg-sage" label="Subur" />
          <Legend color="bg-sage-dark" label="Ovulasi" />
          <Legend color="bg-berry-soft" label="Perkiraan" />
        </div>
      ) : null}
    </div>
  );
}

/** Keterangan warna kecil. */
function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cx('w-2.5 h-2.5 rounded-full', color)} />
      {label}
    </span>
  );
}
