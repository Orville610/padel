# Aplikasi Pemesanan Lapangan Padel

Aplikasi web sederhana untuk pemesanan lapangan padel menggunakan:
- PHP native + `mysqli` (backend API)
- MySQL (database server rumah)
- HTML + Tailwind CSS (frontend)
- JavaScript vanilla (interaksi form, hitung, simpan, dan daftar pesanan)
- Docker (runtime aplikasi)

## Struktur File

- `index.html`: halaman utama (UI frontend).
- `script.js`: logika frontend (toast alert, hitung, simpan, render tabel).
- `api.php`: endpoint backend (`list`, `hitung`, `pesan`).
- `config.php`: loader `.env` dan koneksi database.
- `table.sql`: query membuat tabel `pemesanan`.
- `index.php`: redirect ke `index.html`.
- `pemesanan.php`: redirect ke `index.html`.
- `Dockerfile`: image PHP + ekstensi `mysqli`.
- `docker-compose.yml`: jalankan container aplikasi.

## Konfigurasi Database

Edit file `.env`:

```env
DB_HOST=100.117.101.88
DB_PORT=3306
DB_USER=padel
DB_PASSWORD=isi_password_database
DB_NAME=db_pemesanan
```

Catatan:
- `DB_HOST` harus mengarah ke server MySQL yang benar.
- MySQL server harus mengizinkan koneksi remote dari laptop/host Docker.

## Setup Tabel

Jalankan isi `table.sql` pada database yang sudah ada (tanpa membuat database baru):

```sql
CREATE TABLE IF NOT EXISTS pemesanan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    no_hp VARCHAR(20) NOT NULL,
    lapangan VARCHAR(50) NOT NULL,
    tanggal_sewa DATE NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    durasi INT NOT NULL,
    harga_per_jam INT NOT NULL,
    total_tagihan INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Jalankan Dengan Docker

Di folder project:

```bash
docker compose up -d --build
```

Buka aplikasi:

```text
http://localhost:8000/index.html
```

Stop container:

```bash
docker compose down
```

## Endpoint API

- `GET /api.php?action=list`
  - Ambil daftar semua pesanan.
- `POST /api.php?action=hitung`
  - Hitung durasi, harga per jam, dan total tagihan (tanpa simpan).
- `POST /api.php?action=pesan`
  - Validasi + hitung + simpan pesanan ke database.

## Aturan Harga

- Jam sewa valid: `06:00` sampai `24:00`.
- Senin-Jumat: `Rp350.000/jam`.
- Sabtu-Minggu: `Rp500.000/jam`.
- Durasi = selisih jam selesai dan jam mulai.
- Jika `jam_selesai <= jam_mulai`, maka error.
- Jika jam di luar rentang, maka error.
