/**
 * Halaman Dashboard — pusat aplikasi.
 * Menyapa pengguna, prediksi haid berikutnya, kalender mini, cincin siklus,
 * aksi cepat, wawasan hari ini, dan ringkasan siklus.
 */
import { useState, useEffect } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Card, CardHead, Button, Eyebrow, Notice, SectionTitle, cx } from '../components/ui.jsx';
import { CycleRing } from '../components/CycleRing.jsx';
import { MiniCalendar } from '../components/MiniCalendar.jsx';
import { parseISO, formatLong, formatFull, humanDays as humanDaysFn, monthName, toISO } from '../lib/util.js';
import { dueReminders } from '../lib/reminder.js';
import { todosForDay, sortTodos, toggleTodo } from '../lib/todos.js';

/** ISO 'YYYY-MM-DD' → '12 Okt'. */
function formatShort(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${d.getDate()} ${monthName(d.getMonth()).slice(0, 3)}`;
}

/** ISO 'YYYY-MM-DD' → 'Senin, 12 Oktober 2026'. */
function fmtFull(iso) {
  return iso ? formatFull(parseISO(iso)) : '';
}

/** Label keyakinan data yang ramah dibaca. */
const CONFIDENCE_LABEL = {
  awal: 'Awal',
  berkembang: 'Berkembang',
  personal: 'Personal',
};

/**
 * @param {Object} p
 * @param {Object} p.state
 * @param {Object} p.d
 * @param {Date} p.today
 * @param {(tab:string)=>void} p.onOpenLog
 */
export default function DashboardPage({ state, d, today, onOpenLog, onNavigate, onMutate }) {
  const { stats, prediction, info, range, todayLog, todaySymptoms } = d;
  const hasData = state.periods.length > 0;

  // Papan pengingat: sama dengan notifikasi sistem, tapi selalu tampil.
  const [reminders, setReminders] = useState(() => dueReminders({ state, today }));
  useEffect(() => {
    setReminders(dueReminders({ state, today }));
  }, [state, today]);

  if (!hasData) {
    return <EmptyDashboard onOpenLog={onOpenLog} />;
  }

  const phase = info ? info.phase : 'folikular';
  const phaseLabel = info?.phaseLabel || '';
  // Label "siklusmu belum teratur" hanya boleh muncul bila memang tidak teratur:
  // 'teratur' (standar) tidak menampilkan rentang sama sekali, 'tidak-tahu'
  // boleh ±1 hari, dan 'tidak-teratur' ±2 hari. Sebelumnya margin ±2 arah
  // (span ≥ 5) selalu membuat label muncul untuk pengguna yang siklusnya
  // konsisten sekalipun.
  const useRange = Boolean(range) && range.spread > 1;

  return (
    <div className="space-y-4 lg:space-y-5">
      <Greeting state={state} d={d} />

      {reminders.length ? (
        <Card>
          <CardHead title="Pengingat" icon="bell" hint="Yang perlu kamu perhatikan hari ini" />
          <div className="grid gap-2.5">
            {reminders.map((r) => (
              <Notice key={r.key} tone={r.kind === 'period-late' ? 'warn' : 'ok'} icon="bell">
                <span className="block text-[0.9375rem] font-extrabold text-ink">{r.title}</span>
                <span className="block text-[0.875rem] text-ink-2">{r.body}</span>
              </Notice>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" icon="plus" onClick={() => onOpenLog('period')}>Catat menstruasi</Button>
            <Button size="sm" variant="soft" icon="note" onClick={() => onOpenLog('daily')}>Catat harian</Button>
          </div>
        </Card>
      ) : null}

      {/* Kartu prediksi */}
      <section className="relative overflow-hidden rounded-[26px] border border-berry/20 p-5 text-white shadow-soft-2"
        style={{ background: 'linear-gradient(135deg, #A63D69 0%, #7C2A4C 55%, #6B4A7E 100%)' }}
      >
        <div className="absolute -right-10 -top-14 w-52 h-52 rounded-full opacity-80" style={{ background: 'rgba(255,255,255,.12)' }} aria-hidden="true" />
        <div className="absolute -right-24 top-16 w-56 h-56 rounded-full opacity-80" style={{ background: 'rgba(255,255,255,.08)' }} aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <Eyebrow tone="berry" icon="drop">
              {prediction?.isLate ? 'Haid diperkirakan sudah lewat' : 'Haid berikutnya diperkirakan'}
            </Eyebrow>
            <h2 className="mt-2.5 text-[1.65rem] leading-[1.15] font-black tracking-[-0.6px] sm:text-[1.9rem]">
              {useRange && range
                ? `${formatShort(range.start)} – ${formatShort(range.end)}`
                : formatShort(prediction?.date) || '—'}
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] font-semibold text-white/85">
              {prediction ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 font-extrabold text-white">
                    <Icon name="clock" className="w-3.5 h-3.5" />
                    {/* Telat ditulis "Telat N hari", bukan "N hari lalu" yang
                        mudah terbaca sebagai kabar baik. */}
                    {prediction.isLate ? `Telat ${prediction.lateBy} hari` : humanDaysFn(prediction.daysUntil)}
                  </span>
                  <span>{formatLong(parseISO(prediction.date))}</span>
                </>
              ) : (
                'Catat menstruasi untuk melihat perkiraan.'
              )}
            </p>
            {useRange ? (
              <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-white/80">
                <Icon name="info" className="w-3.5 h-3.5" />
                Rentang perkiraan karena siklusmu belum teratur
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenLog('period')}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[0.9375rem] font-extrabold text-berry-dark shadow-soft-2 transition-[transform,background-color] duration-150 hover:bg-white/90 active:scale-[0.975]"
          >
            <Icon name="drop" className="w-[1.15em] h-[1.15em]" />
            Haid mulai hari ini
          </button>
        </div>
      </section>

      {/* Aktivitas hari ini: maksimal tiga tugas belum selesai, bisa dicentang di sini */}
      <TodayTodos state={state} today={today} onMutate={onMutate} onNavigate={onNavigate} />

      {/* Kalender + cincin */}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:gap-5">
        <Card>
          <MiniCalendar today={today} model={d.model} onPick={(iso) => onOpenLog('daily', iso)} />
        </Card>

        <Card className="flex flex-col items-center">
          <CardHead title="Siklusmu hari ini" icon="target" className="w-full" />
          <CycleRing
            cycleDay={info?.cycleDay || 1}
            cycleLength={stats.avgCycleLength || 28}
            ovulationDay={info?.ovulationDay || 14}
            fertileStart={info?.fertileStart || 10}
            fertileEnd={info?.fertileEnd || 16}
            periodLength={stats.avgPeriodLength || 5}
            phaseLabel={phaseLabel}
          />
          <PhaseLegend phase={phase} />
        </Card>
      </div>

      {/* Aksi cepat */}
      <div>
        <SectionTitle>Aksi cepat</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickAction icon="drop" tone="berry" title="Haid mulai" sub="Catat hari pertama periode" onClick={() => onOpenLog('period')} />
          <QuickAction icon="heart" tone="sage" title="Gejala & mood" sub="Catat kondisi tubuh hari ini" onClick={() => onOpenLog('symptoms')} />
          <QuickAction icon="note" tone="plum" title="Catatan harian" sub="Tingkah laku, tidur, aktivitas" onClick={() => onOpenLog('daily')} />
        </div>
      </div>

      {/* Ringkasan hari ini */}
      {todayLog || todaySymptoms.length ? (
        <Card>
          <CardHead title="Sudah kamu catat hari ini" icon="check" hint="Ringkasan singkat untuk hari ini" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {todayLog?.mood ? <Pill icon="smile" label="Suasana hati" value={todayLog.mood} /> : null}
            {todaySymptoms.length ? (
              <div className="rounded-[18px] border border-line bg-surface-2 p-3.5">
                <span className="flex items-center gap-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.08em] text-ink-3">
                  <Icon name="heart" className="w-3.5 h-3.5" /> Gejala
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {todaySymptoms.map((s) => (
                    <span key={s.symptom} className="rounded-full bg-berry-soft px-2.5 py-1 text-[0.8125rem] font-bold text-berry-dark">
                      {s.symptom}
                      {s.severity ? <span className="opacity-70"> · {s.severity}</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Wawasan */}
      <Card>
        <CardHead title="Wawasan untukmu" icon="spark" action={(
          <Button variant="ghost" size="sm" icon="arrowRight" onClick={() => onNavigate('insight')}>
            Lihat semua
          </Button>
        )}
        />
        <InsightList insights={d.insights || []} />
      </Card>

      {/* Ringkasan siklus */}
      <Card>
        <CardHead title="Ringkasan siklus" icon="chart" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Panjang siklus" value={`${stats.avgCycleLength || '—'}`} unit="hari" tone="berry" icon="clock" />
          <Stat label="Durasi haid" value={`${stats.avgPeriodLength || '—'}`} unit="hari" tone="sage" icon="drop" />
          <Stat label="Siklus tercatat" value={`${state.periods.length || 0}`} unit="periode" tone="plum" icon="history" />
          <Stat label="Keyakinan data" value={CONFIDENCE_LABEL[stats.confidence] || stats.confidence || '—'} unit="" tone="amber" icon="shield" />
        </div>
      </Card>

      <p className="flex items-start gap-2 px-1 text-[0.8125rem] leading-relaxed text-ink-3">
        <Icon name="info" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>Semua angka dihitung dari catatanmu sendiri. Prediksi ini perkiraan, bukan diagnosis medis.</span>
      </p>
    </div>
  );
}

/* ------------------------------ bagian-bagian ------------------------------ */

function Greeting({ state, d }) {
  const name = state.profile.name?.trim() || 'kamu';
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pt-1 lg:pt-0">
      <div className="min-w-0">
        <h1 className="text-[1.45rem] leading-tight font-black tracking-[-0.5px] text-ink sm:text-[1.6rem]">
          {greet}, {name}
          <span className="align-middle"> 👋</span>
        </h1>
        <p className="text-[0.9375rem] text-ink-3">
          {d.insights?.length ? 'Ini gambaran siklusmu hari ini.' : 'Catat terus supaya prediksi makin akurat.'}
        </p>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[0.8125rem] font-extrabold text-ink-2">
        <Icon name="calendar" className="w-4 h-4 text-berry" />
        {fmtFull(d.todayIso)}
      </span>
    </div>
  );
}

/** Wawasan singkat (2–3 item). */
function InsightList({ insights }) {
  if (!insights.length) {
    return <p className="text-[0.9375rem] text-ink-3">Belum ada wawasan. Catat beberapa siklus dulu untuk melihat pola.</p>;
  }
  const tones = { positif: 'sage', perhatian: 'amber', netral: 'berry' };
  return (
    <div className="grid gap-2.5">
      {insights.slice(0, 3).map((ins, i) => (
        <div key={i} className="flex items-start gap-3 rounded-[18px] border border-line bg-surface-2 p-3.5">
          <span className={cx(
            'grid place-items-center w-9 h-9 rounded-[12px] shrink-0',
            ins.tone === 'positif' ? 'bg-sage-soft text-sage-dark'
              : ins.tone === 'perhatian' ? 'bg-amber-soft text-amber'
                : 'bg-berry-soft text-berry',
          )}
          >
            <Icon name={ins.icon || 'spark'} className="w-[1.05rem] h-[1.05rem]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[0.9375rem] font-extrabold text-ink">{ins.title}</h3>
            <p className="text-[0.875rem] leading-relaxed text-ink-2">{ins.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Legenda warna fase di bawah cincin. */
function PhaseLegend({ phase }) {
  const items = [
    { id: 'menstruasi', label: 'Haid', color: 'bg-berry' },
    { id: 'folikular', label: 'Folikuler', color: 'bg-lav' },
    { id: 'subur', label: 'Subur', color: 'bg-sage' },
    { id: 'ovulasi', label: 'Ovulasi', color: 'bg-sage-dark' },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
      {items.map((it) => (
        <span key={it.id} className={cx(
          'inline-flex items-center gap-1.5 text-[0.75rem] font-bold',
          phase === it.id ? 'text-ink' : 'text-ink-3',
        )}
        >
          <span className={cx('w-2.5 h-2.5 rounded-full', it.color)} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Tombol aksi cepat. */
function QuickAction({ icon, title, sub, tone, onClick }) {
  const tones = {
    berry: 'bg-berry-soft text-berry-dark group-hover:bg-[#f2d8e4]',
    sage: 'bg-sage-soft text-sage-dark group-hover:bg-[#d8ebe0]',
    plum: 'bg-plum-soft text-plum group-hover:bg-[#e2d8ec]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-[22px] border border-line bg-surface p-4 text-left shadow-soft-1 transition-[transform,box-shadow] duration-150 hover:shadow-soft-2 active:scale-[0.99]"
    >
      <span className={cx('grid place-items-center w-11 h-11 rounded-[15px] shrink-0 transition-colors', tones[tone] || tones.berry)}>
        <Icon name={icon} className="w-[1.35rem] h-[1.35rem]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-extrabold text-ink">{title}</span>
        <span className="block text-[0.8125rem] text-ink-3">{sub}</span>
      </span>
      <Icon name="arrowRight" className="ml-auto w-4 h-4 text-ink-3 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
    </button>
  );
}

/** Kartu statistik. */
function Stat({ label, value, unit, tone, icon }) {
  const tones = {
    berry: 'bg-berry-soft text-berry-dark',
    sage: 'bg-sage-soft text-sage-dark',
    plum: 'bg-plum-soft text-plum',
    amber: 'bg-amber-soft text-amber',
  };
  return (
    <div className="rounded-[20px] border border-line bg-surface-2 p-3.5">
      <span className={cx('grid place-items-center w-9 h-9 rounded-[12px] mb-2', tones[tone] || tones.berry)}>
        <Icon name={icon} className="w-[1.05rem] h-[1.05rem]" />
      </span>
      <p className="text-[0.75rem] font-extrabold uppercase tracking-[0.07em] text-ink-3">{label}</p>
      <p className="mt-0.5 text-[1.375rem] font-black leading-none tracking-[-0.6px] text-ink">
        {value}
        {unit ? <span className="ml-1 text-[0.8125rem] font-bold text-ink-3">{unit}</span> : null}
      </p>
    </div>
  );
}

/** Pil kecil di ringkasan hari ini. */
function Pill({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[18px] border border-line bg-surface-2 p-3.5">
      <span className="grid place-items-center w-9 h-9 rounded-[12px] bg-lav-soft text-lav shrink-0">
        <Icon name={icon} className="w-[1.05rem] h-[1.05rem]" />
      </span>
      <div className="min-w-0">
        <span className="block text-[0.75rem] font-extrabold uppercase tracking-[0.07em] text-ink-3">{label}</span>
        <strong className="block text-[0.9375rem] text-ink capitalize">{value}</strong>
      </div>
    </div>
  );
}

/** Keadaan kosong ketika belum ada catatan periode. */
/** Maksimal tugas yang ditampilkan di dashboard. */
const TODAY_TODO_LIMIT = 3;

/**
 * Kartu "Aktivitas Hari Ini" di dashboard: hingga tiga tugas hari ini yang belum
 * selesai. Bisa dicentang langsung tanpa membuka halaman Todo List.
 * Tidak menampilkan apa-apa bila tidak ada tugas hari ini, supaya tidak
 * mengambil perhatian dari perkiraan haid.
 */
function TodayTodos({ state, today, onMutate, onNavigate }) {
  // `today` dari App berupa Date; data tugas memakai string ISO lokal (YYYY-MM-DD).
  const todayKey = toISO(today);
  const todos = state.todos || [];
  const dayTodos = todosForDay(todos, todayKey);
  const open = sortTodos(dayTodos.filter((t) => !t.done));
  const shown = open.slice(0, TODAY_TODO_LIMIT);
  const doneCount = dayTodos.filter((t) => t.done).length;
  if (todos.length === 0 || (open.length === 0 && doneCount === 0)) return null;

  const rest = open.length - shown.length;
  return (
    <Card data-testid="today-todos">
      <CardHead
        title="Aktivitas Hari Ini"
        icon="check"
        hint={open.length
          ? `${open.length} tugas lagi untuk diselesaikan.`
          : 'Semua aktivitas hari ini sudah selesai.'}
        action={(
          <Button variant="ghost" size="sm" icon="arrowRight" onClick={() => onNavigate('todo')}>
            Lihat Semua
          </Button>
        )}
      />
      {shown.length ? (
        <ul className="grid gap-2">
          {shown.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-[16px] border border-line bg-surface-2 px-3.5 py-2.5">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-berry"
                checked={false}
                aria-label={`Tandai selesai: ${t.title}`}
                onChange={() => onMutate((s) => { s.todos = toggleTodo(s.todos || [], t.id, todayKey); })}
              />
              <span className="min-w-0 flex-1 break-words text-[0.9375rem] font-bold text-ink">{t.title}</span>
              {t.time ? <span className="shrink-0 text-[0.8125rem] font-semibold text-ink-3">{t.time}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {rest > 0 ? (
        <p className="mt-2 text-[0.8125rem] font-semibold text-ink-3">+{rest} tugas lainnya di halaman Todo List.</p>
      ) : null}
    </Card>
  );
}

function EmptyDashboard({ onOpenLog }) {
  return (
    <div className="pt-6">
      <Card className="mx-auto max-w-[520px] text-center p-8">
        <span className="grid place-items-center w-16 h-16 rounded-[22px] bg-berry-soft text-berry mx-auto mb-4">
          <Icon name="drop" className="w-8 h-8" />
        </span>
        <h1 className="text-[1.5rem] font-black tracking-[-0.5px] text-ink">Halo! 👋</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          Catat tanggal menstruasimu yang pertama. Dari sana Flo bisa memperkirakan siklus berikutnya
          dan menampilkan masa suburmu.
        </p>
        <div className="mt-6">
          <Button size="lg" icon="plus" onClick={() => onOpenLog('period')}>
            Catat menstruasi pertama
          </Button>
        </div>
      </Card>
    </div>
  );
}

