/**
 * Primitif UI bersama Flo (versi React + Tailwind).
 * Semua teks tombol/kartu yang berpotensi berbahasa Indonesia ditulis apa adanya.
 */
import { Icon } from './Icon.jsx';

const cx = (...a) => a.filter(Boolean).join(' ');

/** Kartu dasar dengan warna & bayangan yang konsisten. */
export function Card({ as: As = 'div', className, children, ...rest }) {
  return (
    <As
      className={cx(
        'rounded-[26px] bg-surface border border-line shadow-soft-1 p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

/** Judul kartu + aksi opsional di kanan. */
export function CardHead({ title, icon, action, hint }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3.5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[1.0625rem] font-extrabold tracking-[-0.2px] text-ink">
          {icon ? (
            <span className="grid place-items-center w-8 h-8 rounded-[12px] bg-berry-soft text-berry shrink-0">
              <Icon name={icon} className="w-[1.05rem] h-[1.05rem]" />
            </span>
          ) : null}
          {title}
        </h2>
        {hint ? <p className="text-[0.8125rem] text-ink-3 mt-0.5">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const BTN_BASE = 'inline-flex items-center justify-center gap-2 rounded-full font-extrabold tracking-[-0.1px] transition-[transform,box-shadow,background-color,color] duration-150 active:scale-[0.975] disabled:opacity-50 disabled:pointer-events-none';

const BTN_VARIANT = {
  primary: 'bg-berry text-white shadow-soft-2 hover:bg-berry-dark',
  soft: 'bg-berry-soft text-berry-dark hover:bg-[#f2d8e4]',
  ghost: 'bg-transparent text-ink-2 border border-line-2 hover:bg-surface-2',
  sage: 'bg-sage text-white hover:bg-sage-dark',
  danger: 'bg-danger text-white hover:bg-[#a52f23]',
};

const BTN_SIZE = {
  sm: 'px-3 py-1.5 text-[0.8125rem]',
  md: 'px-4 py-2.5 text-[0.9375rem]',
  lg: 'px-5 py-3.5 text-[1rem]',
  xl: 'px-6 py-4 text-[1.0625rem]',
};

/**
 * Tombol.
 * @param {Object} p
 * @param {'primary'|'soft'|'ghost'|'sage'|'danger'} [p.variant]
 * @param {'sm'|'md'|'lg'|'xl'} [p.size]
 * @param {boolean} [p.block]
 * @param {string} [p.icon]
 */
export function Button({
  variant = 'primary', size = 'md', block, icon, className, children, ...rest
}) {
  return (
    <button
      type="button"
      className={cx(
        BTN_BASE, BTN_VARIANT[variant] || BTN_VARIANT.primary, BTN_SIZE[size] || BTN_SIZE.md,
        block && 'w-full', className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} className="w-[1.15em] h-[1.15em]" /> : null}
      {children}
    </button>
  );
}

/** Tombol ikon di sidebar/topbar. */
export function IconBtn({ icon, label, active, className, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'relative grid place-items-center w-11 h-11 rounded-[16px] border transition-colors duration-150',
        active
          ? 'bg-berry-soft border-berry/25 text-berry'
          : 'bg-surface border-line text-ink-2 hover:bg-surface-2 hover:text-ink',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} className="w-[1.3rem] h-[1.3rem]" />
    </button>
  );
}

/**
 * Chip pilihan (dipakai pilih gejala, suasana hati, kebiasaan).
 * @param {Object} p
 * @param {boolean} p.active
 * @param {string} [p.icon]
 */
export function Chip({ active, icon, label, hint, className, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.875rem] font-bold transition-all duration-150 active:scale-[0.97]',
        active
          ? 'bg-berry border-berry/30 text-white shadow-soft-1'
          : 'bg-surface border-line text-ink-2 hover:border-line-2 hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} className="w-4 h-4" /> : null}
      {label}
      {hint ? <span className="opacity-70 font-semibold">{hint}</span> : null}
    </button>
  );
}

/** Label kecil di atas judul kartu besar. */
export function Eyebrow({ children, tone = 'berry', icon }) {
  const tones = {
    berry: 'text-berry bg-berry-soft',
    plum: 'text-plum bg-plum-soft',
    sage: 'text-sage-dark bg-sage-soft',
    amber: 'text-amber bg-amber-soft',
  };
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-extrabold uppercase tracking-[0.09em]',
      tones[tone] || tones.berry,
    )}>
      {icon ? <Icon name={icon} className="w-3.5 h-3.5" /> : null}
      {children}
    </span>
  );
}

/**
 * Pesan singkat (info, sukses, bahaya).
 * @param {Object} p
 * @param {'info'|'ok'|'warn'|'danger'} [p.tone]
 */
export function Notice({ tone = 'info', icon, children, className }) {
  const tones = {
    info: 'bg-blue-soft text-blue border-blue/15',
    ok: 'bg-sage-soft text-sage-dark border-sage/20',
    warn: 'bg-amber-soft text-amber border-amber/20',
    danger: 'bg-danger-soft text-danger border-danger/20',
  };
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-2.5 rounded-[18px] border px-3.5 py-2.5 text-[0.875rem] font-semibold leading-relaxed',
        tones[tone] || tones.info, className,
      )}
    >
      <Icon name={icon || (tone === 'danger' ? 'alert' : 'info')} className="w-[1.05rem] h-[1.05rem] mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Baris “nilai” pada daftar ringkas. */
