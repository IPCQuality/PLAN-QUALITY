# 🗺️ MAP LIQUID 3 — CQI Machine Planning System

Aplikasi web cerdas untuk mempermudah, mempercepat, dan mengotomasi alokasi pengecekan mesin **CQI (Core Quality Inspection)** pada lini produksi. Dilengkapi denah interaktif, algoritma optimasi beban kerja berbasis kedekatan posisi (AI/Brain.js), dashboard drag-and-drop, dan ekspor langsung ke WhatsApp maupun Excel.

---

## ⚡ Fitur Utama

- **🗺️ Interactive Map Floor**: Visualisasi tata letak mesin dan pos CQI secara real-time. Klik untuk ubah status *Running* / *Off* dan pos yang *Ready*.
- **🤖 Smart AI Planning Engine**: Otomatis membagi beban pengecekan mesin secara merata ke manpower CQI dengan memperhitungkan jarak fisik terdekat dan batas kapasitas.
- **📋 Manpower & Task Management**: Pengaturan rotasi tim Core, Non-Core, Longshift (LS), OT, WW, serta tugas khusus (QC Passed, Mil-Std, Support FG).
- **🎯 Interactive Board (Drag & Drop)**: Fleksibilitas memindahkan mesin atau personel antar pos CQI secara visual lengkap dengan fitur *Undo / Redo*.
- **📊 Heatmap Distribusi**: Visualisasi intensitas dan sebaran beban kerja di area pabrik.
- **📤 Export Siap Pakai**: Salin teks otomatis dengan format standar WhatsApp, kirim langsung via tombol WhatsApp, atau unduh sebagai file spreadsheet (CSV/Excel).
- **🌓 Mode Gelap / Terang & PWA**: Dukungan tema visual yang nyaman di mata serta dukungan mode offline (Progressive Web App).

---

## 🚀 Panduan Singkat Cara Penggunaan

Proses pembuatan planning selesai hanya dalam **4 langkah mudah**:

```
[1. Denah Mesin] ➔ [2. Input Manpower] ➔ [3. Review & Drag] ➔ [4. Ekspor Planning]
```

### 1. Tentukan Mesin Running & Titik CQI (Halaman Utama)
1. Buka aplikasi di browser.
2. Klik node **Mesin** untuk menyalakan/mematikan mesin yang beroperasi (atau gunakan tombol **Run All**).
3. Klik node **CQI** untuk menentukan pos inspektur yang aktif (atau gunakan tombol **Ready All**).
4. Klik tombol **NEXT** di pojok kanan atas.

### 2. Atur Manpower & Tugas Khusus (Tahap Konfigurasi)
1. Periksa dan sesuaikan daftar personel **Core**, **Non-Core**, **OT / WW**, dan jumlah **Longshift**.
2. Gunakan tombol geser/rolling (🔼/🔽) untuk rotasi shift harian jika diperlukan.
3. Tentukan PIC untuk tugas khusus (**QC Passed**, **Mil-Std**, dan **Support FG**).
4. Klik tombol **Lanjut ke Dashboard**.

### 3. Review Alokasi di Papan Interaktif (Tahap Dashboard)
1. Sistem akan menampilkan kartu hasil alokasi otomatis untuk setiap CQI.
2. Jika perlu penyesuaian, cukup **geser (drag & drop)** mesin atau nama personel antar kartu CQI.
3. Periksa indikator kapasitas pada tiap pos agar tidak *overload*.
4. Klik tombol **Lanjut ke Output**.

### 4. Pilih Shift & Ekspor Hasil (Tahap Output)
1. Pilih **Tanggal Planning** (Hari Ini / Besok / Kustom) dan pilih **Shift** (Shift 1, 2, atau 3).
2. Teks format planning resmi akan otomatis terisi dan siap dikirim.
3. Klik:
   - **Validasi & Salin**: Menyalin teks rapi ke clipboard.
   - **Kirim ke WhatsApp**: Membuka WhatsApp Web / App dengan pesan otomatis terisi.
   - **Export Excel**: Mengunduh rekapan data dalam bentuk tabel spreadsheet.

---

## 📐 Aturan Kapasitas CQI

| Kondisi Pos CQI | Rekomendasi Kapasitas Mesin |
|---|---|
| **1 Orang Core** | 4 – 6 Mesin |
| **Core + 1 Non-Core** | 5 – 6 Mesin |
| **Core + 2 Non-Core / Support** | 8 – 9 Mesin |
| **Batas Maksimal per Pos** | Maks. 8 Mesin / Orang |

---

## 💻 Cara Menjalankan Aplikasi Secara Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18 ke atas)

### Langkah Instalasi
1. Buka terminal pada direktori proyek:
   ```bash
   npm install
   ```

2. Jalankan server lokal:
   ```bash
   npm run dev
   ```

3. Buka browser dan akses alamat:
   ```
   http://localhost:3000
   ```

---

## 🛠️ Struktur Proyek

```text
├── index.html        # Peta denah interaktif pabrik (Floor Map)
├── config.html       # Konfigurasi manpower, papan drag & drop, dan output planning
├── server.js         # Server backend Express lokal
├── css/              # File styling (index.css, config.css, theme.css)
├── src/              # Logika AI & integrasi tema (brain.js, theme.js)
├── data/             # Data denah posisi mesin & histori planning
└── pwa/              # Konfigurasi PWA (manifest & icons)
```

---

## 📄 Lisensi & Pemeliharaan

Dikembangkan untuk kebutuhan **Industrial Quality Improvement & Production Planning** — *MAP LIQUID 3*.
