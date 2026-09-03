# 🚀 PLANING-MAKER
### AI Assisted CQI Machine Planning System

![Status](https://img.shields.io/badge/Status-Development-orange)
![Platform](https://img.shields.io/badge/Platform-GitHub%20Pages-blue)
![Technology](https://img.shields.io/badge/Technology-HTML%20%7C%20JavaScript%20%7C%20JSON-yellow)

PLANING-MAKER adalah aplikasi web untuk membantu membuat **planning pengecekan CQI** secara otomatis berdasarkan posisi mesin, kondisi mesin running, kapasitas CQI, dan history planning sebelumnya.

Tujuan sistem ini adalah membuat proses planning lebih cepat, akurat, dan mengurangi risiko mesin terlewat.

---

## ✨ Features

### 🗺️ Interactive Machine Map
- Visualisasi posisi mesin dan CQI
- Klik mesin untuk menentukan status running
- Klik CQI untuk menentukan titik pengecekan
- Mapping berdasarkan lokasi aktual

### 🤖 AI Planning Engine
Menggunakan `brain.js` sebagai sistem pengambil keputusan.

Kemampuan:
- Membaca mesin running
- Mencari CQI terdekat
- Membagi mesin secara otomatis
- Menyeimbangkan beban pengecekan

### 📊 Heatmap Planning
Menampilkan distribusi planning:
- Area mesin yang banyak dicek
- Beban setiap CQI
- Visualisasi hasil AI Planning

### 📚 History Learning
Menggunakan `history.json` untuk menyimpan pola planning sebelumnya.

AI dapat mempertimbangkan:
- Kebiasaan pengecekan mesin
- Hubungan mesin dengan CQI
- Referensi planning sebelumnya

---

# 🧠 Planning Rule

Sistem mempertimbangkan:

- Semua mesin running harus ter-cover
- Jarak mesin ke CQI
- Kapasitas setiap CQI
- Keseimbangan jumlah mesin

Aturan kapasitas:

| Kondisi CQI | Kapasitas |
|---|---|
| CORE saja | 4-6 mesin |
| CORE + 1 NON CORE | 5-6 mesin |
| CORE + 2 NON CORE | 8-9 mesin |

Maksimal: 1 CQI 8 MESIN

---

# ⚙️ Technology

- HTML
- CSS
- JavaScript
- JSON
- Brain.js
- GitHub Pages

---

# 🚀 Deployment

Project berjalan menggunakan GitHub Pages.

Tidak membutuhkan:
- Server
- Database eksternal
- Instalasi aplikasi

Cukup upload repository dan aktifkan GitHub Pages.

---

# 🔮 Future Development

Pengembangan berikutnya:

- AI learning lebih akurat
- Prediksi planning otomatis
- Export planning
- Dashboard monitoring
- Integrasi data produksi

---

## Developed For

Industrial Quality Improvement System

**PLANING-MAKER**
