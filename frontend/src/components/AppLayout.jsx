import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <div className="page">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
