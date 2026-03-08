import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OperationsClient from './OperationsClient'

export default async function OperationsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [branchesRes, productsRes, slotsRes] = await Promise.all([
    supabase.from('branches').select('id, code, name').eq('is_active', true).order('code'),
    supabase.from('products').select('id, erp_code, name_ar, is_batch_cooked').eq('is_active', true).order('name_ar'),
    supabase.from('time_slots').select('id, label, start_hour').eq('is_active', true).order('start_hour'),
  ])

  // Get user's branch if they're a branch user
  const { data: profile } = await supabase.from('profiles').select('role, branch_id').eq('id', user.id).single()

  return (
    <OperationsClient
      branches={branchesRes.data || []}
      products={productsRes.data || []}
      slots={slotsRes.data || []}
      userRole={profile?.role || 'branch_user'}
      userBranchId={profile?.branch_id || null}
    />
  )
}
