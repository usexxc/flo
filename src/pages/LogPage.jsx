/**
 * Form pencatatan harian — satu layar untuk mencatat haid, gejala, mood,
 * energi, dan kebiasaan. Bertindak baik sebagai halaman maupun modal.
 * @module pages/LogPage
 */
import { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Button, Chip, Field, Input, Select, Notice, SectionTitle, cx } from '../components/ui.jsx';
import { PHYSICAL, MOODS, ENERGIES, HABITS, SEVERITIES } from '../lib/catalog.js';
import { toISO, todayISO, parseISO, addDays, formatFull, formatShort } from '../lib/util.js';
import { sortPeriods } from '../lib/cycle.js';
import { checkNewPeriodStart, diffDays, MAX_PERIOD_DAYS, MIN_CYCLE_DAYS } from '../lib/periodRules.js';

/**
 * Pesan penolakan untuk haid baru. Teksnya menyebut penyebab yang benar
 * (haid bentrok, terlalu dekat dengan haid sebelum/sesudah).
 * @param {{reason:string, period:object, days?:number}} problem
 * @returns {string}
 */
function periodProblemMessage({ reason, period, days }) {
  const s = parseISO(period.startDate);
  const e = period.endDate ? parseISO(period.endDate) : null;
  if (reason === 'inside') {
    if (!e) return `Tanggal itu masuk haid ${formatShort(s)} yang belum ditandai selesai. Tandai akhir haid dulu, atau pilih tanggal lain.`;
    return `Tanggal itu sudah masuk haid ${formatShort(s)} – ${formatShort(e)}. Pilih tanggal lain.`;
  }
  if (reason === 'too-close-before') {
    return `Jarak ke haid ${formatShort(s)} hanya ${days} hari. Pilih tanggal minimal ${MIN_CYCLE_DAYS} hari setelahnya.`;
  }
  return `Haid ${formatShort(s)} hanya ${days} hari lagi. Pilih tanggal minimal ${MIN_CYCLE_DAYS} hari sebelumnya.`;
}

/**
 * @param {Object} p
 * @param {Object} p.state state Flo
 * @param {Object} p.d data turunan
 * @param {(fn:(s:object)=>void)=>void} p.onMutate
 * @param {(msg:string, tone?:string)=>void} p.toast
 * @param {string} [p.initialTab]
 * @param {string} [p.initialDate]
 * @param {boolean} [p.embedded] true bila dirender sebagai isi modal
 * @param {()=>void} [p.onDone]
 */
export default function LogPage({
  state, d, onMutate, toast, initialTab = 'period', initialDate, embedded, onDone,
}) {
  const today = todayISO();
  const [date, setDate] = useState(initialDate || today);
  const [tab, setTab] = useState(() => {
    const valid = ['period', 'symptoms', 'daily'];
    return valid.includes(initialTab) ? initialTab : 'period';
  });
  const existing = useMemo(() => state.dailyLogs.find((l) => l.date === date) || null, [state.dailyLogs, date]);
  const isPeriodStart = useMemo(
    () => state.periods.some((p) => p.startDate === date),
    [state.periods, date],
  );

  // Form gejala & harian di-mount ulang setiap kali tanggal berganti, supaya
  // isian tanggal sebelumnya tidak ikut tersimpan ke tanggal baru.
  const formKey = `${tab}:${date}`;

  return (
    <div className={embedded ? '' : 'max-w-[860px]'}>
      {!embedded ? (
        <header className="mb-4">
          <h1 className="text-[1.45rem] font-black tracking-[-0.5px] text-ink">Catat hari ini</h1>
          <p className="text-[0.9375rem] text-ink-3">Semua catatan tersimpan di perangkatmu, bukan di server.</p>
        </header>
      ) : null}

      {/* Pilih tanggal */}
      <div className="rounded-[20px] border border-line bg-surface p-4 mb-4">
        <Field id="log-date" label="Tanggal" hint="Kamu bisa mencatat untuk tanggal yang sudah lewat.">
          <Input
            id="log-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setDate(today)}>Hari ini</Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(shift(today, -1))}>Kemarin</Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(shift(today, -2))}>2 hari lalu</Button>
        </div>
      </div>

      {/* Tab kelompok */}
      <div role="tablist" aria-label="Jenis catatan" className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.875rem] font-extrabold transition-colors duration-150',
              tab === t.id ? 'bg-berry border-berry/30 text-white shadow-soft-1' : 'bg-surface border-line text-ink-2 hover:bg-surface-2',
            )}
          >
            <Icon name={t.icon} className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tab === 'period' ? (
          <PeriodForm
            date={date}
            state={state}
            isPeriodStart={isPeriodStart}
            onMutate={onMutate}
            toast={toast}
            onDone={onDone}
          />
        ) : null}

        {tab === 'symptoms' ? (
          <SymptomsForm key={formKey} date={date} state={state} onMutate={onMutate} toast={toast} />
        ) : null}

        {tab === 'daily' ? (
          <DailyForm key={formKey} date={date} state={state} d={d} existing={existing} onMutate={onMutate} toast={toast} />
        ) : null}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'period', label: 'Menstruasi', icon: 'drop' },
  { id: 'symptoms', label: 'Gejala & mood', icon: 'heart' },
  { id: 'daily', label: 'Harian', icon: 'note' },
];

