const express = require('express');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ─── Stage sequence (fixed order, English names) ───────────────
const STAGES = ['Cutting','Sewing','Buttoning','Finishing','QC','Packing','Warehouse'];

// ─── Helper: total qty_processed for a given order+stage ──────
function stageTotal(order_id, stage) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(qty_processed), 0) AS total
    FROM production_logs
    WHERE order_id = ? AND stage = ?
  `).get(order_id, stage);
  return row.total;
}

// GET /api/production — all logs (optional ?order_id filter)
router.get('/', (req, res) => {
  const { order_id } = req.query;
  let query = `
    SELECT pl.*, o.product_name, o.order_code, u.name AS operator_name
    FROM production_logs pl
    JOIN orders o ON o.id = pl.order_id
    LEFT JOIN users u ON u.id = pl.created_by
  `;
  const params = [];
  if (order_id) { query += ' WHERE pl.order_id = ?'; params.push(order_id); }
  query += ' ORDER BY pl.id DESC';

  res.json(db.prepare(query).all(...params));
});

// POST /api/production — input production log
router.post('/', (req, res) => {
  const { order_id, stage, qty_processed, note } = req.body;

  // ── 1. Basic field validation
  if (!order_id || !stage || qty_processed == null)
    return res.status(400).json({ error: 'Semua field wajib diisi (order_id, stage, qty_processed)' });

  if (!STAGES.includes(stage))
    return res.status(400).json({ error: `Tahap tidak valid. Pilihan: ${STAGES.join(', ')}` });

  if (!Number.isInteger(qty_processed) || qty_processed <= 0)
    return res.status(400).json({ error: 'qty_processed harus bilangan bulat positif' });

  // ── 2. Order must exist and be active
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  if (order.status === 'selesai')
    return res.status(400).json({ error: 'Order ini sudah selesai' });

  const stageIndex = STAGES.indexOf(stage);

  // ── 3. Stage-specific capacity validation
  if (stageIndex === 0) {
    // FIRST STAGE (Cutting): cap is order's target_qty
    const alreadyCut = stageTotal(order_id, stage);
    const remaining  = order.target_qty - alreadyCut;

    if (remaining <= 0)
      return res.status(400).json({
        error: `Tahap ${stage} sudah mencapai target qty (${order.target_qty} pcs). Tidak ada sisa yang bisa diproses.`
      });

    if (qty_processed > remaining)
      return res.status(400).json({
        error: `Melebihi kapasitas! Sisa yang bisa diproses di ${stage}: ${remaining} pcs (target: ${order.target_qty}, sudah diproses: ${alreadyCut}).`
      });

  } else {
    // SUBSEQUENT STAGES: cap is total processed in the previous stage
    const prevStage     = STAGES[stageIndex - 1];
    const prevTotal     = stageTotal(order_id, prevStage);
    const currentTotal  = stageTotal(order_id, stage);
    const remaining     = prevTotal - currentTotal;

    // Previous stage must have at least some units processed
    if (prevTotal === 0)
      return res.status(400).json({
        error: `Tahap "${prevStage}" belum ada produksi. Proses "${prevStage}" terlebih dahulu.`
      });

    if (remaining <= 0)
      return res.status(400).json({
        error: `Tahap ${stage} sudah memproses semua unit dari ${prevStage} (${prevTotal} pcs). Tidak ada sisa.`
      });

    if (qty_processed > remaining)
      return res.status(400).json({
        error: `Melebihi kapasitas! Sisa yang bisa diproses di ${stage}: ${remaining} pcs (dari ${prevStage}: ${prevTotal}, sudah diproses: ${currentTotal}).`
      });
  }

  // ── 4. Insert log
  const result = db.prepare(`
    INSERT INTO production_logs (order_id, stage, qty_processed, note, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(order_id, stage, qty_processed, note || '', req.user.id);

  // ── 5. Auto-complete order when Warehouse total equals Cutting total
  if (stage === 'Warehouse') {
    const warehouseTotal = stageTotal(order_id, 'Warehouse');
    const cuttingTotal   = stageTotal(order_id, 'Cutting');
    if (warehouseTotal >= cuttingTotal && cuttingTotal > 0) {
      db.prepare(`UPDATE orders SET status = 'selesai' WHERE id = ?`).run(order_id);
    }
  }

  const log = db.prepare(`
    SELECT pl.*, u.name AS operator_name
    FROM production_logs pl LEFT JOIN users u ON u.id = pl.created_by
    WHERE pl.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(log);
});

// DELETE /api/production/:id (superadmin only)
router.delete('/:id', authorize('superadmin'), (req, res) => {
  const log = db.prepare('SELECT * FROM production_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Log tidak ditemukan' });

  db.prepare('DELETE FROM production_logs WHERE id = ?').run(req.params.id);
  res.json({ message: 'Log berhasil dihapus' });
});

module.exports = router;

