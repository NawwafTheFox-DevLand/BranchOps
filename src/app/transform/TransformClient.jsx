'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = {
  bg:'#f4f6f9', surf:'#ffffff', surf2:'#f0f2f6', surf3:'#e8ebf0',
  border:'#dde1e9', border2:'#c8cdd8',
  amber:'#d97706', amberDim:'rgba(217,119,6,0.08)', amberBrd:'rgba(217,119,6,0.25)',
  green:'#16a34a', greenDim:'rgba(22,163,74,0.07)', greenBrd:'rgba(22,163,74,0.2)',
  red:'#dc2626',   redDim:'rgba(220,38,38,0.07)',   redBrd:'rgba(220,38,38,0.2)',
  blue:'#2563eb',  blueDim:'rgba(37,99,235,0.07)',  blueBrd:'rgba(37,99,235,0.2)',
  teal:'#0d9488',  violet:'#7c3aed',
  muted:'#94a3b8', muted2:'#64748b', text:'#111827', textDim:'#374151',
}

const FILE_TYPES = {
  menu_analysis:      { label:'تحليل القائمة',    en:'Menu Analysis',    color:C.amber,  icon:'🍽️', endpoint:'/api/import/menu-analysis',       needsPeriod:true,  needsDate:false, needsBranch:false },
  purchases:          { label:'طلبات الشراء',      en:'Purchase Orders',  color:C.green,  icon:'🛒', endpoint:'/api/import/purchases',            needsPeriod:false, needsDate:false, needsBranch:false },
  product_costs:      { label:'تكلفة المنتجات',   en:'Product Costs',    color:C.blue,   icon:'💰', endpoint:'/api/import/product-costs',        needsPeriod:false, needsDate:false, needsBranch:false },
  inventory_levels:   { label:'مستويات المخزون',  en:'Inventory Levels', color:C.teal,   icon:'📦', endpoint:'/api/import/inventory-levels',     needsPeriod:false, needsDate:true,  needsBranch:false },
  inventory_movements:{ label:'تاريخ المخزون',    en:'Stock History',    color:C.purple, icon:'📋', endpoint:'/api/import/inventory-movements',  needsPeriod:false, needsDate:false, needsBranch:true  },
  stock_movement:     { label:'حركة المخزون',     en:'Stock Movement',   color:C.red,    icon:'🔄', endpoint:'/api/import/stock-movement',       needsPeriod:false, needsDate:false, needsBranch:true  },
  working_days:       { label:'أيام العمل',        en:'Working Days',     color:C.amber,  icon:'📅', endpoint:'/api/import/working-days',         needsPeriod:false, needsDate:false, needsBranch:true  },
}

const SIGNATURES = {
  menu_analysis:       ['Class', 'Profit Category', 'Popularity Category'],
  purchases:           ['Supplier', 'Supplier Item Code', 'Approved At'],
  product_costs:       ['Costing Method'],
  inventory_levels:    ['Cost Per Unit', 'Total Cost'],
  inventory_movements: ['Transaction Type', 'Transaction Reference'],
  stock_movement:      ['Opening Quantity', 'Closing Quantity', 'Production Waste Quantity'],
  working_days:        ['تاريخ العمل', 'وقت الفتح'],
}

function detectFileType(headers) {
  const flat = headers.map(h => String(h||'').trim())
  for (const [type, sigs] of Object.entries(SIGNATURES)) {
    if (sigs.every(s => flat.includes(s))) return type
  }
  return null
}

function getHeaders(raw) {
  const known = ['Name','SKU','Product','Class','Quantity','تاريخ العمل','Transaction Type','Opening Quantity','Cost Per Unit','Costing Method','Supplier Item Code']
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const row = raw[i]
    if (!row) continue
    const nonNull = row.filter(v => v != null && String(v).trim())
    if (nonNull.length >= 3 && row.some(c => known.includes(String(c||'').trim()))) {
      return { hi: i, headers: row }
    }
  }
  return { hi: 0, headers: raw[0] || [] }
}

