const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
    enqueueCampaignJobs,
    enqueueInstantBulkJobs,
    enqueueScheduledJob,
    scheduleCampaignItemDispatch,
} = require('../workers/queue');
const { normalizePhone, isValidPhone } = require('../utils/phone');

function normalizeCampaignChannel(value) {
    const channel = String(value || 'generic').toLowerCase();
    if (channel === 'whatsapp') return 'whatsapp';
    if (channel === 'sms') return 'generic';
    if (channel === 'dnd') return 'dnd';
    return 'generic';
}

function normalizeCampaignStorageChannel(value) {
    const channel = String(value || 'generic').toLowerCase();
    return channel === 'whatsapp' ? 'whatsapp' : 'sms';
}

async function replaceCampaignItemAudience(client, campaignItemId, groupIds = [], contactIds = []) {
    await client.query(`DELETE FROM campaign_item_groups WHERE campaign_item_id = $1`, [campaignItemId]);
    await client.query(`DELETE FROM campaign_item_contacts WHERE campaign_item_id = $1`, [campaignItemId]);

    if (Array.isArray(groupIds) && groupIds.length > 0) {
        await Promise.all(
            groupIds.map((groupId) =>
                client.query(
                    `INSERT INTO campaign_item_groups (campaign_item_id, group_id)
                     VALUES ($1, $2)
                     ON CONFLICT (campaign_item_id, group_id) DO NOTHING`,
                    [campaignItemId, groupId]
                )
            )
        );
    }

    if (Array.isArray(contactIds) && contactIds.length > 0) {
        await Promise.all(
            contactIds.map((contactId) =>
                client.query(
                    `INSERT INTO campaign_item_contacts (campaign_item_id, contact_id)
                     VALUES ($1, $2)
                     ON CONFLICT (campaign_item_id, contact_id) DO NOTHING`,
                    [campaignItemId, contactId]
                )
            )
        );
    }
}

