import Sidebar from './Sidebar';
import { Outlet, useLocation } from 'react-router-dom';

export default function AppLayout() {
    const location = useLocation();
    
    // Pages that need full width/height (no default padding)
    const isFullWidth = location.pathname.includes('/campaigns/');

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className={isFullWidth ? '' : 'page'}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
