/**
 * Onboarding — alur 7 pertanyaan, lalu layar analisis singkat dan hasil.
 * Versi React dari `renderOnboarding()` + `runAnalysis()`.
 */
import { useState, useCallback } from 'react';
import { Icon, BrandMark } from '../components/Icon.jsx';
import { Button, Notice, cx } from '../components/ui.jsx';
import { toISO, uid } from '../lib/util.js';

const TOTAL = 7;

/**
 * @param {Object} p
 * @param {Object} p.state
 * @param {(fn:(s:object)=>void)=>void} p.onMutate
 * @param {()=>void} p.onDone dipanggil ketika onboarding selesai
 */
export default function Onboarding({ state, onMutate, onDone }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialState(state));
  const [error, setError] = useState('');

  /** Progres persen (0–100); langkah terakhir dihitung sebagai selesai. */
  const pct = Math.round(((step + 1) / TOTAL) * 100);

  /**
   * Simpan pilihan tunggal.
   * @param {string} kunci
   * @param {string} nilai
   * @param {Object} [opsi] aksi tambahan
   */
  const pick = useCallback((kunci, nilai, opts = {}) => {
    setDraft((prev) => {
      const next = { ...prev, [kunci]: opts.multi ? prev[kunci].includes(nilai)
        ? prev[kunci].filter((x) => x !== nilai) : [...prev[kunci], nilai] : nilai };
      if (opts.set) opts.set(next, nilai);
      return next;
    });
    setError('');
  }, []);

  /**
   * Lanjut ke pertanyaan berikutnya, atau selesaikan onboarding.
   */
  const next = useCallback(() => {
    const valid = STEPS[step]?.validate?.(draft) ?? true;
    if (!valid) {
      setError(STEPS[step]?.error || 'Lengkapi dulu pilihan di atas.');
      return;
    }
    if (step >= TOTAL - 1) { finish(); return; }
    setStep((s) => s + 1);
  }, [step, draft]);

  /**
   * Selesaikan onboarding: tulis profil, tandai onboarded, panggil onDone.
   *
   * Riwayat haid/gejala yang sudah ada TIDAK dihapus. Kalau tanggal awal yang
   * diisi belum tercatat, catatan baru ditambahkan — kalaupun sudah ada
   * (mis. onboarding diulang), datanya dibiarkan apa adanya.
   *
   * Gejala yang dipilih hanya disimpan sebagai preferensi profil
   * (`frequentSymptoms`) supaya dipakai untuk menyarankan isian nanti — bukan
   * ditempel ke tanggal "haid − 20 hari" yang membuat Riwayat & Wawasan
   * tercemar catatan palsu.
   */
  const finish = useCallback(() => {
    onMutate((s) => {
      s.profile.name = draft.name.trim();
      s.profile.averageCycleLength = draft.cycleLength;
      s.profile.averagePeriodLength = draft.periodLength;
      s.profile.cycleRegularity = draft.cycleRegularity;
      s.profile.reminderSettings = {
        ...s.profile.reminderSettings,
        enabled: draft.reminder === 'yes',
      };
      s.profile.frequentSymptoms = [...draft.symptoms];
      s.profile.onboarded = true;

      // Tambahkan catatan haid baru hanya bila tanggalnya belum ada.
      if (draft.periodStart && !s.periods.some((p) => p.startDate === draft.periodStart)) {
        s.periods = [
          ...s.periods,
          {
            id: uid(),
            startDate: draft.periodStart,
            endDate: '', // diisi nanti lewat "Tandai akhir haid"
            flow: 'medium',
          },
        ];
      }
    });
    onDone();
  }, [draft, onMutate, onDone]);

  const s = STEPS[step];
  const canAdvance = !s.validate || s.validate(draft);

  return (
    <div className="min-h-screen grid place-items-center p-4 sm:p-6 bg-bg">
      <div className="w-full max-w-[640px] anim-fade-up">
        {/* Merek + progres */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BrandMark className="w-10 h-10" />
            <div>
              <strong className="block text-[1.15rem] font-black tracking-[-0.4px] text-ink leading-none">Flo</strong>
              <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.11em] text-berry">Siklusmu, Terpantau</span>
            </div>
          </div>
          <span className="text-[0.8125rem] font-extrabold text-ink-3">{step + 1} / {TOTAL}</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-line mb-5">
          <div className="h-full rounded-full bg-berry transition-[width] duration-400 ease-out" style={{ width: `${pct}%` }} />
        </div>

        <div className="rounded-[26px] border border-line bg-surface p-5 sm:p-7 shadow-soft-1">
          <h1 className="text-[1.4rem] leading-tight font-black tracking-[-0.5px] text-ink sm:text-[1.55rem]">{s.title}</h1>
          {s.sub ? <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-3">{s.sub}</p> : null}

          <div className="mt-5 space-y-5">
            {step === 0 ? (
              <NameStep draft={draft} setDraft={setDraft} />
            ) : null}

            {s.type === 'cards' ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {s.options.map((o) => (
                  <PickCard
                    key={o.id}
                    active={s.multi ? draft[s.key].includes(o.id) : draft[s.key] === o.id}
                    icon={o.icon}
                    title={o.label}
                    sub={o.sub}
                    onClick={() => pick(s.key, o.id, { multi: s.multi, set: s.set })}
                  />
                ))}
              </div>
            ) : null}

            {s.type === 'date' ? (
              <div>
                <label htmlFor="ob-period" className="block mb-1 text-[0.8125rem] font-extrabold text-ink-2">Tanggal awal haid terakhir</label>
                <input
                  id="ob-period"
                  type="date"
                  value={draft.periodStart}
                  max={toISO(new Date())}
                  onChange={(e) => { setDraft((d) => ({ ...d, periodStart: e.target.value })); setError(''); }}
                  className="w-full rounded-[16px] border border-line-2 bg-surface px-3.5 py-2.5 text-[0.9375rem] font-semibold text-ink focus:border-berry focus:bg-white focus:outline-none"
                />
              </div>
            ) : null}

            {error ? <Notice tone="danger" icon="alert">{error}</Notice> : null}
          </div>

          {/* Tombol navigasi */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              icon="chevronLeft"
              onClick={() => { setStep((x) => Math.max(0, x - 1)); setError(''); }}
              disabled={step === 0}
            >
              Kembali
            </Button>
            <Button
              icon="arrowRight"
              onClick={next}
              disabled={!canAdvance}
            >
              {step === TOTAL - 1 ? 'Mulai catat' : 'Lanjut'}
            </Button>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-[0.8125rem] leading-relaxed text-ink-3">
          <Icon name="lock" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Jawaban ini dipakai untuk menghitung siklus. Semuanya hanya tersimpan di perangkat ini.</span>
        </p>
      </div>
    </div>
  );
}

