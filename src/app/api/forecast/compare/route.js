import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Saudi week: starts Sunday, D-2 = Friday, D-1 = Saturday
function getSaudiWeekOf(date = new Date()) {
  const d = new Date(date)
  // Get day in Riyadh time
  const riyadh = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d)
  const parts = Object.fromEntries(riyadh.map(p => [p.type, p.value]))
  const day = d.getDay() // 0=Sun,1=Mon,...,6=Sat
  // Find this week's Sunday
  const diff = day === 0 ? 0 : -day
  const sunday = new Date(d)
  sunday.setDate(d.getDate() + diff)
  return sunday.toISOString().slice(0, 10)
}

function getRunTypeForToday() {
  const day = new Date().getDay() // 0=Sun,...,5=Fri,6=Sat
  if (day === 5) return 'D-2' // Friday = 2 days before Sunday
  if (day === 6) return 'D-1' // Saturday = 1 day before Sunday
  return 'adhoc'
}

export async function GET(req) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branch_id') || null
    const weekOf   = searchParams.get('week_of')   || null

    // Get latest D-2 and D-1 runs
    const buildQ = (runType) => {
      let q = supabase.from('weekly_forecasts')
        .select(`
          id, week_start, week_of, run_type, run_date,
          predicted_units, predicted_lo80, predicted_hi80,
          recommended_batches, confidence, model_type,
          products(id, name_ar, erp_code, yield_per_batch),
          branches(id, code, name)
        `)
        .eq('run_type', runType)
        .order('run_date', { ascending: false })
        .order('week_start')
        .limit(1000)
      if (branchId) q = q.eq('branch_id', branchId)
      if (weekOf)   q = q.eq('week_of', weekOf)
      return q
    }

    const [d2Res, d1Res, weeksRes] = await Promise.all([
      buildQ('D-2'),
      buildQ('D-1'),
      // Get available week_of dates
      supabase.from('weekly_forecasts')
        .select('week_of, run_type, run_date')
        .in('run_type', ['D-2', 'D-1'])
        .not('week_of', 'is', null)
        .order('week_of', { ascending: false })
        .limit(100),
    ])

    const d2 = d2Res.data || []
    const d1 = d1Res.data || []

    // Build comparison keyed by product_id + branch_id + week_start
    const key = (r) => `${r.products?.id}__${r.branches?.id}__${r.week_start}`

    const d2Map = {}
    d2.forEach(r => { d2Map[key(r)] = r })

    const d1Map = {}
    d1.forEach(r => { d1Map[key(r)] = r })

    const allKeys = new Set([...Object.keys(d2Map), ...Object.keys(d1Map)])

    const comparisons = []
    for (const k of allKeys) {
      const r2 = d2Map[k]
      const r1 = d1Map[k]
      const base = r2 || r1
      if (!base?.products?.id) continue

      const d2Units = r2 ? Number(r2.predicted_units) : null
      const d1Units = r1 ? Number(r1.predicted_units) : null
      const delta   = d2Units != null && d1Units != null ? d1Units - d2Units : null
      const deltaPct = d2Units && delta != null ? (delta / d2Units) * 100 : null
      const largeRevision = deltaPct != null && Math.abs(deltaPct) >= 10

      comparisons.push({
        product_id:   base.products.id,
        product_name: base.products.name_ar,
        erp_code:     base.products.erp_code,
        yield_per_batch: Number(base.products.yield_per_batch || 14),
        branch_id:    base.branches?.id,
        branch_name:  base.branches?.name,
        branch_code:  base.branches?.code,
        week_start:   base.week_start,
        d2_units:     d2Units,
        d1_units:     d1Units,
        delta,
        delta_pct:    deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
        large_revision: largeRevision,
        d2_confidence: r2 ? Number(r2.confidence) : null,
        d1_confidence: r1 ? Number(r1.confidence) : null,
        d2_run_date:  r2?.run_date,
        d1_run_date:  r1?.run_date,
      })
    }

    // Available weeks for the selector
    const weekMap = {}
    for (const r of (weeksRes.data || [])) {
      if (!r.week_of) continue
      if (!weekMap[r.week_of]) weekMap[r.week_of] = { week_of: r.week_of, has_d2: false, has_d1: false }
      if (r.run_type === 'D-2') weekMap[r.week_of].has_d2 = true
      if (r.run_type === 'D-1') weekMap[r.week_of].has_d1 = true
    }

    return NextResponse.json({
      ok: true,
      comparisons,
      available_weeks: Object.values(weekMap).sort((a,b) => b.week_of.localeCompare(a.week_of)),
      has_d2: d2.length > 0,
      has_d1: d1.length > 0,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
