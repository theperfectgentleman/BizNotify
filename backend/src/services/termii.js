/**
 * Core Termii service.
 * Wraps termii-nodejs and maps results to internal statuses.
 * Rate-limiting and retries are handled by pg-boss (backoff config).
 */
const Termii = require('termii-nodejs');

const apiKey = process.env.TERMII_API_KEY;
const senderId = process.env.TERMII_SENDER_ID;

let termiiClient;

function getClient() {
    if (!termiiClient) {
        termiiClient = new Termii(apiKey);
    }
    return termiiClient;
}

/**
 * Send a single SMS via Termii.
 * @param {string} to - Normalized phone number (no +)
 * @param {string} message - Message body
 * @param {string} channel - 'generic' | 'whatsapp'
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendSms(to, message, channel = 'generic') {
    const client = getClient();

    const payload = {
        to,
        from: senderId,
        sms: message,
        type: 'plain',
        channel,
    };

    try {
        const response = await client.sendSms(payload);
        // Termii returns message_id in the response
        return { success: true, messageId: response.message_id };
    } catch (error) {
        console.error(`[Termii] sendSms failed to ${to}:`, error.message);
        return { success: false, error: error.message || 'Unknown Termii error' };
    }
}

/**
 * Get Termii account balance.
 * Used for the dashboard summary card.
 */
async function getBalance() {
    const client = getClient();
    try {
        const response = await client.getBalance();
        return { success: true, balance: response.data?.balance, currency: response.data?.currency };
    } catch (error) {
        console.error('[Termii] getBalance failed:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { sendSms, getBalance };