/* ---------------------------- Langkah onboarding --------------------------- */

const STEPS = [
  {
    title: 'Panggil kamu siapa?',
    sub: 'Supaya Flo bisa menyapamu dengan nama.',
    type: 'name',
    validate: (d) => Boolean(d.name.trim()),
    error: 'Tulis nama panggilanmu dulu.',
  },
  {
    title: 'Kapan haid terakhirmu dimulai?',
    sub: 'Tanggal awal menstruasi terakhir. Kalau tidak yakin, pilih tanggal terdekat.',
    type: 'date',
    key: 'periodStart',
    validate: (d) => Boolean(d.periodStart),
    error: 'Pilih tanggalnya dulu.',
  },
  {
    title: 'Seberapa panjang siklusmu biasanya?',
    sub: 'Dihitung dari hari pertama haid sampai sehari sebelum haid berikutnya.',
    type: 'cards',
    key: 'cycleRange',
    options: [
      { id: 'pendek', label: 'Kurang dari 25 hari', sub: 'Siklus lebih pendek dari rata-rata' },
      { id: 'normal', label: '25–32 hari', sub: 'Rentang paling umum' },
      { id: 'panjang', label: 'Lebih dari 32 hari', sub: 'Siklus lebih panjang dari rata-rata' },
      { id: 'tidakTahu', label: 'Belum tahu', sub: 'Kita pakai perkiraan 28 hari' },
    ],
    set: (d, v) => {
      const map = { pendek: 24, normal: 28, panjang: 34, tidakTahu: 28 };
      d.cycleLength = map[v];
    },
  },
  {
    title: 'Berapa hari haid biasanya berlangsung?',
    sub: 'Dari hari pertama darah keluar sampai benar-benar bersih.',
    type: 'cards',
    key: 'periodRange',
    options: [
      { id: 'pendek', label: '1–3 hari', sub: 'Haid singkat' },
      { id: 'normal', label: '4–6 hari', sub: 'Rentang paling umum' },
      { id: 'panjang', label: '7 hari atau lebih', sub: 'Haid agak panjang' },
    ],
    set: (d, v) => {
      const map = { pendek: 3, normal: 5, panjang: 7 };
      d.periodLength = map[v];
    },
  },
  {
    title: 'Siklusmu teratur tidak?',
    sub: 'Biasanya jarak antar-haidnya stabil atau suka berubah-ubah?',
    type: 'cards',
    key: 'cycleRegularity',
    options: [
      { id: 'teratur', label: 'Teratur', icon: 'shield', sub: 'Jarak antar-haid cukup stabil' },
      { id: 'tidak-teratur', label: 'Tidak teratur', icon: 'wave', sub: 'Sering beda jauh setiap bulan' },
      { id: 'tidak-tahu', label: 'Belum tahu', icon: 'worry', sub: 'Belum cukup data untuk memastikan' },
    ],
    set: (d, v) => { d.cycleRegularity = v; },
  },
  {
    title: 'Gejala apa yang paling sering muncul?',
    sub: 'Pilih satu atau lebih. Dipakai untuk mengenali polamu nanti.',
    type: 'cards',
    key: 'symptoms',
    multi: true,
    options: [
      { id: 'Kram', label: 'Kram perut', icon: 'wave' },
      { id: 'Sakit kepala', label: 'Sakit kepala', icon: 'bolt' },
      { id: 'Jerawat', label: 'Jerawat', icon: 'target' },
      { id: 'Kelelahan', label: 'Kelelahan', icon: 'bed' },
      { id: 'Mual', label: 'Mual', icon: 'worry' },
      { id: 'Kembung', label: 'Kembung', icon: 'drop' },
    ],
    validate: () => true,
  },
  {
    title: 'Mau dapat pengingat sebelum haid?',
    sub: 'Flo bisa memberi tahu kamu lewat notifikasi browser.',
    type: 'cards',
    key: 'reminder',
    options: [
      { id: 'yes', label: 'Ya, ingatkan aku', icon: 'bell' },
      { id: 'no', label: 'Tidak usah', icon: 'close' },
    ],
    set: (d, v) => { d.reminder = v; },
  },
];

