const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { fetchSenderIds, requestSenderId } = require('../services/termii');

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

module.exports = router;