function transformRows(raw, fileType) {
  const { hi, headers } = getHeaders(raw)
  const col = k => headers.findIndex(h => String(h||'').trim() === k)
  const rows = [], skipped = []

  for (let i = hi + 1; i < raw.length; i++) {
    const row = raw[i]
    if (!row || row.every(v => v == null || v === '')) continue

    if (fileType === 'menu_analysis') {
      const product = String(row[col('Product')]||'').trim()
      if (!product) { skipped.push({ row:i+1, reason:'no product' }); continue }
      rows.push({ Product:product, Sales:row[col('Sales')], Quantity:row[col('Quantity')], 'Total Cost':row[col('Total Cost')], 'Item Profit':row[col('Item Profit')], 'Total Profit':row[col('Total Profit')], 'Profit%':row[col('(نسبة الربح %)')], Popularity:row[col('Popularity')], 'Profit Category':row[col('Profit Category')], 'Popularity Category':row[col('Popularity Category')], Class:String(row[col('Class')]||'').trim()||null })
    } else if (fileType === 'purchases') {
      const name = String(row[col('Name')]||'').trim()
      if (!name) { skipped.push({ row:i+1, reason:'no name' }); continue }
      rows.push({ Name:name, SKU:String(row[col('SKU')]||'').trim().replace(/\.0+$/,''), Destination:String(row[col('Destination')]||'').trim(), Reference:String(row[col('Reference')]||'').trim(), Supplier:String(row[col('Supplier')]||'').trim(), Quantity:row[col('Quantity')], Cost:row[col('Cost')], 'Cost Per Unit':row[col('Cost Per Unit')], 'Approved At':row[col('Approved At')] })
    } else if (fileType === 'product_costs') {
      const name = String(row[col('Name')]||'').trim()
      const sku  = String(row[col('SKU')]||'').trim().replace(/\.0+$/,'')
      if (!name && !sku) { skipped.push({ row:i+1, reason:'no name or SKU' }); continue }
      rows.push({ Name:name, SKU:sku, 'Costing Method':row[col('Costing Method')], Cost:row[col('Cost')] })
    } else if (fileType === 'inventory_levels') {
      const name = String(row[col('Name')]||'').trim()
      if (!name) { skipped.push({ row:i+1, reason:'no name' }); continue }
      rows.push({ Name:name, SKU:String(row[col('SKU')]||'').trim().replace(/\.0+$/,''), Quantity:row[col('Quantity')], 'Cost Per Unit':row[col('Cost Per Unit')], 'Total Cost':row[col('Total Cost')], 'Storage Unit':row[col('Storage Unit')] })
    } else if (fileType === 'inventory_movements') {
      const name = String(row[col('Name')]||'').trim()
      if (!name) { skipped.push({ row:i+1, reason:'no name' }); continue }
      rows.push({ Name:name, SKU:String(row[col('SKU')]||'').trim().replace(/\.0+$/,''), Branch:String(row[col('Branch')]||'').trim(), Type:String(row[col('Transaction Type')]||'').trim(), Reference:String(row[col('Transaction Reference')]||'').trim(), Quantity:row[col('Quantity')], Cost:row[col('Cost')], Reason:String(row[col('Reason')]||'').trim(), Date:row[col('Submitted At')] })
    } else if (fileType === 'stock_movement') {
      const name = String(row[col('Name')]||'').trim()
      if (!name) { skipped.push({ row:i+1, reason:'no name' }); continue }
      rows.push({ Name:name, SKU:String(row[col('SKU')]||'').trim().replace(/\.0+$/,''), Branch:String(row[col('Branch')]||'').trim(), 'Opening Qty':row[col('Opening Quantity')], 'Purchasing Qty':row[col('Purchasing Quantity')], 'Waste Qty':row[col('Production Waste Quantity')], 'Closing Qty':row[col('Closing Quantity')] })
    } else if (fileType === 'working_days') {
      const dateVal = row[col('تاريخ العمل')]
      if (!dateVal) { skipped.push({ row:i+1, reason:'no date' }); continue }
      rows.push({ Date:String(dateVal), Branch:String(row[col('الفرع')]||'').trim(), Open:row[col('وقت الفتح')], Close:row[col('وقت الإغلاق')], 'Opened By':String(row[col('تم الفتح بواسطة')]||'').trim(), 'Closed By':String(row[col('أغلق بواسطة')]||'').trim() })
    }
  }
  return { rows, skipped }
}