/* ------------------------------- Sub-komponen ------------------------------ */

/** Langkah 0: masukan nama. */
function NameStep({ draft, setDraft }) {
  return (
    <div>
      <label htmlFor="ob-name" className="block mb-1 text-[0.8125rem] font-extrabold text-ink-2">Nama panggilan</label>
      <input
        id="ob-name"
        type="text"
        value={draft.name}
        maxLength={32}
        placeholder="Misal: Nazril"
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        className="w-full rounded-[16px] border border-line-2 bg-surface px-3.5 py-2.5 text-[0.9375rem] font-semibold text-ink placeholder:text-ink-3/70 focus:border-berry focus:bg-white focus:outline-none"
      />
      <p className="mt-1 text-[0.75rem] text-ink-3">Isi nama panggilan dulu supaya bisa lanjut.</p>
    </div>
  );
}

/**
 * Kartu pilihan onboarding.
 * @param {Object} p
 * @param {boolean} p.active
 */
function PickCard({ active, icon, title, sub, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'flex items-start gap-3 rounded-[20px] border-2 p-4 text-left transition-[transform,border-color,background-color] duration-150 active:scale-[0.99]',
        active
          ? 'border-berry bg-berry-soft/60 shadow-soft-1'
          : 'border-line bg-surface hover:border-line-2 hover:bg-surface-2',
      )}
    >
      {icon ? (
        <span className={cx(
          'grid place-items-center w-10 h-10 rounded-[14px] shrink-0',
          active ? 'bg-berry text-white' : 'bg-surface-2 text-ink-2',
        )}
        >
          <Icon name={icon} className="w-[1.25rem] h-[1.25rem]" />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-extrabold text-ink">{title}</span>
        {sub ? <span className="block text-[0.8125rem] text-ink-3">{sub}</span> : null}
      </span>
    </button>
  );
}

/* --------------------------------- util ---------------------------------- */

/**
 * State awal dari data yang sudah ada (mis. setelah ulangi onboarding).
 *
 * `state.periods` tidak dijamin urut, jadi tanggal awal diambil dari catatan
 * dengan `startDate` paling baru — bukan `periods[0]` yang bisa jadi periode
 * paling lama.
 * @param {Object} state
 */
function initialState(state) {
  const p = state.profile || {};
  const latest = state.periods?.length
    ? [...state.periods].sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0]
    : null;
  return {
    name: p.name || '',
    periodStart: latest?.startDate || '',
    cycleRange: 'normal',
    periodRange: 'normal',
    cycleRegularity: p.cycleRegularity || 'teratur',
    cycleLength: p.averageCycleLength || 28,
    periodLength: p.averagePeriodLength || 5,
    symptoms: [],
    reminder: p.reminderSettings?.enabled ? 'yes' : p.reminder ? 'yes' : 'no',
  };
}

/**
 * Selesaikan onboarding helper: tidak ada lagi — data periode ditambahkan apa
 * adanya pada `finish()` di atas.
 */
