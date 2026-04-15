const express = require('express');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/orders — list semua order
router.get('/', (req, res) => {
  const orders = db.prepare(`
    SELECT o.*,
      u.name AS created_by_name,
      (
        SELECT stage FROM production_logs WHERE order_id = o.id
        GROUP BY stage ORDER BY MIN(id) DESC LIMIT 1
      ) AS current_stage,
      (
        SELECT SUM(qty_processed) FROM production_logs
        WHERE order_id = o.id AND stage = (
          SELECT stage FROM production_logs WHERE order_id = o.id
          GROUP BY stage ORDER BY MIN(id) DESC LIMIT 1
        )
      ) AS current_qty
    FROM orders o
    LEFT JOIN users u ON u.id = o.created_by
    ORDER BY o.id DESC
  `).all();
  res.json(orders);
});

// GET /api/orders/:id — detail order + semua log
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

  const logs = db.prepare(`
    SELECT pl.*, u.name AS operator_name
    FROM production_logs pl
    LEFT JOIN users u ON u.id = pl.created_by
    WHERE pl.order_id = ?
    ORDER BY pl.id ASC
  `).all(req.params.id);

  res.json({ ...order, logs });
});

// POST /api/orders — tambah order baru (admin+)
router.post('/', authorize('admin','superadmin'), (req, res) => {
  const { order_code, product_name, target_qty } = req.body;
  if (!order_code || !product_name || !target_qty)
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  if (target_qty <= 0)
    return res.status(400).json({ error: 'Target qty harus lebih dari 0' });

  try {
    const result = db.prepare(`
      INSERT INTO orders (order_code, product_name, target_qty, created_by)
      VALUES (?, ?, ?, ?)
    `).run(order_code, product_name, target_qty, req.user.id);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(order);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Kode order sudah digunakan' });
    }
    res.status(500).json({ error: 'Gagal membuat order' });
  }
});

// PUT /api/orders/:id — edit order (admin+)
router.put('/:id', authorize('admin','superadmin'), (req, res) => {
  const { product_name, target_qty } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

  db.prepare(`
    UPDATE orders SET product_name = ?, target_qty = ? WHERE id = ?
  `).run(product_name || order.product_name, target_qty || order.target_qty, req.params.id);

  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
});

// DELETE /api/orders/:id (superadmin only)
router.delete('/:id', authorize('superadmin'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ message: 'Order berhasil dihapus' });
});

module.exports = router;
