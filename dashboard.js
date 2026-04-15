const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard — summary stats
router.get('/', (req, res) => {
  const today    = new Date().toISOString().slice(0, 10);
  const weekAgo  = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const totalToday = db.prepare(`
    SELECT COALESCE(SUM(qty_processed),0) as total
    FROM production_logs WHERE DATE(created_at) = ?
  `).get(today).total;

  const totalWeek = db.prepare(`
    SELECT COALESCE(SUM(qty_processed),0) as total
    FROM production_logs WHERE DATE(created_at) >= ?
  `).get(weekAgo).total;

  const totalMonth = db.prepare(`
    SELECT COALESCE(SUM(qty_processed),0) as total
    FROM production_logs WHERE DATE(created_at) >= ?
  `).get(monthAgo).total;

  const ordersOnProgress = db.prepare(`
    SELECT COUNT(*) as total FROM orders WHERE status = 'on_progress'
  `).get().total;

  const ordersSelesai = db.prepare(`
    SELECT COUNT(*) as total FROM orders WHERE status = 'selesai'
  `).get().total;

  // Active orders: show furthest stage reached + total processed in that stage
  const activeOrders = db.prepare(`
    SELECT o.id, o.order_code, o.product_name, o.target_qty, o.created_at,
      (
        SELECT stage FROM production_logs
        WHERE order_id = o.id
        GROUP BY stage
        ORDER BY MIN(id) DESC LIMIT 1
      ) AS current_stage,
      (
        SELECT SUM(qty_processed) FROM production_logs
        WHERE order_id = o.id AND stage = (
          SELECT stage FROM production_logs
          WHERE order_id = o.id
          GROUP BY stage
          ORDER BY MIN(id) DESC LIMIT 1
        )
      ) AS current_qty,
      (SELECT COUNT(*) FROM production_logs WHERE order_id = o.id) AS log_count
    FROM orders o
    WHERE o.status = 'on_progress'
    ORDER BY o.id DESC
  `).all();

  // Stage distribution (how many on_progress orders are currently at each stage)
  const stageDistribution = db.prepare(`
    SELECT sub.stage, COUNT(*) as count
    FROM (
      SELECT order_id, stage,
        ROW_NUMBER() OVER (PARTITION BY order_id, stage ORDER BY id DESC) as rn
      FROM production_logs
    ) sub
    JOIN orders o ON o.id = sub.order_id
    WHERE sub.rn = 1 AND o.status = 'on_progress'
    GROUP BY sub.stage
  `).all();

  res.json({
    stats: { totalToday, totalWeek, totalMonth, ordersOnProgress, ordersSelesai },
    activeOrders,
    stageDistribution
  });
});

// GET /api/dashboard/report?period=daily|weekly|monthly
router.get('/report', (req, res) => {
  const { period = 'daily' } = req.query;

  let dateFilter, groupBy, dateFormat;
  switch (period) {
    case 'weekly':
      dateFilter = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      groupBy = `DATE(pl.created_at)`;
      dateFormat = `DATE(pl.created_at)`;
      break;
    case 'monthly':
      dateFilter = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      groupBy = `DATE(pl.created_at)`;
      dateFormat = `DATE(pl.created_at)`;
      break;
    default: // daily = hari ini per tahap
      dateFilter = new Date().toISOString().slice(0, 10);
      groupBy = `pl.stage`;
      dateFormat = `pl.stage`;
  }

  const report = db.prepare(`
    SELECT ${dateFormat} as label,
      SUM(pl.qty_processed) AS total_qty_processed,
      COUNT(*)              AS log_count
    FROM production_logs pl
    WHERE DATE(pl.created_at) >= ?
    GROUP BY ${groupBy}
    ORDER BY pl.created_at ASC
  `).all(dateFilter);

  // Per-order summary for the period
  const orderSummary = db.prepare(`
    SELECT o.order_code, o.product_name, COUNT(pl.id) as log_count,
      SUM(pl.qty_processed) as total_processed
    FROM production_logs pl
    JOIN orders o ON o.id = pl.order_id
    WHERE DATE(pl.created_at) >= ?
    GROUP BY o.id
    ORDER BY total_processed DESC
  `).all(dateFilter);

  res.json({ period, report, orderSummary });
});

module.exports = router;
