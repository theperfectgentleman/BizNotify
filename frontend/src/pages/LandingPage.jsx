import { Link } from 'react-router-dom';
import { Zap, MessageSquare, Users, BarChart2, Shield, Clock, CheckCircle2, ArrowRight, Cpu } from 'lucide-react';

const features = [
    {
        icon: <MessageSquare size={22} />,
        color: 'teal',
        bg: 'rgba(0,212,170,0.1)',
        title: 'SMS & WhatsApp Campaigns',
        desc: 'Send personalized bulk messages across channels with variable injection like {{first_name}} — at scale.',
    },
    {
        icon: <Users size={22} />,
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.1)',
        title: 'Smart Contact Groups',
        desc: 'Organize contacts into nested groups. Import thousands via CSV upload in seconds.',
    },
    {
        icon: <BarChart2 size={22} />,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.1)',
        title: 'Real-time Delivery Tracking',
        desc: 'Live delivery reports from Termii webhooks. See exactly who got your message and who didn\'t.',
    },
    {
        icon: <Clock size={22} />,
        color: '#a855f7',
        bg: 'rgba(168,85,247,0.1)',
        title: 'Scheduled Campaigns',
        desc: 'Queue campaigns to send at a specific date and time. Powered by a reliable PostgreSQL job queue.',
    },
    {
        icon: <Shield size={22} />,
        color: '#10b981',
        bg: 'rgba(16,185,129,0.1)',
        title: 'Retry & Fault Tolerance',
        desc: 'Exponential backoff retries ensure zero messages are lost even if the API is temporarily down.',
    },
    {
        icon: <Cpu size={22} />,
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.1)',
        title: 'No Redis Required',
        desc: 'Built on pg-boss — a battle-tested PostgreSQL job queue. Simpler ops, no extra infrastructure.',
    },
];

export default function LandingPage() {
    return (
        <div className="landing">
            {/* Navbar */}
            <nav className="landing-nav">
                <div className="landing-nav-brand">
                    <div className="landing-nav-brand-icon">
                        <Zap size={18} color="#060a0f" strokeWidth={2.5} />
                    </div>
                    Biz<span>Notify</span>
                </div>
                <div className="landing-nav-links">
                    <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
                    <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="landing-hero">
                <div className="hero-glow" />
                <div className="hero-grid" />
                <div className="hero-content">
                    <div className="hero-eyebrow">
                        <Zap size={13} />
                        Powered by Termii · No Redis required
                    </div>
                    <h1 className="hero-title">
                        Reach everyone.
                        <br />
                        <span className="highlight">Instantly.</span>
                    </h1>
                    <p className="hero-subtitle">
                        A modern SMS &amp; WhatsApp campaign hub for businesses. Manage contacts,
                        send personalized bulk messages, and track every delivery — all in one place.
                    </p>
                    <div className="hero-actions">
                        <Link to="/register" className="btn btn-primary btn-lg">
                            Start Free <ArrowRight size={18} />
                        </Link>
                        <Link to="/login" className="btn btn-secondary btn-lg">
                            Sign In
                        </Link>
                    </div>

                    <div className="hero-stats">
                        {[
                            { value: '99.9%', label: 'Uptime SLA' },
                            { value: '< 2s', label: 'Queue Pickup Time' },
                            { value: '∞', label: 'Contacts Supported' },
                        ].map((s) => (
                            <div key={s.label} style={{ textAlign: 'center' }}>
                                <div className="hero-stat-value">{s.value}</div>
                                <div className="hero-stat-label">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="landing-features">
                <div>
                    <div className="section-eyebrow">Everything you need</div>
                    <h2 className="section-title">Built for real campaigns,<br />not demos.</h2>
                    <p className="section-subtitle">
                        Every feature is designed for production — retry logic, phone normalization,
                        opt-out tracking, and webhook delivery reports out of the box.
                    </p>
                </div>

                <div className="features-grid">
                    {features.map((f) => (
                        <div key={f.title} className="feature-card">
                            <div className="feature-icon" style={{ background: f.bg, color: f.color }}>
                                {f.icon}
                            </div>
                            <div className="feature-title">{f.title}</div>
                            <div className="feature-desc">{f.desc}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section style={{ padding: '60px', background: 'var(--clr-surface)', borderTop: '1px solid var(--clr-border)', borderBottom: '1px solid var(--clr-border)' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                        <div className="section-eyebrow">How it works</div>
                        <div className="section-title" style={{ marginBottom: 0 }}>Three steps to every campaign</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '32px' }}>
                        {[
                            { step: '01', title: 'Import Contacts', desc: 'Upload a CSV or add contacts manually. Numbers are normalized automatically.' },
                            { step: '02', title: 'Compose Message', desc: 'Write with {{first_name}} variables. Choose SMS or WhatsApp. Schedule or send now.' },
                            { step: '03', title: 'Track Delivery', desc: 'Termii webhooks update statuses in real time. See sent, delivered, and failed counts live.' },
                        ].map((item) => (
                            <div key={item.step} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{
                                    fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: '800',
                                    color: 'var(--clr-accent)', opacity: 0.3, lineHeight: 1
                                }}>
                                    {item.step}
                                </div>
                                <div>
                                    <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>{item.title}</div>
                                    <div style={{ fontSize: '14px', color: 'var(--clr-text-2)', lineHeight: 1.6 }}>{item.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="landing-cta">
                <div className="cta-box">
                    <div style={{ marginBottom: '20px' }}>
                        <CheckCircle2 size={40} color="var(--clr-accent)" />
                    </div>
                    <div className="cta-title">Ready to send?</div>
                    <div className="cta-sub">
                        Set up your account in minutes. Connect your Termii API key and start reaching your audience.
                    </div>
                    <Link to="/register" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                        Create Free Account <ArrowRight size={18} />
                    </Link>
                    <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--clr-text-3)' }}>
                        No credit card required
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="landing-nav-brand-icon" style={{ width: 28, height: 28, borderRadius: 6, fontSize: 14 }}>
                        <Zap size={14} color="#060a0f" strokeWidth={2.5} />
                    </div>
                    <span>BizNotify</span>
                </div>
                <div>© 2026 BizNotify · SMS &amp; WhatsApp Campaign Hub</div>
            </footer>
        </div>
    );
}
