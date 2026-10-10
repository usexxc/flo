/**
 * Insight berbasis aturan. Semua kalimat dibentuk HANYA dari data yang benar-benar
 * dicatat pengguna — tidak ada diagnosis dan tidak ada klaim medis.
 * @module insight
 */

import { computeCycles, cycleStats, predictNextPeriod } from './cycle.js';
import { parseISO, diffDays, round1, num } from './util.js';

/** @typedef {'netral'|'positif'|'perhatian'} Tone */

/**
 * @typedef {Object} InsightItem
 * @property {string} id
 * @property {string} title
 * @property {string} text
 * @property {Tone} tone
 */

/**
 * Hitung insight dari data pengguna.
 * @param {{periods:import('./cycle.js').Period[], symptoms:Object[], dailyLogs:Object[], profile:Object}} state
 * @param {Date} today
 * @returns {{items:InsightItem[], ready:boolean, note:string}}
 */
export function buildInsights(state, today) {
  const periods = state.periods || [];
  const symptoms = state.symptoms || [];
  const logs = state.dailyLogs || [];
  const profile = state.profile;
  const stats = cycleStats(periods, profile);
  const cycles = computeCycles(periods, profile.averagePeriodLength);
  const closed = cycles.filter((c) => c.cycleLength != null);
  /** @type {InsightItem[]} */
  const items = [];

  if (!periods.length) {
    return {
      items: [],
      ready: false,
      note: 'Belum ada data siklus. Catat menstruasi pertamamu agar insight bisa disusun.',
    };
  }

  // 1. Rata-rata siklus dari riwayat.
  if (closed.length >= 1) {
    const recent = closed.slice(-3).map((c) => c.cycleLength);
    const avg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
    const span = recent.length > 1 ? ` dalam ${recent.length} siklus terakhir` : ' dari siklus pertamamu';
    items.push({
      id: 'avg-cycle',
      title: `Rata-rata siklusmu${span}`,
      text: `Data yang kamu catat menunjukkan panjang siklus rata-rata ${num(round1(avg))} hari. `
        + `Siklus terpendek ${stats.shortest} hari dan terpanjang ${stats.longest} hari.`,
      tone: 'netral',
    });
  } else {
    items.push({
      id: 'avg-cycle',
      title: 'Panjang siklus masih perkiraan awal',
      text: `Kamu baru mencatat satu siklus. Sementara ini perhitungan memakai angka ${stats.avgCycleLength} hari `
        + 'dari data awal yang kamu isi.',
      tone: 'netral',
    });
  }

  // 2. Lama menstruasi.
  const withEnd = periods.filter((p) => p.endDate);
  if (withEnd.length) {
    const lens = withEnd.map((p) => diffDays(parseISO(p.startDate), parseISO(p.endDate)) + 1);
    const avg = round1(lens.reduce((a, b) => a + b, 0) / lens.length);
    items.push({
      id: 'period-length',
      title: 'Lama menstruasi',
      text: `Menstruasimu rata-rata berlangsung ${num(avg)} hari dari ${withEnd.length} catatan yang lengkap.`,
      tone: 'netral',
    });
  }

  // 3. Kestabilan siklus.
  if (stats.variability != null && closed.length >= 2) {
    const v = stats.variability;
    if (v <= 4) {
      items.push({
        id: 'regularity',
        title: 'Siklusmu cenderung stabil',
        text: `Selisih antara siklus terpendek dan terpanjang hanya ${v} hari. `
          + 'Data yang kamu catat menunjukkan pola yang cukup konsisten.',
        tone: 'positif',
      });
    } else {
      items.push({
        id: 'regularity',
        title: 'Siklusmu cukup bervariasi',
        text: `Selisih antara siklus terpendek dan terpanjang ${v} hari. Variasi seperti ini bisa dipengaruhi `
          + 'stres, tidur, aktivitas, dan banyak hal lain. Bila variasi berlanjut atau mengganggu, '
          + 'pertimbangkan untuk berkonsultasi dengan tenaga kesehatan.',
        tone: 'perhatian',
      });
    }
  }

  // 4. Gejala menjelang haid.
  const symptomPattern = symptomPatternInsight(periods, symptoms);
  if (symptomPattern) items.push(symptomPattern);

  // 5. Mood yang paling sering dicatat.
  const moodCount = {};
  for (const l of logs) if (l.mood) moodCount[l.mood] = (moodCount[l.mood] || 0) + 1;
  for (const s of symptoms) {
    if (s.category === 'mood') moodCount[s.symptom] = (moodCount[s.symptom] || 0) + 1;
  }
  const moods = Object.entries(moodCount).sort((a, b) => b[1] - a[1]);
  if (moods.length) {
    items.push({
      id: 'mood',
      title: 'Mood yang paling sering muncul',
      text: `Dari catatanmu, mood "${moods[0][0]}" tercatat ${moods[0][1]} kali. `
        + 'Mencatat mood membantu kamu melihat kaitannya dengan fase siklus.',
      tone: 'netral',
    });
  }

  // 6. Prediksi berikutnya + keterlambatan.
  const pred = predictNextPeriod(periods, profile, today);
  if (pred) {
    if (pred.daysUntil > 0) {
      items.push({
        id: 'prediction',
        title: 'Perkiraan haid berikutnya',
        text: `Berdasarkan ${stats.source === 'riwayat' ? 'riwayat siklusmu' : 'data awal yang kamu isi'}, `
          + `haid berikutnya diperkirakan ${pred.daysUntil} hari lagi. Angka ini bisa bergeser mengikuti siklusmu.`,
        tone: 'netral',
      });
    } else if (pred.daysUntil < 0) {
      items.push({
        id: 'prediction',
        title: 'Haid belum tercatat',
        text: `Perkiraan sebelumnya sudah lewat ${Math.abs(pred.daysUntil)} hari. Siklus memang bisa bergeser — `
          + 'catat haidmu saat mulai, dan bila keterlambatan berlanjut pertimbangkan berkonsultasi dengan tenaga kesehatan.',
        tone: 'perhatian',
      });
    }
  }

  // 7. Kelengkapan catatan.
  const last7 = logs.filter((l) => diffDays(parseISO(l.date), today) <= 7 && diffDays(parseISO(l.date), today) >= 0);
  if (last7.length >= 3) {
    items.push({
      id: 'logging',
      title: 'Konsisten mencatat',
      text: `Kamu mencatat ${last7.length} hari dalam seminggu terakhir. Semakin rapi catatannya, `
        + 'semakin personal perkiraan siklusmu.',
      tone: 'positif',
    });
  }

  return {
    items,
    ready: true,
    note: 'Insight disusun otomatis dari data yang kamu catat di perangkat ini. Ini bukan diagnosis medis.',
  };
}

