const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard — summary stats
router.get('/', async (req, res) => {
  try {
    // TOTAL TODAY
    const totalTodayRes = await db.query(`
      SELECT COALESCE(SUM(qty_processed),0) as total
      FROM production_logs
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    // TOTAL WEEK
    const totalWeekRes = await db.query(`
      SELECT COALESCE(SUM(qty_processed),0) as total
      FROM production_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    // TOTAL MONTH
    const totalMonthRes = await db.query(`
      SELECT COALESCE(SUM(qty_processed),0) as total
      FROM production_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // ORDER STATUS
    const onProgressRes = await db.query(`
      SELECT COUNT(*) as total FROM orders WHERE status = 'on_progress'
    `);

    const selesaiRes = await db.query(`
      SELECT COUNT(*) as total FROM orders WHERE status = 'selesai'
    `);

    // ACTIVE ORDERS
    const activeOrdersRes = await db.query(`
      SELECT 
        o.id,
        o.order_code,
        o.product_name,
        o.target_qty,
        o.created_at,

        (
          SELECT stage 
          FROM production_logs pl
          WHERE pl.order_id = o.id
          ORDER BY pl.id DESC
          LIMIT 1
        ) AS current_stage,

        (
          SELECT SUM(qty_processed)
          FROM production_logs pl
          WHERE pl.order_id = o.id
            AND pl.stage = (
              SELECT stage 
              FROM production_logs
              WHERE order_id = o.id
              ORDER BY id DESC
              LIMIT 1
            )
        ) AS current_qty,

        (
          SELECT COUNT(*) 
          FROM production_logs 
          WHERE order_id = o.id
        ) AS log_count

      FROM orders o
      WHERE o.status = 'on_progress'
      ORDER BY o.id DESC
    `);

    // STAGE DISTRIBUTION
    const stageDistRes = await db.query(`
      SELECT stage, COUNT(*) as count
      FROM (
        SELECT order_id, stage,
          ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY id DESC) as rn
        FROM production_logs
      ) sub
      JOIN orders o ON o.id = sub.order_id
      WHERE sub.rn = 1 AND o.status = 'on_progress'
      GROUP BY stage
    `);

    res.json({
      stats: {
        totalToday: totalTodayRes.rows[0].total,
        totalWeek: totalWeekRes.rows[0].total,
        totalMonth: totalMonthRes.rows[0].total,
        ordersOnProgress: onProgressRes.rows[0].total,
        ordersSelesai: selesaiRes.rows[0].total
      },
      activeOrders: activeOrdersRes.rows,
      stageDistribution: stageDistRes.rows
    });

  } catch (err) {
    console.error('DASHBOARD ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/report?period=daily|weekly|monthly
router.get('/report', async (req, res) => {
  try {
    const { period = 'daily' } = req.query;

    let queryReport = '';
    let querySummary = '';

    if (period === 'weekly') {
      queryReport = `
        SELECT DATE(created_at) as label,
          SUM(qty_processed) as total_qty_processed,
          COUNT(*) as log_count
        FROM production_logs
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY label ASC
      `;
    } else if (period === 'monthly') {
      queryReport = `
        SELECT DATE(created_at) as label,
          SUM(qty_processed) as total_qty_processed,
          COUNT(*) as log_count
        FROM production_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY label ASC
      `;
    } else {
      // daily
      queryReport = `
        SELECT stage as label,
          SUM(qty_processed) as total_qty_processed,
          COUNT(*) as log_count
        FROM production_logs
        WHERE DATE(created_at) = CURRENT_DATE
        GROUP BY stage
      `;
    }

    querySummary = `
      SELECT o.order_code, o.product_name,
        COUNT(pl.id) as log_count,
        SUM(pl.qty_processed) as total_processed
      FROM production_logs pl
      JOIN orders o ON o.id = pl.order_id
      WHERE pl.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY o.id
      ORDER BY total_processed DESC
    `;

    const reportRes = await db.query(queryReport);
    const summaryRes = await db.query(querySummary);

    res.json({
      period,
      report: reportRes.rows,
      orderSummary: summaryRes.rows
    });

  } catch (err) {
    console.error('REPORT ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;