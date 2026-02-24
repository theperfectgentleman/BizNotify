import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import PropTypes from 'prop-types';
import { 
    ArrowLeft, CalendarPlus, Edit3, Save, Clock3, MessageSquare, 
    Users, ChevronRight, ChevronDown, PlusCircle, LayoutTemplate, 
    Send, Smartphone, MessageCircle, BarChart3, AlertCircle, CheckCircle2, Copy, X
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
    const [showCampaignForm, setShowCampaignForm] = useState(false); // Default to collapsed
    const [campaignSearch, setCampaignSearch] = useState('');
    const campaignDropdownRef = useRef(null);
    const campaignCardRef = useRef(null);
    const audienceInputRef = useRef(null);

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
        adhoc_numbers: [],
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
            if (campaignDropdownRef.current && !campaignDropdownRef.current.contains(event.target)) {
                setShowCampaignDropdown(false);
            }
            if (
                showCampaignForm
                && campaignCardRef.current
                && !campaignCardRef.current.contains(event.target)
            ) {
                setShowCampaignForm(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCampaignForm]);

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
            setCreateForm({ 
                title: '', 
                message_body: '', 
                scheduled_at: '', 
                group_ids: [], 
                adhoc_numbers: [], // New field for comma-separated numbers
                channel: 'generic', 
                message_type: 'plain' 
            });
            setShowCreateMessage(false);
            await loadCampaignItems(selectedCampaignId);
        } catch (err) {            toast.error(err.response?.data?.error || 'Failed to create schedule item');
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
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

                    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                        <div className="stat-card" style={{ minWidth: 96, padding: '10px 12px' }}>
                            <div className="stat-label" style={{ fontSize: 11 }}>Total</div>
                            <div className="stat-value" style={{ fontSize: 20 }}>{timelineStats.total}</div>
                        </div>
                        <div className="stat-card" style={{ minWidth: 96, padding: '10px 12px' }}>
                            <div className="stat-label" style={{ fontSize: 11 }}>Queued</div>
                            <div className="stat-value" style={{ fontSize: 20, color: 'var(--clr-amber)' }}>{timelineStats.queued}</div>
                        </div>
                        <div className="stat-card" style={{ minWidth: 96, padding: '10px 12px' }}>
                            <div className="stat-label" style={{ fontSize: 11 }}>Sent</div>
                            <div className="stat-value" style={{ fontSize: 20, color: 'var(--clr-green)' }}>{timelineStats.sent}</div>
                        </div>
                        <div className="stat-card" style={{ minWidth: 96, padding: '10px 12px' }}>
                            <div className="stat-label" style={{ fontSize: 11 }}>Failed</div>
                            <div className="stat-value" style={{ fontSize: 20, color: 'var(--clr-red)' }}>{timelineStats.failed}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Layout Grid */}
            <div className="campaign-layout">
                
                {/* ── LEFT COLUMN: WORKSPACE (Campaign + Message Editor) ── */}
                <div className="campaign-sidebar" style={{ position: 'relative' }}>
                    
                    {/* Campaign Card - Collapsible & Floating */}
                    <div 
                        ref={campaignCardRef}
                        className="panel-card"
                        style={{ 
                            marginBottom: 20, 
                            cursor: !showCampaignForm ? 'pointer' : 'default',
                            position: showCampaignForm ? 'absolute' : 'relative',
                            top: 0, left: 0, right: 0,
                            zIndex: 20,
                            boxShadow: showCampaignForm ? '0 10px 40px -10px rgba(0,0,0,0.2)' : 'var(--shadow-card)',
                            border: showCampaignForm ? '1px solid var(--clr-accent-glow)' : '1px solid var(--clr-border)',
                            transition: 'all 0.2s ease-in-out'
                        }}
                        onClick={(e) => {
                            // Don't expand if clicking buttons/inputs
                            if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
                            if (!showCampaignForm) setShowCampaignForm(true);
                        }}
                    >
                        {/* Header Section */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: showCampaignForm ? 16 : 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ 
                                    width: 32, height: 32, borderRadius: 8, 
                                    background: 'var(--clr-accent-dim)', color: 'var(--clr-accent)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <LayoutTemplate size={18} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                                        {campaignForm.title || 'Untitled Campaign'}
                                    </h3>
                                    {!showCampaignForm && (
                                        <div style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>
                                            {campaignForm.start_date ? new Date(campaignForm.start_date).toLocaleDateString() : 'No date'} • {campaignForm.target_reach || '0'} users
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 4 }}>
                                {showCampaignForm ? (
                                    <button 
                                        className="btn btn-ghost btn-sm"
                                        onClick={(e) => { e.stopPropagation(); setShowCampaignForm(false); }}
                                    >
                                        <ChevronDown size={16} style={{ transform: 'rotate(180deg)' }} />
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        {campaignMode === 'edit' && (
                                            <>
                                                 <button 
                                                    className="btn btn-ghost btn-sm" 
                                                    onClick={(e) => { e.stopPropagation(); startNewCampaign(); setShowCampaignForm(true); }}
                                                    title="Create New Campaign"
                                                    style={{ padding: 6, height: 28, width: 28, justifyContent: 'center', color: 'var(--clr-text-2)' }}
                                                >
                                                    <PlusCircle size={16} />
                                                </button>
                                                
                                                {/* Switcher in collapsed view */}
                                                {campaigns.length > 0 && (
                                                    <div style={{ position: 'relative' }} ref={campaignDropdownRef} onClick={e => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => setShowCampaignDropdown(!showCampaignDropdown)}
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
                                                                            onClick={() => { selectCampaign(c.id); setShowCampaignDropdown(false); }}
                                                                        >
                                                                            {c.title}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--clr-text-3)' }}>
                                            <Edit3 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Collapsed Description Preview */}
                        {!showCampaignForm && campaignForm.description && (
                            <div style={{ fontSize: 13, color: 'var(--clr-text-2)', lineHeight: 1.5, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {campaignForm.description}
                            </div>
                        )}

                        {/* Expanded Form */}
                        {showCampaignForm && (
                            <div className="campaign-form-expanded animate-fade-in">
                                <div className="floating-input-group">
                                    <label>Campaign Title</label>
                                    <input
                                        className="form-input"
                                        value={campaignForm.title}
                                        onChange={(e) => setCampaignForm(prev => ({ ...prev, title: e.target.value }))}
                                        placeholder="e.g. Black Friday Sale"
                                        autoFocus
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

                                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--clr-border)', display: 'flex', gap: 10 }}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={(e) => { saveCampaign(); setShowCampaignForm(false); }}
                                        disabled={saving}
                                    >
                                        {saving ? <span className="spinner" /> : <Save size={16} style={{ marginRight: 8 }} />}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                
                    {/* Message Editor / Preview Card */}
                    <div className="panel-card" style={{ height: 'calc(100% - 100px)', display: 'flex', flexDirection: 'column' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--clr-border)', paddingBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ 
                                    width: 32, height: 32, borderRadius: 8, 
                                    background: 'var(--clr-surface-2)', color: 'var(--clr-text-2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                }}>
                                    <MessageSquare size={18} />
                                </div>
                                <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                                    {showCreateMessage ? 'Drafting Message' : (selectedItem ? 'Message Details' : 'Message Workspace')}
                                </h3>
                            </div>
                            
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {!showCreateMessage && (
                                                    <button 
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => {
                                                            setSelectedItemId(null);
                                                            setCreateForm({
                                                                title: '',
                                                                scheduled_at: '',
                                                                message_body: '',
                                                                channel: 'sms',
                                                                group_ids: [],
                                                                adhoc_numbers: []
                                                            });
                                                            setShowCreateMessage(true);
                                                        }}
                                                        title="Draft New Message"
                                                    >
                                                        <PlusCircle size={16} style={{ marginRight: 6 }} /> New Message
                                                    </button>
                                                )}
                                                {selectedItem && !showCreateMessage && (
                                                    <StatusBadge status={selectedItem.status} />
                                                )}
                                            </div>
                        </div>

                        {/* CONTENT AREA: Either Form or Read-only View */}
                        <div style={{ flex: 1 }}>
                            {showCreateMessage ? (
                                <form onSubmit={createItem}>
                                    <div style={{ marginBottom: 20 }}>
                                        <label className="form-label" style={{ fontSize: 12, marginBottom: 8 }}>Channel</label>
                                        <div className="channel-selector" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <button
                                                type="button"
                                                onClick={() => setCreateForm(prev => ({ ...prev, channel: 'generic' }))}
                                                style={{ 
                                                    padding: '12px', borderRadius: 8, border: '1px solid',
                                                    borderColor: createForm.channel !== 'whatsapp' ? 'var(--clr-accent)' : 'var(--clr-border)',
                                                    background: createForm.channel !== 'whatsapp' ? 'var(--clr-accent-dim)' : 'var(--clr-surface)',
                                                    color: createForm.channel !== 'whatsapp' ? 'var(--clr-accent)' : 'var(--clr-text-2)',
                                                    fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Smartphone size={18} /> SMS
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCreateForm(prev => ({ ...prev, channel: 'whatsapp' }))}
                                                style={{ 
                                                    padding: '12px', borderRadius: 8, border: '1px solid',
                                                    borderColor: createForm.channel === 'whatsapp' ? 'var(--clr-accent)' : 'var(--clr-border)',
                                                    background: createForm.channel === 'whatsapp' ? 'var(--clr-accent-dim)' : 'var(--clr-surface)',
                                                    color: createForm.channel === 'whatsapp' ? 'var(--clr-accent)' : 'var(--clr-text-2)',
                                                    fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <MessageCircle size={18} /> WhatsApp
                                            </button>
                                        </div>
                                    </div>

                                    <div className="floating-input-group">
                                        <label>Internal Title</label>
                                        <input
                                            className="form-input"
                                            value={createForm.title}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="e.g. Day 1 Reminder"
                                        />
                                    </div>

                                    <div className="floating-input-group">
                                        <label>Schedule Delivery</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={createForm.scheduled_at}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div style={{ marginBottom: 20 }}>
                                        
                                        {/* Multi-select Dropdown & Input */}
                                        <div style={{ 
                                            background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', 
                                            borderRadius: 8, padding: 8 
                                        }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                                {createForm.group_ids.map(gid => {
                                                    const grp = groups.find(g => g.id === gid);
                                                    return (
                                                        <span key={gid} style={{ 
                                                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', 
                                                            borderRadius: 12, background: 'var(--clr-accent-dim)', color: 'var(--clr-accent)',
                                                            fontSize: 12, fontWeight: 500
                                                        }}>
                                                            {grp?.name || 'Unknown Group'}
                                                            <button 
                                                                type="button"
                                                                onClick={() => toggleGroup(gid)}
                                                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--clr-accent)' }}
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                                {(createForm.adhoc_numbers || []).map((num, idx) => (
                                                    <span key={`adhoc-${idx}`} style={{ 
                                                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', 
                                                        borderRadius: 12, background: 'var(--clr-surface-2)', color: 'var(--clr-text)',
                                                        fontSize: 12, fontWeight: 500
                                                    }}>
                                                        {num}
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                const newNums = [...createForm.adhoc_numbers];
                                                                newNums.splice(idx, 1);
                                                                setCreateForm(prev => ({ ...prev, adhoc_numbers: newNums }));
                                                            }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--clr-text-3)' }}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <select
                                                        className="form-input"
                                                        style={{ fontSize: 13, height: 36 }}
                                                        onChange={(e) => {
                                                            if(e.target.value) {
                                                                toggleGroup(parseInt(e.target.value));
                                                                e.target.value = ""; // Reset
                                                            }
                                                        }}
                                                    >
                                                        <option value="">Select Group...</option>
                                                        {groups.filter(g => !createForm.group_ids.includes(g.id)).map(g => (
                                                            <option key={g.id} value={g.id}>{g.name} ({g.contact_count || 0} contacts)</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div style={{ width: 1, height: 24, background: 'var(--clr-border)' }}></div>
                                                <input
                                                    ref={audienceInputRef}
                                                    type="text"
                                                    placeholder="Paste/Type numbers..."
                                                    style={{ border: 'none', outline: 'none', fontSize: 13, flex: 1, background: 'transparent' }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ',') {
                                                            e.preventDefault();
                                                            const val = e.target.value.trim().replace(/,/g, '');
                                                            if (val) {
                                                                setCreateForm(prev => ({
                                                                    ...prev,
                                                                    adhoc_numbers: [...(prev.adhoc_numbers || []), val]
                                                                }));
                                                                e.target.value = '';
                                                            }
                                                        }
                                                    }}
                                                    onPaste={(e) => {
                                                        e.preventDefault();
                                                        const paste = e.clipboardData.getData('text');
                                                        const numbers = paste.split(/[,\n]/).map(n => n.trim()).filter(n => n);
                                                        if (numbers.length > 0) {
                                                            setCreateForm(prev => ({
                                                                ...prev,
                                                                adhoc_numbers: [...(prev.adhoc_numbers || []), ...numbers]
                                                            }));
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        const val = e.target.value.trim().replace(/,/g, '');
                                                        if (val) {
                                                            setCreateForm(prev => ({
                                                                ...prev,
                                                                adhoc_numbers: [...(prev.adhoc_numbers || []), val]
                                                            }));
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 20 }}>
                                        <label className="form-label" style={{ fontSize: 12, marginBottom: 8 }}>Content</label>
                                        <textarea
                                            className="form-textarea"
                                            value={createForm.message_body}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, message_body: e.target.value }))}
                                            placeholder="Message content..."
                                            required
                                            style={{ minHeight: 140, fontSize: 14 }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                                        <button 
                                            type="button" 
                                            className="btn btn-ghost" 
                                            style={{ flex: 1 }}
                                            onClick={() => setShowCreateMessage(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={saving}>
                                            {saving ? 'Saving...' : 'Schedule Message'} <CalendarPlus size={16} style={{ marginLeft: 6 }} />
                                        </button>
                                    </div>
                                </form>
                            ) : selectedItem ? (
                                <div className="animate-fade-in">
                                     <div style={{ marginBottom: 24 }}>
                                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', textTransform: 'uppercase', marginBottom: 6 }}>Overview</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedItem.title || 'Untitled'}</div>
                                        <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--clr-text-2)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Clock3 size={14} /> {new Date(selectedItem.scheduled_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '0.75fr 1.25fr', gap: 16, marginBottom: 24 }}>
                                        <div style={{ padding: 12, background: 'var(--clr-surface-2)', borderRadius: 10 }}>
                                            <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 4 }}>Channel</div>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '4px 10px',
                                                borderRadius: 999,
                                                fontSize: 12,
                                                fontWeight: 700,
                                                background: selectedItem.channel === 'whatsapp' ? 'var(--clr-accent-dim)' : 'var(--clr-surface-3)',
                                                color: selectedItem.channel === 'whatsapp' ? 'var(--clr-accent)' : 'var(--clr-text)'
                                            }}>
                                                {selectedItem.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                                            </span>
                                        </div>
                                        <div style={{ padding: 12, background: 'var(--clr-surface-2)', borderRadius: 10 }}>
                                            <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginBottom: 4 }}>Audience</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                                 <Users size={16} /> {selectedItem.group_ids?.length || 1} Groups
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Message Body</div>
                                        <div style={{ 
                                            background: 'var(--clr-surface-3)', padding: 16, borderRadius: 12, 
                                            fontSize: 14, lineHeight: 1.6, color: 'var(--clr-text)',
                                            whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: 96
                                        }}>
                                            {selectedItem.message_body}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--clr-border)' }}>
                                        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} disabled>
                                            <Edit3 size={16} style={{ marginRight: 8 }} /> Edit
                                        </button>
                                        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--clr-text-3)', marginTop: 8 }}>
                                            Adjustments disabled for {selectedItem.status} messages.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--clr-text-3)', textAlign: 'center', padding: 20 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--clr-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                        <LayoutTemplate size={24} />
                                    </div>
                                    <p style={{ maxWidth: 200 }}>Select a message from the timeline to view details, or draft a new one.</p>
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowCreateMessage(true)} style={{ marginTop: 16 }}>
                                        Draft New Message
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>


                {/* ── RIGHT COLUMN: TIMELINE DASHBOARD ── */}
                <div className="timeline-container">
                    
                    {/* Timeline Flow */}
                    <div className="panel-card" style={{ minHeight: 400 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--clr-border)' }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <BarChart3 size={20} style={{ color: 'var(--clr-accent)' }} /> 
                                Campaign Timeline
                            </h3>
                            <div style={{ fontSize: 13, color: 'var(--clr-text-3)' }}>
                                {items.length} touchpoints
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
                                            onClick={() => {
                                                setSelectedItemId(item.id);
                                                setShowCreateMessage(false);
                                            }}
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
                                                
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <StatusBadge status={item.status} />
                                                    <button 
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ padding: 4, height: 24, width: 24, color: 'var(--clr-text-3)' }}
                                                        title="Duplicate Message"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCreateForm({
                                                                title: item.title + ' (Copy)',
                                                                scheduled_at: '', 
                                                                message_body: item.message_body,
                                                                channel: item.channel,
                                                                group_ids: item.group_ids || [],
                                                                adhoc_numbers: []
                                                            });
                                                            setSelectedItemId(null);
                                                            setShowCreateMessage(true);
                                                        }}
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                </div>
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
                    </div>
                </div>
            </div>
        </div>
    );
}

