import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import PropTypes from 'prop-types';
import { 
    ArrowLeft, CalendarPlus, Edit3, Save, Clock3, MessageSquare, 
    Users, ChevronRight, ChevronDown, PlusCircle, LayoutTemplate, 
    Send, Smartphone, MessageCircle, BarChart3, AlertCircle, CheckCircle2 
} from 'lucide-react';
import './CampaignItemsPage.css';

function StatusBadge({ status }) {
    const colorMap = {
        draft: 'var(--clr-text-3)',
        scheduled: 'var(--clr-blue)',
        sent: 'var(--clr-green)',
        failed: 'var(--clr-red)',
        processing: 'var(--clr-amber)'
    };
    
    return (
        <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 4, 
            padding: '2px 8px', 
            borderRadius: 12, 
            fontSize: 11, 
            fontWeight: 600, 
            background: colorMap[status] || 'var(--clr-surface-3)', 
            color: 'var(--clr-surface)', 
            opacity: 0.9 
        }}>
            {status}
        </span>
    );
}

StatusBadge.propTypes = {
    status: PropTypes.string,
};

function toIsoOrNull(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

export default function CampaignItemsPage() {
    const { campaignId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [campaigns, setCampaigns] = useState([]);
    const [campaign, setCampaign] = useState(null);
    const [selectedCampaignId, setSelectedCampaignId] = useState(null);
    const [items, setItems] = useState([]);
    const [groups, setGroups] = useState([]);
    const [showCreateMessage, setShowCreateMessage] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
    const [showCampaignForm, setShowCampaignForm] = useState(true);
    const [campaignSearch, setCampaignSearch] = useState('');
    const campaignDropdownRef = useRef(null);

    const [campaignMode, setCampaignMode] = useState('edit'); // edit | create
    const [campaignForm, setCampaignForm] = useState({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        target_reach: '',
    });
    const isMockMode = true;

    const [createForm, setCreateForm] = useState({
        title: '',
        message_body: '',
        scheduled_at: '',
        group_ids: [],
        channel: 'generic',
        message_type: 'plain',
    });

    const [selectedItemId, setSelectedItemId] = useState(null);

    const selectedGroups = useMemo(
        () => groups.filter((group) => createForm.group_ids.includes(group.id)),
        [groups, createForm.group_ids]
    );

    const filteredCampaigns = useMemo(() => {
        const keyword = campaignSearch.trim().toLowerCase();
        if (!keyword) return campaigns;
        return campaigns.filter((entry) => entry.title?.toLowerCase().includes(keyword));
    }, [campaigns, campaignSearch]);

    const activeCampaignSummary = useMemo(
        () => campaigns.find((entry) => entry.id === selectedCampaignId) || null,
        [campaigns, selectedCampaignId]
    );

    const loadWorkspace = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: campaignsData }, { data: groupsData }] = await Promise.all([
                api.get('/messages/campaigns'),
                api.get('/groups'),
            ]);

            const campaignList = Array.isArray(campaignsData) ? campaignsData : [];
            setCampaigns(campaignList);
            setGroups(groupsData || []);

            let nextCampaignId = null;
            if (campaignId && campaignList.some((entry) => entry.id === campaignId)) {
                nextCampaignId = campaignId;
            } else if (selectedCampaignId && campaignList.some((entry) => entry.id === selectedCampaignId)) {
                nextCampaignId = selectedCampaignId;
            } else if (campaignList.length > 0) {
                nextCampaignId = campaignList[0].id;
            }

            if (nextCampaignId) {
                setSelectedCampaignId(nextCampaignId);
                setCampaignMode('edit');
            } else {
                setSelectedCampaignId(null);
                setCampaign(null);
                setItems([]);
                setCampaignMode('create');
                setCampaignForm({
                    title: '',
                    description: '',
                    start_date: '',
                    end_date: '',
                    target_reach: '',
                });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load campaigns');
            navigate('/app/analytics');
        } finally {
            setLoading(false);
        }
    }, [campaignId, navigate, selectedCampaignId]);

    const loadCampaignItems = useCallback(async (activeCampaignId) => {
        if (!activeCampaignId) {
            setCampaign(null);
            setItems([]);
            setSelectedItemId(null);
            return;
        }

        try {
            const { data } = await api.get(`/messages/campaigns/${activeCampaignId}/items`);
            const nextItems = data.items || [];
            setCampaign(data.campaign || null);
            setItems(nextItems);
            setSelectedItemId((prev) => {
                if (nextItems.length === 0) return null;
                if (prev && nextItems.some((item) => item.id === prev)) return prev;
                return nextItems[0].id;
            });

            if (data.campaign) {
                setCampaignForm((prev) => ({
                    ...prev,
                    title: data.campaign.title || '',
                }));
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load campaign details');
        }
    }, []);

    useEffect(() => {
        loadWorkspace();
    }, [loadWorkspace]);

    useEffect(() => {
        if (campaignMode === 'edit') {
            loadCampaignItems(selectedCampaignId);
        }
    }, [campaignMode, selectedCampaignId, loadCampaignItems]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!campaignDropdownRef.current) return;
            if (!campaignDropdownRef.current.contains(event.target)) {
                setShowCampaignDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleGroup = (id) => {
        setCreateForm((prev) => ({
            ...prev,
            group_ids: prev.group_ids.includes(id)
                ? prev.group_ids.filter((groupId) => groupId !== id)
                : [...prev.group_ids, id],
        }));
    };

    const startNewCampaign = () => {
        setCampaignMode('create');
        setCampaignForm({
            title: '',
            description: '',
            start_date: '',
            end_date: '',
            target_reach: '',
        });
        setShowCreateMessage(false);
        setShowCampaignDropdown(false);
    };

    const selectCampaign = (id) => {
        setCampaignMode('edit');
        setSelectedCampaignId(id);
        setShowCreateMessage(false);
        setShowCampaignDropdown(false);
        setCampaignSearch('');
    };

    const saveCampaign = async () => {
        const title = String(campaignForm.title || '').trim();
        if (!title) return toast.error('Campaign title is required');

        if (isMockMode) {
            toast('Mockup mode: campaign save is disabled for now.');
            return;
        }

        setSaving(true);
        try {
            if (campaignMode === 'create') {
                const { data } = await api.post('/messages/campaigns', {
                    title,
                });

                const createdCampaign = data?.campaign;
                if (!createdCampaign?.id) {
                    throw new Error('Campaign creation failed');
                }

                toast.success('Campaign created');
                setCampaignMode('edit');
                setSelectedCampaignId(createdCampaign.id);
                setShowCampaignDropdown(false);
                setCampaignSearch('');
                await loadWorkspace();
            } else if (selectedCampaignId) {
                await api.patch(`/messages/campaigns/${selectedCampaignId}`, {
                    title,
                });
                toast.success('Campaign updated');
                await loadWorkspace();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Failed to save campaign');
        } finally {
            setSaving(false);
        }
    };

    const createItem = async (e) => {
        e.preventDefault();
        if (!selectedCampaignId) return toast.error('Create or select a campaign first');

        if (isMockMode) {
            toast('Mockup mode: adding timeline messages is disabled for now.');
            return;
        }

        const scheduledAtIso = toIsoOrNull(createForm.scheduled_at);
        if (!createForm.message_body.trim()) return toast.error('Message body is required');
        if (!scheduledAtIso) return toast.error('Valid schedule date is required');
        if (!createForm.group_ids.length) return toast.error('Select at least one group');

        setSaving(true);
        try {
            await api.post(`/messages/campaigns/${selectedCampaignId}/items`, {
                title: createForm.title || null,
                message_body: createForm.message_body,
                scheduled_at: scheduledAtIso,
                group_ids: createForm.group_ids,
                message_type: createForm.message_type,
                channel: createForm.channel,
            });
            toast.success('Scheduled message created');
            setCreateForm({ title: '', message_body: '', scheduled_at: '', group_ids: [], channel: 'generic', message_type: 'plain' });
            setShowCreateMessage(false);
            await loadCampaignItems(selectedCampaignId);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create schedule item');
        } finally {
            setSaving(false);
        }
    };

    const selectedItem = useMemo(
        () => items.find((item) => item.id === selectedItemId) || null,
        [items, selectedItemId]
    );

    const timelineStats = useMemo(() => {
        return items.reduce((acc, item) => {
            acc.total += 1;
            acc.sent += Number(item.sent_messages || 0);
            acc.failed += Number(item.failed_messages || 0);
            acc.queued += Number(item.queued_messages || 0);
            return acc;
        }, { total: 0, sent: 0, failed: 0, queued: 0 });
    }, [items]);

    if (loading) {
        return <div className="loading-center"><span className="spinner spinner-lg" /></div>;
    }

    return (
        <div className="campaign-page-wrapper">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => navigate('/app/analytics')}
                            style={{ paddingLeft: 0, color: 'var(--clr-text-2)', marginBottom: 8 }}
                        >
                            <ArrowLeft size={16} style={{ marginRight: 6 }} /> Back to Workflow
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
                                {campaign?.title || (campaignMode === 'create' ? 'New Campaign' : 'Campaigns')}
                            </h1>
                            {isMockMode && (
                                <span style={{ 
                                    fontSize: 10, 
                                    fontWeight: 700, 
                                    background: 'var(--clr-amber)', 
                                    color: 'white', 
                                    padding: '2px 6px', 
                                    borderRadius: 4, 
                                    textTransform: 'uppercase' 
                                }}>
                                    Design Mode
                                </span>
                            )}
                        </div>
                        <p style={{ color: 'var(--clr-text-2)', marginTop: 4, fontSize: 14 }}>
                            Orchestrate multi-channel messaging flows for your audience.
                        </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 10 }}>
                        {campaignMode === 'edit' && (
                            <button 
                                className="btn btn-secondary" 
                                onClick={startNewCampaign}
                            >
                                <PlusCircle size={16} style={{ marginRight: 6 }} /> New Campaign
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Layout Grid */}
            <div className="campaign-layout">
                
                {/* ── LEFT COLUMN: CAMPAIGN SETTINGS ── */}
                <div className="campaign-sidebar scroll-y">
                    
                    {/* Settings Panel */}
                    <div className="panel-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <LayoutTemplate size={18} style={{ color: 'var(--clr-accent)' }} /> 
                                Campaign Settings
                            </h3>
                            {/* Campaign Switcher */}
                            {campaigns.length > 0 && (
                                <div style={{ position: 'relative' }} ref={campaignDropdownRef}>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setShowCampaignDropdown(!showCampaignDropdown)}
                                        disabled={campaignMode === 'create'}
                                        style={{ color: 'var(--clr-text-2)' }}
                                    >
                                        Switch <ChevronDown size={14} style={{ marginLeft: 4 }} />
                                    </button>
                                    
                                    {showCampaignDropdown && (
                                        <div style={{
                                            position: 'absolute', top: '100%', right: 0, width: 260,
                                            background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
                                            borderRadius: 12, boxShadow: 'var(--shadow-lg)', zIndex: 50, padding: 8
                                        }}>
                                            <input
                                                className="form-input"
                                                style={{ fontSize: 13, height: 36, marginBottom: 8 }}
                                                value={campaignSearch}
                                                onChange={(e) => setCampaignSearch(e.target.value)}
                                                placeholder="Find campaign..."
                                                autoFocus
                                            />
                                            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                                {filteredCampaigns.map(c => (
                                                    <button 
                                                        key={c.id} 
                                                        className="btn btn-ghost btn-sm" 
                                                        style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
                                                        onClick={() => selectCampaign(c.id)}
                                                    >
                                                        {c.title}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="floating-input-group">
                            <label>Campaign Title</label>
                            <input
                                className="form-input"
                                value={campaignForm.title}
                                onChange={(e) => setCampaignForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g. Black Friday Sale"
                            />
                        </div>

                        <div className="floating-input-group">
                            <label>Description</label>
                            <textarea
                                className="form-textarea"
                                style={{ minHeight: 80, resize: 'none' }}
                                value={campaignForm.description}
                                onChange={(e) => setCampaignForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Internal notes about this campaign strategy..."
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="floating-input-group">
                                <label>Start Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={campaignForm.start_date}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, start_date: e.target.value }))}
                                />
                            </div>
                            <div className="floating-input-group">
                                <label>End Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={campaignForm.end_date}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, end_date: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="floating-input-group">
                            <label>Target Audience Reach</label>
                            <div style={{ position: 'relative' }}>
                                <Users size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--clr-text-3)' }} />
                                <input
                                    className="form-input"
                                    style={{ paddingLeft: 36 }}
                                    value={campaignForm.target_reach}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, target_reach: e.target.value }))}
                                    placeholder="Est. number of users"
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--clr-border)' }}>
                            <button 
                                className="btn btn-primary" 
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={saveCampaign}
                                disabled={saving}
                            >
                                {saving ? <span className="spinner" /> : <Save size={16} style={{ marginRight: 8 }} />}
                                {campaignMode === 'create' ? 'Create Campaign' : 'Save Changes'}
                            </button>
                        </div>
                    </div>

                    {/* Selected Message Preview Panel */}
                    {selectedItem && (
                         <div className="panel-card" style={{ borderLeft: '4px solid var(--clr-accent)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--clr-text-2)' }}>Selected Message</h4>
                                <StatusBadge status={selectedItem.status} />
                            </div>
                            
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Subject</div>
                                <div style={{ fontWeight: 500 }}>{selectedItem.title || 'Untitled Message'}</div>
                            </div>
                            
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Content</div>
                                <div style={{ background: 'var(--clr-surface-2)', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--clr-text-2)' }}>
                                    {selectedItem.message_body}
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--clr-text-3)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock3 size={12} /> {new Date(selectedItem.scheduled_at).toLocaleDateString()}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {selectedItem.channel === 'whatsapp' ? <MessageCircle size={12} /> : <Smartphone size={12} />}
                                    {selectedItem.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                                </span>
                            </div>
                         </div>
                    )}
                </div>


                {/* ── RIGHT COLUMN: TIMELINE DASHBOARD ── */}
                <div className="timeline-container scroll-y">
                    
                    {/* Top Stats */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-label">Total Messages</div>
                            <div className="stat-value">{timelineStats.total}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Queued</div>
                            <div className="stat-value" style={{ color: 'var(--clr-amber)' }}>{timelineStats.queued}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Sent Successfully</div>
                            <div className="stat-value" style={{ color: 'var(--clr-green)' }}>{timelineStats.sent}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Failed</div>
                            <div className="stat-value" style={{ color: 'var(--clr-red)' }}>{timelineStats.failed}</div>
                        </div>
                    </div>

                    {/* Timeline Flow */}
                    <div className="panel-card" style={{ minHeight: 400 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--clr-border)' }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <BarChart3 size={20} style={{ color: 'var(--clr-accent)' }} /> 
                                Campaign Timeline
                            </h3>
                            <div style={{ fontSize: 13, color: 'var(--clr-text-3)' }}>
                                {items.length} touchpoints defined
                            </div>
                        </div>

                        <div className="timeline-track">
                            {/* Empty State */}
                            {items.length === 0 && campaignMode === 'edit' && !showCreateMessage && (
                                <div style={{ 
                                    textAlign: 'center', padding: '40px 0', 
                                    background: 'var(--clr-surface-2)', borderRadius: 12, border: '1px dashed var(--clr-border-2)' 
                                }}>
                                    <CalendarPlus size={32} style={{ color: 'var(--clr-text-3)', marginBottom: 12 }} />
                                    <div style={{ fontWeight: 600, color: 'var(--clr-text-2)' }}>No timeline events yet</div>
                                    <div style={{ fontSize: 13, color: 'var(--clr-text-3)', marginBottom: 16 }}>Start by adding your first scheduled message.</div>
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowCreateMessage(true)}>
                                        Add First Message
                                    </button>
                                </div>
                            )}

                            {/* Timeline Items */}
                            {items.map((item, index) => {
                                const isActive = selectedItemId === item.id;
                                const isWhatsApp = item.channel === 'whatsapp';
                                return (
                                    <div key={item.id} className="timeline-node">
                                        <div className={`timeline-marker ${isActive ? 'active' : ''}`}>
                                            {index + 1}
                                        </div>
                                        <div 
                                            className={`timeline-card ${isActive ? 'active' : ''}`}
                                            onClick={() => setSelectedItemId(item.id)}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                                                        {item.title || `Message #${index + 1}`}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <span style={{ 
                                                            fontSize: 12, padding: '2px 8px', borderRadius: 4, 
                                                            background: isWhatsApp ? '#dcfce7' : '#e0e7ff',
                                                            color: isWhatsApp ? '#166534' : '#3730a3',
                                                            fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4
                                                        }}>
                                                            {isWhatsApp ? <MessageCircle size={10} /> : <Smartphone size={10} />}
                                                            {isWhatsApp ? 'WhatsApp' : 'SMS'}
                                                        </span>
                                                        <span style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>
                                                            {new Date(item.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <StatusBadge status={item.status} />
                                            </div>
                                            
                                            <div className="timeline-details-row">
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%', opacity: 0.8 }}>
                                                    {item.message_body}
                                                </div>
                                                <div style={{ display: 'flex', gap: 12 }}>
                                                    <span title="Audience Size" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Users size={12} /> {item.group_ids?.length || 1} Groups
                                                    </span>
                                                    <span title="Sent Count" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Send size={12} /> {item.sent_messages || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Add New Step Form or Button */}
                        {showCreateMessage ? (
                             <div className="timeline-node" style={{ marginBottom: 0 }}>
                                <div className="timeline-marker active" style={{ background: 'var(--clr-accent)', borderColor: 'var(--clr-accent)', color: 'white' }}>
                                    <PlusCircle size={14} />
                                </div>
                                <form 
                                    className="timeline-card active" 
                                    style={{ border: '2px solid var(--clr-accent)', background: 'var(--clr-surface-2)' }}
                                    onSubmit={createItem}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h4 style={{ fontSize: 15, fontWeight: 700 }}>Drafting New Message</h4>
                                        <button 
                                            type="button" 
                                            className="btn btn-ghost btn-sm" 
                                            onClick={() => setShowCreateMessage(false)}
                                            style={{ height: 24, padding: '0 8px' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                        <div className="floating-input-group">
                                            <label>Message Title (Internal)</label>
                                            <input
                                                className="form-input"
                                                value={createForm.title}
                                                onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                                                placeholder="e.g. Welcome Series - Day 1"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="floating-input-group">
                                            <label>Schedule Time *</label>
                                            <input
                                                type="datetime-local"
                                                className="form-input"
                                                value={createForm.scheduled_at}
                                                onChange={(e) => setCreateForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 16 }}>
                                        <label className="form-label" style={{ fontSize: 12, marginBottom: 8 }}>Channel Selection</label>
                                        <div className="channel-selector" style={{ display: 'flex', gap: 12 }}>
                                            <button
                                                type="button"
                                                onClick={() => setCreateForm(prev => ({ ...prev, channel: 'generic' }))}
                                                style={{ 
                                                    flex: 1, padding: '10px', borderRadius: 8, border: '1px solid',
                                                    borderColor: createForm.channel !== 'whatsapp' ? 'var(--clr-accent)' : 'var(--clr-border)',
                                                    background: createForm.channel !== 'whatsapp' ? 'var(--clr-accent-dim)' : 'var(--clr-surface)',
                                                    color: createForm.channel !== 'whatsapp' ? 'var(--clr-accent)' : 'var(--clr-text-2)',
                                                    fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                                }}
                                            >
                                                <Smartphone size={16} /> SMS
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCreateForm(prev => ({ ...prev, channel: 'whatsapp' }))}
                                                style={{ 
                                                    flex: 1, padding: '10px', borderRadius: 8, border: '1px solid',
                                                    borderColor: createForm.channel === 'whatsapp' ? 'var(--clr-accent)' : 'var(--clr-border)',
                                                    background: createForm.channel === 'whatsapp' ? 'var(--clr-accent-dim)' : 'var(--clr-surface)',
                                                    color: createForm.channel === 'whatsapp' ? 'var(--clr-accent)' : 'var(--clr-text-2)',
                                                    fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                                }}
                                            >
                                                <MessageCircle size={16} /> WhatsApp
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 16 }}>
                                        <label className="form-label" style={{ fontSize: 12, marginBottom: 8 }}>Target Groups *</label>
                                        <div style={{ 
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, 
                                            maxHeight: 120, overflowY: 'auto', padding: 10, 
                                            border: '1px solid var(--clr-border)', borderRadius: 8, background: 'var(--clr-surface)' 
                                        }}>
                                            {groups.map(g => (
                                                <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={createForm.group_ids.includes(g.id)}
                                                        onChange={() => toggleGroup(g.id)}
                                                        style={{ accentColor: 'var(--clr-accent)' }}
                                                    />
                                                    {g.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 20 }}>
                                        <label className="form-label" style={{ fontSize: 12, marginBottom: 8 }}>Message Body *</label>
                                        <textarea
                                            className="form-textarea"
                                            value={createForm.message_body}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, message_body: e.target.value }))}
                                            placeholder="Hello {{first_name}}, ensure to bring your ID..."
                                            required
                                            style={{ minHeight: 100 }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                        <button type="submit" className="btn btn-primary" disabled={saving}>
                                            {saving ? 'Saving...' : 'Add to Schedule'} <CalendarPlus size={16} style={{ marginLeft: 6 }} />
                                        </button>
                                    </div>
                                </form>
                             </div>
                        ) : (
                            campaignMode === 'edit' && (
                                <button className="btn-add-step" onClick={() => setShowCreateMessage(true)}>
                                    <PlusCircle size={18} /> Add Timeline Step
                                </button>
                            )
                        )}
                        
                    </div>
                </div>
            </div>
        </div>
    );
}

