require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { runMigrations } = require('./src/db/migrate');
const { initQueue } = require('./src/workers/queue');

const authRoutes = require('./src/routes/auth');
const groupRoutes = require('./src/routes/groups');
const contactRoutes = require('./src/routes/contacts');
const messageRoutes = require('./src/routes/messages');
const webhookRoutes = require('./src/routes/webhooks');
const dashboardRoutes = require('./src/routes/dashboard');
const userRoutes = require('./src/routes/users');

const app = express();

// Security & Logging
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS
app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    credentials: true,
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public webhook (must come before auth middleware)
app.use('/api/webhooks', webhookRoutes);

// Protected routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, _next) => {
    console.error('[Unhandled Error]', err);
    res.status(500).json({ error: 'An unexpected error occurred' });
});

const PORT = process.env.PORT || 5000;

async function start() {
    try {
        // Skip migrations if RUN_MIGRATIONS=false (e.g. external DB already migrated)
        if (process.env.RUN_MIGRATIONS !== 'false') {
            await runMigrations();
        } else {
            console.log('ℹ️  Skipping migrations (RUN_MIGRATIONS=false)');
        }

        // Start pg-boss queue
        await initQueue();

        app.listen(PORT, () => {
            console.log(`\n🚀 BizNotify API running on http://localhost:${PORT}`);
            console.log(`   ENV: ${process.env.NODE_ENV}`);
            console.log(`   DB:  ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')}\n`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        process.exit(1);
    }
}

start();
