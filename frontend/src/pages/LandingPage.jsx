import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import '../landing-v2.css';

export default function LandingPage() {
    useEffect(() => {
        // Generate motion lines
        const container = document.getElementById('line-container');
        if (container && container.childNodes.length === 0) {
            const lineCount = 14;
            for (let i = 0; i < lineCount; i++) {
                const line = document.createElement('div');
                line.className = 'stream-line';
                line.style.left = `${Math.random() * 100}%`;
                line.style.top = `-450px`;
                container.appendChild(line);
            }
        }

        // Run animations safely in Strict mode using gsap.context
        const ctx = gsap.context(() => {
            if (container) {
                const lines = gsap.utils.toArray(container.childNodes);
                lines.forEach(line => {
                    const duration = 8 + Math.random() * 6;
                    const delay = Math.random() * 10;

                    gsap.to(line, {
                        top: '120%',
                        duration: duration,
                        delay: delay,
                        ease: "none",
                        repeat: -1,
                        onRepeat: () => {
                            line.style.left = `${Math.random() * 100}%`;
                        }
                    });
                });
            }

            // Run animations
            const tl = gsap.timeline({ defaults: { ease: "power4.out", duration: 1.8 } });

            tl.from("#hero-reveal > *", {
                y: 100,
                opacity: 0,
                stagger: 0.12,
                rotateX: -20,
                transformOrigin: "top left"
            })
                .from("#cta-reveal", {
                    y: 50,
                    opacity: 0
                }, "-=1.2")
                .from("#bento-reveal .glass-panel", {
                    scale: 0.95,
                    opacity: 0,
                    stagger: 0.08,
                    duration: 1.5
                }, "-=1.8")
                .from(".floating-ui", {
                    y: 120,
                    rotate: 0,
                    opacity: 0,
                    duration: 2.5
                }, "-=1.5");

            // Slow float animation for icon box
            gsap.to(".floating-ui", {
                y: -30,
                duration: 5,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });
        });

        return () => {
            ctx.revert();
            if (container) container.innerHTML = '';
        };
    }, []);

    return (
        <div className="landing-v2">
            <div className="glow-orb" style={{ top: '-200px', right: '-200px' }}></div>
            <div className="glow-orb" style={{ bottom: '10%', left: '-200px', background: 'radial-gradient(circle, rgba(34, 211, 238, 0.06) 0%, transparent 70%)' }}></div>

            {/* Navigation */}
            <nav className="landing-v2-nav">
                <div className="nav-brand-v2">
                    <div className="nav-icon-v2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3.5"><path d="m13 2-2 10h9L7 22l2-10H1L13 2Z" /></svg>
                    </div>
                    <span className="nav-title-v2">Biz<span>Notify</span></span>
                </div>
                <div className="nav-links-v2">
                    <Link to="/login" className="btn-portal">Portal Access</Link>
                </div>
            </nav>

            <main className="landing-v2-main">
                <div className="landing-v2-grid">

                    {/* Left: Hero Content */}
                    <div className="hero-content-v2">
                        <div id="hero-reveal">
                            <div className="status-badge-v2">
                                <span className="status-dot-v2">
                                    <span className="status-ping-v2"></span>
                                    <span className="status-core-v2"></span>
                                </span>
                                <span className="status-text-v2">System Online</span>
                            </div>
                            <h1 className="heavy-display-title">
                                REACH <br />
                                <span className="text-gradient">EVERYONE.</span><br />
                                EVERY <br />
                                TIME.
                            </h1>
                            <p className="hero-desc-v2">
                                The professional messaging hub. Manage contacts, send personalized campaigns, and track deliveries in real-time.
                            </p>
                        </div>

                        <div id="cta-reveal" className="cta-row-v2">
                            <Link to="/login" className="btn-bold-v2">
                                Get Started
                            </Link>
                            <div className="latency-stat">
                                <span className="latency-val">99.9%</span>
                                <span className="latency-label">Uptime SLA</span>
                            </div>
                        </div>

                        <div className="stats-row-v2">
                            <div className="stat-card">
                                <div className="stat-card-title">Better Reach</div>
                                <div className="stat-card-sub">SMS & WhatsApp</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-card-title">Private & Secure</div>
                                <div className="stat-card-sub">Bring Your Own API Keys</div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Interactive Bento Mockup + Motion Lines */}
                    <div className="hero-bento-v2">
                        <div id="line-container" className="data-stream-container"></div>

                        <div id="bento-reveal" className="bento-grid">
                            {/* Main Communication Hub */}
                            <div className="bento-main glass-panel">
                                <div className="bento-header">
                                    <div className="skeleton-line-sm"></div>
                                    <div className="bento-icon-box">
                                        <div className="pulse-dot"></div>
                                    </div>
                                </div>
                                <div className="bento-body">
                                    <div className="bento-row">
                                        <div className="bento-avatar-1"></div>
                                        <div className="bento-text-stack">
                                            <div className="skeleton-line-full"></div>
                                            <div className="skeleton-line-half"></div>
                                        </div>
                                    </div>
                                    <div className="bento-row faded">
                                        <div className="bento-avatar-2"></div>
                                        <div className="bento-text-stack">
                                            <div className="skeleton-line-mid"></div>
                                            <div className="skeleton-line-sm2"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stability Metric */}
                            <div className="bento-uptime glass-panel">
                                <div className="uptime-val">99<span>%</span></div>
                                <div className="uptime-label">Uptime Core</div>
                            </div>

                            {/* Visual Traffic Chart */}
                            <div className="bento-chart glass-panel">
                                <div className="chart-bars">
                                    <div className="bar b1"></div>
                                    <div className="bar b2"></div>
                                    <div className="bar b3"></div>
                                    <div className="bar b4"></div>
                                </div>
                                <div className="chart-label">Realtime</div>
                            </div>

                            {/* Console Action Bar */}
                            <div className="bento-console glass-panel">
                                <div className="console-dots">
                                    <div></div><div></div><div></div>
                                </div>
                                <div className="console-actions">
                                    <div className="action-btn-1"></div>
                                    <div className="action-btn-2"></div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Protocol Box */}
                        <div className="floating-ui glass-panel">
                            <div className="floating-ui-inner">
                                <svg className="floating-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                                <div className="floating-glow-bg"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="footer-v2">
                <div className="footer-v2-left">
                    <span>© 2026 BizNotify Protocol</span>
                    <span className="footer-v2-dot"></span>
                    <span className="footer-v2-stable">Stable Build</span>
                </div>
            </footer>
        </div>
    );
}
