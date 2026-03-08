import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const service = createServiceRoleClient()
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null })

    if (!rows.length) return NextResponse.json({ ok: false, error: 'File is empty' }, { status: 400 })

    // Map columns
    const mapped = []
    const skipped = []

    for (const row of rows) {
      const date       = row['date']        || row['التاريخ']
      const branchCode = row['branch_code'] || row['كود الفرع']
      const branchName = row['branch_name'] || row['اسم الفرع']
      const erpCode    = row['erp_code']    || row['كود المنتج']
      const productName= row['product_name']|| row['اسم المنتج'] || row['البند']
      const qty        = row['quantity']    || row['الكمية']
      const unitPrice  = row['unit_price']  || row['سعر الوحدة']
      const revenue    = row['revenue_SAR'] || row['الإيراد']
      const cogs       = row['cogs_SAR']    || row['التكلفة']
      const gp         = row['gross_profit']|| (revenue && cogs ? revenue - cogs : null)

      if (!date || !branchCode || !erpCode || qty == null) {
        skipped.push({ reason: 'missing required field', row: JSON.stringify(row).slice(0, 80) })
        continue
      }

      mapped.push({
        sale_date:    String(date).slice(0, 10),
        branch_code:  String(branchCode).trim(),
        branch_name:  String(branchName || branchCode).trim(),
        erp_code:     String(erpCode).trim(),
        product_name: String(productName || erpCode).trim(),
        quantity:     Number(qty),
        unit_price:   Number(unitPrice || 0),
        revenue_sar:  Number(revenue || 0),
        cogs_sar:     Number(cogs || 0),
        gross_profit: Number(gp || 0),
      })
    }

    // Insert in chunks of 1000
    let inserted = 0
    const CHUNK = 1000
    for (let i = 0; i < mapped.length; i += CHUNK) {
      const { error } = await service.from('sales_daily').insert(mapped.slice(i, i + CHUNK))
      if (error) throw new Error(error.message)
      inserted += Math.min(CHUNK, mapped.length - i)
    }

    return NextResponse.json({ ok: true, inserted, skipped: skipped.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
