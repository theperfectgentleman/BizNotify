const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('./index');

// Strip the seed INSERT from the SQL file — we handle it in Node
// so we always use bcryptjs to generate the hash (no stale hardcoded hash).
function stripSeedBlock(sql) {
    const marker = '-- ── Default Admin Seed ──';
    const idx = sql.indexOf(marker);
    return idx !== -1 ? sql.slice(0, idx) : sql;
}

async function runMigrations() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const rawSql = fs.readFileSync(schemaPath, 'utf8');
    const schemaSql = stripSeedBlock(rawSql);

    const client = await pool.connect();
    try {
        await client.query(schemaSql);
        console.log('✅ Database schema applied successfully.');

        // Seed default admin if not already present
        const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@biznotify.com';
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin1234';

        const existing = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (existing.rowCount === 0) {
            const hash = await bcrypt.hash(adminPassword, 12);
            await client.query(
                `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')`,
                [adminEmail, hash]
            );
            console.log(`✅ Default admin created: ${adminEmail} (password: ${adminPassword})`);
            console.log('   ⚠️  Change this password after first login!');
        } else {
            console.log(`ℹ️  Admin account already exists: ${adminEmail}`);
        }
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { runMigrations };
