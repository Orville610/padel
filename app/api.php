<?php
require_once 'config.php';

// Semua response dari file ini berbentuk JSON.
header('Content-Type: application/json; charset=UTF-8');

$lapanganOptions = ['Lapangan A', 'Lapangan B', 'Lapangan C'];

// Mengirim response JSON dengan status code HTTP tertentu.
function responseJson(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// Format angka ke format Rupiah, contoh: Rp350.000.
function rupiah(int $nominal): string
{
    return 'Rp' . number_format($nominal, 0, ',', '.');
}

// Validasi semua input booking dan hitung total tagihan jika valid.
function validateAndCalculate(array $input, array $lapanganOptions): array
{
    // Validasi input + hitung durasi, harga per jam, dan total tagihan.
    $errors = [];

    $nama = trim($input['nama'] ?? '');
    $noHp = trim($input['no_hp'] ?? '');
    $lapangan = trim($input['lapangan'] ?? '');
    $tanggalSewa = trim($input['tanggal_sewa'] ?? '');
    $jamMulai = trim($input['jam_mulai'] ?? '');
    $jamSelesai = trim($input['jam_selesai'] ?? '');

    if ($nama === '') {
        $errors[] = 'Nama pemesan wajib diisi.';
    }

    if ($noHp === '') {
        $errors[] = 'Nomor HP wajib diisi.';
    } elseif (!ctype_digit($noHp)) {
        $errors[] = 'Nomor HP hanya boleh berisi angka.';
    }

    if (!in_array($lapangan, $lapanganOptions, true)) {
        $errors[] = 'Pilihan lapangan tidak valid.';
    }

    $tanggalObj = DateTime::createFromFormat('Y-m-d', $tanggalSewa);
    if (!$tanggalObj || $tanggalObj->format('Y-m-d') !== $tanggalSewa) {
        $errors[] = 'Tanggal sewa tidak valid.';
    }

    $jamMulaiObj = DateTime::createFromFormat('H:i', $jamMulai);
    if (!$jamMulaiObj || $jamMulaiObj->format('H:i') !== $jamMulai) {
        $errors[] = 'Jam mulai tidak valid.';
    }

    // Terima 24:00 sebagai jam akhir khusus
    $jamSelesaiObj = null;
    if ($jamSelesai !== '24:00') {
        $jamSelesaiObj = DateTime::createFromFormat('H:i', $jamSelesai);
        if (!$jamSelesaiObj || $jamSelesaiObj->format('H:i') !== $jamSelesai) {
            $errors[] = 'Jam selesai tidak valid.';
        }
    }

    if (!empty($errors)) {
        return ['errors' => $errors];
    }

    $jamMulaiMenit = ((int) $jamMulaiObj->format('H') * 60) + (int) $jamMulaiObj->format('i');
    $jamSelesaiMenit = ($jamSelesai === '24:00')
        ? 1440
        : (((int) $jamSelesaiObj->format('H') * 60) + (int) $jamSelesaiObj->format('i'));

    $validMulai = ($jamMulaiMenit >= 360 && $jamMulaiMenit < 1440);
    $validSelesai = ($jamSelesaiMenit > 360 && $jamSelesaiMenit <= 1440);

    if (!$validMulai || !$validSelesai) {
        $errors[] = 'Jam sewa harus dalam rentang 06:00 sampai 24:00.';
    }

    if ($jamSelesaiMenit <= $jamMulaiMenit) {
        $errors[] = 'Jam selesai harus lebih besar dari jam mulai.';
    }

    if (($jamMulaiMenit % 60) !== 0 || ($jamSelesaiMenit % 60) !== 0) {
        $errors[] = 'Jam mulai dan jam selesai harus tepat per jam (contoh: 08:00, 09:00).';
    }

    if (!empty($errors)) {
        return ['errors' => $errors];
    }

    $durasi = (int) (($jamSelesaiMenit - $jamMulaiMenit) / 60);
    // Check day of week: 1 (Monday) to 5 (Friday) = 350.000, else (Saturday & Sunday) = 500.000
    $dayOfWeek = (int) $tanggalObj->format('N');
    $hargaPerJam = ($dayOfWeek >= 1 && $dayOfWeek <= 5) ? 350000 : 500000;
    $totalTagihan = $durasi * $hargaPerJam;

    return [
        'errors' => [],
        'data' => [
            'nama' => $nama,
            'no_hp' => $noHp,
            'lapangan' => $lapangan,
            'tanggal_sewa' => $tanggalSewa,
            'jam_mulai' => $jamMulai,
            'jam_selesai' => $jamSelesai,
            'durasi' => $durasi,
            'harga_per_jam' => $hargaPerJam,
            'total_tagihan' => $totalTagihan,
            'harga_per_jam_rupiah' => rupiah($hargaPerJam),
            'total_tagihan_rupiah' => rupiah($totalTagihan),
        ],
    ];
}

$action = $_GET['action'] ?? '';

// Endpoint GET: mengambil daftar pesanan terbaru untuk ditampilkan di tabel.
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
    $rows = [];
    $result = $koneksi->query('SELECT * FROM pemesanan ORDER BY created_at DESC');
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $row['harga_per_jam_rupiah'] = rupiah((int) $row['harga_per_jam']);
            $row['total_tagihan_rupiah'] = rupiah((int) $row['total_tagihan']);
            $row['jam_mulai'] = substr($row['jam_mulai'], 0, 5);
            $row['jam_selesai'] = substr($row['jam_selesai'], 0, 5);
            $rows[] = $row;
        }
        $result->free();
    }

    responseJson(['success' => true, 'data' => $rows]);
}

// Endpoint POST:
// - action=hitung: validasi + kalkulasi tanpa simpan
// - action=pesan: validasi + kalkulasi + simpan ke database
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === 'hitung' || $action === 'pesan')) {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        responseJson(['success' => false, 'errors' => ['Payload JSON tidak valid.']], 400);
    }

    $calc = validateAndCalculate($payload, $lapanganOptions);
    if (!empty($calc['errors'])) {
        responseJson(['success' => false, 'errors' => $calc['errors']], 422);
    }

    if ($action === 'hitung') {
        responseJson(['success' => true, 'data' => $calc['data']]);
    }

    // Simpan data pemesanan menggunakan prepared statement.
    $d = $calc['data'];
    $stmt = $koneksi->prepare(
        'INSERT INTO pemesanan (nama, no_hp, lapangan, tanggal_sewa, jam_mulai, jam_selesai, durasi, harga_per_jam, total_tagihan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    if (!$stmt) {
        responseJson(['success' => false, 'errors' => ['Gagal menyiapkan query simpan data.']], 500);
    }

    $jamMulaiSimpan = $d['jam_mulai'] . ':00';
    $jamSelesaiSimpan = ($d['jam_selesai'] === '24:00') ? '23:59:59' : $d['jam_selesai'] . ':00';

    $stmt->bind_param(
        'ssssssiii',
        $d['nama'],
        $d['no_hp'],
        $d['lapangan'],
        $d['tanggal_sewa'],
        $jamMulaiSimpan,
        $jamSelesaiSimpan,
        $d['durasi'],
        $d['harga_per_jam'],
        $d['total_tagihan']
    );

    $ok = $stmt->execute();
    $stmt->close();

    if (!$ok) {
        responseJson(['success' => false, 'errors' => ['Gagal menyimpan data pemesanan.']], 500);
    }

    responseJson(['success' => true, 'message' => 'Pemesanan berhasil disimpan.', 'data' => $d]);
}

responseJson(['success' => false, 'errors' => ['Endpoint tidak ditemukan.']], 404);
