# POS PINTAR - Offline Kasir

Aplikasi Point of Sale (Kasir) yang dirancang untuk bekerja sepenuhnya secara offline menggunakan penyimpanan lokal browser (LocalStorage) dan mendukung pencetakan struk via Bluetooth (ESC/POS).

## Fitur Utama
- **Keamanan Admin (PIN)**: Melindungi menu sensitif (Dashboard, Produk, Histori, Setelan) dengan sistem PIN 4-digit untuk mencegah akses tidak sah oleh staf.
- **Lupa PIN (Recovery)**: Fitur pemulihan menggunakan Pertanyaan Keamanan untuk me-reset akses jika PIN terlupa.
- **Dashboard & Statistik**: Pantau omzet harian, jumlah transaksi, dan produk terlaris melalui grafik interaktif.
- **Offline First**: Bekerja sepenuhnya tanpa internet menggunakan LocalStorage browser.
- **Bluetooth Printing**: Cetak struk belanja secara instan ke printer thermal Bluetooth (ESC/POS).
- **Manajemen Produk & Stok**: Kelola harga, stok, gambar, dan kategori produk dengan mudah.
- **Manajemen Kategori**: Memudahkan navigasi produk saat transaksi berlangsung.
- **Histori Transaksi**: Lihat kembali riwayat penjualan dengan detail item dan metode pembayaran.
- **Backup & Restore**: Ekspor dan impor data (JSON) untuk keamanan ekstra atau pindah perangkat.
- **Custom Branding**: Atur nama toko, alamat, logo, serta header dan footer pada struk.
- **PWA Ready**: Dapat diinstal di Android, iOS, atau PC sebagai aplikasi mandiri.

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

## Solusi Error di Termux (esbuild/ELF magic)

Jika Anda menemui error `bad ELF magic` saat `npm install`, gunakan **Solusi Terakhir** ini:

1. **Hapus folder lama**:
   ```bash
   rm -rf node_modules package-lock.json
   ```
2. **Instal esbuild sistem**:
   ```bash
   pkg update && pkg install esbuild
   ```
   *Catatan: Pastikan versi di `package.json` (bagian `"esbuild": "..."`) sama dengan versi yang terinstal di Termux (cek dengan `esbuild --version`).*

3. **Instal proyek (abaikan script error)**:
   ```bash
   npm install --ignore-scripts
   ```
4. **Hubungkan esbuild secara manual**:
   ```bash
   mkdir -p node_modules/esbuild/bin
   ln -sf $(which esbuild) node_modules/esbuild/bin/esbuild
   ```
5. **Jalankan**:
   ```bash
   npm run dev
   ```

## Catatan Penting
- **Penyimpanan**: Data disimpan di browser. Jika Anda menghapus "Clear Cache/Data" browser, data aplikasi akan hilang. Gunakan fitur **Export Data** secara rutin untuk keamanan.
- **Bluetooth**: Fitur cetak Bluetooth memerlukan browser yang mendukung Web Bluetooth API (seperti Google Chrome, Microsoft Edge, atau Opera).
- **HTTPS**: Untuk fitur PWA (Installable) dan Bluetooth bekerja dengan baik di luar localhost, aplikasi harus dijalankan melalui koneksi **HTTPS**.

---
Dibuat dengan ❤️ untuk UMKM Indonesia.
