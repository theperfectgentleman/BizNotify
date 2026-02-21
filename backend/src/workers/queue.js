/**
 * pg-boss v8 queue setup and message worker.
 * v8 is the last CommonJS-compatible version and works on Node 18/20.
 *
 * Job name: 'send-message'
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

    // Worker: up to 5 concurrent jobs
    boss.work(JOB_NAME, { teamSize: 5, teamConcurrency: 5 }, processMessage);
    console.log(`✅ Worker listening on job "${JOB_NAME}"`);

    return boss;
}

async function processMessage(job) {
    const { messageId, phone, messageBody, channel, customSender, msgType } = job.data;

    const channelMap = { sms: 'generic', whatsapp: 'whatsapp', generic: 'generic', dnd: 'dnd' };
    const termiiChannel = channelMap[channel] || 'generic';

    const result = await sendSms(phone, messageBody, termiiChannel, customSender, msgType);

    if (result.success) {
        await db.query(
            `UPDATE messages SET status = 'sent', termii_message_id = $1, updated_at = NOW() WHERE id = $2`,
            [result.messageId, messageId]
        );
    } else {
        await db.query(
            `UPDATE messages SET status = 'failed', error_reason = $1, updated_at = NOW() WHERE id = $2`,
            [result.error, messageId]
        );
        // Throw so pg-boss retries (respects retryLimit + retryBackoff)
        throw new Error(result.error);
    }
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

module.exports = { initQueue, enqueueCampaignJobs, enqueueScheduledJob };
