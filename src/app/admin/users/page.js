import { requireAdmin } from '@/lib/auth'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'
import SignOutButton from '@/app/_components/SignOutButton'
import NotificationBell from '@/app/_components/NotificationBell'
import TopNav from '@/app/_components/TopNav'

export default async function AdminUsersPage() {
  const { profile: currentProfile } = await requireAdmin()
  const supabase = createClient()
  const service  = createServiceRoleClient()

  const [branchesRes, profilesRes, usersRes] = await Promise.all([
    supabase.from('branches').select('id,code,name,is_active').eq('is_active', true).order('code'),
    service.from('profiles').select('id,full_name,role,admin_type,branch_id,is_active,created_at').order('created_at', { ascending: false }).limit(5000),
    service.auth.admin.listUsers({ perPage: 200, page: 1 }),
  ])

  const users     = usersRes?.data?.users || []
  const emailById = new Map(users.map(u => [u.id, u.email]))
  const profiles  = (profilesRes.data || []).map(p => ({ ...p, email: emailById.get(p.id) || null }))

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', color: '#e5e7eb',
      padding: '28px 24px 80px', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <TopNav profile={currentProfile} currentPath="/admin/users">
        <NotificationBell />
        <SignOutButton />
      </TopNav>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 22,
            letterSpacing: '-0.03em', marginBottom: 4 }}>User Management</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            Assign roles, admin types, and branches
          </div>
        </div>
        <UsersClient initial={{ branches: branchesRes.data || [], profiles }} currentUserRole={currentProfile?.role} />
      </div>
    </div>
  )
}
