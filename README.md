# NodePerpus — Day 7: Perpustakaan Digital

Proyek pembelajaran **Node.js + Express + PostgreSQL (raw SQL via `pg`)**.
Katalog buku untuk anggota + dashboard admin: kelola buku, penulis, anggota,
peminjaman, dan laporan.

relasi **many-to-many**, **trigger**, **full-text search**,
dan **materialized view** — semua ditulis sebagai SQL asli.

---

## Fitur

**Katalog (`/`)**

- Cari buku dengan **full-text search** (`tsvector` + index GIN, bukan `ILIKE`)
- Filter kategori (chips), sort (judul / tahun / terpopuler), pagination
- Pinjam buku: pilih anggota + tanggal tenggat (stok dicegah oleh trigger)

**Admin (`/admin.html`)**

- Statistik: judul, eksemplar, tersedia, anggota, dipinjam, terlambat
- CRUD Buku (bisa **lebih dari satu penulis** — many-to-many)
- CRUD Penulis dengan **upsert** `ON CONFLICT`
- CRUD Anggota
- Peminjaman: tambah pinjam, kembalikan, filter status, lihat jejak audit (JSONB)
- Laporan: buku terpopuler (CTE + `DENSE_RANK`), terlambat, anggota teraktif
- Tombol **Refresh Materialized View**

---

## Konsep PostgreSQL yang Dipelajari

| #   | Konsep                                                         | Di mana                           |
| --- | -------------------------------------------------------------- | --------------------------------- |
| 1   | Many-to-many + junction table + composite PK                   | `book_authors`, `loans`           |
| 2   | Generated column (`tsvector`) + index GIN                      | `books.search_vector`             |
| 3   | Trigger + function (stok, audit, updated_at)                   | `db/schema.sql`                   |
| 4   | Upsert `ON CONFLICT ... RETURNING` (+ trik `xmax = 0`)         | `authorController.js`             |
| 5   | CTE + window function `DENSE_RANK`                             | `reportController.js`             |
| 6   | Materialized view + `REFRESH`                                  | `mv_loan_stats`                   |
| 7   | JSONB (`to_jsonb`, `detail->>'id'`)                            | `audit_logs`, `loanController.js` |
| 8   | Partial index (`WHERE returned_at IS NULL`)                    | `idx_loans_overdue`               |
| 9   | Transaksi + `SELECT ... FOR UPDATE` (dari Day 6, dipakai lagi) | `POST /api/loans`                 |

---

## Cara Menjalankan

```bash
# 1. isi password PostgreSQL di file .env (salin dari .env.example)
npm install

npm run db:init      # buat database day7_perpus + tabel + trigger + matview
npm run db:seed      # isi data dummy (kategori, penulis, buku, anggota, pinjaman)
npm run dev          # jalankan server (port 3001)

# Buka:
#   Katalog -> http://localhost:3001/
#   Admin   -> http://localhost:3001/admin.html
```

Perintah lain:

```bash
npm run db:reset     # DROP database lalu buat ulang (jalankan db:seed lagi setelahnya)
npm run db:refresh   # segarkan materialized view mv_loan_stats
npm start            # mode tanpa --watch
```

---

## Daftar Endpoint

| Method          | Endpoint                                           | Fungsi                                             |
| --------------- | -------------------------------------------------- | -------------------------------------------------- |
| GET             | `/api/categories`                                  | Kategori + jumlah buku                             |
| POST/DELETE     | `/api/categories`                                  | Tambah / hapus kategori (409 kalau masih ada buku) |
| GET             | `/api/authors`                                     | Penulis + jumlah buku                              |
| POST            | `/api/authors`                                     | **Upsert** penulis (`ON CONFLICT`)                 |
| PUT/DELETE      | `/api/authors/:id`                                 | Ubah / hapus penulis                               |
| GET             | `/api/books?search=&category=&author=&sort=&page=` | Cari (FTS) + filter + pagination                   |
| GET             | `/api/books/:id`                                   | Detail buku + penulis + buku sejenis               |
| POST            | `/api/books`                                       | Tambah buku + relasi penulis (transaksi)           |
| PUT/DELETE      | `/api/books/:id`                                   | Ubah / hapus buku                                  |
| GET             | `/api/members`                                     | Anggota + pinjaman aktif                           |
| POST/PUT/DELETE | `/api/members`                                     | CRUD anggota                                       |
| GET             | `/api/loans?status=borrowed\|overdue\|returned`    | Daftar pinjaman + status terhitung                 |
| GET             | `/api/loans/:id`                                   | Pinjaman + **jejak audit JSONB**                   |
| POST            | `/api/loans`                                       | Pinjam buku (transaksi + trigger stok)             |
| PATCH           | `/api/loans/:id/return`                            | Pengembalian (trigger menambah stok)               |
| GET             | `/api/stats`                                       | Statistik dashboard (baca materialized view)       |
| POST            | `/api/stats/refresh`                               | `REFRESH MATERIALIZED VIEW`                        |
| GET             | `/api/reports/popular`                             | Buku terpopuler (CTE + DENSE_RANK)                 |
| GET             | `/api/reports/overdue`                             | Pinjaman terlambat                                 |
| GET             | `/api/reports/top-members`                         | Anggota teraktif                                   |

---

## Struktur Folder

```
Day7/
├── README.md              ← file ini (ringkasan)
├── penjelasan.md          ← peta pemahaman lengkap (baca setelah ini)
├── package.json
├── .env / .env.example    ← kredensial database (RAHASIA, tidak di-commit)
│
├── db/
│   ├── schema.sql         ← DDL: tabel + index + TRIGGER + materialized view
│   ├── init.js            ← bikin database + jalankan schema.sql
│   ├── seed.js            ← data dummy (memancing trigger + audit log)
│   └── refresh.js         ← REFRESH MATERIALIZED VIEW
│
├── src/
│   ├── server.js          ← titik masuk: middleware → routes → listen (port 3001)
│   ├── config/database.js ← pg.Pool
│   ├── routes/api.js      ← peta URL → controller + aturan validasi
│   ├── controllers/
│   │   ├── categoryController.js
│   │   ├── authorController.js   ← ★ UPSERT ON CONFLICT
│   │   ├── bookController.js     ← ★ FTS + many-to-many (transaksi)
│   │   ├── memberController.js
│   │   ├── loanController.js     ← ★ pinjam (transaksi + trigger) & pengembalian
│   │   ├── statsController.js    ← ★ baca + refresh materialized view
│   │   └── reportController.js   ← ★ CTE + DENSE_RANK
│   └── middleware/
│       ├── validate.js
│       └── errorHandler.js
│
└── public/                ← UI (dilayani langsung oleh Express)
    ├── index.html         ← katalog + modal pinjam
    ├── admin.html         ← dashboard admin (5 tab)
    ├── css/style.css      ← tema Liquid Glass
    └── js/
        ├── app.js         ← cari buku (FTS), filter, pinjam
        └── admin.js       ← stats, CRUD, laporan, refresh MV
```

---

## Dokumentasi

Baca **[penjelasan.md](./penjelasan.md)** untuk peta pemahaman lengkap:
apa itu many-to-many, trigger, full-text search, materialized view, dan
alur satu aksi dari klik tombol sampai ke database.
