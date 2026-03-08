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
    const snapshot_date = fd.get('snapshot_date') || new Date().toISOString().slice(0,10)
    if (!file) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    let hi = 0
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      if (raw[i].some(c => String(c||'').trim() === 'Name') && raw[i].some(c => String(c||'').trim() === 'SKU')) { hi = i; break }
    }
    const headers = raw[hi].map(h => String(h||'').trim())
    const col = k => headers.indexOf(k)

    const cpuCol   = col('Cost Per Unit') >= 0 ? col('Cost Per Unit') : col('Cost Per Unit')
    const totalCol = col('Total Cost')

    const { data: log } = await supabase.from('import_log')
      .insert({ import_type: 'inventory_levels', file_name: file.name, status: 'running' })
      .select('id').single()
    const batchId = log?.id

    const rows = []
    for (let i = hi + 1; i < raw.length; i++) {
      const row = raw[i]
      if (!row || row.every(v => v == null)) continue
      const name = String(row[col('Name')]||'').trim()
      const sku  = String(row[col('SKU')]||'').trim().replace(/\.0+$/, '')
      if (!name) continue

      const { data: prod } = await supabase.from('products')
        .select('id').or(`erp_code.eq.${sku},name_ar.ilike.${name}`).maybeSingle()

      rows.push({
        snapshot_date,
        product_id:    prod?.id || null,
        product_name:  name,
        erp_code:      sku || null,
        barcode:       String(row[col('Barcode')]||'').trim()||null,
        storage_unit:  String(row[col('Storage Unit')]||'').trim()||null,
        quantity:      Number(row[col('Quantity')]||0),
        cost_per_unit: cpuCol   >= 0 && row[cpuCol]   != null ? Number(row[cpuCol])   : null,
        total_cost:    totalCol >= 0 && row[totalCol]  != null ? Number(row[totalCol]) : null,
        import_batch:  batchId,
      })
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('inventory_levels').insert(rows)
      if (error) throw error
    }

    await supabase.from('import_log').update({ status: 'done', row_count: rows.length }).eq('id', batchId)
    return NextResponse.json({ ok: true, inserted: rows.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
