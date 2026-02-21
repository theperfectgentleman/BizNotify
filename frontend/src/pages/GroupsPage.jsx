import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, FolderOpen, Users } from 'lucide-react';

function GroupModal({ onClose, onSaved, groups, editing }) {
    const [form, setForm] = useState({ name: editing?.name || '', description: editing?.description || '', parent_group_id: editing?.parent_group_id || '' });
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editing) {
                await api.put(`/groups/${editing.id}`, form);
                toast.success('Group updated');
            } else {
                await api.post('/groups', form);
                toast.success('Group created');
            }
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">{editing ? 'Edit Group' : 'New Group'}</div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Group Name *</label>
                            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Premium Customers" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description…" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Parent Group (optional)</label>
                            <select className="form-select" value={form.parent_group_id} onChange={e => setForm(f => ({ ...f, parent_group_id: e.target.value }))}>
                                <option value="">None (top-level)</option>
                                {groups.filter(g => g.id !== editing?.id).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                            {editing ? 'Save Changes' : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function GroupsPage() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);

    const fetch = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/groups');
            setGroups(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetch(); }, []);

    const deleteGroup = async (id) => {
        if (!confirm('Delete this group? Contacts will not be deleted.')) return;
        try {
            await api.delete(`/groups/${id}`);
            toast.success('Group deleted');
            fetch();
        } catch {
            toast.error('Delete failed');
        }
    };

    const openEdit = (g) => { setEditing(g); setShowModal(true); };
    const openNew = () => { setEditing(null); setShowModal(true); };

    return (
        <>
            <div className="page-header">
                <div>
                    <div className="page-title">Groups</div>
                    <div className="page-subtitle">Organize contacts into segments for targeted campaigns</div>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    <Plus size={15} /> New Group
                </button>
            </div>

            {loading ? (
                <div className="loading-center"><span className="spinner" /></div>
            ) : groups.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-icon"><FolderOpen size={28} /></div>
                        <div className="empty-title">No groups yet</div>
                        <div className="empty-desc">Create groups to segment your contacts for targeted messaging.</div>
                        <button className="btn btn-primary mt-4" onClick={openNew}><Plus size={14} /> Create Group</button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {groups.map(g => (
                        <div key={g.id} className="card" style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--clr-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--clr-accent)' }}>
                                    <FolderOpen size={18} />
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(g)}>Edit</button>
                                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteGroup(g.id)}><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{g.name}</div>
                            {g.description && <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginBottom: 12 }}>{g.description}</div>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--clr-text-3)' }}>
                                <Users size={13} />
                                <span>{Number(g.contact_count).toLocaleString()} contacts</span>
                            </div>
                            {g.parent_group_id && (
                                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--clr-text-3)' }}>
                                    Subgroup of {groups.find(p => p.id === g.parent_group_id)?.name || 'another group'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <GroupModal
                    onClose={() => setShowModal(false)}
                    onSaved={fetch}
                    groups={groups}
                    editing={editing}
                />
            )}
        </>
    );
}
