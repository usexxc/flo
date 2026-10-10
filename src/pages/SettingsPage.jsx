/**
 * Halaman Pengaturan — profil siklus, pengaturan aplikasi, dan zona bahaya.
 */
import { useState, useEffect } from 'react';
import { Icon } from '../components/Icon.jsx';
import {
  Card, CardHead, Button, Field, Input, Select, Notice, SectionTitle, cx,
} from '../components/ui.jsx';
import { useFloActions } from '../store.js';
import { Modal, ConfirmDialog } from '../components/Modal.jsx';
import { requestNotificationPermission, notificationPermission } from '../lib/reminder.js';

/** Keterangan status izin notifikasi, disusun per kondisi. */
const REMINDER_PERMISSION_NOTE = {
  granted: 'Notifikasi sistem aktif — pengingat juga selalu tampil di kartu Pengingat pada Beranda.',
  denied: 'Notifikasi sistem diblokir di pengaturan peramban. Pengingat tetap tampil di kartu Pengingat pada Beranda.',
  unsupported: 'Peramban ini tidak mendukung notifikasi sistem. Pengingat tetap tampil di kartu Pengingat pada Beranda.',
  default: 'Izin notifikasi belum diberikan. Pengingat tetap tampil di kartu Pengingat pada Beranda, dan notifikasi sistem diminta saat kamu menyalakan sakelar ini.',
};

/**
 * @param {Object} p
 * @param {Object} p.state
 * @param {Object} p.d
 * @param {(fn:(s:object)=>void)=>void} p.onMutate
 * @param {(msg:string, tone?:string)=>void} p.toast
 */
export default function SettingsPage({ state, d, onMutate, toast }) {
  const { resetAll, restartOnboarding } = useFloActions();
  const [confirm, setConfirm] = useState(null);
  const { profile } = state;
  const reminder = profile.reminderSettings || {};
  const permissionNote = REMINDER_PERMISSION_NOTE[notificationPermission()] || REMINDER_PERMISSION_NOTE.default;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[1.45rem] font-black tracking-[-0.5px] text-ink">Pengaturan</h1>
        <p className="text-[0.9375rem] text-ink-3">Sesuaikan profil dan kelola datamu.</p>
      </header>

      {/* Profil */}
      <Card>
        <CardHead title="Profilmu" icon="user" hint="Dipakai untuk menyapa dan menghitung siklus" />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field id="set-name" label="Nama panggilan">
            <Input
              id="set-name"
              value={profile.name || ''}
              placeholder="Nazril"
              onChange={(e) => onMutate((s) => { s.profile.name = e.target.value; })}
            />
          </Field>

          {/* Isian angka memakai draft lokal: clamp hanya saat blur, supaya
              mengetik "30" tidak langsung dipotong menjadi "15" di tengah
              penulisan. */}
          <NumberField
            id="set-cycle"
            label="Panjang siklus (hari)"
            hint="Panjang rata-rata siklusmu, 15–60 hari."
            min={15}
            max={60}
            value={profile.averageCycleLength}
            fallback={28}
            onCommit={(n) => onMutate((s) => { s.profile.averageCycleLength = n; })}
          />

          <NumberField
            id="set-period"
            label="Durasi haid (hari)"
            hint="Berapa lama haid biasanya berlangsung, 1–15 hari."
            min={1}
            max={15}
            value={profile.averagePeriodLength}
            fallback={5}
            onCommit={(n) => onMutate((s) => { s.profile.averagePeriodLength = n; })}
          />

          <Field id="set-reg" label="Keteraturan siklus">
            <Select
              id="set-reg"
              value={profile.cycleRegularity || 'teratur'}
              onChange={(e) => onMutate((s) => { s.profile.cycleRegularity = e.target.value; })}
            >
              <option value="teratur">Teratur</option>
              <option value="tidak-teratur">Tidak teratur</option>
              <option value="tidak-tahu">Belum tahu</option>
            </Select>
          </Field>
        </div>
      </Card>

      {/* Pengingat */}
      <Card>
        <CardHead title="Pengingat" icon="bell" hint="Pengaturan pengingat haid berikutnya" />
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 w-5 h-5 accent-berry"
            checked={Boolean(reminder.enabled)}
            onChange={async (e) => {
              const on = e.target.checked;
              if (on) await requestNotificationPermission();
              onMutate((s) => { s.profile.reminderSettings = { ...s.profile.reminderSettings, enabled: on }; });
              toast(on ? 'Pengingat dinyalakan.' : 'Pengingat dimatikan.', 'ok');
            }}
          />
          <span className="min-w-0">
            <span className="block text-[0.9375rem] font-extrabold text-ink">Ingatkan aku sebelum haid</span>
            <span className="block text-[0.875rem] text-ink-3">
              Pengingat muncul di perangkat ini {reminder.leadDays || 2} hari sebelum perkiraan haid berikutnya.
            </span>
          </span>
        </label>

        <p className="mt-3 flex items-start gap-2 rounded-[16px] border border-line bg-surface-2 p-3 text-[0.8125rem] leading-relaxed text-ink-2">
          <Icon name="bell" className="w-4 h-4 mt-0.5 shrink-0 text-ink-3" />
          <span>
            {permissionNote}
          </span>
        </p>

        {reminder.enabled ? (
          <div className="mt-3">
            <Field id="set-lead" label="Berapa hari sebelumnya?">
              <Select
                id="set-lead"
                value={String(reminder.leadDays || 2)}
                onChange={(e) => onMutate((s) => { s.profile.reminderSettings = { ...s.profile.reminderSettings, leadDays: Number(e.target.value) }; })}
              >
                {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n} hari sebelum</option>)}
              </Select>
            </Field>
          </div>
        ) : null}
      </Card>

      {/* Privasi */}
      <Card>
        <CardHead title="Privasi data" icon="lock" hint="Ini aplikasi sepenuhnya lokal" />
        <Notice tone="warn" icon="alert">
          Semua data hanya tersimpan di LocalStorage perangkat ini — tidak ada yang dikirim ke internet.
          Karena itu data TIDAK tersedia kalau kamu membuka Flo di mode privat/incognito, atau setelah
          menghapus data peramban. Simpan cadangan berkala lewat menu Kalender.
        </Notice>
      </Card>

      {/* Zona bahaya */}
      <div className="rounded-[26px] border border-danger/25 bg-danger-soft/50 p-5">
        <h2 className="flex items-center gap-2 text-[1.0625rem] font-extrabold text-danger">
          <Icon name="alert" className="w-[1.05rem] h-[1.05rem]" />
          Tindakan berisiko
        </h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <DangerButton icon="note" title="Ulangi onboarding" sub="Isi ulang 7 pertanyaan awal" onClick={() => setConfirm('onboarding')} />
          <DangerButton icon="trash" title="Hapus semua data" sub="Riwayat, gejala, dan profil" onClick={() => setConfirm('reset')} />
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'onboarding'}
        title="Ulangi onboarding?"
        text="Kamu akan kembali ke pertanyaan awal. Data menstruasi dan gejala yang sudah ada tidak dihapus."
        confirmLabel="Ulangi"
        onResolve={(ok) => {
          setConfirm(null);
          if (ok) { restartOnboarding(); toast('Onboarding diulang.', 'ok'); }
        }}
      />

      <ConfirmDialog
        open={confirm === 'reset'}
        title="Hapus semua data?"
        text="Semua catatan siklus, gejala, dan profil akan dihapus permanen dari perangkat ini. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus permanen"
        danger
        onResolve={(ok) => {
          setConfirm(null);
          if (ok) { resetAll(); toast('Semua data dihapus.', 'danger'); }
        }}
      />
    </div>
  );
}

