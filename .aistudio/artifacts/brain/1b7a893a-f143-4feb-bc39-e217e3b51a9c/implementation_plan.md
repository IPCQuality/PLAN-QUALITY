# Fitur Tambah Kartu CQI Kosong (Aktif) di Dashboard Interaktif

Rencana implementasi penambahan kartu meja CQI kosong berbasis status CQI aktif (READY) langsung dari Papan Alokasi Interaktif, memungkinkan penyesuaian fleksibel penambahan meja operasional tanpa perlu mengulang alokasi dari awal.

## User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan konfirmasi pada tahap klarifikasi:
> - **Sumber CQI**: Kartu baru dipilih dari daftar meja CQI yang berstatus aktif/READY namun belum terpakai pada perencanaan saat ini.
> - **Alokasi Core Awal**: Dibiarkan kosong terlebih dahulu (dengan badge *"Butuh 1 Core"*), sehingga pengguna leluasa menggeser personil Core secara manual dari pool sisa manpower atau meja lain via drag-and-drop.
> - **Sinkronisasi Sistem**: Kartu baru ini otomatis disinkronkan ke **Papan Alokasi Interaktif**, **Live Map (Peta Pabrik)**, dan **Output Planning Final** (format teks, unduhan JSON riwayat, dan ekspor Excel).

---

## 1. Overview & Core Concept

- **Apa yang Dibangun**: Tombol aksi `+ Tambah Kartu CQI` di toolbar header Dashboard Interaktif (Langkah 2) beserta dialog modal pemilihan CQI. Saat CQI aktif yang belum terpakai dipilih, sistem membuat kartu slot CQI baru dalam kondisi kosong (tanpa mesin & manpower), siap menerima penugasan mesin dan manpower melalui interaksi drag-and-drop.
- **Pengguna Sasaran**: Koordinator CQI, Supervisor Produksi, dan Quality Control Planner yang ingin menambah meja penanganan saat beban produksi bertambah tanpa merusak tata letak mesin yang sudah disusun rapi.
- **Nilai Utama**: Fleksibilitas tinggi dan efisiensi waktu karena pengguna tidak perlu mereset ulang seluruh planning hanya untuk mengaktifkan satu meja penanganan tambahan.

---

## 2. User Experience & Visual Design

### Alur Pengguna (User Flows)
1. **Membuka Dialog Tambah CQI**:
   - Di Langkah 2 (Dashboard Interaktif), pengguna menekan tombol **`+ Tambah CQI`** berwarna biru primer di jajaran toolbar atas (bersebelahan dengan tombol Undo, Redo, dan Reset).
2. **Memilih CQI Aktif**:
   - Modal pop-up modern muncul menampilkan daftar CQI berstatus **READY** yang belum masuk dalam perencanaan aktif saat ini, lengkap dengan indikator nomor CQI dan letak Line/Workstation (misal: `CQI 7 (LINE C)`).
   - Jika semua CQI aktif sudah terpakai di planning, modal menampilkan pesan informatif beserta opsi cepat untuk mengaktifkan CQI tambahan dari master layout.
3. **Penyisipan Kartu ke Grid**:
   - Pengguna menekan tombol **"Tambahkan ke Dashboard"**.
   - Kartu slot CQI baru langsung muncul di grid kartu CQI dengan animasi halus (*fade-in*).
   - Kartu menampilkan badge kapasitas awal `0/8 Kosong` dan badge peringatan `Butuh 1 Core`.
   - Tombol hapus kartu kosong (*trash icon*) juga disediakan pada kartu yang belum memiliki mesin, jika pengguna ingin membatalkan penyisipan.
4. **Alokasi Drag & Drop**:
   - Pengguna dapat langsung menarik (*drag*) mesin dari *Unassigned Pool* atau dari slot CQI lain ke dalam kartu CQI baru ini.
   - Pengguna menarik personil Core atau Support (Non-Core / Longshift) dari pool sisa manpower ke kartu tersebut.
5. **Dukungan Undo / Redo**:
   - Penambahan kartu CQI tercatat di history stack sehingga pengguna dapat membatalkan aksi via tombol `Undo` (Ctrl+Z) atau mengulanginya via `Redo` (Ctrl+Y).

### Desain Visual & Tata Letak
- **Tombol Toolbar**: Tombol berprofil tegas berukuran pas dengan ikon `+`, serasi dengan tema desain profesional (menggunakan palet `--primary-blue` `#2563eb`, hover `#1d4ed8`, teks kontras `#ffffff`).
- **Modal Pemilihan CQI**:
  - Backdrop semi-transparan dengan efek blur halus.
  - Kartu modal bersih dengan header tegas, radio list/dropdown CQI siap pakai, dan tombol aksi pembatalan & konfirmasi.
  - Badge identitas CQI menggunakan tipografi monospace terstandar (`CQI-XX`).
