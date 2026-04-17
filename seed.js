const bcrypt = require('bcryptjs');
const db = require('./db/database');

console.log("🌱 Seeding PostgreSQL database...");

// ─── USERS ───────────────────────────────────────
const users = [
  { name: 'Super Admin', email: 'superadmin@konveksi.com', password: 'admin123', role: 'superadmin' },
  { name: 'Admin', email: 'admin@konveksi.com', password: 'admin123', role: 'admin' },
  { name: 'Operator', email: 'operator@konveksi.com', password: 'operator123', role: 'operator' },
];

async function seedUsers() {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);

    await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, hash, u.role]
    );
  }

  console.log('✅ Users seeded');
}

// ─── ORDERS ───────────────────────────────────────
const orders = [
  { code: 'ORD-2025-001', product: 'Kemeja Putih Lengan Panjang', qty: 200 },
  { code: 'ORD-2025-002', product: 'Polo Shirt Navy Bordir', qty: 150 },
  { code: 'ORD-2025-003', product: 'Jaket Hoodie Fleece Abu', qty: 100 },
  { code: 'ORD-2025-004', product: 'Celana Cargo Hitam', qty: 80 },
  { code: 'ORD-2025-005', product: 'Seragam SD Putih + Merah', qty: 300 },
];

async function seedOrders() {
  for (const o of orders) {
    await db.query(
      `INSERT INTO orders (order_code, product_name, target_qty, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (order_code) DO NOTHING`,
      [o.code, o.product, o.qty, 1] // created_by = superadmin
    );
  }

  console.log('✅ Orders seeded');
}

// ─── PRODUCTION LOGS ──────────────────────────────
async function seedProductionLogs() {
  // ambil order ID dari DB (biar aman)
  const { rows: orders } = await db.query(`SELECT id, order_code FROM orders`);

  const orderMap = {};
  orders.forEach(o => {
    orderMap[o.order_code] = o.id;
  });

  const logs = [
    // ORD-001 (selesai)
    [orderMap['ORD-2025-001'], 'Potong', 200, 200, 'Bahan ready semua', 3, '2025-04-01 08:00:00'],
    [orderMap['ORD-2025-001'], 'Jahit', 200, 196, '4 pcs bahan sobek', 4, '2025-04-01 14:00:00'],
    [orderMap['ORD-2025-001'], 'Pasang Kancing', 196, 196, '', 3, '2025-04-02 09:00:00'],
    [orderMap['ORD-2025-001'], 'Finishing', 196, 195, '1 pcs jahitan lepas', 4, '2025-04-02 15:00:00'],
    [orderMap['ORD-2025-001'], 'QC', 195, 193, '2 pcs gagal QC', 3, '2025-04-03 08:30:00'],
    [orderMap['ORD-2025-001'], 'Gosok & Packing', 193, 193, '', 4, '2025-04-03 14:00:00'],
    [orderMap['ORD-2025-001'], 'Gudang', 193, 193, 'Diterima gudang', 3, '2025-04-04 10:00:00'],

    // ORD-002
    [orderMap['ORD-2025-002'], 'Potong', 150, 150, '', 3, '2025-04-03 08:00:00'],
    [orderMap['ORD-2025-002'], 'Jahit', 150, 148, '2 pcs reject', 4, '2025-04-04 10:00:00'],
    [orderMap['ORD-2025-002'], 'QC', 148, 146, 'cacat jahit', 3, '2025-04-06 09:00:00'],

    // ORD-003
    [orderMap['ORD-2025-003'], 'Potong', 100, 100, '', 4, '2025-04-05 08:00:00'],
    [orderMap['ORD-2025-003'], 'Jahit', 100, 98, '2 pcs rusak', 3, '2025-04-06 11:00:00'],
  ];

  for (const l of logs) {
    if (!l[0]) continue; // skip kalau order belum ada

    await db.query(
      `INSERT INTO production_logs 
       (order_id, stage, qty_in, qty_out, note, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      l
    );
  }

  console.log('✅ Production logs seeded');
}

// ─── OPTIONAL: RESET (biar clean tiap run) ────────
async function resetDB() {
  await db.query(`TRUNCATE production_logs, orders, users RESTART IDENTITY CASCADE`);
  console.log('🧹 Database reset');
}

// ─── RUN ALL ─────────────────────────────────────
async function seed() {
  try {
    // ⚠️ uncomment kalau mau selalu fresh
    await resetDB();

    await seedUsers();
    await seedOrders();
    await seedProductionLogs();

    console.log('\n🎉 SEED COMPLETE\n');
    console.log('📋 Login:');
    console.log('superadmin@konveksi.com / admin123');
    console.log('admin@konveksi.com / admin123');
    console.log('siti@konveksi.com / operator123');

    process.exit(0);
  } catch (err) {
    console.error('❌ SEED ERROR:', err);
    process.exit(1);
  }
}

seed();