/**
 * Isian angka dengan draft lokal.
 *
 * Nilai yang tampil boleh sementara di luar rentang selama pengguna mengetik
 * (mis. "1" sebelum jadi "15"); baru dibatasi saat blur. Ini menghindari
 * clamp per ketikan yang membuat angka 30 tidak bisa diketik.
 *
 * @param {Object} p
 * @param {string} p.id
 * @param {string} p.label
 * @param {string} [p.hint]
 * @param {number|undefined} p.value nilai tersimpan
 * @param {number} p.fallback dipakai bila `value` kosong/tidak valid
 * @param {number} p.min
 * @param {number} p.max
 * @param {(n:number)=>void} p.onCommit
 */
function NumberField({
  id, label, hint, value, fallback, min, max, onCommit,
}) {
  const shown = Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
  const [draft, setDraft] = useState(String(shown));

  // Ikuti nilai dari state bila berubah dari luar (mis. reset data).
  useEffect(() => { setDraft(String(shown)); }, [shown]);

  /**
   * Simpan nilai akhir setelah sensasi ketikan berhenti.
   */
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n <= 0) {
      setDraft(String(shown));
      return;
    }
    const bounded = Math.min(max, Math.max(min, Math.round(n)));
    setDraft(String(bounded));
    if (bounded !== Number(value)) onCommit(bounded);
  };

  return (
    <Field id={id} label={label} hint={hint}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={String(min)}
        max={String(max)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
    </Field>
  );
}

/**
 * Tombol tindakan berisiko.
 * @param {Object} p
 */
function DangerButton({ icon, title, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-[20px] border border-danger/25 bg-white p-3.5 text-left transition-[transform,box-shadow] duration-150 hover:shadow-soft-2 active:scale-[0.99]"
    >
      <span className="grid place-items-center w-10 h-10 rounded-[14px] bg-danger-soft text-danger shrink-0">
        <Icon name={icon} className="w-[1.25rem] h-[1.25rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-extrabold text-ink">{title}</span>
        <span className="block text-[0.8125rem] text-ink-3">{sub}</span>
      </span>
      <Icon name="chevronRight" className="w-4 h-4 text-ink-3 shrink-0" />
    </button>
  );
}

