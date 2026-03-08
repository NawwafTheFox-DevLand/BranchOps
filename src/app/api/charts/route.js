import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'overview'

    if (type === 'monthly') {
      // Monthly revenue + cogs + profit over all time
      const { data, error } = await supabase
        .from('v_kpi_summary')
        .select('*')
        .order('month')
      if (error) throw error
      return NextResponse.json({ ok: true, data: data || [] })
    }

    if (type === 'by_product') {
      // Monthly units by product (top products)
      const { data, error } = await supabase
        .from('v_sales_monthly')
        .select('period_label, product_name, total_units, total_revenue, total_profit')
        .order('period_label')
      if (error) throw error
      return NextResponse.json({ ok: true, data: data || [] })
    }

    if (type === 'by_branch') {
      const { data, error } = await supabase
        .from('v_sales_monthly')
        .select('period_label, branch_code, branch_name, total_revenue, total_profit, total_units')
        .order('period_label')
      if (error) throw error
      return NextResponse.json({ ok: true, data: data || [] })
    }

    if (type === 'forecast_vs_actual') {
      // Latest forecasts with actuals for accuracy chart
      const { data, error } = await supabase
        .from('v_forecast_accuracy')
        .select('*')
        .not('actual_sold', 'is', null)
        .order('forecast_date', { ascending: false })
        .limit(500)
      if (error) throw error
      return NextResponse.json({ ok: true, data: data || [] })
    }

    // Default: overview KPIs
    const [monthly, products, branches, forecasts] = await Promise.all([
      supabase.from('v_kpi_summary').select('*').order('month').limit(36),
      supabase.from('v_sales_monthly').select('product_name, total_units, total_revenue').order('total_revenue', { ascending: false }).limit(200),
      supabase.from('v_sales_monthly').select('branch_code, branch_name, total_revenue, total_profit').order('total_revenue', { ascending: false }).limit(200),
      supabase.from('demand_forecasts').select('forecast_date, predicted_units, predicted_units_p80, actual_sold, source').order('forecast_date', { ascending: false }).limit(300),
    ])

    return NextResponse.json({
      ok: true,
      monthly:   monthly.data   || [],
      products:  products.data  || [],
      branches:  branches.data  || [],
      forecasts: forecasts.data || [],
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
