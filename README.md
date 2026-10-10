# Flo — Pencatat Siklus Menstruasi

Aplikasi web untuk mencatat menstruasi, memahami pola siklus, dan melihat
**perkiraan** kapan haid berikutnya akan datang. Tanpa login, tanpa akun, tanpa
server: seluruh data tersimpan di perangkat pengguna lewat LocalStorage.

Dibangun dengan React 19, Vite 8, dan Tailwind CSS 4.

## Menjalankan

```bash
npm install
npm run dev          # dev server di http://127.0.0.1:8140
npm run build        # build produksi ke dist/
npm run preview      # pratinjau build di http://127.0.0.1:8140
```

## Alur aplikasi

```
Onboarding (langkah setup) → Beranda
```

Kunjungan berikutnya langsung masuk Beranda selama data masih ada di
LocalStorage. Tombol reset di Pengaturan mengembalikan aplikasi ke onboarding.

Navigasi utama lewat bottom nav: Beranda, Kalender, Catat, Riwayat, Wawasan,
Pengaturan. Halaman disimpan di hash URL (`#/history`, dst.), sehingga tombol
kembali di peramban/HP mundur ke halaman sebelumnya, bukan keluar aplikasi.

## Fitur

- **Catat menstruasi**: tandai hari pertama haid, lalu tandai akhirnya. Haid
  baru yang bentrok dengan haid lain, atau terlalu dekat dengan haid
  sebelum/sesudahnya, ditolak dengan pesan penyebabnya.
- **Gejala & mood**: catat gejala dengan tingkat keparahan, mood, energi, dan
  kebiasaan. Menyimpan tanpa gejala berarti menghapus catatan hari itu.
- **Catatan harian**: catatan tambahan per tanggal.
- **Riwayat**: daftar siklus; catatan haid bisa dihapus dengan konfirmasi dan
  dikembalikan lewat tombol undo.
- **Kalender**: menandai haid, perkiraan, masa subur, dan ovulasi.
- **Wawasan**: ringkasan berbasis aturan dari data pengguna.
- **Pengingat**: pengingat sebelum perkiraan haid dan pengingat catat harian.
- **Pengaturan**: ubah profil siklus, pengingat, dan reset semua data.
- **Cadangan** (di halaman Kalender): ekspor data ke berkas JSON, dan impor dari
  berkas dengan konfirmasi sebelum data diganti.

## Perhitungan

- **Panjang siklus** = jarak hari pertama haid ke hari pertama haid berikutnya.
- **Rata-rata siklus** dihitung dari seluruh siklus yang sudah selesai; bila
  belum ada, dipakai angka dari profil awal (ditandai sebagai perkiraan awal).
- **Perkiraan haid berikutnya** = hari pertama haid terakhir + rata-rata siklus.
- **Perkiraan ovulasi** = 14 hari sebelum perkiraan haid berikutnya; masa subur
  adalah 5 hari sebelum sampai 1 hari sesudahnya.
- **Keterlambatan**: bila perkiraan sudah lewat dan belum ada catatan baru,
  aplikasi menampilkannya sebagai "Telat N hari". Tanggal perkiraan tidak
  digeser diam-diam.
- **Hari siklus** dihitung dari haid aktual terakhir, bukan dari perkiraan.
- **Aturan catat haid** (`src/lib/periodRules.js`): haid baru ditolak bila
  (1) jatuh di dalam haid lain, atau (2) berjarak kurang dari 10 hari dari
  awal haid terdekat di kedua sisi. Pemeriksaan memakai haid terdekat, bukan
  haid terbaru, sehingga backfill (mencatat haid lama) tetap bisa dilakukan.
- **Durasi haid** yang belum ditandai selesai dianggap maksimal 15 hari untuk
  pemeriksaan tumpang-tindih.

Semua hasil prediksi bersifat **perkiraan berdasarkan data yang dicatat**, bukan
diagnosis medis dan bukan metode kontrasepsi.

## Pengingat

Pengingat hanya berjalan **saat halaman Flo terbuka**. Tidak ada layanan
latar belakang atau push dari server, karena aplikasi tidak punya server.
Notifikasi sistem memakai Notification API bila diizinkan; bila tidak, pengingat
tetap tampil sebagai papan di Beranda.

## Struktur

```
index.html                  Titik masuk Vite
vite.config.js              Vite + plugin React + Tailwind (port 8140)
src/main.jsx                Boot React
src/App.jsx                 Onboarding, kerangka halaman, toast, navigasi hash
src/store.js                State eksternal (useSyncExternalStore) + turunan
src/lib/cycle.js            Mesin siklus: siklus, fase, prediksi, kalender (murni)
src/lib/periodRules.js      Aturan validasi catat haid (murni)
src/lib/insight.js          Wawasan berbasis aturan
src/lib/reminder.js         Pengingat + Notification API (dengan fallback)
src/lib/storage.js          LocalStorage, ekspor/impor, CRUD catatan
src/lib/util.js             Tanggal, format Indonesia, helper umum
src/lib/catalog.js          Katalog gejala, mood, energi, kebiasaan
src/components/             AppShell (bottom nav), ui, Modal, CycleRing, dll.
src/pages/                  Beranda, Kalender, Catat, Riwayat, Wawasan, Pengaturan, Onboarding
src/lib/__tests__/          Uji unit (node:test)
src/tests/                  Uji browser (CDP) dan audit UI
```

## Uji

Uji unit (tanpa browser):

```bash
npm test             # 38 uji unit: mesin siklus, aturan haid, pengingat
```

Uji browser memerlukan Chromium dengan remote debugging, dan aplikasi berjalan
di port 8140:

```bash
chromium --headless=new --remote-debugging-port=9223 \
  --remote-allow-origins='*' --user-data-dir=/tmp/chrome-flo about:blank

npm run dev                          # terminal lain
npm run test:e2e                     # alur utama lewat dashboard
npm run audit:ui                     # kontras, teks terpotong, target sentuh kecil
```

Jalankan uji browser satu per satu, tidak paralel, karena semuanya memakai
port CDP yang sama.

## Privasi

- Tanpa akun, login, atau password.
- Tidak ada permintaan jaringan untuk data pengguna; seluruh perhitungan lokal.
- Data bisa diekspor ke JSON dan diimpor kembali.
- Reset total menghapus seluruh data Flo dari LocalStorage.

## Batasan versi ini

- Pengingat hanya berjalan selama halaman terbuka (tidak ada backend/scheduler).
- Impor menggantikan seluruh data, bukan menggabungkan.
- Prediksi memakai rata-rata sederhana; belum ada model yang menyesuaikan
  variasi antar siklus secara statistik.
