const bcrypt = require('bcryptjs');
const db = require('./database');

console.log('🌱 Seeding database...');

// ─── USERS ────────────────────────────────────────────────────
const users = [
  { name: 'Super Admin',    email: 'superadmin@konveksi.com', password: 'admin123',    role: 'superadmin' },
  { name: 'Budi Admin',     email: 'admin@konveksi.com',      password: 'admin123',    role: 'admin' },
  { name: 'Siti Operator',  email: 'siti@konveksi.com',       password: 'operator123', role: 'operator' },
  { name: 'Andi Operator',  email: 'andi@konveksi.com',       password: 'operator123', role: 'operator' },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
`);

for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  insertUser.run(u.name, u.email, hash, u.role);
}

console.log('✅ Users seeded');

// ─── ORDERS ───────────────────────────────────────────────────
const orders = [
  { code: 'ORD-2025-001', product: 'Kemeja Putih Lengan Panjang',  qty: 200 },
  { code: 'ORD-2025-002', product: 'Polo Shirt Navy Bordir',        qty: 150 },
  { code: 'ORD-2025-003', product: 'Jaket Hoodie Fleece Abu',       qty: 100 },
  { code: 'ORD-2025-004', product: 'Celana Cargo Hitam',            qty: 80  },
  { code: 'ORD-2025-005', product: 'Seragam SD Putih + Merah',      qty: 300 },
];

const insertOrder = db.prepare(`
  INSERT OR IGNORE INTO orders (order_code, product_name, target_qty, created_by)
  VALUES (?, ?, ?, 2)
`);

for (const o of orders) {
  insertOrder.run(o.code, o.product, o.qty);
}

console.log('✅ Orders seeded');

// ─── PRODUCTION LOGS ──────────────────────────────────────────
const stages = ['Potong','Jahit','Pasang Kancing','Finishing','QC','Gosok & Packing','Gudang'];

const insertLog = db.prepare(`
  INSERT INTO production_logs (order_id, stage, qty_in, qty_out, note, created_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const markDone = db.prepare(`UPDATE orders SET status = 'selesai' WHERE id = ?`);

// ORD-001: Selesai semua (Gudang)
const log1 = [
  [1, 'Potong',         200, 200, 'Bahan ready semua',       3, '2025-04-01 08:00:00'],
  [1, 'Jahit',          200, 196, '4 pcs bahan sobek',       4, '2025-04-01 14:00:00'],
  [1, 'Pasang Kancing', 196, 196, '',                        3, '2025-04-02 09:00:00'],
  [1, 'Finishing',      196, 195, '1 pcs jahitan lepas',     4, '2025-04-02 15:00:00'],
  [1, 'QC',             195, 193, '2 pcs gagal QC',          3, '2025-04-03 08:30:00'],
  [1, 'Gosok & Packing',193, 193, '',                        4, '2025-04-03 14:00:00'],
  [1, 'Gudang',         193, 193, 'Diterima gudang lengkap', 3, '2025-04-04 10:00:00'],
];
for (const l of log1) insertLog.run(...l);
markDone.run(1);

// ORD-002: Sampai QC
const log2 = [
  [2, 'Potong',         150, 150, '',                  3, '2025-04-03 08:00:00'],
  [2, 'Jahit',          150, 148, '2 pcs reject',      4, '2025-04-04 10:00:00'],
  [2, 'Pasang Kancing', 148, 148, '',                  3, '2025-04-05 08:00:00'],
  [2, 'Finishing',      148, 148, '',                  4, '2025-04-05 13:00:00'],
  [2, 'QC',             148, 146, '2 pcs cacat jahit', 3, '2025-04-06 09:00:00'],
];
for (const l of log2) insertLog.run(...l);

// ORD-003: Sampai Jahit
const log3 = [
  [3, 'Potong', 100, 100, '',             4, '2025-04-05 08:00:00'],
  [3, 'Jahit',  100,  98, '2 pcs rusak', 3, '2025-04-06 11:00:00'],
];
for (const l of log3) insertLog.run(...l);

// ORD-004: Baru Potong (hari ini)
const today = new Date().toISOString().slice(0,10);
insertLog.run(4, 'Potong', 80, 80, 'Bahan baru datang', 4, `${today} 08:00:00`);

console.log('✅ Production logs seeded');
console.log('\n🎉 Seeding complete!\n');
console.log('📋 Login credentials:');
console.log('   superadmin@konveksi.com  / admin123');
console.log('   admin@konveksi.com       / admin123');
console.log('   siti@konveksi.com        / operator123');
