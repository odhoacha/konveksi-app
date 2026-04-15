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

const insertLog = db.prepare(`
  INSERT INTO production_logs (order_id, stage, qty_processed, note, created_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const markDone = db.prepare(`UPDATE orders SET status = 'selesai' WHERE id = ?`);

// ORD-001: Fully completed through Warehouse
// Demonstrates: multiple Sewing logs (partial batches) before QC
const log1 = [
  [1, 'Cutting',    200, 'Bahan ready semua',        3, '2025-04-01 08:00:00'],
  [1, 'Sewing',      80, 'Batch 1 selesai',           4, '2025-04-01 11:00:00'],
  [1, 'Sewing',     120, 'Batch 2 selesai',           3, '2025-04-01 14:00:00'],
  [1, 'Buttoning',  200, '',                          4, '2025-04-02 09:00:00'],
  [1, 'Finishing',  196, '4 pcs reject di finishing', 3, '2025-04-02 13:00:00'],
  [1, 'QC',         196, '',                          4, '2025-04-03 08:30:00'],
  [1, 'Packing',    194, '2 pcs gagal QC packing',    3, '2025-04-03 13:00:00'],
  [1, 'Warehouse',  194, 'Diterima gudang',            3, '2025-04-04 10:00:00'],
];
for (const l of log1) insertLog.run(...l);
markDone.run(1);

// ORD-002: In progress — Sewing partially done (parallel batch example)
// 150 cut, 90 sewn so far (2 batches), 60 remaining in Sewing
const log2 = [
  [2, 'Cutting',  150, '',                    3, '2025-04-03 08:00:00'],
  [2, 'Sewing',    50, 'Batch pertama',       4, '2025-04-04 10:00:00'],
  [2, 'Sewing',    40, 'Batch kedua',         3, '2025-04-05 09:00:00'],
  // 60 pcs still remaining in Sewing — next input allowed ✅
];
for (const l of log2) insertLog.run(...l);

// ORD-003: Early stage — Cutting done, Sewing just started
const log3 = [
  [3, 'Cutting', 100, '',                    4, '2025-04-05 08:00:00'],
  [3, 'Sewing',   40, '40 pcs batch awal',  3, '2025-04-06 11:00:00'],
];
for (const l of log3) insertLog.run(...l);

// ORD-004: Only Cutting done today
const today = new Date().toISOString().slice(0,10);
insertLog.run(4, 'Cutting', 80, 'Bahan baru datang', 4, `${today} 08:00:00`);

console.log('✅ Production logs seeded');
console.log('\n🎉 Seeding complete!\n');
console.log('📋 Login credentials:');
console.log('   superadmin@konveksi.com  / admin123');
console.log('   admin@konveksi.com       / admin123');
console.log('   siti@konveksi.com        / operator123');
