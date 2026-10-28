/* ==========================================================================
   APP.JS — Student Desk
   Satu file untuk seluruh logika aplikasi.

   Daftar isi (urutan = urutan eksekusi, jangan diubah)
   01. Storage    : penyimpanan lokal (localStorage)
   02. Utilitas   : helper DOM, format, toast, modal, cetak
   03. Konfigurasi: definisi modul, template surat, tampilan sel
   04. Formulir   : tambah/edit dan preview dokumen
   05. Halaman    : daftar modul, dashboard, riwayat, pengaturan
   05a. Data contoh: data awal yang bisa diisi ulang / dihapus
   06. Aplikasi   : navigasi dan inisialisasi
   ========================================================================== */

/* ==========================================================================
   01. STORAGE
   Data hanya ada di browser ini.
   ========================================================================== */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const DB = {
  key: 'studentdesk_v1',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || {};
    } catch {
      return {};
    }
  },

  save(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch (err) {
      toast('Gagal menyimpan: ' + err.message, 1);
      return false;
    }
  },

  list(m) {
    const rows = this.load()[m];
    return Array.isArray(rows) ? rows : [];
  },

  get(m, id) {
    return this.list(m).find((r) => r.id === id);
  },

  /** Simpan baru (tanpa id) atau perbarui (dengan id). */
  put(m, record) {
    const data = this.load();
    const rows = this.list(m);
    const now = new Date().toISOString();

    if (record.id) {
      const i = rows.findIndex((r) => r.id === record.id);
      if (i < 0) {
        toast('Data tidak ditemukan (mungkin sudah dihapus)', 1);
        return false;
      }
      rows[i] = { ...rows[i], ...record, upd: now };
    } else {
      rows.push({ ...record, id: uid(), created: now, upd: now });
    }

    data[m] = rows;
    return this.save(data);
  },

  del(m, id) {
    const data = this.load();
    data[m] = this.list(m).filter((r) => r.id !== id);
    return this.save(data);
  },

  settings() {
    return this.load().settings || {};
  },

  setSettings(settings) {
    const data = this.load();
    data.settings = settings;
    return this.save(data);
  },
};

/* ==========================================================================
   02. UTILITAS
   ========================================================================== */

/* --- DOM & format --- */
const $ = (selector, el = document) => el.querySelector(selector);

/** Tanggal hari ini (YYYY-MM-DD) menurut zona waktu perangkat. */
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

const rp = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);