/* ------------------------------- Menstruasi ------------------------------- */

/**
 * @param {Object} p
 * @param {string} p.date
 * @param {boolean} p.isPeriodStart
 */
function PeriodForm({ date, state, isPeriodStart, onMutate, toast, onDone }) {
  const periods = state.periods;
  const alreadyLogged = periods.some((p) => p.startDate === date);

  // Periode terbaru = startDate paling akhir (urut naik), bukan elemen terakhir
  // pada array yang urutnya bergantung pada urutan input pengguna.
  const lastPeriod = useMemo(() => {
    const sorted = sortPeriods(periods);
    return sorted.length ? sorted[sorted.length - 1] : null;
  }, [periods]);

  /**
   * Tambah catatan menstruasi baru (hanya bila tanggal belum ada).
   *
   * `endDate` sengaja dibiarkan kosong: haid baru dimulai dan belum tahu
   * kapan berakhir. Mesin siklus memperlakukan haid tanpa tanggal akhir
   * sebagai "perkiraan" (`assumedDays`), bukan langsung 1 hari. Pengguna bisa
   * menekan "Tandai akhir haid" nanti.
   */
  const logStart = () => {
    if (!date) {
      toast('Pilih tanggalnya dulu.', 'warn');
      return;
    }
    if (alreadyLogged) {
      toast('Tanggal itu sudah tercatat.', 'warn');
      return;
    }
    const problem = checkNewPeriodStart(periods, date);
    if (problem) {
      toast(periodProblemMessage(problem), 'warn');
      return;
    }
    onMutate((s) => {
      s.periods.push({
        id: uid(),
        startDate: date,
        endDate: '',
        flow: 'medium',
      });
      s.periods = sortPeriods(s.periods);
    });
    toast('Haid hari ini tercatat.', 'ok');
    onDone?.();
  };

  /**
   * Tandai hari ini sebagai akhir haid (menyelesaikan periode terakhir).
   */
  const logEnd = () => {
    if (!lastPeriod) return;
    if (!date) {
      toast('Pilih tanggalnya dulu.', 'warn');
      return;
    }
    const days = diffDays(date, lastPeriod.startDate) + 1;
    if (days <= 0) {
      toast('Tanggal akhir harus setelah tanggal mulai.', 'danger');
      return;
    }
    if (days > MAX_PERIOD_DAYS) {
      toast(`Haid lebih dari ${MAX_PERIOD_DAYS} hari sebaiknya diperiksa ke dokter. Periksa lagi tanggalnya.`, 'danger');
      return;
    }
    onMutate((s) => {
      const target = s.periods.find((p) => p.id === lastPeriod.id);
      if (target) target.endDate = date;
    });
    toast('Durasi haid diperbarui.', 'ok');
    onDone?.();
  };

  return (
    <Section
      icon="drop"
      title="Menstruasi"
      hint="Haid dimulai di tanggal mana?"
    >
      {lastPeriod ? (
        <div className="rounded-[18px] border border-line bg-surface-2 p-3.5 text-[0.875rem] text-ink-2">
          <span className="font-extrabold text-ink">Terakhir tercatat:</span>{' '}
          {fmtDate(lastPeriod.startDate)}
          {lastPeriod.endDate && lastPeriod.endDate !== lastPeriod.startDate
            ? ` · ${diffDays(lastPeriod.endDate, lastPeriod.startDate) + 1} hari` : ''}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2.5">
        <Button icon="plus" onClick={logStart} disabled={alreadyLogged}>
          {alreadyLogged ? 'Sudah tercatat' : 'Haid mulai tanggal ini'}
        </Button>
        {lastPeriod ? (
          <Button variant="soft" icon="check" onClick={logEnd}>
            Tandai akhir haid
          </Button>
        ) : null}
      </div>

      {alreadyLogged ? (
        <Notice tone="ok" icon="check">
          Tanggal ini sudah tercatat sebagai awal menstruasi.
        </Notice>
      ) : null}
    </Section>
  );
}

/* ----------------------------- Gejala & mood ------------------------------ */

/**
 * @param {Object} p
 * @param {string} p.date
 */
function SymptomsForm({ date, state, onMutate, toast }) {
  const [chosen, setChosen] = useState(() => new Set(
    state.symptoms.filter((s) => s.date === date).map((s) => s.symptom),
  ));
  const [severity, setSeverity] = useState(
    () => state.symptoms.find((s) => s.date === date)?.severity || 'sedang',
  );

  /**
   * Toggle gejala pada daftar pilihan.
   * @param {string} id
   */
  const toggle = (id) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = () => {
    // Boleh menyimpan tanpa gejala — itu berarti menghapus catatan hari itu.
    // Sebelumnya memaksa pilih minimal satu, padahal pengguna kadang ingin
    // membetulkan: "sebenarnya aku tidak punya gejala hari ini".
    onMutate((s) => {
      // Buang gejala lama untuk tanggal ini, lalu tulis ulang sesuai pilihan.
      s.symptoms = s.symptoms.filter((x) => x.date !== date);
      [...chosen].forEach((symptom) => {
        s.symptoms.push({ date, symptom, severity, id: uid() });
      });
    });
    toast(chosen.size ? 'Gejala tersimpan.' : 'Catatan gejala untuk tanggal ini dikosongkan.', 'ok');
  };

  return (
    <Section icon="heart" title="Gejala" hint="Pilih semua yang kamu rasakan hari ini.">
      <IconGroup options={PHYSICAL} chosen={chosen} onToggle={toggle} />

      <div>
        <SectionTitle>Tingkat keparahan</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {SEVERITIES.map((s) => (
            <Chip key={s.id} label={s.label} active={severity === s.id} onClick={() => setSeverity(s.id)} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Button icon="check" onClick={save}>Simpan gejala</Button>
      </div>
    </Section>
  );
}

/* --------------------------------- Harian --------------------------------- */

/**
 * @param {Object} p
 * @param {string} p.date
 * @param {Object|null} p.existing
 */
function DailyForm({ date, state, existing, onMutate, toast }) {
  const [mood, setMood] = useState(existing?.mood || '');
  const [energy, setEnergy] = useState(existing?.energy || '');
  const [habits, setHabits] = useState(() => new Set(existing?.habits || []));
  const [note, setNote] = useState(existing?.note || '');

  /**
   * @param {string} id
   */
  const toggleHabit = (id) => {
    setHabits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = () => {
    onMutate((s) => {
      const idx = s.dailyLogs.findIndex((l) => l.date === date);
      const record = {
        date, id: existing?.id || uid(), mood, energy, habits: [...habits], note,
      };
      if (idx >= 0) s.dailyLogs[idx] = record; else s.dailyLogs.push(record);
    });
    toast('Catatan harian tersimpan.', 'ok');
  };

  return (
    <Section icon="smile" title="Suasana hati & kebiasaan" hint="Bagaimana perasaanmu hari ini?">
      <div>
        <SectionTitle>Suasana hati</SectionTitle>
        <IconGroup options={MOODS} chosen={mood ? new Set([mood]) : new Set()} onToggle={(id) => setMood(mood === id ? '' : id)} />
      </div>

      <div>
        <SectionTitle>Tingkat energi</SectionTitle>
        <IconGroup options={ENERGIES} chosen={energy ? new Set([energy]) : new Set()} onToggle={(id) => setEnergy(energy === id ? '' : id)} />
      </div>

      <div>
        <SectionTitle>Kebiasaan</SectionTitle>
        <IconGroup options={HABITS} chosen={habits} onToggle={toggleHabit} />
      </div>

      <Field id="log-note" label="Catatan" hint="Opsional — tulis apa saja yang ingin kamu ingat.">
        <Input
          id="log-note"
          placeholder="Contoh: meriang terus setelah pulang sekolah"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <div>
        <Button icon="check" onClick={save}>Simpan catatan harian</Button>
      </div>
    </Section>
  );
}

/* -------------------------------- bantuan --------------------------------- */

/**
 * Kelompok chip dengan ikon.
 * @param {Object} p
 * @param {Array} p.options
 * @param {Set<string>|Set<string>} p.chosen
 * @param {(id:string)=>void} p.onToggle
 */
function IconGroup({ options, chosen, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Chip
          key={o.id}
          icon={o.icon}
          label={o.label}
          active={chosen.has(o.id)}
          onClick={() => onToggle(o.id)}
        />
      ))}
    </div>
  );
}

/**
 * Wadah bagian form.
 * @param {Object} p
 * @param {string} p.icon
 * @param {string} p.title
 * @param {string} [p.hint]
 */
function Section({ icon, title, hint, children }) {
  return (
    <section className="rounded-[22px] border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3.5 flex items-start gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-[14px] bg-berry-soft text-berry shrink-0">
          <Icon name={icon} className="w-[1.25rem] h-[1.25rem]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.0625rem] font-extrabold tracking-[-0.2px] text-ink">{title}</h2>
          {hint ? <p className="text-[0.8125rem] text-ink-3">{hint}</p> : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Tanggal ISO → 'Selasa, 8 Oktober 2026'. */
function fmtDate(iso) {
  return formatFull(parseISO(iso));
}

/** @returns {string} id unik */
function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/**
 * Geser tanggal ISO.
 * @param {string} iso
 * @param {number} days
 */
function shift(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

