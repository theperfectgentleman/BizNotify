const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { getBalance } = require('../services/termii');
const db = require('../db');

// GET /dashboard/summary
router.get('/summary', requireAuth, async (req, res) => {
    try {
        const [balanceResult, statsResult, recentResult] = await Promise.all([
            getBalance(),
            db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
          COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
          COUNT(*) FILTER (WHERE status = 'sent')      AS sent,
          COUNT(*)                                      AS total
        FROM messages
      `),
            db.query(`
        SELECT c.id, c.title, c.channel, c.status, c.start_at, c.end_at, c.created_at,
          COUNT(m.id) AS total_messages,
          COUNT(m.id) FILTER (WHERE m.status = 'delivered') AS delivered
        FROM campaigns c
        LEFT JOIN messages m ON m.campaign_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT 5
      `),
        ]);

        const stats = statsResult.rows[0];
        const deliveryRate = stats.total > 0
            ? Math.round((parseInt(stats.delivered) / parseInt(stats.total)) * 100)
            : 0;

        res.json({
            balance: balanceResult.success ? balanceResult : null,
            stats: { ...stats, delivery_rate: deliveryRate },
            recent_campaigns: recentResult.rows,
        });
    } catch (err) {
        console.error('[dashboard/summary]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
