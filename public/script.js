const form = document.getElementById('bookingForm');
const toastContainer = document.getElementById('toastContainer');
const totalBox = document.getElementById('totalBox');
const tableBody = document.getElementById('bookingTableBody');
const lapanganSelect = document.getElementById('lapanganSelect');
const jamMulaiSelect = document.getElementById('jamMulai');
const jamSelesaiSelect = document.getElementById('jamSelesai');
const btnHitung = document.getElementById('btnHitung');
const btnPesan = document.getElementById('btnPesan');
const btnRefresh = document.getElementById('btnRefresh');
const courtButtons = document.querySelectorAll('[data-court]');
const summaryCourt = document.getElementById('summaryCourt');
const summaryTime = document.getElementById('summaryTime');
const summaryTotal = document.getElementById('summaryTotal');
const noHpInput = form?.querySelector('input[name="no_hp"]');
const startHour = 6;
const endHour = 24;

// Escape karakter HTML agar data user aman saat dirender ke DOM.
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Isi dropdown jam booking: 06:00 sampai 24:00 (kelipatan 1 jam).
function buildJamOptions() {
  const jamList = [];
  for (let h = startHour; h <= endHour; h += 1) {
    jamList.push(`${String(h).padStart(2, '0')}:00`);
  }

  jamMulaiSelect.innerHTML = '';
  jamSelesaiSelect.innerHTML = '';

  jamList.forEach((jam) => {
    if (jam !== '24:00') {
      const optMulai = document.createElement('option');
      optMulai.value = jam;
      optMulai.textContent = jam;
      jamMulaiSelect.appendChild(optMulai);
    }

    if (jam !== '06:00') {
      const optSelesai = document.createElement('option');
      optSelesai.value = jam;
      optSelesai.textContent = jam;
      jamSelesaiSelect.appendChild(optSelesai);
    }
  });

  jamMulaiSelect.value = '06:00';
  jamSelesaiSelect.value = '08:00';
  syncJamSelesaiOptions();
}

// Ambil angka jam dari string HH:mm (contoh "08:00" -> 8).
function timeToHour(timeText) {
  return Number.parseInt((timeText || '00:00').split(':')[0], 10);
}

// Sesuaikan opsi jam selesai agar selalu lebih besar dari jam mulai.
function syncJamSelesaiOptions() {
  const mulaiHour = timeToHour(jamMulaiSelect.value);
  const oldSelesai = jamSelesaiSelect.value;
  const nextSelesai = [];

  for (let h = mulaiHour + 1; h <= endHour; h += 1) {
    nextSelesai.push(`${String(h).padStart(2, '0')}:00`);
  }

  jamSelesaiSelect.innerHTML = '';
  nextSelesai.forEach((jam) => {
    const opt = document.createElement('option');
    opt.value = jam;
    opt.textContent = jam;
    jamSelesaiSelect.appendChild(opt);
  });

  if (nextSelesai.includes(oldSelesai)) {
    jamSelesaiSelect.value = oldSelesai;
  }
}

// Menampilkan notifikasi toast sukses/gagal di kanan atas.
function showAlert(type, messages) {
  const baseClass = 'pointer-events-auto rounded-lg border px-4 py-3 shadow-lg backdrop-blur transition duration-300';
  const stateClass = type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-rose-200 bg-rose-50 text-rose-800';
  const html = messages.map((msg) => `<p class="text-sm font-semibold">${escapeHtml(msg)}</p>`).join('');
  const toast = document.createElement('div');
  toast.className = `${baseClass} ${stateClass} translate-y-1 opacity-0`;
  toast.innerHTML = html;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-1', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-1', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Membersihkan semua toast aktif.
function clearAlert() {
  toastContainer.innerHTML = '';
}

// Mengambil nilai form terbaru lalu bentuk payload JSON untuk API.
function getFormPayload() {
  const fd = new FormData(form);
  return {
    nama: (fd.get('nama') || '').toString().trim(),
    no_hp: (fd.get('no_hp') || '').toString().trim().replace(/\D/g, ''),
    lapangan: (fd.get('lapangan') || '').toString().trim(),
    tanggal_sewa: (fd.get('tanggal_sewa') || '').toString().trim(),
    jam_mulai: (fd.get('jam_mulai') || '').toString().trim(),
    jam_selesai: (fd.get('jam_selesai') || '').toString().trim()
  };
}

// Ubah state tombol saat proses async berjalan.
function setLoading(button, isLoading, label) {
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Memproses...' : label;
}

// Update panel ringkasan booking di sisi kanan.
function updateSummary(totalText = null) {
  const payload = getFormPayload();
  summaryCourt.textContent = payload.lapangan || 'Lapangan A';
  summaryTime.textContent = payload.tanggal_sewa
    ? `${payload.tanggal_sewa}, ${payload.jam_mulai}-${payload.jam_selesai}`
    : `${payload.jam_mulai || '06:00'}-${payload.jam_selesai || '08:00'}`;

  if (totalText) {
    summaryTotal.textContent = totalText;
  }
}

// Pastikan nomor HP hanya berisi digit saat diketik/paste.
function enforceNumericPhoneInput() {
  if (!noHpInput) {
    return;
  }

  noHpInput.addEventListener('input', () => {
    noHpInput.value = noHpInput.value.replace(/\D+/g, '');
  });
}

// Sinkronkan kartu lapangan aktif dengan nilai select lapangan.
function setActiveCourt(courtName) {
  lapanganSelect.value = courtName;
  courtButtons.forEach((button) => {
    const isActive = button.dataset.court === courtName;
    button.classList.toggle('bg-brand-50', isActive);
    button.classList.toggle('border-brand-300', isActive);
    button.classList.toggle('ring-2', isActive);
    button.classList.toggle('ring-brand-500', isActive);
    button.classList.toggle('border-slate-200', !isActive);
    button.classList.toggle('bg-white', !isActive);
  });
  updateSummary();
}

// Bungkus komunikasi ke backend PHP (api.php).
async function callApi(action, payload = null) {
  const options = payload
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    : { method: 'GET' };

  const res = await fetch(`api.php?action=${action}`, options);
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      success: false,
      errors: ['Response backend bukan JSON. Periksa koneksi database atau error PHP.']
    };
  }
}

