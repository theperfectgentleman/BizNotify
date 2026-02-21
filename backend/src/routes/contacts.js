const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { normalizePhone, isValidPhone } = require('../utils/phone');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /contacts
router.get('/', requireAuth, async (req, res) => {
    try {
        const { group_id, search, page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const params = [];
        let where = 'WHERE 1=1';

        if (group_id) {
            params.push(group_id);
            where += ` AND EXISTS (SELECT 1 FROM contact_groups cg WHERE cg.contact_id = c.id AND cg.group_id = $${params.length})`;
        }
        if (search) {
            params.push(`%${search}%`);
            where += ` AND (c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.phone_number ILIKE $${params.length})`;
        }

        params.push(Number(limit), offset);

        const { rows } = await db.query(
            `SELECT c.*,
         COALESCE(json_agg(json_build_object('id', g.id, 'name', g.name)) FILTER (WHERE g.id IS NOT NULL), '[]') AS groups
       FROM contacts c
       LEFT JOIN contact_groups cg ON cg.contact_id = c.id
       LEFT JOIN groups g ON g.id = cg.group_id
       ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        // Get total count
        const countParams = params.slice(0, params.length - 2);
        const { rows: countRows } = await db.query(
            `SELECT COUNT(*) FROM contacts c ${where}`,
            countParams
        );

        res.json({ contacts: rows, total: parseInt(countRows[0].count), page: Number(page), limit: Number(limit) });
    } catch (err) {
        console.error('[contacts/GET]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /contacts - create single
router.post('/', requireAuth, async (req, res) => {
    try {
        const { phone_number, first_name, last_name, metadata, group_ids } = req.body;
        if (!phone_number) return res.status(400).json({ error: 'phone_number is required' });

        const normalized = normalizePhone(phone_number);
        if (!normalized || !isValidPhone(normalized)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(
                `INSERT INTO contacts (phone_number, first_name, last_name, metadata)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (phone_number) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, metadata = EXCLUDED.metadata
         RETURNING *`,
                [normalized, first_name || null, last_name || null, metadata ? JSON.stringify(metadata) : '{}']
            );
            const contact = rows[0];

            if (group_ids && group_ids.length > 0) {
                for (const gid of group_ids) {
                    await client.query(
                        'INSERT INTO contact_groups (contact_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [contact.id, gid]
                    );
                }
            }

            await client.query('COMMIT');
            res.status(201).json(contact);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[contacts/POST]', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Contact with this phone number already exists' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /contacts/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ error: 'Contact not found' });
        res.json({ message: 'Contact deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /contacts/import - CSV/Excel upload
router.post('/import', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const { group_id } = req.body;

        const csvText = req.file.buffer.toString('utf8');
        let records;
        try {
            records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
        } catch (e) {
            return res.status(400).json({ error: 'Invalid CSV file: ' + e.message });
        }

        const client = await db.getClient();
        let imported = 0;
        let skipped = 0;
        const errors = [];

        try {
            await client.query('BEGIN');

            for (const record of records) {
                const rawPhone = record.phone_number || record.phone || record.mobile || record.tel;
                const normalized = normalizePhone(rawPhone);
                if (!normalized || !isValidPhone(normalized)) {
                    skipped++;
                    errors.push({ row: record, reason: 'Invalid phone number' });
                    continue;
                }

                try {
                    const { rows } = await client.query(
                        `INSERT INTO contacts (phone_number, first_name, last_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (phone_number) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name
             RETURNING id`,
                        [normalized, record.first_name || record.firstname || null, record.last_name || record.lastname || null]
                    );

                    if (group_id) {
                        await client.query(
                            'INSERT INTO contact_groups (contact_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            [rows[0].id, group_id]
                        );
                    }
                    imported++;
                } catch (rowErr) {
                    skipped++;
                    errors.push({ row: record, reason: rowErr.message });
                }
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({ imported, skipped, total: records.length, errors: errors.slice(0, 20) });
    } catch (err) {
        console.error('[contacts/import]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /contacts/bulk-tag - add multiple contacts to a group
router.post('/bulk-tag', requireAuth, async (req, res) => {
    try {
        const { contact_ids, group_id } = req.body;
        if (!contact_ids || !contact_ids.length || !group_id) {
            return res.status(400).json({ error: 'contact_ids and group_id are required' });
        }

        let tagged = 0;
        for (const cid of contact_ids) {
            await db.query(
                'INSERT INTO contact_groups (contact_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [cid, group_id]
            );
            tagged++;
        }

        res.json({ tagged });
    } catch (err) {
        console.error('[contacts/bulk-tag]', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
