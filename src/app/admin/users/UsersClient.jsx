'use client'

import { useMemo, useState } from 'react'

const C = {
  bg:'#f4f6f9', surf:'#ffffff', surf2:'#f0f2f6', surf3:'#e8ebf0',
  border:'#dde1e9', border2:'#c8cdd8',
  amber:'#d97706', amberDim:'rgba(217,119,6,0.08)', amberBrd:'rgba(217,119,6,0.25)',
  green:'#16a34a', greenDim:'rgba(22,163,74,0.07)', greenBrd:'rgba(22,163,74,0.2)',
  red:'#dc2626',   redDim:'rgba(220,38,38,0.07)',   redBrd:'rgba(220,38,38,0.2)',
  blue:'#2563eb',  blueDim:'rgba(37,99,235,0.07)',  blueBrd:'rgba(37,99,235,0.2)',
  teal:'#0d9488',  violet:'#7c3aed',
  muted:'#94a3b8', muted2:'#64748b', text:'#111827', textDim:'#374151',
}

const ROLE_META = {
  super_admin:  { label: 'Super Admin',     color: C.purple, desc: 'Full system access' },
  admin:        { label: 'Admin',           color: C.amber,  desc: 'Business owner or branch manager' },
  branch_user:  { label: 'Branch Employee', color: C.teal,   desc: 'Log access only' },
}

const ADMIN_TYPE_META = {
  business_owner: { label: 'Business Owner', color: C.amber },
  branch_manager: { label: 'Branch Manager', color: C.blue  },
}

