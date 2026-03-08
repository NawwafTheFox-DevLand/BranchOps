import { requireAdmin, isBusinessOwner, isSuperAdmin, getAllowedBranchId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PerformanceClient from './PerformanceClient'
import SignOutButton from '@/app/_components/SignOutButton'
import NotificationBell from '@/app/_components/NotificationBell'
import TopNav from '@/app/_components/TopNav'

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
  const { profile } = await requireAdmin()
  if (!isSuperAdmin(profile) && !isBusinessOwner(profile)) redirect('/dashboard')

  const supabase = createClient()
  const allowedBranchId = getAllowedBranchId(profile)

  let branchQ = supabase.from('branches').select('id,code,name').eq('is_active', true).order('code')
  if (allowedBranchId) branchQ = branchQ.eq('id', allowedBranchId)
  const [branchRes, productRes] = await Promise.all([
    branchQ,
    supabase.from('products').select('id,name_ar,erp_code').eq('is_active', true).order('name_ar'),
  ])

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <TopNav profile={profile} currentPath="/forecast/performance">
        <NotificationBell />
        <SignOutButton />
      </TopNav>
      <PerformanceClient
        branches={branchRes.data || []}
        products={productRes.data || []}
        allowedBranchId={allowedBranchId}
      />
    </div>
  )
}
