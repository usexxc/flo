/**
 * Ikon SVG original Flo (garis 1,7px, sudut membulat) — dipindahkan dari modul
 * `icon()` vanilla menjadi komponen React. Path dipertahankan sama persis
 * agar tampilan ikon tidak berubah.
 */
const PATHS = {
  brand: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3.4c3 2.4 4.6 5.2 4.6 8.6S15 18.2 12 20.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 3.4C9 5.8 7.4 8.6 7.4 12s1.6 6.2 4.6 8.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  home: '<path d="M4 10.5 12 4l8 6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9.8V19a1 1 0 0 0 1 1h3.2v-4.4h3.6V20H17a1 1 0 0 0 1-1V9.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="8.6" cy="14.4" r="1.5" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
  history: '<path d="M12 4.2a7.8 7.8 0 1 1-7.5 9.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 4.6v4.6h4.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8.6V12l2.8 1.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  spark: '<path d="M12 3.6l1.9 4.9 4.9 1.9-4.9 1.9L12 17.2l-1.9-4.9L5.2 10.4l4.9-1.9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M18.4 16.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  gear: '<circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.4v2.2M12 18.4v2.2M4.6 7.9l1.9 1.1M17.5 15l1.9 1.1M4.6 16.1l1.9-1.1M17.5 9l1.9-1.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  drop: '<path d="M12 3.6c3.1 3.6 5.4 6.4 5.4 9.4A5.4 5.4 0 0 1 12 18.4a5.4 5.4 0 0 1-5.4-5.4c0-3 2.3-5.8 5.4-9.4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  heart: '<path d="M12 19.6s-6.8-4.1-6.8-8.8A3.8 3.8 0 0 1 12 8.1a3.8 3.8 0 0 1 6.8 2.7c0 4.7-6.8 8.8-6.8 8.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  bell: '<path d="M6.6 10.4a5.4 5.4 0 0 1 10.8 0c0 4 1.4 5.6 1.4 5.6H5.2s1.4-1.6 1.4-5.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.2 19a2 2 0 0 0 3.6 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  shield: '<path d="M12 3.8 5.6 6.3v5.2c0 3.9 2.7 6.9 6.4 8.2 3.7-1.3 6.4-4.3 6.4-8.2V6.3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.4 12.1l1.9 1.9 3.5-3.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  chart: '<path d="M4.4 19.4h15.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="6" y="11.6" width="3.4" height="5.4" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="10.9" y="8" width="3.4" height="9" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="15.8" y="13.4" width="3.4" height="3.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  leaf: '<path d="M19 5.2c.6 6.1-2.6 10.2-7.4 10.2-2.4 0-4.2-1.5-4.2-3.6 0-3.7 4.4-6 11.6-6.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M5.2 19.2c1.5-3.6 4-6.2 7.6-8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  moon: '<path d="M18.6 14.8A7 7 0 0 1 9.2 5.4a7.2 7.2 0 1 0 9.4 9.4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  water: '<path d="M12 4.2c2.6 3.1 4.4 5.3 4.4 7.7a4.4 4.4 0 0 1-8.8 0c0-2.4 1.8-4.6 4.4-7.7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.6 12.2a2.4 2.4 0 0 0 2.4 2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  run: '<circle cx="14.6" cy="5.6" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 20.4l3.2-4.6-1-3.6 3.4-2 2.2 3.2 3 .6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.2 15.8 5.6 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  bed: '<path d="M3.6 19v-6.4A2 2 0 0 1 5.6 10.6h12.8a2 2 0 0 1 2 2V19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M3.6 15.6h16.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="8.2" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  bolt: '<path d="M13.2 3.6 6.8 13h4l-1 7.4L16.6 11h-4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  smile: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 14.2a3.8 3.8 0 0 0 6 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.4" cy="10" r="1" fill="currentColor"/><circle cx="14.6" cy="10" r="1" fill="currentColor"/>',
  meh: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9.2 14.6h5.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.4" cy="10" r="1" fill="currentColor"/><circle cx="14.6" cy="10" r="1" fill="currentColor"/>',
  sad: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 15.4a3.8 3.8 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.4" cy="10.2" r="1" fill="currentColor"/><circle cx="14.6" cy="10.2" r="1" fill="currentColor"/>',
  worry: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.6 9.2l2 1M15.4 9.2l-2 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9.4 15.2c1.6-1.2 3.6-1.2 5.2 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  angry: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.4 9.4l2.2.8M15.6 9.4l-2.2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9.2 15.6c1.8-.9 3.8-.9 5.6 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  wave: '<path d="M4 12c1.6-2 3.2-2 4.8 0s3.2 2 4.8 0 3.2-2 4.8 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 16.4c1.6-2 3.2-2 4.8 0s3.2 2 4.8 0 3.2-2 4.8 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  check: '<path d="M5 12.8l4.4 4.2L19 6.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  chevronLeft: '<path d="M14.6 5.6 8 12l6.6 6.4" fill="none" stroke="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronRight: '<path d="M9.4 5.6 16 12l-6.6 6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  edit: '<path d="M15.4 4.8l3.8 3.8-9.2 9.2-4.4.6.6-4.4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M13.6 6.6l3.8 3.8" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  trash: '<path d="M5.6 7.4h12.8M9.4 7.4V5.6a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1v1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7 7.4l.8 11a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3l.8-11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
  download: '<path d="M12 4.4v10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7.6 10.4 12 14.8l4.4-4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 18.6h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  upload: '<path d="M12 15.2V5.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7.6 9.6 12 5.2l4.4 4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 18.6h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  info: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8.2" r="1.1" fill="currentColor"/>',
  alert: '<path d="M12 4.6 20 18.4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 10v3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.2" r="1" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.6V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  note: '<path d="M6 4.6h8.4L19 9.2v10.2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 4.8v4.6h4.6M8.4 13h7.2M8.4 16.4h4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  target: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  user: '<circle cx="12" cy="8.4" r="3.8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.8 19.6a7.2 7.2 0 0 1 14.4 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  lock: '<rect x="5" y="10.4" width="14" height="9.2" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.4 10.4V8.2a3.6 3.6 0 0 1 7.2 0v2.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  arrowRight: '<path d="M5 12h13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12.6 6.6 18 12l-5.4 5.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  pause: '<rect x="7" y="5.4" width="3.6" height="13.2" rx="1.4" fill="currentColor"/><rect x="13.4" y="5.4" width="3.6" height="13.2" rx="1.4" fill="currentColor"/>',
};

/**
 * Ikon Flo.
 * @param {Object} props
 * @param {keyof typeof PATHS} props.name
 * @param {string} [props.className]
 */
export function Icon({ name, className = 'w-5 h-5' }) {
  const body = PATHS[name] || PATHS.info;
  return (
    <svg
      className={`${className} shrink-0`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      // Path ikon bersifat statis dan berasal dari sumber internal, bukan input pengguna.
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

/** Ikon merek Flo (lingkaran siklus) untuk sidebar dan landing. */
export function BrandMark({ className = 'w-9 h-9' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="21" fill="#FDF1F5" />
      <circle cx="24" cy="24" r="15.5" fill="none" stroke="#A63D69" strokeWidth="2" />
      <path d="M24 8.5c5.2 4.4 8 9.4 8 15.5S29.2 35.1 24 39.5" fill="none" stroke="#6B4A7E" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 8.5c-5.2 4.4-8 9.4-8 15.5s2.8 11.1 8 15.5" fill="none" stroke="#6FA98C" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="4.4" fill="#A63D69" />
    </svg>
  );
}
