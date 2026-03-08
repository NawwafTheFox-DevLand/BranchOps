import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

const BodySchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['admin', 'branch_user']),
  branch_id: z.string().uuid().nullable().optional(),
  full_name: z.string().nullable().optional(),
})

export async function POST(req) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const json = await req.json()
    const body = BodySchema.parse(json)

    const service = createServiceRoleClient()

    const patch = {
      role: body.role,
      branch_id: body.branch_id ?? null,
      full_name: body.full_name ?? null,
    }

    const { error } = await service.from('profiles').update(patch).eq('id', body.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Bad Request' }, { status: 400 })
  }
}
