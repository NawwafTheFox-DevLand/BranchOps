'use client'

import { useState, useEffect, useMemo } from 'react'

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

const PRODUCT_COLORS = ['#f59e0b','#22c55e','#60a5fa','#a78bfa','#2dd4bf','#f97316','#ec4899','#84cc16','#06b6d4','#8b5cf6']
const BRANCH_COLORS  = ['#f59e0b','#22c55e','#60a5fa','#a78bfa','#2dd4bf','#f97316','#ec4899','#84cc16','#06b6d4','#ef4444']

const fmt0  = (n) => n == null ? '—' : Math.round(Number(n)).toLocaleString()
const fmtM  = (n) => n == null ? '—' : `${(Number(n)/1000000).toFixed(1)}M`
const fmtK  = (n) => n == null ? '—' : Number(n) >= 1000000 ? fmtM(n) : `${(Number(n)/1000).toFixed(0)}K`
const fmtP  = (n) => n == null ? '—' : `${Number(n).toFixed(1)}%`

// ── KPI Card ────────────────────────────────────────────────────────────────
const KPI = ({ label, value, sub, color=C.amber, icon }) => (
  <div style={{ background: C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
      <div style={{ fontSize:10, color:C.muted2, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>{label}</div>
      {icon && <span style={{ fontSize:18, opacity:0.7 }}>{icon}</span>}
    </div>
    <div style={{ fontSize:32, fontFamily:"'Syne',sans-serif", fontWeight:900, color, letterSpacing:'-0.04em', lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:C.muted2, marginTop:6 }}>{sub}</div>}
  </div>
)

// ── SVG Area/Line chart ──────────────────────────────────────────────────────
function LineChart({ series, height=200, showForecast=false }) {
  const W = 900, H = height, PAD = { t:16, r:16, b:36, l:60 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  if (!series?.length || !series[0]?.data?.length) {
    return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:C.muted2, fontSize:12 }}>No data yet — import the simulation files first</div>
  }

  const allVals = series.flatMap(s => s.data.map(d => d.v))
  const maxV = Math.max(...allVals, 1)
  const minV = 0

  const xs = series[0].data.map((_, i) => PAD.l + (i / (series[0].data.length - 1)) * iW)
  const vy  = (v) => PAD.t + iH - ((v - minV) / (maxV - minV)) * iH

  const tickCount = 5
  const yTicks = Array.from({ length: tickCount }, (_, i) => (maxV / (tickCount - 1)) * i)

  // X-axis: show every 6th label
  const xLabels = series[0].data
    .map((d, i) => ({ i, label: d.label }))
    .filter((_, i) => i % Math.max(1, Math.floor(series[0].data.length / 8)) === 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height }} preserveAspectRatio="none">
      <defs>
        {series.map((s, si) => (
          <linearGradient key={si} id={`grad${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={vy(v)} x2={W-PAD.r} y2={vy(v)} stroke={C.border2} strokeWidth="0.5" strokeDasharray="4 4" />
          <text x={PAD.l-6} y={vy(v)+4} textAnchor="end" fontSize="9" fill={C.muted2}>{fmtK(v)}</text>
        </g>
      ))}

      {/* X labels */}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={xs[i]} y={H-6} textAnchor="middle" fontSize="9" fill={C.muted2}>{label}</text>
      ))}

      {/* Forecast divider */}
      {showForecast && (() => {
        const today = new Date().toISOString().slice(0,7)
        const todayIdx = series[0].data.findIndex(d => d.label >= today)
        if (todayIdx < 0) return null
        const fx = xs[todayIdx]
        return <>
          <line x1={fx} y1={PAD.t} x2={fx} y2={H-PAD.b} stroke={C.amber} strokeWidth="1" strokeDasharray="6 3" opacity="0.5" />
          <text x={fx+4} y={PAD.t+10} fontSize="9" fill={C.amber} opacity="0.8">▶ Forecast</text>
        </>
      })()}

      {/* Area fills */}
      {series.map((s, si) => {
        const pts = s.data.map((d, i) => `${xs[i]},${vy(d.v)}`).join(' ')
        const area = `M${PAD.l},${vy(0)} L${pts.split(' ').map((p,i) => (i===0?'':p)).filter(Boolean).join(' ')} L${W-PAD.r},${vy(0)} Z`
        const line2 = `M ${s.data.map((d,i) => `${xs[i]} ${vy(d.v)}`).join(' L ')}`
        return (
          <g key={si}>
            <path d={`M ${s.data.map((d,i) => `${xs[i]} ${vy(d.v)}`).join(' L ')} L ${W-PAD.r} ${vy(0)} L ${PAD.l} ${vy(0)} Z`}
              fill={`url(#grad${si})`} />
            <path d={line2} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray={s.dashed ? '6 4' : undefined} opacity={s.opacity || 1} />
          </g>
        )
      })}
    </svg>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ data, color=C.amber, height=160, horizontal=false }) {
  if (!data?.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:C.muted2, fontSize:12 }}>No data</div>
  const maxV = Math.max(...data.map(d => d.v), 1)

  if (horizontal) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {data.slice(0,10).map((d, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:120, fontSize:11, color:C.textDim, textAlign:'right', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', direction:'rtl' }}>{d.label}</div>
            <div style={{ flex:1, background:C.border, borderRadius:3, height:20, overflow:'hidden' }}>
              <div style={{ width:`${(d.v/maxV)*100}%`, height:'100%', background:typeof color === 'function' ? color(i) : color, borderRadius:3, transition:'width .4s ease', display:'flex', alignItems:'center', paddingLeft:6 }}>
                <span style={{ fontSize:10, color:'#000', fontWeight:700, whiteSpace:'nowrap', opacity: d.v/maxV > 0.15 ? 1 : 0 }}>{fmtK(d.v)}</span>
              </div>
            </div>
            <div style={{ fontSize:10, color:C.muted2, width:50, textAlign:'right' }}>{fmtK(d.v)}</div>
          </div>
        ))}
      </div>
    )
  }

  const W=600, H=height, PAD={t:8,r:8,b:28,l:40}
  const barW = Math.max(4, (W - PAD.l - PAD.r) / data.length - 2)
  const vy = (v) => PAD.t + (H-PAD.t-PAD.b) - (v/maxV)*(H-PAD.t-PAD.b)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const x = PAD.l + i * ((W-PAD.l-PAD.r)/data.length) + 1
        const y = vy(d.v)
        const bh = H - PAD.b - y
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx="2"
              fill={typeof color === 'function' ? color(i) : color} opacity="0.85" />
            {i % Math.max(1, Math.floor(data.length/8)) === 0 &&
              <text x={x+barW/2} y={H-6} textAnchor="middle" fontSize="8" fill={C.muted2}>{d.label}</text>}
          </g>
        )
      })}
      <line x1={PAD.l} y1={H-PAD.b} x2={W-PAD.r} y2={H-PAD.b} stroke={C.border2} />
    </svg>
  )
}

