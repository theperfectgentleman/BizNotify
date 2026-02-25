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
            where += ` AND (
                CONCAT_WS(' ', COALESCE(c.first_name, ''), COALESCE(c.last_name, '')) ILIKE $${params.length}
                OR c.phone_number ILIKE $${params.length}
                OR TO_CHAR(c.created_at, 'YYYY-MM-DD HH24:MI:SS') ILIKE $${params.length}
                OR TO_CHAR(c.created_at, 'YYYY-MM-DD') ILIKE $${params.length}
                OR c.created_at::text ILIKE $${params.length}
            )`;
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

// PATCH /contacts/:id - update single contact (including groups)
router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { phone_number, first_name, last_name, metadata, group_ids } = req.body;

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const { rows: existingRows } = await client.query(
                'SELECT * FROM contacts WHERE id = $1',
                [id]
            );

            const existing = existingRows[0];
            if (!existing) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Contact not found' });
            }

            let normalizedPhone = existing.phone_number;
            if (phone_number !== undefined) {
                normalizedPhone = normalizePhone(phone_number);
                if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Invalid phone number' });
                }
            }

            const { rows: updatedRows } = await client.query(
                `UPDATE contacts
                 SET phone_number = $2,
                     first_name = $3,
                     last_name = $4,
                     metadata = $5,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [
                    id,
                    normalizedPhone,
                    first_name !== undefined ? (first_name || null) : existing.first_name,
                    last_name !== undefined ? (last_name || null) : existing.last_name,
                    metadata !== undefined
                        ? JSON.stringify(metadata || {})
                        : existing.metadata,
                ]
            );

            if (Array.isArray(group_ids)) {
                await client.query('DELETE FROM contact_groups WHERE contact_id = $1', [id]);

                for (const groupId of group_ids) {
                    await client.query(
                        `INSERT INTO contact_groups (contact_id, group_id)
                         VALUES ($1, $2)
                         ON CONFLICT DO NOTHING`,
                        [id, groupId]
                    );
                }
            }

            await client.query('COMMIT');
            return res.json(updatedRows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[contacts/PATCH]', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Contact with this phone number already exists' });
        return res.status(500).json({ error: 'Internal server error' });
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

// ── Shared CSV parsing + validation helpers ──────────────────────────────────
function buildHeaderMap(record) {
    const norm = (s) => String(s).toLowerCase().replace(/[\s_\-]/g, '');
    const map = {};
    for (const key of Object.keys(record)) map[norm(key)] = key;
    return map;
}

const PHONE_ALIASES = ['phonenumber', 'phone', 'mobile', 'tel', 'telephone', 'msisdn', 'number', 'contact'];
const FNAME_ALIASES = ['firstname', 'fname', 'givenname', 'first'];
const LNAME_ALIASES = ['lastname', 'lname', 'surname', 'familyname', 'last'];

function resolveField(record, headerMap, aliases) {
    for (const alias of aliases) {
        const orig = headerMap[alias];
        if (orig !== undefined) {
            const val = record[orig];
            if (val && String(val).trim()) return String(val).trim();
        }
    }
    return null;
}

function parseCsv(buffer) {
    const csvText = buffer.toString('utf8').replace(/^\uFEFF/, '');
    return parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
    });
}

function scanRecords(records) {
    const headerMap = buildHeaderMap(records[0]);
    const norm = (s) => String(s).toLowerCase().replace(/[\s_\-]/g, '');

    // Detect which real column keys are mapped
    const detectedCols = {
        phone: PHONE_ALIASES.map(a => headerMap[a]).find(Boolean) || null,
        firstName: FNAME_ALIASES.map(a => headerMap[a]).find(Boolean) || null,
        lastName: LNAME_ALIASES.map(a => headerMap[a]).find(Boolean) || null,
    };

    const hasPhoneCol = !!detectedCols.phone;

    const issues = [];
    let validCount = 0;

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNum = i + 2;
        const rawPhone = resolveField(record, headerMap, PHONE_ALIASES);

        if (!rawPhone) {
            issues.push({ row: rowNum, reason: 'Missing phone number' });
            continue;
        }

        const normalized = normalizePhone(rawPhone);
        if (!normalized || !isValidPhone(normalized)) {
            issues.push({ row: rowNum, raw: rawPhone, reason: `Invalid phone: "${rawPhone}"` });
            continue;
        }

        validCount++;
    }

    return { detectedCols, hasPhoneCol, totalRows: records.length, validCount, issues };
}
// ─────────────────────────────────────────────────────────────────────────────

// POST /contacts/import/prescan — validate without writing anything
router.post('/import/prescan', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        let records;
        try {
            records = parseCsv(req.file.buffer);
        } catch (e) {
            return res.status(400).json({ error: 'Could not parse CSV: ' + e.message });
        }

        if (!records.length) {
            return res.status(400).json({ error: 'The CSV file is empty or has no data rows.' });
        }

        const scan = scanRecords(records);

        if (!scan.hasPhoneCol) {
            return res.status(400).json({
                error: `No phone column detected. Expected one of: phone_number, phone, mobile, tel. ` +
                    `File has: ${Object.keys(records[0]).join(', ')}`
            });
        }

        res.json({
            totalRows: scan.totalRows,
            validCount: scan.validCount,
            invalidCount: scan.issues.length,
            detectedCols: scan.detectedCols,
            allColumns: Object.keys(records[0]),
            issues: scan.issues.slice(0, 100), // cap at 100 for display
        });
    } catch (err) {
        console.error('[contacts/import/prescan]', err);
        res.status(500).json({ error: 'Pre-scan failed' });
    }
});

// POST /contacts/import - CSV bulk upload (robust)

router.post('/import', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const { group_id } = req.body;

        let records;
        try {
            records = parseCsv(req.file.buffer);
        } catch (e) {
            return res.status(400).json({ error: 'Could not parse CSV: ' + e.message });
        }

        if (!records.length) {
            return res.status(400).json({ error: 'The CSV file is empty or has no data rows.' });
        }

        const headerMap = buildHeaderMap(records[0]);

        if (!PHONE_ALIASES.some(a => headerMap[a] !== undefined)) {
            return res.status(400).json({
                error: `No phone column found. Expected one of: phone_number, phone, mobile, tel. ` +
                    `File has: ${Object.keys(records[0]).join(', ')}`
            });
        }

        const client = await db.getClient();
        let imported = 0;
        let skipped = 0;
        const errors = [];

        try {
            await client.query('BEGIN');

            for (let i = 0; i < records.length; i++) {
                const record = records[i];
                const rowNum = i + 2; // +1 for 0-index, +1 to skip header
                const rawPhone = resolveField(record, headerMap, PHONE_ALIASES);

                if (!rawPhone) {
                    skipped++;
                    errors.push({ row: rowNum, reason: 'Missing phone number' });
                    continue;
                }

                const normalized = normalizePhone(rawPhone);
                if (!normalized || !isValidPhone(normalized)) {
                    skipped++;
                    errors.push({ row: rowNum, phone: rawPhone, reason: `Invalid phone number: "${rawPhone}"` });
                    continue;
                }

                const firstName = resolveField(record, headerMap, FNAME_ALIASES);
                const lastName = resolveField(record, headerMap, LNAME_ALIASES);

                try {
                    // Per-row savepoint: one bad row never aborts the batch
                    await client.query('SAVEPOINT sp_row');
                    const { rows } = await client.query(
                        `INSERT INTO contacts (phone_number, first_name, last_name)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (phone_number) DO UPDATE
                           SET first_name = EXCLUDED.first_name,
                               last_name  = EXCLUDED.last_name
                         RETURNING id`,
                        [normalized, firstName || null, lastName || null]
                    );

                    if (group_id) {
                        await client.query(
                            'INSERT INTO contact_groups (contact_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            [rows[0].id, group_id]
                        );
                    }
                    await client.query('RELEASE SAVEPOINT sp_row');
                    imported++;
                } catch (rowErr) {
                    await client.query('ROLLBACK TO SAVEPOINT sp_row');
                    skipped++;
                    errors.push({ row: rowNum, phone: normalized, reason: rowErr.message });
                }
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({ imported, skipped, total: records.length, errors: errors.slice(0, 50) });
    } catch (err) {
        console.error('[contacts/import]', err);
        res.status(500).json({ error: 'Internal server error during import' });
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
