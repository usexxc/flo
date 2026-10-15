/**
 * Akar aplikasi: onboarding → kerangka halaman, modal catat, dan toast.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlo, useFloActions, mutate } from './store.js';
import { runReminders } from './lib/reminder.js';
import { AppShell } from './components/AppShell.jsx';
import { Modal } from './components/Modal.jsx';
import { Icon } from './components/Icon.jsx';
import { buildInsights } from './lib/insight.js';
import Onboarding from './pages/Onboarding.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import LogPage from './pages/LogPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import InsightPage from './pages/InsightPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import TodoPage from './pages/TodoPage.jsx';

/** Tab yang sah pada form Catat. */
const LOG_TABS = ['period', 'symptoms', 'daily'];

/** Alias lama → tab sah, supaya pemanggil lama tidak membuka form kosong. */
const TAB_ALIAS = { log: 'period', day: 'daily', haid: 'period', harian: 'daily', gejala: 'symptoms' };

/** Normalkan nama tab menjadi salah satu dari LOG_TABS. @param {string} [tab] */
function resolveLogTab(tab) {
  if (LOG_TABS.includes(tab)) return tab;
  if (Object.prototype.hasOwnProperty.call(TAB_ALIAS, tab)) return TAB_ALIAS[tab];
  return LOG_TABS[0];
}

/** Halaman yang dikenali aplikasi (harus cocok dengan PAGES di AppShell). */
const PAGE_IDS = ['dashboard', 'calendar', 'log', 'history', 'todo', 'insight', 'settings'];

/**
 * Baca halaman dari hash (`#/kalender`, dst.). Jatuh ke Beranda bila hash
 * kosong atau tidak dikenal, supaya deep link salah tidak membuka layar blank.
 * @returns {string}
 */
function readHashPage() {
  if (typeof window === 'undefined') return 'dashboard';
  const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  return PAGE_IDS.includes(raw) ? raw : 'dashboard';
}

export default function App() {
  const { state, d } = useFlo();
  const actions = useFloActions();
  const today = useMemo(() => new Date(), []);
  const [page, setPageState] = useState(() => readHashPage());
  const [logModal, setLogModal] = useState(null); // { tab, date } | null
  const [toast, setToast] = useState(null);

  /**
   * Ganti halaman dan catat di hash. Tanpa ini tombol "kembali" HP/keluar
   * langsung menutup aplikasi, dan segarkan halaman selalu kembali ke Beranda.
   * @param {string} next
   */
  const setPage = useCallback((next) => {
    setPageState(next);
    if (typeof window !== 'undefined' && `#/${next}` !== window.location.hash) {
      window.location.hash = `#/${next}`;
    }
  }, []);

  // Tombol "kembali" HP/peramban: mundur ke Beranda, bukan keluar aplikasi.
  useEffect(() => {
    const onHash = () => setPageState(readHashPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /**
   * Tampilkan notifikasi singkat.
   * @param {string} message
   * @param {'ok'|'warn'|'danger'} [tone]
   */
  const showToast = useCallback((message, tone = 'ok') => {
    setToast({ message, tone });
  }, []);

  // Toast hilang sendiri setelah beberapa detik.
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Wawasan dihitung ulang setiap kali state berubah.
  const insightData = useMemo(() => buildInsights(state, today), [state, today]);
  const derived = useMemo(() => ({ ...d, insights: insightData.items || [] }), [d, insightData]);

  /**
   * Buka modal catat. Nama tab dinormalkan lewat `resolveLogTab` supaya
   * pemanggil lama (mis. 'day' atau 'log') tidak membuka modal kosong.
   * @param {string} [tab]
   * @param {string} [date]
   */
  const openLog = useCallback((tab = 'period', date) => {
    setLogModal({ tab: resolveLogTab(tab), date });
  }, []);

  const closeLog = useCallback(() => setLogModal(null), []);

  // Notifikasi sistem + penandaan "sudah tampil" dijalankan sekali saat
  // aplikasi dibuka (bukan setiap render), supaya pengingat tidak berulang.
  // HARUS sebelum percabangan render apa pun: memindahkannya ke bawah membuat
  // jumlah hook berubah saat onboarding selesai → React melempar halaman jadi
  // kosong.
  useEffect(() => {
    if (!state.profile.onboarded) return undefined;
    const t = setTimeout(() => {
      runReminders({ state, today, onMutate: mutate });
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.profile.onboarded]);

  // Belum onboarding ulangi ke layar 7 pertanyaan.
  if (state.profile.onboarded === false) {
    return (
      <Onboarding
        state={state}
        onMutate={mutate}
        onDone={() => showToast('Siap! Siklusmu sudah terhitung.', 'ok')}
      />
    );
  }

  return (
    <AppShell page={page} onNavigate={setPage} onQuick={openLog}>
      {page === 'dashboard' ? (
        <DashboardPage
          state={state}
          d={derived}
          today={today}
          onOpenLog={openLog}
          onNavigate={setPage}
          onMutate={actions.mutate}
        />
      ) : null}
      {page === 'calendar' ? (
        <CalendarPage state={state} d={derived} today={today} onOpenLog={openLog} />
      ) : null}
      {page === 'log' ? (
        <LogPage state={state} d={derived} onMutate={actions.mutate} toast={showToast} initialTab="period" />
      ) : null}
      {page === 'history' ? (
        <HistoryPage state={state} onMutate={actions.mutate} toast={showToast} />
      ) : null}
      {page === 'todo' ? (
        <TodoPage state={state} onMutate={actions.mutate} toast={showToast} />
      ) : null}
      {page === 'insight' ? (
        <InsightPage state={state} d={derived} />
      ) : null}
      {page === 'settings' ? (
        <SettingsPage state={state} onMutate={actions.mutate} toast={showToast} />
      ) : null}

      {/* Modal catat — dipicu dari mana saja (topbar, dashboard, kalender) */}
      <Modal
        open={Boolean(logModal)}
        onClose={closeLog}
        title="Catat"
        subtitle="Menstruasi, gejala, atau catatan harian."
        size="lg"
      >
        {logModal ? (
          <LogPage
            state={state}
            d={derived}
            onMutate={actions.mutate}
            toast={showToast}
            initialTab={logModal.tab}
            initialDate={logModal.date}
            embedded
            onDone={closeLog}
          />
        ) : null}
      </Modal>

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </AppShell>
  );
}

/**
 * Notifikasi singkat — versi komponen dari toast vanilla.
 * @param {Object} p
 * @param {string} p.message
 * @param {'ok'|'warn'|'danger'} [p.tone]
 */
function Toast({ message, tone = 'ok' }) {
  const tones = {
    ok: 'bg-sage-dark',
    warn: 'bg-amber',
    danger: 'bg-danger',
  };
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[90] anim-fade-up"
    >
      <div className={`flex items-center gap-2.5 rounded-full px-4 py-3 text-[0.9375rem] font-extrabold text-white shadow-soft-3 ${tones[tone] || tones.ok}`}>
        <Icon name={tone === 'danger' ? 'alert' : 'check'} className="w-[1.15em] h-[1.15em]" />
        {message}
      </div>
    </div>
  );
}
