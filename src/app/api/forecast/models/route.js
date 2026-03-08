import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: models } = await supabase.from('forecast_models')
      .select(`id, model_type, is_active, mape, mae, rmse, aic,
               selected_vars, var_aic_scores, trained_on_weeks,
               training_start, training_end, trained_at, notes,
               products(id, name_ar, erp_code),
               branches(id, code, name)`)
      .eq('is_active', true)
      .order('mape', { ascending: true })

    // Group by product for summary
    const summary = {}
    for (const m of (models || [])) {
      const pid = m.products?.id
      if (!pid) continue
      if (!summary[pid]) summary[pid] = { product: m.products, models: [] }
      summary[pid].models.push(m)
    }

    return NextResponse.json({ ok: true, models: models || [], summary: Object.values(summary) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
