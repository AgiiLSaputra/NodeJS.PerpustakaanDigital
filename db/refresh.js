// ============================================================
// db/refresh.js - Menyegarkan materialized view mv_loan_stats
// Cara pakai:  npm run db:refresh
//
// Materialized view = hasil agregasi yang DISIMPAN. Setelah data
// pinjaman banyak berubah, hasilnya harus disegarkan supaya tidak
// basi (stale). Query stats/laporan membaca view ini.
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

async function main() {
  const started = Date.now();
  await pool.query("REFRESH MATERIALIZED VIEW mv_loan_stats");
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM mv_loan_stats");
  console.log(`[refresh] mv_loan_stats disegarkan (${rows[0].n} baris, ${Date.now() - started}ms).`);
  await pool.end();
}

main().catch((err) => {
  console.error("[refresh] GAGAL:", err.message);
  process.exit(1);
});
