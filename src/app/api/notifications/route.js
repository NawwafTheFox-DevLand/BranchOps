import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ notifications: [] })

    const { data: profile } = await supabase
      .from('profiles').select('role, admin_type').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ notifications: [] })

    const role = profile.role
    const now  = new Date().toISOString()

    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, action_url, created_at, read_by')
      .contains('target_roles', [role])
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(30)

    const notifications = (data || []).map(n => ({
      ...n,
      is_read: Array.isArray(n.read_by) && n.read_by.includes(user.id),
    }))

    return NextResponse.json({
      notifications,
      unread: notifications.filter(n => !n.is_read).length,
    })
  } catch (e) {
    return NextResponse.json({ notifications: [], unread: 0 })
  }
}

export async function POST(req) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, notification_id } = await req.json()

    if (action === 'mark_read' && notification_id) {
      const service = createServiceRoleClient()
      const { data: notif } = await service
        .from('notifications').select('read_by').eq('id', notification_id).single()
      const readBy = Array.isArray(notif?.read_by) ? notif.read_by : []
      if (!readBy.includes(user.id)) {
        await service.from('notifications')
          .update({ read_by: [...readBy, user.id] })
          .eq('id', notification_id)
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'mark_all_read') {
      const service = createServiceRoleClient()
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const { data: notifs } = await service
        .from('notifications')
        .select('id, read_by')
        .contains('target_roles', [profile?.role])
      for (const n of (notifs || [])) {
        const readBy = Array.isArray(n.read_by) ? n.read_by : []
        if (!readBy.includes(user.id)) {
          await service.from('notifications')
            .update({ read_by: [...readBy, user.id] }).eq('id', n.id)
        }
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
