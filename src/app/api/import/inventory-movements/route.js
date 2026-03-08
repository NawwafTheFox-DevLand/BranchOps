import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import * as XLSX from 'xlsx'

function parseDate(v) {
  if (!v) return null
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return isNaN(d) ? null : d.toISOString()
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toISOString()
  return null
}

export async function POST(req) {
  try {
    await requireAdmin()
    const supabase = createClient()
    const fd = await req.formData()
    const file = fd.get('file')
    const fallback_branch_id = fd.get('branch_id') || null
    const fallback_branch_name = fd.get('branch_name') || null
    if (!file) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    let hi = 0
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      const r = raw[i]
      if (r.some(c => String(c||'').trim() === 'Transaction Type' || String(c||'').trim() === 'Type')) { hi = i; break }
    }
    const headers = raw[hi].map(h => String(h||'').trim())
    const col = k => headers.indexOf(k)

    // Accept both original and transformed column names
    const nameCol   = col('Name')
    const skuCol    = col('SKU')
    const branchCol = col('Branch')
    const typeCol   = col('Type')   >= 0 ? col('Type')   : col('Transaction Type')
    const refCol    = col('Reference') >= 0 ? col('Reference') : col('Transaction Reference')
    const qtyCol    = col('Quantity')
    const costCol   = col('Cost')
    const reasonCol = col('Reason')
    const dateCol   = col('Date')   >= 0 ? col('Date')   : col('Submitted At')

    const { data: branches } = await supabase.from('branches').select('id, code, name')
    const branchByName = {}
    for (const b of branches||[]) {
      branchByName[b.name?.toLowerCase()] = b.id
      branchByName[b.code?.toLowerCase()] = b.id
    }

    const { data: log } = await supabase.from('import_log')
      .insert({ import_type: 'inventory_movements', file_name: file.name, status: 'running' })
      .select('id').single()
    const batchId = log?.id

    const rows = []
    for (let i = hi + 1; i < raw.length; i++) {
      const row = raw[i]
      if (!row || row.every(v => v == null)) continue
      const name = String(row[nameCol]||'').trim()
      if (!name) continue
      const sku = String(row[skuCol]||'').trim().replace(/\.0+$/, '')

      const { data: prod } = await supabase.from('products')
        .select('id').or(`erp_code.eq.${sku},name_ar.ilike.${name}`).maybeSingle()

      const branchRaw = String(row[branchCol]||'').trim()
      const branchId  = branchByName[branchRaw.toLowerCase()] || fallback_branch_id
      const resolvedBranchName = branchRaw || fallback_branch_name

      rows.push({
        product_id:            prod?.id || null,
        product_name:          name,
        erp_code:              sku || null,
        branch_id:             branchId,
        branch_name:           resolvedBranchName || null,
        transaction_type:      typeCol   >= 0 ? String(row[typeCol]  ||'').trim()||null : null,
        transaction_reference: refCol    >= 0 ? String(row[refCol]   ||'').trim()||null : null,
        quantity:              qtyCol    >= 0 ? Number(row[qtyCol]||0) : 0,
        cost:                  costCol   >= 0 && row[costCol] != null ? Number(row[costCol]) : null,
        reason:                reasonCol >= 0 ? String(row[reasonCol]||'').trim()||null : null,
        submitted_at:          dateCol   >= 0 ? parseDate(row[dateCol]) : null,
        import_batch:          batchId,
      })
    }

    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase.from('inventory_movements').insert(rows.slice(i, i + CHUNK))
      if (error) throw error
    }

    await supabase.from('import_log').update({ status: 'done', row_count: rows.length }).eq('id', batchId)
    return NextResponse.json({ ok: true, inserted: rows.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
