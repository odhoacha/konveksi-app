const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('superadmin'));

// GET /api/users
router.get('/', (req, res) => {
  const users = db.prepare(
    'SELECT id, name, email, role, created_at FROM users ORDER BY id ASC'
  ).all();
  res.json(users);
});

// POST /api/users
router.post('/', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'Semua field wajib diisi' });

  const validRoles = ['operator','admin','superadmin'];
  if (!validRoles.includes(role))
    return res.status(400).json({ error: 'Role tidak valid' });

  try {
    const hash   = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).run(name, email, hash, role);

    const user = db.prepare(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Email sudah terdaftar' });
    res.status(500).json({ error: 'Gagal membuat user' });
  }
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  const { name, role, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  const newName = name || user.name;
  const newRole = role || user.role;
  const newPass = password ? bcrypt.hashSync(password, 10) : user.password;

  db.prepare(
    'UPDATE users SET name = ?, role = ?, password = ? WHERE id = ?'
  ).run(newName, newRole, newPass, req.params.id);

  res.json(db.prepare(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?'
  ).get(req.params.id));
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User berhasil dihapus' });
});

module.exports = router;
