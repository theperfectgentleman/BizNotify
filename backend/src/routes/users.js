const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All routes require auth + admin
router.use(requireAuth, requireAdmin);

// GET /users - list all users
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, email, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error('[users/list]', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /users - create a new user account
router.post('/', async (req, res) => {
    try {
        const { email, password, role = 'staff' } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (!['admin', 'staff'].includes(role)) {
            return res.status(400).json({ error: 'Role must be admin or staff' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const password_hash = await bcrypt.hash(password, 12);
        const { rows } = await db.query(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
            [email.toLowerCase(), password_hash, role]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[users/create]', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PATCH /users/:id/reset-password - reset a user's password
router.patch('/:id/reset-password', async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const password_hash = await bcrypt.hash(password, 12);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, id]);

        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        console.error('[users/reset-password]', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// DELETE /users/:id - delete a user (cannot delete yourself)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted' });
    } catch (err) {
        console.error('[users/delete]', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
