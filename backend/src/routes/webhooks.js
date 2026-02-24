const router = require('express').Router();
const db = require('../db');
const { refreshCampaignItemStatus } = require('../workers/queue');

/**
 * POST /api/webhooks/termii
 *
 * Public endpoint — Termii posts delivery reports here.
 * No auth required (Termii doesn't send tokens), but validate the payload shape.
 *
 * Expected payload shape (varies by Termii plan):
 * {
 *   "message_id": "abc123",
 *   "status": "delivered" | "failed" | "expired" | "sent",
 *   "phone_number": "234...",
 *   ...
 * }
 */
router.post('/termii', async (req, res) => {
    try {
        const payload = req.body;
        const termiiMessageId = payload.message_id || payload.messageid || payload.msg_id;
        const rawStatus = (payload.status || '').toLowerCase();

        if (!termiiMessageId) {
            console.warn('[webhook/termii] Missing message_id in payload:', payload);
            return res.status(200).json({ ok: false, reason: 'Missing message_id' });
        }

        // Map Termii statuses to our internal statuses
        const statusMap = {
            delivered: 'delivered',
            success: 'delivered',
            sent: 'sent',
            failed: 'failed',
            expired: 'expired',
            rejected: 'failed',
            undelivered: 'failed',
        };
        const internalStatus = statusMap[rawStatus] || 'sent';

        const { rows } = await db.query(
            `UPDATE messages
             SET status = $1, updated_at = NOW()
             WHERE termii_message_id = $2
             RETURNING campaign_item_id`,
            [internalStatus, termiiMessageId]
        );
        const rowCount = rows.length;

        const touchedCampaignItemIds = [...new Set(rows.map((row) => row.campaign_item_id).filter(Boolean))];
        for (const campaignItemId of touchedCampaignItemIds) {
            await refreshCampaignItemStatus(campaignItemId);
        }

        if (rowCount === 0) {
            console.warn(`[webhook/termii] No message found for termii_message_id: ${termiiMessageId}`);
        }

        // Always return 200 so Termii doesn't retry
        res.status(200).json({ ok: true, updated: rowCount });
    } catch (err) {
        console.error('[webhook/termii]', err);
        // Still 200 — don't cause Termii to flood us with retries
        res.status(200).json({ ok: false, error: 'Internal error' });
    }
});

module.exports = router;
