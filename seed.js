require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('./db/database');
const initDB = require('./db/init'); // ⬅️ TAMBAH INI

async function seed() {
  try {
    console.log('🚀 INIT DB...');
    await initDB(); // ⬅️ JALANKAN INI DULU

    console.log('🌱 Seeding...');

    await seedUsers();
    await seedOrders();

    console.log('🎉 SEED COMPLETE');
    process.exit(0);
  } catch (err) {
    console.error('❌ SEED ERROR:', err);
    process.exit(1);
  }
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
      [o.code, o.product, o.qty, 1]
    );
  }

  console.log('✅ Orders seeded');
}

// ─── RUN ALL ───────────────────────────────────────
async function seed() {
  try {
    await seedUsers();
    await seedOrders();

    console.log('🎉 SEED COMPLETE');
    process.exit(0);
  } catch (err) {
    console.error('❌ SEED ERROR:', err);
    process.exit(1);
  }
}

seed();