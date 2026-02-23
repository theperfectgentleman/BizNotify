/**
 * pg-boss v8 queue setup and message worker.
 * v8 is the last CommonJS-compatible version and works on Node 18/20.
 *
 * Job name: 'send-message'
 * Retry strategy: exponential backoff, max 3 attempts.
 */
const PgBoss = require('pg-boss');
const db = require('../db');
const { sendSms, sendBulkSms } = require('../services/termii');
const { randomUUID } = require('crypto');

let boss;

const JOB_NAME = 'send-message';
const INSTANT_BULK_JOB_NAME = 'send-instant-bulk';
const CAMPAIGN_ITEM_DISPATCH_JOB_NAME = 'dispatch-campaign-item';

async function initQueue() {
    boss = new PgBoss(process.env.DATABASE_URL);

    boss.on('error', (err) => console.error('[pg-boss] error:', err));

    await boss.start();
    console.log('✅ pg-boss queue started');

    // Worker: up to 5 concurrent jobs
    boss.work(JOB_NAME, { teamSize: 5, teamConcurrency: 5 }, processMessage);
    boss.work(INSTANT_BULK_JOB_NAME, { teamSize: 3, teamConcurrency: 3 }, processInstantBulkMessage);
    boss.work(CAMPAIGN_ITEM_DISPATCH_JOB_NAME, { teamSize: 2, teamConcurrency: 2 }, processCampaignItemDispatch);
    console.log(`✅ Worker listening on job "${JOB_NAME}"`);
    console.log(`✅ Worker listening on job "${INSTANT_BULK_JOB_NAME}"`);
    console.log(`✅ Worker listening on job "${CAMPAIGN_ITEM_DISPATCH_JOB_NAME}"`);

    return boss;
}

async function processMessage(job) {
    const { messageId, phone, messageBody, channel, customSender, msgType, campaignItemId } = job.data;

    const channelMap = { sms: 'generic', whatsapp: 'whatsapp', generic: 'generic', dnd: 'dnd' };
    const termiiChannel = channelMap[channel] || 'generic';

    const result = await sendSms(phone, messageBody, termiiChannel, customSender, msgType);

    if (result.success) {
        await db.query(
            `UPDATE messages SET status = 'sent', termii_message_id = $1, updated_at = NOW() WHERE id = $2`,
            [result.messageId, messageId]
        );
        if (campaignItemId) await refreshCampaignItemStatus(campaignItemId);
    } else {
        await db.query(
            `UPDATE messages SET status = 'failed', error_reason = $1, updated_at = NOW() WHERE id = $2`,
            [result.error, messageId]
        );
        if (campaignItemId) await refreshCampaignItemStatus(campaignItemId);
        // Throw so pg-boss retries (respects retryLimit + retryBackoff)
        throw new Error(result.error);
    }
}

async function processInstantBulkMessage(job) {
    const { messageIds, phones, messageBody, channel, customSender, msgType } = job.data;

    const channelMap = { sms: 'generic', whatsapp: 'whatsapp', generic: 'generic', dnd: 'dnd' };
    const termiiChannel = channelMap[channel] || 'generic';

    const result = await sendBulkSms(phones, messageBody, termiiChannel, customSender, msgType);

    if (result.success) {
        await db.query(
            `UPDATE messages
             SET status = 'sent', termii_message_id = $1, updated_at = NOW()
             WHERE id = ANY($2::uuid[])`,
            [result.messageId || null, messageIds]
        );
        return;
    }

    await db.query(
        `UPDATE messages
         SET status = 'failed', error_reason = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[])`,
        [result.error, messageIds]
    );
    throw new Error(result.error);
}

async function processCampaignItemDispatch(job) {
    const { campaignItemId, dispatchToken } = job.data;

    const { rows: itemRows } = await db.query(
        `SELECT ci.*, c.id AS campaign_id, c.user_id
         FROM campaign_items ci
         JOIN campaigns c ON c.id = ci.campaign_id
         WHERE ci.id = $1`,
        [campaignItemId]
    );
    const item = itemRows[0];
    if (!item) return;

    if (item.queue_job_id !== dispatchToken) return;
    if (!['scheduled', 'draft'].includes(item.status)) return;
    if (new Date(item.scheduled_at).getTime() > Date.now() + 10_000) return;

    const client = await db.getClient();
    let recipients;
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE campaign_items
             SET status = 'queued', locked_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [campaignItemId]
        );

        const { rows } = await client.query(
            `SELECT DISTINCT c.id, c.phone_number, c.first_name, c.last_name
             FROM contacts c
             WHERE c.opt_out = FALSE
               AND (
                 c.id IN (
                   SELECT cg.contact_id
                   FROM contact_groups cg
                   WHERE cg.group_id IN (
                     SELECT cig.group_id
                     FROM campaign_item_groups cig
                     WHERE cig.campaign_item_id = $1
                   )
                 )
                 OR c.id IN (
                   SELECT cic.contact_id
                   FROM campaign_item_contacts cic
                   WHERE cic.campaign_item_id = $1
                 )
               )`,
            [campaignItemId]
        );

        recipients = rows;

        if (recipients.length === 0) {
            await client.query(
                `UPDATE campaign_items
                 SET status = 'failed', locked_at = NOW(), updated_at = NOW()
                 WHERE id = $1`,
                [campaignItemId]
            );
            await client.query('COMMIT');
            return;
        }

        const insertPromises = recipients.map((recipient) =>
            client.query(
                `INSERT INTO messages (campaign_id, campaign_item_id, contact_id, status)
                 VALUES ($1, $2, $3, 'queued')
                 RETURNING id`,
                [item.campaign_id, campaignItemId, recipient.id]
            )
        );
        const insertResults = await Promise.all(insertPromises);

        const jobs = recipients.map((recipient, index) => ({
            messageId: insertResults[index].rows[0].id,
            campaignItemId,
            contactId: recipient.id,
            phone: recipient.phone_number,
            messageBody: item.message_body
                .replace(/\{\{first_name\}\}/gi, recipient.first_name || '')
                .replace(/\{\{last_name\}\}/gi, recipient.last_name || '')
                .replace(/\{\{phone\}\}/gi, recipient.phone_number),
            channel: item.channel,
            customSender: item.sender_id,
            msgType: item.message_type,
        }));

        await client.query('COMMIT');
        await enqueueCampaignJobs(item.campaign_id, jobs);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    await refreshCampaignItemStatus(campaignItemId);
}

