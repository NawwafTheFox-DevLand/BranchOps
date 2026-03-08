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
    const fallback_branch_name = fd.get('branch_name') || null
    const period_start = fd.get('period_start') || null
    const period_end   = fd.get('period_end')   || null
    if (!file) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    let pStart = period_start, pEnd = period_end
    if (!pStart) {
      for (let i = 0; i < 5; i++) {
        const cell = String(raw[i]?.[1]||'')
        const m = cell.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/)
        if (m) { pStart = m[1]; pEnd = m[2]; break }
      }
    }

    let hi = 0
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      const r = raw[i]
      if (r.some(c => String(c||'').trim() === 'Opening Quantity' || String(c||'').trim() === 'Opening Qty')) { hi = i; break }
    }
    const headers = raw[hi].map(h => String(h||'').trim())
    const col = k => headers.indexOf(k)
    const n = (row, ...keys) => { for (const k of keys) { const i = col(k); if (i>=0 && row[i]!=null) return Number(row[i]) } return 0 }

    const { data: branches } = await supabase.from('branches').select('id, code, name')
    const branchByName = {}
    for (const b of branches||[]) {
      branchByName[b.name?.toLowerCase()] = b.id
      branchByName[b.code?.toLowerCase()] = b.id
    }

    const { data: log } = await supabase.from('import_log')
      .insert({ import_type: 'stock_movement_summary', file_name: file.name, status: 'running', period_label: pStart ? `${pStart} to ${pEnd}` : null })
      .select('id').single()
    const batchId = log?.id

    const rows = []
    for (let i = hi + 1; i < raw.length; i++) {
      const row = raw[i]
      if (!row || row.every(v => v == null)) continue
      const name = String(row[col('Name')]||'').trim()
      if (!name) continue
      const sku = String(row[col('SKU')]||'').trim().replace(/\.0+$/, '')

      const { data: prod } = await supabase.from('products')
        .select('id').or(`erp_code.eq.${sku},name_ar.ilike.${name}`).maybeSingle()

      const branchRaw = String(row[col('Branch')]||'').trim()
      const branchId  = branchByName[branchRaw.toLowerCase()] || fallback_branch_id
      const resolvedBranchName = branchRaw || fallback_branch_name

      rows.push({
        period_start:                pStart,
        period_end:                  pEnd,
        product_id:                  prod?.id || null,
        product_name:                name,
        erp_code:                    sku || null,
        storage_unit:                String(row[col('Storage Unit')]||'').trim()||null,
        branch_id:                   branchId,
        branch_name:                 resolvedBranchName || null,
        opening_qty:                 n(row,'Opening Quantity','Opening Qty'),
        opening_cost:                n(row,'Opening Cost'),
        purchasing_qty:              n(row,'Purchasing Quantity','Purchasing Qty'),
        purchasing_cost:             n(row,'Purchasing Cost'),
        transfer_in_qty:             n(row,'Transfer Receiving Quantity','Transfer In Qty'),
        transfer_in_cost:            n(row,'Transfer Receiving Cost'),
        production_qty:              n(row,'Production Quantity','Production Qty'),
        production_cost:             n(row,'Production Cost'),
        return_from_order_qty:       n(row,'Return From Order Quantity'),
        return_from_order_cost:      n(row,'Return From Order Cost'),
        total_in_qty:                n(row,'Total in Quantity','Total In Qty'),
        total_in_cost:               n(row,'Total in Cost'),
        return_to_supplier_qty:      n(row,'Return to Supplier Quantity'),
        return_to_supplier_cost:     n(row,'Return to Supplier Cost'),
        transfer_out_qty:            n(row,'Transfer Sending Quantity'),
        transfer_out_cost:           n(row,'Transfer Sending Cost'),
        consumption_production_qty:  n(row,'Consumption From Production Quantity'),
        consumption_production_cost: n(row,'Consumption From Production Cost'),
        production_waste_qty:        n(row,'Production Waste Quantity','Waste Qty'),
        production_waste_cost:       n(row,'Production Waste Cost'),
        consumption_order_qty:       n(row,'Consumption From Order Quantity'),
        consumption_order_cost:      n(row,'Consumption From Order Cost'),
        waste_order_qty:             n(row,'Waste From Order Quantity'),
        waste_order_cost:            n(row,'Waste From Order Cost'),
        adjustment_qty:              n(row,'Adjustment Quantity'),
        adjustment_cost:             n(row,'Adjustment Cost'),
        total_out_qty:               n(row,'Total Out Quantity'),
        total_out_cost:              n(row,'Total Out Cost'),
        count_variance_qty:          n(row,'Count Variance Quantity'),
        count_variance_cost:         n(row,'Count Variance Cost'),
        closing_qty:                 n(row,'Closing Quantity','Closing Qty'),
        closing_cost:                n(row,'Closing Cost'),
        import_batch:                batchId,
      })
    }

    const CHUNK = 200
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase.from('stock_movement_summary').insert(rows.slice(i, i + CHUNK))
      if (error) throw error
    }

    await supabase.from('import_log').update({ status: 'done', row_count: rows.length }).eq('id', batchId)
    return NextResponse.json({ ok: true, inserted: rows.length, period: `${pStart} → ${pEnd}` })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
