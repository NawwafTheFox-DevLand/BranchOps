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

    // Fetch latest forecasts — no date filter so we always show something
    let q = supabase.from('weekly_forecasts')
      .select(`id, week_start, week_label, predicted_units, predicted_lo80, predicted_hi80,
               predicted_lo95, predicted_hi95, recommended_batches, safety_factor,
               model_type, confidence, actual_units,
               products(id, name_ar, erp_code, yield_per_batch),
               branches(id, code, name)`)
      .order('week_start', { ascending: true })
      .order('product_id')
      .limit(2000)

    if (branchId)  q = q.eq('branch_id', branchId)
    if (productId) q = q.eq('product_id', productId)

    const { data: forecasts, error } = await q
    if (error) throw error

    // Fetch model accuracy summary
    let mq = supabase.from('forecast_models')
      .select('product_id, branch_id, model_type, mape, mae, aic, selected_vars, var_aic_scores, trained_at')
      .eq('is_active', true)
      .order('trained_at', { ascending: false })

    if (branchId)  mq = mq.eq('branch_id', branchId)
    if (productId) mq = mq.eq('product_id', productId)

    const { data: models } = await mq

    return NextResponse.json({
      ok: true,
      forecasts: forecasts || [],
      models: models || [],
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
