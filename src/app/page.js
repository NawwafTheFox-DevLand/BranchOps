import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { maybeBootstrapAdmin, getHomeRoute } from '@/lib/auth'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  await maybeBootstrapAdmin(user)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, admin_type, branch_id, full_name, is_active')
    .eq('id', user.id)
    .single()

  if (profile?.is_active === false) redirect('/login?reason=inactive')

  redirect(getHomeRoute(profile))
}
