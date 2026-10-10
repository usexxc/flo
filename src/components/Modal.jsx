/**
 * Modal Flo — pengganti openModal/closeModal versi vanilla.
 * Fokus dipindahkan ke dalam modal, Esc menutup, klik backdrop menutup, dan
 * scroll halaman dibekukan selama modal terbuka.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Icon } from './Icon.jsx';
import { cx } from './ui.jsx';

/**
 * @param {Object} p
 * @param {boolean} p.open
 * @param {()=>void} p.onClose
 * @param {string} p.title
 * @param {string} [p.subtitle]
 * @param {'md'|'lg'|'sm'} [p.size]
 * @param {import('react').ReactNode} [p.footer]
 */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  const panel = useRef(null);

  const onKey = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Fokuskan elemen interaktif pertama supaya keyboard langsung berguna.
    const first = panel.current?.querySelector('input, select, textarea, button:not([data-modal-close])');
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onKey]);

  if (!open) return null;

  const width = size === 'sm' ? 'max-w-[440px]' : size === 'lg' ? 'max-w-[720px]' : 'max-w-[560px]';

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center overflow-y-auto p-4 anim-fade-in"
      style={{ background: 'rgba(44,34,49,.48)', backdropFilter: 'blur(3px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panel}
        className={cx('relative w-full anim-pop-in rounded-[26px] bg-surface shadow-soft-3 my-auto', width)}
      >
        <div className="flex items-start justify-between gap-4 px-[1.4rem] pt-[1.3rem] pb-[0.6rem]">
          <div className="min-w-0">
            <h2 className="text-[1.22rem] font-extrabold tracking-[-0.3px] text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[0.875rem] text-ink-3">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            data-modal-close
            aria-label="Tutup"
            onClick={onClose}
            className="grid place-items-center w-9 h-9 rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors shrink-0"
          >
            <Icon name="close" className="w-[1.1rem] h-[1.1rem]" />
          </button>
        </div>
        <div className="px-[1.4rem] pt-[0.6rem] pb-[1.4rem]">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-[0.6rem] px-[1.4rem] pb-[1.4rem]">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Dialog konfirmasi (pengganti confirmDialog).
 * @param {Object} p
 * @param {boolean} p.open
 * @param {string} p.title
 * @param {string} p.text
 * @param {string} [p.confirmLabel]
 * @param {string} [p.cancelLabel]
 * @param {boolean} [p.danger]
 * @param {(ok:boolean)=>void} p.onResolve
 */
export function ConfirmDialog({
  open, title, text, confirmLabel = 'Lanjutkan', cancelLabel = 'Batal', danger = false, onResolve,
}) {
  return (
    <Modal
      open={open}
      onClose={() => onResolve(false)}
      title={title}
      size="sm"
      footer={(
        <>
          <button type="button" onClick={() => onResolve(false)}
            className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-transparent px-4 py-2.5 text-[0.9375rem] font-extrabold text-ink-2 hover:bg-surface-2 transition-colors">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={cx(
              'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.9375rem] font-extrabold text-white shadow-soft-2 transition-colors',
              danger ? 'bg-danger hover:bg-[#a52f23]' : 'bg-berry hover:bg-berry-dark',
            )}
          >
            {confirmLabel}
          </button>
        </>
      )}
    >
      <p className="text-[0.9375rem] leading-relaxed text-ink-2">{text}</p>
    </Modal>
  );
}
