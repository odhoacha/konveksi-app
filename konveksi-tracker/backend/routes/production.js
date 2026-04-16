const express = require('express');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ─── Stage sequence ───────────────────────────────────────────
const STAGES = ['Cutting','Sewing','Buttoning','Finishing','QC','Packing','Warehouse'];

// ─── Helper: total qty per stage ──────────────────────────────
async function stageTotal(order_id, stage) {
  const result = await db.query(`
    SELECT COALESCE(SUM(qty_processed), 0) AS total
    FROM production_logs
    WHERE order_id = $1 AND stage = $2
  `, [order_id, stage]);

  return parseInt(result.rows[0].total);
}

// ─── GET logs ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { order_id } = req.query;

    let query = `
      SELECT pl.*, o.product_name, o.order_code, u.name AS operator_name
      FROM production_logs pl
      JOIN orders o ON o.id = pl.order_id
      LEFT JOIN users u ON u.id = pl.created_by
    `;

    const params = [];

    if (order_id) {
      query += ' WHERE pl.order_id = $1';
      params.push(order_id);
    }

    query += ' ORDER BY pl.id DESC';

    const result = await db.query(query, params);
    res.json(result.rows);

  } catch (err) {
    console.error('GET PRODUCTION ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST production log ──────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { order_id, stage, qty_processed, note } = req.body;

    // 1. VALIDATION
    if (!order_id || !stage || qty_processed == null) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    if (!STAGES.includes(stage)) {
      return res.status(400).json({ error: 'Stage tidak valid' });
    }

    if (!Number.isInteger(qty_processed) || qty_processed <= 0) {
      return res.status(400).json({ error: 'Qty harus angka > 0' });
    }

    // 2. CHECK ORDER
    const orderRes = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [order_id]
    );

    const order = orderRes.rows[0];

    if (!order) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    if (order.status === 'selesai') {
      return res.status(400).json({ error: 'Order sudah selesai' });
    }

    const stageIndex = STAGES.indexOf(stage);

    // 3. CORE LOGIC (FIXED 🔥)

    if (stageIndex === 0) {
      // CUTTING = satu-satunya batas real
      const cuttingTotal = await stageTotal(order_id, 'Cutting');
      const remaining = order.target_qty - cuttingTotal;

      if (remaining <= 0) {
        return res.status(400).json({
          error: `Cutting sudah mencapai target (${order.target_qty})`
        });
      }

      if (qty_processed > remaining) {
        return res.status(400).json({
          error: `Melebihi sisa Cutting (${remaining} pcs)`
        });
      }

    } else {
      // SEMUA STAGE SETELAH CUTTING

      const prevStage = STAGES[stageIndex - 1];

      const prevTotal = await stageTotal(order_id, prevStage);
      const currentTotal = await stageTotal(order_id, stage);

      // ❗ FIX UTAMA:
      // Tidak lagi maksa harus "pindah stage"
      // Tapi berdasarkan FLOW QTY

      const available = prevTotal - currentTotal;

      if (prevTotal === 0) {
        return res.status(400).json({
          error: `Belum ada hasil dari ${prevStage}`
        });
      }

      if (available <= 0) {
        return res.status(400).json({
          error: `Semua qty dari ${prevStage} sudah diproses ke ${stage}`
        });
      }

      if (qty_processed > available) {
        return res.status(400).json({
          error: `Melebihi sisa dari ${prevStage} (${available} pcs)`
        });
      }
    }

    // 4. INSERT
    const insert = await db.query(`
      INSERT INTO production_logs (order_id, stage, qty_processed, note, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [order_id, stage, qty_processed, note || '', req.user.id]);

    const newLog = insert.rows[0];

    // 5. AUTO COMPLETE
    if (stage === 'Warehouse') {
      const warehouseTotal = await stageTotal(order_id, 'Warehouse');
      const cuttingTotal   = await stageTotal(order_id, 'Cutting');

      if (warehouseTotal >= cuttingTotal && cuttingTotal > 0) {
        await db.query(
          `UPDATE orders SET status = 'selesai' WHERE id = $1`,
          [order_id]
        );
      }
    }

    res.status(201).json(newLog);

  } catch (err) {
    console.error('CREATE PRODUCTION ERROR:', err);
    res.status(500).json({ error: 'Gagal input produksi' });
  }
});

// ─── DELETE log ───────────────────────────────────────────────
router.delete('/:id', authorize('superadmin'), async (req, res) => {
  try {
    const check = await db.query(
      'SELECT * FROM production_logs WHERE id = $1',
      [req.params.id]
    );

    if (!check.rows[0]) {
      return res.status(404).json({ error: 'Log tidak ditemukan' });
    }

    await db.query(
      'DELETE FROM production_logs WHERE id = $1',
      [req.params.id]
    );

    res.json({ message: 'Log berhasil dihapus' });

  } catch (err) {
    console.error('DELETE LOG ERROR:', err);
    res.status(500).json({ error: 'Gagal hapus log' });
  }
});

module.exports = router;