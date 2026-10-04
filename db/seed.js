// ============================================================
// db/seed.js - Mengisi data dummy (kategori, penulis, buku,
//              anggota, pinjaman)
// Cara pakai:  npm run db:seed
//
// Bagian menarik: INSERT ke loans memancing TRIGGER -
// stok available_copies berkurang/kembali OTOMATIS oleh database,
// dan setiap baris pinjaman tercatat di audit_logs (JSONB).
// ============================================================
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "day7_perpus",
});

const categories = [
  { name: "Fiksi", description: "Novel dan karya sastra" },
  { name: "Teknologi", description: "Pemrograman dan ilmu komputer" },
  { name: "Sejarah", description: "Sejarah Indonesia dan dunia" },
  { name: "Pengembangan Diri", description: "Produktivitas dan kebiasaan" },
  { name: "Komik", description: "Komik dan graphic novel" },
];

const authors = [
  { name: "Andrea Hirata", bio: "Penulis Laskar Pelangi, tokoh sastra Indonesia modern" },
  { name: "Tere Liye", bio: "Penulis produktif, dikenal lewat serial Bulan dan Hujan" },
  { name: "Pramoedya Ananta Toer", bio: "Penulis Tetralogi Buru, sastrawan Indonesia legendaris" },
  { name: "Habiburrahman El Shirazy", bio: "Penulis Ayat-Ayat Cinta" },
  { name: "Hamka", bio: "Sastraawan dan ulama, penulis Tenggelamnya Kapal van der Wijck" },
  { name: "Martin Kleppmann", bio: "Penulis Designing Data-Intensive Applications" },
  { name: "Robert C. Martin", bio: "Bapak 'Uncle Bob', penulis Clean Code" },
  { name: "Andrew Hunt", bio: "Salah satu penulis The Pragmatic Programmer" },
  { name: "David Thomas", bio: "Salah satu penulis The Pragmatic Programmer" },
  { name: "Martin Fowler", bio: "Penulis Refactoring, ahli desain software" },
  { name: "Mario Casciaro", bio: "Penulis Node.js Design Patterns" },
  { name: "Kartini", bio: "Pelopor emansipasi perempuan Indonesia, penulis Habis Gelap Terbitlah Terang" },
  { name: "B.J. Habibie", bio: "Presiden ketiga RI, penulis Menggerakkan Bangsa" },
  { name: "Mark Manson", bio: "Penulis Sebuah Seni untuk Bersikap Bodo Amat" },
  { name: "James Clear", bio: "Penulis Atomic Habits" },
  { name: "Dale Carnegie", bio: "Penulis How to Win Friends and Influence People" },
  { name: "Stephen R. Covey", bio: "Penulis 7 Kebiasaan Orang yang Sangat Efektif" },
  { name: "Herge", bio: "Kreator serial komik Tintin" },
  { name: "Akira Toriyama", bio: "Kreator Dragon Ball" },
  { name: "Masashi Kishimoto", bio: "Kreator Naruto" },
];

