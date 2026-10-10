/**
 * Katalog pilihan tetap: gejala, mood, energi, flow, dan kebiasaan.
 * @module catalog
 */

/** @typedef {{id:string, label:string, icon:string}} Option */

/** Gejala fisik. @type {Option[]} */
export const PHYSICAL = [
  { id: 'Kram', label: 'Kram', icon: 'wave' },
  { id: 'Sakit kepala', label: 'Sakit kepala', icon: 'bolt' },
  { id: 'Nyeri punggung', label: 'Nyeri punggung', icon: 'leaf' },
  { id: 'Nyeri payudara', label: 'Nyeri payudara', icon: 'heart' },
  { id: 'Kembung', label: 'Kembung', icon: 'drop' },
  { id: 'Mual', label: 'Mual', icon: 'worry' },
  { id: 'Jerawat', label: 'Jerawat', icon: 'target' },
  { id: 'Kelelahan', label: 'Kelelahan', icon: 'bed' },
];

/** Mood. @type {Option[]} */
export const MOODS = [
  { id: 'Bahagia', label: 'Bahagia', icon: 'smile' },
  { id: 'Biasa', label: 'Biasa', icon: 'meh' },
  { id: 'Sedih', label: 'Sedih', icon: 'sad' },
  { id: 'Cemas', label: 'Cemas', icon: 'worry' },
  { id: 'Mudah marah', label: 'Mudah marah', icon: 'angry' },
  { id: 'Sensitif', label: 'Sensitif', icon: 'heart' },
];

/** Tingkat energi. @type {Option[]} */
export const ENERGIES = [
  { id: 'Rendah', label: 'Rendah', icon: 'moon' },
  { id: 'Sedang', label: 'Sedang', icon: 'meh' },
  { id: 'Tinggi', label: 'Tinggi', icon: 'bolt' },
];

/** Volume darah haid. @type {Option[]} */
export const FLOWS = [
  { id: 'light', label: 'Light', icon: 'drop' },
  { id: 'medium', label: 'Medium', icon: 'drop' },
  { id: 'heavy', label: 'Heavy', icon: 'drop' },
];

/** Label bahasa Indonesia untuk nilai flow. @type {Record<string,string>} */
export const FLOW_LABEL = { light: 'Light (ringan)', medium: 'Medium (sedang)', heavy: 'Heavy (deras)' };

/** Kebiasaan harian. @type {Option[]} */
export const HABITS = [
  { id: 'Tidur', label: 'Tidur cukup', icon: 'bed' },
  { id: 'Minum air', label: 'Minum air', icon: 'water' },
  { id: 'Olahraga', label: 'Olahraga', icon: 'run' },
];

/** Tingkat keparahan gejala. @type {Option[]} */
export const SEVERITIES = [
  { id: 'ringan', label: 'Ringan', icon: 'meh' },
  { id: 'sedang', label: 'Sedang', icon: 'wave' },
  { id: 'berat', label: 'Berat', icon: 'alert' },
];

/**
 * Cari definisi pilihan berdasarkan id.
 * @param {Option[]} list
 * @param {string} id
 * @returns {Option|undefined}
 */
export function findOption(list, id) {
  return list.find((o) => o.id === id);
}

/**
 * Nama ikon untuk sebuah gejala/mood, dengan fallback aman.
 * @param {string} name
 * @returns {string}
 */
export function iconForSymptom(name) {
  const all = [...PHYSICAL, ...MOODS, ...HABITS];
  const found = all.find((o) => o.id === name);
  return found ? found.icon : 'info';
}