async function refreshCampaignItemStatus(campaignItemId) {
    const { rows: statRows } = await db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
           COUNT(*) FILTER (WHERE status IN ('sent','delivered'))::int AS success,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
         FROM messages
         WHERE campaign_item_id = $1`,
        [campaignItemId]
    );

    const stats = statRows[0] || { total: 0, queued: 0, success: 0, failed: 0 };
    if (stats.total === 0) return;

    let nextStatus = 'sending';
    if (stats.queued === stats.total) nextStatus = 'queued';
    else if (stats.queued > 0) nextStatus = 'sending';
    else if (stats.failed === stats.total) nextStatus = 'failed';
    else if (stats.success === stats.total) nextStatus = 'sent';
    else nextStatus = 'partial';

    const { rows: updateRows } = await db.query(
        `UPDATE campaign_items
         SET status = $2,
             locked_at = CASE WHEN $2 IN ('sent','failed','partial') THEN NOW() ELSE locked_at END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING campaign_id`,
        [campaignItemId, nextStatus]
    );

    const campaignId = updateRows[0]?.campaign_id;
    if (campaignId) {
        await refreshCampaignStatus(campaignId);
    }
}

async function refreshCampaignStatus(campaignId) {
    const { rows } = await db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status IN ('draft','scheduled','queued','sending'))::int AS active,
           COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
           COUNT(*) FILTER (WHERE status IN ('failed','partial'))::int AS problematic
         FROM campaign_items
         WHERE campaign_id = $1`,
        [campaignId]
    );

    const agg = rows[0] || { total: 0, active: 0, sent: 0, problematic: 0 };
    if (agg.total === 0) return;

    let campaignStatus = 'processing';
    if (agg.active > 0) campaignStatus = 'processing';
    else if (agg.sent === agg.total) campaignStatus = 'completed';
    else if (agg.problematic === agg.total) campaignStatus = 'failed';
    else campaignStatus = 'completed';

    await db.query(
        `UPDATE campaigns
         SET status = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [campaignId, campaignStatus]
    );
}

/**
 * Enqueue a batch of message jobs for a campaign.
 * pg-boss v8 uses send() per job (no bulk insert method).
 * Promise.all keeps it fast for large batches.
 */
async function enqueueCampaignJobs(campaignId, jobs) {
    if (!boss) throw new Error('Queue not initialized');

    const jobOptions = {
        retryLimit: 3,
        retryDelay: 30,      // seconds before first retry
        retryBackoff: true,  // exponential backoff
        expireInHours: 24,
    };

    await Promise.all(
        jobs.map((j) =>
            boss.send(JOB_NAME, { campaignId, ...j }, jobOptions)
        )
    );
}

async function enqueueInstantBulkJobs({ recipients, messageBody, channel, customSender, msgType }) {
    if (!boss) throw new Error('Queue not initialized');

    const chunkSize = Math.max(1, Number(process.env.INSTANT_BULK_CHUNK_SIZE) || 100);
    const jobOptions = {
        retryLimit: 3,
        retryDelay: 30,
        retryBackoff: true,
        expireInHours: 24,
    };

    const batches = [];
    for (let index = 0; index < recipients.length; index += chunkSize) {
        batches.push(recipients.slice(index, index + chunkSize));
    }

    await Promise.all(
        batches.map((batch) =>
            boss.send(
                INSTANT_BULK_JOB_NAME,
                {
                    messageIds: batch.map((item) => item.messageId),
                    phones: batch.map((item) => item.phone),
                    messageBody,
                    channel,
                    customSender,
                    msgType,
                },
                jobOptions
            )
        )
    );

    return batches.length;
}

/**
 * Enqueue a single scheduled job.
 */
async function enqueueScheduledJob(campaignId, jobData, scheduledAt) {
    if (!boss) throw new Error('Queue not initialized');

    await boss.sendAfter(
        JOB_NAME,
        { campaignId, ...jobData },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
        new Date(scheduledAt)
    );
}

async function scheduleCampaignItemDispatch(campaignItemId, scheduledAt, dispatchToken = randomUUID()) {
    if (!boss) throw new Error('Queue not initialized');

    await boss.sendAfter(
        CAMPAIGN_ITEM_DISPATCH_JOB_NAME,
        { campaignItemId, dispatchToken },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
        new Date(scheduledAt)
    );

    return dispatchToken;
}

module.exports = {
    initQueue,
    enqueueCampaignJobs,
    enqueueScheduledJob,
    enqueueInstantBulkJobs,
    scheduleCampaignItemDispatch,
    refreshCampaignItemStatus,
};
