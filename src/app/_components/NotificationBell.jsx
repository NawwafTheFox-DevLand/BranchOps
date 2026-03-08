'use client'
import { useState, useEffect, useRef } from 'react'

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

const TYPE_META = {
  d2_due:          { icon: '📋', color: C.amber, label: 'D-2 Forecast Due'     },
  d1_due:          { icon: '⚡', color: C.amber, label: 'D-1 Forecast Due'     },
  large_revision:  { icon: '⚠️', color: C.red,   label: 'Large Revision'       },
  low_confidence:  { icon: '🎯', color: C.blue,  label: 'Low Confidence'       },
  overdue:         { icon: '🔴', color: C.red,   label: 'Overdue'              },
  general:         { icon: '💬', color: C.muted2, label: 'Info'                },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationBell() {
  const [open,          setOpen]          = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread,        setUnread]        = useState(0)
  const [loading,       setLoading]       = useState(false)
  const ref = useRef(null)

  const load = async () => {
    try {
      const res  = await fetch('/api/notifications', { credentials: 'include' })
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnread(data.unread || 0)
    } catch {}
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markRead = async (id) => {
    await fetch('/api/notifications', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', notification_id: id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    setLoading(true)
    await fetch('/api/notifications', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
    setLoading(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative', background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${open ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 9, padding: '7px 10px', cursor: 'pointer',
          color: open ? C.amber : 'rgba(229,231,235,0.85)', fontSize: 15,
          display: 'flex', alignItems: 'center', gap: 5 }}>
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5,
            background: C.red, color: '#fff', borderRadius: 999,
            fontSize: 9, fontWeight: 800, minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: `2px solid ${C.bg}` }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 44, right: 0, width: 360,
          background: C.surf, border: `1px solid ${C.border2}`,
          borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          zIndex: 999, overflow: 'hidden', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>

          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: C.text }}>
              Notifications {unread > 0 && (
                <span style={{ color: C.red, fontSize: 11 }}>({unread} new)</span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} disabled={loading}
                style={{ fontSize: 10, color: C.amber, background: 'none',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                {loading ? '…' : 'Mark all read'}
              </button>
            )}
          </div>

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: C.muted2, fontSize: 12 }}>
                No notifications
              </div>
            ) : notifications.map(n => {
              const meta = TYPE_META[n.type] || TYPE_META.general
              return (
                <div key={n.id}
                  onClick={() => { if (!n.is_read) markRead(n.id); if (n.action_url) window.location.href = n.action_url }}
                  style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
                    background: n.is_read ? 'transparent' : C.amberDim,
                    cursor: n.action_url ? 'pointer' : 'default',
                    transition: 'background 0.15s' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: n.is_read ? 500 : 700,
                        color: n.is_read ? C.textDim : C.text, marginBottom: 3 }}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div style={{ fontSize: 11, color: C.muted2, lineHeight: 1.6 }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                    {!n.is_read && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%',
                        background: meta.color, flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`,
            fontSize: 10, color: C.muted2, textAlign: 'center' }}>
            Refreshes every 60s · D-2 alerts on Saturday · D-1 alerts on Sunday
          </div>
        </div>
      )}
    </div>
  )
}
