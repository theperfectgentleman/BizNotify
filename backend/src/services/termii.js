/**
 * Core Termii service.
 * Uses native fetch to interact with the Termii API.
 * Rate-limiting and retries are handled by pg-boss (backoff config).
 */
const apiKey = process.env.TERMII_API_KEY;
const senderId = process.env.TERMII_SENDER_ID;
const baseUrl = process.env.TERMII_BASEURL || 'https://v3.api.termii.com';

/**
 * Send a single SMS via Termii.
 * @param {string} to - Normalized phone number (no +)
 * @param {string} message - Message body
 * @param {string} channel - 'generic' | 'whatsapp'
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendSms(to, message, channel = 'generic') {
    const payload = {
        to,
        from: senderId,
        sms: message,
        type: 'plain',
        channel,
        api_key: apiKey
    };

    try {
        const res = await fetch(`${baseUrl}/api/sms/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            console.error(`[Termii] API returned ${res.status}:`, data);
            return { success: false, error: data.message || 'Termii error' };
        }

        return { success: true, messageId: data.message_id };
    } catch (error) {
        console.error(`[Termii] sendSms failed to ${to}:`, error.message);
        return { success: false, error: error.message || 'Unknown Termii error' };
    }
}

/**
 * Send bulk SMS via Termii (no personalization).
 * @param {string[]} toArray - Array of normalized phone numbers
 * @param {string} message - Message body
 * @param {string} channel - 'generic' | 'whatsapp'
 */
async function sendBulkSms(toArray, message, channel = 'generic') {
    const payload = {
        to: toArray,
        from: senderId,
        sms: message,
        type: 'plain',
        channel,
        api_key: apiKey
    };

    try {
        const res = await fetch(`${baseUrl}/api/sms/send/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            console.error(`[Termii] sendBulkSms returned ${res.status}:`, data);
            return { success: false, error: data.message || 'Termii error' };
        }

        return { success: true, messageId: data.message_id };
    } catch (error) {
        console.error(`[Termii] sendBulkSms failed:`, error.message);
        return { success: false, error: error.message || 'Unknown Termii error' };
    }
}

/**
 * Get Termii account balance.
 * Used for the dashboard summary card.
 */
async function getBalance() {
    try {
        const res = await fetch(`${baseUrl}/api/get-balance?api_key=${apiKey}`);
        const data = await res.json();

        if (!res.ok) {
            return { success: false, error: data.message || 'Balance fetch failed' };
        }

        return { success: true, balance: data.balance, currency: data.currency };
    } catch (error) {
        console.error('[Termii] getBalance failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Fetch all Sender IDs.
 */
async function fetchSenderIds() {
    try {
        const res = await fetch(`${baseUrl}/api/sender-id?api_key=${apiKey}`);
        const data = await res.json();
        if (!res.ok) {
            return { success: false, error: data.message || 'Fetch Sender IDs failed' };
        }
        return { success: true, data };
    } catch (error) {
        console.error('[Termii] fetchSenderIds failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Request a new Sender ID.
 */
async function requestSenderId(sender_id, usecase, company) {
    const payload = {
        api_key: apiKey,
        sender_id,
        usecase, // Note: some Termii docs use usecase, some use_case. We pass both to be safe
        use_case: usecase,
        company
    };

    try {
        const res = await fetch(`${baseUrl}/api/sender-id/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        // Termii can return 200 with an error object sometimes, throwing if !res.ok is safer
        if (!res.ok) {
            console.error(`[Termii] requestSenderId returned ${res.status}:`, data);
            return { success: false, error: data.message || 'Request Sender ID failed' };
        }
        if (data.code && data.code !== 'ok') {
            return { success: false, error: data.message || 'API rejected' }
        }

        return { success: true, data };
    } catch (error) {
        console.error('[Termii] requestSenderId failed:', error.message);
        return { success: false, error: error.message || 'Unknown Termii error' };
    }
}

module.exports = { sendSms, sendBulkSms, getBalance, fetchSenderIds, requestSenderId };