const books = [
  { cat: "Fiksi", title: "Laskar Pelangi", isbn: "978-602-8599-01-1", publisher: "Bentang Pustaka", year: 2005, copies: 3, desc: "Kisah sepuluh anak sekolah di Belitung yang memperjuangkan pendidikan.", authors: ["Andrea Hirata"] },
  { cat: "Fiksi", title: "Bumi Manusia", isbn: "978-602-8599-02-8", publisher: "Hasta Mitra", year: 1980, copies: 3, desc: "Novel sejarah tentang cinta dan perjuangan di akhir zaman kolonial.", authors: ["Pramoedya Ananta Toer"] },
  { cat: "Fiksi", title: "Ayat-Ayat Cinta", isbn: "978-602-8599-03-5", publisher: "Republika", year: 2004, copies: 2, desc: "Novel religius tentang kehidupan seorang mahasiswa di Kairo.", authors: ["Habiburrahman El Shirazy"] },
  { cat: "Fiksi", title: "Bulan", isbn: "978-602-8599-04-2", publisher: "Gramedia Pustaka Utama", year: 2015, copies: 3, desc: "Petualangan Raib dan kawan-kawan di dunia paralel.", authors: ["Tere Liye"] },
  { cat: "Fiksi", title: "Hujan", isbn: "978-602-8599-05-9", publisher: "Gramedia Pustaka Utama", year: 2018, copies: 2, desc: "Kisah distopia tentang bencana dan harapan.", authors: ["Tere Liye"] },
  { cat: "Fiksi", title: "Rumah Kaca", isbn: "978-602-8599-06-6", publisher: "Hasta Mitra", year: 1988, copies: 2, desc: "Jilid terakhir Tetralogi Buru.", authors: ["Pramoedya Ananta Toer"] },

  { cat: "Teknologi", title: "Designing Data-Intensive Applications", isbn: "978-1-449-37332-3", publisher: "O'Reilly Media", year: 2017, copies: 3, desc: "Panduan membangun sistem data yang andal, skalabel, dan mudah dipelihara.", authors: ["Martin Kleppmann"] },
  { cat: "Teknologi", title: "Clean Code", isbn: "978-0-132-35088-4", publisher: "Prentice Hall", year: 2008, copies: 3, desc: "Seni menulis kode yang rapi dan mudah dirawat.", authors: ["Robert C. Martin"] },
  { cat: "Teknologi", title: "The Pragmatic Programmer", isbn: "978-0-201-61622-4", publisher: "Addison-Wesley", year: 1999, copies: 2, desc: "Prinsip-prinsip praktis menjadi programmer yang lebih baik.", authors: ["Andrew Hunt", "David Thomas"] },
  { cat: "Teknologi", title: "Refactoring", isbn: "978-0-201-85463-3", publisher: "Addison-Wesley", year: 1999, copies: 2, desc: "Meningkatkan desain kode yang ada tanpa mengubah perilakunya.", authors: ["Martin Fowler"] },
  { cat: "Teknologi", title: "Node.js Design Patterns", isbn: "978-1-785-88536-1", publisher: "Packt Publishing", year: 2018, copies: 3, desc: "Pola desain modern untuk aplikasi Node.js yang skalabel.", authors: ["Mario Casciaro"] },
  { cat: "Teknologi", title: "Clean Architecture", isbn: "978-0-134-49416-6", publisher: "Prentice Hall", year: 2017, copies: 2, desc: "Struktur software yang memisahkan kepentingan agar mudah diubah.", authors: ["Robert C. Martin"] },

  { cat: "Sejarah", title: "Tenggelamnya Kapal van der Wijck", isbn: "978-602-6189-07-7", publisher: "Bulan Bintang", year: 1938, copies: 2, desc: "Kisah cinta tragis di laut Jawa.", authors: ["Hamka"] },
  { cat: "Sejarah", title: "Di Bawah Lindungan Ka'bah", isbn: "978-602-6189-08-4", publisher: "Bulan Bintang", year: 1938, copies: 2, desc: "Novel klasik tentang perjalanan spiritual di Mekah.", authors: ["Hamka"] },
  { cat: "Sejarah", title: "Habis Gelap Terbitlah Terang", isbn: "978-602-6189-09-1", publisher: "Balai Pustaka", year: 1911, copies: 2, desc: "Kumpulan surat Kartini yang menginspirasi emansipasi perempuan.", authors: ["Kartini"] },
  { cat: "Sejarah", title: "Menggerakkan Bangsa", isbn: "978-602-6189-10-7", publisher: "Kompas", year: 2019, copies: 2, desc: "Catatan perjalanan B.J. Habibie membangun Indonesia.", authors: ["B.J. Habibie"] },

  { cat: "Pengembangan Diri", title: "Sebuah Seni untuk Bersikap Bodo Amat", isbn: "978-0-062-45771-9", publisher: "Gramedia Pustaka Utama", year: 2016, copies: 3, desc: "Panduan hidup dengan lebih tenang dan berani.", authors: ["Mark Manson"] },
  { cat: "Pengembangan Diri", title: "Atomic Habits", isbn: "978-0-735-21129-1", publisher: "Avery", year: 2018, copies: 3, desc: "Strategi membangun kebaikan kecil yang berdampak besar.", authors: ["James Clear"] },
  { cat: "Pengembangan Diri", title: "How to Win Friends and Influence People", isbn: "978-0-671-02703-4", publisher: "Simon & Schuster", year: 1936, copies: 2, desc: "Klasik tentang kemampuan bersosialisasi dan memimpin.", authors: ["Dale Carnegie"] },
  { cat: "Pengembangan Diri", title: "7 Kebiasaan Orang yang Sangat Efektif", isbn: "978-0-743-26951-3", publisher: "Free Press", year: 1989, copies: 2, desc: "Prinsip kepemimpinan dan manajemen diri yang teruji waktu.", authors: ["Stephen R. Covey"] },

  { cat: "Komik", title: "Tintin: Petualangan di Uni Soviet", isbn: "978-2-203-00101-2", publisher: "Egmont", year: 1930, copies: 2, desc: "Petualangan pertama reporter muda Tintin.", authors: ["Herge"] },
  { cat: "Komik", title: "Dragon Ball Vol. 1", isbn: "978-602-0349-11-4", publisher: "Elex Media Komputindo", year: 1984, copies: 2, desc: "Awal perjalanan Son Goku mencari bola naga.", authors: ["Akira Toriyama"] },
  { cat: "Komik", title: "Naruto Vol. 1", isbn: "978-602-0349-12-1", publisher: "Elex Media Komputindo", year: 1999, copies: 2, desc: "Naruto memulai perjalanannya menjadi ninja terkuat.", authors: ["Masashi Kishimoto"] },
];

const members = [
  { name: "Budi Santoso", email: "budi@mail.com", phone: "081234567890" },
  { name: "Siti Aisyah", email: "siti@mail.com", phone: "081298765432" },
  { name: "Andi Wijaya", email: "andi@mail.com", phone: "081377712345" },
  { name: "Dewi Lestari", email: "dewi@mail.com", phone: "081355598765" },
  { name: "Rizky Pratama", email: "rizky@mail.com", phone: "081511122334" },
  { name: "Nurul Huda", email: "nurul@mail.com", phone: "081677788990" },
  { name: "Fajar Nugroho", email: "fajar@mail.com", phone: "081722233445" },
  { name: "Putri Ramadhani", email: "putri@mail.com", phone: "081833344556" },
  { name: "Hendra Gunawan", email: "hendra@mail.com", phone: "081944455667" },
  { name: "Maya Sari", email: "maya@mail.com", phone: "082055566778" },
];

