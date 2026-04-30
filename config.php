<?php
// Sesuaikan nilai di file .env agar sesuai dengan MySQL di server rumah Anda.
// Membaca file .env sederhana (KEY=VALUE) lalu set ke environment runtime.
function loadEnv(string $path): void
{
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }

        $key = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));
        $value = trim($value, "\"'");

        $_ENV[$key] = $value;
        putenv($key . '=' . $value);
    }
}

loadEnv(__DIR__ . '/.env');

// Gunakan nilai dari .env. Jika belum diisi, pakai placeholder default.
define('DB_HOST', getenv('DB_HOST') ?: '192.168.1.100');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_USER', getenv('DB_USER') ?: 'isi_username_database');
define('DB_PASS', getenv('DB_PASS') ?: (getenv('DB_PASSWORD') ?: 'isi_password_database'));
define('DB_NAME', getenv('DB_NAME') ?: 'isi_nama_database');

// Koneksi utama yang dipakai semua file PHP.
$koneksi = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, (int) DB_PORT);

if ($koneksi->connect_error) {
    die('Koneksi database gagal: ' . $koneksi->connect_error);
}

$koneksi->set_charset('utf8mb4');