// Ambil data pesanan dari backend lalu render ke tabel.
async function loadBookings() {
  tableBody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 text-center text-slate-500">Memuat data...</td></tr>';
  const result = await callApi('list');

  if (!result.success) {
    tableBody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 text-center text-rose-700">Gagal memuat data.</td></tr>';
    showAlert('error', result.errors || ['Gagal memuat data pesanan.']);
    return;
  }

  if (!result.data.length) {
    tableBody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 text-center text-slate-500">Belum ada data pemesanan.</td></tr>';
    return;
  }

  tableBody.innerHTML = result.data.map((row) => `
    <tr class="hover:bg-slate-50">
      <td class="border-b border-slate-100 px-3 py-3 text-sm">${escapeHtml(row.id)}</td>
      <td class="border-b border-slate-100 px-3 py-3 text-sm">${escapeHtml(row.nama)}</td>
      <td class="border-b border-slate-100 px-3 py-3 text-sm">${escapeHtml(row.no_hp)}</td>
      <td class="border-b border-slate-100 px-3 py-3 text-sm">
        <span class="rounded-full bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">${escapeHtml(row.lapangan)}</span>
      </td>
      <td class="border-b border-slate-100 px-3 py-3 text-sm">${escapeHtml(row.tanggal_sewa)}</td>
      <td class="border-b border-slate-100 px-3 py-3 text-sm">${escapeHtml(row.jam_mulai)}-${escapeHtml(row.jam_selesai)}</td>
      <td class="border-b border-slate-100 px-3 py-3 text-sm">${escapeHtml(row.durasi)} jam</td>
      <td class="border-b border-slate-100 px-3 py-3 text-sm font-bold text-slate-700">${escapeHtml(row.harga_per_jam_rupiah)}</td>
      <td class="border-b border-slate-100 px-3 py-3 text-sm font-bold text-brand-700">${escapeHtml(row.total_tagihan_rupiah)}</td>
    </tr>
  `).join('');
}

// Hitung total tagihan tanpa menyimpan data.
async function handleHitung() {
  if (!form.reportValidity()) {
    return;
  }

  clearAlert();
  totalBox.hidden = true;
  setLoading(btnHitung, true, 'Hitung Total');

  const result = await callApi('hitung', getFormPayload());
  setLoading(btnHitung, false, 'Hitung Total');

  if (!result.success) {
    showAlert('error', result.errors || ['Terjadi kesalahan.']);
    return;
  }

  totalBox.hidden = false;
  totalBox.innerHTML = `
    <span class="block text-sm font-semibold text-slate-600">Total tagihan</span>
    <strong class="mt-1 block text-3xl font-black text-brand-700">${escapeHtml(result.data.total_tagihan_rupiah)}</strong>
  `;
  updateSummary(result.data.total_tagihan_rupiah);
}

// Simpan pemesanan ke database, lalu refresh tabel.
async function handlePesan() {
  if (!form.reportValidity()) {
    return;
  }

  clearAlert();
  setLoading(btnPesan, true, 'Simpan Pesanan');

  const result = await callApi('pesan', getFormPayload());
  setLoading(btnPesan, false, 'Simpan Pesanan');

  if (!result.success) {
    showAlert('error', result.errors || ['Terjadi kesalahan.']);
    return;
  }

  showAlert('success', [result.message || 'Pemesanan berhasil disimpan.']);
  totalBox.hidden = false;
  totalBox.innerHTML = `
    <span class="block text-sm font-semibold text-slate-600">Total tagihan</span>
    <strong class="mt-1 block text-3xl font-black text-brand-700">${escapeHtml(result.data.total_tagihan_rupiah)}</strong>
  `;
  updateSummary(result.data.total_tagihan_rupiah);
  form.reset();
  buildJamOptions();
  setActiveCourt('Lapangan A');
  await loadBookings();
}

// Daftarkan event klik pada kartu lapangan.
courtButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveCourt(button.dataset.court));
});

// Saat ada perubahan input, reset estimasi agar user hitung ulang.
form.addEventListener('change', () => {
  summaryTotal.textContent = 'Klik Hitung';
  updateSummary();
});

lapanganSelect.addEventListener('change', () => setActiveCourt(lapanganSelect.value));
jamMulaiSelect.addEventListener('change', () => {
  syncJamSelesaiOptions();
  summaryTotal.textContent = 'Klik Hitung';
  updateSummary();
});
jamSelesaiSelect.addEventListener('change', () => {
  summaryTotal.textContent = 'Klik Hitung';
  updateSummary();
});
btnHitung.addEventListener('click', handleHitung);
btnPesan.addEventListener('click', handlePesan);
btnRefresh.addEventListener('click', loadBookings);

// Inisialisasi awal halaman.
enforceNumericPhoneInput();
buildJamOptions();
setActiveCourt('Lapangan A');
loadBookings();
