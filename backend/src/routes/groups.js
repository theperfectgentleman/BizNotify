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

// GET /groups/:id/members
router.get('/:id/members', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { search, page = 1, limit = 50 } = req.query;
        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.max(1, Number(limit) || 50);
        const offset = (pageNum - 1) * limitNum;

        const { rows: groupRows } = await db.query('SELECT id FROM groups WHERE id = $1', [id]);
        if (!groupRows.length) return res.status(404).json({ error: 'Group not found' });

        const params = [id];
        let where = 'WHERE 1=1';

        if (search) {
            params.push(`%${search}%`);
            const index = params.length;
            where += ` AND (
                CONCAT_WS(' ', COALESCE(c.first_name, ''), COALESCE(c.last_name, '')) ILIKE $${index}
                OR c.phone_number ILIKE $${index}
                OR TO_CHAR(c.created_at, 'YYYY-MM-DD HH24:MI:SS') ILIKE $${index}
                OR TO_CHAR(c.created_at, 'YYYY-MM-DD') ILIKE $${index}
                OR c.created_at::text ILIKE $${index}
            )`;
        }

        params.push(limitNum, offset);

        const { rows: members } = await db.query(
            `SELECT
                c.id,
                c.phone_number,
                c.first_name,
                c.last_name,
                c.created_at,
                c.updated_at,
                COALESCE(
                    json_agg(json_build_object('id', g.id, 'name', g.name))
                    FILTER (WHERE g.id IS NOT NULL),
                    '[]'
                ) AS groups
             FROM contacts c
             INNER JOIN contact_groups cg_member
                 ON cg_member.contact_id = c.id
                AND cg_member.group_id = $1
             LEFT JOIN contact_groups cg_all ON cg_all.contact_id = c.id
             LEFT JOIN groups g ON g.id = cg_all.group_id
             ${where}
             GROUP BY c.id
             ORDER BY c.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const countParams = params.slice(0, params.length - 2);
        const { rows: countRows } = await db.query(
            `SELECT COUNT(*) AS count
             FROM contacts c
             INNER JOIN contact_groups cg_member
                 ON cg_member.contact_id = c.id
                AND cg_member.group_id = $1
             ${where}`,
            countParams
        );

        res.json({
            members,
            total: Number(countRows[0].count || 0),
            page: pageNum,
            limit: limitNum,
        });
    } catch (err) {
        console.error('[groups/:id/members GET]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /groups/:id/add-contacts
router.post('/:id/add-contacts', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { contact_ids: contactIds } = req.body;

        if (!Array.isArray(contactIds)) {
            return res.status(400).json({ error: 'contact_ids must be an array' });
        }

        const requested = contactIds.length;
        if (!requested) return res.json({ requested: 0, added: 0, ignored: 0 });

        const { rows: groupRows } = await db.query('SELECT id FROM groups WHERE id = $1', [id]);
        if (!groupRows.length) return res.status(404).json({ error: 'Group not found' });

        const uniqueIds = [...new Set(contactIds.filter(Boolean))];
        if (!uniqueIds.length) return res.json({ requested, added: 0, ignored: requested });

        const { rowCount } = await db.query(
            `WITH input_ids AS (
                SELECT DISTINCT UNNEST($2::uuid[]) AS contact_id
             ),
             valid_ids AS (
                SELECT i.contact_id
                FROM input_ids i
                INNER JOIN contacts c ON c.id = i.contact_id
             )
             INSERT INTO contact_groups (contact_id, group_id)
             SELECT v.contact_id, $1
             FROM valid_ids v
             ON CONFLICT DO NOTHING`,
            [id, uniqueIds]
        );

        const added = Number(rowCount || 0);
        const ignored = Math.max(0, requested - added);
        res.json({ requested, added, ignored });
    } catch (err) {
        if (err.code === '22P02') {
            return res.status(400).json({ error: 'contact_ids must contain valid UUID values' });
        }
        console.error('[groups/:id/add-contacts POST]', err);
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
