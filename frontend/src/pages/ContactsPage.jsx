import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Search, Upload, Trash2, Tag, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

function downloadCsvTemplate() {
    const headers = 'phone_number,first_name,last_name';
    const example = '+2348012345678,John,Doe';
    const csv = [headers, example].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function StatusDot({ optOut }) {
    return (
        <span style={{
            width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
            background: optOut ? 'var(--clr-red)' : 'var(--clr-green)',
            marginRight: 6
        }} />
    );
}

function AddContactModal({ onClose, onSaved, groups }) {
    const [form, setForm] = useState({ phone_number: '', first_name: '', last_name: '', group_ids: [] });
    const [loading, setLoading] = useState(false);

    const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const toggleGroup = (id) => {
        setForm(f => ({
            ...f,
            group_ids: f.group_ids.includes(id)
                ? f.group_ids.filter(g => g !== id)
                : [...f.group_ids, id]
        }));
    };

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/contacts', form);
            toast.success('Contact added');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add contact');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <div className="modal-title">Add Contact</div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Phone Number *</label>
                            <input className="form-input" name="phone_number" placeholder="08012345678" value={form.phone_number} onChange={handle} required />
                            <div className="form-hint">Numbers are auto-normalized to E.164 format</div>
                        </div>
                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input className="form-input" name="first_name" placeholder="John" value={form.first_name} onChange={handle} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input className="form-input" name="last_name" placeholder="Doe" value={form.last_name} onChange={handle} />
                            </div>
                        </div>
                        {groups.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Add to Groups</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {groups.map(g => (
                                        <button
                                            key={g.id} type="button"
                                            onClick={() => toggleGroup(g.id)}
                                            className={`btn btn-sm ${form.group_ids.includes(g.id) ? 'btn-primary' : 'btn-secondary'}`}
                                        >
                                            {g.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                            Add Contact
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Stage badge helper ───────────────────────────────────────────────────────
function StageDots({ stage }) {
    return (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 4 }}>
            {[1, 2, 3].map(n => (
                <div key={n} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: n <= stage ? 'var(--clr-accent)' : 'var(--clr-surface-3)',
                    transition: 'background 0.2s',
                }} />
            ))}
        </div>
    );
}

function ImportModal({ onClose, onSaved, groups }) {
    // stage: 1 = pick file, 2 = prescan preview, 3 = import result
    const [stage, setStage] = useState(1);
    const [file, setFile] = useState(null);
    const [groupId, setGroupId] = useState('');
    const [scanning, setScanning] = useState(false);
    const [scan, setScan] = useState(null);    // prescan result
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);   // import result
    const fileRef = useRef();

    // Auto-prescan whenever a file is chosen
    const handleFileChange = async (e) => {
        const chosen = e.target.files[0];
        if (!chosen) return;
        setFile(chosen);
        setScan(null);
        setScanning(true);
        setStage(2);
        const fd = new FormData();
        fd.append('file', chosen);
        try {
            const { data } = await api.post('/contacts/import/prescan', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setScan(data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Pre-scan failed');
            setStage(1);
            setFile(null);
        } finally {
            setScanning(false);
        }
    };

    const doImport = async () => {
        if (!file) return;
        setImporting(true);
        const fd = new FormData();
        fd.append('file', file);
        if (groupId) fd.append('group_id', groupId);
        try {
            const { data } = await api.post('/contacts/import', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(data);
            setStage(3);
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Import failed');
        } finally {
            setImporting(false);
        }
    };

    const reset = () => {
        setStage(1); setFile(null); setScan(null); setResult(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    const ColPill = ({ label, value }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--clr-text-3)' }}>{label}:</span>
            {value
                ? <span style={{ color: 'var(--clr-accent)', fontWeight: 600 }}>{value}</span>
                : <span style={{ color: 'var(--clr-text-3)', fontStyle: 'italic' }}>not found</span>}
        </div>
    );

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: 560, width: '100%' }}>
                <div className="modal-header">
                    <div>
                        <div className="modal-title">Bulk Import</div>
                        <StageDots stage={stage} />
                    </div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
                </div>

                {/* ── STAGE 1: File select ───────────────────────────────── */}
                {stage === 1 && (
                    <>
                        <div className="modal-body">
                            <div
                                className="dropzone"
                                onClick={() => fileRef.current.click()}
                            >
                                <div className="dropzone-icon">📄</div>
                                <div className="dropzone-text">Click to select a CSV file</div>
                                <div className="dropzone-hint">
                                    Any column naming works — phone, mobile, first name, surname, etc.
                                </div>
                                <input
                                    ref={fileRef} type="file" accept=".csv,.tsv,.txt" hidden
                                    onChange={handleFileChange}
                                />
                            </div>
                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                                <button
                                    type="button" className="btn btn-ghost btn-sm"
                                    onClick={downloadCsvTemplate}
                                    style={{ fontSize: 13, color: 'var(--clr-accent)' }}
                                >
                                    <Download size={13} /> Download CSV Template
                                </button>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        </div>
                    </>
                )}

                {/* ── STAGE 2: Prescan preview ───────────────────────────── */}
                {stage === 2 && (
                    <>
                        <div className="modal-body">
                            {scanning ? (
                                <div className="loading-center" style={{ padding: 32 }}>
                                    <span className="spinner" />
                                    <span style={{ marginLeft: 12, color: 'var(--clr-text-2)', fontSize: 14 }}>Scanning file…</span>
                                </div>
                            ) : scan && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {/* File info */}
                                    <div style={{ fontSize: 13, color: 'var(--clr-text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>📄</span>
                                        <strong style={{ color: 'var(--clr-text-1)' }}>{file.name}</strong>
                                        <span>·</span>
                                        <span>{scan.totalRows} row{scan.totalRows !== 1 ? 's' : ''}</span>
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div style={{ flex: 1, background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--clr-green)' }}>{scan.validCount}</div>
                                            <div style={{ fontSize: 11, color: 'var(--clr-text-2)', marginTop: 2 }}>Ready to import</div>
                                        </div>
                                        <div style={{ flex: 1, background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: scan.invalidCount > 0 ? 'var(--clr-amber)' : 'var(--clr-text-3)' }}>{scan.invalidCount}</div>
                                            <div style={{ fontSize: 11, color: 'var(--clr-text-2)', marginTop: 2 }}>Will be skipped</div>
                                        </div>
                                    </div>

                                    {/* Detected columns */}
                                    <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--clr-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                            Detected Column Mapping
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
                                            <ColPill label="Phone" value={scan.detectedCols?.phone} />
                                            <ColPill label="First Name" value={scan.detectedCols?.firstName} />
                                            <ColPill label="Last Name" value={scan.detectedCols?.lastName} />
                                        </div>
                                    </div>

                                    {/* Issues table */}
                                    {scan.issues?.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-amber)', marginBottom: 6 }}>
                                                ⚠ {scan.invalidCount} row{scan.invalidCount !== 1 ? 's' : ''} have issues
                                                {scan.invalidCount > scan.issues.length && ` (showing first ${scan.issues.length})`}
                                            </div>
                                            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)' }}>
                                                <table style={{ width: '100%', fontSize: 12 }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: 60 }}>Row</th>
                                                            <th>Issue</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {scan.issues.map((iss, i) => (
                                                            <tr key={i}>
                                                                <td style={{ color: 'var(--clr-text-3)' }}>#{iss.row}</td>
                                                                <td style={{ color: 'var(--clr-amber)' }}>{iss.reason}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {scan.validCount === 0 && (
                                        <div style={{ fontSize: 13, color: 'var(--clr-red)', textAlign: 'center', padding: '8px 0' }}>
                                            No valid rows found. Please fix the file and try again.
                                        </div>
                                    )}

                                    {/* Group select */}
                                    {scan.validCount > 0 && (
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Add to Group (optional)</label>
                                            <select className="form-select" value={groupId} onChange={e => setGroupId(e.target.value)}>
                                                <option value="">No group</option>
                                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={reset}>← Change File</button>
                            <button
                                className="btn btn-primary"
                                disabled={importing || !scan || scan.validCount === 0}
                                onClick={doImport}
                            >
                                {importing
                                    ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Importing…</>
                                    : <><Upload size={14} /> Import {scan?.validCount ?? ''} Contacts</>}
                            </button>
                        </div>
                    </>
                )}

                {/* ── STAGE 3: Import result ─────────────────────────────── */}
                {stage === 3 && result && (
                    <>
                        <div className="modal-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', padding: 20, display: 'flex', gap: 32, justifyContent: 'center' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--clr-green)' }}>{result.imported}</div>
                                        <div style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>Imported</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--clr-amber)' }}>{result.skipped}</div>
                                        <div style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>Skipped</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 32, fontWeight: 700 }}>{result.total}</div>
                                        <div style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>Total Rows</div>
                                    </div>
                                </div>

                                {result.errors?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-amber)', marginBottom: 6 }}>
                                            Skipped rows
                                        </div>
                                        <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)' }}>
                                            <table style={{ width: '100%', fontSize: 12 }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: 60 }}>Row</th>
                                                        <th>Reason</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.errors.map((e, i) => (
                                                        <tr key={i}>
                                                            <td style={{ color: 'var(--clr-text-3)' }}>#{e.row}</td>
                                                            <td style={{ color: 'var(--clr-amber)' }}>{e.reason}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={reset}>Import Another</button>
                            <button className="btn btn-primary" onClick={onClose}>Done</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function ContactsPage() {
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [groupFilter, setGroupFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [bulkGroupId, setBulkGroupId] = useState('');
    const PER_PAGE = 50;

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const params = { page, limit: PER_PAGE };
            if (search) params.search = search;
            if (groupFilter) params.group_id = groupFilter;
            const { data } = await api.get('/contacts', { params });
            setContacts(data.contacts);
            setTotal(data.total);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { api.get('/groups').then(r => setGroups(r.data)); }, []);
    useEffect(() => { fetchContacts(); }, [page, search, groupFilter]);

    const deleteContact = async (id) => {
        if (!confirm('Delete this contact?')) return;
        try {
            await api.delete(`/contacts/${id}`);
            toast.success('Deleted');
            fetchContacts();
        } catch {
            toast.error('Delete failed');
        }
    };

    const bulkTag = async () => {
        if (!bulkGroupId || !selected.length) return;
        try {
            await api.post('/contacts/bulk-tag', { contact_ids: selected, group_id: bulkGroupId });
            toast.success(`${selected.length} contact(s) tagged`);
            setSelected([]);
            setBulkGroupId('');
            fetchContacts();
        } catch {
            toast.error('Bulk tag failed');
        }
    };

    const toggleSelect = (id) => {
        setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    };

    const toggleAll = () => {
        setSelected(s => s.length === contacts.length ? [] : contacts.map(c => c.id));
    };

    const totalPages = Math.ceil(total / PER_PAGE);

    return (
        <>
            <div className="page-header">
                <div>
                    <div className="page-title">Contacts</div>
                    <div className="page-subtitle">{total.toLocaleString()} contacts total</div>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
                        <Upload size={15} /> Bulk Import
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                        <Plus size={15} /> Add Contact
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div className="search-bar">
                    <Search size={15} />
                    <input
                        className="form-input"
                        placeholder="Search contacts…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <select className="form-select" style={{ width: 200 }} value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setPage(1); }}>
                    <option value="">All Groups</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.contact_count})</option>)}
                </select>
            </div>

            {/* Bulk action bar */}
            {selected.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px', background: 'var(--clr-accent-dim)', border: '1px solid var(--clr-accent-glow)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: 14, color: 'var(--clr-accent)', fontWeight: 500 }}>{selected.length} selected</span>
                    <select className="form-select" style={{ width: 180 }} value={bulkGroupId} onChange={e => setBulkGroupId(e.target.value)}>
                        <option value="">Tag to group…</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button className="btn btn-primary btn-sm" disabled={!bulkGroupId} onClick={bulkTag}>
                        <Tag size={13} /> Apply
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Clear</button>
                </div>
            )}

            <div className="table-wrapper">
                {loading ? (
                    <div className="loading-center"><span className="spinner" /></div>
                ) : contacts.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">👤</div>
                        <div className="empty-title">No contacts found</div>
                        <div className="empty-desc">Add contacts manually or import a CSV file to get started.</div>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th><input type="checkbox" checked={selected.length === contacts.length} onChange={toggleAll} /></th>
                                <th>Phone</th>
                                <th>Name</th>
                                <th>Groups</th>
                                <th>Status</th>
                                <th>Added</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {contacts.map(c => (
                                <tr key={c.id}>
                                    <td><input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                                    <td className="font-mono">{c.phone_number}</td>
                                    <td>{[c.first_name, c.last_name].filter(Boolean).join(' ') || <span className="text-muted">—</span>}</td>
                                    <td>
                                        {c.groups?.length > 0
                                            ? c.groups.map(g => (
                                                <span key={g.id} style={{ display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--clr-surface-3)', color: 'var(--clr-text-2)', marginRight: 4 }}>{g.name}</span>
                                            ))
                                            : <span className="text-muted">—</span>
                                        }
                                    </td>
                                    <td>
                                        <StatusDot optOut={c.opt_out} />
                                        {c.opt_out ? <span className="text-red text-xs">Opted out</span> : <span className="text-green text-xs">Active</span>}
                                    </td>
                                    <td style={{ fontSize: 13 }}>{new Date(c.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button className="btn btn-icon btn-danger btn-sm" onClick={() => deleteContact(c.id)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                        <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                    ))}
                    <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                        <ChevronRight size={14} />
                    </button>
                </div>
            )}

            {showAdd && <AddContactModal onClose={() => setShowAdd(false)} onSaved={fetchContacts} groups={groups} />}
            {showImport && <ImportModal onClose={() => setShowImport(false)} onSaved={fetchContacts} groups={groups} />}
        </>
    );
}