const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const plusDays = (d, n) => new Date(d.getTime() + n * 86400000);

// due_at dihitung DATABASE supaya konsisten dengan CHECK (>= borrowed_at::date)
const SQL_LOAN = `INSERT INTO loans (member_id, book_id, borrowed_at, due_at, notes)
                   VALUES ($1, $2, $3, ($3::timestamptz + interval '14 days')::date, $4)
                   RETURNING id`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Kosongkan data lama supaya aman diulang (urutan aman karena CASCADE)
    await client.query(
      "TRUNCATE audit_logs, loans, book_authors, books, members, authors, categories RESTART IDENTITY CASCADE"
    );

    // 1. Kategori
    const catIds = {};
    for (const c of categories) {
      const { rows } = await client.query(
        "INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id",
        [c.name, c.description]
      );
      catIds[c.name] = rows[0].id;
    }

    // 2. Penulis -> UPSERT ON CONFLICT ... RETURNING (baru vs diperbarui)
    const authorIds = {};
    let authorNew = 0;
    let authorUpdated = 0;
    for (const a of authors) {
      const { rows } = await client.query(
        `INSERT INTO authors (name, bio) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET bio = EXCLUDED.bio
         RETURNING id, (xmax = 0) AS is_new`,
        [a.name, a.bio]
      );
      rows[0].is_new ? authorNew++ : authorUpdated++;
      authorIds[a.name] = rows[0].id;
    }

    // 3. Buku + junction many-to-many book_authors
    for (const b of books) {
      const { rows } = await client.query(
        `INSERT INTO books (category_id, title, isbn, publisher, published_year, total_copies, available_copies, description)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7) RETURNING id`,
        [catIds[b.cat], b.title, b.isbn, b.publisher, b.year, b.copies, b.desc]
      );
      for (const authorName of b.authors) {
        await client.query(
          "INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [rows[0].id, authorIds[authorName]]
        );
      }
    }

    // 4. Anggota
    for (const m of members) {
      await client.query("INSERT INTO members (name, email, phone) VALUES ($1, $2, $3)", [
        m.name, m.email, m.phone,
      ]);
    }

    // 5. Pinjaman - memancing 3 trigger sekaligus:
    //    (a) dibuat  -> stok berkurang + audit INSERT
    //    (b) dikembalikan -> stok kembali + audit UPDATE
    const { rows: allBooks } = await client.query("SELECT id FROM books ORDER BY id");
    const { rows: allMembers } = await client.query("SELECT id FROM members ORDER BY id");
    let loanCount = 0;

    for (let i = 0; i < allBooks.length; i++) {
      const bookId = allBooks[i].id;
      const mid = (k) => allMembers[(i + k) % allMembers.length].id;

      // (b) pinjaman SELESAI dulu, supaya stok selalu punya sisa saat insert
      const selesai = 1 + (i % 3);
      for (let j = 0; j < selesai; j++) {
        const borrowed = daysAgo(30 + i + j * 3);
        const { rows } = await client.query(SQL_LOAN, [mid(j + 1), bookId, borrowed, null]);
        // UPDATE returned_at ini memicu TRIGGER 3 -> available_copies naik lagi
        await client.query("UPDATE loans SET returned_at = $1 WHERE id = $2", [
          plusDays(borrowed, j === 2 ? 17 : 9), // j===2 sengaja telat
          rows[0].id,
        ]);
        loanCount++;
      }

      // (a) pinjaman AKTIF (stok berkurang, belum dikembalikan)
      const aktif = i % 2;
      for (let j = 0; j < aktif; j++) {
        const borrowed = daysAgo(2 + ((i + j) % 8));
        await client.query(SQL_LOAN, [mid(j), bookId, borrowed, j === 0 ? "Pinjam di loket" : null]);
        loanCount++;
      }

      // (a2) pinjaman TERLAMBAT (aktif + lewat tenggat) tiap buku ke-4
      if (i % 4 === 0) {
        const borrowed = daysAgo(25);
        await client.query(SQL_LOAN, [mid(0), bookId, borrowed, "Terlambat, ingatkan anggota"]);
        loanCount++;
      }
    }

    // 6. Segarkan materialized view supaya stats/laporan tidak basi
    await client.query("REFRESH MATERIALIZED VIEW mv_loan_stats");

    await client.query("COMMIT");
    console.log(
      `[seed] Siap: ${categories.length} kategori, ${authors.length} penulis ` +
        `(${authorNew} baru, ${authorUpdated} diperbarui), ${books.length} buku, ` +
        `${members.length} anggota, ${loanCount} pinjaman + audit log.`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed] GAGAL:", err.message);
  process.exit(1);
});
