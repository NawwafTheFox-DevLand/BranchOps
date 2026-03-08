import { requireAdmin, getAllowedBranchId, isSuperAdmin, isBusinessOwner } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import SignOutButton from '@/app/_components/SignOutButton'
import NotificationBell from '@/app/_components/NotificationBell'
import TopNav from '@/app/_components/TopNav'

export const dynamic = 'force-dynamic'

function riyadhDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

export default async function DashboardPage() {
  const { profile } = await requireAdmin()
  const supabase = createClient()
  const allowedBranchId = getAllowedBranchId(profile)

  const today = riyadhDate()
  const start = `${today}T00:00:00+03:00`
  const week7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const applyBranch = (q) => allowedBranchId ? q.eq('branch_id', allowedBranchId) : q

  const [branchesRes, productsRes, batchesRes, wasteRes, stockRes, weekBatchRes, weekWasteRes] = await Promise.all([
    allowedBranchId
      ? supabase.from('branches').select('id,code,name,is_active').eq('id', allowedBranchId)
      : supabase.from('branches').select('id,code,name,is_active').eq('is_active', true).order('code'),
    supabase.from('products').select('id,erp_code,name_ar,yield_per_batch,batch_size_kg,hot_hold_minutes,is_active').eq('is_active', true).order('name_ar'),
    applyBranch(supabase.from('production_batches')
      .select('id,branch_id,product_id,cooked_at,batch_qty,produced_qty,products(yield_per_batch,batch_size_kg,name_ar,erp_code),branches(code,name)')
      .gte('cooked_at', start).order('cooked_at', { ascending: false }).limit(500)),
    applyBranch(supabase.from('waste_events')
      .select('id,branch_id,product_id,wasted_at,wasted_qty,reason,products(name_ar,erp_code),branches(code,name)')
      .gte('wasted_at', start).order('wasted_at', { ascending: false }).limit(500)),
    applyBranch(supabase.from('stockout_events')
      .select('id,branch_id,product_id,occurred_at,products(name_ar),branches(code,name)')
      .gte('occurred_at', start).order('occurred_at', { ascending: false }).limit(200)),
    applyBranch(supabase.from('production_batches').select('id,branch_id,cooked_at,produced_qty,batch_qty').gte('cooked_at', week7).limit(5000)),
    applyBranch(supabase.from('waste_events').select('id,branch_id,wasted_at,wasted_qty').gte('wasted_at', week7).limit(5000)),
  ])

  const branches       = branchesRes.data || []
  const totalProduced7 = (weekBatchRes.data||[]).reduce((s,b) => s + Number(b.produced_qty || b.batch_qty*12 || 0), 0)
  const totalWasted7   = (weekWasteRes.data||[]).reduce((s,w) => s + Number(w.wasted_qty || 0), 0)
  const wastePct7      = totalProduced7 > 0 ? Math.round(totalWasted7/totalProduced7*1000)/10 : 0
  const todayProduced  = (batchesRes.data||[]).reduce((s,b) => s + Number(b.produced_qty || b.batch_qty*12 || 0), 0)
  const todayWasted    = (wasteRes.data||[]).reduce((s,w) => s + Number(w.wasted_qty || 0), 0)
  const wastePctToday  = todayProduced > 0 ? Math.round(todayWasted/todayProduced*1000)/10 : 0

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <TopNav profile={profile} currentPath="/dashboard">
        <NotificationBell />
        <SignOutButton />
      </TopNav>
      <DashboardClient initial={{
        today, branches,
        products:       productsRes.data || [],
        batches:        batchesRes.data  || [],
        waste:          wasteRes.data    || [],
        stockouts:      stockRes.data    || [],
        todayWasted:    Math.round(todayWasted),
        wastePctToday,  wastePct7,
        totalProduced7: Math.round(totalProduced7),
        totalWasted7:   Math.round(totalWasted7),
        latestForecast: null,
        batchCount7:    (weekBatchRes.data||[]).length,
        stockoutCount:  (stockRes.data||[]).length,
      }} />
    </div>
  )
}