function Stat({ label, value, color=C.amber }) {
  return (
    <div style={{ background:C.surf2, border:`1px solid ${C.border2}`, borderRadius:10, padding:'14px 18px', textAlign:'center' }}>
      <div style={{ fontSize:26, fontWeight:800, color, fontFamily:"'Syne',sans-serif", lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:9, color:C.muted2, marginTop:5, letterSpacing:'0.08em', textTransform:'uppercase' }}>{label}</div>
    </div>
  )
}

function Badge({ label, color }) {
  return <span style={{ background:`${color}18`, border:`1px solid ${color}44`, color, borderRadius:4, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{label}</span>
}

function ProgressBar({ pct, inserted, total, color }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:11, color:C.textDim, fontWeight:600 }}>Importing…</span>
        <span style={{ fontSize:11, color, fontWeight:800 }}>{inserted} / {total} rows ({pct}%)</span>
      </div>
      <div style={{ background:C.surf3, borderRadius:999, height:8, overflow:'hidden', border:`1px solid ${C.border}` }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:999, transition:'width .3s ease' }} />
      </div>
    </div>
  )
}

const CHUNK_SIZE = 100

export default function TransformClient() {
  const [file,       setFile]       = useState(null)
  const [fileType,   setFileType]   = useState(null)
  const [status,     setStatus]     = useState('idle')
  const [result,     setResult]     = useState(null)
  const [errorMsg,   setErrorMsg]   = useState('')
  const [period,     setPeriod]     = useState('')
  const [snapDate,   setSnapDate]   = useState(new Date().toISOString().slice(0,10))
  const [importing,  setImporting]  = useState(false)
  const [progress,   setProgress]   = useState({ inserted:0, total:0, pct:0 })
  const [importRes,  setImportRes]  = useState(null)
  const [branches,   setBranches]   = useState([])
  const [branchId,   setBranchId]   = useState('')
  const inputRef = useRef()

  // Load branches on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.from('branches').select('id, code, name').eq('is_active', true).order('code')
      .then(({ data }) => setBranches(data || []))
  }, [])

  const selectedBranch = branches.find(b => b.id === branchId)

  const onFile = async (f) => {
    if (!f) return
    setFile(f); setStatus('idle'); setResult(null); setImportRes(null); setErrorMsg('')
    try {
      const XLSX = window.XLSX
      if (!XLSX) return
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type:'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:null })
      const { headers } = getHeaders(raw)
      const detected = detectFileType(headers)
      setFileType(detected)
    } catch(_) {}
  }

  const run = async () => {
    if (!file) return
    setStatus('loading'); setResult(null); setErrorMsg(''); setImportRes(null)
    try {
      const XLSX = window.XLSX
      if (!XLSX) throw new Error('XLSX not loaded — wait a moment and retry.')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type:'array', cellDates:false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:null })
      const { headers } = getHeaders(raw)
      const detectedType = fileType || detectFileType(headers)
      if (!detectedType) throw new Error('Cannot detect file type. Click the correct card above and retry.')
      setFileType(detectedType)
      const { rows, skipped } = transformRows(raw, detectedType)
      setResult({ rows, skipped }); setStatus('done')
    } catch(e) { setErrorMsg(e.message); setStatus('error') }
  }

  const importNow = async () => {
    if (!result || result.rows.length === 0 || !fileType) return
    const ft = FILE_TYPES[fileType]
    if (ft.needsBranch && !branchId) {
      setErrorMsg('Please select a branch before importing this file type.')
      return
    }
    setImporting(true); setImportRes(null); setErrorMsg('')
    const total = result.rows.length
    setProgress({ inserted:0, total, pct:0 })

    try {
      const XLSX = window.XLSX
      let totalInserted = 0
      const chunks = []
      for (let i = 0; i < total; i += CHUNK_SIZE) chunks.push(result.rows.slice(i, i + CHUNK_SIZE))

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci]
        const ws = XLSX.utils.json_to_sheet(chunk)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Data')
        const wbBuf = XLSX.write(wb, { type:'array', bookType:'xlsx' })
        const blob = new Blob([wbBuf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

        const fd = new FormData()
        fd.append('file', blob, file.name)
        if (branchId) {
          fd.append('branch_id', branchId)
          fd.append('branch_name', selectedBranch?.name || '')
        }
        if (ft.needsPeriod && period) fd.append('period_label', period)
        if (ft.needsDate) fd.append('snapshot_date', snapDate)

        const res = await fetch(ft.endpoint, { method:'POST', body:fd })
        const out = await res.json().catch(() => ({ ok:false, error:`HTTP ${res.status}` }))
        if (!out.ok) throw new Error(out.error || 'Import failed')

        totalInserted += (out.inserted || 0)
        const pct = Math.round(((ci + 1) / chunks.length) * 100)
        setProgress({ inserted: totalInserted, total, pct })
      }

      setImportRes({ ok:true, inserted: totalInserted, total, skipped: result.skipped.length })
    } catch(e) {
      setImportRes({ ok:false, error:e.message })
    } finally {
      setImporting(false)
    }
  }

  const ft = fileType ? FILE_TYPES[fileType] : null
  const previewCols = result?.rows?.[0] ? Object.keys(result.rows[0]) : []
  const canImport = result && result.rows.length > 0 && (!ft?.needsBranch || branchId) && (!ft?.needsPeriod || period)

  return (
    <>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" />
      <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text, padding:'28px 28px 80px' }}>
        <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes fu{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}.fu{animation:fu .25s ease both}@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite;display:inline-block}.rh:hover{background:rgba(255,255,255,0.025)!important}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#252d35;border-radius:2px}select option{background:#ffffff}`}</style>

        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:22, letterSpacing:'-0.03em' }}>ETL Engine</div>
              <Badge label="ERP → Supabase" color={C.amber}/>
            </div>
            <div style={{ fontSize:12, color:C.muted2, lineHeight:1.8 }}>Auto-detects file type · strips junk rows · previews · imports directly to the correct table.</div>
          </div>

          {/* File type selector */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:20 }}>
            {Object.entries(FILE_TYPES).map(([key, info]) => (
              <div key={key} onClick={() => setFileType(key)}
                style={{ background:fileType===key?`${info.color}12`:C.surf, border:`1px solid ${fileType===key?info.color+'55':C.border}`, borderRadius:10, padding:'10px 12px', cursor:'pointer', transition:'all .15s', position:'relative' }}>
                <div style={{ fontSize:16, marginBottom:4 }}>{info.icon}</div>
                <div style={{ fontSize:10, color:fileType===key?info.color:C.textDim, fontWeight:700 }}>{info.label}</div>
                <div style={{ fontSize:9, color:C.muted2, marginTop:2 }}>{info.en}</div>
                {info.needsBranch && <div style={{ position:'absolute', top:6, right:6, width:6, height:6, borderRadius:'50%', background:C.amber }} title="Requires branch selection"/>}
              </div>
            ))}
          </div>

          {/* Branch selector — always visible */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, color:C.muted2, marginBottom:5, letterSpacing:'0.06em' }}>
              BRANCH FALLBACK
              <span style={{ marginLeft:8, color:ft?.needsBranch ? C.amber : C.muted, fontSize:9 }}>
                {ft?.needsBranch ? '● Required for this file type' : '○ Optional — used only when file has no branch column'}
              </span>
            </div>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              style={{ width:'100%', padding:'10px 14px', borderRadius:9, border:`1px solid ${branchId ? (ft?.needsBranch ? ft.color+'66' : C.border2) : (ft?.needsBranch ? C.amber+'88' : C.border2)}`, background:C.surf2, color:branchId?C.text:C.muted2, fontSize:12, fontFamily:'inherit', cursor:'pointer', outline:'none' }}
            >
              <option value="">— Select a branch (or leave empty if file contains branch data) —</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.code} · {b.name}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div onClick={() => inputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onFile(e.dataTransfer.files[0])}}
            style={{ border:`2px dashed ${file?ft?.color+'66'||C.amberBrd:C.border2}`, borderRadius:14, padding:'28px 24px', textAlign:'center', cursor:'pointer', marginBottom:16, background:file?`${ft?.color||C.amber}09`:C.surf, transition:'all .2s' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>{ft?.icon||'📂'}</div>
            {file ? (
              <>
                <div style={{ fontWeight:700, color:ft?.color||C.amber, fontSize:14 }}>{file.name}</div>
                <div style={{ fontSize:11, color:C.muted2, marginTop:4 }}>{(file.size/1024).toFixed(1)} KB · Click to change</div>
                {fileType && <div style={{ marginTop:8 }}><Badge label={`Detected: ${ft?.en}`} color={ft?.color||C.amber}/></div>}
              </>
            ) : (
              <>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Drop your ERP export here</div>
                <div style={{ fontSize:11, color:C.muted2 }}>or click to browse · .xlsx only</div>
              </>
            )}
            <input ref={inputRef} type="file" accept=".xlsx" style={{ display:'none' }} onChange={e=>onFile(e.target.files?.[0])}/>
          </div>

          {/* Period / date inputs */}
          {fileType && (FILE_TYPES[fileType].needsPeriod || FILE_TYPES[fileType].needsDate) && (
            <div style={{ display:'flex', gap:12, marginBottom:16 }}>
              {FILE_TYPES[fileType].needsPeriod && (
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:C.muted2, marginBottom:5 }}>PERIOD LABEL (e.g. Mar 2026)</div>
                  <input value={period} onChange={e=>setPeriod(e.target.value)} placeholder="Mar 2026"
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border2}`, background:C.surf2, color:C.text, fontSize:12, fontFamily:'inherit' }}/>
                </div>
              )}
              {FILE_TYPES[fileType].needsDate && (
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:C.muted2, marginBottom:5 }}>SNAPSHOT DATE</div>
                  <input type="date" value={snapDate} onChange={e=>setSnapDate(e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border2}`, background:C.surf2, color:C.text, fontSize:12, fontFamily:'inherit' }}/>
                </div>
              )}
            </div>
          )}

          {/* Analyse button */}
          <button onClick={run} disabled={!file||status==='loading'}
            style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:!file||status==='loading'?C.surf2:ft?.color||C.amber, color:!file||status==='loading'?C.muted:'#0a0a0a', fontWeight:800, fontSize:14, cursor:!file?'not-allowed':'pointer', fontFamily:"'Syne',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:20 }}>
            {status==='loading'&&<span className="spin">⟳</span>}
            {status==='loading'?'Analysing…':`⚡ Analyse ${ft?.label||'File'}`}
          </button>

          {status==='error' && (
            <div className="fu" style={{ background:C.redDim, border:`1px solid ${C.redBrd}`, borderRadius:12, padding:'12px 18px', marginBottom:20, color:C.red, fontSize:12, fontWeight:600 }}>✗ {errorMsg}</div>
          )}

          {status==='done' && result && (
            <div className="fu">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
                <Stat label="Rows ready"   value={result.rows.length}    color={C.green}/>
                <Stat label="Rows skipped" value={result.skipped.length} color={result.skipped.length>0?C.amber:C.muted}/>
                <Stat label="Chunks"       value={Math.ceil(result.rows.length/CHUNK_SIZE)} color={C.blue}/>
                <Stat label="Type"         value={ft?.icon||'?'}         color={ft?.color||C.amber}/>
              </div>

              {/* Branch warning if needed and not selected */}
              {ft?.needsBranch && !branchId && (
                <div style={{ background:'rgba(245,158,11,0.08)', border:`1px solid ${C.amberBrd}`, borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:12, color:C.amber, fontWeight:600 }}>
                  ⚠ Select a branch above before importing — this file type requires it as a fallback.
                </div>
              )}

              {/* Import button */}
              <button onClick={importNow} disabled={importing || !canImport}
                style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:importing||!canImport?C.surf2:ft?.color||C.amber, color:importing||!canImport?C.muted:'#0a0a0a', fontWeight:800, fontSize:14, cursor:!canImport?'not-allowed':'pointer', fontFamily:"'Syne',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:16 }}>
                {importing&&<span className="spin">⟳</span>}
                {importing ? `Chunk ${Math.ceil(progress.inserted/CHUNK_SIZE)+1}/${Math.ceil(progress.total/CHUNK_SIZE)}…` : `⬆ Import ${result.rows.length} rows${selectedBranch?' → '+selectedBranch.code:''}`}
              </button>

              {importing && <ProgressBar pct={progress.pct} inserted={progress.inserted} total={progress.total} color={ft?.color||C.amber}/>}

              {importRes && !importing && (
                <div className="fu" style={{ marginBottom:20, padding:'16px 20px', borderRadius:12, background:importRes.ok?C.greenDim:C.redDim, border:`1px solid ${importRes.ok?C.greenBrd:C.redBrd}` }}>
                  <div style={{ fontWeight:800, color:importRes.ok?C.green:C.red, marginBottom:10, fontSize:14 }}>{importRes.ok?'✓ Import complete':'✗ Import failed'}</div>
                  {importRes.ok ? (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                      {[['Inserted',importRes.inserted,C.green],['Skipped',importRes.skipped,C.amber],['Total',importRes.total,ft?.color||C.blue]].map(([l,v,c])=>(
                        <div key={l} style={{ background:C.surf2, borderRadius:8, padding:'10px 14px', textAlign:'center' }}>
                          <div style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
                          <div style={{ fontSize:9, color:C.muted2, marginTop:3, textTransform:'uppercase', letterSpacing:'0.07em' }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize:12, color:C.red }}>{importRes.error}</div>
                  )}
                </div>
              )}

              {/* Preview table */}
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
                <div style={{ padding:'12px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13 }}>Preview — first 8 rows</span>
                  <Badge label={`${result.rows.length} total`} color={ft?.color||C.amber}/>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.surf2 }}>
                        {previewCols.map(h => <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:C.muted2, fontSize:9, letterSpacing:'0.07em', textTransform:'uppercase', whiteSpace:'nowrap', fontWeight:600 }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0,8).map((row,i) => (
                        <tr key={i} className="rh" style={{ borderBottom:`1px solid ${C.border}` }}>
                          {previewCols.map(c => <td key={c} style={{ padding:'7px 12px', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:['Class','SKU','Type'].includes(c)?ft?.color||C.amber:C.text }}>{row[c]!=null?String(row[c]):<span style={{ color:C.muted }}>—</span>}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {result.skipped.length > 0 && (
                <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
                  <div style={{ padding:'12px 18px', borderBottom:`1px solid ${C.border}`, fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, color:C.amber }}>⚠ Skipped ({result.skipped.length})</div>
                  <div style={{ maxHeight:160, overflowY:'auto' }}>
                    {result.skipped.map((s,i) => <div key={i} style={{ padding:'6px 18px', borderBottom:`1px solid ${C.border}`, fontSize:11, color:C.muted2, display:'flex', gap:16 }}><span style={{ color:C.muted }}>Row {s.row}</span><span style={{ color:C.amber }}>{s.reason}</span></div>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {status==='idle' && !file && (
            <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:'18px 22px' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:13, marginBottom:14 }}>Supported ERP exports</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                {Object.entries(FILE_TYPES).map(([key, info]) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:C.surf2, borderRadius:9, border:`1px solid ${C.border2}` }}>
                    <span style={{ fontSize:18 }}>{info.icon}</span>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:info.color }}>{info.label} {info.needsBranch && <span style={{ color:C.amber, fontSize:9 }}>● branch req.</span>}</div>
                      <div style={{ fontSize:10, color:C.muted2 }}>{info.en}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:C.muted2, lineHeight:1.9 }}>
                ✓ Auto-detects file type · ✓ Branch fallback dropdown for all imports · ✓ Chunked import with live progress · ✓ Matches products by name or SKU
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
