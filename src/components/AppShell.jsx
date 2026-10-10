/**
 * Kerangka aplikasi: sidebar desktop, topbar mobile, dan navigasi bawah.
 */
import { Icon, BrandMark } from './Icon.jsx';
import { cx } from './ui.jsx';

export const PAGES = [
  { id: 'dashboard', label: 'Beranda', icon: 'home' },
  { id: 'calendar', label: 'Kalender', icon: 'calendar' },
  { id: 'log', label: 'Catat', icon: 'plus', primary: true },
  { id: 'history', label: 'Riwayat', icon: 'history' },
  { id: 'insight', label: 'Wawasan', icon: 'spark' },
  { id: 'settings', label: 'Pengaturan', icon: 'gear' },
];

/**
 * @param {Object} p
 * @param {string} p.page
 * @param {(id:string)=>void} p.onNavigate
 * @param {(id:string)=>void} p.onQuick
 */
export function AppShell({ page, onNavigate, onQuick, children }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:h-screen lg:sticky lg:top-0 border-r border-line bg-surface/80 backdrop-blur-xl px-5 py-6">
        <div className="flex items-center gap-2.5 mb-7">
          <BrandMark className="w-10 h-10" />
          <div>
            <strong className="block text-[1.15rem] font-black tracking-[-0.4px] text-ink leading-none">Flo</strong>
            <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.11em] text-berry">Siklusmu, Terpantau</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Navigasi utama">
          {PAGES.filter((p) => !p.primary).map((p) => (
            <NavItem key={p.id} item={p} active={page === p.id} onNavigate={onNavigate} />
          ))}
        </nav>

        <div className="mt-auto pt-5 space-y-2.5">
          <button
            type="button"
            onClick={() => onQuick('period')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-berry px-4 py-3 text-[0.9375rem] font-extrabold text-white shadow-soft-2 transition-[transform,background-color] duration-150 hover:bg-berry-dark active:scale-[0.98]"
          >
            <Icon name="plus" className="w-[1.15em] h-[1.15em]" />
            Catat hari ini
          </button>
          <p className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-ink-3">
            <Icon name="lock" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Data hanya tersimpan di perangkat ini. Tidak ada yang dikirim ke server.</span>
          </p>
        </div>
      </aside>

      {/* Area utama */}
      <div className="min-w-0">
        <TopBar onQuick={onQuick} />
        <main className="px-4 pb-32 pt-3 sm:px-6 lg:px-8 lg:pb-10 lg:pt-5 max-w-[1180px]">
          {children}
        </main>
      </div>

      {/* Navigasi bawah (mobile) */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-60 border-t border-line bg-white/96 backdrop-blur-xl pb-[calc(env(safe-area-inset-bottom))]" aria-label="Navigasi bawah">
        <div className="grid grid-cols-5">
          {PAGES.filter((p) => !p.primary).slice(0, 5).map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={page === p.id ? 'page' : undefined}
              onClick={() => onNavigate(p.id)}
              className={cx(
                'grid place-items-center gap-[0.15rem] py-2.5 text-[0.68rem] font-bold transition-colors min-h-[56px]',
                page === p.id ? 'text-berry' : 'text-ink-3',
              )}
            >
              <Icon name={p.icon} className="w-[1.35rem] h-[1.35rem]" />
              {p.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/**
 * Satu butir navigasi sidebar.
 * @param {Object} p
 * @param {Object} p.item
 * @param {boolean} p.active
 */
function NavItem({ item, active, onNavigate }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={() => onNavigate(item.id)}
      className={cx(
        'flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-left text-[0.9375rem] font-extrabold transition-colors duration-150',
        active ? 'bg-berry-soft text-berry-dark' : 'text-ink-2 hover:bg-surface-2',
      )}
    >
      <Icon name={item.icon} className="w-[1.25rem] h-[1.25rem] shrink-0" />
      {item.label}
    </button>
  );
}

/** Bar atas khusus mobile: merek + tombol catat cepat. */
function TopBar({ onQuick }) {
  return (
    <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-line bg-white/92 backdrop-blur-xl px-4 py-2.5">
      <div className="flex items-center gap-2">
        <BrandMark className="w-8 h-8" />
        <strong className="text-[1.05rem] font-black tracking-[-0.3px] text-ink">Flo</strong>
      </div>
      <button
        type="button"
        onClick={() => onQuick('period')}
        className="grid place-items-center w-10 h-10 rounded-[14px] bg-berry text-white shadow-soft-2 active:scale-95 transition-transform"
        aria-label="Catat hari ini"
      >
        <Icon name="plus" className="w-[1.2rem] h-[1.2rem]" />
      </button>
    </header>
  );
}
