const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /groups - list all
router.get('/', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT g.*, COUNT(cg.contact_id) AS contact_count
       FROM groups g
       LEFT JOIN contact_groups cg ON cg.group_id = g.id
       GROUP BY g.id
       ORDER BY g.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('[groups/GET]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /groups - create
router.post('/', requireAuth, async (req, res) => {
    try {
        const { name, description, parent_group_id } = req.body;
        if (!name) return res.status(400).json({ error: 'Group name is required' });

        const { rows } = await db.query(
            'INSERT INTO groups (name, description, parent_group_id) VALUES ($1, $2, $3) RETURNING *',
            [name, description || null, parent_group_id || null]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[groups/POST]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /groups/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Group not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /groups/:id
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { name, description, parent_group_id } = req.body;
        const { rows } = await db.query(
            'UPDATE groups SET name = COALESCE($1, name), description = COALESCE($2, description), parent_group_id = $3 WHERE id = $4 RETURNING *',
            [name, description, parent_group_id || null, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Group not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /groups/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ error: 'Group not found' });
        res.json({ message: 'Group deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