// ── Stacked area for multi-series ─────────────────────────────────────────────
function MultiLineChart({ seriesData, keys, colors, height=200, labelKey='period_label' }) {
  const W=900, H=height, PAD={t:16,r:16,b:36,l:64}
  const iW=W-PAD.l-PAD.r, iH=H-PAD.t-PAD.b

  if (!seriesData?.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:C.muted2, fontSize:12 }}>No data</div>

  const labels = [...new Set(seriesData.map(d => d[labelKey]))].sort()
  const maxV = Math.max(...keys.flatMap(k => seriesData.map(d => Number(d[k]||0))), 1)

  const getVal = (label, key) => {
    const rows = seriesData.filter(d => d[labelKey] === label)
    return rows.reduce((s, r) => s + Number(r[key]||0), 0)
  }

  const xs = labels.map((_, i) => PAD.l + (i/(labels.length-1||1))*iW)
  const vy = (v) => PAD.t + iH - (v/maxV)*iH
  const tickCount = 4
  const yTicks = Array.from({length:tickCount}, (_,i) => maxV/(tickCount-1)*i)
  const xLabels = labels.map((l,i)=>({i,label:l})).filter((_,i)=>i%Math.max(1,Math.floor(labels.length/7))===0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height}} preserveAspectRatio="none">
      <defs>
        {keys.map((k,ki)=>(
          <linearGradient key={ki} id={`mg${ki}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[ki]||C.amber} stopOpacity="0.15"/>
            <stop offset="100%" stopColor={colors[ki]||C.amber} stopOpacity="0"/>
          </linearGradient>
        ))}
      </defs>
      {yTicks.map((v,i)=>(
        <g key={i}>
          <line x1={PAD.l} y1={vy(v)} x2={W-PAD.r} y2={vy(v)} stroke={C.border2} strokeWidth="0.5" strokeDasharray="4 4"/>
          <text x={PAD.l-6} y={vy(v)+4} textAnchor="end" fontSize="9" fill={C.muted2}>{fmtK(v)}</text>
        </g>
      ))}
      {xLabels.map(({i,label})=>(
        <text key={i} x={xs[i]} y={H-6} textAnchor="middle" fontSize="8" fill={C.muted2}>{label}</text>
      ))}
      {keys.map((key,ki)=>{
        const pts = labels.map((l,i)=>({x:xs[i], y:vy(getVal(l,key))}))
        const line = `M ${pts.map(p=>`${p.x} ${p.y}`).join(' L ')}`
        const area = `${line} L ${xs[xs.length-1]} ${vy(0)} L ${xs[0]} ${vy(0)} Z`
        return (
          <g key={ki}>
            <path d={area} fill={`url(#mg${ki})`}/>
            <path d={line} fill="none" stroke={colors[ki]||C.amber} strokeWidth="2" strokeLinejoin="round"/>
          </g>
        )
      })}
    </svg>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────
const Legend = ({ items }) => (
  <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:12 }}>
    {items.map((item,i) => (
      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:C.textDim }}>
        <div style={{ width:10, height:10, borderRadius:2, background:item.color, flexShrink:0 }}/>
        {item.label}
      </div>
    ))}
  </div>
)

