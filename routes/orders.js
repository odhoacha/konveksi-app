const express = require('express');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/orders — list semua order
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*,
        u.name AS created_by_name,

        (
          SELECT stage 
          FROM production_logs 
          WHERE order_id = o.id
          ORDER BY id DESC
          LIMIT 1
        ) AS current_stage,

        (
          SELECT SUM(qty_processed)
          FROM production_logs
          WHERE order_id = o.id
          AND stage = (
            SELECT stage 
            FROM production_logs 
            WHERE order_id = o.id
            ORDER BY id DESC
            LIMIT 1
          )
        ) AS current_qty

      FROM orders o
      LEFT JOIN users u ON u.id = o.created_by
      ORDER BY o.id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error('GET ORDERS ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/orders/:id — detail order + semua log
router.get('/:id', async (req, res) => {
  try {
    const orderRes = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [req.params.id]
    );

    const order = orderRes.rows[0];
    if (!order) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    const logsRes = await db.query(`
      SELECT pl.*, u.name AS operator_name
      FROM production_logs pl
      LEFT JOIN users u ON u.id = pl.created_by
      WHERE pl.order_id = $1
      ORDER BY pl.id ASC
    `, [req.params.id]);

    res.json({
      ...order,
      logs: logsRes.rows
    });

  } catch (err) {
    console.error('GET ORDER DETAIL ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/orders — tambah order baru (admin+)
router.post('/', authorize('admin','superadmin'), async (req, res) => {
  try {
    const { order_code, product_name, target_qty } = req.body;

    if (!order_code || !product_name || !target_qty) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    if (target_qty <= 0) {
      return res.status(400).json({ error: 'Target qty harus lebih dari 0' });
    }

    const result = await db.query(`
      INSERT INTO orders (order_code, product_name, target_qty, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [order_code, product_name, target_qty, req.user.id]);

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('CREATE ORDER ERROR:', err);

    if (err.code === '23505') {
      return res.status(409).json({ error: 'Kode order sudah digunakan' });
    }

    res.status(500).json({ error: 'Gagal membuat order' });
  }
});

// PUT /api/orders/:id — edit order (admin+)
router.put('/:id', authorize('admin','superadmin'), async (req, res) => {
  try {
    const { product_name, target_qty } = req.body;

    const orderRes = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [req.params.id]
    );

    const order = orderRes.rows[0];

    if (!order) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    const updated = await db.query(`
      UPDATE orders 
      SET product_name = $1, target_qty = $2
      WHERE id = $3
      RETURNING *
    `, [
      product_name || order.product_name,
      target_qty || order.target_qty,
      req.params.id
    ]);

    res.json(updated.rows[0]);

  } catch (err) {
    console.error('UPDATE ORDER ERROR:', err);
    res.status(500).json({ error: 'Gagal update order' });
  }
});

// DELETE /api/orders/:id (superadmin only)
router.delete('/:id', authorize('superadmin'), async (req, res) => {
  try {
    const orderRes = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [req.params.id]
    );

    if (!orderRes.rows[0]) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    await db.query(
      'DELETE FROM orders WHERE id = $1',
      [req.params.id]
    );

    res.json({ message: 'Order berhasil dihapus' });

  } catch (err) {
    console.error('DELETE ORDER ERROR:', err);
    res.status(500).json({ error: 'Gagal hapus order' });
  }
});

module.exports = router;