require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('./db/database');

console.log("SEED DB:", process.env.DATABASE_URL);
console.log('🌱 Seeding PostgreSQL database...');

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