/**
 * Deteksi gejala yang lebih sering muncul pada 3 hari sebelum haid.
 * @param {import('./cycle.js').Period[]} periods
 * @param {Object[]} symptoms
 * @returns {InsightItem|null}
 */
function symptomPatternInsight(periods, symptoms) {
  if (symptoms.length < 3 || !periods.length) return null;
  const starts = periods.map((p) => parseISO(p.startDate));
  const isPre = (iso) => starts.some((s) => {
    const d = diffDays(parseISO(iso), s);
    return d >= 0 && d <= 3;
  });
  const pre = {};
  const other = {};
  for (const s of symptoms) {
    if (!s.date) continue;
    const bucket = isPre(s.date) ? pre : other;
    bucket[s.symptom] = (bucket[s.symptom] || 0) + 1;
  }
  const ranked = Object.entries(pre).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [name, count] = ranked[0];
  if (count < 2) return null;
  const elsewhere = other[name] || 0;
  const text = elsewhere === 0
    ? `"${name}" selalu kamu catat pada 3 hari menjelang menstruasi (${count} kali), dan tidak muncul di hari lain.`
    : `"${name}" tercatat ${count} kali menjelang menstruasi dan ${elsewhere} kali di hari lain. `
      + 'Pola seperti ini sering dikaitkan dengan fase menjelang haid.';
  return {
    id: 'symptom-pattern',
    title: 'Gejala menjelang menstruasi',
    text,
    tone: 'netral',
  };
}

/**
 * Ringkasan untuk kartu kecil di dashboard.
 * @param {{periods:import('./cycle.js').Period[], profile:Object}} state
 * @param {Date} today
 * @returns {string}
 */
export function quickSummary(state, today) {
  const stats = cycleStats(state.periods, state.profile);
  if (!state.periods.length) return 'Belum ada data siklus.';
  return `Rata-rata siklus ${stats.avgCycleLength} hari, menstruasi ${stats.avgPeriodLength} hari.`;
}
