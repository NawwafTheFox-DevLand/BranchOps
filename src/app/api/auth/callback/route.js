import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user) {
      const user = data.user
      const service = createServiceRoleClient()

      const { data: existing } = await service
        .from('profiles').select('id').eq('id', user.id).single()

      if (!existing) {
        await service.from('profiles').insert({
          id:         user.id,
          full_name:  user.user_metadata?.full_name || null,
          role:       'branch_user',
          admin_type: null,
          branch_id:  null,
          is_active:  false,
        })
      }

      const { data: profile } = await service
        .from('profiles').select('is_active').eq('id', user.id).single()

      if (profile?.is_active === false) {
        return NextResponse.redirect(`${origin}/pending`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
