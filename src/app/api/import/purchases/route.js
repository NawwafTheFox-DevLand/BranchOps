import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import crypto from 'crypto'
import { z } from 'zod'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function normalizeErpCode(v) {
  if (v == null) return null
  // Handles numbers like 94 or 94.0, and strings with whitespace.
  if (typeof v === 'number') {
    if (Number.isFinite(v)) {
      const asInt = Math.trunc(v)
      return Math.abs(v - asInt) < 1e-9 ? String(asInt) : String(v)
    }
    return null
  }

  const s = String(v).trim()
  if (!s) return null

  // If it's like "94.0" → "94"
  const m = s.match(/^(-?\d+)(?:\.0+)?$/)
  if (m) return m[1]

  return s
}

function parseDate(value) {
  if (!value) return null

  // Date object
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  // Excel serial number
  if (typeof value === 'number' && isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value)
    if (d) {
      const js = new Date(Date.UTC(d.y, d.m - 1, d.d))
      return js.toISOString().slice(0, 10)
    }
  }

  const s = String(value).trim()
  if (!s) return null

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // dd/mm/yyyy or d/m/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const dd = Number(m[1])
    const mm = Number(m[2])
    const yy = Number(m[3])
    const js = new Date(Date.UTC(yy, mm - 1, dd))
    if (!isNaN(js.getTime())) return js.toISOString().slice(0, 10)
  }

  return null
}

function parseInvoice(invoiceRaw) {
  const raw = (invoiceRaw ?? '').toString().trim()
  const isReturn = raw.includes('مرتجع')
  const invoice_type = isReturn ? 'return' : 'purchase'
  const m = raw.match(/#\s*([0-9]+)/)
  const invoice_number = m ? m[1] : null
  return { invoice_type, invoice_number, invoice_raw: raw }
}

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

export async function POST(req) {
  try {
    await requireAdmin()

    const form = await req.formData()
    const file = form.get('file')
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const fallback_branch_id = fd.get('branch_id') || null
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const sheetName = wb.SheetNames?.[0]
    if (!sheetName) return NextResponse.json({ error: 'No worksheet found' }, { status: 400 })

    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true })

    // Basic column validation (Arabic export)
    const requiredCols = ['البند', 'كود المنتج', 'التاريخ', 'النوع', 'الكمية']
    const hasCols = requiredCols.every((c) => Object.prototype.hasOwnProperty.call(rows[0] || {}, c))
    if (!hasCols) {
      return NextResponse.json({
        error: `Unexpected columns. Expected Arabic Purchases export with columns: ${requiredCols.join(', ')}`,
        detected: Object.keys(rows[0] || {}),
      }, { status: 400 })
    }

    // Clean merged/blank rows
    const cleaned = rows
      .map((r) => ({
        item_name_ar: r['البند'],
        erp_code: normalizeErpCode(r['كود المنتج']),
        purchased_at: parseDate(r['التاريخ']),
        invoice_raw: r['النوع'],
        employee: r['موظف'],
        supplier: r['المورد'],
        unit_cost: r['سعر الوحدة'],
        tax_total: r['إجمالي الضرائب'],
        quantity: r['الكمية'],
        total_sar: r['الإجمالي (SAR)'],
      }))
      .filter((r) => {
        // Drop rows that look like merged duplicates: no item name and no code and no date.
        const hasKey = !!(r.item_name_ar || r.erp_code || r.purchased_at)
        return hasKey
      })
      .filter((r) => r.erp_code) // must have code to import

    const import_id = crypto.randomUUID()
    const service = createServiceRoleClient()

    // Create import log
    await service.from('import_log').insert({
      id: import_id,
      import_type: 'purchases',
      file_name: file.name || 'Purchases.xlsx',
      row_count: cleaned.length,
      status: 'running',
    })

    // Upsert products by ERP code
    const productUpserts = []
    const seen = new Set()
    for (const r of cleaned) {
      const code = r.erp_code
      if (!code || seen.has(code)) continue
      seen.add(code)
      productUpserts.push({
        erp_code: code,
        name_ar: (r.item_name_ar ?? '').toString().trim() || code,
        is_active: true,
      })
    }

    if (productUpserts.length > 0) {
      const { error: upsertErr } = await service
        .from('products')
        .upsert(productUpserts, { onConflict: 'erp_code', ignoreDuplicates: false })
      if (upsertErr) throw new Error(upsertErr.message)
    }

    // Load product IDs for mapping
    const codes = Array.from(seen)
    const { data: prodRows, error: prodErr } = await service.from('products').select('id, erp_code').in('erp_code', codes)
    if (prodErr) throw new Error(prodErr.message)

    const prodIdByCode = new Map((prodRows || []).map((p) => [p.erp_code, p.id]))

    // Prepare inserts
    const inserts = []
    let skipped = 0
    let signFixed = 0

    for (const r of cleaned) {
      const product_id = prodIdByCode.get(r.erp_code)
      if (!product_id) {
        skipped += 1
        continue
      }

      const date = r.purchased_at
      if (!date) {
        skipped += 1
        continue
      }

      const { invoice_type, invoice_number, invoice_raw } = parseInvoice(r.invoice_raw)

      let qty = Number(r.quantity)
      if (!isFinite(qty) || qty === 0) {
        skipped += 1
        continue
      }

      if (invoice_type === 'return' && qty > 0) {
        qty = -Math.abs(qty)
        signFixed += 1
      }
      if (invoice_type === 'purchase' && qty < 0) {
        qty = Math.abs(qty)
        signFixed += 1
      }

      inserts.push({
        product_id,
        erp_code: r.erp_code,
        item_name_ar: r.item_name_ar ? String(r.item_name_ar).trim() : null,
        purchased_at: date,
        invoice_type,
        invoice_number,
        invoice_raw,
        quantity: qty,
        unit_cost: r.unit_cost != null ? Number(r.unit_cost) : null,
        tax_total: r.tax_total != null ? Number(r.tax_total) : null,
        total_sar: r.total_sar != null ? Number(r.total_sar) : null,
        employee: r.employee ? String(r.employee).trim() : null,
        supplier: r.supplier ? String(r.supplier).trim() : null,
        import_batch: import_id,
      })
    }

    // Insert in chunks
    const chunkSize = 500
    let inserted = 0

    for (let i = 0; i < inserts.length; i += chunkSize) {
      const chunk = inserts.slice(i, i + chunkSize)
      const { error } = await service.from('purchases').insert(chunk)
      if (error) throw new Error(error.message)
      inserted += chunk.length
    }

    await service.from('import_log').update({ status: 'done', error_count: 0 }).eq('id', import_id)

    return NextResponse.json({
      ok: true,
      import_id,
      rows_detected: rows.length,
      rows_cleaned: cleaned.length,
      products_upserted: productUpserts.length,
      purchases_inserted: inserted,
      rows_skipped: skipped,
      qty_sign_fixed: signFixed,
    })
  } catch (e) {
    const status = e?.status || 400
    return NextResponse.json({ ok: false, error: e?.message || 'Import failed' }, { status })
  }
}