const CardTitle = ({ children, sub }) => (
  <div style={{ marginBottom:16 }}>
    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, color:C.text }}>{children}</div>
    {sub && <div style={{ fontSize:10, color:C.muted2, marginTop:3 }}>{sub}</div>}
  </div>
)

const Card = ({ children, style={} }) => (
  <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px', ...style }}>
    {children}
  </div>
)

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChartsClient() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('revenue')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importFile, setImportFile] = useState(null)

  useEffect(() => {
    fetch('/api/charts')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // ── Derived data ──────────────────────────────────────────────────────────
  const monthly = data?.monthly || []
  const productData = data?.products || []
  const branchData = data?.branches || []
  const forecastData = data?.forecasts || []

  const kpis = useMemo(() => {
    const totalRev  = monthly.reduce((s,r) => s+Number(r.revenue||0), 0)
    const totalProf = monthly.reduce((s,r) => s+Number(r.profit||0), 0)
    const totalUnits= monthly.reduce((s,r) => s+Number(r.units||0), 0)
    const months    = monthly.length
    return { totalRev, totalProf, totalUnits, months, margin: totalRev>0 ? totalProf/totalRev*100 : 0 }
  }, [monthly])

  // Monthly revenue/cogs/profit series
  const revSeries = useMemo(() => [{
    label:'Revenue', color:C.amber,
    data: monthly.map(r => ({ label:r.month?.slice(0,7)||'', v:Number(r.revenue||0) }))
  },{
    label:'COGS', color:C.red, opacity:0.7,
    data: monthly.map(r => ({ label:r.month?.slice(0,7)||'', v:Number(r.cogs||0) }))
  },{
    label:'Profit', color:C.green,
    data: monthly.map(r => ({ label:r.month?.slice(0,7)||'', v:Number(r.profit||0) }))
  }], [monthly])

  // Units series
  const unitsSeries = useMemo(() => [{
    label:'Units Sold', color:C.blue,
    data: monthly.map(r => ({ label:r.month?.slice(0,7)||'', v:Number(r.units||0) }))
  }], [monthly])

  // Forecast vs actual
  const forecastSeries = useMemo(() => {
    if (!forecastData.length) return []
    const grouped = {}
    for (const r of forecastData) {
      const m = r.forecast_date?.slice(0,7)
      if (!m) continue
      grouped[m] ??= { label:m, predicted:0, actual:0, n:0 }
      grouped[m].predicted += Number(r.predicted_units||0)
      grouped[m].actual    += Number(r.actual_sold||0)
      grouped[m].n++
    }
    const sorted = Object.values(grouped).sort((a,b) => a.label.localeCompare(b.label))
    return [
      { label:'Predicted (P50)', color:C.amber, dashed:false, data:sorted.map(r=>({label:r.label,v:r.predicted})) },
      { label:'Actual Sold',     color:C.green, dashed:false, data:sorted.map(r=>({label:r.label,v:r.actual})) },
    ]
  }, [forecastData])

  // Top products by revenue
  const topProducts = useMemo(() => {
    const agg = {}
    for (const r of productData) {
      const n = r.product_name
      agg[n] = (agg[n]||0) + Number(r.total_revenue||0)
    }
    return Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([label,v])=>({label,v}))
  }, [productData])

  // Top branches
  const topBranches = useMemo(() => {
    const agg = {}
    for (const r of branchData) {
      const n = r.branch_name || r.branch_code
      agg[n] = (agg[n]||0) + Number(r.total_revenue||0)
    }
    return Object.entries(agg).sort((a,b)=>b[1]-a[1]).map(([label,v])=>({label,v}))
  }, [branchData])

  // Product monthly trend (top 5)
  const top5Products = useMemo(() => {
    return topProducts.slice(0,5).map(p => p.label)
  }, [topProducts])

  // Branch monthly trend
  const allBranches = useMemo(() => {
    return [...new Set(branchData.map(r => r.branch_name||r.branch_code))].slice(0,5)
  }, [branchData])

  // Import handler for sales daily
  const importSalesDaily = async () => {
    if (!importFile) return
    setImporting(true)
    setImportMsg('')
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await fetch('/api/import/sales-daily', { method:'POST', body:fd })
      const out = await res.json()
      if (out.ok) {
        setImportMsg(`✓ Imported ${out.inserted.toLocaleString()} rows. Refresh page to see charts.`)
      } else {
        setImportMsg(`✗ ${out.error}`)
      }
    } catch(e) {
      setImportMsg(`✗ ${e.message}`)
    } finally {
      setImporting(false)
    }
  }

  const TABS = [
    { id:'revenue',  label:'Revenue & P&L' },
    { id:'products', label:'Products'       },
    { id:'branches', label:'Branches'       },
    { id:'forecast', label:'Forecast vs Actual' },
  ]

  const hasData = monthly.length > 0

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text, paddingBottom:60 }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        select,input{font-family:inherit;color:#e2e2e2}
        @keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu .3s ease both}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin .9s linear infinite;display:inline-block}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#c8cdd8;border-radius:2px}
        select option{background:#ffffff;color:#111827}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'16px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', background:C.surf, position:'sticky', top:0, zIndex:50 }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:20, letterSpacing:'-0.04em' }}>Analytics</div>
          <div style={{ fontSize:10, color:C.muted2, marginTop:1 }}>3-year performance · {monthly.length} months of data</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:10, color:C.muted2 }}>Import daily sales:</span>
          <input type="file" accept=".xlsx" onChange={e=>setImportFile(e.target.files?.[0])}
            style={{ fontSize:11, color:C.textDim, background:C.surf2, border:`1px solid ${C.border2}`, borderRadius:7, padding:'5px 8px' }} />
          <button onClick={importSalesDaily} disabled={!importFile||importing} style={{
            background: !importFile||importing ? C.surf3 : C.amber,
            color: !importFile||importing ? C.muted2 : '#0a0a0a',
            border:'none', borderRadius:7, padding:'7px 14px', fontWeight:800, fontSize:11,
            cursor: importFile&&!importing ? 'pointer':'not-allowed', fontFamily:"'Syne',sans-serif",
            display:'flex', alignItems:'center', gap:5,
          }}>
            {importing && <span className="spin">⟳</span>}
            {importing ? 'Loading…' : '⚡ Import'}
          </button>
        </div>
      </div>

      {importMsg && (
        <div style={{ padding:'10px 32px', background: importMsg.startsWith('✓') ? C.greenDim : C.redDim, borderBottom:`1px solid ${importMsg.startsWith('✓') ? C.greenBrd : C.redBrd}`, fontSize:12, color: importMsg.startsWith('✓') ? C.green : C.red, fontWeight:600 }}>
          {importMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'0 32px', display:'flex', gap:4, background:C.surf }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'12px 18px', fontSize:12, fontWeight:600, letterSpacing:'0.04em',
            background:'none', border:'none', cursor:'pointer',
            color: tab===t.id ? C.amber : C.muted2,
            borderBottom:`2px solid ${tab===t.id ? C.amber : 'transparent'}`,
            marginBottom:-1, transition:'color .15s', fontFamily:'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:400, gap:10, color:C.muted2, fontSize:13 }}>
          <span className="spin">⟳</span> Loading chart data…
        </div>
      )}

      {!loading && !hasData && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400, gap:14, padding:32 }}>
          <div style={{ fontSize:40 }}>📈</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18 }}>No data yet</div>
          <div style={{ fontSize:12, color:C.muted2, textAlign:'center', maxWidth:440, lineHeight:1.9 }}>
            Import the <b style={{color:C.text}}>Simulation_Sales_Daily_3yr.xlsx</b> file using the import button above,
            then run the SQL in <b style={{color:C.amber}}>phase2b_schema.sql</b> in Supabase first.
          </div>
        </div>
      )}

      {!loading && hasData && (
        <div style={{ padding:32 }} className="fu">

          {/* ── KPI row ─────────────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:28 }}>
            <KPI label="Total Revenue 3yr"   value={fmtM(kpis.totalRev)}   sub="SAR"              color={C.amber}  icon="💰" />
            <KPI label="Gross Profit 3yr"    value={fmtM(kpis.totalProf)}  sub="SAR"              color={C.green}  icon="📈" />
            <KPI label="Profit Margin"       value={fmtP(kpis.margin)}     sub="avg across period" color={C.teal}   icon="%" />
            <KPI label="Units Sold 3yr"      value={fmtM(kpis.totalUnits)} sub="portions"          color={C.blue}   icon="🍽" />
            <KPI label="Data Months"         value={kpis.months}           sub="monthly periods"   color={C.violet} icon="📅" />
          </div>

          {/* ── REVENUE TAB ─────────────────────────────────────────────── */}
          {tab === 'revenue' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <Card>
                <CardTitle sub="Monthly revenue, COGS, and gross profit — 3 year trend">Revenue vs COGS vs Profit</CardTitle>
                <Legend items={[{label:'Revenue',color:C.amber},{label:'COGS',color:C.red},{label:'Gross Profit',color:C.green}]} />
                <LineChart series={revSeries} height={240} />
              </Card>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <Card>
                  <CardTitle sub="Monthly units sold across all branches and products">Units Sold per Month</CardTitle>
                  <LineChart series={unitsSeries} height={180} />
                </Card>
                <Card>
                  <CardTitle sub="Monthly gross profit margin %">Profit Margin Trend</CardTitle>
                  <LineChart series={[{
                    label:'Margin %', color:C.teal,
                    data: monthly.map(r => ({ label:r.month?.slice(0,7)||'', v: Number(r.revenue)>0 ? Number(r.profit)/Number(r.revenue)*100 : 0 }))
                  }]} height={180} />
                </Card>
              </div>
            </div>
          )}

          {/* ── PRODUCTS TAB ────────────────────────────────────────────── */}
          {tab === 'products' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <Card>
                  <CardTitle sub="Total revenue contribution per product">Top Products by Revenue</CardTitle>
                  <BarChart data={topProducts} color={i => PRODUCT_COLORS[i % PRODUCT_COLORS.length]} height={180} />
                </Card>
                <Card>
                  <CardTitle sub="Ranked by cumulative revenue">Revenue Breakdown</CardTitle>
                  <BarChart data={topProducts} color={i => PRODUCT_COLORS[i % PRODUCT_COLORS.length]} horizontal height={180} />
                </Card>
              </div>
              <Card>
                <CardTitle sub="Monthly revenue per top 5 products">Product Revenue Trends</CardTitle>
                <Legend items={top5Products.map((p,i) => ({ label:p, color:PRODUCT_COLORS[i] }))} />
                <MultiLineChart
                  seriesData={productData.filter(r => top5Products.includes(r.product_name))}
                  keys={top5Products}
                  colors={PRODUCT_COLORS}
                  height={220}
                  labelKey="period_label"
                />
              </Card>
            </div>
          )}

          {/* ── BRANCHES TAB ────────────────────────────────────────────── */}
          {tab === 'branches' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <Card>
                  <CardTitle sub="Total revenue by branch — 3 years">Branch Revenue Ranking</CardTitle>
                  <BarChart data={topBranches} color={i => BRANCH_COLORS[i % BRANCH_COLORS.length]} horizontal height={240} />
                </Card>
                <Card>
                  <CardTitle sub="Revenue share by branch">Monthly Performance</CardTitle>
                  <BarChart data={topBranches} color={i => BRANCH_COLORS[i % BRANCH_COLORS.length]} height={240} />
                </Card>
              </div>
              <Card>
                <CardTitle sub="Monthly revenue trends for top 5 branches">Branch Revenue Trends</CardTitle>
                <Legend items={allBranches.map((b,i) => ({ label:b, color:BRANCH_COLORS[i] }))} />
                <MultiLineChart
                  seriesData={branchData.filter(r => allBranches.includes(r.branch_name||r.branch_code))}
                  keys={allBranches}
                  colors={BRANCH_COLORS}
                  height={220}
                  labelKey="period_label"
                />
              </Card>
            </div>
          )}

          {/* ── FORECAST TAB ────────────────────────────────────────────── */}
          {tab === 'forecast' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              {forecastSeries.length > 0 ? (
                <>
                  <Card>
                    <CardTitle sub="Predicted P50 demand vs actual units sold per month">Forecast Accuracy — Predicted vs Actual</CardTitle>
                    <Legend items={[{label:'Predicted P50',color:C.amber},{label:'Actual Sold',color:C.green}]} />
                    <LineChart series={forecastSeries} height={240} showForecast />
                  </Card>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                    <Card>
                      <CardTitle sub="Average MAPE by forecast source">Forecast Error by Source</CardTitle>
                      {(() => {
                        const obs  = forecastData.filter(r=>r.source==='observed')
                        const boot = forecastData.filter(r=>r.source==='bootstrap')
                        const mape = (arr) => {
                          const valid = arr.filter(r=>r.actual_sold!=null&&Number(r.predicted_units)>0)
                          if (!valid.length) return null
                          return valid.reduce((s,r)=>s+Math.abs(Number(r.actual_sold)-Number(r.predicted_units))/Number(r.predicted_units),0)/valid.length*100
                        }
                        const oM = mape(obs), bM = mape(boot)
                        return (
                          <div style={{ display:'flex', gap:16, marginTop:8 }}>
                            <div style={{ flex:1, background:C.greenDim, border:`1px solid ${C.greenBrd}`, borderRadius:10, padding:'16px 18px', textAlign:'center' }}>
                              <div style={{ fontSize:28, fontWeight:900, color:C.green, fontFamily:"'Syne',sans-serif" }}>{oM!=null?`${oM.toFixed(1)}%`:'—'}</div>
                              <div style={{ fontSize:10, color:C.muted2, marginTop:4 }}>Observed MAPE</div>
                              <div style={{ fontSize:10, color:C.muted2 }}>{obs.length} rows</div>
                            </div>
                            <div style={{ flex:1, background:C.blueDim, border:`1px solid ${C.blueBrd}`, borderRadius:10, padding:'16px 18px', textAlign:'center' }}>
                              <div style={{ fontSize:28, fontWeight:900, color:C.blue, fontFamily:"'Syne',sans-serif" }}>{bM!=null?`${bM.toFixed(1)}%`:'—'}</div>
                              <div style={{ fontSize:10, color:C.muted2, marginTop:4 }}>Bootstrap MAPE</div>
                              <div style={{ fontSize:10, color:C.muted2 }}>{boot.length} rows</div>
                            </div>
                          </div>
                        )
                      })()}
                    </Card>
                    <Card>
                      <CardTitle sub="Latest forecasts vs actuals">Recent Accuracy</CardTitle>
                      <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                          <thead>
                            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                              {['Date','P50','Actual','Error%'].map(h=>(
                                <th key={h} style={{ padding:'6px 10px', color:C.muted2, fontSize:9, letterSpacing:'0.08em', textAlign:'left' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {forecastData.filter(r=>r.actual_sold!=null).slice(0,12).map((r,i)=>{
                              const err = r.actual_sold!=null&&Number(r.predicted_units)>0
                                ? Math.abs(Number(r.actual_sold)-Number(r.predicted_units))/Number(r.predicted_units)*100 : null
                              return (
                                <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                                  <td style={{ padding:'6px 10px', color:C.muted2 }}>{r.forecast_date}</td>
                                  <td style={{ padding:'6px 10px', color:C.amber }}>{Number(r.predicted_units).toFixed(1)}</td>
                                  <td style={{ padding:'6px 10px', color:C.green }}>{Number(r.actual_sold).toFixed(1)}</td>
                                  <td style={{ padding:'6px 10px', color: err>30?C.red:err>15?C.amber:C.green, fontWeight:700 }}>{err!=null?`${err.toFixed(1)}%`:'—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>
                </>
              ) : (
                <Card>
                  <div style={{ textAlign:'center', padding:'40px 20px', color:C.muted2, lineHeight:1.9 }}>
                    <div style={{ fontSize:36, marginBottom:12 }}>🎯</div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color:C.textDim, marginBottom:8 }}>No forecast data yet</div>
                    Go to <a href="/forecast" style={{ color:C.amber }}>/forecast</a> and click ⚡ Generate Forecast,
                    then come back here to see predicted vs actual accuracy.
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
