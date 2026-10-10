/**
 * Halaman Kalender — ukuran penuh 12 bulan (memakai MiniCalendar).
 * Menyediakan ekspor data sebagai cadangan.
 */
import { useState, useCallback } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Card, Button, Notice } from '../components/ui.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';
import { MiniCalendar } from '../components/MiniCalendar.jsx';
import { useFloActions } from '../store.js';
import { exportData as exportDataFile, importData as importDataFile } from '../lib/storage.js';

/**
 * @param {Object} p
 * @param {Object} p.state
 * @param {Object} p.d
 * @param {Date} p.today
 * @param {(tab:string)=>void} p.onOpenLog
 */
export default function CalendarPage({ state, d, today, onOpenLog }) {
  const { replaceState } = useFloActions();
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null); // hasil baca berkas, menunggu konfirmasi

  /**
   * Ekspor seluruh data sebagai berkas JSON untuk cadangan.
   *
   * Memakai `exportData()` dari lapisan penyimpanan supaya formatnya sama
   * dengan yang dibaca `importData()` — termasuk pembungkus
   * `{app, version, exportedAt, data, cycles}`.
   */
  const exportData = useCallback(() => {
    try {
      const name = exportDataFile(state, state.cycles || []);
      setMsg({ tone: 'ok', text: `Berkas cadangan "${name}" berhasil diunduh.` });
    } catch (err) {
      console.warn(err);
      setMsg({ tone: 'danger', text: 'Gagal mengekspor data.' });
    }
  }, [state]);

  /**
   * Baca berkas cadangan lalu minta konfirmasi sebelum menimpa data.
   *
   * Impor MENGHAPUS seluruh data perangkat, jadi pengguna harus menyetujuinya
   * lebih dulu. Berkas dibaca lengkap (transkrip → JSON → validasi) sebelum
   * dialog muncul sehingga impor tidak pernah meninggalkan data setengah jalan.
   * @param {Event} e
   */
  const importData = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = importDataFile(String(reader.result));
      } catch (err) {
        setMsg({ tone: 'danger', text: err.message || 'Berkas tidak dapat dibaca.' });
        return;
      }
      setPending(parsed);
    };
    reader.onerror = () => setMsg({ tone: 'danger', text: 'Berkas tidak dapat dibaca.' });
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  /** Terapkan data cadangan setelah pengguna menyetujui. */
  const applyImport = useCallback(() => {
    if (!pending) return;
    try {
      replaceState(pending);
      setMsg({ tone: 'ok', text: 'Data berhasil dipulihkan.' });
    } catch (err) {
      console.warn(err);
      setMsg({ tone: 'danger', text: 'Gagal memulihkan data.' });
    }
    setPending(null);
  }, [pending, replaceState]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[1.45rem] font-black tracking-[-0.5px] text-ink">Kalender</h1>
        <p className="text-[0.9375rem] text-ink-3">Geser bulan dengan panah, ketuk tanggal untuk mencatat harian.</p>
      </header>

      {msg ? <Notice tone={msg.tone} icon="info">{msg.text}</Notice> : null}

      <Card>
        <MiniCalendar model={d.model} onPick={(iso) => onOpenLog('daily', iso)} />
      </Card>

      <Card>
        <div className="flex items-start gap-3 mb-3.5">
          <span className="grid place-items-center w-8 h-8 rounded-[12px] bg-plum-soft text-plum shrink-0">
            <Icon name="shield" className="w-[1.05rem] h-[1.05rem]" />
          </span>
          <div>
            <h2 className="text-[1.0625rem] font-extrabold text-ink">Cadangan data</h2>
            <p className="text-[0.8125rem] text-ink-3">Data hanya ada di perangkat ini. Simpan cadangan untuk mengembalikannya di perangkat lain.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="soft" icon="download" onClick={exportData}>Ekspor cadangan</Button>
          <label className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-transparent px-4 py-2.5 text-[0.9375rem] font-extrabold text-ink-2 cursor-pointer hover:bg-surface-2 transition-colors">
            <Icon name="upload" className="w-[1.15em] h-[1.15em]" />
            Impor dari berkas
            <input type="file" accept="application/json,.json" onChange={importData} className="hidden" />
          </label>
        </div>
        <p className="mt-2.5 text-[0.75rem] leading-relaxed text-ink-3">
          Mengimpor berkas akan mengganti seluruh data yang ada di perangkat ini. Buat cadangan lebih dulu kalau perlu.
        </p>
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        title="Ganti seluruh data?"
        text="Data di perangkat ini (menstruasi, gejala, catatan harian, dan pengaturan) akan diganti dengan isi berkas cadangan. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Ya, ganti datanya"
        cancelLabel="Batal"
        danger
        onResolve={(ok) => { if (ok) applyImport(); else setPending(null); }}
      />
    </div>
  );
}