function RoleBadge({ role, admin_type }) {
  const rm = ROLE_META[role] || ROLE_META.branch_user
  const at = admin_type ? ADMIN_TYPE_META[admin_type] : null
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <span style={{ background: `${rm.color}18`, border: `1px solid ${rm.color}44`,
        color: rm.color, borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>
        {rm.label}
      </span>
      {at && (
        <span style={{ background: `${at.color}12`, border: `1px solid ${at.color}33`,
          color: at.color, borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
          {at.label}
        </span>
      )}
    </div>
  )
}

export default function UsersClient({ initial, currentUserRole }) {
  const [rows, setRows]       = useState(initial.profiles || [])
  const [q, setQ]             = useState('')
  const [savingId, setSavingId] = useState(null)
  const [toast, setToast]     = useState(null)

  const branches    = initial.branches || []
  const branchById  = useMemo(() => new Map(branches.map(b => [b.id, b])), [branches])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r => {
      const b = r.branch_id ? branchById.get(r.branch_id) : null
      return [r.full_name, r.email, r.role, r.admin_type, b?.code, b?.name]
        .filter(Boolean).join(' ').toLowerCase().includes(s)
    })
  }, [rows, q, branchById])

  const setRow = (id, patch) => setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))

  const save = async (row) => {
    setSavingId(row.id)
    setToast(null)
    try {
      const res = await fetch('/api/admin/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:         row.id,
          role:       row.role,
          admin_type: row.role === 'admin' ? (row.admin_type || 'business_owner') : null,
          branch_id:  row.branch_id || null,
          full_name:  row.full_name || null,
          is_active:  row.is_active ?? true,
        }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(out?.error || `HTTP ${res.status}`)
      setToast({ type: 'success', text: 'Saved ✓' })
    } catch (e) {
      setToast({ type: 'error', text: e?.message || 'Failed' })
    } finally {
      setSavingId(null)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const rolesByCount = useMemo(() => {
    const counts = { super_admin: 0, admin: 0, branch_user: 0 }
    rows.forEach(r => { if (counts[r.role] !== undefined) counts[r.role]++ })
    return counts
  }, [rows])

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <style>{`*{box-sizing:border-box} select option{background:#ffffff}`}</style>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(ROLE_META).map(([role, meta]) => (
          <div key={role} style={{ background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '12px 18px', flex: '1 1 160px' }}>
            <div style={{ fontSize: 9, color: C.muted2, letterSpacing: '0.08em', marginBottom: 4 }}>
              {meta.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: meta.color }}>
              {rolesByCount[role] || 0}
            </div>
          </div>
        ))}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: '12px 18px', flex: '1 1 160px' }}>
          <div style={{ fontSize: 9, color: C.muted2, letterSpacing: '0.08em', marginBottom: 4 }}>TOTAL USERS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{rows.length}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search name / email / role / branch…"
            style={{ flex: '1 1 240px', padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${C.border2}`, background: C.surface2,
              color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
        </div>

        {toast && (
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
            color: toast.type === 'success' ? C.green : C.red,
            background: toast.type === 'success' ? C.greenDim : C.redDim,
            fontSize: 12, fontWeight: 700 }}>
            {toast.text}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.surface3 }}>
                {['Name', 'Email', 'Role', 'Admin Type', 'Branch', 'Active', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left',
                    fontSize: 9, color: C.muted2, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const branch = r.branch_id ? branchById.get(r.branch_id) : null
                const canEdit = currentUserRole === 'super_admin' ||
                  (currentUserRole === 'admin' && r.role === 'branch_user')

                return (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}`,
                    opacity: r.is_active === false ? 0.5 : 1 }}>

                    {/* Name */}
                    <td style={{ padding: '10px 12px' }}>
                      <input value={r.full_name || ''} disabled={!canEdit}
                        onChange={e => setRow(r.id, { full_name: e.target.value })}
                        style={{ width: 160, padding: '7px 9px', borderRadius: 7,
                          border: `1px solid ${canEdit ? C.border2 : 'transparent'}`,
                          background: canEdit ? C.surface2 : 'transparent',
                          color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                    </td>

                    {/* Email */}
                    <td style={{ padding: '10px 12px', color: C.muted2, whiteSpace: 'nowrap', fontSize: 11 }}>
                      {r.email || '—'}
                    </td>

                    {/* Role */}
                    <td style={{ padding: '10px 12px' }}>
                      {canEdit ? (
                        <select value={r.role} onChange={e => setRow(r.id, { role: e.target.value, admin_type: null })}
                          style={{ padding: '7px 9px', borderRadius: 7, border: `1px solid ${C.border2}`,
                            background: C.surface2, color: C.text, fontSize: 12,
                            fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
                          {currentUserRole === 'super_admin' && <option value="super_admin">Super Admin</option>}
                          <option value="admin">Admin</option>
                          <option value="branch_user">Branch Employee</option>
                        </select>
                      ) : (
                        <RoleBadge role={r.role} admin_type={r.admin_type} />
                      )}
                    </td>

                    {/* Admin Type — only shown when role = admin */}
                    <td style={{ padding: '10px 12px' }}>
                      {r.role === 'admin' && canEdit ? (
                        <select value={r.admin_type || 'business_owner'}
                          onChange={e => setRow(r.id, { admin_type: e.target.value })}
                          style={{ padding: '7px 9px', borderRadius: 7, border: `1px solid ${C.border2}`,
                            background: C.surface2, color: C.text, fontSize: 12,
                            fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
                          <option value="business_owner">Business Owner</option>
                          <option value="branch_manager">Branch Manager</option>
                        </select>
                      ) : r.role === 'admin' ? (
                        <span style={{ color: C.amber, fontSize: 11 }}>
                          {ADMIN_TYPE_META[r.admin_type]?.label || '—'}
                        </span>
                      ) : (
                        <span style={{ color: C.muted }}>—</span>
                      )}
                    </td>

                    {/* Branch */}
                    <td style={{ padding: '10px 12px' }}>
                      {canEdit ? (
                        <select value={r.branch_id || ''}
                          onChange={e => setRow(r.id, { branch_id: e.target.value || null })}
                          style={{ padding: '7px 9px', borderRadius: 7, border: `1px solid ${C.border2}`,
                            background: C.surface2, color: C.text, fontSize: 12,
                            fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
                          <option value="">— unassigned —</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ color: C.muted2, fontSize: 11 }}>
                          {branch ? `${branch.code} — ${branch.name}` : '—'}
                        </span>
                      )}
                    </td>

                    {/* Active toggle */}
                    <td style={{ padding: '10px 12px' }}>
                      {canEdit ? (
                        <button onClick={() => setRow(r.id, { is_active: !r.is_active })}
                          style={{ padding: '5px 12px', borderRadius: 7, fontWeight: 700,
                            fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                            background: r.is_active !== false ? C.greenDim : C.redDim,
                            color: r.is_active !== false ? C.green : C.red }}>
                          {r.is_active !== false ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <span style={{ color: r.is_active !== false ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>
                          {r.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>

                    {/* Save */}
                    <td style={{ padding: '10px 12px' }}>
                      {canEdit ? (
                        <button onClick={() => save(r)} disabled={savingId === r.id}
                          style={{ padding: '7px 14px', borderRadius: 7, fontWeight: 700,
                            fontSize: 12, cursor: savingId === r.id ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit', border: 'none',
                            background: savingId === r.id ? C.surface3 : C.amber,
                            color: savingId === r.id ? C.muted2 : '#0a0a0a' }}>
                          {savingId === r.id ? '…' : 'Save'}
                        </button>
                      ) : (
                        <span style={{ color: C.muted, fontSize: 10 }}>view only</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, color: C.muted2, textAlign: 'center' }}>
                  No users found.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`,
          fontSize: 11, color: C.muted2, lineHeight: 1.8 }}>
          <b style={{ color: C.textDim }}>Role rules:</b> Super Admin can edit anyone ·
          Admin can only promote/demote Branch Employees ·
          Branch Manager requires a branch assignment ·
          Inactive users are redirected to login
        </div>
      </div>
    </div>
  )
}
