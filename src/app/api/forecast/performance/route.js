import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const branchId  = searchParams.get('branch_id')  || null
    const productId = searchParams.get('product_id') || null

    // Get forecast models with accuracy metrics
    let mq = supabase.from('forecast_models')
      .select(`product_id, branch_id, model_type, mape, mae, aic,
               trained_at, trained_on_weeks, notes,
               products(id, name_ar, erp_code, yield_per_batch),
               branches(id, code, name)`)
      .eq('is_active', true)
      .order('trained_at', { ascending: false })
    if (branchId)  mq = mq.eq('branch_id', branchId)
    if (productId) mq = mq.eq('product_id', productId)
    const { data: models } = await mq

    // Get weekly forecasts with actuals for trend
    let fq = supabase.from('weekly_forecasts')
      .select(`week_start, product_id, branch_id,
               predicted_units, actual_units, model_type, confidence,
               products(id, name_ar, erp_code),
               branches(id, code, name)`)
      .not('actual_units', 'is', null)
      .order('week_start', { ascending: true })
      .limit(2000)
    if (branchId)  fq = fq.eq('branch_id', branchId)
    if (productId) fq = fq.eq('product_id', productId)
    const { data: actuals } = await fq

    // Also get forecast_actuals table
    let aq = supabase.from('forecast_actuals')
      .select(`week_start, product_id, branch_id, actual_units,
               products(id, name_ar, erp_code),
               branches(id, code, name)`)
      .order('week_start', { ascending: true })
      .limit(2000)
    if (branchId)  aq = aq.eq('branch_id', branchId)
    if (productId) aq = aq.eq('product_id', productId)
    const { data: forecastActuals } = await aq

    // Build performance per product×branch
    const key = r => `${r.product_id}__${r.branch_id}`
    const modelMap = {}
    for (const m of (models || [])) {
      const k = key(m)
      if (!modelMap[k]) modelMap[k] = m
    }

    // Build weekly series for each product×branch
    const seriesMap = {}
    for (const f of (actuals || [])) {
      const k = key(f)
      if (!seriesMap[k]) seriesMap[k] = { product: f.products, branch: f.branches, weeks: [] }
      const pred = Number(f.predicted_units)
      const act  = Number(f.actual_units)
      const err  = pred > 0 ? Math.abs(pred - act) / pred * 100 : null
      seriesMap[k].weeks.push({
        week_start: f.week_start,
        predicted: pred,
        actual: act,
        error_pct: err ? Math.round(err * 10) / 10 : null,
        bias: pred - act, // positive = over-predicted, negative = under-predicted
      })
    }

    const performance = Object.entries(seriesMap).map(([k, s]) => {
      const m    = modelMap[k]
      const mape = m?.mape != null ? Number(m.mape) : null
      const weeks = s.weeks
      const errors = weeks.map(w => w.error_pct).filter(v => v != null)
      const biases = weeks.map(w => w.bias).filter(v => v != null)
      const avgBias = biases.length ? biases.reduce((a,b)=>a+b,0)/biases.length : null
      const trend = errors.length >= 4
        ? (errors.slice(-2).reduce((a,b)=>a+b,0)/2) - (errors.slice(0,2).reduce((a,b)=>a+b,0)/2)
        : null

      const trust = mape == null ? 'unknown'
        : mape < 15 ? 'high'
        : mape < 30 ? 'medium'
        : 'low'

      // Purchase recommendation
      const biasDir = avgBias == null ? 'neutral'
        : avgBias > 5 ? 'over'   // consistently over-predicting → order less
        : avgBias < -5 ? 'under' // consistently under-predicting → order more
        : 'neutral'

      const recommendation =
        biasDir === 'over'  ? 'Model over-predicts — consider Minimize Waste strategy' :
        biasDir === 'under' ? 'Model under-predicts — consider Meet Demand strategy' :
        trust === 'low'     ? 'Low confidence — cross-check with recent sales before ordering' :
        'Model performing well — Balanced strategy recommended'

      return {
        product_id:   s.product?.id,
        product_name: s.product?.name_ar,
        erp_code:     s.product?.erp_code,
        branch_id:    s.branch?.id,
        branch_name:  s.branch?.name,
        branch_code:  s.branch?.code,
        model_type:   m?.model_type,
        mape,
        mae:          m?.mae != null ? Number(m.mae) : null,
        trained_at:   m?.trained_at,
        trust,
        avg_bias:     avgBias ? Math.round(avgBias * 10) / 10 : null,
        bias_dir:     biasDir,
        accuracy_trend: trend ? Math.round(trend * 10) / 10 : null,
        recommendation,
        weeks,
        best_week:    weeks.reduce((b,w) => w.error_pct != null && (b == null || w.error_pct < b.error_pct) ? w : b, null),
        worst_week:   weeks.reduce((b,w) => w.error_pct != null && (b == null || w.error_pct > b.error_pct) ? w : b, null),
      }
    })

    return NextResponse.json({ ok: true, performance, total: performance.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
