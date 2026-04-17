const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const initDB = require('./db/init');

// ─── MIDDLEWARE ─────────────────────────
app.use(cors());
app.use(express.json());

// ─── STATIC FRONTEND ─────────────────────
app.use(express.static(path.join(__dirname, 'frontend')));

// ─── API ROUTES ──────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/production', require('./routes/production'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/users', require('./routes/users'));

// ─── HEALTH CHECK ────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── SPA FALLBACK ────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// ─── START SERVER (FIX DISINI) ───────────
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDB(); // ⬅️ BLOCK DISINI
    console.log("🔥 DATABASE READY");

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🏭 Konveksi Tracker running on ${PORT}`);
    });

  } catch (err) {
    console.error("❌ GAGAL START SERVER:", err);
    process.exit(1); // biar railway restart
  }
}

startServer();