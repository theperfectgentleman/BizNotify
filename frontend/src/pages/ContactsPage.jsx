import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';
import { Plus, Search, Upload, Trash2, Tag, X, ChevronLeft, ChevronRight, ChevronDown, Download, Save, CheckCircle2, XCircle } from 'lucide-react';
import './ContactsPage.css';

function downloadCsvTemplate() {
    const headers = 'phone_number,first_name,last_name';
    const row1 = '+2348012345678,John,Doe';
    const row2 = '+2348098765432,Jane,Smith';
    const csv = [headers, row1, row2].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
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

StageDots.propTypes = {
    stage: PropTypes.number,
};

function GroupsMultiSelect({ groups, value, onChange, placeholder = 'Select groups' }) {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!wrapperRef.current) return;
            if (!wrapperRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const selectedNames = groups
        .filter((group) => value.includes(group.id))
        .map((group) => group.name);

    const displayText = selectedNames.length > 0
        ? selectedNames.join(', ')
        : placeholder;

    const toggleGroup = (groupId) => {
        if (value.includes(groupId)) {
            onChange(value.filter((id) => id !== groupId));
        } else {
            onChange([...value, groupId]);
        }
    };

    return (
        <div className="contacts-multiselect" ref={wrapperRef}>
            <button
                type="button"
                className="contacts-multiselect-trigger"
                onClick={() => setOpen((prev) => !prev)}
                title={selectedNames.join(', ')}
                aria-label="Select groups"
            >
                <span className="contacts-multiselect-text">{displayText}</span>
                <ChevronDown size={14} className="contacts-multiselect-chevron" />
            </button>

            {open && (
                <div className="contacts-multiselect-menu">
                    {groups.length === 0 ? (
                        <div className="contacts-multiselect-empty">No groups</div>
                    ) : (
                        groups.map((group) => (
                            <label key={group.id} className="contacts-multiselect-option">
                                <input
                                    type="checkbox"
                                    checked={value.includes(group.id)}
                                    onChange={() => toggleGroup(group.id)}
                                />
                                <span>{group.name}</span>
                            </label>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

GroupsMultiSelect.propTypes = {
    groups: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
    })),
    value: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
};

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
                                            {[
                                                { label: 'Phone', value: scan.detectedCols?.phone },
                                                { label: 'First Name', value: scan.detectedCols?.firstName },
                                                { label: 'Last Name', value: scan.detectedCols?.lastName },
                                            ].map((column) => (
                                                <div key={column.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                                    <span style={{ color: 'var(--clr-text-3)' }}>{column.label}:</span>
                                                    {column.value
                                                        ? <span style={{ color: 'var(--clr-accent)', fontWeight: 600 }}>{column.value}</span>
                                                        : <span style={{ color: 'var(--clr-text-3)', fontStyle: 'italic' }}>not found</span>}
                                                </div>
                                            ))}
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

ImportModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    onSaved: PropTypes.func.isRequired,
    groups: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        contact_count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })),
};

export default function ContactsPage() {
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [groupFilter, setGroupFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState([]);
    const [showImport, setShowImport] = useState(false);
    const [bulkGroupId, setBulkGroupId] = useState('');
    const [rowEdits, setRowEdits] = useState({});
    const [rowSaving, setRowSaving] = useState({});
    const [inlineForm, setInlineForm] = useState({
        phone_number: '',
        first_name: '',
        last_name: '',
        group_ids: [],
    });
    const [addingInline, setAddingInline] = useState(false);
    const inlinePhoneRef = useRef(null);
    const PER_PAGE = 50;

    const fetchContacts = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: PER_PAGE };
            if (search) params.search = search;
            if (groupFilter) params.group_id = groupFilter;
            const { data } = await api.get('/contacts', { params });
            setContacts(data.contacts);
            setTotal(data.total);

            setRowEdits((prev) => {
                const next = { ...prev };
                for (const contact of data.contacts) {
                    if (!next[contact.id]) {
                        next[contact.id] = {
                            phone_number: contact.phone_number || '',
                            first_name: contact.first_name || '',
                            last_name: contact.last_name || '',
                            group_ids: (contact.groups || []).map((group) => group.id),
                        };
                    }
                }
                return next;
            });
        } finally {
            setLoading(false);
        }
    }, [groupFilter, page, search]);

    useEffect(() => { api.get('/groups').then(r => setGroups(r.data)); }, []);
    useEffect(() => { fetchContacts(); }, [fetchContacts]);

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

    const updateRowField = (contactId, field, value) => {
        setRowEdits((prev) => ({
            ...prev,
            [contactId]: {
                ...prev[contactId],
                [field]: value,
            },
        }));
    };

    const saveRow = async (contactId) => {
        const row = rowEdits[contactId];
        if (!row) return;

        if (!String(row.phone_number || '').trim()) {
            return toast.error('Phone number is required');
        }

        setRowSaving((prev) => ({ ...prev, [contactId]: true }));
        try {
            await api.patch(`/contacts/${contactId}`, {
                phone_number: row.phone_number,
                first_name: row.first_name,
                last_name: row.last_name,
                group_ids: row.group_ids,
            });
            toast.success('Contact updated');
            await fetchContacts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Update failed');
        } finally {
            setRowSaving((prev) => ({ ...prev, [contactId]: false }));
        }
    };

    const addInlineContact = async () => {
        if (!String(inlineForm.phone_number || '').trim()) {
            return toast.error('Phone number is required');
        }

        setAddingInline(true);
        try {
            await api.post('/contacts', inlineForm);
            toast.success('Contact added');
            setInlineForm({
                phone_number: '',
                first_name: '',
                last_name: '',
                group_ids: [],
            });
            await fetchContacts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add contact');
        } finally {
            setAddingInline(false);
        }
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
            </div>

            {/* Filters */}
            <div className="contacts-filters">
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
                <button
                    className="btn btn-icon btn-primary"
                    onClick={() => inlinePhoneRef.current?.focus()}
                    title="Add contact"
                    aria-label="Add contact"
                >
                    <Plus size={15} />
                </button>
                <button
                    className="btn btn-icon btn-secondary"
                    onClick={downloadCsvTemplate}
                    title="Download template"
                    aria-label="Download template"
                >
                    <Download size={15} />
                </button>
                <button
                    className="btn btn-icon btn-secondary"
                    onClick={() => setShowImport(true)}
                    title="Bulk import"
                    aria-label="Bulk import"
                >
                    <Upload size={15} />
                </button>
            </div>

            {/* Bulk action bar */}
            {selected.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px', background: 'var(--clr-accent-dim)', border: '1px solid var(--clr-accent-glow)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: 14, color: 'var(--clr-accent)', fontWeight: 500 }}>{selected.length} selected</span>
                    <select className="form-select" style={{ width: 180 }} value={bulkGroupId} onChange={e => setBulkGroupId(e.target.value)}>
                        <option value="">Tag to group…</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button
                        className="btn btn-icon btn-primary btn-sm"
                        disabled={!bulkGroupId}
                        onClick={bulkTag}
                        title="Apply group tag"
                        aria-label="Apply group tag"
                    >
                        <Tag size={13} />
                    </button>
                    <button
                        className="btn btn-icon btn-ghost btn-sm"
                        onClick={() => setSelected([])}
                        title="Clear selection"
                        aria-label="Clear selection"
                    >
                        <X size={13} />
                    </button>
                </div>
            )}

            <div className="table-wrapper contacts-compact">
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
                                <th>First Name</th>
                                <th>Last Name</th>
                                <th>Groups</th>
                                <th>Status</th>
                                <th>Added</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="contacts-inline-row">
                                <td>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: 'var(--clr-accent-dim)', color: 'var(--clr-accent)' }}>
                                        <Plus size={14} />
                                    </div>
                                </td>
                                <td>
                                    <input
                                        ref={inlinePhoneRef}
                                        className="form-input contacts-cell-input"
                                        placeholder="+2348012345678"
                                        value={inlineForm.phone_number}
                                        onChange={(e) => setInlineForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="form-input contacts-cell-input"
                                        placeholder="First name"
                                        value={inlineForm.first_name}
                                        onChange={(e) => setInlineForm((prev) => ({ ...prev, first_name: e.target.value }))}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="form-input contacts-cell-input"
                                        placeholder="Last name"
                                        value={inlineForm.last_name}
                                        onChange={(e) => setInlineForm((prev) => ({ ...prev, last_name: e.target.value }))}
                                    />
                                </td>
                                <td>
                                    <GroupsMultiSelect
                                        groups={groups}
                                        value={inlineForm.group_ids}
                                        onChange={(nextValues) => setInlineForm((prev) => ({ ...prev, group_ids: nextValues }))}
                                        placeholder="Select groups"
                                    />
                                </td>
                                <td><span className="text-muted">—</span></td>
                                <td><span className="text-muted">Now</span></td>
                                <td>
                                    <button
                                        className="btn btn-icon btn-primary btn-sm"
                                        onClick={addInlineContact}
                                        disabled={addingInline}
                                        title="Add contact row"
                                        aria-label="Add contact row"
                                    >
                                        {addingInline ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />}
                                    </button>
                                </td>
                            </tr>

                            {contacts.map(c => (
                                <tr key={c.id}>
                                    <td><input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                                    <td>
                                        <input
                                            className="form-input font-mono contacts-cell-input"
                                            value={rowEdits[c.id]?.phone_number || ''}
                                            onChange={(e) => updateRowField(c.id, 'phone_number', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="form-input contacts-cell-input"
                                            value={rowEdits[c.id]?.first_name || ''}
                                            onChange={(e) => updateRowField(c.id, 'first_name', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="form-input contacts-cell-input"
                                            value={rowEdits[c.id]?.last_name || ''}
                                            onChange={(e) => updateRowField(c.id, 'last_name', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <GroupsMultiSelect
                                            groups={groups}
                                            value={rowEdits[c.id]?.group_ids || []}
                                            onChange={(nextValues) => updateRowField(c.id, 'group_ids', nextValues)}
                                            placeholder="No groups"
                                        />
                                    </td>
                                    <td>
                                        {c.opt_out ? (
                                            <span className="contacts-status-icon">
                                                <XCircle
                                                    size={15}
                                                    color="var(--clr-red)"
                                                    title="Opted out"
                                                    aria-label="Opted out"
                                                />
                                            </span>
                                        ) : (
                                            <span className="contacts-status-icon">
                                                <CheckCircle2
                                                    size={15}
                                                    color="var(--clr-green)"
                                                    title="Active"
                                                    aria-label="Active"
                                                />
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ fontSize: 13 }}>{new Date(c.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="contacts-action-cell">
                                            <button
                                                className="btn btn-icon btn-secondary btn-sm"
                                                onClick={() => saveRow(c.id)}
                                                disabled={rowSaving[c.id]}
                                                title="Save contact"
                                                aria-label="Save contact"
                                            >
                                                {rowSaving[c.id] ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />}
                                            </button>
                                            <button
                                                className="btn btn-icon btn-danger btn-sm"
                                                onClick={() => deleteContact(c.id)}
                                                title="Delete contact"
                                                aria-label="Delete contact"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
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

            {showImport && <ImportModal onClose={() => setShowImport(false)} onSaved={fetchContacts} groups={groups} />}
        </>
    );
}
