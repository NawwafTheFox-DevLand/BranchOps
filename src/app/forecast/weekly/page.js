import { requireAdmin, getAllowedBranchId, isSuperAdmin, isBusinessOwner } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import WeeklyForecastClient from './WeeklyForecastClient'
import SignOutButton from '@/app/_components/SignOutButton'
import NotificationBell from '@/app/_components/NotificationBell'
import TopNav from '@/app/_components/TopNav'

export const dynamic = 'force-dynamic'

export default async function WeeklyForecastPage() {
  const { profile } = await requireAdmin()
  const supabase = createClient()
  const allowedBranchId = getAllowedBranchId(profile)

  let branchQuery = supabase.from('branches').select('id,code,name').eq('is_active', true).order('code')
  if (allowedBranchId) branchQuery = branchQuery.eq('id', allowedBranchId)
  const [branchRes, productRes] = await Promise.all([
    branchQuery,
    supabase.from('products').select('id,name_ar,erp_code,yield_per_batch').eq('is_active', true).order('name_ar'),
  ])

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <TopNav profile={profile} currentPath="/forecast/weekly">
        <NotificationBell />
        <SignOutButton />
      </TopNav>
      <WeeklyForecastClient
        branches={branchRes.data || []}
        products={productRes.data || []}
        profile={profile}
        allowedBranchId={allowedBranchId}
      />
    </div>
  )
}
