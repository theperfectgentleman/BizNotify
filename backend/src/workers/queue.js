/**
 * pg-boss queue setup and message worker.
 *
 * Job name: 'send-message'
 * Job data: { messageId, campaignId, contactId, phone, messageBody, channel }
 *
 * Retry strategy: exponential backoff, max 3 attempts.
 */
const PgBoss = require('pg-boss');
const db = require('../db');
const { sendSms } = require('../services/termii');

let boss;

const JOB_NAME = 'send-message';

async function initQueue() {
    boss = new PgBoss(process.env.DATABASE_URL);

    boss.on('error', (err) => console.error('[pg-boss] error:', err));

    await boss.start();
    console.log('✅ pg-boss queue started');

    // Worker: up to 5 concurrent jobs, auto-respects Termii's rate limits
    await boss.work(JOB_NAME, { teamSize: 5, teamConcurrency: 5 }, processMessage);
    console.log(`✅ Worker listening on job "${JOB_NAME}"`);

    return boss;
}

async function processMessage(job) {
    const { messageId, phone, messageBody, channel } = job.data;

    const channelMap = { sms: 'generic', whatsapp: 'whatsapp' };
    const termiiChannel = channelMap[channel] || 'generic';

    const result = await sendSms(phone, messageBody, termiiChannel);

    if (result.success) {
        await db.query(
            `UPDATE messages SET status = 'sent', termii_message_id = $1, updated_at = NOW() WHERE id = $2`,
            [result.messageId, messageId]
        );
    } else {
        // Mark as failed; pg-boss will retry based on job config (max 3 times)
        await db.query(
            `UPDATE messages SET status = 'failed', error_reason = $1, updated_at = NOW() WHERE id = $2`,
            [result.error, messageId]
        );
        // Throw so pg-boss retries
        throw new Error(result.error);
    }
}

/**
 * Enqueue a batch of message jobs for a campaign.
 * @param {string} campaignId
 * @param {Array<{ messageId, contactId, phone, messageBody, channel }>} jobs
 */
async function enqueueCampaignJobs(campaignId, jobs) {
    if (!boss) throw new Error('Queue not initialized');

    const pgBossJobs = jobs.map((j) => ({
        name: JOB_NAME,
        data: { campaignId, ...j },
        options: {
            retryLimit: 3,
            retryDelay: 30,      // seconds before first retry
            retryBackoff: true,  // exponential backoff
            expireInHours: 24,
        },
    }));

    await boss.insert(pgBossJobs);
}

/**
 * Enqueue a single scheduled job (for a scheduled campaign).
 */
async function enqueueScheduledJob(campaignId, jobData, scheduledAt) {
    if (!boss) throw new Error('Queue not initialized');

    await boss.sendAfter(
        JOB_NAME,
        { campaignId, ...jobData },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
        scheduledAt
    );
}

module.exports = { initQueue, enqueueCampaignJobs, enqueueScheduledJob };
