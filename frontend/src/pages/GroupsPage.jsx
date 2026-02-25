import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Eye, FolderOpen, Plus, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import './GroupsPage.css';

function GroupModal({ onClose, onSaved, groups, editing }) {
    const [form, setForm] = useState({
        name: editing?.name || '',
        description: editing?.description || '',
        parent_group_id: editing?.parent_group_id || '',
    });
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
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">{editing ? 'Edit Group' : 'New Group'}</div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Group Name *</label>
                            <input className="form-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="e.g. Premium Customers" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Optional description…" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Parent Group (optional)</label>
                            <select className="form-select" value={form.parent_group_id} onChange={(e) => setForm((prev) => ({ ...prev, parent_group_id: e.target.value }))}>
                                <option value="">None (top-level)</option>
                                {groups.filter((g) => g.id !== editing?.id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
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

GroupModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    onSaved: PropTypes.func.isRequired,
    groups: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
    })).isRequired,
    editing: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        description: PropTypes.string,
        parent_group_id: PropTypes.string,
    }),
};

GroupModal.defaultProps = {
    editing: null,
};

export default function GroupsPage() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);

    const [selectedGroupId, setSelectedGroupId] = useState('');
    const selectedGroup = useMemo(
        () => groups.find((group) => group.id === selectedGroupId) || null,
        [groups, selectedGroupId]
    );

    const [members, setMembers] = useState([]);
    const [membersTotal, setMembersTotal] = useState(0);
    const [membersLoading, setMembersLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchTotal, setSearchTotal] = useState(0);

    const [addingResults, setAddingResults] = useState(false);
    const [addReport, setAddReport] = useState(null);

    const fetchGroups = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/groups');
            setGroups(data);
            setSelectedGroupId((prev) => {
                if (!prev && data.length > 0) return data[0].id;
                if (prev && !data.some((entry) => entry.id === prev)) return data[0]?.id || '';
                return prev;
            });
        } finally {
            setLoading(false);
        }
    }, []);

    const loadGroupMembers = async (groupId) => {
        if (!groupId) {
            setMembers([]);
            setMembersTotal(0);
            return;
        }

        setMembersLoading(true);
        try {
            const { data } = await api.get(`/groups/${groupId}/members`, {
                params: { page: 1, limit: 100 },
            });
            setMembers(data.members || []);
            setMembersTotal(Number(data.total || 0));
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load group members');
        } finally {
            setMembersLoading(false);
        }
    };

    const runGlobalSearch = async () => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            setSearchTotal(0);
            return;
        }

        setSearchLoading(true);
        setAddReport(null);
        try {
            const { data } = await api.get('/contacts', {
                params: {
                    page: 1,
                    limit: 100,
                    search: searchTerm.trim(),
                },
            });
            setSearchResults(data.contacts || []);
            setSearchTotal(Number(data.total || 0));
        } catch (err) {
            toast.error(err.response?.data?.error || 'Search failed');
        } finally {
            setSearchLoading(false);
        }
    };

    const addSearchResultsToGroup = async () => {
        if (!selectedGroupId) return toast.error('Select a group first');
        if (searchResults.length === 0) return toast.error('No results to add');

        setAddingResults(true);
        setAddReport(null);
        try {
            const contactIds = searchResults.map((contact) => contact.id);
            const { data } = await api.post(`/groups/${selectedGroupId}/add-contacts`, {
                contact_ids: contactIds,
            });

            setAddReport(data);
            toast.success(`Added ${data.added} of ${data.requested}`);
            await Promise.all([fetchGroups(), loadGroupMembers(selectedGroupId)]);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add contacts to group');
        } finally {
            setAddingResults(false);
        }
    };

    const deleteGroup = async (id) => {
        if (!confirm('Delete this group? Contacts will not be deleted.')) return;
        try {
            await api.delete(`/groups/${id}`);
            toast.success('Group deleted');
            await fetchGroups();
        } catch {
            toast.error('Delete failed');
        }
    };

    const openEdit = (group) => {
        setEditing(group);
        setShowModal(true);
    };

    const openNew = () => {
        setEditing(null);
        setShowModal(true);
    };

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    useEffect(() => {
        loadGroupMembers(selectedGroupId);
        setAddReport(null);
    }, [selectedGroupId]);

    return (
        <>
            <div className="groups-header-row">
                <div>
                    <div className="page-title">Groups</div>
                    <div className="page-subtitle">Organize contacts into segments for targeted campaigns</div>
                </div>
            </div>

            {loading ? (
                <div className="loading-center"><span className="spinner" /></div>
            ) : (
                <div className="groups-layout">
                    <div className="groups-left card">
                        <div className="groups-left-header">
                            <h3>Groups</h3>
                            <button className="btn btn-primary btn-sm" onClick={openNew}>
                                <Plus size={14} /> New Group
                            </button>
                        </div>

                        {groups.length === 0 ? (
                            <div className="empty-state" style={{ padding: 12 }}>
                                <div className="empty-icon"><FolderOpen size={24} /></div>
                                <div className="empty-title">No groups yet</div>
                                <div className="empty-desc">Create groups to segment your contacts.</div>
                            </div>
                        ) : (
                            <div className="groups-cards-grid">
                                {groups.map((group) => (
                                    <div key={group.id} className={`groups-card ${selectedGroupId === group.id ? 'active' : ''}`}>
                                        <div className="groups-card-top">
                                            <div className="groups-card-icon"><FolderOpen size={16} /></div>
                                            <div className="groups-card-actions">
                                                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedGroupId(group.id)}>
                                                    <Eye size={12} /> View
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(group)}>
                                                    Edit
                                                </button>
                                                <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteGroup(group.id)}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="groups-card-title">{group.name}</div>
                                        <div className="groups-card-meta">
                                            <Users size={12} /> {Number(group.contact_count || 0).toLocaleString()} contacts
                                        </div>
                                        {group.description && <div className="groups-card-desc">{group.description}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="groups-right card">
                        <div className="groups-right-header">
                            <h3>{selectedGroup ? `Members · ${selectedGroup.name}` : 'Select a group'}</h3>
                            <span className="groups-count-pill">{membersTotal} member(s)</span>
                        </div>

                        <div className="groups-search-row">
                            <div className="search-bar" style={{ flex: 1 }}>
                                <Search size={14} />
                                <input
                                    className="form-input"
                                    placeholder="Search all contacts by name, number, or date"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            runGlobalSearch();
                                        }
                                    }}
                                />
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={runGlobalSearch} disabled={searchLoading}>
                                {searchLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Search size={13} />} Search
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={addSearchResultsToGroup}
                                disabled={!selectedGroupId || searchResults.length === 0 || addingResults}
                            >
                                {addingResults ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <UserPlus size={13} />} Add Results
                            </button>
                        </div>

                        {addReport && (
                            <div className="groups-report">
                                Added {addReport.added} of {addReport.requested} result(s); {addReport.ignored} already in group or ignored.
                            </div>
                        )}

                        <div className="groups-panel-grid">
                            <div className="groups-panel-box">
                                <div className="groups-panel-title">Search Results ({searchTotal})</div>
                                {searchResults.length === 0 ? (
                                    <div className="groups-empty-mini">No results yet. Run a search.</div>
                                ) : (
                                    <div className="groups-list">
                                        {searchResults.map((contact) => (
                                            <div key={`result-${contact.id}`} className="groups-list-row">
                                                <div className="groups-list-name">
                                                    {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                                                </div>
                                                <div className="groups-list-phone">{contact.phone_number}</div>
                                                <div className="groups-list-date">{new Date(contact.created_at).toLocaleDateString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="groups-panel-box">
                                <div className="groups-panel-title">Current Members</div>
                                {membersLoading ? (
                                    <div className="loading-center"><span className="spinner" /></div>
                                ) : members.length === 0 ? (
                                    <div className="groups-empty-mini">No members in this group.</div>
                                ) : (
                                    <div className="groups-list">
                                        {members.map((member) => (
                                            <div key={`member-${member.id}`} className="groups-list-row">
                                                <div className="groups-list-name">
                                                    {[member.first_name, member.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                                                </div>
                                                <div className="groups-list-phone">{member.phone_number}</div>
                                                <div className="groups-list-date">{new Date(member.created_at).toLocaleDateString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <GroupModal
                    onClose={() => setShowModal(false)}
                    onSaved={fetchGroups}
                    groups={groups}
                    editing={editing}
                />
            )}
        </>
    );
}