export function Row({ icon, title, value, sub, tone = 'ink', onClick, trailing }) {
  const tones = {
    ink: 'bg-surface-2 text-ink',
    berry: 'bg-berry-soft text-berry-dark',
    sage: 'bg-sage-soft text-sage-dark',
    plum: 'bg-plum-soft text-plum',
  };
  const As = onClick ? 'button' : 'div';
  return (
    <As
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx(
        'w-full flex items-center gap-3 rounded-[20px] border border-line bg-surface px-3.5 py-3 text-left transition-colors duration-150',
        onClick && 'hover:bg-surface-2 active:scale-[0.995] cursor-pointer',
      )}
    >
      {icon ? (
        <span className={cx('grid place-items-center w-10 h-10 rounded-[14px] shrink-0', tones[tone] || tones.ink)}>
          <Icon name={icon} className="w-5 h-5" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-bold text-ink truncate">{title}</span>
        {sub ? <span className="block text-[0.8125rem] text-ink-3 truncate">{sub}</span> : null}
      </span>
      {value ? <span className="text-[0.875rem] font-extrabold text-ink shrink-0">{value}</span> : null}
      {trailing}
    </As>
  );
}

/** Pembagi antar bagian halaman. */
export function SectionTitle({ children, action, className }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 mb-2.5', className)}>
      <h2 className="text-[0.8125rem] font-extrabold uppercase tracking-[0.1em] text-ink-3">{children}</h2>
      {action}
    </div>
  );
}

/** Bidang masukan (dipakai di form tanggal & remaja tinggi badan). */
export function Field({ label, hint, children, error, id }) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block mb-1 text-[0.8125rem] font-extrabold text-ink-2">{label}</label>
      {children}
      {hint && !error ? <p className="mt-1 text-[0.75rem] text-ink-3">{hint}</p> : null}
      {error ? <p className="mt-1 text-[0.75rem] font-bold text-danger">{error}</p> : null}
    </div>
  );
}

const INPUT = 'w-full rounded-[16px] border border-line-2 bg-surface px-3.5 py-2.5 text-[0.9375rem] font-semibold text-ink placeholder:text-ink-3/70 transition-colors duration-150 focus:border-berry focus:bg-white focus:outline-none';

/** Input teks/tanggal/angka. */
export function Input({ className, invalid, ...rest }) {
  return <input className={cx(INPUT, invalid && 'border-danger', className)} {...rest} />;
}

/** Select. */
export function Select({ className, invalid, children, ...rest }) {
  return (
    <select className={cx(INPUT, 'cursor-pointer', invalid && 'border-danger', className)} {...rest}>
      {children}
    </select>
  );
}

export { cx };
