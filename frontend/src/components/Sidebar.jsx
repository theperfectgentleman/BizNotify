import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import {
    LayoutDashboard, Users, FolderOpen, Send, BarChart2, LogOut, Zap, ShieldCheck, Sun, Moon, Link, Wallet
} from 'lucide-react';

const navItems = [
    { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/app/contacts', icon: Users, label: 'Contacts' },
    { to: '/app/groups', icon: FolderOpen, label: 'Groups' },
    { to: '/app/compose/campaign', icon: Send, label: 'Campaigns' },
    { to: '/app/compose/instant', icon: Zap, label: 'Instant Message' },
    { to: '/app/analytics', icon: BarChart2, label: 'Analytics' },
    { to: '/app/sender-ids', icon: Link, label: 'Sender IDs' },
];

export default function Sidebar() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [balance, setBalance] = useState(null);

    useEffect(() => {
        api.get('/termii/balance')
            .then(res => {
                if (res.data?.success) {
                    setBalance(res.data);
                }
            })
            .catch(() => { });
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const initials = user?.email?.slice(0, 2).toUpperCase() || 'BN';

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="sidebar-brand-icon">
                    <Zap size={18} color="#060a0f" strokeWidth={2.5} />
                </div>
                <div className="sidebar-brand-name">Biz<span>Notify</span></div>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section-label">Main</div>
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    >
                        <Icon size={16} />
                        {label}
                    </NavLink>
                ))}

                {user?.role === 'admin' && (
                    <>
                        <div className="sidebar-section-label" style={{ marginTop: 16 }}>Admin</div>
                        <NavLink
                            to="/app/users"
                            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                        >
                            <ShieldCheck size={16} />
                            Manage Users
                        </NavLink>
                    </>
                )}
            </nav>

            <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {balance && (
                    <div style={{ background: 'var(--clr-surface-2)', border: '1px solid var(--clr-border)', borderRadius: '12px', padding: '16px', borderLeft: '4px solid var(--clr-accent)' }}>
                        <div style={{ background: 'var(--clr-accent-dim)', display: 'inline-flex', padding: 8, borderRadius: 8, marginBottom: 12 }}>
                            <Wallet size={16} color="var(--clr-accent)" />
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>{balance.currency} {balance.balance}</div>
                        <div style={{ fontSize: 13, color: 'var(--clr-text-3)' }}>Termii Balance</div>
                    </div>
                )}

                <div className="user-pill">
                    <div className="user-avatar">{initials}</div>
                    <div className="user-info">
                        <div className="user-email">{user?.email}</div>
                        <div className="user-role">{user?.role}</div>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className="btn btn-ghost btn-icon"
                        title="Toggle theme"
                        style={{ marginRight: 2 }}
                    >
                        {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="btn btn-ghost btn-icon"
                        title="Sign out"
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
