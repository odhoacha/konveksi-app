const { Pool } = require('pg');

// pakai Railway ENV dulu (WAJIB)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// helper query biar semua route tetap bisa pakai db.query
module.exports = {
  query: (text, params) => pool.query(text, params),
};