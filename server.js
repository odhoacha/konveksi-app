const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const initDB = require('./db/init');

// ─── INIT DB ─────────────────────────────
(async () => {
  try {
    await initDB();
    console.log("🔥 DATABASE READY");
  } catch (err) {
    console.error("❌ DB ERROR:", err);
    process.exit(1);
  }
})();

// ─── MIDDLEWARE ─────────────────────────
app.use(cors());
app.use(express.json());

// ─── STATIC FRONTEND ────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── ROUTES ─────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/production', require('./routes/production'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/users', require('./routes/users'));

// ─── HEALTH CHECK ───────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── SPA CATCH ALL (FIXED) ──────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── START ──────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏭 Konveksi Tracker running on ${PORT}`);
});