/** "2026-10-27" → "27 Oktober 2026" */
const tgl = (d) => {
  if (!d) return '';
  const date = new Date(d + 'T00:00');
  return isNaN(date)
    ? String(d)
    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** ISO timestamp → "27/10/2026" */
const tglPendek = (d) => {
  const date = new Date(d);
  return d && !isNaN(date) ? date.toLocaleDateString('id-ID') : '-';
};

/** Jam "09.00" (format lama) → "09:00" agar terbaca oleh input jam. */
const normTime = (v) => (/^\d{1,2}\.\d{2}$/.test(String(v ?? '')) ? String(v).replace('.', ':').padStart(5, '0') : v);

const icons = () => window.lucide && lucide.createIcons();

/* --- Toast --- */
function toast(message, isError) {
  const el = document.createElement('div');
  el.textContent = message;
  if (isError) el.className = 'e';
  $('#toast').append(el);
  setTimeout(() => el.remove(), 3000);
}

/* --- Modal --- */
function modal(html, wide) {
  const m = $('#modal');
  if (m.hidden) lastFocus = document.activeElement;
  m.innerHTML = `<div class="box ${wide ? 'wide' : ''}">${html}</div>`;
  m.hidden = false;
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  icons();
  $('input, select, textarea, button', m)?.focus();
}

let lastFocus = null;
function closeModal() {
  const m = $('#modal');
  if (m.hidden) return;
  m.hidden = true;
  m.innerHTML = '';
  lastFocus?.focus?.();
}

$('#modal').addEventListener('mousedown', (e) => {
  if (e.target.id === 'modal') closeModal();
});

document.addEventListener('keydown', (e) => {
  const m = $('#modal');
  if (m.hidden) return;
  if (e.key === 'Escape') return closeModal();

  // Fokus tidak boleh keluar dari dialog saat menekan Tab
  if (e.key === 'Tab') {
    const items = [...m.querySelectorAll('input, select, textarea, button, a[href]')].filter((el) => !el.disabled && !el.hidden);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!m.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

function confirmBox(message, onConfirm) {
  modal(`
    <h3>Konfirmasi</h3>
    <p>${message}</p>
    <div class="row">
      <button class="btn ghost" data-x>Batal</button>
      <button class="btn danger" data-ok>Ya, lanjutkan</button>
    </div>`);

  $('#modal [data-x]').onclick = closeModal;
  $('#modal [data-ok]').onclick = () => {
    closeModal();
    onConfirm();
  };
}

/* --- Cetak --- */
function doPrint(html, landscape) {
  let style = $('#pg');
  if (!style) {
    style = document.createElement('style');
    style.id = 'pg';
    document.head.append(style);
  }
  style.textContent = `@page{size:A4 ${landscape ? 'landscape' : 'portrait'}}`;
  $('#print').innerHTML = html;
  window.print();
}

/* ==========================================================================
   03. KONFIGURASI MODUL
   Format field: [kunci, label, tipe, wajib, nilai awal / opsi]
   ========================================================================== */
const S = () => DB.settings();

/* --- Field & potongan HTML yang dipakai bersama --- */
const SIGN_FIELDS = [
  ['penandatangan', 'Nama Penandatangan', 'text', 0, () => S().ttd],
  ['jabatan', 'Jabatan Penandatangan', 'text', 0, () => S().jabatan],
];

const kop = () =>
  `<div class="kop"><b>${esc(S().inst || 'NAMA INSTITUSI')}</b><br>${esc(S().alamat || '')}</div>`;

const sig = (r) =>
  `<div class="sig">${esc(tgl(r.tanggal || today()))}<br>${esc(r.jabatan || '')}<div></div><u>${esc(r.penandatangan || '................')}</u></div>`;

const noteHTML = (r) => (r.catatan ? `<p>Catatan: ${esc(r.catatan)}</p>` : '');

/** Ganti {{kunci}} pada template dengan isi field (tanggal diformat otomatis). */
const fill = (template, r, mod) =>
  esc(template || '')
    .replace(/\{\{(\w+)\}\}/g, (_, k) => {
      const field = mod.f.find((x) => x[0] === k);
      const value = r[k] ?? '';
      return esc(field && field[2] === 'date' ? tgl(value) : value);
    })
    .replace(/\n/g, '<br>');

/** Kerangka surat standar: kop, judul, nomor, isi, tanda tangan. */
const letter = (mod, r) => `
  ${kop()}
  <p style="text-align:center"><b><u>${esc(mod.head)}</u></b><br>Nomor: ${esc(r.nomor)}</p>
  <p>${fill(r.isi, r, mod)}</p>
  ${noteHTML(r)}
  ${sig(r)}`;

/* --- Template isi surat bawaan --- */
const TPL_MINIRISET = [
  'Yth. Pimpinan {{instansi}}',
  '{{alamat}}',
  '',
  'Dengan hormat, kami mohon izin bagi mahasiswa berikut: {{nama}} (NIM {{nim}}), Program Studi {{prodi}}, {{fakultas}}, untuk melaksanakan miniriset dengan keperluan/judul "{{judul}}" di instansi Bapak/Ibu.',
  '',
  'Demikian surat ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.',
].join('\n');

const TPL_MAGANG = [
  'Yth. Pimpinan {{instansi}}',
  '{{alamat}}',
  '',
  'Dengan hormat, kami mengajukan mahasiswa {{nama}} (NIM {{nim}}), Program Studi {{prodi}}, {{fakultas}}, untuk melaksanakan magang pada bagian {{posisi}} mulai {{tglMulai}} sampai {{tglSelesai}}.',
  '',
  'Demikian permohonan ini kami sampaikan. Atas bantuan Bapak/Ibu, kami ucapkan terima kasih.',
].join('\n');

/* --- Definisi modul --- */
const M = {
  /* ---------- Surat ---------- */
  miniriset: {
    label: 'Surat Miniriset',
    icon: 'file-text',
    doc: 1,
    head: 'SURAT PERMOHONAN MINIRISET',
    cols: ['nomor', 'nama', 'instansi', 'tanggal'],
    title: (r) => r.nomor + ' — ' + r.nama,
    f: [
      ['nomor', 'Nomor Surat', 'text', 1],
      ['nama', 'Nama Mahasiswa', 'text', 1],
      ['nim', 'NIM', 'text', 1],
      ['prodi', 'Program Studi', 'text', 1, () => S().prodi],
      ['fakultas', 'Fakultas', 'text', 0, () => S().fakultas],
      ['instansi', 'Instansi Tujuan', 'text', 1],
      ['alamat', 'Alamat Tujuan', 'text'],
      ['judul', 'Judul / Keperluan Miniriset', 'textarea', 1],
      ['tanggal', 'Tanggal Surat', 'date', 1],
      ...SIGN_FIELDS,
      ['isi', 'Isi Surat (template dapat diedit)', 'textarea', 1, TPL_MINIRISET],
      ['catatan', 'Catatan Tambahan', 'textarea'],
    ],
    render(r) {
      return letter(this, r);
    },
  },

  magang: {
    label: 'Surat Magang KKU',
    icon: 'briefcase',
    doc: 1,
    head: 'SURAT PERMOHONAN MAGANG',
    cols: ['nomor', 'nama', 'instansi', 'tglMulai'],
    title: (r) => r.nomor + ' — ' + r.nama,
    f: [
      ['nomor', 'Nomor Surat', 'text', 1],
      ['nama', 'Nama Mahasiswa', 'text', 1],
      ['nim', 'NIM', 'text', 1],
      ['prodi', 'Program Studi', 'text', 1, () => S().prodi],
      ['fakultas', 'Fakultas', 'text', 0, () => S().fakultas],
      ['instansi', 'Nama Instansi Tujuan', 'text', 1],
      ['alamat', 'Alamat Instansi', 'text'],
      ['posisi', 'Posisi / Bagian Magang', 'text', 1],
      ['tglMulai', 'Tanggal Mulai', 'date', 1],
      ['tglSelesai', 'Tanggal Selesai', 'date', 1],
      ['tanggal', 'Tanggal Surat', 'date', 1],
      ...SIGN_FIELDS,
      ['isi', 'Isi Surat (template dapat diedit)', 'textarea', 1, TPL_MAGANG],
    ],
    render(r) {
      return letter(this, r);
    },
  },

  bap: {
    label: 'Surat BAP',
    icon: 'clipboard-list',
    doc: 1,
    cols: ['nomor', 'judul', 'tanggal', 'lokasi'],
    title: (r) => r.nomor + ' — ' + r.judul,
    f: [
      ['nomor', 'Nomor Dokumen', 'text', 1],
      ['judul', 'Jenis / Judul BAP', 'text', 1, 'Berita Acara'],
      ['tanggal', 'Tanggal', 'date', 1],
      ['waktu', 'Waktu', 'time'],
      ['lokasi', 'Lokasi', 'text', 1],
      ['p1', 'Nama Pihak Pertama', 'text', 1],
      ['j1', 'Jabatan Pihak Pertama', 'text'],
      ['p2', 'Nama Pihak Kedua', 'text', 1],
      ['j2', 'Jabatan Pihak Kedua', 'text'],
      ['uraian', 'Uraian Berita Acara', 'textarea', 1],
      ['hasil', 'Hasil / Kesimpulan', 'textarea'],
      ...SIGN_FIELDS,
      ['catatan', 'Catatan Tambahan', 'textarea'],
    ],
    render: (r) => `
      ${kop()}
      <p style="text-align:center"><b><u>${esc(String(r.judul || '').toUpperCase())}</u></b><br>Nomor: ${esc(r.nomor)}</p>
      <p>Pada hari/tanggal ${esc(tgl(r.tanggal))}${r.waktu ? ', pukul ' + esc(r.waktu) : ''}, bertempat di ${esc(r.lokasi)}, yang bertanda tangan di bawah ini:</p>
      <p>1. ${esc(r.p1)} — ${esc(r.j1)} (Pihak Pertama)<br>2. ${esc(r.p2)} — ${esc(r.j2)} (Pihak Kedua)</p>
      <p><b>Uraian:</b><br>${nl2br(r.uraian)}</p>
      ${r.hasil ? `<p><b>Hasil/Kesimpulan:</b><br>${nl2br(r.hasil)}</p>` : ''}
      ${noteHTML(r)}
      <p>Demikian berita acara ini dibuat dengan sebenarnya.</p>
      <table style="border:0;width:100%">
        <tr>
          <td style="border:0;text-align:center">Pihak Pertama<div style="height:70px"></div><u>${esc(r.p1)}</u></td>
          <td style="border:0;text-align:center">Pihak Kedua<div style="height:70px"></div><u>${esc(r.p2)}</u></td>
        </tr>
      </table>
      ${r.penandatangan ? `<div class="sig">Mengetahui,<br>${esc(r.jabatan)}<div></div><u>${esc(r.penandatangan)}</u></div>` : ''}`,
  },

  /* ---------- Pencatatan ---------- */
  turnitin: {
    label: 'Turnitin',
    icon: 'search-check',
    cols: ['nama', 'dokumen', 'tanggal', 'sim', 'status'],
    filter: 'status',
    note: 'Fitur ini hanya mencatat hasil pengecekan secara manual. Student Desk tidak terhubung ke Turnitin dan tidak memeriksa plagiarisme.',
    f: [
      ['nama', 'Nama Mahasiswa', 'text', 1],
      ['nim', 'NIM', 'text', 1],
      ['dokumen', 'Nama Dokumen', 'text', 1],
      [
        'jenis',
        'Jenis Dokumen',
        'select',
        1,
        ['Skripsi', 'Proposal', 'Jurnal', 'Makalah', 'Laporan', 'Lainnya'],
      ],
      ['tanggal', 'Tanggal Pengecekan', 'date', 1],
      ['sim', 'Similarity (%)', 'number', 1],
      ['batas', 'Batas Similarity (%)', 'number', 1, () => S().batas || 25],
      ['status', 'Status Pemeriksaan', 'select', 1, ['Menunggu', 'Selesai', 'Perlu Revisi']],
      ['ref', 'Referensi / Lokasi Laporan', 'text'],
      ['catatan', 'Catatan', 'textarea'],
    ],
  },

  pedos: {
    label: 'Jadwal PEDOS',
    icon: 'calendar-days',
    cols: ['kegiatan', 'tanggal', 'mulai', 'lokasi', 'status'],
    filter: 'status',
    sort: 1, // urut kronologis (terdekat di atas)
    f: [
      ['kegiatan', 'Nama Kegiatan', 'text', 1],
      ['tanggal', 'Tanggal', 'date', 1],
      ['mulai', 'Waktu Mulai', 'time', 1],
      ['selesai', 'Waktu Selesai', 'time'],
      ['lokasi', 'Lokasi', 'text'],
      ['pj', 'Penanggung Jawab', 'text'],
      ['status', 'Status', 'select', 1, ['Terjadwal', 'Selesai', 'Dibatalkan']],
      ['ket', 'Keterangan', 'textarea'],
    ],
  },

  absensi: {
    label: 'Cetak Absensi',
    icon: 'users',
    cols: ['kegiatan', 'tanggal', 'nama', 'nim', 'status'],
    filter: 'status',
    land: 1, // daftar dicetak landscape
    f: [
      ['kegiatan', 'Nama Kegiatan', 'text', 1],
      ['tanggal', 'Tanggal Kegiatan', 'date', 1],
      ['lokasi', 'Lokasi', 'text'],
      ['nama', 'Nama Peserta', 'text', 1],
      ['nim', 'NIM / No. Identitas', 'text'],
      ['status', 'Status', 'select', 1, ['Hadir', 'Izin', 'Sakit', 'Tidak Hadir']],
      ['catatan', 'Catatan', 'text'],
    ],
    sum: (a) => {
      const hadir = a.filter((r) => r.status === 'Hadir').length;
      return `Total peserta: <b>${a.length}</b> · Hadir: <b>${hadir}</b> · Tidak hadir: <b>${a.length - hadir}</b>`;
    },
    list: (a) => {
      const groups = {};
      a.forEach((r) => (groups[r.kegiatan + '|' + r.tanggal] ||= []).push(r));
      const all = Object.values(groups);
      return all
        .map(
          (g, gi) => `
        <section${gi < all.length - 1 ? ' style="break-after:page"' : ''}>
        ${kop()}
        <h3 style="text-align:center">DAFTAR HADIR<br>${esc(g[0].kegiatan)}</h3>
        <p>Tanggal: ${esc(tgl(g[0].tanggal))}, Lokasi: ${esc(g[0].lokasi || '-')}</p>
        <table>
          <tr><th>No</th><th>Nama</th><th>NIM</th><th>Status</th><th style="width:28%">Tanda Tangan</th><th>Catatan</th></tr>
          ${g.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.nama)}</td><td>${esc(r.nim)}</td><td>${esc(r.status)}</td><td style="height:34px"></td><td>${esc(r.catatan)}</td></tr>`).join('')}
        </table></section>`,
        )
        .join('');
    },
  },

  kuitansi: {
    label: 'Catat Kuitansi',
    icon: 'receipt',
    cols: ['nomor', 'tanggal', 'pembayar', 'ket', 'jumlah'],
    filter: 'kategori',
    f: [
      ['nomor', 'Nomor Kuitansi', 'text', 1],
      ['tanggal', 'Tanggal Transaksi', 'date', 1],
      ['pembayar', 'Nama Pembayar', 'text', 1],
      ['penerima', 'Nama Penerima', 'text', 1],
      ['ket', 'Keterangan Transaksi', 'text', 1],
      [
        'kategori',
        'Kategori',
        'select',
        1,
        ['Pendidikan', 'Administrasi', 'Kegiatan', 'Operasional', 'Lainnya'],
      ],
      ['jumlah', 'Jumlah (Rp)', 'number', 1],
      ['metode', 'Metode Pembayaran', 'select', 1, ['Tunai', 'Transfer', 'E-Wallet']],
      ['catatan', 'Catatan', 'textarea'],
    ],
    sum: (a) =>
      `Jumlah transaksi: <b>${a.length}</b> · Total: <b>${rp(a.reduce((s, r) => s + (Number(r.jumlah) || 0), 0))}</b>`,
    render: (r) => {
      const row = (label, value) =>
        `<tr><td style="border:0;width:30%">${label}</td><td style="border:0">: ${value}</td></tr>`;
      return `
        ${kop()}
        <h3 style="text-align:center"><u>KUITANSI</u><br>No. ${esc(r.nomor)}</h3>
        <table style="border:0">
          ${row('Telah terima dari', esc(r.pembayar))}
          ${row('Uang sejumlah', `<b>${rp(r.jumlah)}</b>`)}
          ${row('Untuk pembayaran', `${esc(r.ket)} (${esc(r.kategori)})`)}
          ${row('Metode', esc(r.metode))}
        </table>
        ${noteHTML(r)}
        <div class="sig">${esc(tgl(r.tanggal))}<br>Penerima<div></div><u>${esc(r.penerima)}</u></div>`;
    },
    list: (a) => `
      ${kop()}
      <h3 style="text-align:center">REKAP KUITANSI</h3>
      <table>
        <tr><th>No</th><th>Nomor</th><th>Tanggal</th><th>Pembayar</th><th>Keterangan</th><th>Jumlah</th></tr>
        ${a
          .map(
            (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(r.nomor)}</td>
          <td>${esc(tgl(r.tanggal))}</td>
          <td>${esc(r.pembayar)}</td>
          <td>${esc(r.ket)}</td>
          <td>${rp(r.jumlah)}</td>
        </tr>`,
          )
          .join('')}
        <tr><td colspan="5"><b>Total</b></td><td><b>${rp(a.reduce((s, r) => s + (Number(r.jumlah) || 0), 0))}</b></td></tr>
      </table>`,
  },
};

/** Modul yang menghasilkan dokumen surat (dipakai dashboard & riwayat). */
const DOCS = Object.keys(M).filter((k) => M[k].doc);

/** Cari definisi field `k` milik modul `m`. */
const fieldOf = (m, k) => M[m].f.find((x) => x[0] === k);

/* --- Tampilan isi sel tabel --- */
function statusBadge(m, r) {
  const v = r.status;
  const upcoming = m === 'pedos' && v === 'Terjadwal' && r.tanggal >= today();

  let tone = 'warn';
  if (upcoming) tone = 'info';
  else if (/revisi|batal|tidak/i.test(v)) tone = 'bad';
  else if (/selesai|hadir/i.test(v)) tone = 'ok';

  return `<span class="badge ${tone}">${upcoming ? 'Mendatang' : esc(v)}</span>`;
}

function similarityBadge(r) {
  const safe = r.sim <= (r.batas || S().batas || 25);
  return `<span class="badge ${safe ? 'ok' : 'bad'}">${r.sim}% ${safe ? '· Aman' : '· Melebihi batas'}</span>`;
}

function cell(m, r, k) {
  const value = r[k];
  if (fieldOf(m, k)[2] === 'date') return esc(tgl(value));
  if (k === 'jumlah') return rp(value);
  if (k === 'sim') return similarityBadge(r);
  if (k === 'status') return statusBadge(m, r);
  return esc(value);
}

/* ==========================================================================
   04. FORMULIR
   ========================================================================== */

/** Nomor surat berikutnya berdasarkan format di Pengaturan. */
function nextNo(m) {
  const d = new Date();
  const used = new Set(DB.list(m).map((r) => r.nomor));
  let fmt = S().fmt || '{n}/SD/{bln}/{thn}';
  if (!fmt.includes('{n}')) fmt += '/{n}'; // pastikan nomor selalu unik
  const make = (i) =>
    fmt
      .replace(/\{n\}/g, String(i).padStart(3, '0'))
      .replace(/\{bln\}/g, String(d.getMonth() + 1).padStart(2, '0'))
      .replace(/\{thn\}/g, d.getFullYear());
  let i = DB.list(m).length + 1;
  while (used.has(make(i))) i++;
  return make(i);
}

/** HTML satu field formulir. `record` = data yang sedang diedit ({} jika baru). */
function fieldHTML(m, field, record, isEdit) {
  const [k, label, type, required, extra] = field;
  let value = record[k];

  // Nilai awal hanya untuk formulir baru
  if (value == null && !isEdit) {
    value = typeof extra === 'function' ? extra() : type === 'select' ? '' : extra;
    if (type === 'date' && !value) value = today();
    if (k === 'nomor') value = nextNo(m);
  }
  if (type === 'time') value = normTime(value);

  const attrs = `name="${k}" id="f_${k}" ${required ? 'required' : ''}`;
  let control;

  if (type === 'select') {
    const options = extra.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('');
    control = `<select ${attrs}><option value="">Pilih…</option>${options}</select>`;
  } else if (type === 'textarea') {
    control = `<textarea ${attrs}>${esc(value)}</textarea>`;
  } else {
    const numberAttrs = type === 'number' ? `min="0" ${k === 'sim' || k === 'batas' ? 'max="100"' : ''} step="any"` : '';
    control = `<input ${attrs} type="${type}" ${numberAttrs} value="${esc(value)}">`;
  }

  return `
    <div class="fg ${type === 'textarea' ? 'full' : ''}">
      <label for="f_${k}">${label}${required ? ' *' : ''}</label>
      ${control}
      <small></small>
    </div>`;
}

/** Baca & validasi isian formulir. Mengembalikan { data, invalid }. */
function readForm(fields) {
  const data = {};
  let invalid = 0;

  fields.forEach(([k, , type, required]) => {
    const el = $('#f_' + k);
    const group = el.closest('.fg');
    let value = el.value.trim();
    let error = '';

    if (required && !value) {
      error = 'Wajib diisi';
    } else if (type === 'number' && value !== '') {
      value = Number(value);
      if (isNaN(value) || value < 0) error = 'Harus angka ≥ 0';
    }

    group.classList.toggle('err', !!error);
    group.lastElementChild.textContent = error;
    if (error) invalid++;

    data[k] = value;
  });

  return { data, invalid };
}

/** Aturan antar-field. Mengembalikan { kunci: pesan } bila ada yang salah. */
const CROSS_RULES = {
  magang: (d) => (d.tglMulai && d.tglSelesai && d.tglSelesai < d.tglMulai ? { tglSelesai: 'Tidak boleh sebelum tanggal mulai' } : {}),
  pedos: (d) => (d.mulai && d.selesai && d.selesai < d.mulai ? { selesai: 'Tidak boleh sebelum waktu mulai' } : {}),
  turnitin: (d) => ({
    ...(d.sim > 100 ? { sim: 'Maksimal 100%' } : {}),
    ...(d.batas > 100 ? { batas: 'Maksimal 100%' } : {}),
  }),
};

function openForm(m, id) {
  const C = M[m];
  const record = id ? DB.get(m, id) : {};
  if (!record) return toast('Data tidak ditemukan', 1);

  modal(`
    <h3>${id ? 'Edit' : 'Tambah'} — ${C.label}</h3>
    <form id="frm" novalidate>
      <div class="fgrid">${C.f.map((f) => fieldHTML(m, f, record, !!id)).join('')}</div>
      <div class="row">
        <button type="button" class="btn ghost" data-x>Batal</button>
        <button class="btn">Simpan</button>
      </div>
    </form>`);

  $('#modal [data-x]').onclick = closeModal;

  $('#frm').onsubmit = (e) => {
    e.preventDefault();

    const { data, invalid: basicInvalid } = readForm(C.f);
    let invalid = basicInvalid;

    const problems = basicInvalid ? {} : CROSS_RULES[m]?.(data) || {};
    Object.entries(problems).forEach(([k, message]) => {
      const group = $('#f_' + k).closest('.fg');
      group.classList.add('err');
      group.lastElementChild.textContent = message;
      invalid++;
    });
    if (invalid) return toast('Periksa kembali isian formulir', 1);

    if (id) {
      data.id = id;
      data.demo = 0; // data contoh yang diedit dianggap milik pengguna
    }
    if (DB.put(m, data)) {
      closeModal();
      toast('Data tersimpan');
      go();
    }
  };
}

function preview(m, id) {
  const C = M[m];
  const record = DB.get(m, id);
  if (!record) return toast('Data tidak ditemukan', 1);

  modal(
    `
    <div class="row" style="margin:0 0 10px">
      <button class="btn ghost" data-x>Tutup</button>
      <button class="btn" data-p>Cetak / Simpan PDF</button>
    </div>
    <div class="paper">${C.render(record)}</div>`,
    1,
  );

  $('#modal [data-x]').onclick = closeModal;
  $('#modal [data-p]').onclick = () => doPrint(C.render(record));
}

/* ==========================================================================
   05. HALAMAN
   ========================================================================== */

/* --- Helper bersama --- */
const emptyHTML = (message) => `<div class="empty"><i data-lucide="inbox"></i><br>${message}</div>`;

/** Cocokkan kata kunci dengan isi field modul saja (bukan id, flag demo, atau stempel waktu). */
const matchesSearch = (record, query, m = record._m) =>
  !query ||
  M[m].f
    .map(([k, , type]) => (type === 'date' ? record[k] + ' ' + tgl(record[k]) : record[k]))
    .join(' ')
    .toLowerCase()
    .includes(query);

/** Tombol aksi di akhir baris tabel. */
const actionButtons = (m, id, canPreview) => {
  const attrs = `data-m="${m}" data-id="${id}"`;
  return `
    ${
      canPreview
        ? `
      <button class="btn ghost sm" data-a="view" ${attrs}>Lihat</button>
      <button class="btn ghost sm" data-a="prn" ${attrs}>Cetak</button>`
        : ''
    }
    <button class="btn ghost sm" data-a="edit" ${attrs}>Edit</button>
    <button class="btn danger sm" data-a="del" ${attrs}>Hapus</button>`;
};

/**
 * Pasang satu handler klik untuk semua tombol aksi di dalam `container`.
 * `fixedModule` dipakai bila tombol tidak membawa data-m.
 */
function bindRowActions(container, labels, fixedModule) {
  container.onclick = (e) => {
    const btn = e.target.closest('[data-a]');
    if (!btn) return;

    const { a: action, id } = btn.dataset;
    const m = btn.dataset.m || fixedModule;

    if (action === 'edit') openForm(m, id);
    if (action === 'view') preview(m, id);
    if (action === 'prn') doPrint(M[m].render(DB.get(m, id)));
    if (action === 'del') {
      confirmBox(labels.confirm, () => {
        DB.del(m, id) && toast(labels.done);
        go();
      });
    }
  };
}

/* --- Daftar per modul --- */
const savedQuery = {}; // ingat pencarian/filter terakhir tiap modul

function listView(m) {
  const C = M[m];
  const q = savedQuery[m] || {};

  const filterSelect = C.filter
    ? `<select id="fl">
         <option value="">Semua ${C.filter}</option>
         ${fieldOf(m, C.filter)[4]
           .map((o) => `<option ${o === q.f ? 'selected' : ''}>${o}</option>`)
           .join('')}
       </select>`
    : '';

  const dateFilter = C.f.some((f) => f[0] === 'tanggal')
    ? `<input type="date" id="dt" value="${q.d || ''}" aria-label="Filter tanggal">`
    : '';

  $('#view').innerHTML = `
    <div class="page-head">
      <div class="page-head-main">
        <h2>${C.label}</h2>
        <span class="muted">${C.note || 'Data tersimpan di browser perangkat ini.'}</span>
      </div>
      ${C.list ? '<button class="btn ghost" id="pl"><i data-lucide="printer"></i>Cetak Daftar</button>' : ''}
      <button class="btn" id="add"><i data-lucide="plus"></i>Tambah</button>
    </div>

    <div class="bar">
      <input id="s" placeholder="Cari…" value="${esc(q.s)}" aria-label="Cari">
      ${filterSelect}
      ${dateFilter}
    </div>

    <div class="card">
      <div id="sm" class="muted" style="margin-bottom:10px"></div>
      <div class="tw" id="tb"></div>
    </div>`;

  const sortRows = (rows) =>
    rows.sort((x, y) =>
      C.sort
        ? (x.tanggal + (x.mulai || '')).localeCompare(y.tanggal + (y.mulai || ''))
        : (y.tanggal || y.upd || '').localeCompare(x.tanggal || x.upd || '') ||
          (y.upd || '').localeCompare(x.upd || ''),
    );

  /** Nilai mentah untuk mengurutkan kolom tanggal / angka (teks tampilan tidak cocok). */
  const sortValue = (r, k) => {
    const type = fieldOf(m, k)[2];
    if (type === 'date') return r[k] || '';
    if (type === 'number') return String(Number(r[k]) || 0).padStart(15, '0');
    return null;
  };

  const tableHTML = (rows) => `
    <table>
      <tr>${C.cols.map((k) => `<th>${fieldOf(m, k)[1]}</th>`).join('')}<th></th></tr>
      ${rows
        .map(
          (r) => `
        <tr>
          ${C.cols
            .map((k) => {
              const sv = sortValue(r, k);
              return `<td${sv === null ? '' : ` data-sv="${esc(sv)}"`}>${cell(m, r, k)}</td>`;
            })
            .join('')}
          <td class="act">${actionButtons(m, r.id, !!C.render)}</td>
        </tr>`,
        )
        .join('')}
    </table>`;

  const draw = () => {
    const search = $('#s').value;
    const status = $('#fl')?.value || '';
    const date = $('#dt')?.value || '';
    savedQuery[m] = { s: search, f: status, d: date };

    const rows = sortRows(
      DB.list(m).filter(
        (r) =>
          matchesSearch(r, search.toLowerCase(), m) &&
          (!status || r[C.filter] === status) &&
          (!date || r.tanggal === date),
      ),
    );

    $('#sm').innerHTML = C.sum ? C.sum(rows) : `${rows.length} data`;
    $('#tb').innerHTML = rows.length
      ? tableHTML(rows)
      : emptyHTML('Tidak ada data. Klik “+ Tambah” untuk memulai.');

    const printBtn = $('#pl');
    if (printBtn) {
      printBtn.onclick = () =>
        rows.length ? doPrint(C.list(rows), C.land) : toast('Tidak ada data untuk dicetak', 1);
    }

    icons();
  };

  ['s', 'fl', 'dt'].forEach((id) => $('#' + id)?.addEventListener('input', draw));
  $('#add').onclick = () => openForm(m);

  draw();
  bindRowActions(
    $('#tb'),
    {
      confirm: 'Hapus data ini? Tindakan tidak dapat dibatalkan.',
      done: 'Data dihapus',
    },
    m,
  );
}

/* --- Dashboard --- */
/** Warna & deskripsi tiap modul (dipakai ikon, akses cepat, dan grafik). */
const LOOK = {
  miniriset: ['#0b5f39', 'Buat surat miniriset dengan mudah'],
  turnitin: ['#52b788', 'Catat hasil pengecekan Turnitin'],
  pedos: ['#7cc9a2', 'Kelola jadwal kegiatan PEDOS'],
  magang: ['#14804f', 'Buat surat magang KKU'],
  bap: ['#2a9d68', 'Buat berita acara kegiatan'],
  absensi: ['#a6dcbf', 'Kelola dan cetak daftar absensi'],
  kuitansi: ['#c9ecd9', 'Simpan transaksi keuangan'],
};
const tint = (m) => `--c:${LOOK[m][0]};--cs:${LOOK[m][0]}1f`;

const madeToday = (r) => new Date(r.created).toLocaleDateString() === new Date().toLocaleDateString();
const trend = (rows) => {
  const n = rows.filter(madeToday).length;
  return n ? `<em>↑ ${n} hari ini</em>` : '<em class="flat">Belum ada baru</em>';
};

let globalQ = ''; // kata kunci dari kolom cari di header

const ART = `
  <svg class="art" viewBox="0 0 240 150" aria-hidden="true">
    <rect x="62" y="22" width="120" height="82" rx="8" fill="#fff" stroke="#3b82f6" stroke-width="5"/>
    <rect x="74" y="34" width="96" height="10" rx="5" fill="#cfe0ff"/>
    <rect x="74" y="52" width="60" height="7" rx="3.5" fill="#e3ecff"/>
    <circle cx="122" cy="82" r="12" fill="#22c55e"/>
    <path d="M116 82l4 4 8-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M44 112h152l-10 14H54z" fill="#bcd3ff"/>
    <path d="M200 126c-4-26 4-46 16-58 4 22-2 44-16 58z" fill="#34b6c9"/>
    <path d="M200 126c-14-14-26-18-38-16 8 14 22 20 38 16z" fill="#5fd0dd"/>
    <rect x="190" y="118" width="22" height="22" rx="5" fill="#cfe0ff"/>
  </svg>`;

/** Semua dokumen surat dari semua modul, terbaru di atas. */
const allDocs = () =>
  DOCS.flatMap((m) => DB.list(m).map((r) => ({ ...r, _m: m }))).sort((a, b) =>
    (b.upd || '').localeCompare(a.upd || ''),
  );

const greeting = () => {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
};

/* --- Kutipan harian --- */
const QUOTES = [
  'Tidak perlu menunggu siap sempurna. Mulai dari satu berkas, selesaikan satu per satu.',
  'Berkas yang rapi hari ini menyelamatkan waktumu esok hari.',
  'Konsisten sedikit setiap hari mengalahkan semangat besar yang hanya sesaat.',
  'Setiap lembar dan catatan kecil adalah langkah menuju kelulusan.',
  'Yang terjadwal akan terlaksana. Yang tercatat tidak akan terlupa.',
  'Tenang dan teratur adalah kunci pekerjaan yang cepat selesai.',
  'Satu tugas yang selesai lebih berharga daripada sepuluh yang hanya direncanakan.',
  'Ilmu tumbuh dari kebiasaan kecil yang dijaga dengan sabar.',
  'Hari yang baik dimulai dari daftar yang jelas.',
  'Jangan bandingkan lajumu dengan orang lain. Cukup lebih baik dari kemarin.',
  'Karakter dibangun dari hal-hal kecil yang dikerjakan dengan jujur.',
  'Kerjakan dengan jujur, rapikan dengan teliti, serahkan dengan percaya diri.',
];
let quoteShift = 0;
const quoteNow = () => {
  const day = Math.floor(new Date(today() + 'T00:00').getTime() / 864e5);
  return QUOTES[(day + quoteShift) % QUOTES.length];
};

/* --- Pengingat: otomatis dari data + catatan manual (CRUD) --- */
const dayDiff = (d) => Math.round((new Date(d + 'T00:00') - new Date(today() + 'T00:00')) / 864e5);
const whenLabel = (n) =>
  n < 0 ? `Terlewat ${-n} hari` : n === 0 ? 'Hari ini' : n === 1 ? 'Besok' : `${n} hari lagi`;
const dueTone = (n) => (n < 0 ? 'bad' : n <= 1 ? 'warn' : 'info');

function reminderItems() {
  const items = [];

  DB.list('pedos')
    .filter((r) => r.status === 'Terjadwal')
    .forEach((r) => {
      const n = dayDiff(r.tanggal);
      if (isNaN(n) || n > 7) return;
      items.push({
        auto: 1,
        icon: 'calendar-days',
        tone: dueTone(n),
        title: r.kegiatan,
        sub: n < 0 ? 'Jadwal terlewat, perbarui statusnya' : `${r.mulai}${r.lokasi ? ' · ' + r.lokasi : ''}`,
        label: whenLabel(n),
        href: '#pedos',
        rank: n,
      });
    });

  DB.list('magang').forEach((r) => {
    const n = dayDiff(r.tglMulai);
    if (isNaN(n) || n < 0 || n > 7) return;
    items.push({
      auto: 1,
      icon: 'briefcase',
      tone: dueTone(n),
      title: `Magang dimulai: ${r.nama}`,
      sub: r.instansi,
      label: whenLabel(n),
      href: '#magang',
      rank: n,
    });
  });

  DB.list('turnitin').forEach((r) => {
    if (r.status === 'Selesai') return;
    const revisi = r.status === 'Perlu Revisi';
    items.push({
      auto: 1,
      icon: 'search-check',
      tone: revisi ? 'bad' : 'warn',
      title: `${revisi ? 'Revisi' : 'Tunggu hasil'}: ${r.dokumen}`,
      sub: `${r.nama} · similarity ${r.sim}%`,
      label: revisi ? 'Perlu revisi' : 'Menunggu',
      href: '#turnitin',
      rank: revisi ? 1 : 3,
    });
  });

  DB.list('pengingat').forEach((r) => {
    const diff = r.tanggal ? dayDiff(r.tanggal) : null;
    const n = isNaN(diff) ? null : diff;
    items.push({
      id: r.id,
      done: !!r.done,
      icon: 'sticky-note',
      tone: r.done ? 'ok' : n === null ? 'info' : dueTone(n),
      title: r.teks,
      sub: r.tanggal ? tgl(r.tanggal) : 'Catatan pribadi',
      label: r.done ? 'Selesai' : n === null ? 'Catatan' : whenLabel(n),
      rank: n === null ? 5 : n,
    });
  });

  return items.sort((x, y) => (x.done ? 1 : 0) - (y.done ? 1 : 0) || x.rank - y.rank);
}

function remindersHTML() {
  const items = reminderItems();
  const open = items.filter((i) => !i.done).length;
  const shown = items.slice(0, 5);

  const row = (i) => {
    const body = `<div class="rm-b"><p>${esc(i.title)}</p><small>${esc(i.sub)}</small></div>
      <span class="badge ${i.tone}">${esc(i.label)}</span>`;
    if (i.auto)
      return `<a class="rm" href="${i.href}"><span class="rm-ic ${i.tone}"><i data-lucide="${i.icon}"></i></span>${body}</a>`;
    return `<div class="rm ${i.done ? 'done' : ''}">
      <button type="button" class="rm-chk" data-rm="toggle" data-id="${i.id}" aria-label="Tandai selesai" aria-pressed="${i.done}"><i data-lucide="check"></i></button>
      ${body}
      <button type="button" class="rm-x" data-rm="del" data-id="${i.id}" aria-label="Hapus pengingat"><i data-lucide="x"></i></button>
    </div>`;
  };

  return `
    <div class="sec-h"><h3>Pengingat</h3>${open ? `<span class="badge warn">${open} aktif</span>` : ''}</div>
    <form class="rm-form" id="rmForm" autocomplete="off">
      <input name="teks" placeholder="Tulis pengingat baru…" aria-label="Isi pengingat" maxlength="120" required>
      <button class="btn" aria-label="Tambah pengingat"><i data-lucide="plus"></i></button>
      <label class="rm-date"><span>Tenggat (opsional)</span><input name="tanggal" type="date"></label>
    </form>
    <div class="rm-list">
      ${shown.length ? shown.map(row).join('') : '<div class="rm-empty"><i data-lucide="bell-ring"></i>Belum ada pengingat. Jadwal, magang, dan Turnitin yang butuh perhatian akan muncul di sini otomatis.</div>'}
    </div>
    ${items.length > shown.length ? `<small class="muted">+${items.length - shown.length} pengingat lainnya</small>` : ''}`;
}

function paintReminders() {
  const box = $('#rmBox');
  if (!box) return;
  box.innerHTML = remindersHTML();
  icons();

  $('#rmForm').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const teks = String(f.get('teks') || '').trim();
    if (!teks) return;
    if (DB.put('pengingat', { teks, tanggal: f.get('tanggal') || '', done: 0 })) {
      toast('Pengingat ditambahkan');
      paintReminders();
      chrome();
    }
  };

  box.onclick = (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.rm === 'toggle') {
      const r = DB.get('pengingat', id);
      if (r && DB.put('pengingat', { id, done: r.done ? 0 : 1 })) paintReminders();
    } else if (DB.del('pengingat', id)) {
      toast('Pengingat dihapus');
      paintReminders();
    }
  };
}

function dash() {
  const docs = allDocs();
  const kuitansi = DB.list('kuitansi');
  const jadwal = DB.list('pedos');
  const turnitin = DB.list('turnitin');
  const upcoming = jadwal
    .filter((r) => r.status === 'Terjadwal' && r.tanggal >= today())
    .sort((a, b) => (a.tanggal + a.mulai).localeCompare(b.tanggal + b.mulai));

  const fullDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const stats = [
    ['files', 'Total Dokumen', docs, 'miniriset'],
    ['receipt', 'Total Kuitansi', kuitansi, 'kuitansi'],
    ['calendar-days', 'Total Jadwal', jadwal, 'pedos'],
    ['search-check', 'Turnitin', turnitin, 'turnitin'],
  ];

  const quickLinks = [...DOCS, 'turnitin', 'pedos', 'absensi', 'kuitansi'];

  /* Grafik donat: jumlah data per modul */
  const counts = Object.keys(M).map((m) => [m, DB.list(m).length]);
  const total = counts.reduce((s, c) => s + c[1], 0);
  let at = 0;
  const ring = total
    ? counts
        .filter((c) => c[1])
        .map(([m, n]) => {
          const from = at;
          at += (n / total) * 100;
          return `${LOOK[m][0]} ${from}% ${at}%`;
        })
        .join(',')
    : '#e7edf7 0% 100%';

  const recent = docs
    .slice(0, 8)
    .map(
      (r) => `
    <tr>
      <td><span class="ic tile" style="${tint(r._m)}"><i data-lucide="${M[r._m].icon}"></i></span>${esc(M[r._m].title(r))}</td>
      <td>${M[r._m].label}</td>
      <td>${tglPendek(r.upd)}</td>
      <td class="act"><button class="btn ghost sm" data-v data-m="${r._m}" data-id="${r.id}">Lihat</button></td>
    </tr>`,
    )
    .join('');

  const events = upcoming
    .slice(0, 3)
    .map((r) => {
      const d = new Date(r.tanggal + 'T00:00');
      return `
      <div class="ev">
        <div class="date">${String(d.getDate()).padStart(2, '0')}<small>${d.toLocaleDateString('id-ID', { month: 'short' })}</small></div>
        <div><p>${esc(r.kegiatan)}</p><small>${esc(r.mulai)}${r.lokasi ? ' · ' + esc(r.lokasi) : ''}</small></div>
      </div>`;
    })
    .join('');

  const next = upcoming[0];

  const top = [...counts].sort((x, y) => y[1] - x[1])[0];
  const madeTodayCount = Object.keys(M)
    .flatMap((m) => DB.list(m))
    .filter((r) => new Date(r.created).toLocaleDateString() === new Date().toLocaleDateString()).length;

  /* Absensi terakhir (satu kegiatan) */
  const absAll = DB.list('absensi');
  const lastAbs = [...absAll].sort((x, y) => (y.tanggal || '').localeCompare(x.tanggal || ''))[0];
  const absGroup = lastAbs
    ? absAll.filter((r) => r.kegiatan === lastAbs.kegiatan && r.tanggal === lastAbs.tanggal)
    : [];
  const absCount = (s) => absGroup.filter((r) => r.status === s).length;
  const absPct = absGroup.length ? Math.round((absCount('Hadir') / absGroup.length) * 100) : 0;

  /* Ringkasan kuitansi per kategori */
  const byCat = {};
  kuitansi.forEach((r) => {
    byCat[r.kategori] = (byCat[r.kategori] || 0) + (Number(r.jumlah) || 0);
  });
  const catMax = Math.max(1, ...Object.values(byCat));
  const catRows = Object.entries(byCat)
    .sort((x, y) => y[1] - x[1])
    .map(
      ([k, v]) => `
    <div class="hb"><span>${esc(k)}</span><span class="trk"><i style="--w:${(v / catMax) * 100}%"></i></span><b>${rp(v)}</b></div>`,
    )
    .join('');
  const catTotal = Object.values(byCat).reduce((s, v) => s + v, 0);

  /* Turnitin terbaru */
  const tnRows = [...turnitin]
    .sort((x, y) => (y.tanggal || '').localeCompare(x.tanggal || ''))
    .slice(0, 3)
    .map(
      (r) => `
    <div class="tn"><div><p>${esc(r.nama)}</p><small>${esc(r.dokumen)}</small></div>${similarityBadge(r)}</div>`,
    )
    .join('');

  /* Aktivitas terbaru lintas modul */
  const actRows = Object.keys(M)
    .flatMap((m) => DB.list(m).map((r) => ({ ...r, _m: m })))
    .sort((x, y) => (y.upd || '').localeCompare(x.upd || ''))
    .slice(0, 4)
    .map(
      (r) => `
    <div class="ev">
      <span class="tile sm" style="${tint(r._m)}"><i data-lucide="${M[r._m].icon}"></i></span>
      <div><p>${esc(r.nama || r.kegiatan || r.pembayar || r.judul || r.nomor)}</p><small>${M[r._m].label} · ${tglPendek(r.upd)}</small></div>
    </div>`,
    )
    .join('');

  $('#view').innerHTML = `
    <div class="dash">
      <div>
        <section class="hero">
          <div>
            <small class="date-chip"><i data-lucide="calendar"></i>${fullDate}</small>
            <h2>${greeting()}, ${esc(S().user || 'Pelajar')}! 👋</h2>
            <p>Kamu punya <b>${upcoming.length}</b> jadwal mendatang dan <b>${docs.length}</b> dokumen tersimpan. Semoga harimu lancar.</p>
            <div class="hero-cta">
              <button class="btn" data-q="miniriset"><i data-lucide="plus"></i>Buat surat</button>
              <a class="btn glass" href="#pedos"><i data-lucide="calendar-days"></i>Lihat jadwal</a>
            </div>
          </div>
          <div class="nextup">
            <small>Jadwal berikutnya</small>
            ${
              next
                ? `<b>${esc(next.kegiatan)}</b><span>${esc(tgl(next.tanggal))}, ${esc(next.mulai)}${next.lokasi ? ', ' + esc(next.lokasi) : ''}</span>`
                : '<b>Belum ada jadwal</b><span>Tambahkan kegiatan di Jadwal PEDOS.</span>'
            }
          </div>
        </section>

        <section class="stats">
          ${stats
            .map(
              ([icon, label, rows, key]) => `
            <a class="card stat" href="#${key === 'miniriset' ? 'riwayat' : key}">
              <span class="ic tile" style="${tint(key)}"><i data-lucide="${icon}"></i></span>
              <div><span>${label}</span><b>${rows.length}</b>${trend(rows)}</div>
            </a>`,
            )
            .join('')}
        </section>

        <section class="row2">
          <div class="card">
            <h3>Akses Cepat</h3>
            <p class="muted sub">Pilih fitur yang ingin kamu gunakan</p>
            <div class="qa">
              ${quickLinks
                .map(
                  (m) => `
                <button data-q="${m}" style="${tint(m)}">
                  <span class="ic tile"><i data-lucide="${M[m].icon}"></i></span>
                  <b>${M[m].label}</b><small>${LOOK[m][1]}</small>
                </button>`,
                )
                .join('')}
            </div>
          </div>

          <div class="card col">
            <h3>Statistik Dokumen</h3>
            <div class="ring" style="background:conic-gradient(${ring})"><div><b>${total}</b>Data</div></div>
            ${counts
              .map(
                ([m, n]) => `
              <a class="lg ${n ? '' : 'zero'}" href="#${m}" style="${tint(m)}"><i></i>${M[m].label}<span>${n}</span></a>`,
              )
              .join('')}
            <div class="mini2">
              <div><small>Terbanyak</small><b>${total ? M[top[0]].label : '-'}</b></div>
              <div><small>Dibuat hari ini</small><b>${madeTodayCount}</b></div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="sec-h"><h3>Dokumen Terbaru</h3><a href="#riwayat">Lihat Semua →</a></div>
          ${
            recent
              ? `<div class="tw"><table class="recent">
                 <tr><th>Nama Dokumen</th><th>Jenis</th><th>Tanggal</th><th></th></tr>${recent}
               </table></div>`
              : emptyHTML('Belum ada dokumen. Buat surat pertamamu lewat Akses Cepat.')
          }
        </section>
      </div>

      <aside class="dash-side">
        <div class="quote">
          <span class="q-tag"><i data-lucide="sparkles"></i>Semangat hari ini</span>
          <blockquote id="qText">${esc(quoteNow())}</blockquote>
          <div class="q-foot">
            <span>Student Desk · UNIMED</span>
            <button type="button" class="q-next" data-qn aria-label="Tampilkan kutipan lain" title="Kutipan lain"><i data-lucide="refresh-cw"></i></button>
          </div>
        </div>

        <div class="card">
          <div class="sec-h"><h3>Jadwal Terdekat</h3><a href="#pedos">Lihat Semua →</a></div>
          ${events || emptyHTML('Tidak ada jadwal mendatang.')}
        </div>

        <div class="card" id="rmBox"></div>

        <div class="card">
          <div class="sec-h"><h3>Turnitin Terbaru</h3><a href="#turnitin">Lihat Semua →</a></div>
          ${tnRows || emptyHTML('Belum ada catatan Turnitin.')}
        </div>

        <div class="card">
          <div class="sec-h"><h3>Absensi Terakhir</h3><a href="#absensi">Lihat Semua →</a></div>
          ${
            lastAbs
              ? `
            <p class="abs-t">${esc(lastAbs.kegiatan)}</p>
            <small class="muted">${esc(tgl(lastAbs.tanggal))}${lastAbs.lokasi ? ' · ' + esc(lastAbs.lokasi) : ''}</small>
            <div class="abs-bar"><span class="trk"><i style="--w:${absPct}%"></i></span><b>${absPct}%</b></div>
            <div class="chips">
              <span class="ok">Hadir ${absCount('Hadir')}</span><span class="warn">Izin ${absCount('Izin')}</span>
              <span class="warn">Sakit ${absCount('Sakit')}</span><span class="bad">Tidak hadir ${absCount('Tidak Hadir')}</span>
            </div>`
              : emptyHTML('Belum ada data absensi.')
          }
        </div>

        <div class="card">
          <div class="sec-h"><h3>Ringkasan Kuitansi</h3><a href="#kuitansi">Lihat Semua →</a></div>
          <p class="muted sub">Total transaksi tercatat: <b>${rp(catTotal)}</b></p>
          ${catRows || emptyHTML('Belum ada kuitansi.')}
        </div>

        <div class="card">
          <h3>Aktivitas Terbaru</h3>
          ${actRows || emptyHTML('Belum ada aktivitas.')}
        </div>
      </aside>
    </div>`;

  paintReminders();

  // Akses cepat, lihat dokumen, dan ganti kutipan
  $('#view').onclick = (e) => {
    const view = e.target.closest('[data-v]');
    if (view) return preview(view.dataset.m, view.dataset.id);

    if (e.target.closest('[data-qn]')) {
      quoteShift++;
      const el = $('#qText');
      el.classList.remove('swap');
      void el.offsetWidth; // ulangi animasi
      el.textContent = quoteNow();
      el.classList.add('swap');
      return;
    }

    const btn = e.target.closest('[data-q]');
    if (btn) quickAdd(btn.dataset.q);
  };
}

/* --- Riwayat dokumen --- */
function riwayat() {
  $('#view').innerHTML = `
    <h2>Riwayat Dokumen</h2>
    <div class="bar">
      <input id="s" placeholder="Cari semua dokumen…" value="${esc(globalQ)}">
      <select id="t">
        <option value="">Semua jenis</option>
        ${DOCS.map((m) => `<option value="${m}">${M[m].label}</option>`).join('')}
      </select>
      <select id="o"><option>Terbaru</option><option>Terlama</option></select>
    </div>
    <div class="card tw" id="tb"></div>`;

  const draw = () => {
    const search = $('#s').value.toLowerCase();
    const type = $('#t').value;

    const rows = allDocs().filter((r) => (!type || r._m === type) && matchesSearch(r, search));
    if ($('#o').value === 'Terlama') rows.reverse();

    $('#tb').innerHTML = rows.length
      ? `<table>
           <tr><th>Dokumen</th><th>Jenis</th><th>Dibuat</th><th>Diperbarui</th><th></th></tr>
           ${rows
             .map(
               (r) => `
             <tr>
               <td>${esc(M[r._m].title(r))}</td>
               <td>${M[r._m].label}</td>
               <td>${tglPendek(r.created)}</td>
               <td>${tglPendek(r.upd)}</td>
               <td class="act">${actionButtons(r._m, r.id, true)}</td>
             </tr>`,
             )
             .join('')}
         </table>`
      : emptyHTML('Belum ada dokumen.');

    icons();
  };

  ['s', 't', 'o'].forEach((id) => $('#' + id).addEventListener('input', draw));
  globalQ = '';

  draw();
  bindRowActions($('#tb'), {
    confirm: 'Hapus dokumen ini?',
    done: 'Dokumen dihapus',
  });
}

/* --- Pengaturan --- */
const SETTING_FIELDS = [
  ['inst', 'Nama Institusi / Kampus'],
  ['prodi', 'Program Studi'],
  ['fakultas', 'Fakultas'],
  ['alamat', 'Alamat Institusi'],
  ['ttd', 'Penandatangan Default'],
  ['jabatan', 'Jabatan Penandatangan Default'],
  ['fmt', 'Format Nomor Surat ({n}, {bln}, {thn})'],
  ['batas', 'Batas Similarity Turnitin (%)'],
];

const SETTING_DEFAULTS = { fmt: '{n}/SD/{bln}/{thn}', batas: 25 };

function downloadBackup() {
  const blob = new Blob([JSON.stringify(DB.load(), null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `student-desk-backup-${today()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importBackup(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');

      // Modul yang bukan daftar dibuang; baris tanpa id/objek diabaikan
      [...Object.keys(M), 'pengingat'].forEach((m) => {
        if (data[m] === undefined) return;
        if (!Array.isArray(data[m])) throw new Error('invalid');
        data[m] = data[m].filter((r) => r && typeof r === 'object' && typeof r.id === 'string' && r.id);
      });
      if (data.settings && (typeof data.settings !== 'object' || Array.isArray(data.settings))) throw new Error('invalid');

      confirmBox('Impor akan MENIMPA seluruh data saat ini. Lanjutkan?', () => {
        DB.save(data) && toast('Data berhasil diimpor');
        go();
      });
    } catch {
      toast('File cadangan tidak valid', 1);
    }
  };

  reader.readAsText(file);
}

function settings() {
  const current = S();
  const demoRows = demoCount();

  const fields = SETTING_FIELDS.map(
    ([k, label]) => `
    <div class="fg">
      <label for="s_${k}">${label}</label>
      <input id="s_${k}" name="${k}" value="${esc(current[k] ?? SETTING_DEFAULTS[k] ?? '')}">
    </div>`,
  ).join('');

  $('#view').innerHTML = `
    <h2>Pengaturan</h2>
    <p class="muted">Student Desk berjalan tanpa server; semua data hanya tersimpan di browser ini. Tidak ada autentikasi atau password.</p>

    <form class="card" id="sf">
      <div class="fgrid">${fields}</div>
      <button class="btn">Simpan Pengaturan</button>
    </form>

    <div class="card">
      <h3>Cadangan data (JSON)</h3>
      <button class="btn ghost" id="ex">Ekspor Cadangan</button>
      <button class="btn ghost" id="im">Impor Cadangan</button>
      <input type="file" id="fi" accept=".json" hidden>
    </div>

    <div class="card">
      <h3>Data contoh</h3>
      <p class="muted">Saat ini tersimpan <b>${demoRows}</b> baris data contoh. Data contoh tidak akan mengganggu data buatanmu sendiri dan bisa dihapus kapan saja.</p>
      <div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-top:4px">
        <button type="button" class="btn" id="demoSeed">Isi ulang data contoh</button>
        <button type="button" class="btn ghost" id="demoClear">Hapus data contoh</button>
      </div>
    </div>`;

  $('#sf').onsubmit = (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    values.batas = Math.min(100, Math.max(1, Number(values.batas) || 25));
    if (!String(values.fmt || '').includes('{n}')) values.fmt = SETTING_DEFAULTS.fmt;
    if (DB.setSettings({ ...S(), ...values })) {
      toast('Pengaturan disimpan');
      go();
    }
  };

  $('#ex').onclick = downloadBackup;
  $('#im').onclick = () => $('#fi').click();
  $('#fi').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importBackup(file);
    e.target.value = '';
  };

  if ($('#demoSeed')) {
    $('#demoSeed').onclick = () =>
      confirmBox(
        'Ganti data contoh yang ada dengan versi baru? Data buatanmu sendiri tidak akan dihapus.',
        () => {
          if (seedDemoData()) {
            toast('Data contoh diperbarui');
            go();
          } else {
            toast('Gagal memuat data contoh', 1);
          }
        },
      );
  }

  if ($('#demoClear')) {
    $('#demoClear').onclick = () =>
      confirmBox('Hapus semua data contoh? Data buatanmu sendiri tidak akan dihapus.', () => {
        const removed = clearDemoData();
        if (removed < 0) return toast('Gagal menghapus data contoh', 1);
        toast(removed ? `${removed} data contoh dihapus` : 'Tidak ada data contoh');
        go();
      });
  }
}

/* ==========================================================================
   05a. DATA CONTOH
   Semua baris diberi tanda `demo: 1`, sehingga bisa dihapus tanpa menyentuh
   data yang dibuat sendiri oleh pengguna.
   ========================================================================== */
const DEMO_VERSION = 1;

const DEMO_SETTINGS = {
  user: 'Nabila Syafira',
  inst: 'Universitas Negeri Medan',
  prodi: 'Pendidikan Teknologi Informatika',
  fakultas: 'Fakultas Teknik',
  alamat: 'Jl. Willem Iskandar Pasar V, Medan 20221',
  ttd: 'Dr. Muhammad Rizki, M.Kom.',
  jabatan: 'Ketua Program Studi Pendidikan Teknologi Informatika',
  fmt: '{n}/SD/{bln}/{thn}',
  batas: 25,
  peran: 'Mahasiswa',
  nim: '7243150021',
  email: 'nabila.syafira@student.unimed.ac.id',
  telp: '0812-3456-7890',
  lahir: '2004-03-14',
  alamatPribadi: 'Jl. Gatot Subroto No. 12, Medan',
  bio: 'Mahasiswa Pendidikan Teknologi Informatika UNIMED. Aktif di PEDOS dan senang merapikan administrasi.',
};

const DEMO_STUDENTS = [
  ['Ahmad Fauzan', '7243150001', 'Pendidikan Teknologi Informatika', 'Fakultas Teknik'],
  ['Siti Sarah Nasution', '7243150002', 'Pendidikan Teknologi Informatika', 'Fakultas Teknik'],
  ['Muhammad Rizky Lubis', '7243150003', 'Ilmu Komputer', 'Fakultas Matematika dan Ilmu Pengetahuan Alam'],
  ['Dinda Ayu Lestari', '7243150004', 'Manajemen', 'Fakultas Ekonomi'],
  ['Josua Simbolon', '7243150005', 'Teknik Sipil', 'Fakultas Teknik'],
  ['Nurul Hidayah', '7243150006', 'Pendidikan Bahasa Inggris', 'Fakultas Bahasa dan Seni'],
  ['Kevin Simanjuntak', '7243150007', 'Sistem Informasi', 'Fakultas Teknik'],
  ['Putri Wulandari', '7243150008', 'Akuntansi', 'Fakultas Ekonomi'],
  ['Rian Saputra', '7243150009', 'Pendidikan Matematika', 'Fakultas Matematika dan Ilmu Pengetahuan Alam'],
  ['Melati Sinaga', '7243150010', 'Pendidikan Guru Sekolah Dasar', 'Fakultas Ilmu Pendidikan'],
  ['Andi Pratama', '7243150011', 'Pendidikan Teknologi Informatika', 'Fakultas Teknik'],
  ['Christina Sitorus', '7243150012', 'Pendidikan Bahasa Inggris', 'Fakultas Bahasa dan Seni'],
  ['Hafizh Lubis', '7243150013', 'Ilmu Komputer', 'Fakultas Matematika dan Ilmu Pengetahuan Alam'],
  ['Intan Permata Sari', '7243150014', 'Manajemen', 'Fakultas Ekonomi'],
  ['Dhani Harahap', '7243150015', 'Teknik Sipil', 'Fakultas Teknik'],
  ['Yuniarti Nasution', '7243150016', 'Akuntansi', 'Fakultas Ekonomi'],
  ['David Situmorang', '7243150017', 'Sistem Informasi', 'Fakultas Teknik'],
  ['Rizky Ramadhan', '7243150018', 'Pendidikan Matematika', 'Fakultas Matematika dan Ilmu Pengetahuan Alam'],
  ['Almira Siregar', '7243150019', 'Pendidikan Guru Sekolah Dasar', 'Fakultas Ilmu Pendidikan'],
  ['Beni Hutapea', '7243150020', 'Pendidikan Teknologi Informatika', 'Fakultas Teknik'],
  ['Nabila Syafira', '7243150021', 'Pendidikan Teknologi Informatika', 'Fakultas Teknik'],
  ['Tika Aprilia', '7243150022', 'Manajemen', 'Fakultas Ekonomi'],
  ['Fajar Maulana', '7243150023', 'Ilmu Komputer', 'Fakultas Matematika dan Ilmu Pengetahuan Alam'],
  ['Sarah Sihombing', '7243150024', 'Pendidikan Bahasa Inggris', 'Fakultas Bahasa dan Seni'],
  ['Rudi Panjaitan', '7243150025', 'Teknik Sipil', 'Fakultas Teknik'],
  ['Nadia Hasibuan', '7243150026', 'Akuntansi', 'Fakultas Ekonomi'],
  ['Eko Saputra', '7243150027', 'Sistem Informasi', 'Fakultas Teknik'],
  ['Wulan Damanik', '7243150028', 'Pendidikan Guru Sekolah Dasar', 'Fakultas Ilmu Pendidikan'],
  ['Theo Nainggolan', '7243150029', 'Pendidikan Teknologi Informatika', 'Fakultas Teknik'],
  ['Mawar Simatupang', '7243150030', 'Pendidikan Matematika', 'Fakultas Matematika dan Ilmu Pengetahuan Alam'],
];

const DEMO_INSTANSI = [
  ['Dinas Pendidikan Provinsi Sumatera Utara', 'Jl. Imam Bonjol No. 35, Medan'],
  ['PT Telkom Indonesia Witel Medan', 'Jl. Prof. H. M. Yamin No. 7, Medan'],
  ['Bank Sumut Cabang Medan', 'Jl. Imam Bonjol No. 14, Medan'],
  ['Politeknik Negeri Medan', 'Jl. Almamater No. 1, Medan'],
  ['SMP Negeri 2 Medan', 'Jl. Amaliun No. 18, Medan'],
  ['SMA Negeri 1 Medan', 'Jl. Budi Utomo No. 1, Medan'],
  ['Universitas Negeri Medan', 'Jl. Willem Iskandar Pasar V, Medan'],
  ['Dinas Komunikasi dan Informatika Kota Medan', 'Jl. Kapten Maulana Lubis No. 2, Medan'],
  ['PT Inalum Kuala Tanjung', 'Kuala Tanjung, Batu Bara'],
  ['Rumah Sakit Umum Haji Medan', 'Jl. Rumah Sakit Haji No. 1, Medan'],
  ['Kantor Wilayah Kementerian Agama Sumatera Utara', 'Jl. Imam Bonjol No. 15, Medan'],
  ['PT Perkebunan Nusantara III', 'Jl. Sei Batang Hari No. 2, Medan'],
  ['UPT Teknologi Informasi dan Komunikasi UNIMED', 'Kampus UNIMED, Medan'],
  ['CV Kreatif Digital Nusantara', 'Jl. Setia Budi No. 88, Medan'],
  ['PT Sinar Mas Agro Resources', 'Jl. Raya Medan-Tanjung Morawa, Deli Serdang'],
  ['Yayasan Pendidikan Nurul Ilmi', 'Jl. Gatot Subroto No. 120, Medan'],
  ['PT Bank Mandiri Regional Medan', 'Jl. Diponegoro No. 12, Medan'],
  ['Balai Bahasa Provinsi Sumatera Utara', 'Jl. Kolam No. 3, Medan'],
];

const DEMO_JUDUL_MINIRISET = [
  'Analisis Pemanfaatan E-Learning pada Pembelajaran Daring di SMA Negeri 1 Medan',
  'Perancangan Sistem Informasi Administrasi Surat Menyurat Berbasis Web',
  'Pengaruh Literasi Digital terhadap Hasil Belajar Mahasiswa UNIMED',
  'Evaluasi Kualitas Layanan Akademik di Fakultas Teknik UNIMED',
  'Strategi Pemasaran Digital UMKM Kuliner di Kota Medan',
  'Analisis Kepuasan Mahasiswa terhadap Layanan Perpustakaan UNIMED',
  'Rancang Bangun Media Pembelajaran Interaktif Berbasis Android',
  'Penerapan Sistem Informasi Geografis untuk Pemetaan Sekolah di Kota Medan',
  'Analisis Pengelolaan Keuangan Badan Usaha Milik Desa',
  'Pengaruh Motivasi Kerja terhadap Kinerja Pegawai Dinas Pendidikan',
  'Perancangan Aplikasi Pengelolaan Inventaris Laboratorium Komputer',
  'Analisis Kesiapan Digitalisasi Arsip pada Kantor Wilayah Kementerian Agama',
  'Evaluasi Program Magang Bersertifikat di Politeknik Negeri Medan',
  'Pemanfaatan Media Sosial sebagai Sarana Promosi Kampus',
];

const DEMO_POSISI_MAGANG = [
  'Magang Bidang Aplikasi Informatika',
  'Staf Administrasi Akademik',
  'Data Analyst Intern',
  'Magang Bidang Humas dan Protokoler',
  'Asisten Pengelolaan Arsip Digital',
  'Magang Bidang Keuangan',
  'Web Developer Intern',
  'Magang Bidang Layanan Pelanggan',
  'Asisten Penelitian dan Pengembangan',
  'Magang Bidang Desain Komunikasi Visual',
  'Staf Pendukung Operasional',
  'Magang Bidang Sistem Informasi',
];

const DEMO_MAGANG_START = [-18, -9, -2, 0, 1, 3, 5, 7, 12, 18, 24, 30];

const DEMO_BAP = [
  {
    judul: 'Berita Acara Rapat Koordinasi Pengurus PEDOS',
    tanggal: -1,
    waktu: '09:00',
    lokasi: 'Sekretariat PEDOS',
    p1: 'Nabila Syafira',
    j1: 'Ketua PEDOS',
    p2: 'Ahmad Fauzan',
    j2: 'Sekretaris PEDOS',
    uraian:
      'Rapat membahas persiapan program kerja bulan ini, pembagian tugas divisi, serta kebutuhan administrasi sekretariat.',
    hasil:
      'Disepakati bahwa setiap divisi menyerahkan rencana kegiatan paling lambat Jumat pekan ini dan sekretariat menyiapkan format laporan terbaru.',
    catatan: '',
  },
  {
    judul: 'Berita Acara Serah Terima Dokumen Miniriset',
    tanggal: -3,
    waktu: '10:30',
    lokasi: 'Ruang Akademik Fakultas Teknik',
    p1: 'Siti Sarah Nasution',
    j1: 'Koordinator Miniriset',
    p2: 'Beni Hutapea',
    j2: 'Staf Administrasi',
    uraian:
      'Penyerahan berkas permohonan miniriset mahasiswa yang telah diperiksa kelengkapan dan kesesuaian formatnya.',
    hasil: 'Sebanyak empat belas berkas dinyatakan lengkap dan siap diteruskan kepada instansi tujuan.',
    catatan: 'Dua berkas menyusul karena menunggu tanda tangan dosen pembimbing.',
  },
  {
    judul: 'Berita Acara Validasi Data Mahasiswa Magang',
    tanggal: -6,
    waktu: '13:00',
    lokasi: 'Ruang Rapat Program Studi',
    p1: 'Kevin Simanjuntak',
    j1: 'Koordinator Magang KKU',
    p2: 'Putri Wulandari',
    j2: 'Operator Data',
    uraian:
      'Validasi data mahasiswa peserta magang KKU meliputi nama, NIM, program studi, instansi tujuan, dan periode kegiatan.',
    hasil: 'Data peserta telah sesuai dengan berkas pendaftaran dan siap diunggah ke sistem administrasi.',
    catatan: '',
  },
  {
    judul: 'Berita Acara Rapat Evaluasi Kegiatan',
    tanggal: -9,
    waktu: '14:00',
    lokasi: 'Sekretariat PEDOS',
    p1: 'Rian Saputra',
    j1: 'Wakil Ketua PEDOS',
    p2: 'Melati Sinaga',
    j2: 'Koordinator Acara',
    uraian:
      'Evaluasi pelaksanaan seminar nasional mencakup jumlah peserta, ketepatan waktu, dan kendala teknis selama kegiatan.',
    hasil: 'Kegiatan dinilai berjalan baik. Diperlukan perbaikan pada koordinasi sound system dan registrasi peserta.',
    catatan: 'Notulen lengkap tersimpan di arsip sekretariat.',
  },
  {
    judul: 'Berita Acara Audit Internal Administrasi',
    tanggal: -13,
    waktu: '09:00',
    lokasi: 'Ruang Rapat Fakultas Teknik',
    p1: 'Andi Pratama',
    j1: 'Ketua Divisi Administrasi',
    p2: 'Christina Sitorus',
    j2: 'Auditor Internal',
    uraian:
      'Pemeriksaan kelengkapan arsip surat masuk, surat keluar, kuitansi, dan laporan kegiatan tiga bulan terakhir.',
    hasil: 'Arsip dinyatakan tertata. Ditemukan empat kuitansi tanpa lampiran bukti pembayaran dan telah diminta untuk dilengkapi.',
    catatan: '',
  },
  {
    judul: 'Berita Acara Serah Terima Inventaris Sekretariat',
    tanggal: -17,
    waktu: '11:00',
    lokasi: 'Sekretariat PEDOS',
    p1: 'Intan Permata Sari',
    j1: 'Bendahara PEDOS',
    p2: 'Dhani Harahap',
    j2: 'Pengurus Barang',
    uraian:
      'Serah terima inventaris berupa printer, proyektor, laptop, sound system, dan perlengkapan administrasi lainnya.',
    hasil: 'Seluruh barang diterima dalam kondisi baik. Daftar inventaris ditandatangani oleh kedua pihak.',
    catatan: '',
  },
  {
    judul: 'Berita Acara Rapat Koordinasi Divisi Acara',
    tanggal: -20,
    waktu: '15:00',
    lokasi: 'Ruang B.03 Fakultas Teknik',
    p1: 'Yuniarti Nasution',
    j1: 'Koordinator Divisi Acara',
    p2: 'David Situmorang',
    j2: 'Koordinator Logistik',
    uraian:
      'Pembahasan rundown kegiatan, kebutuhan logistik, serta pembagian penanggung jawab setiap sesi acara.',
    hasil: 'Rundown disetujui dengan penyesuaian waktu istirahat dan penambahan satu petugas registrasi.',
    catatan: '',
  },
  {
    judul: 'Berita Acara Pelatihan Administrasi Surat Menyurat',
    tanggal: -24,
    waktu: '08:30',
    lokasi: 'Lab Komputer Fakultas Teknik',
    p1: 'Hafizh Lubis',
    j1: 'Pemateri',
    p2: 'Almira Siregar',
    j2: 'Peserta',
    uraian:
      'Pelatihan penggunaan format surat resmi, penomoran dokumen, pengarsipan digital, dan alur tanda tangan.',
    hasil: 'Peserta memahami alur administrasi baru dan menandatangani daftar hadir pelatihan.',
    catatan: '',
  },
  {
    judul: 'Berita Acara Penyerahan Hadiah Lomba',
    tanggal: -28,
    waktu: '10:00',
    lokasi: 'Aula Utama UNIMED',
    p1: 'Fajar Maulana',
    j1: 'Ketua Panitia Lomba',
    p2: 'Sarah Sihombing',
    j2: 'Perwakilan Pemenang',
    uraian:
      'Penyerahan hadiah kepada pemenang lomba desain poster dan lomba karya tulis ilmiah tingkat fakultas.',
    hasil: 'Hadiah telah diterima langsung oleh perwakilan pemenang dan didokumentasikan oleh tim media.',
    catatan: '',
  },
];

const DEMO_TURNITIN = [
  { dokumen: 'Pengaruh Literasi Digital terhadap Hasil Belajar Mahasiswa', jenis: 'Skripsi', sim: 12, batas: 25, status: 'Selesai' },
  { dokumen: 'Pengembangan Media Pembelajaran Interaktif Berbasis Android', jenis: 'Skripsi', sim: 18, batas: 25, status: 'Selesai' },
  { dokumen: 'Sistem Informasi Administrasi Surat Menyurat', jenis: 'Proposal', sim: 9, batas: 25, status: 'Selesai' },
  { dokumen: 'Analisis Kepuasan Mahasiswa terhadap Layanan Akademik', jenis: 'Skripsi', sim: 22, batas: 30, status: 'Selesai' },
  { dokumen: 'Strategi Pemasaran Digital UMKM Kuliner Medan', jenis: 'Jurnal', sim: 31, batas: 25, status: 'Perlu Revisi' },
  { dokumen: 'Evaluasi Program Magang Bersertifikat', jenis: 'Laporan', sim: 14, batas: 25, status: 'Selesai' },
  { dokumen: 'Perancangan Aplikasi Inventaris Laboratorium', jenis: 'Proposal', sim: 8, batas: 25, status: 'Selesai' },
  { dokumen: 'Pemanfaatan E-Learning pada Pembelajaran Daring', jenis: 'Makalah', sim: 19, batas: 25, status: 'Menunggu' },
  { dokumen: 'Analisis Pengelolaan Keuangan Desa', jenis: 'Skripsi', sim: 24, batas: 25, status: 'Selesai' },
  { dokumen: 'Pemetaan Sekolah Berbasis Sistem Informasi Geografis', jenis: 'Jurnal', sim: 28, batas: 25, status: 'Perlu Revisi' },
  { dokumen: 'Pengaruh Motivasi Kerja terhadap Kinerja Pegawai', jenis: 'Skripsi', sim: 11, batas: 25, status: 'Selesai' },
  { dokumen: 'Digitalisasi Arsip di Kantor Pemerintahan', jenis: 'Laporan', sim: 16, batas: 25, status: 'Selesai' },
  { dokumen: 'Rancang Bangun Portal Berita Sekolah', jenis: 'Proposal', sim: 7, batas: 25, status: 'Selesai' },
  { dokumen: 'Analisis Sentimen Media Sosial terhadap Layanan Kampus', jenis: 'Jurnal', sim: 21, batas: 25, status: 'Menunggu' },
  { dokumen: 'Pengembangan Sistem Presensi Mahasiswa Berbasis QR Code', jenis: 'Skripsi', sim: 13, batas: 25, status: 'Selesai' },
  { dokumen: 'Evaluasi Kualitas Website Universitas', jenis: 'Makalah', sim: 33, batas: 30, status: 'Perlu Revisi' },
  { dokumen: 'Penerapan Internet of Things pada Smart Campus', jenis: 'Proposal', sim: 10, batas: 25, status: 'Selesai' },
  { dokumen: 'Perancangan Media Promosi Digital', jenis: 'Laporan', sim: 17, batas: 25, status: 'Selesai' },
  { dokumen: 'Analisis Kebutuhan Sistem Informasi Akademik', jenis: 'Jurnal', sim: 26, batas: 25, status: 'Perlu Revisi' },
  { dokumen: 'Pengaruh Budaya Organisasi terhadap Kinerja Tim', jenis: 'Skripsi', sim: 15, batas: 25, status: 'Selesai' },
];

const DEMO_PEDOS = [
  ['Rapat Koordinasi Pengurus PEDOS', 0, '08:30', '11:00', 'Sekretariat PEDOS', 'Nabila Syafira', 'Terjadwal', 'Membahas persiapan program kerja bulan ini.'],
  ['Pelatihan Administrasi Surat Menyurat', 1, '13:00', '15:30', 'Ruang B.03 Fakultas Teknik', 'Ahmad Fauzan', 'Terjadwal', 'Wajib diikuti pengurus divisi administrasi.'],
  ['Verifikasi Berkas Miniriset Mahasiswa', 2, '09:00', '12:00', 'Ruang Akademik FIP', 'Siti Sarah Nasution', 'Terjadwal', 'Membawa berkas asli dan salinan.'],
  ['Workshop Turnitin dan Etika Akademik', 3, '08:00', '12:00', 'Aula Fakultas Teknik', 'Dr. Muhammad Rizki, M.Kom.', 'Terjadwal', 'Peserta membawa laptop masing-masing.'],
  ['Pendampingan KKU Magang', 5, '10:00', '12:00', 'Ruang Rapat Program Studi', 'Kevin Simanjuntak', 'Terjadwal', 'Pendampingan bagi mahasiswa yang akan memulai magang.'],
  ['Rapat Evaluasi Bulanan PEDOS', 7, '14:00', '16:00', 'Sekretariat PEDOS', 'Putri Wulandari', 'Terjadwal', 'Setiap divisi menyampaikan laporan singkat.'],
  ['Rapat Persiapan Wisuda', 9, '09:00', '11:00', 'Sekretariat PEDOS', 'David Situmorang', 'Terjadwal', 'Membahas pembagian tugas panitia wisuda.'],
  ['Sosialisasi Program Kerja', 12, '09:00', '11:30', 'Aula Utama UNIMED', 'Rian Saputra', 'Terjadwal', 'Terbuka untuk seluruh mahasiswa.'],
  ['Pelatihan Public Speaking', 18, '13:00', '16:00', 'Ruang Seminar FBS', 'Melati Sinaga', 'Terjadwal', 'Kuota peserta terbatas sepuluh orang.'],
  ['Bakti Sosial PEDOS', 25, '07:00', '12:00', 'Desa Suka Maju, Deli Serdang', 'Andi Pratama', 'Terjadwal', 'Titik kumpul di gerbang kampus pukul 06.30.'],
  ['Opening PEDOS 2026', -30, '08:00', '11:00', 'Aula Utama UNIMED', 'Nabila Syafira', 'Selesai', 'Kegiatan pembukaan program kerja PEDOS.'],
  ['Seminar Nasional Teknologi Pendidikan', -22, '09:00', '15:00', 'Aula Fakultas Teknik', 'Dr. Muhammad Rizki, M.Kom.', 'Selesai', 'Seminar diikuti 180 peserta.'],
  ['Rapat Panitia Wisuda', -15, '10:00', '12:00', 'Ruang Rapat Rektorat', 'Ahmad Fauzan', 'Selesai', 'Koordinasi teknis acara wisuda.'],
  ['Pelatihan Desain Grafis', -10, '13:00', '16:00', 'Lab Komputer FIP', 'Christina Sitorus', 'Selesai', 'Pelatihan dasar desain untuk tim media.'],
  ['Audiensi dengan Wakil Dekan', -7, '09:30', '11:00', 'Ruang Wakil Dekan III', 'Hafizh Lubis', 'Selesai', 'Membahas dukungan sarana kegiatan mahasiswa.'],
  ['Kerja Bakti Sekretariat', -5, '08:00', '10:30', 'Sekretariat PEDOS', 'Intan Permata Sari', 'Selesai', 'Pembersihan dan penataan ulang ruang sekretariat.'],
  ['Rapat Koordinasi Divisi', -3, '14:00', '15:00', 'Ruang Rapat Program Studi', 'Dhani Harahap', 'Dibatalkan', 'Ditunda karena benturan jadwal.'],
  ['Kelas Kepenulisan Ilmiah', -1, '15:30', '17:00', 'Ruang B.03 Fakultas Teknik', 'Yuniarti Nasution', 'Selesai', 'Materi sitasi dan penyusunan daftar pustaka.'],
];

const DEMO_ABSENSI_EVENTS = [
  ['Rapat Koordinasi Pengurus PEDOS', 0, 'Sekretariat PEDOS'],
  ['Pelatihan Administrasi Surat Menyurat', -2, 'Ruang B.03 Fakultas Teknik'],
  ['Verifikasi Berkas Miniriset Mahasiswa', -5, 'Ruang Akademik FIP'],
  ['Workshop Turnitin dan Etika Akademik', -9, 'Aula Fakultas Teknik'],
  ['Seminar Nasional Teknologi Pendidikan', -14, 'Aula Fakultas Teknik'],
  ['Rapat Evaluasi Bulanan PEDOS', -21, 'Sekretariat PEDOS'],
  ['Opening PEDOS 2026', -30, 'Aula Utama UNIMED'],
];

const DEMO_KUITANSI = [
  ['Ahmad Fauzan', 'Pendaftaran Seminar Nasional', 'Kegiatan', 150000, 'Tunai', 'Bendahara PEDOS'],
  ['Siti Sarah Nasution', 'Pembayaran Administrasi Miniriset', 'Administrasi', 50000, 'Transfer', 'Bendahara PEDOS'],
  ['Panitia PEDOS', 'Sewa Sound System Aula', 'Kegiatan', 750000, 'Transfer', 'Bendahara PEDOS'],
  ['Muhammad Rizky Lubis', 'Pembelian ATK Sekretariat', 'Operasional', 235000, 'Tunai', 'Pengurus Barang'],
  ['Dinda Ayu Lestari', 'Iuran Kegiatan Mahasiswa', 'Kegiatan', 100000, 'E-Wallet', 'Bendahara PEDOS'],
  ['Bank Sumut', 'Biaya Administrasi Rekening', 'Administrasi', 15000, 'Transfer', 'Bendahara PEDOS'],
  ['Josua Simbolon', 'Pembayaran Praktikum', 'Pendidikan', 350000, 'Transfer', 'Bendahara Fakultas'],
  ['Nurul Hidayah', 'Cetak Modul Pelatihan', 'Pendidikan', 180000, 'Tunai', 'Sekretaris PEDOS'],
  ['Kevin Simanjuntak', 'Konsumsi Rapat Koordinasi', 'Kegiatan', 320000, 'Tunai', 'Bendahara PEDOS'],
  ['Putri Wulandari', 'Pembayaran Sewa Gedung', 'Kegiatan', 1250000, 'Transfer', 'Bendahara PEDOS'],
  ['Rian Saputra', 'Pembelian Tinta Printer', 'Operasional', 275000, 'E-Wallet', 'Pengurus Barang'],
  ['Melati Sinaga', 'Pendaftaran Workshop', 'Pendidikan', 125000, 'Transfer', 'Bendahara PEDOS'],
  ['Andi Pratama', 'Penggandaan Berkas Miniriset', 'Administrasi', 65000, 'Tunai', 'Sekretaris PEDOS'],
  ['Christina Sitorus', 'Honor Pembicara', 'Kegiatan', 1500000, 'Transfer', 'Bendahara PEDOS'],
  ['Hafizh Lubis', 'Pembayaran Listrik Sekretariat', 'Operasional', 210000, 'E-Wallet', 'Bendahara PEDOS'],
  ['Intan Permata Sari', 'Pembelian Hadiah Lomba', 'Kegiatan', 450000, 'Tunai', 'Bendahara PEDOS'],
  ['Dhani Harahap', 'Iuran Wisuda', 'Pendidikan', 500000, 'Transfer', 'Bendahara Fakultas'],
  ['Yuniarti Nasution', 'Konsumsi Pelatihan', 'Kegiatan', 375000, 'Tunai', 'Bendahara PEDOS'],
  ['David Situmorang', 'Pembelian Masker dan Sanitizer', 'Operasional', 95000, 'E-Wallet', 'Pengurus Barang'],
  ['Rizky Ramadhan', 'Pendaftaran Ujian Komprehensif', 'Pendidikan', 200000, 'Transfer', 'Bendahara Fakultas'],
];

const DEMO_PENGINGAT = [
  ['Cetak ulang surat miniriset Ahmad Fauzan', 0, 0],
  ['Konfirmasi kehadiran pembicara workshop', 1, 0],
  ['Tempel tanda tangan BAP rapat koordinasi', 2, 0],
  ['Kirim berkas magang ke PT Telkom', -1, 0],
  ['Rapikan arsip kuitansi bulan lalu', 4, 0],
  ['Backup data Student Desk', null, 1],
];

/* --- Helper tanggal & baris contoh --- */
const demoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const demoStamp = (daysAgo = 0, hour = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const demoNo = (n, prefix = 'SD') => {
  const d = new Date();
  return `${String(n).padStart(3, '0')}/${prefix}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

/** Bungkus satu baris dengan metadata agar bisa dihapus tanpa menyentuh data asli. */
const demoRow = (m, i, fields, daysAgo = 0) => ({
  ...fields,
  id: `demo-${m}-${String(i + 1).padStart(3, '0')}`,
  demo: 1,
  created: demoStamp(daysAgo, 8 + (i % 7), (i * 7) % 60),
  upd: demoStamp(Math.max(0, daysAgo - (i % 4)), 14 + (i % 5), (i * 11) % 60),
});

const demoModules = () => [...Object.keys(M), 'pengingat'];

/** Bangun seluruh data contoh secara dinamis mengikuti tanggal hari ini. */
function buildDemoData() {
  const student = (i) => DEMO_STUDENTS[i % DEMO_STUDENTS.length];
  const instansi = (i) => DEMO_INSTANSI[i % DEMO_INSTANSI.length];

  const miniriset = Array.from({ length: 14 }, (_, i) => {
    const [nama, nim, prodi, fakultas] = student(i * 3 + 1);
    const [inst, alamat] = instansi(i);
    return demoRow(
      'miniriset',
      i,
      {
        nomor: demoNo(i + 1),
        nama,
        nim,
        prodi,
        fakultas,
        instansi: inst,
        alamat,
        judul: DEMO_JUDUL_MINIRISET[i],
        tanggal: demoDay(-28 + i * 2),
        penandatangan: DEMO_SETTINGS.ttd,
        jabatan: DEMO_SETTINGS.jabatan,
        isi: TPL_MINIRISET,
        catatan: i % 5 === 0 ? 'Mohon konfirmasi jadwal pengambilan data sebelum kegiatan.' : '',
      },
      (i * 3) % 14,
    );
  });

  const magang = DEMO_MAGANG_START.map((start, i) => {
    const [nama, nim, prodi, fakultas] = student(i * 2 + 2);
    const [inst, alamat] = instansi(i + 3);
    return demoRow(
      'magang',
      i,
      {
        nomor: demoNo(15 + i),
        nama,
        nim,
        prodi,
        fakultas,
        instansi: inst,
        alamat,
        posisi: DEMO_POSISI_MAGANG[i],
        tglMulai: demoDay(start),
        tglSelesai: demoDay(start + 60 + (i % 3) * 15),
        tanggal: demoDay(Math.min(-1, start - 10)),
        penandatangan: DEMO_SETTINGS.ttd,
        jabatan: DEMO_SETTINGS.jabatan,
        isi: TPL_MAGANG,
      },
      (i * 2) % 12,
    );
  });

  const bap = DEMO_BAP.map((b, i) =>
    demoRow(
      'bap',
      i,
      {
        nomor: demoNo(27 + i),
        judul: b.judul,
        tanggal: demoDay(b.tanggal),
        waktu: b.waktu,
        lokasi: b.lokasi,
        p1: b.p1,
        j1: b.j1,
        p2: b.p2,
        j2: b.j2,
        uraian: b.uraian,
        hasil: b.hasil,
        penandatangan: DEMO_SETTINGS.ttd,
        jabatan: DEMO_SETTINGS.jabatan,
        catatan: b.catatan,
      },
      (i * 3) % 14,
    ),
  );

  const turnitin = DEMO_TURNITIN.map((t, i) => {
    const [nama, nim] = student(i * 2 + 4);
    return demoRow(
      'turnitin',
      i,
      {
        nama,
        nim,
        dokumen: t.dokumen,
        jenis: t.jenis,
        tanggal: demoDay(-24 + i),
        sim: t.sim,
        batas: t.batas,
        status: t.status,
        ref: `Turnitin/2026/${String(i + 1).padStart(3, '0')}`,
        catatan:
          t.status === 'Perlu Revisi'
            ? 'Perlu perbaikan pada bab tinjauan pustaka dan penulisan sitasi.'
            : t.status === 'Menunggu'
              ? 'Masih menunggu jadwal pengecekan ulang.'
              : '',
      },
      (i * 2) % 14,
    );
  });

  const pedos = DEMO_PEDOS.map((p, i) =>
    demoRow(
      'pedos',
      i,
      {
        kegiatan: p[0],
        tanggal: demoDay(p[1]),
        mulai: p[2],
        selesai: p[3],
        lokasi: p[4],
        pj: p[5],
        status: p[6],
        ket: p[7],
      },
      Math.min(13, Math.abs(p[1]) + 1),
    ),
  );

  const absensi = [];
  let absIndex = 0;
  DEMO_ABSENSI_EVENTS.forEach((ev, ei) => {
    for (let p = 0; p < 10; p++) {
      const [nama, nim] = student(ei * 4 + p);
      let status = 'Hadir';
      if (p === 7) status = 'Izin';
      else if (p === 8) status = ei % 2 ? 'Sakit' : 'Izin';
      else if (p === 9 && ei % 3 === 0) status = 'Tidak Hadir';

      absensi.push(
        demoRow(
          'absensi',
          absIndex++,
          {
            kegiatan: ev[0],
            tanggal: demoDay(ev[1]),
            lokasi: ev[2],
            nama,
            nim,
            status,
            catatan:
              status === 'Izin'
                ? 'Surat izin sudah diterima'
                : status === 'Sakit'
                  ? 'Ada surat keterangan dokter'
                  : status === 'Tidak Hadir'
                    ? 'Belum ada konfirmasi'
                    : '',
          },
          (ei * 2 + p) % 14,
        ),
      );
    }
  });

  const kuitansi = DEMO_KUITANSI.map((k, i) =>
    demoRow(
      'kuitansi',
      i,
      {
        nomor: `KW/${String(i + 1).padStart(3, '0')}/SD/${new Date().getFullYear()}`,
        tanggal: demoDay(-30 + i + (i % 2)),
        pembayar: k[0],
        ket: k[1],
        kategori: k[2],
        jumlah: k[3],
        metode: k[4],
        penerima: k[5],
        catatan: i % 6 === 0 ? 'Bukti pembayaran terlampir.' : '',
      },
      (i * 2) % 14,
    ),
  );

  const pengingat = DEMO_PENGINGAT.map(([teks, offset, done], i) =>
    demoRow(
      'pengingat',
      i,
      {
        teks,
        tanggal: offset === null ? '' : demoDay(offset),
        done,
      },
      (i * 2) % 9,
    ),
  );

  return { miniriset, magang, bap, turnitin, pedos, absensi, kuitansi, pengingat };
}

/** Jumlah baris contoh yang saat ini tersimpan. */
function demoCount(data = DB.load()) {
  return demoModules().reduce(
    (total, m) => total + (Array.isArray(data[m]) ? data[m].filter((r) => r.demo).length : 0),
    0,
  );
}

/** Ganti seluruh data contoh lama dengan data contoh baru. Data pengguna tidak disentuh. */
function seedDemoData() {
  const data = DB.load();
  demoModules().forEach((m) => {
    if (Array.isArray(data[m])) data[m] = data[m].filter((r) => !r.demo);
  });

  Object.entries(buildDemoData()).forEach(([m, rows]) => {
    data[m] = [...(data[m] || []), ...rows];
  });

  const settings = { ...(data.settings || {}) };
  const demoSettingKeys = new Set(Array.isArray(data.demoSettings) ? data.demoSettings : []);
  Object.entries(DEMO_SETTINGS).forEach(([key, value]) => {
    if (settings[key] == null || settings[key] === '') {
      settings[key] = value;
      demoSettingKeys.add(key);
    }
  });
  data.settings = settings;
  data.demoSettings = [...demoSettingKeys];

  data.cleaned = 1;
  data.demoSeeded = 1;
  data.demoVersion = DEMO_VERSION;
  return DB.save(data);
}

/** Isi otomatis satu kali saat versi ini pertama kali dibuka. */
function seedDemoIfNeeded() {
  if (DB.load().demoSeeded) return;
  seedDemoData();
}

/** Hapus hanya baris yang bertanda demo. Mengembalikan jumlah baris yang dihapus. */
function clearDemoData() {
  const data = DB.load();
  let removed = 0;

  demoModules().forEach((m) => {
    if (!Array.isArray(data[m])) return;
    const before = data[m].length;
    data[m] = data[m].filter((r) => !r.demo);
    removed += before - data[m].length;
  });

  // Hapus juga isi pengaturan yang masih sama dengan nilai contoh dan belum
  // pernah diubah pengguna.
  const settings = { ...(data.settings || {}) };
  const demoSettingKeys = Array.isArray(data.demoSettings) ? data.demoSettings : [];
  demoSettingKeys.forEach((key) => {
    if (settings[key] === DEMO_SETTINGS[key]) delete settings[key];
  });
  if (Object.keys(settings).length) data.settings = settings;
  else delete data.settings;
  delete data.demoSettings;

  data.demoSeeded = 1;
  data.demoVersion = DEMO_VERSION;
  data.cleaned = 1;
  return DB.save(data) ? removed : -1;
}

/* ==========================================================================
   06. APLIKASI
   ========================================================================== */

/* ==========================================================================
   05b. BERSIHKAN DATA CONTOH LAMA
   Versi sebelumnya pernah mengisi data dummy otomatis. Data lama itu dibuang
   sekali saat pembaruan; data contoh baru dimuat dari bagian 05a. Data
   buatan sendiri tidak disentuh.
   ========================================================================== */
function cleanLegacyDemo() {
  const data = DB.load();
  if (!Object.keys(data).length || data.cleaned) return;

  Object.keys(M).forEach((m) => {
    if (Array.isArray(data[m])) data[m] = data[m].filter((r) => !r.demo);
  });
  if (data.settings && data.settings.inst === 'Universitas Contoh Nusantara') delete data.settings;
  data.cleaned = 1;
  DB.save(data);
}

/* Data lama menyimpan jam sebagai "09.00"; input jam butuh "09:00". Idempotent. */
function migrateTimes() {
  const data = DB.load();
  let changed = false;
  Object.keys(M).forEach((m) => {
    if (!Array.isArray(data[m])) return;
    const timeKeys = M[m].f.filter((f) => f[2] === 'time').map((f) => f[0]);
    data[m].forEach((r) =>
      timeKeys.forEach((k) => {
        const fixed = normTime(r[k]);
        if (fixed !== r[k]) {
          r[k] = fixed;
          changed = true;
        }
      }),
    );
  });
  if (changed) DB.save(data);
}

/* Foto & peran di header (nilai foto hanya diterima bila berupa data gambar) */
function applyAva() {
  const s = S();
  const a = $('#ava');
  const photo = typeof s.foto === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[\w+/=]+$/.test(s.foto) ? s.foto : '';
  if (a) {
    a.style.backgroundImage = photo ? `url("${photo}")` : '';
    a.style.color = photo ? 'transparent' : '';
  }
  const sm = $('.me small');
  if (sm) sm.textContent = s.peran || 'Pelajar';
}

/* Item menu: [judul grup] atau [rute, label, ikon] */
const NAV = [
  ['Utama'],
  ['dash', 'Dashboard', 'layout-dashboard'],
  ['Surat'],
  ...['miniriset', 'magang', 'bap'].map((k) => [k, M[k].label, M[k].icon]),
  ['Kegiatan'],
  ...['pedos', 'absensi'].map((k) => [k, M[k].label, M[k].icon]),
  ['Catatan'],
  ...['turnitin', 'kuitansi'].map((k) => [k, M[k].label, M[k].icon]),
  ['Lainnya'],
  ['riwayat', 'Riwayat Dokumen', 'history'],
  ['settings', 'Pengaturan', 'settings'],
];

const TITLES = { dash: 'Dashboard', riwayat: 'Riwayat Dokumen', settings: 'Pengaturan' };
const PAGES = { dash, riwayat, settings };

$('#nav').innerHTML = NAV.map(([route, label, icon]) =>
  label === undefined
    ? `<h6>${route}</h6>`
    : `<a href="#${route}" data-r="${route}" title="${label}" style="${LOOK[route] ? tint(route) : '--c:#3b82f6;--cs:#3b82f61f'}"><i data-lucide="${icon}"></i><span>${label}</span><em class="cnt" data-cnt="${route}"></em></a>`,
).join('');

const closeSidebar = () => {
  $('#side').classList.remove('open');
  $('#shade').classList.remove('open');
};

/** Isi bagian header & sidebar yang bergantung pada data: badge, penyimpanan, popover. */
function chrome() {
  closePops();

  document.querySelectorAll('#nav [data-cnt]').forEach((el) => {
    const r = el.dataset.cnt;
    const n = r === 'riwayat' ? allDocs().length : r in M ? DB.list(r).length : 0;
    el.textContent = n || '';
  });

  let bytes = 0;
  try {
    bytes = new Blob([localStorage.getItem(DB.key) || '']).size;
  } catch {
    /* abaikan */
  }
  $('#store').innerHTML = `
    <div><span>Penyimpanan lokal</span><b>${(bytes / 1024).toFixed(1)} KB</b></div>
    <div class="meter"><i style="--w:${Math.max(4, Math.min(100, bytes / 5e4))}%"></i></div>
    <small>Tersimpan di browser ini (batas ±5 MB)</small>`;

  const up = DB.list('pedos')
    .filter((r) => r.status === 'Terjadwal' && r.tanggal >= today())
    .sort((x, y) => (x.tanggal + x.mulai).localeCompare(y.tanggal + y.mulai))
    .slice(0, 4);
  $('#popBell').innerHTML = `
    <h4>Jadwal mendatang</h4>
    ${
      up.length
        ? up
            .map(
              (r) =>
                `<a href="#pedos"><b>${esc(r.kegiatan)}</b><small>${esc(tgl(r.tanggal))} · ${esc(r.mulai)}${r.lokasi ? ' · ' + esc(r.lokasi) : ''}</small></a>`,
            )
            .join('')
        : '<p class="muted">Tidak ada jadwal mendatang.</p>'
    }
    <a class="all" href="#pedos">Lihat semua jadwal →</a>`;

  $('#popNew').innerHTML = Object.keys(M)
    .map(
      (m) => `<button type="button" data-q="${m}"><i data-lucide="${M[m].icon}"></i>${M[m].label}</button>`,
    )
    .join('');

  const name = S().user || 'Pelajar';
  $('#popMe').innerHTML = `
    <div class="who"><b>${esc(name)}</b><small>${esc(S().inst || 'Student Desk')}</small></div>
    <a href="#settings"><i data-lucide="settings"></i>Pengaturan</a>
    <a href="#riwayat"><i data-lucide="history"></i>Riwayat dokumen</a>
    <button type="button" data-act="backup"><i data-lucide="download"></i>Ekspor cadangan</button>`;
}

let pendingForm = null;
const quickAdd = (m) => {
  pendingForm = m;
  if (location.hash === '#' + m) go();
  else location.hash = m;
};

/** Hitung naik angka statistik (dilewati bila pengguna mengurangi animasi). */
function countUp() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.stat b, .ring b').forEach((el) => {
    const end = parseInt(el.textContent, 10);
    if (!end) return;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 700);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Render halaman sesuai hash di URL. */
function go() {
  let route = location.hash.slice(1);
  const has = (o) => Object.prototype.hasOwnProperty.call(o, route);
  if (!route || !(has(M) || has(TITLES))) route = 'dash';

  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === route));
  $('#ttl').textContent = TITLES[route] || M[route].label;
  $('#today').textContent = tgl(today());

  // Titik merah pada lonceng bila ada jadwal mendatang
  $('#bell b').hidden = !DB.list('pedos').some((r) => r.status === 'Terjadwal' && r.tanggal >= today());

  const name = S().user || 'Pelajar';
  $('#uname').textContent = name;
  $('#ava').textContent = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  applyAva();
  $('#view').onclick = null;
  chrome();

  (PAGES[route] || (() => listView(route)))();

  icons();
  countUp();
  closeSidebar();
  window.scrollTo(0, 0);
  if (pendingForm) {
    const m = pendingForm;
    pendingForm = null;
    openForm(m);
  }
}

$('#burger').onclick = () => {
  $('#side').classList.toggle('open');
  $('#shade').classList.toggle('open');
};
$('#shade').onclick = closeSidebar;

/* Popover lonceng & akun */
const pops = [
  ['bell', 'popBell'],
  ['me', 'popMe'],
  ['newBtn', 'popNew'],
];
function closePops() {
  pops.forEach(([b, p]) => {
    $('#' + p).hidden = true;
    $('#' + b).setAttribute('aria-expanded', 'false');
  });
}
pops.forEach(([b, p]) => {
  $('#' + b).onclick = (e) => {
    e.stopPropagation();
    const willOpen = $('#' + p).hidden;
    closePops();
    if (!willOpen) return;
    $('#' + p).hidden = false;
    $('#' + b).setAttribute('aria-expanded', 'true');
    icons();
  };
});
document.addEventListener('click', (e) => {
  if (e.target.closest('.pop a, .pop button')) {
    if (e.target.closest('[data-act="backup"]')) downloadBackup();
    closePops();
  } else if (!e.target.closest('.dd')) {
    closePops();
  }
});
document.addEventListener('click', (e) => {
  const q = e.target.closest('.pop [data-q]');
  if (!q) return;
  quickAdd(q.dataset.q);
  closeSidebar();
});

/* Ciutkan / lebarkan sidebar (desktop), diingat di browser */
const setMini = (on) => {
  document.body.classList.toggle('mini', on);
  const label = on ? 'Lebarkan sidebar' : 'Ciutkan sidebar';
  $('#collapse').setAttribute('aria-label', label);
  $('#collapse').title = label;
};
try {
  setMini(localStorage.getItem('sd_mini') === '1');
} catch {
  /* abaikan */
}
$('#collapse').onclick = () => {
  const on = !document.body.classList.contains('mini');
  setMini(on);
  try {
    localStorage.setItem('sd_mini', on ? '1' : '0');
  } catch {
    /* abaikan */
  }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePops();
  const el = document.activeElement;
  const typing = /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable;
  if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && $('#modal').hidden && $('#cmd')?.hidden !== false) {
    e.preventDefault();
    $('#gs').focus();
  }
});

// Kolom cari di header: Enter = cari di Riwayat Dokumen
$('#gs').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  globalQ = e.target.value;
  e.target.value = '';
  location.hash === '#riwayat' ? go() : (location.hash = 'riwayat');
});

window.addEventListener('hashchange', go);
window.addEventListener('load', icons); // ulang setelah library ikon siap
cleanLegacyDemo();
seedDemoIfNeeded();
migrateTimes();
go();

/* FEATURES.JS — fitur tambahan Student Desk (dimuat setelah app.js) */
(() => {
  const route = () => location.hash.slice(1) || 'dash';
  const isMod = (r) => Object.prototype.hasOwnProperty.call(M, r);
  const mk = (tag, cls, html) =>
    Object.assign(document.createElement(tag), { className: cls, innerHTML: html });

  /* ---------- Tema terang / gelap ---------- */
  const setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem('sd_theme', t);
    } catch {}
    const b = $('#theme');
    if (b) {
      b.innerHTML = `<i data-lucide="${t === 'dark' ? 'sun' : 'moon'}"></i>`;
      icons();
    }
  };
  const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  const themeBtn = mk('button', 'bell', '');
  themeBtn.id = 'theme';
  themeBtn.title = 'Ganti tema';
  themeBtn.setAttribute('aria-label', 'Ganti tema');
  themeBtn.onclick = toggleTheme;
  $('header').insertBefore(themeBtn, $('header .dd'));
  themeBtn.style.marginLeft = 'auto';
  let saved = 'light';
  try {
    saved =
      localStorage.getItem('sd_theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch {}
  setTheme(saved);

  /* ---------- Palet perintah (Ctrl/Cmd + K) ---------- */
  const cmds = () => [
    { t: 'Buka Dashboard', go: () => (location.hash = 'dash') },
    ...Object.keys(M).map((k) => ({ t: 'Buka ' + M[k].label, go: () => (location.hash = k) })),
    { t: 'Buka Riwayat Dokumen', go: () => (location.hash = 'riwayat') },
    { t: 'Buka Pengaturan', go: () => (location.hash = 'settings') },
    ...Object.keys(M).map((k) => ({ t: 'Buat baru: ' + M[k].label, go: () => quickAdd(k) })),
    { t: 'Ekspor cadangan data', go: downloadBackup },
    { t: 'Ganti tema terang / gelap', go: toggleTheme },
  ];
  const cmd = mk(
    'div',
    '',
    `<div class="cmdbox"><input placeholder="Ketik perintah atau nama halaman…" aria-label="Palet perintah"><ul></ul></div>`,
  );
  cmd.id = 'cmd';
  cmd.hidden = true;
  document.body.append(cmd);
  const cin = $('input', cmd),
    cul = $('ul', cmd);
  let shown = [],
    sel = 0;
  const paint = () => {
    const q = cin.value.toLowerCase();
    shown = cmds()
      .filter((c) => c.t.toLowerCase().includes(q))
      .slice(0, 9);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    cul.innerHTML = '';
    shown.forEach((c, i) => {
      const li = mk('li', i === sel ? 'on' : '', '');
      li.textContent = c.t;
      li.onmousedown = (e) => {
        e.preventDefault();
        run(i);
      };
      cul.append(li);
    });
    if (!shown.length) cul.append(mk('li', 'none', 'Tidak ada hasil'));
  };
  const openCmd = () => {
    cmd.hidden = false;
    cin.value = '';
    sel = 0;
    paint();
    cin.focus();
  };
  const closeCmd = () => (cmd.hidden = true);
  const run = (i) => {
    const c = shown[i];
    closeCmd();
    c && c.go();
  };
  cin.addEventListener('input', () => {
    sel = 0;
    paint();
  });
  cin.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !shown.length) return e.preventDefault();
    if (e.key === 'ArrowDown') {
      sel = (sel + 1) % shown.length;
      paint();
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') {
      sel = (sel - 1 + shown.length) % shown.length;
      paint();
      e.preventDefault();
    }
    if (e.key === 'Enter') run(sel);
  });
  cmd.addEventListener('mousedown', (e) => {
    if (e.target === cmd) closeCmd();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      cmd.hidden ? openCmd() : closeCmd();
    }
    if (e.key === 'Escape') closeCmd();
  });

  /* ---------- Ringkasan per halaman ---------- */
  const monthKey = new Date().toISOString().slice(0, 7);
  const metrics = (m, rows) => {
    const base = [
      ['Total data', rows.length],
      ['Dibuat bulan ini', rows.filter((r) => (r.created || '').startsWith(monthKey)).length],
    ];
    const n = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    if (m === 'kuitansi')
      base.push(
        ['Total nominal', rp(n('jumlah'))],
        ['Rata-rata', rp(rows.length ? n('jumlah') / rows.length : 0)],
      );
    if (m === 'turnitin')
      base.push(
        ['Rata-rata similarity', (rows.length ? n('sim') / rows.length : 0).toFixed(1) + '%'],
        ['Melebihi batas', rows.filter((r) => r.sim > (r.batas || S().batas || 25)).length],
      );
    if (m === 'pedos')
      base.push(
        ['Mendatang', rows.filter((r) => r.status === 'Terjadwal' && r.tanggal >= today()).length],
        ['Selesai', rows.filter((r) => r.status === 'Selesai').length],
      );
    if (m === 'absensi')
      base.push(
        ['Hadir', rows.filter((r) => r.status === 'Hadir').length],
        [
          'Kehadiran',
          (rows.length ? (rows.filter((r) => r.status === 'Hadir').length / rows.length) * 100 : 0).toFixed(
            0,
          ) + '%',
        ],
      );
    return base;
  };

  /* ---------- Ekspor CSV & duplikat ---------- */
  const exportCsv = (m) => {
    const f = M[m].f,
      // Sel yang diawali = + - @ dianggap rumus oleh Excel; beri tanda petik agar tampil sebagai teks
      q = (v) => {
        let s = String(v ?? '');
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
      };
    const lines = [
      f.map((x) => q(x[1])).join(','),
      ...DB.list(m).map((r) => f.map((x) => q(r[x[0]])).join(',')),
    ];
    const a = document.createElement('a');
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.href = url;
    a.download = `${m}-${today()}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('CSV diunduh');
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dup]');
    if (!b) return;
    const m = b.dataset.m,
      r = DB.get(m, b.dataset.id);
    if (!r) return;
    const c = { ...r };
    ['id', 'created', 'upd', 'demo'].forEach((k) => delete c[k]);
    if (c.nomor) c.nomor = nextNo(m);
    if (DB.put(m, c)) {
      toast('Data diduplikasi');
      go();
    }
  });

  /* ---------- Penambah fitur setiap render ---------- */
  const listExtras = (m, v) => {
    const bar = $('.bar', v);
    if (bar && !$('.kpis', v)) {
      bar.before(
        mk(
          'div',
          'kpis',
          metrics(m, DB.list(m))
            .map(([l, x]) => `<div><small>${l}</small><b>${x}</b></div>`)
            .join(''),
        ),
      );
    }
    const add = $('#add', v);
    if (add && !$('#csv', v)) {
      const b = mk('button', 'btn ghost', '<i data-lucide="download"></i>CSV');
      b.id = 'csv';
      b.type = 'button';
      b.onclick = () => exportCsv(m);
      add.before(b);
      icons();
    }
    v.querySelectorAll('td.act').forEach((td) => {
      const ed = $('[data-a="edit"]', td);
      if (!ed || $('[data-dup]', td)) return;
      const b = mk('button', 'btn ghost sm', 'Duplikat');
      b.type = 'button';
      Object.assign(b.dataset, { dup: 1, m: ed.dataset.m || m, id: ed.dataset.id });
      ed.before(b);
    });
    v.querySelectorAll('table').forEach((t) => {
      [...(t.rows[0]?.cells || [])].forEach((th, i, all) => {
        if (th.dataset.s || i === all.length - 1 || th.tagName !== 'TH') return;
        th.dataset.s = 1;
        th.tabIndex = 0;
        th.setAttribute('role', 'button');
        th.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            th.click();
          }
        };
        th.onclick = () => {
          const asc = th.getAttribute('aria-sort') !== 'ascending';
          all.forEach((x) => x.removeAttribute('aria-sort'));
          th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
          const rows = [...t.rows]
            .slice(1)
            .sort(
              (a, b) =>
                (a.cells[i].dataset.sv ?? a.cells[i].textContent).localeCompare(
                  b.cells[i].dataset.sv ?? b.cells[i].textContent,
                  'id',
                  { numeric: true },
                ) *
                (asc ? 1 : -1),
            );
          rows.forEach((r) => r.parentNode.append(r));
        };
      });
    });
  };

  const dashExtras = (v) => {
    const stats = $('.stats', v);
    if (!stats || $('.wk', v)) return;
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    const all = Object.keys(M).flatMap((m) => DB.list(m));
    const on = (d) => all.filter((r) => r.created && new Date(r.created).toDateString() === d.toDateString()).length;
    const days = [...Array(7)].map((_, i) => day(6 - i));
    const cnt = days.map(on);
    const total = cnt.reduce((a, b) => a + b, 0);
    const prev = [...Array(7)].map((_, i) => on(day(13 - i))).reduce((a, b) => a + b, 0);
    const delta = prev ? Math.round(((total - prev) / prev) * 100) : null;
    const top = Math.max(4, Math.ceil(Math.max(...cnt) / 4) * 4);
    const W = 720, H = 230, L = 34, R = 16, T = 16, B = 34;
    const X = (i) => L + (i * (W - L - R)) / 6, Y = (n) => H - B - (n / top) * (H - B - T);
    let d = `M${X(0)},${Y(cnt[0])}`;
    for (let i = 1; i < 7; i++) { const mx = (X(i - 1) + X(i)) / 2; d += ` C${mx},${Y(cnt[i - 1])} ${mx},${Y(cnt[i])} ${X(i)},${Y(cnt[i])}`; }
    const grid = [0, 1, 2, 3, 4].map((k) => { const y = Y((top * k) / 4); return `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="yl" x="${L - 8}" y="${y + 4}">${(top * k) / 4}</text>`; }).join('');
    const xl = days.map((dt, i) => `<text x="${X(i)}" y="${H - 10}">${dt.toLocaleDateString('id-ID', { weekday: 'short' })}</text>`).join('');
    const lx = X(6), ly = Y(cnt[6]);
    const dl = delta === null ? ['flat', 'Belum ada pembanding'] : [delta >= 0 ? 'up' : 'down', `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% dari minggu lalu`];
    const sec = mk('section', 'card wk a-wk', `
      <div class="sec-h"><div><h3>Aktivitas 7 hari terakhir</h3><span class="muted">Data baru yang kamu buat</span></div>
        <div class="wk-sum"><b>${total}</b><span class="dl ${dl[0]}">${dl[1]}</span></div></div>
      <div class="plot">
        <svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik garis aktivitas 7 hari terakhir">
          <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a9d68" stop-opacity=".22"/><stop offset="1" stop-color="#2a9d68" stop-opacity="0"/></linearGradient></defs>
          ${grid}${xl}
          <path class="area" d="${d} L${X(6)},${H - B} L${X(0)},${H - B} Z"/>
          <path class="ln" pathLength="1" d="${d}"/>
          <line class="guide" y1="${T}" y2="${H - B}" hidden/><circle class="hot" r="5" hidden/>
          <circle class="ring2" cx="${lx}" cy="${ly}" r="5"/><circle class="endp" cx="${lx}" cy="${ly}" r="4.5"/>
          <rect class="hit" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/>
        </svg>
        <div class="ttip" hidden></div>
      </div>`);
    stats.after(sec);
    const svg = $('svg', sec), tip = $('.ttip', sec), guide = $('.guide', sec), hot = $('.hot', sec);
    const hide = () => { tip.hidden = guide.hidden = hot.hidden = true; };
    svg.onpointermove = (e) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(6, Math.round((((e.clientX - r.left) / r.width) * W - L) / ((W - L - R) / 6))));
      guide.setAttribute('x1', X(i)); guide.setAttribute('x2', X(i));
      hot.setAttribute('cx', X(i)); hot.setAttribute('cy', Y(cnt[i]));
      guide.hidden = hot.hidden = tip.hidden = false;
      tip.innerHTML = `<small>${days[i].toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</small><b>${cnt[i]} data baru</b>`;
      tip.style.left = `${(X(i) / W) * r.width}px`;
      tip.style.top = `${(Y(cnt[i]) / H) * r.height}px`;
    };
    svg.onpointerleave = hide;
  };


  const profileExtras = (v) => {
    if ($('#pf', v)) return;
    const s = S();
    const F = [['user', 'Nama lengkap'], ['nim', 'NIM / NIP'], ['peran', 'Peran / jabatan'], ['email', 'Email', 'email'],
      ['telp', 'No. telepon', 'tel'], ['lahir', 'Tanggal lahir', 'date'], ['alamatPribadi', 'Alamat domisili'], ['bio', 'Tentang saya', 'textarea']];
    const card = mk('form', 'card profile', `
      <div class="pf-head">
        <div class="pf-ava" id="pfAva"></div>
        <div><h3>Profil</h3><p class="muted">Foto dan data dirimu, tersimpan di browser ini.</p>
          <div class="pf-act"><button type="button" class="btn ghost sm" id="pfUp">Unggah foto</button><button type="button" class="btn danger sm" id="pfDel">Hapus foto</button></div>
        </div>
      </div>
      <input type="file" id="pfFile" accept="image/*" hidden>
      <div class="fgrid">${F.map(([k, l, t = 'text']) => `<div class="fg ${t === 'textarea' ? 'full' : ''}"><label for="p_${k}">${l}</label>${
        t === 'textarea' ? `<textarea id="p_${k}" name="${k}">${esc(s[k] ?? '')}</textarea>` : `<input id="p_${k}" name="${k}" type="${t}" value="${esc(s[k] ?? '')}">`}</div>`).join('')}</div>
      <button class="btn">Simpan profil</button>`);
    card.id = 'pf';
    const paint = () => {
      const c = S(), el = $('#pfAva', card);
      el.style.backgroundImage = c.foto && /^data:image\//.test(c.foto) ? `url("${c.foto}")` : '';
      el.textContent = c.foto ? '' : (c.user || 'P').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
      $('#pfDel', card).hidden = !c.foto;
    };
    paint();
    const anchor = $('#sf', v);
    anchor ? anchor.before(card) : v.append(card);
    card.onsubmit = (e) => {
      e.preventDefault();
      if (DB.setSettings({ ...S(), ...Object.fromEntries(new FormData(card)) })) { toast('Profil disimpan'); applyAva(); go(); }
    };
    $('#pfUp', card).onclick = () => $('#pfFile', card).click();
    $('#pfDel', card).onclick = () => {
      const c = { ...S() };
      delete c.foto;
      if (DB.setSettings(c)) { toast('Foto dihapus'); applyAva(); paint(); }
    };
    $('#pfFile', card).onchange = (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!f.type.startsWith('image/')) return toast('File harus berupa gambar', 1);
      const img = new Image(), url = URL.createObjectURL(f);
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast('Gambar tidak bisa dibaca', 1);
      };
      img.onload = () => {
        const n = 256, c = document.createElement('canvas'), k = Math.min(img.width, img.height);
        c.width = c.height = n;
        c.getContext('2d').drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, n, n);
        URL.revokeObjectURL(url);
        if (DB.setSettings({ ...S(), foto: c.toDataURL('image/jpeg', 0.85) })) { toast('Foto profil diperbarui'); applyAva(); paint(); }
      };
      img.src = url;
    };
  };

  const enhance = () => {
    const v = $('#view'),
      r = route();
    if (r === 'dash') dashExtras(v);
    else if (isMod(r)) listExtras(r, v);
    else if (r === 'settings') profileExtras(v);
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhance();
    });
  }).observe($('#view'), { childList: true, subtree: true });
  enhance();
})();


/* ==========================================================================
   Bilah navigasi bawah (ponsel)
   ========================================================================== */
(() => {
  const items = [['dash', 'Beranda', 'layout-dashboard'], ['miniriset', 'Surat', 'file-text'], ['pedos', 'Jadwal', 'calendar-days'], ['riwayat', 'Riwayat', 'history']];
  const nav = document.createElement('nav');
  nav.id = 'tabbar';
  nav.setAttribute('aria-label', 'Navigasi cepat');
  nav.innerHTML =
    items.map(([r, l, i]) => `<a href="#${r}" data-r="${r}"><i data-lucide="${i}"></i><span>${l}</span></a>`).join('') +
    '<button type="button" id="tbMenu"><i data-lucide="menu"></i><span>Menu</span></button>';
  document.body.append(nav);
  const mark = () => {
    const r = location.hash.slice(1) || 'dash';
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.r === r || (a.dataset.r === 'miniriset' && (r === 'bap' || r === 'magang'))));
  };
  $('#tbMenu').onclick = () => { $('#side').classList.add('open'); $('#shade').classList.add('open'); };
  addEventListener('hashchange', mark);
  mark();
  icons();
})();