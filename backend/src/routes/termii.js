const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { fetchSenderIds, requestSenderId, fetchHistory, checkDnd, getBalance } = require('../services/termii');

// GET /api/termii/sender-ids
router.get('/sender-ids', requireAuth, async (req, res) => {
    try {
        const result = await fetchSenderIds();
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json(result.data);
    } catch (err) {
        console.error('[termii/sender-ids GET]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/termii/sender-ids/request
router.post('/sender-ids/request', requireAuth, async (req, res) => {
    const { sender_id, usecase, company } = req.body;

    if (!sender_id || !usecase || !company) {
        return res.status(400).json({ error: 'sender_id, usecase, and company are required' });
    }

    try {
        const result = await requestSenderId(sender_id, usecase, company);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json(result.data);
    } catch (err) {
        console.error('[termii/sender-ids/request POST]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/termii/history
router.get('/history', requireAuth, async (req, res) => {
    try {
        const result = await fetchHistory();
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json(result.data);
    } catch (err) {
        console.error('[termii/history GET]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/termii/check-dnd
router.get('/check-dnd', requireAuth, async (req, res) => {
    const { phone_number } = req.query;
    if (!phone_number) {
        return res.status(400).json({ error: 'phone_number is required' });
    }

    try {
        const result = await checkDnd(phone_number);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json(result.data);
    } catch (err) {
        console.error('[termii/check-dnd GET]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/termii/balance
router.get('/balance', requireAuth, async (req, res) => {
    try {
        const result = await getBalance();
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json(result);
    } catch (err) {
        console.error('[termii/balance GET]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
