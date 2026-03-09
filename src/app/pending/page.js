'use client'

export default function PendingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24, background: '#f4f6f9' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#ffffff',
        border: '1px solid #dde1e9', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: '#111827' }}>
          Account Pending Approval
        </div>
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 24 }}>
          Your account has been created successfully. A system administrator will review
          and activate your account shortly. You'll be able to log in once approved.
        </div>
        <div style={{ padding: '12px 16px', borderRadius: 10,
          background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)',
          color: '#d97706', fontSize: 12, fontWeight: 600 }}>
          Please contact your manager if you need urgent access.
        </div>
      </div>
    </div>
  )
}
