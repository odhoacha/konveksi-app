const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ✅ FIX: cukup require database biar auto init
const db = require('./db/database');

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── API ROUTES ───────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/production', require('./routes/production'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/users',      require('./routes/users'));

// ─── CATCH ALL → serve frontend SPA ──────────────────────────
// ─── CATCH ALL → serve frontend SPA ──────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── ERROR HANDLER ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏭 Konveksi Tracker berjalan di port ${PORT}`);
});