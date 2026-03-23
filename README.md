# POS PINTAR - Offline Kasir

Aplikasi Point of Sale (Kasir) yang dirancang untuk bekerja sepenuhnya secara offline menggunakan penyimpanan lokal browser (LocalStorage) dan mendukung pencetakan struk via Bluetooth (ESC/POS).

## Fitur Utama
- **Offline First**: Tidak memerlukan koneksi internet untuk operasional harian.
- **No Login**: Langsung pakai tanpa perlu membuat akun.
- **PWA Ready**: Bisa diinstal di HP atau Komputer sebagai aplikasi mandiri.
- **Bluetooth Printing**: Mendukung printer thermal Bluetooth 58mm.
- **Manajemen Produk**: Kelola stok, harga, dan kategori menu.
- **Backup & Restore**: Ekspor data ke file JSON untuk cadangan atau pindah perangkat.

## Cara Install di Localhost

Ikuti langkah-langkah berikut untuk menjalankan aplikasi ini di komputer Anda sendiri:

### 1. Persiapan
Pastikan Anda sudah menginstal **Node.js** (versi 18 atau lebih baru) di komputer Anda. Anda bisa mengunduhnya di [nodejs.org](https://nodejs.org/).

### 2. Download Source Code
Anda bisa mendownload file proyek ini secara manual atau menggunakan **Git** untuk meng-clone repositori ini:
```bash
git clone https://github.com/username/pos-pintar.git
cd pos-pintar
```
*(Ganti URL di atas dengan URL repositori GitHub Anda yang sebenarnya)*

### 3. Install Dependencies
Buka terminal atau command prompt (CMD) di dalam folder tersebut, lalu jalankan perintah:
```bash
npm install
```

### 4. Jalankan Aplikasi (Mode Pengembangan)
Untuk menjalankan aplikasi dalam mode pengembangan, jalankan perintah:
```bash
npm run dev
```
Setelah perintah selesai, buka browser dan akses `http://localhost:3000`.

### 5. Build untuk Produksi (Opsional)
Jika Anda ingin membuat versi yang lebih cepat dan siap pakai, jalankan:
```bash
npm run build
```
Hasil build akan ada di folder `dist/`. Anda bisa menggunakan server statis apa pun untuk menjalankan folder tersebut.

## Cara Install di Android (Termux)

Jika Anda ingin menjalankan server kasir ini langsung dari HP Android Anda menggunakan **Termux**, ikuti langkah-langkah ini:

### 1. Persiapan Termux
Download dan instal **Termux** (disarankan dari [F-Droid](https://f-droid.org/en/packages/com.termux/)).

### 2. Update & Install Node.js & Git
Buka aplikasi Termux, lalu jalankan perintah ini:
```bash
pkg update && pkg upgrade && pkg install nodejs git
```

### 3. Clone Proyek dari GitHub
Jalankan perintah berikut untuk mengambil kode dari GitHub:
```bash
git clone https://github.com/username/pos-pintar.git
cd pos-pintar
```
*(Ganti URL di atas dengan URL repositori GitHub Anda)*

### 4. Alternatif: Masuk ke Folder Lokal (Jika sudah ada di HP)
Jika Anda sudah mendownload file secara manual ke memori HP, jalankan:
```bash
termux-setup-storage
cd /sdcard/Download/pos-pintar
```

### 5. Install & Jalankan
Sama seperti di komputer, jalankan perintah:
```bash
npm install
npm run dev
```

### 6. Akses Aplikasi
Buka browser di HP Anda (Chrome/Edge), lalu akses:
`http://localhost:3000`

## Catatan Penting
- **Penyimpanan**: Data disimpan di browser. Jika Anda menghapus "Clear Cache/Data" browser, data aplikasi akan hilang. Gunakan fitur **Export Data** secara rutin untuk keamanan.
- **Bluetooth**: Fitur cetak Bluetooth memerlukan browser yang mendukung Web Bluetooth API (seperti Google Chrome, Microsoft Edge, atau Opera).
- **HTTPS**: Untuk fitur PWA (Installable) dan Bluetooth bekerja dengan baik di luar localhost, aplikasi harus dijalankan melalui koneksi **HTTPS**.

---
Dibuat dengan ❤️ untuk UMKM Indonesia.
