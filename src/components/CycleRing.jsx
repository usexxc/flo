/**
 * Cincin siklus — port dari `cycleRing()` di ui.js lama.
 * Memakai SVG dengan arc berwarna per fase; versi ini menjadikan warna sebagai
 * token Tailwind agar kontras konsisten.
 */
import { Icon } from './Icon.jsx';

/** Warna fase mengikuti token index.css. */
const COLORS = {
  period: 'var(--color-berry)',
  fertile: 'var(--color-sage)',
  ovulation: 'var(--color-sage-dark)',
  track: '#ede6ea',
};

/**
 * @param {Object} p
 * @param {number} p.cycleDay
 * @param {number} p.cycleLength
 * @param {number} [p.ovulationDay]
 * @param {number} [p.fertileStart]
 * @param {number} [p.fertileEnd]
 * @param {number} p.periodLength
 * @param {string} [p.phaseLabel]
 */
export function CycleRing({
  cycleDay, cycleLength, ovulationDay, fertileStart, fertileEnd, periodLength, phaseLabel,
}) {
  const size = 240;
  const c = size / 2;
  const r = 98;
  const circumference = 2 * Math.PI * r;

  /**
   * Hitung busur satu segmen dari hari ke-hari.
   * @param {number} from
   * @param {number} to
   */
  const arc = (from, to, color) => {
    const frac = Math.max(0, Math.min(1, (to - from + 1) / cycleLength));
    const dash = `${(frac * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
    const rotate = -90 + ((from - 1) / cycleLength) * 360;
    return (
      <circle
        key={`${from}-${to}`}
        className="transition-[stroke-dasharray] duration-500"
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={dash}
        transform={`rotate(${rotate.toFixed(2)} ${c} ${c})`}
      />
    );
  };

  return (
    <div className="relative grid place-items-center w-[240px] h-[240px] max-w-full">
      <svg viewBox="0 0 240 240" className="w-full h-full -rotate-0" role="img" aria-label={`Hari siklus ke-${cycleDay} dari ${cycleLength}. ${phaseLabel || ''}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={COLORS.track} strokeWidth="16" />
        {arc(1, periodLength, COLORS.period)}
        {arc(fertileStart, fertileEnd, COLORS.fertile)}
        {arc(ovulationDay, ovulationDay, COLORS.ovulation)}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <span className="block text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-ink-3">Hari ke-</span>
          <strong className="block text-[3.25rem] leading-[1] font-black tracking-[-2px] text-berry">{cycleDay}</strong>
          {phaseLabel ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-berry-soft px-2.5 py-0.5 text-[0.75rem] font-extrabold text-berry-dark">
              <Icon name="spark" className="w-3.5 h-3.5" />
              {phaseLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
