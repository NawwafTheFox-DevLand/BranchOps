import { redirect } from 'next/navigation'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

// ── Core: get user + full profile ─────────────────────────────────────────────
export async function getUserAndProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, admin_type, branch_id, business_id, is_active')
    .eq('id', user.id)
    .single()

  if (error) throw new Error(error.message)
  return { user, profile }
}

// ── Guards ─────────────────────────────────────────────────────────────────────

export async function requireUser() {
  const { user, profile } = await getUserAndProfile()
  if (!user) redirect('/login')
  if (profile?.is_active === false) redirect('/login?reason=inactive')
  return { user, profile }
}

export async function requireSuperAdmin() {
  const { user, profile } = await requireUser()
  if (profile?.role !== 'super_admin') redirect('/dashboard')
  return { user, profile }
}

export async function requireAdmin() {
  const { user, profile } = await requireUser()
  if (!['super_admin', 'admin'].includes(profile?.role)) redirect('/')
  return { user, profile }
}

export async function requireBranchManager() {
  const { user, profile } = await requireUser()
  if (!['super_admin', 'admin'].includes(profile?.role)) redirect('/')
  return { user, profile }
}

// ── Role helpers ───────────────────────────────────────────────────────────────

export function isSuperAdmin(profile) {
  return profile?.role === 'super_admin'
}

export function isAdmin(profile) {
  return ['super_admin', 'admin'].includes(profile?.role)
}

export function isBusinessOwner(profile) {
  return profile?.role === 'super_admin' ||
    (profile?.role === 'admin' && profile?.admin_type === 'business_owner')
}

export function isBranchManager(profile) {
  return profile?.role === 'admin' && profile?.admin_type === 'branch_manager'
}

export function isBranchUser(profile) {
  return profile?.role === 'branch_user'
}

// ── Branch access: returns null = all branches, uuid = own branch only ─────────
export function getAllowedBranchId(profile) {
  if (profile?.role === 'super_admin') return null
  if (profile?.role === 'admin' && profile?.admin_type === 'business_owner') return null
  if (profile?.role === 'admin' && profile?.admin_type === 'branch_manager') return profile.branch_id
  if (profile?.role === 'branch_user') return profile.branch_id
  return profile?.branch_id ?? null
}

// ── Login redirect: where each role lands after sign-in ───────────────────────
export function getHomeRoute(profile) {
  if (!profile) return '/login'
  if (profile.role === 'super_admin') return '/dashboard'
  if (profile.role === 'admin') return '/dashboard'
  return '/log'
}

// ── Bootstrap: promote first user matching env var to super_admin ─────────────
export async function maybeBootstrapAdmin(user) {
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL
  if (!bootstrapEmail) return

  const email = (user?.email ?? '').toLowerCase()
  if (email !== bootstrapEmail.toLowerCase()) return

  const service = createServiceRoleClient()
  const { data: admins } = await service
    .from('profiles')
    .select('id')
    .eq('role', 'super_admin')
    .limit(1)

  if (admins && admins.length > 0) return

  await service
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('id', user.id)
}
