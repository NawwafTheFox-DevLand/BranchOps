import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import crypto from 'crypto'
import { z } from 'zod'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const AdminGuardError = class extends Error {
  constructor(msg, status) {
    super(msg)
    this.status = status
  }
}

async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AdminGuardError('Unauthorized', 401)

  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (error) throw new AdminGuardError(error.message, 400)
  if (profile?.role !== 'admin') throw new AdminGuardError('Forbidden', 403)

  return { user }
}

function numOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

export async function POST(req) {
  try {
    await requireAdmin()

    const form = await req.formData()
    const file = form.get('file')
    const period_label_form = (form.get('period_label') ?? '').toString().trim()

    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const sheetName = wb.SheetNames?.[0]
    if (!sheetName) return NextResponse.json({ error: 'No worksheet found' }, { status: 400 })

    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true })

    const firstRow = rows[0] || {}
    const keys = Object.keys(firstRow)
    const isERP = keys.includes('Product') && keys.includes('Quantity')
    const isSim = keys.includes('product_name_raw') && keys.includes('total_quantity')

    if (!isERP && !isSim) {
      return NextResponse.json({
        error: 'Unexpected columns. Expected ERP format (Product, Sales, Quantity) or simulation format (product_name_raw, total_quantity).',
        detected: keys,
      }, { status: 400 })
    }

    const cleaned = rows
      .map((r) => {
        const name = isSim
          ? (r['product_name_raw'] ? String(r['product_name_raw']).trim() : null)
          : (r['Product'] ? String(r['Product']).trim() : null)
        return {
          product_name_raw: name,
          total_sales_sar:  isSim ? numOrNull(r['total_revenue']) : numOrNull(r['Sales']),
          total_quantity:   numOrNull(r['total_quantity'] ?? r['Quantity']),
          total_cost:       numOrNull(r['Total Cost']),
          item_profit:      numOrNull(r['Item Profit']),
          total_profit:     numOrNull(r['Total Profit']),
          profit_pct:       numOrNull(r['(نسبة الربح %)'] ?? r['نسبة الربح %'] ?? r['نسبة الربح%']),
          popularity_score: numOrNull(r['Popularity']),
          profit_category:  r['Profit Category'] ? String(r['Profit Category']).trim() : null,
          popularity_category: r['Popularity Category'] ? String(r['Popularity Category']).trim() : null,
          class: r['Class'] ? String(r['Class']).trim() : null,
          _erp_code: isSim ? (r['erp_code'] ? String(r['erp_code']) : null) : null,
          _period_label: isSim ? (r['period_label'] ? String(r['period_label']).trim() : null) : null,
        }
      })
      .filter((r) => r.product_name_raw)

    const import_id = crypto.randomUUID()
    const service = createServiceRoleClient()

    await service.from('import_log').insert({
      id: import_id,
      import_type: 'sales_summary',
      file_name: file.name || 'Sales.xlsx',
      period_label: (isSim && r._period_label) ? r._period_label : period_label_form,
      row_count: cleaned.length,
      status: 'running',
    })

    // Attempt exact match by Arabic name
    const names = Array.from(new Set(cleaned.map((r) => r.product_name_raw))).slice(0, 5000)
    const { data: prodRows, error: prodErr } = await service
      .from('products')
      .select('id, name_ar')
      .in('name_ar', names)

    if (prodErr) throw new Error(prodErr.message)

    const idByName = new Map((prodRows || []).map((p) => [p.name_ar, p.id]))

    const inserts = cleaned.map((r) => ({
      product_id: idByName.get(r.product_name_raw) || null,
      product_name_raw: r.product_name_raw,
      period_label: (isSim && r._period_label) ? r._period_label : period_label_form,
      total_sales_sar: r.total_sales_sar,
      total_quantity: r.total_quantity,
      total_cost: r.total_cost,
      item_profit: r.item_profit,
      total_profit: r.total_profit,
      profit_pct: r.profit_pct,
      popularity_score: r.popularity_score,
      profit_category: r.profit_category,
      popularity_category: r.popularity_category,
      class: r.class,
      import_batch: import_id,
    }))

    const chunkSize = 500
    let inserted = 0

    for (let i = 0; i < inserts.length; i += chunkSize) {
      const chunk = inserts.slice(i, i + chunkSize)
      const { error } = await service.from('sales_summary').insert(chunk)
      if (error) throw new Error(error.message)
      inserted += chunk.length
    }

    const matched = inserts.filter((r) => r.product_id).length
    await service.from('import_log').update({ status: 'done', error_count: 0 }).eq('id', import_id)

    return NextResponse.json({
      ok: true,
      import_id,
      period_label: (isSim && r._period_label) ? r._period_label : period_label_form,
      rows_detected: rows.length,
      rows_imported: inserted,
      matched_products: matched,
      unmatched_products: inserted - matched,
    })
  } catch (e) {
    const status = e?.status || 400
    return NextResponse.json({ ok: false, error: e?.message || 'Import failed' }, { status })
  }
}
