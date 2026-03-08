import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SLOT_WEIGHTS = [0.03, 0.07, 0.11, 0.17, 0.22, 0.11, 0.08, 0.14, 0.07]

function getDayType(dateStr) {
  const d = new Date(dateStr + 'T12:00:00+03:00')
  const dow = d.getDay()
  if (dow === 4) return 'thu'
  if (dow === 5) return 'fri'
  return 'weekday'
}

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw Object.assign(new Error('Forbidden'), { status: 403 })
  return user
}

export async function POST(req) {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const body = await req.json().catch(() => ({}))
    const targetDate = body.date || new Date().toISOString().slice(0, 10)
    const dayType = getDayType(targetDate)

    const [branchesRes, productsRes, slotsRes] = await Promise.all([
      service.from('branches').select('id, code, name').eq('is_active', true).eq('is_warehouse', false),
      service.from('products').select('id, erp_code, name_ar, is_batch_cooked, yield_per_batch, batch_size_kg').eq('is_active', true),
      service.from('time_slots').select('id, label, start_hour').eq('is_active', true).order('start_hour'),
    ])

    const branches      = branchesRes.data || []
    const allProducts   = productsRes.data || []
    const batchProducts = allProducts.filter(p => p.is_batch_cooked)
    const slots         = slotsRes.data || []

    if (batchProducts.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No batch-cooked products found. Run phase2b SQL first.',
        debug: {
          total_products: allProducts.length,
          sample: allProducts.slice(0, 5).map(p => ({ erp: p.erp_code, name: p.name_ar, batch: p.is_batch_cooked }))
        }
      })
    }

    // Build erp_code -> product lookup
    const productByErp = Object.fromEntries(batchProducts.map(p => [p.erp_code, p]))

    // Load sales_summary - try matching product_id, then name_ar
    const { data: salesRows } = await service
      .from('sales_summary')
      .select('product_id, product_name_raw, total_quantity, period_label')
      .not('total_quantity', 'is', null)

    const salesByProductId = {}
    const periodsByProductId = {}

    for (const row of (salesRows || [])) {
      let pid = row.product_id
      if (!pid && row.product_name_raw) {
        const match = batchProducts.find(p => p.name_ar?.trim() === row.product_name_raw?.trim())
        if (match) pid = match.id
      }
      if (!pid || !row.total_quantity) continue
      salesByProductId[pid]   = (salesByProductId[pid]   || 0) + Number(row.total_quantity)
      periodsByProductId[pid] = (periodsByProductId[pid] || 0) + 1
    }

    // Fallback: use sales_daily if sales_summary matched nothing
    let usingSalesDaily = false
    if (Object.keys(salesByProductId).length === 0) {
      const { data: dailyRows } = await service
        .from('sales_daily').select('erp_code, quantity').limit(200000)

      if (dailyRows && dailyRows.length > 0) {
        usingSalesDaily = true
        const byErp = {}
        for (const r of dailyRows) {
          byErp[r.erp_code] = (byErp[r.erp_code] || 0) + Number(r.quantity || 0)
        }
        for (const [erp, total] of Object.entries(byErp)) {
          const prod = productByErp[erp]
          if (!prod) continue
          salesByProductId[prod.id]   = total
          periodsByProductId[prod.id] = 36
        }
      }
    }

    // Load observed batches
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const { data: batches } = await service
      .from('production_batches')
      .select('branch_id, product_id, slot_id, cooked_at, produced_qty, batch_qty')
      .gte('cooked_at', thirtyDaysAgo + 'T00:00:00+03:00')

    const obs = {}
    for (const b of (batches || [])) {
      const prod = batchProducts.find(p => p.id === b.product_id)
      if (!prod) continue
      const produced = b.produced_qty != null ? Number(b.produced_qty)
        : b.batch_qty && prod.yield_per_batch
          ? (Number(b.batch_qty) / (prod.batch_size_kg || 1)) * prod.yield_per_batch : 0
      if (!produced) continue
      const slotLabel = slots.find(s => s.id === b.slot_id)?.label || 'unknown'
      const dateKey = b.cooked_at.slice(0, 10)
      obs[b.branch_id] ??= {}
      obs[b.branch_id][b.product_id] ??= {}
      obs[b.branch_id][b.product_id][slotLabel] ??= {}
      obs[b.branch_id][b.product_id][slotLabel][dateKey] =
        (obs[b.branch_id][b.product_id][slotLabel][dateKey] || 0) + produced
    }

    const { data: runData, error: runErr } = await service
      .from('forecast_runs')
      .insert({
        run_for_date: targetDate, day_type: dayType,
        source: (batches || []).length > 50 ? 'mixed' : 'bootstrap',
        branches_covered: branches.length, products_covered: batchProducts.length,
        notes: `${batchProducts.length} products · ${Object.keys(salesByProductId).length} with sales · via ${usingSalesDaily ? 'sales_daily' : 'sales_summary'}`,
      })
      .select('id').single()

    if (runErr) throw new Error(runErr.message)
    const runId = runData.id

    const forecastRows = []
    for (const branch of branches) {
      for (const product of batchProducts) {
        const yieldPerBatch = Number(product.yield_per_batch || 14)
        const batchSizeKg   = Number(product.batch_size_kg || 1)
        const branchProductObs = obs[branch.id]?.[product.id]
        const hasObserved = branchProductObs &&
          Object.values(branchProductObs).some(dates => Object.keys(dates).length >= 3)
        const totalSales = salesByProductId[product.id]

        for (let si = 0; si < slots.length; si++) {
          const slot   = slots[si]
          const weight = SLOT_WEIGHTS[si] ?? (1 / slots.length)
          let predictedUnits, source, confidence, obsDays = 0

          if (hasObserved && branchProductObs[slot.label]) {
            const vals = Object.values(branchProductObs[slot.label])
            obsDays = vals.length
            predictedUnits = vals.reduce((a, b) => a + b, 0) / obsDays
            source = 'observed'
            confidence = Math.min(0.95, 0.4 + obsDays * 0.02)
          } else if (totalSales) {
            const periods = periodsByProductId[product.id] || 1
            const avgDailyPerBranch = usingSalesDaily
              ? totalSales / (1095 * branches.length)
              : totalSales / (periods * 26 * branches.length)
            predictedUnits = avgDailyPerBranch * weight
            source = 'bootstrap'
            confidence = 0.35
          } else {
            continue
          }

          if (!predictedUnits || predictedUnits <= 0) continue
          const p80 = predictedUnits * 1.21

          forecastRows.push({
            run_id: runId, branch_id: branch.id, product_id: product.id,
            slot_id: slot.id, forecast_date: targetDate, day_type: dayType,
            predicted_units:     Math.round(predictedUnits * 10) / 10,
            predicted_units_p80: Math.round(p80 * 10) / 10,
            predicted_units_p90: Math.round(predictedUnits * 1.38 * 10) / 10,
            recommended_batches: Math.max(1, Math.ceil(p80 / yieldPerBatch)),
            batch_size_kg: batchSizeKg, source, confidence, obs_days: obsDays,
          })
        }
      }
    }

    let inserted = 0
    for (let i = 0; i < forecastRows.length; i += 500) {
      const { error } = await service.from('demand_forecasts').insert(forecastRows.slice(i, i + 500))
      if (error) throw new Error(error.message)
      inserted += Math.min(500, forecastRows.length - i)
    }

    return NextResponse.json({
      ok: true, run_id: runId, forecast_date: targetDate, day_type: dayType,
      rows_generated: inserted,
      debug: {
        branches: branches.length, batch_products: batchProducts.length,
        slots: slots.length, products_with_sales: Object.keys(salesByProductId).length,
        sales_source: usingSalesDaily ? 'sales_daily' : 'sales_summary',
        sample_sales: Object.entries(salesByProductId).slice(0, 3).map(([id, v]) => ({ id, total: v })),
      }
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Forecast failed' }, { status: e?.status || 500 })
  }
}

export async function GET(req) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const { data: run } = await supabase.from('forecast_runs').select('*')
      .eq('run_for_date', date).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!run) return NextResponse.json({ run: null, forecasts: [] })
    const { data: forecasts } = await supabase.from('demand_forecasts')
      .select(`id,branch_id,product_id,slot_id,forecast_date,day_type,
        predicted_units,predicted_units_p80,predicted_units_p90,
        recommended_batches,batch_size_kg,source,confidence,obs_days,
        actual_produced,actual_wasted,actual_stockouts,actual_sold,
        branches(code,name),products(name_ar,erp_code),time_slots(label,start_hour)`)
      .eq('run_id', run.id).order('branch_id')
    return NextResponse.json({ run, forecasts: forecasts || [] })
  } catch (e) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
