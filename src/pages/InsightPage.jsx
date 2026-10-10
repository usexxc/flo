/**
 * Halaman Wawasan — penjelasan fase, pola siklus, dan rekomendasi umum.
 * Wawasan dihitung dari data pengguna sendiri (insight.js), diterjemahkan ke
 * kalimat yang mudah dibaca.
 */
import { Icon } from '../components/Icon.jsx';
import { Card, CardHead, Notice, cx } from '../components/ui.jsx';
import { PHASES } from '../lib/cycle.js';

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
 */
export default function InsightPage({ state, d }) {
  const { info, stats } = d;
  const phase = info?.phase || 'folikular';

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[1.45rem] font-black tracking-[-0.5px] text-ink">Wawasan</h1>
        <p className="text-[0.9375rem] text-ink-3">Apa yang sedang terjadi pada tubuhmu, dan apa yang baik dilakukan.</p>
      </header>

      {/* Fase saat ini */}
      <Card>
        <CardHead title="Fase siklusmu sekarang" icon="spark" hint="Berubah setiap hari mengikuti hari siklus" />
        <div className="rounded-[22px] border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="grid place-items-center w-12 h-12 rounded-[16px] shrink-0 bg-berry-soft text-berry">
              <Icon name="leaf" className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[1.15rem] font-black tracking-[-0.3px] text-ink">{PHASES?.[phase]?.label || 'Fase folikuler'}</h3>
              <p className="text-[0.875rem] font-bold text-ink-3">
                Hari ke-{info?.cycleDay || '—'} · siklus {stats.avgCycleLength || '—'} hari
              </p>
            </div>
          </div>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
            {PHASES?.[phase]?.desc || 'Hormon mulai naik secara perlahan; daya tahan tubuh biasanya membaik.'}
          </p>
          {PHASES?.[phase]?.tip ? (
            <p className="mt-2.5 flex items-start gap-2 rounded-[16px] bg-sage-soft/70 px-3.5 py-2.5 text-[0.875rem] font-semibold leading-relaxed text-sage-dark">
              <Icon name="check" className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{PHASES[phase].tip}</span>
            </p>
          ) : null}
        </div>
      </Card>

      {/* Wawasan terhitung */}
      {d.insights?.length ? (
        <Card>
          <CardHead title="Dari data kamu" icon="chart" hint="Dihitung dari catatan yang kamu masukkan" />
          <div className="grid gap-2.5">
            {d.insights.map((ins, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-[20px] border border-line bg-surface-2 p-4"
              >
                <span className={cx(
                  'grid place-items-center w-10 h-10 rounded-[14px] shrink-0',
                  ins.tone === 'positif' ? 'bg-sage-soft text-sage-dark'
                    : ins.tone === 'perhatian' ? 'bg-amber-soft text-amber'
                      : 'bg-berry-soft text-berry',
                )}
                >
                  <Icon name={ins.icon || 'spark'} className="w-[1.25rem] h-[1.25rem]" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[0.9375rem] font-extrabold text-ink">{ins.title}</h3>
                  <p className="text-[0.875rem] leading-relaxed text-ink-2">{ins.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Notice tone="info" icon="info">
          Catat beberapa siklus lebih banyak untuk mendapatkan wawasan yang lebih personal.
        </Notice>
      )}

      {/* Ringkasan angka */}
      <Card>
        <CardHead title="Angka hulus" icon="clock" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatBox label="Panjang siklus" value={`${stats.avgCycleLength || '—'} hari`} tone="berry" />
          <StatBox label="Durasi haid" value={`${stats.avgPeriodLength || '—'} hari`} tone="sage" />
          <StatBox label="Keyakinan data" value={CONFIDENCE_LABEL[stats.confidence] || stats.confidence || '—'} tone="amber" />
          <StatBox label="Siklus tercatat" value={`${state.periods.length}`} tone="plum" />
          <StatBox label="Hari ke-" value={`${info?.cycleDay || '—'}`} tone="berry" />
          <StatBox label="Fase" value={PHASES?.[phase]?.label || '—'} tone="sage" />
        </div>
      </Card>

      {/* Catatan penting */}
      <Notice tone="info" icon="alert">
        Flo bukan alat medis. Semua perkiraan bersifat umum dan didasarkan pada catatan pribadimu.
        Untuk masalah haid yang tidak biasa, konsultasikan dengan tenaga kesehatan.
      </Notice>
    </div>
  );
}

/**
 * Kotak angka dengan label.
 * @param {Object} p
 * @param {string} p.label
 * @param {string} p.value
 */
function StatBox({ label, value, tone }) {
  const tones = {
    berry: 'bg-berry-soft text-berry-dark',
    sage: 'bg-sage-soft text-sage-dark',
    plum: 'bg-plum-soft text-plum',
    amber: 'bg-amber-soft text-amber',
  };
  return (
    <div className="rounded-[20px] border border-line bg-surface-2 p-3.5">
      <p className="text-[0.75rem] font-extrabold uppercase tracking-[0.07em] text-ink-3">{label}</p>
      <p className="mt-0.5 flex items-start gap-1.5 text-[1.0625rem] leading-snug font-black tracking-[-0.4px] text-ink break-words">
        <span className={cx('mt-1 grid place-items-center w-5 h-5 shrink-0 rounded-full', tones[tone] || tones.berry)}>
          <Icon name="target" className="w-3 h-3" />
        </span>
        <span className="min-w-0">{value}</span>
      </p>
    </div>
  );
}
