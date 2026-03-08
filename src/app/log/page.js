import BranchLoggerClient from './BranchLoggerClient'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/app/_components/SignOutButton'

function riyadhDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

export default async function LogPage() {
  const { user, profile } = await requireUser()
  const supabase = createClient()

  const today = riyadhDateString()
  const start = `${today}T00:00:00+03:00`
  const branchFilter = profile?.role === 'admin' ? {} : { branch_id: profile?.branch_id }

  const [branchesRes, productsRes, slotsRes, batchesRes] = await Promise.all([
    supabase.from('branches').select('id, code, name, is_active').eq('is_active', true).order('code'),
    supabase.from('products').select('id, erp_code, name_ar, name_en, is_active, is_batch_cooked, batch_size_kg, yield_per_batch, hot_hold_minutes').eq('is_active', true).order('name_ar'),
    supabase.from('time_slots').select('id, label, start_hour, end_hour, is_active').eq('is_active', true).order('start_hour'),
    supabase.from('production_batches').select('id, branch_id, product_id, cooked_at, produced_qty').gte('cooked_at', start).order('cooked_at', { ascending: false }).limit(50).match(branchFilter),
  ])

  if (branchesRes.error) throw new Error(branchesRes.error.message)
  if (productsRes.error) throw new Error(productsRes.error.message)
  if (slotsRes.error) throw new Error(slotsRes.error.message)
  if (batchesRes.error) throw new Error(batchesRes.error.message)

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ position:'fixed', top:14, right:14, zIndex:100, display:'flex', gap:10, alignItems:'center' }}>
        <a href={profile?.role === 'admin' ? '/dashboard' : '/'} style={{ fontSize:12, color:'rgba(229,231,235,0.85)', border:'1px solid rgba(255,255,255,0.12)', padding:'8px 10px', borderRadius:10, fontWeight:700, background:'rgba(0,0,0,0.3)' }}>
          {profile?.role === 'admin' ? 'Dashboard' : 'Home'}
        </a>
        <SignOutButton />
      </div>
      <BranchLoggerClient
        initial={{ branches: branchesRes.data || [], products: productsRes.data || [], slots: slotsRes.data || [], recentBatches: batchesRes.data || [], today }}
        profile={profile}
        user={{ id: user.id, email: user.email }}
      />
    </div>
  )
}
