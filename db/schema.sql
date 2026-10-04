-- ============================================================
-- SKEMA DATABASE: PERPUSTAKAAN DIGITAL (Day 7)
-- Dijalankan oleh: npm run db:init
--
-- Level-up dari Day 6:
--   1. MANY-TO-MANY      -> junction table + composite primary key
--   2. GENERATED COLUMN  -> kolom tsvector yang dihitung otomatis database
--   3. FULL-TEXT SEARCH  -> index GIN untuk pencarian cepat
--   4. TRIGGER + FUNCTION-> aturan bisnis (stok, audit) hidup di database
--   5. PARTIAL INDEX     -> index khusus baris yang belum dikembalikan
--   6. JSONB             -> audit log berbentuk dokumen JSON
--   7. MATERIALIZED VIEW -> hasil agregasi yang disimpan (bukan dihitung ulang)
-- ============================================================

-- 1. KATEGORI BUKU (one-to-many, konsep yang sama dengan Day 6)
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PENULIS (name UNIQUE -> jadi target ON CONFLICT di API & seed)
CREATE TABLE IF NOT EXISTS authors (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(150) NOT NULL UNIQUE,
    bio        TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. BUKU
--    search_vector = GENERATED COLUMN: database menghitung sendiri tiap
--    INSERT/UPDATE judul & deskripsi. Isinya "kata-kata penting" untuk FTS.
--    SETWEIGHT memberi bobot: judul (A) lebih penting dari deskripsi (B).
CREATE TABLE IF NOT EXISTS books (
    id               SERIAL PRIMARY KEY,
    category_id      INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title            VARCHAR(250) NOT NULL,
    isbn             VARCHAR(20) UNIQUE,
    publisher        VARCHAR(150),
    published_year   INT CHECK (published_year BETWEEN 1000 AND 2100),
    total_copies     INT NOT NULL DEFAULT 1 CHECK (total_copies >= 1),
    available_copies INT NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
    description      TEXT,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    search_vector    TSVECTOR GENERATED ALWAYS AS (
        SETWEIGHT(TO_TSVECTOR('simple', COALESCE(title, '')), 'A') ||
        SETWEIGHT(TO_TSVECTOR('simple', COALESCE(publisher, '')), 'B') ||
        SETWEIGHT(TO_TSVECTOR('simple', COALESCE(description, '')), 'B')
    ) STORED,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RELASI MANY-TO-MANY: buku <-> penulis
--    Satu buku bisa punya banyak penulis, satu penulis menulis banyak buku.
--    Kunci uniknya gabungan 2 kolom (composite primary key),
--    ditambah FOREIGN KEY masing-masing sebagai "tali" ke tabel induk.
CREATE TABLE IF NOT EXISTS book_authors (
    book_id   INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id INT NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (book_id, author_id)
);

-- 5. ANGGOTA PERPUSTAKAAN
CREATE TABLE IF NOT EXISTS members (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    email      VARCHAR(200) NOT NULL UNIQUE,
    phone      VARCHAR(30),
    joined_at  DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PINJAMAN = many-to-many bertenaga (junction + kolom payload)
--    Baris ini berarti "anggota X meminjam buku Y sejak ... tenggat ...".
--    Kontras dengan Day 6 yang memakai 2 tabel (orders + order_items).
CREATE TABLE IF NOT EXISTS loans (
    id          SERIAL PRIMARY KEY,
    member_id   INT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    book_id     INT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    borrowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at      DATE NOT NULL,
    returned_at TIMESTAMPTZ,
    notes       TEXT,
    CHECK (due_at >= borrowed_at::date),
    CHECK (returned_at IS NULL OR returned_at >= borrowed_at)
);

-- 7. AUDIT LOG - tiap perubahan pada loans disimpan sebagai JSONB
--    detail berisi BENTUK LENGKAP baris pinjaman (to_jsonb), bukan kolom per kolom.
CREATE TABLE IF NOT EXISTS audit_logs (
    id         SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    action     TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    row_id     INT,
    detail     JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEX (peta jalan query)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_books_category       ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_search          ON books USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_book_authors_author   ON book_authors(author_id);
CREATE INDEX IF NOT EXISTS idx_loans_member          ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_book            ON loans(book_id);
-- PARTIAL INDEX: hanya menyimpan baris yang BELUM dikembalikan.
-- Tabel jadi kecil, query "pinjaman aktif/terlambat" jadi sangat cepat.
CREATE INDEX IF NOT EXISTS idx_loans_overdue         ON loans(due_at) WHERE returned_at IS NULL;

-- ============================================================
-- TRIGGER 1: updated_at ikut terisi sendiri saat baris buku diubah
-- ============================================================
CREATE OR REPLACE FUNCTION fn_books_touch() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_books_bu ON books;
CREATE TRIGGER trg_books_bu BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION fn_books_touch();

-- ============================================================
-- TRIGGER 2: ada pinjaman baru -> stok "yang tersedia" berkurang sendiri.
-- Controller TIDAK mengurangi stok; database yang pegang aturan ini.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_loan_borrow() RETURNS TRIGGER AS $$
BEGIN
    UPDATE books
       SET available_copies = available_copies - 1
     WHERE id = NEW.book_id AND available_copies > 0;

    IF NOT FOUND THEN
        -- di-translate controller jadi response HTTP 409
        RAISE EXCEPTION 'Semua eksemplar buku ini sedang dipinjam';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loans_bi ON loans;
CREATE TRIGGER trg_loans_bi BEFORE INSERT ON loans
    FOR EACH ROW EXECUTE FUNCTION fn_loan_borrow();

-- ============================================================
-- TRIGGER 3: buku dikembalikan (returned_at NULL -> terisi)
--            -> stok "yang tersedia" kembali bertambah
-- ============================================================
CREATE OR REPLACE FUNCTION fn_loan_return() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.returned_at IS NOT NULL AND OLD.returned_at IS NULL THEN
        UPDATE books
           SET available_copies = LEAST(total_copies, available_copies + 1)
         WHERE id = NEW.book_id;
    ELSIF NEW.returned_at IS NULL AND OLD.returned_at IS NOT NULL THEN
        UPDATE books
           SET available_copies = available_copies - 1
         WHERE id = NEW.book_id AND available_copies > 0;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Stok tidak tersedia untuk membatalkan pengembalian';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loans_au ON loans;
CREATE TRIGGER trg_loans_au AFTER UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION fn_loan_return();

-- ============================================================
-- TRIGGER 4: audit log - setiap INSERT/UPDATE/DELETE pada loans
--            dicatat sebagai JSONB lengkap (to_jsonb)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_loans_audit() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (table_name, action, row_id, detail)
    VALUES (
        'loans',
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        CASE WHEN TG_OP = 'DELETE' THEN TO_JSONB(OLD) ELSE TO_JSONB(NEW) END
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loans_audit ON loans;
CREATE TRIGGER trg_loans_audit AFTER INSERT OR UPDATE OR DELETE ON loans
    FOR EACH ROW EXECUTE FUNCTION fn_loans_audit();

-- ============================================================
-- MATERIALIZED VIEW: hasil agregasi yang DISIMPAN di disk,
-- bukan dihitung ulang tiap kali diminta.
-- Segarkan dengan: npm run db:refresh
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_loan_stats AS
SELECT b.id    AS book_id,
       b.title,
       COUNT(l.id)::int AS times_borrowed,
       COUNT(l.id) FILTER (WHERE l.returned_at IS NULL)::int AS active_loans,
       MAX(l.borrowed_at) AS last_borrowed_at
FROM books b
JOIN loans l ON l.book_id = b.id
GROUP BY b.id;

-- Unique index di wajib ada supaya materialized view bisa di-REFRESH
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_loan_stats_book ON mv_loan_stats(book_id);
