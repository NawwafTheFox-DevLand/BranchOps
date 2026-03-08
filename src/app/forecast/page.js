import { requireAdmin, getAllowedBranchId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ForecastClient from './ForecastClient'
import SignOutButton from '@/app/_components/SignOutButton'
import NotificationBell from '@/app/_components/NotificationBell'
import TopNav from '@/app/_components/TopNav'

export const dynamic = 'force-dynamic'

function riyadhDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

export default async function ForecastPage({ searchParams }) {
  const { profile } = await requireAdmin()
  const supabase = createClient()
  const allowedBranchId = getAllowedBranchId(profile)
  const date = searchParams?.date || riyadhDate()

  const { data: run } = await supabase
    .from('forecast_runs').select('*')
    .eq('run_for_date', date)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()

  let forecasts = []
  if (run) {
    let fq = supabase.from('demand_forecasts')
      .select(`id, branch_id, product_id, slot_id, forecast_date, day_type,
        predicted_units, predicted_units_p80, predicted_units_p90,
        recommended_batches, batch_size_kg, source, confidence, obs_days,
        actual_produced, actual_wasted, actual_stockouts, actual_sold,
        branches(code, name), products(name_ar, erp_code), time_slots(label, start_hour)`)
      .eq('run_id', run.id).order('branch_id')
    if (allowedBranchId) fq = fq.eq('branch_id', allowedBranchId)
    const { data } = await fq
    forecasts = data || []
  }

  let branchQ = supabase.from('branches').select('id,code,name').eq('is_active', true).order('code')
  if (allowedBranchId) branchQ = branchQ.eq('id', allowedBranchId)

  const [branchesRes, productsRes, runsRes] = await Promise.all([
    branchQ,
    supabase.from('products').select('id,name_ar,erp_code').eq('is_active', true).order('name_ar'),
    supabase.from('forecast_runs')
      .select('id,run_for_date,source,day_type,created_at,branches_covered,products_covered')
      .order('run_for_date', { ascending: false }).limit(14),
  ])

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <TopNav profile={profile} currentPath="/forecast">
        <NotificationBell />
        <SignOutButton />
      </TopNav>
      <ForecastClient initial={{
        date, run: run || null, forecasts,
        branches: branchesRes.data || [],
        products: productsRes.data || [],
        recentRuns: runsRes.data || [],
      }} />
    </div>
  )
}
