import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { type, ...payload } = body

    if (type === 'batch') {
      const { branch_id, product_id, slot_id, cooked_at, batch_qty, produced_qty, notes } = payload
      if (!branch_id || !product_id || !slot_id || !batch_qty) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      const { data, error } = await supabase.from('production_batches').insert({
        branch_id, product_id, slot_id,
        cooked_at: cooked_at || new Date().toISOString(),
        batch_qty: Number(batch_qty),
        produced_qty: produced_qty ? Number(produced_qty) : null,
        status: 'consumed',
        notes: notes || null,
      }).select('id').single()
      if (error) throw error
      return NextResponse.json({ ok: true, id: data.id, type: 'batch' })
    }

    if (type === 'waste') {
      const { branch_id, product_id, batch_id, wasted_at, wasted_qty, reason } = payload
      if (!branch_id || !product_id || !wasted_qty) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      const { data, error } = await supabase.from('waste_events').insert({
        branch_id, product_id, batch_id: batch_id || null,
        wasted_at: wasted_at || new Date().toISOString(),
        wasted_qty: Number(wasted_qty),
        reason: reason || 'other',
      }).select('id').single()
      if (error) throw error
      return NextResponse.json({ ok: true, id: data.id, type: 'waste' })
    }

    if (type === 'stockout') {
      const { branch_id, product_id, occurred_at, duration_min, est_lost_qty } = payload
      if (!branch_id || !product_id) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      const { data, error } = await supabase.from('stockout_events').insert({
        branch_id, product_id,
        occurred_at: occurred_at || new Date().toISOString(),
        duration_min: duration_min ? Number(duration_min) : null,
        est_lost_qty: est_lost_qty ? Number(est_lost_qty) : null,
      }).select('id').single()
      if (error) throw error
      return NextResponse.json({ ok: true, id: data.id, type: 'stockout' })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const branch_id = searchParams.get('branch_id')
    const days = Number(searchParams.get('days') || 7)
    const since = new Date(Date.now() - days * 86400000).toISOString()

    const [batches, waste, stockouts] = await Promise.all([
      supabase.from('production_batches')
        .select('id, branch_id, product_id, slot_id, cooked_at, batch_qty, produced_qty, products(name_ar), branches(code,name), time_slots(label)')
        .gte('cooked_at', since)
        .eq(branch_id ? 'branch_id' : 'id', branch_id || supabase)
        .order('cooked_at', { ascending: false }).limit(200),
      supabase.from('waste_events')
        .select('id, branch_id, product_id, wasted_at, wasted_qty, reason, products(name_ar), branches(code,name)')
        .gte('wasted_at', since)
        .order('wasted_at', { ascending: false }).limit(200),
      supabase.from('stockout_events')
        .select('id, branch_id, product_id, occurred_at, duration_min, products(name_ar), branches(code,name)')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false }).limit(100),
    ])

    // Waste KPI
    const totalProduced = (batches.data || []).reduce((s, b) => s + Number(b.produced_qty || b.batch_qty * 12 || 0), 0)
    const totalWasted   = (waste.data   || []).reduce((s, w) => s + Number(w.wasted_qty || 0), 0)
    const wastePct      = totalProduced > 0 ? (totalWasted / totalProduced) * 100 : 0

    return NextResponse.json({
      ok: true,
      batches:   batches.data   || [],
      waste:     waste.data     || [],
      stockouts: stockouts.data || [],
      kpi: { totalProduced, totalWasted, wastePct: Math.round(wastePct * 10) / 10 }
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
