import { requireAdmin, isBusinessOwner, isSuperAdmin, getAllowedBranchId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CompareClient from './CompareClient'
import SignOutButton from '@/app/_components/SignOutButton'
import NotificationBell from '@/app/_components/NotificationBell'
import TopNav from '@/app/_components/TopNav'

export const dynamic = 'force-dynamic'

export default async function ComparePage() {
  const { profile } = await requireAdmin()
  if (!isSuperAdmin(profile) && !isBusinessOwner(profile)) redirect('/dashboard')

  const supabase = createClient()
  const allowedBranchId = getAllowedBranchId(profile)

  let branchQuery = supabase.from('branches').select('id,code,name').eq('is_active', true).order('code')
  if (allowedBranchId) branchQuery = branchQuery.eq('id', allowedBranchId)
  const { data: branches } = await branchQuery

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <TopNav profile={profile} currentPath="/forecast/compare">
        <NotificationBell />
        <SignOutButton />
      </TopNav>
      <CompareClient branches={branches || []} allowedBranchId={allowedBranchId} />
    </div>
  )
}
