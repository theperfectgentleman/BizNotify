const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { enqueueCampaignJobs } = require('../workers/queue');

// POST /messages/send
router.post('/send', requireAuth, async (req, res) => {
    try {
        const { title, message_body, channel = 'sms', group_ids, contact_ids, scheduled_at } = req.body;

        if (!title || !message_body) {
            return res.status(400).json({ error: 'title and message_body are required' });
        }
        if ((!group_ids || !group_ids.length) && (!contact_ids || !contact_ids.length)) {
            return res.status(400).json({ error: 'At least one group_id or contact_id is required' });
        }

        // Resolve all unique contacts from groups + direct contact_ids
        let contactQuery;
        if (group_ids && group_ids.length > 0 && contact_ids && contact_ids.length > 0) {
            contactQuery = await db.query(
                `SELECT DISTINCT c.id, c.phone_number, c.first_name, c.last_name
         FROM contacts c
         WHERE c.opt_out = FALSE AND (
           c.id IN (SELECT contact_id FROM contact_groups WHERE group_id = ANY($1::uuid[]))
           OR c.id = ANY($2::uuid[])
         )`,
                [group_ids, contact_ids]
            );
        } else if (group_ids && group_ids.length > 0) {
            contactQuery = await db.query(
                `SELECT DISTINCT c.id, c.phone_number, c.first_name, c.last_name
         FROM contacts c
         JOIN contact_groups cg ON cg.contact_id = c.id
         WHERE c.opt_out = FALSE AND cg.group_id = ANY($1::uuid[])`,
                [group_ids]
            );
        } else {
            contactQuery = await db.query(
                `SELECT id, phone_number, first_name, last_name FROM contacts WHERE id = ANY($1::uuid[]) AND opt_out = FALSE`,
                [contact_ids]
            );
        }

        const contacts = contactQuery.rows;
        if (contacts.length === 0) {
            return res.status(400).json({ error: 'No eligible contacts found (check opt-out status)' });
        }

        const client = await db.getClient();
        let campaign;
        try {
            await client.query('BEGIN');

            // Create campaign
            const { rows: campaignRows } = await client.query(
                `INSERT INTO campaigns (user_id, title, message_body, channel, scheduled_at, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [req.user.id, title, message_body, channel, scheduled_at || null, scheduled_at ? 'queued' : 'processing']
            );
            campaign = campaignRows[0];

            // Create message records
            const messageInserts = contacts.map((c) =>
                client.query(
                    `INSERT INTO messages (campaign_id, contact_id, status) VALUES ($1, $2, 'queued') RETURNING id`,
                    [campaign.id, c.id]
                )
            );
            const messageResults = await Promise.all(messageInserts);

            await client.query('COMMIT');

            // Build queue jobs
            const jobs = contacts.map((c, idx) => {
                // Replace template variables
                const personalizedBody = message_body
                    .replace(/\{\{first_name\}\}/gi, c.first_name || '')
                    .replace(/\{\{last_name\}\}/gi, c.last_name || '')
                    .replace(/\{\{phone\}\}/gi, c.phone_number);

                return {
                    messageId: messageResults[idx].rows[0].id,
                    contactId: c.id,
                    phone: c.phone_number,
                    messageBody: personalizedBody,
                    channel,
                };
            });

            await enqueueCampaignJobs(campaign.id, jobs);

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.status(201).json({
            campaign,
            queued: contacts.length,
            message: `Campaign created and ${contacts.length} messages queued`,
        });
    } catch (err) {
        console.error('[messages/send]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /messages/stats
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent')       AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered')  AS delivered,
        COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
        COUNT(*) FILTER (WHERE status = 'queued')     AS queued,
        COUNT(*)                                       AS total
      FROM messages
    `);

        const { rows: campaignStats } = await db.query(`
      SELECT COUNT(*) AS total_campaigns,
             COUNT(*) FILTER (WHERE status = 'completed') AS completed_campaigns
      FROM campaigns
    `);

        res.json({ ...rows[0], ...campaignStats[0] });
    } catch (err) {
        console.error('[messages/stats]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /messages/logs
router.get('/logs', requireAuth, async (req, res) => {
    try {
        const { campaign_id, status, search, page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const params = [];
        let where = 'WHERE 1=1';

        if (campaign_id) {
            params.push(campaign_id);
            where += ` AND m.campaign_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            where += ` AND m.status = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            where += ` AND (c.phone_number ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length})`;
        }

        params.push(Number(limit), offset);

        const { rows } = await db.query(
            `SELECT m.*, c.phone_number, c.first_name, c.last_name, cp.title AS campaign_title
       FROM messages m
       JOIN contacts c ON c.id = m.contact_id
       JOIN campaigns cp ON cp.id = m.campaign_id
       ${where}
       ORDER BY m.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ logs: rows, page: Number(page), limit: Number(limit) });
    } catch (err) {
        console.error('[messages/logs]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /messages/campaigns - list campaigns
router.get('/campaigns', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(`
      SELECT c.*,
        COUNT(m.id) AS total_messages,
        COUNT(m.id) FILTER (WHERE m.status = 'delivered') AS delivered,
        COUNT(m.id) FILTER (WHERE m.status = 'failed') AS failed,
        COUNT(m.id) FILTER (WHERE m.status = 'sent') AS sent
      FROM campaigns c
      LEFT JOIN messages m ON m.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
        res.json(rows);
    } catch (err) {
        console.error('[messages/campaigns]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
