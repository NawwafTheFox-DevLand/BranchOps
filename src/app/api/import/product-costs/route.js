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
    if (!file) return NextResponse.json({ ok:false, error:'No file' }, { status:400 })
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type:'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:null })
    let hi = 0
    for (let i=0; i<Math.min(10,raw.length); i++) {
      if (raw[i].some(c=>String(c||'').trim()==='Name') && raw[i].some(c=>String(c||'').trim()==='SKU')) { hi=i; break }
    }
    const headers = raw[hi].map(h=>String(h||'').trim())
    const col = k => headers.indexOf(k)
    let updated=0, upserted=0, skipped=0
    for (let i=hi+1; i<raw.length; i++) {
      const row = raw[i]
      if (!row||row.every(v=>v==null)) continue
      const name = String(row[col('Name')]||'').trim()
      const sku  = String(row[col('SKU')]||'').trim().replace(/\.0+$/,'')
      if (!name&&!sku) { skipped++; continue }
      const { data: existing } = await supabase.from('products').select('id').or(`erp_code.eq.${sku},name_ar.eq.${name}`).maybeSingle()
      if (existing) { await supabase.from('products').update({ erp_code:sku||null }).eq('id',existing.id); updated++ }
      else { await supabase.from('products').upsert({ name_ar:name, erp_code:sku||null },{ onConflict:'name_ar' }); upserted++ }
    }
    return NextResponse.json({ ok:true, updated, upserted, skipped })
  } catch(e) { return NextResponse.json({ ok:false, error:e.message }, { status:500 }) }
}