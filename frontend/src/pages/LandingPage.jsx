import { Link } from 'react-router-dom';
import { Zap, ArrowRight, Shield, MessageCircle, BarChart3, Smartphone } from 'lucide-react';

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
                    <Link to="/login" className="btn btn-primary btn-sm">Sign In</Link>
                </div>
            </nav>

            {/* Immersive Hero */}
            <section className="landing-hero">
                <div className="hero-glow" />
                <div className="hero-grid" />

                <div className="hero-content">
                    <h1 className="hero-title">
                        Business alerts.
                        <br />
                        <span className="highlight">Perfected.</span>
                    </h1>
                    <p className="hero-subtitle">
                        A clean, professional hub for your business messages. Manage contact groups,
                        send personalized campaigns, and watch deliveries land in real-time.
                    </p>

                    <div className="hero-actions">
                        <Link to="/login" className="btn btn-primary btn-lg">
                            Open Dashboard <ArrowRight size={18} style={{ marginLeft: 8 }} />
                        </Link>
                    </div>

                    <div className="hero-dashboard-wrapper">
                        <div className="hero-abstract">
                            <div className="abstract-pill p1">
                                <MessageCircle size={16} />
                                <span>Security Update sent</span>
                            </div>
                            <div className="abstract-pill p2">
                                <Zap size={16} />
                                <span>Campaign Delivered</span>
                            </div>
                            <div className="abstract-pill p3">
                                <Shield size={16} />
                                <span>Encrypted</span>
                            </div>
                            <div className="abstract-pill p4">
                                <Activity size={16} />
                                <span>99.9% Uptime</span>
                            </div>

                            <div className="abstract-shape shape-1"></div>
                            <div className="abstract-shape shape-2"></div>
                            <div className="abstract-shape shape-3"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Simple Core Value Section */}
            <section className="platform-integrity">
                <div className="integrity-grid">
                    <div className="integrity-item">
                        <Shield size={24} className="integrity-icon" />
                        <div className="integrity-content">
                            <h3>Private & Secure</h3>
                            <p>Connect your own API keys. You maintain full ownership and privacy over every message sent.</p>
                        </div>
                    </div>
                    <div className="integrity-item">
                        <MessageCircle size={24} className="integrity-icon" />
                        <div className="integrity-content">
                            <h3>Better Reach</h3>
                            <p>Built-in support for SMS and WhatsApp ensures you can reach your audience wherever they are.</p>
                        </div>
                    </div>
                    <div className="integrity-item">
                        <Smartphone size={24} className="integrity-icon" />
                        <div className="integrity-content">
                            <h3>Personalized</h3>
                            <p>Send messages that matter. Use smart variables to address every contact by their name automatically.</p>
                        </div>
                    </div>
                    <div className="integrity-item">
                        <BarChart3 size={24} className="integrity-icon" />
                        <div className="integrity-content">
                            <h3>Live Tracking</h3>
                            <p>No more guessing. See sent, delivered, and read reports updated the moment they happen.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Simple Footer */}
            <footer className="landing-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="landing-nav-brand-icon" style={{ width: 28, height: 28, borderRadius: 6, fontSize: 14 }}>
                        <Zap size={14} color="#060a0f" strokeWidth={2.5} />
                    </div>
                    <span>BizNotify</span>
                </div>
                <div>Professional Messaging Hub</div>
            </footer>
        </div>
    );
}
