import { requireAdmin } from '@/lib/auth'
import ChartsClient from './ChartsClient'
import SignOutButton from '@/app/_components/SignOutButton'

export default async function ChartsPage() {
  await requireAdmin()
  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 100, display: 'flex', gap: 10, alignItems: 'center' }}>
        <a href="/dashboard" style={{ fontSize: 12, color: 'rgba(229,231,235,0.85)', border: '1px solid rgba(255,255,255,0.12)', padding: '8px 10px', borderRadius: 10, fontWeight: 700, background: 'rgba(0,0,0,0.3)' }}>Dashboard</a>
        <a href="/forecast"  style={{ fontSize: 12, color: 'rgba(229,231,235,0.85)', border: '1px solid rgba(255,255,255,0.12)', padding: '8px 10px', borderRadius: 10, fontWeight: 700, background: 'rgba(0,0,0,0.3)' }}>Forecast</a>
        <SignOutButton />
      </div>
      <ChartsClient />
    </div>
  )
}
