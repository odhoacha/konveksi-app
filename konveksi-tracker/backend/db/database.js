const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'konveksi.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    email     TEXT    NOT NULL UNIQUE,
    password  TEXT    NOT NULL,
    role      TEXT    NOT NULL DEFAULT 'operator' CHECK(role IN ('operator','admin','superadmin')),
    created_at TEXT   DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code   TEXT    NOT NULL UNIQUE,
    product_name TEXT    NOT NULL,
    target_qty   INTEGER NOT NULL CHECK(target_qty > 0),
    status       TEXT    NOT NULL DEFAULT 'on_progress' CHECK(status IN ('on_progress','selesai')),
    created_by   INTEGER REFERENCES users(id),
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS production_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage         TEXT    NOT NULL CHECK(stage IN ('Cutting','Sewing','Buttoning','Finishing','QC','Packing','Warehouse')),
    qty_processed INTEGER NOT NULL CHECK(qty_processed > 0),
    note          TEXT    DEFAULT '',
    created_by    INTEGER REFERENCES users(id),
    created_at    TEXT    DEFAULT (datetime('now','localtime'))
  );
`);

module.exports = db;