// POST /messages/send
router.post('/send', requireAuth, async (req, res) => {
    try {
        const {
            title,
            message_body,
            per_group_messages,
            channel = 'generic',
            sender_id = null,
            message_type = 'plain',
            group_ids,
            contact_ids,
            scheduled_at
        } = req.body;

        const normalizedGroupMessages = Array.isArray(per_group_messages)
            ? per_group_messages
                .map((entry) => ({
                    group_id: entry?.group_id,
                    message_body: String(entry?.message_body || '').trim(),
                }))
                .filter((entry) => entry.group_id && entry.message_body)
            : [];
        const isMultiMessageCampaign = normalizedGroupMessages.length > 0;
        const effectiveCampaignBody = isMultiMessageCampaign
            ? (String(message_body || '').trim() || normalizedGroupMessages[0].message_body)
            : String(message_body || '').trim();

        if (!title || !effectiveCampaignBody) {
            return res.status(400).json({ error: 'title and message_body are required' });
        }
        if (!isMultiMessageCampaign && (!group_ids || !group_ids.length) && (!contact_ids || !contact_ids.length)) {
            return res.status(400).json({ error: 'At least one group_id or contact_id is required' });
        }
        if (isMultiMessageCampaign && normalizedGroupMessages.length === 0) {
            return res.status(400).json({ error: 'per_group_messages must include at least one group/message pair' });
        }

        let contacts = [];
        if (isMultiMessageCampaign) {
            const groupIds = normalizedGroupMessages.map((entry) => entry.group_id);
            const groupMessageMap = new Map(normalizedGroupMessages.map((entry) => [entry.group_id, entry.message_body]));
            const groupPriority = new Map(normalizedGroupMessages.map((entry, index) => [entry.group_id, index]));

            const { rows } = await db.query(
                `SELECT c.id, c.phone_number, c.first_name, c.last_name, cg.group_id
                 FROM contacts c
                 JOIN contact_groups cg ON cg.contact_id = c.id
                 WHERE c.opt_out = FALSE AND cg.group_id = ANY($1::uuid[])`,
                [groupIds]
            );

            const recipientsByContact = new Map();
            rows.forEach((row) => {
                const priority = groupPriority.get(row.group_id);
                if (priority === undefined) return;

                const existing = recipientsByContact.get(row.id);
                if (!existing || priority < existing.priority) {
                    recipientsByContact.set(row.id, {
                        id: row.id,
                        phone_number: row.phone_number,
                        first_name: row.first_name,
                        last_name: row.last_name,
                        variantMessage: groupMessageMap.get(row.group_id),
                        priority,
                    });
                }
            });

            contacts = [...recipientsByContact.values()];
        } else {
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

            contacts = contactQuery.rows;
        }

        if (contacts.length === 0) {
            return res.status(400).json({ error: 'No eligible contacts found (check opt-out status)' });
        }

        const client = await db.getClient();
        let campaign;
        let campaignItem;
        try {
            await client.query('BEGIN');

            // Create campaign
            const { rows: campaignRows } = await client.query(
                `INSERT INTO campaigns (user_id, title, message_body, channel, scheduled_at, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [req.user.id, title, effectiveCampaignBody, normalizeCampaignStorageChannel(channel), scheduled_at || null, scheduled_at ? 'queued' : 'processing']
            );
            campaign = campaignRows[0];

            const { rows: campaignItemRows } = await client.query(
                `INSERT INTO campaign_items
                 (campaign_id, title, message_body, channel, sender_id, message_type, scheduled_at, status, position, queue_job_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)
                 RETURNING *`,
                [
                    campaign.id,
                    title,
                    effectiveCampaignBody,
                    normalizeCampaignChannel(channel),
                    sender_id,
                    message_type,
                    scheduled_at || new Date().toISOString(),
                    scheduled_at ? 'scheduled' : 'queued',
                    null,
                ]
            );
            campaignItem = campaignItemRows[0];

            await replaceCampaignItemAudience(client, campaignItem.id, group_ids || [], contact_ids || []);

            // Create message records
            const messageInserts = contacts.map((c) =>
                client.query(
                    `INSERT INTO messages (campaign_id, campaign_item_id, contact_id, status) VALUES ($1, $2, $3, 'queued') RETURNING id`,
                    [campaign.id, campaignItem.id, c.id]
                )
            );
            const messageResults = await Promise.all(messageInserts);

            await client.query('COMMIT');

            // Build queue jobs
            const jobs = contacts.map((c, idx) => {
                // Replace template variables
                const sourceMessage = isMultiMessageCampaign ? c.variantMessage : effectiveCampaignBody;
                const personalizedBody = sourceMessage
                    .replace(/\{\{first_name\}\}/gi, c.first_name || '')
                    .replace(/\{\{last_name\}\}/gi, c.last_name || '')
                    .replace(/\{\{phone\}\}/gi, c.phone_number);

                return {
                    messageId: messageResults[idx].rows[0].id,
                    campaignItemId: campaignItem.id,
                    contactId: c.id,
                    phone: c.phone_number,
                    messageBody: personalizedBody,
                    channel,
                    customSender: sender_id,
                    msgType: message_type,
                };
            });

            if (scheduled_at) {
                await Promise.all(
                    jobs.map((jobData) => enqueueScheduledJob(campaign.id, jobData, scheduled_at))
                );
            } else {
                await enqueueCampaignJobs(campaign.id, jobs);
            }

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

// POST /messages/instant
router.post('/instant', requireAuth, async (req, res) => {
    try {
        const {
            target_phones = '',
            group_ids = [],
            message_body,
            channel = 'generic',
            sender_id = null,
            message_type = 'plain'
        } = req.body;

        if (!message_body || !String(message_body).trim()) {
            return res.status(400).json({ error: 'message_body is required' });
        }

        const manualPhones = String(target_phones)
            .split(/[\s,;]+/)
            .map((value) => normalizePhone(value))
            .filter((value) => isValidPhone(value));

        const recipientMap = new Map();

        if (Array.isArray(group_ids) && group_ids.length > 0) {
            const { rows: groupContacts } = await db.query(
                `SELECT DISTINCT c.id AS contact_id, c.phone_number
                 FROM contacts c
                 INNER JOIN contact_groups cg ON cg.contact_id = c.id
                 WHERE c.opt_out = FALSE AND cg.group_id = ANY($1::uuid[])`,
                [group_ids]
            );

            groupContacts.forEach((contact) => {
                const phone = normalizePhone(contact.phone_number);
                if (!isValidPhone(phone)) return;
                recipientMap.set(phone, { phone, contactId: contact.contact_id });
            });
        }

        if (manualPhones.length > 0) {
            const uniqueManualPhones = [...new Set(manualPhones)];
            const { rows: existingContacts } = await db.query(
                `SELECT id, phone_number FROM contacts WHERE phone_number = ANY($1::text[])`,
                [uniqueManualPhones]
            );
            const contactPhoneMap = new Map(
                existingContacts
                    .map((contact) => [normalizePhone(contact.phone_number), contact.id])
                    .filter(([phone]) => isValidPhone(phone))
            );

            uniqueManualPhones.forEach((phone) => {
                const existing = recipientMap.get(phone);
                recipientMap.set(phone, {
                    phone,
                    contactId: existing?.contactId || contactPhoneMap.get(phone) || null,
                });
            });
        }

        const recipients = [...recipientMap.values()];
        if (recipients.length === 0) {
            return res.status(400).json({ error: 'No valid recipients found from groups or target numbers' });
        }

        const maxRecipients = Number(process.env.INSTANT_MAX_RECIPIENTS || 50000);
        if (Number.isFinite(maxRecipients) && maxRecipients > 0 && recipients.length > maxRecipients) {
            return res.status(400).json({
                error: `Recipient count exceeds limit (${maxRecipients}). Reduce selected groups or target numbers.`
            });
        }

        const client = await db.getClient();
        let persistedRecipients;
        try {
            await client.query('BEGIN');

            const inserts = recipients.map((recipient) =>
                client.query(
                    `INSERT INTO messages (contact_id, target_phone, status)
                     VALUES ($1, $2, 'queued')
                     RETURNING id`,
                    [recipient.contactId, recipient.phone]
                )
            );
            const insertResults = await Promise.all(inserts);

            persistedRecipients = recipients.map((recipient, idx) => ({
                phone: recipient.phone,
                messageId: insertResults[idx].rows[0].id,
            }));

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        let batches;
        if (channel === 'whatsapp') {
            const jobs = persistedRecipients.map((recipient) => ({
                messageId: recipient.messageId,
                phone: recipient.phone,
                messageBody: message_body,
                channel,
                customSender: sender_id,
                msgType: message_type,
            }));
            await enqueueCampaignJobs(null, jobs);
            batches = jobs.length;
        } else {
            batches = await enqueueInstantBulkJobs({
                recipients: persistedRecipients,
                messageBody: message_body,
                channel,
                customSender: sender_id,
                msgType: message_type,
            });
        }

        return res.status(202).json({
            message: 'Instant message queued for background delivery',
            count: recipients.length,
            batches,
        });
    } catch (err) {
        console.error('[messages/instant]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /messages/campaigns - create campaign shell
router.post('/campaigns', requireAuth, async (req, res) => {
    try {
        const { title, channel = 'generic' } = req.body;
        if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'title is required' });
        }

        const { rows } = await db.query(
            `INSERT INTO campaigns (user_id, title, message_body, channel, status)
             VALUES ($1, $2, $3, $4, 'draft')
             RETURNING *`,
            [
                req.user.id,
                String(title).trim(),
                'Campaign series',
                normalizeCampaignStorageChannel(channel)
            ]
        );

        return res.status(201).json({ campaign: rows[0] });
    } catch (err) {
        console.error('[messages/campaigns:create]', err);
        return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
    }
});

// GET /messages/campaigns/:campaignId/items
router.get('/campaigns/:campaignId/items', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;

        const { rows: campaignRows } = await db.query(
            `SELECT id, title, channel, status, created_at, updated_at
             FROM campaigns
             WHERE id = $1 AND user_id = $2`,
            [campaignId, req.user.id]
        );
        const campaign = campaignRows[0];
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const { rows: items } = await db.query(
            `SELECT
               ci.*,
               COUNT(m.id)::int AS total_messages,
               COUNT(m.id) FILTER (WHERE m.status IN ('sent', 'delivered'))::int AS sent_messages,
               COUNT(m.id) FILTER (WHERE m.status = 'failed')::int AS failed_messages,
               COUNT(m.id) FILTER (WHERE m.status = 'queued')::int AS queued_messages,
               (ci.status IN ('draft', 'scheduled')) AS can_edit
             FROM campaign_items ci
             LEFT JOIN messages m ON m.campaign_item_id = ci.id
             WHERE ci.campaign_id = $1
             GROUP BY ci.id
             ORDER BY ci.scheduled_at ASC, ci.position ASC`,
            [campaignId]
        );

        return res.json({ campaign, items });
    } catch (err) {
        console.error('[messages/campaign-items:list]', err);
        return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
    }
});

// POST /messages/campaigns/:campaignId/items
router.post('/campaigns/:campaignId/items', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const {
            title = null,
            message_body,
            scheduled_at,
            group_ids = [],
            contact_ids = [],
            channel = 'generic',
            sender_id = null,
            message_type = 'plain',
        } = req.body;

        if (!message_body || !String(message_body).trim()) {
            return res.status(400).json({ error: 'message_body is required' });
        }
        if (!scheduled_at) {
            return res.status(400).json({ error: 'scheduled_at is required' });
        }
        if ((!Array.isArray(group_ids) || group_ids.length === 0) && (!Array.isArray(contact_ids) || contact_ids.length === 0)) {
            return res.status(400).json({ error: 'At least one group_id or contact_id is required' });
        }

        const { rows: campaignRows } = await db.query(
            `SELECT id FROM campaigns WHERE id = $1 AND user_id = $2`,
            [campaignId, req.user.id]
        );
        if (!campaignRows[0]) return res.status(404).json({ error: 'Campaign not found' });

        const dispatchToken = randomUUID();
        const client = await db.getClient();
        let campaignItem;
        try {
            await client.query('BEGIN');

            const { rows: positionRows } = await client.query(
                `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
                 FROM campaign_items
                 WHERE campaign_id = $1`,
                [campaignId]
            );
            const nextPosition = Number(positionRows[0].next_position || 1);

            const { rows: itemRows } = await client.query(
                `INSERT INTO campaign_items
                 (campaign_id, title, message_body, channel, sender_id, message_type, scheduled_at, status, position, queue_job_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9)
                 RETURNING *`,
                [
                    campaignId,
                    title ? String(title).trim() : null,
                    String(message_body).trim(),
                    normalizeCampaignChannel(channel),
                    sender_id,
                    message_type,
                    scheduled_at,
                    nextPosition,
                    dispatchToken,
                ]
            );
            campaignItem = itemRows[0];

            await replaceCampaignItemAudience(client, campaignItem.id, group_ids, contact_ids);

            await client.query(
                `UPDATE campaigns
                 SET status = 'queued', updated_at = NOW()
                 WHERE id = $1`,
                [campaignId]
            );

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        try {
            await scheduleCampaignItemDispatch(campaignItem.id, scheduled_at, dispatchToken);
        } catch (err) {
            await db.query(
                `UPDATE campaign_items SET status = 'failed', updated_at = NOW() WHERE id = $1`,
                [campaignItem.id]
            );
            throw err;
        }

        return res.status(201).json({ item: campaignItem });
    } catch (err) {
        console.error('[messages/campaign-items:create]', err);
        return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
    }
});

// PATCH /messages/campaign-items/:itemId
router.patch('/campaign-items/:itemId', requireAuth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const {
            title,
            message_body,
            scheduled_at,
            group_ids,
            contact_ids,
            channel,
            sender_id,
            message_type,
        } = req.body;

        const { rows: itemRows } = await db.query(
            `SELECT ci.*, c.user_id
             FROM campaign_items ci
             JOIN campaigns c ON c.id = ci.campaign_id
             WHERE ci.id = $1`,
            [itemId]
        );
        const current = itemRows[0];
        if (!current || current.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Campaign item not found' });
        }
        if (!['draft', 'scheduled'].includes(current.status)) {
            return res.status(400).json({ error: 'Only draft/scheduled items can be edited' });
        }

        const nextScheduledAt = scheduled_at || current.scheduled_at;
        const nextDispatchToken = randomUUID();

        const client = await db.getClient();
        let updatedItem;
        try {
            await client.query('BEGIN');

            const { rows: updatedRows } = await client.query(
                `UPDATE campaign_items
                 SET title = $2,
                     message_body = $3,
                     channel = $4,
                     sender_id = $5,
                     message_type = $6,
                     scheduled_at = $7,
                     status = 'scheduled',
                     queue_job_id = $8,
                     locked_at = NULL,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [
                    itemId,
                    title !== undefined ? (title ? String(title).trim() : null) : current.title,
                    message_body !== undefined ? String(message_body).trim() : current.message_body,
                    channel !== undefined ? normalizeCampaignChannel(channel) : current.channel,
                    sender_id !== undefined ? sender_id : current.sender_id,
                    message_type !== undefined ? message_type : current.message_type,
                    nextScheduledAt,
                    nextDispatchToken,
                ]
            );
            updatedItem = updatedRows[0];

            if (Array.isArray(group_ids) || Array.isArray(contact_ids)) {
                const resolvedGroupIds = Array.isArray(group_ids)
                    ? group_ids
                    : (await client.query(
                        `SELECT group_id FROM campaign_item_groups WHERE campaign_item_id = $1`,
                        [itemId]
                    )).rows.map((row) => row.group_id);

                const resolvedContactIds = Array.isArray(contact_ids)
                    ? contact_ids
                    : (await client.query(
                        `SELECT contact_id FROM campaign_item_contacts WHERE campaign_item_id = $1`,
                        [itemId]
                    )).rows.map((row) => row.contact_id);

                if (resolvedGroupIds.length === 0 && resolvedContactIds.length === 0) {
                    const audienceError = new Error('At least one group_id or contact_id is required');
                    audienceError.status = 400;
                    throw audienceError;
                }

                await replaceCampaignItemAudience(client, itemId, resolvedGroupIds, resolvedContactIds);
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        try {
            await scheduleCampaignItemDispatch(itemId, nextScheduledAt, nextDispatchToken);
        } catch (err) {
            await db.query(`UPDATE campaign_items SET status = 'failed', updated_at = NOW() WHERE id = $1`, [itemId]);
            throw err;
        }

        return res.json({ item: updatedItem });
    } catch (err) {
        console.error('[messages/campaign-items:update]', err);
        return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
    }
});

// POST /messages/campaign-items/:itemId/clone
router.post('/campaign-items/:itemId/clone', requireAuth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const cloneScheduledAt = req.body?.scheduled_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { rows: sourceRows } = await db.query(
            `SELECT ci.*, c.user_id
             FROM campaign_items ci
             JOIN campaigns c ON c.id = ci.campaign_id
             WHERE ci.id = $1`,
            [itemId]
        );
        const source = sourceRows[0];
        if (!source || source.user_id !== req.user.id) {
            return res.status(404).json({ error: 'Campaign item not found' });
        }

        const dispatchToken = randomUUID();
        const client = await db.getClient();
        let clonedItem;
        try {
            await client.query('BEGIN');

            const { rows: positionRows } = await client.query(
                `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
                 FROM campaign_items
                 WHERE campaign_id = $1`,
                [source.campaign_id]
            );
            const nextPosition = Number(positionRows[0].next_position || 1);

            const { rows: cloneRows } = await client.query(
                `INSERT INTO campaign_items
                 (campaign_id, title, message_body, channel, sender_id, message_type, scheduled_at, status, position, queue_job_id, cloned_from_item_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9, $10)
                 RETURNING *`,
                [
                    source.campaign_id,
                    source.title,
                    source.message_body,
                    source.channel,
                    source.sender_id,
                    source.message_type,
                    cloneScheduledAt,
                    nextPosition,
                    dispatchToken,
                    source.id,
                ]
            );
            clonedItem = cloneRows[0];

            await client.query(
                `INSERT INTO campaign_item_groups (campaign_item_id, group_id)
                 SELECT $1, group_id
                 FROM campaign_item_groups
                 WHERE campaign_item_id = $2
                 ON CONFLICT (campaign_item_id, group_id) DO NOTHING`,
                [clonedItem.id, source.id]
            );
            await client.query(
                `INSERT INTO campaign_item_contacts (campaign_item_id, contact_id)
                 SELECT $1, contact_id
                 FROM campaign_item_contacts
                 WHERE campaign_item_id = $2
                 ON CONFLICT (campaign_item_id, contact_id) DO NOTHING`,
                [clonedItem.id, source.id]
            );

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        try {
            await scheduleCampaignItemDispatch(clonedItem.id, cloneScheduledAt, dispatchToken);
        } catch (err) {
            await db.query(`UPDATE campaign_items SET status = 'failed', updated_at = NOW() WHERE id = $1`, [clonedItem.id]);
            throw err;
        }

        return res.status(201).json({ item: clonedItem });
    } catch (err) {
        console.error('[messages/campaign-items:clone]', err);
        return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
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
            where += ` AND (c.phone_number ILIKE $${params.length} OR m.target_phone ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length})`;
        }

        params.push(Number(limit), offset);

        const { rows } = await db.query(
            `SELECT m.*, COALESCE(c.phone_number, m.target_phone) AS phone_number, c.first_name, c.last_name, cp.title AS campaign_title
       FROM messages m
       LEFT JOIN contacts c ON c.id = m.contact_id
       LEFT JOIN campaigns cp ON cp.id = m.campaign_id
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
