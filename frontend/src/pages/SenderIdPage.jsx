import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, CheckCircle2, Clock, XCircle, Search } from 'lucide-react';
import api from '../services/api';

export default function SenderIdPage() {
    const [senderIds, setSenderIds] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        sender_id: '',
        usecase: '',
        company: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchSenderIds();
    }, []);

    const fetchSenderIds = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/termii/sender-ids');
            // The response structure based on termii docs: res.data.content is an array
            // If they modify the backend we need to be safe
            const list = res.data?.content || res.data || [];
            setSenderIds(Array.isArray(list) ? list : []);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to fetch sender IDs');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequest = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/termii/sender-ids/request', formData);
            toast.success('Sender ID requested successfully!');
            fetchSenderIds();
            setIsModalOpen(false);
            setFormData({ sender_id: '', usecase: '', company: '' });
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to request sender ID');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'active':
                return <CheckCircle2 size={16} className="text-green" style={{ color: 'var(--clr-green)' }} />;
            case 'pending':
                return <Clock size={16} className="text-orange" style={{ color: 'var(--clr-primary)' }} />;
            case 'unblock':
            case 'blocked':
                return <XCircle size={16} className="text-red" style={{ color: 'var(--clr-red)' }} />;
            default:
                return null;
        }
    };

    const filteredIds = senderIds.filter(s =>
        s.sender_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fade-in">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Sender IDs</h1>
                    <p className="page-subtitle">Manage and request alphanumeric Sender IDs for SMS messaging.</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setIsModalOpen(true)}
                >
                    <Plus size={16} /> Request Sender ID
                </button>
            </header>

            <div className="card toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search sender IDs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="card table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Sender ID</th>
                            <th>Company</th>
                            <th>Status</th>
                            <th>Requested At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="4" className="text-center">Loading sender IDs...</td></tr>
                        ) : filteredIds.length === 0 ? (
                            <tr><td colSpan="4" className="text-center text-muted">No sender IDs found.</td></tr>
                        ) : (
                            filteredIds.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="font-medium">{item.sender_id}</td>
                                    <td>{item.company || '-'}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {getStatusIcon(item.status)}
                                            <span style={{ textTransform: 'capitalize' }}>{item.status || 'Unknown'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => !isSubmitting && setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Request Sender ID</h2>
                        </div>
                        <form onSubmit={handleRequest} className="modal-body">
                            <div className="form-group">
                                <label>Sender ID <span className="text-red">*</span></label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. AcmeCorp (max 11 chars)"
                                    maxLength={11}
                                    value={formData.sender_id}
                                    onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
                                    required
                                />
                                <small className="text-muted">Maximum of 11 alphanumeric characters.</small>
                            </div>

                            <div className="form-group">
                                <label>Company Name <span className="text-red">*</span></label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. Acme Corporation"
                                    value={formData.company}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Sample Message (Use Case) <span className="text-red">*</span></label>
                                <textarea
                                    className="input"
                                    placeholder="e.g. Your verification code is 12345."
                                    rows={3}
                                    value={formData.usecase}
                                    onChange={(e) => setFormData({ ...formData, usecase: e.target.value })}
                                    required
                                />
                                <small className="text-muted">A sample message you intend to send.</small>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '20px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Requesting...' : 'Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
