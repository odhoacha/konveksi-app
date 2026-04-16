const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// hanya superadmin
router.use(authenticate, authorize('superadmin'));

// ─── GET /api/users ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, email, role, created_at
      FROM users
      ORDER BY id ASC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error('GET USERS ERROR:', err);
    res.status(500).json({ error: 'Gagal ambil data user' });
  }
});

// ─── POST /api/users ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    const validRoles = ['operator','admin','superadmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' });
    }

    const hash = bcrypt.hashSync(password, 10);

    const result = await db.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
    `, [name, email, hash, role]);

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('CREATE USER ERROR:', err);

    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email sudah terdaftar' });
    }

    res.status(500).json({ error: 'Gagal membuat user' });
  }
});

// ─── PUT /api/users/:id ───────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, role, password } = req.body;

    const userRes = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [req.params.id]
    );

    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    const newName = name || user.name;
    const newRole = role || user.role;
    const newPass = password ? bcrypt.hashSync(password, 10) : user.password;

    const updated = await db.query(`
      UPDATE users
      SET name = $1, role = $2, password = $3
      WHERE id = $4
      RETURNING id, name, email, role, created_at
    `, [newName, newRole, newPass, req.params.id]);

    res.json(updated.rows[0]);

  } catch (err) {
    console.error('UPDATE USER ERROR:', err);
    res.status(500).json({ error: 'Gagal update user' });
  }
});

// ─── DELETE /api/users/:id ────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    // tidak bisa hapus diri sendiri
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
    }

    const userRes = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [req.params.id]
    );

    if (!userRes.rows[0]) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    await db.query(
      'DELETE FROM users WHERE id = $1',
      [req.params.id]
    );

    res.json({ message: 'User berhasil dihapus' });

  } catch (err) {
    console.error('DELETE USER ERROR:', err);
    res.status(500).json({ error: 'Gagal hapus user' });
  }
});

module.exports = router;