- **Status Kartu Baru**:
  - Mengikuti styling slot kartu yang ada dengan border aksen jelas, drop zone responsif saat di-hover drag mesin/personil.

---

## 3. Key Product Decisions & Trade-Offs

- **Pemilihan Berdasarkan CQI Aktif**:
  - *Keputusan*: Memfilter hanya CQI yang berstatus READY dari state peta/pabrik yang belum memiliki slot di `currentPlan`.
  - *Alasan*: Menjamin konsistensi operasional fisik—meja yang ditambahkan memang meja yang siap digunakan di lapangan.
- **Status Awal Personil Kosong**:
  - *Keputusan*: Kartu diinisialisasi tanpa personil (`coreNames: []`), mengaktifkan drop-zone peringatan *"Butuh 1 Core"*.
  - *Alasan*: Memberikan kontrol penuh kepada koordinator untuk memilih siapa personil yang ditempatkan tanpa intervensi otomatis yang tidak diinginkan.
- **Konsistensi State Terpusat**:
  - *Keputusan*: Menyimpan slot baru langsung ke struktur `currentPlan`, memperbarui cache `localStorage` (`last_active_planning`), `sessionStorage` (`active_planning`), dan memicu `generateTextOutput()`.
  - *Alasan*: Memastikan sinkronisasi instan ke seluruh tab/halaman termasuk Live Map (`index.html`) dan Output Planning Final (Langkah 3) tanpa *page refresh*.

---

## 4. Technical Architecture & Data Strategy

### Diagram Arsitektur & Alur Data

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Dashboard Interaktif (Langkah 2)                │
│                                                                        │
│   [+ Tambah CQI]  ──>  [Modal Pilih CQI Ready]                         │
│                                │                                       │
│                                ▼ (Pilih CQI & Konfirmasi)              │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  Push slot baru ke `currentPlan`:                              │   │
│   │  - cqi: node { id, name, ws, ... }                             │   │
│   │  - machines: []                                                │   │
│   │  - coreNames: []                                               │   │
│   │  - nonCore: [], longshift: []                                  │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                │                                       │
│          ┌─────────────────────┼─────────────────────┐                 │
│          ▼                     ▼                     ▼                 │
│   [renderInteractiveBoard]  [pushPlanState]    [syncUpdatedPlanState]  │
│   - Kartu CQI baru muncul   - Catat Undo/Redo  - Simpan ke Cache &     │
│   - Drop zone aktif           history stack      Storage               │
│          │                                           │                 │
└──────────┼───────────────────────────────────────────┼─────────────────┘
           ▼                                           ▼
┌──────────────────────┐                   ┌─────────────────────────────┐
│   Output Final Teks  │                   │   Live Map (index.html)     │
│  & Ekspor Excel/JSON │                   │ - Node CQI tersorot di peta │
│   (Langkah 3)        │                   │ - Terhubung ke garis mesin  │
└──────────────────────┘                   └─────────────────────────────┘
```

### Rincian Modifikasi Komponen
1. **Struktur DOM `config.html`**:
   - Menambahkan tombol `#btnAddCqiCard` pada `.card-head` di `#planBoardSection`.
   - Menambahkan elemen modal `#addCqiModal` (dengan ID `addCqiSelect`, daftar info workstation, dan tombol konfirmasi).
2. **Logika State & Handler**:
   - Fungsi `openAddCqiModal()`: Memindai `state.cqis`, memfilter yang belum ada di `currentPlan`, dan merender opsi pemilihan.
   - Fungsi `confirmAddCqiCard()`: Memvalidasi pilihan, membangun objek slot standar, menambahkannya ke `currentPlan`, mencatat riwayat undo, dan memicu render ulang.
   - Fungsi `removeEmptyCqiCard(slotIdx)`: Tombol opsional untuk menghapus kartu CQI jika kartu masih kosong dari mesin dan personil.
   - Fungsi `syncUpdatedPlanState()` & `savePlanningCache()`: Menyinkronkan perubahan ke `sessionStorage` dan `localStorage` sehingga halaman peta Live Map langsung merespons.
3. **Validasi & Alert**:
   - Mesin validasi `BrainAI.validate()` otomatis mengevaluasi slot baru (memperbarui jumlah meja terpakai dan notifikasi kekurangan personil bila ada).
