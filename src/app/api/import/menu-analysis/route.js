import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function POST(req) {
  try {
    await requireAdmin()
    const supabase = createClient()
    const fd = await req.formData()
    const file = fd.get('file')
    const fallback_branch_id = fd.get('branch_id') || null
    const period_label = fd.get('period_label') || null
    if (!file) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    // Find header row
    let hi = 0
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      if (raw[i].some(c => String(c||'').trim() === 'Product') && raw[i].some(c => String(c||'').trim() === 'Class')) { hi = i; break }
    }
    const headers = raw[hi].map(h => String(h||'').trim())
    const col = k => headers.indexOf(k)

    const { data: log } = await supabase.from('import_log')
      .insert({ import_type: 'menu_analysis', file_name: file.name, status: 'running', period_label })
      .select('id').single()
    const batchId = log?.id

    const rows = []
    let skipped = 0
    for (let i = hi + 1; i < raw.length; i++) {
      const row = raw[i]
      if (!row || row.every(v => v == null || v === '')) continue
      const product = String(row[col('Product')]||'').trim()
      if (!product) { skipped++; continue }

      // Try to match product
      const { data: prod } = await supabase.from('products')
        .select('id').ilike('name_ar', product).maybeSingle()

      rows.push({
        product_id:           prod?.id || null,
        product_name_raw:         product,
        period_label,
        total_sales_sar:                row[col('Sales')]        != null ? Number(row[col('Sales')])        : null,
        total_quantity:             row[col('Quantity')]     != null ? Number(row[col('Quantity')])     : null,
        total_cost:           row[col('Total Cost')]   != null ? Number(row[col('Total Cost')])   : null,
        item_profit:          row[col('Item Profit')]  != null ? Number(row[col('Item Profit')])  : null,
        total_profit:         row[col('Total Profit')] != null ? Number(row[col('Total Profit')]) : null,
        profit_pct:           row[col('(نسبة الربح %)')] != null ? Number(row[col('(نسبة الربح %)')]) : null,
        popularity_score:     row[col('Popularity')]   != null ? Number(row[col('Popularity')])   : null,
        profit_category:      String(row[col('Profit Category')]||'').trim()      || null,
        popularity_category:  String(row[col('Popularity Category')]||'').trim()  || null,
        class:                String(row[col('Class')]||'').trim()                || null,
        import_batch:         batchId,
      })
    }

    if (rows.length > 0) {
      const CHUNK = 200
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from('sales_summary').insert(rows.slice(i, i + CHUNK))
        if (error) throw error
      }
    }

    await supabase.from('import_log').update({ status: 'done', row_count: rows.length }).eq('id', batchId)
    return NextResponse.json({ ok: true, inserted: rows.length, skipped, period: period_label })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
