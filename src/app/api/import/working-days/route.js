import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import * as XLSX from 'xlsx'

function parseDate(v) {
  if (!v) return null
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return isNaN(d) ? null : d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`
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

    // Find header row — accept both original Arabic and transformed English headers
    let hi = 0
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      const r = raw[i]
      if (r.some(c => String(c||'').includes('تاريخ العمل') || String(c||'').trim() === 'Date')) {
        hi = i; break
      }
    }
    const headers = raw[hi].map(h => String(h||'').trim())
    const col = k => headers.indexOf(k)

    // Support both Arabic original and English transformed column names
    const dateCol     = col('Date')     >= 0 ? col('Date')     : col('تاريخ العمل')
    const branchCol   = col('Branch')   >= 0 ? col('Branch')   : col('الفرع')
    const openCol     = col('Open')     >= 0 ? col('Open')     : col('وقت الفتح')
    const closeCol    = col('Close')    >= 0 ? col('Close')    : col('وقت الإغلاق')
    const branchNmCol = col('اسم الفرع الثانوي')
    const branchRefCol= col('مرجع الفرع')
    const eodCol      = col('نهاية اليوم')
    const openedByCol = col('Opened By') >= 0 ? col('Opened By') : col('تم الفتح بواسطة')
    const closedByCol = col('Closed By') >= 0 ? col('Closed By') : col('أغلق بواسطة')

    const { data: branches } = await supabase.from('branches').select('id, code, name')
    const branchByCode = {}
    for (const b of branches||[]) {
      branchByCode[b.code?.toLowerCase()] = b.id
      branchByCode[b.name?.toLowerCase()] = b.id
    }

    const { data: log } = await supabase.from('import_log')
      .insert({ import_type: 'working_days', file_name: file.name, status: 'running' })
      .select('id').single()
    const batchId = log?.id

    const rows = []
    for (let i = hi + 1; i < raw.length; i++) {
      const row = raw[i]
      if (!row || row.every(v => v == null)) continue
      const dateVal  = row[dateCol]
      const workDate = parseDate(dateVal)
      if (!workDate) continue

      const branchRaw = String(row[branchCol]||'').trim()
      const branchId  = branchByCode[branchRaw.toLowerCase()] || fallback_branch_id
      const resolvedBranchName = branchRaw || fallback_branch_name

      rows.push({
        work_date:    workDate,
        open_time:    row[openCol]     ? String(row[openCol])     : null,
        close_time:   row[closeCol]    ? String(row[closeCol])    : null,
        branch_id:    branchId,
        branch_code:  branchRaw || null,
        branch_name_fallback: resolvedBranchName || null,
        branch_name:  branchNmCol  >= 0 ? String(row[branchNmCol] ||'').trim()||null : null,
        branch_ref:   branchRefCol >= 0 ? String(row[branchRefCol]||'').trim()||null : null,
        end_of_day:   eodCol       >= 0 && row[eodCol] ? String(row[eodCol]) : null,
        opened_by:    openedByCol  >= 0 ? String(row[openedByCol]||'').trim()||null : null,
        closed_by:    closedByCol  >= 0 ? String(row[closedByCol]||'').trim()||null : null,
        import_batch: batchId,
      })
    }

    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase.from('branch_working_days').insert(rows.slice(i, i + CHUNK))
      if (error) throw error
    }

    await supabase.from('import_log').update({ status: 'done', row_count: rows.length }).eq('id', batchId)
    return NextResponse.json({ ok: true, inserted: rows.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
