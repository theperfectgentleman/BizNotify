import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard, Users, FolderOpen, Send, BarChart2, LogOut, Zap
} from 'lucide-react';

const navItems = [
    { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/app/contacts', icon: Users, label: 'Contacts' },
    { to: '/app/groups', icon: FolderOpen, label: 'Groups' },
    { to: '/app/compose', icon: Send, label: 'Compose' },
    { to: '/app/analytics', icon: BarChart2, label: 'Analytics' },
];

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

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
            </nav>

            <div className="sidebar-footer">
                <div className="user-pill">
                    <div className="user-avatar">{initials}</div>
                    <div className="user-info">
                        <div className="user-email">{user?.email}</div>
                        <div className="user-role">{user?.role}</div>
                    </div>
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
