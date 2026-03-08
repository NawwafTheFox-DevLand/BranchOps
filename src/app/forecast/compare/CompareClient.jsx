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

const STRATEGIES = [
  { key:'reduce',   label:'Minimize Waste',  mult:0.90, color:C.teal,   icon:'🗑', desc:'Order 10% less — accept occasional stockout' },
  { key:'balanced', label:'Balanced',         mult:1.00, color:C.amber,  icon:'⚖️', desc:'Order exactly as forecasted' },
  { key:'meet',     label:'Meet Demand',      mult:1.15, color:C.green,  icon:'📦', desc:'Order 15% more — avoid stockouts' },
]

const fmt  = n => n == null ? '—' : Math.round(Number(n)).toLocaleString()
const fmtP = n => n == null ? '—' : `${n > 0 ? '+' : ''}${Number(n).toFixed(1)}%`

function DeltaBadge({ pct, large }) {
  if (pct == null) return <span style={{ color:C.muted }}>—</span>
  const color = large ? C.red : pct > 0 ? C.green : pct < 0 ? C.teal : C.muted2
  const bg    = large ? C.redDim : pct > 0 ? C.greenDim : 'transparent'
  return (
    <span style={{ background:bg, border:`1px solid ${color}44`, color,
      borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700 }}>
      {large ? '⚠ ' : ''}{fmtP(pct)}
    </span>
  )
}

export default function CompareClient({ branches, allowedBranchId }) {
  const [branchId,   setBranchId]   = useState(allowedBranchId || branches[0]?.id || '')
  const [weekOf,     setWeekOf]     = useState('')
  const [strategy,   setStrategy]   = useState('balanced')
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (branchId) params.set('branch_id', branchId)
      if (weekOf)   params.set('week_of', weekOf)
      const res  = await fetch(`/api/forecast/compare?${params}`, { credentials:'include' })
      const json = await res.json()
      setData(json)
      if (!weekOf && json.available_weeks?.length > 0) {
        setWeekOf(json.available_weeks[0].week_of)
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [branchId, weekOf])

  const strat = STRATEGIES.find(s => s.key === strategy) || STRATEGIES[1]

  const comparisons = useMemo(() => {
    if (!data?.comparisons) return []
    let rows = data.comparisons
    if (search.trim()) {
      const s = search.toLowerCase()
      rows = rows.filter(r =>
        r.product_name?.includes(search) ||
        r.erp_code?.toLowerCase().includes(s) ||
        r.branch_name?.toLowerCase().includes(s)
      )
    }
    return [...rows].sort((a,b) => {
      if (b.large_revision !== a.large_revision) return b.large_revision ? 1 : -1
      return Math.abs(b.delta_pct||0) - Math.abs(a.delta_pct||0)
    })
  }, [data, search])

  const summary = useMemo(() => {
    if (!comparisons.length) return null
    const withBoth = comparisons.filter(r => r.d2_units != null && r.d1_units != null)
    const largeRevisions = withBoth.filter(r => r.large_revision)
    const totalD1 = withBoth.reduce((s,r) => s + r.d1_units, 0)
    const totalD2 = withBoth.reduce((s,r) => s + r.d2_units, 0)
    return { withBoth: withBoth.length, largeRevisions: largeRevisions.length, totalD1, totalD2,
             totalDelta: totalD1 - totalD2, totalOrder: Math.round(totalD1 * strat.mult) }
  }, [comparisons, strat])

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
      color:C.text, padding:'28px 24px 80px' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} select option{background:#ffffff} ::-webkit-scrollbar{width:3px;height:3px} ::-webkit-scrollbar-thumb{background:#c8cdd8}`}</style>

      <div style={{ maxWidth:1200, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:22,
            letterSpacing:'-0.03em', marginBottom:6 }}>
            D-2 vs D-1 Forecast Comparison
          </div>
          <div style={{ fontSize:11, color:C.muted2, lineHeight:1.9 }}>
            Compare Saturday (D-2) and Sunday (D-1) forecast runs · Adjust purchase orders based on revision · Large revisions (&gt;10%) flagged in red
          </div>
        </div>

        {/* Controls */}
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
          {!allowedBranchId && (
            <div style={{ flex:'1 1 180px' }}>
              <div style={{ fontSize:9, color:C.muted2, marginBottom:5, letterSpacing:'0.07em' }}>BRANCH</div>
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border2}`,
                  background:C.surf2, color:C.text, fontSize:12, fontFamily:'inherit' }}>
                <option value="">All branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ flex:'1 1 180px' }}>
            <div style={{ fontSize:9, color:C.muted2, marginBottom:5, letterSpacing:'0.07em' }}>WEEK OF</div>
            <select value={weekOf} onChange={e => setWeekOf(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border2}`,
                background:C.surf2, color:C.text, fontSize:12, fontFamily:'inherit' }}>
              <option value="">Latest</option>
              {(data?.available_weeks || []).map(w => (
                <option key={w.week_of} value={w.week_of}>
                  {w.week_of} {w.has_d2 ? '✓D-2' : '✗D-2'} {w.has_d1 ? '✓D-1' : '✗D-1'}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex:'1 1 240px' }}>
            <div style={{ fontSize:9, color:C.muted2, marginBottom:5, letterSpacing:'0.07em' }}>SEARCH PRODUCT</div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search product or branch…"
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border2}`,
                background:C.surf2, color:C.text, fontSize:12, fontFamily:'inherit', outline:'none' }} />
          </div>
          <button onClick={load}
            style={{ padding:'9px 16px', borderRadius:8, border:`1px solid ${C.amberBrd}`,
              background:C.amberDim, color:C.amber, fontWeight:700, fontSize:12,
              cursor:'pointer', fontFamily:'inherit' }}>
            {loading ? '⟳' : '↻'}
          </button>
        </div>

        {/* Strategy selector */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:9, color:C.muted2, marginBottom:8, letterSpacing:'0.07em' }}>PURCHASE STRATEGY</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {STRATEGIES.map(s => (
              <button key={s.key} onClick={() => setStrategy(s.key)}
                style={{ padding:'10px 18px', borderRadius:9, fontWeight:700, fontSize:12,
                  cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
                  border:`1px solid ${strategy===s.key ? s.color : C.border2}`,
                  background: strategy===s.key ? `${s.color}18` : C.surf2,
                  color: strategy===s.key ? s.color : C.muted2 }}>
                {s.icon} {s.label} ({s.mult}×)
              </button>
            ))}
          </div>
          <div style={{ fontSize:11, color:C.muted2, marginTop:6 }}>{strat.desc}</div>
        </div>

        {/* Summary KPIs */}
        {summary && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',
            gap:10, marginBottom:20 }}>
            {[
              { label:'Products Compared', value:summary.withBoth, color:C.blue },
              { label:'Large Revisions ⚠', value:summary.largeRevisions, color:summary.largeRevisions>0?C.red:C.green },
              { label:'D-2 Total Units',   value:fmt(summary.totalD2),   color:C.muted2 },
              { label:'D-1 Total Units',   value:fmt(summary.totalD1),   color:C.amber },
              { label:`Recommended Order (${strat.label})`, value:fmt(summary.totalOrder), color:strat.color },
            ].map(k => (
              <div key={k.label} style={{ background:C.surf, border:`1px solid ${C.border}`,
                borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:9, color:C.muted2, letterSpacing:'0.07em', marginBottom:6 }}>
                  {k.label.toUpperCase()}
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* No data state */}
        {!loading && (!data?.has_d2 && !data?.has_d1) && (
          <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14,
            padding:'48px 32px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, marginBottom:10 }}>
              No D-2 or D-1 forecasts found
            </div>
            <div style={{ fontSize:12, color:C.muted2, lineHeight:1.9 }}>
              Run the training script with <code style={{ color:C.amber }}>--run_type D-2</code> on Saturday<br/>
              and <code style={{ color:C.amber }}>--run_type D-1</code> on Sunday before each week starts.
            </div>
          </div>
        )}

        {/* Comparison table */}
        {comparisons.length > 0 && (
          <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'12px 18px', borderBottom:`1px solid ${C.border}`,
              background:C.surf2, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:13 }}>
                Comparison Table — {comparisons.length} rows
              </div>
              {data?.has_d2 && <span style={{ fontSize:10, color:C.muted2 }}>
                D-2: {comparisons[0]?.d2_run_date || '—'} · D-1: {comparisons[0]?.d1_run_date || '—'}
              </span>}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.surf3 }}>
                    {['Product','Branch','D-2 Forecast','D-1 Forecast','Change','Recommended Order','Batches','Confidence'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:9,
                        color:C.muted2, fontWeight:700, letterSpacing:'0.07em',
                        textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((r, i) => {
                    const base     = r.d1_units ?? r.d2_units ?? 0
                    const order    = Math.round(base * strat.mult)
                    const batches  = Math.max(1, Math.ceil(order / r.yield_per_batch))
                    const conf     = r.d1_confidence ?? r.d2_confidence
                    const rowBg    = r.large_revision ? 'rgba(239,68,68,0.04)' : 'transparent'

                    return (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:rowBg }}>
                        <td style={{ padding:'10px 12px', fontWeight:700 }}>
                          {r.product_name}
                          <div style={{ fontSize:9, color:C.muted2 }}>{r.erp_code}</div>
                        </td>
                        <td style={{ padding:'10px 12px', color:C.muted2 }}>{r.branch_code}</td>
                        <td style={{ padding:'10px 12px' }}>
                          {r.d2_units != null
                            ? <span style={{ color:C.muted2 }}>{fmt(r.d2_units)}</span>
                            : <span style={{ color:C.muted, fontSize:9 }}>not run</span>}
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          {r.d1_units != null
                            ? <span style={{ fontWeight:700, color:C.amber }}>{fmt(r.d1_units)}</span>
                            : <span style={{ color:C.muted, fontSize:9 }}>not run</span>}
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <DeltaBadge pct={r.delta_pct} large={r.large_revision} />
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontWeight:800, fontSize:14, color:strat.color }}>
                            {fmt(order)}
                          </span>
                          <div style={{ fontSize:9, color:C.muted2 }}>units</div>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontWeight:800, fontSize:16, color:C.green }}>{batches}</span>
                          <div style={{ fontSize:9, color:C.muted2 }}>batches</div>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          {conf != null ? (
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <div style={{ flex:1, background:C.surf3, borderRadius:999, height:4, overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${Math.round(conf*100)}%`,
                                  background: conf>0.7?C.green:conf>0.45?C.amber:C.red, borderRadius:999 }}/>
                              </div>
                              <span style={{ fontSize:10, color:C.muted2 }}>{Math.round(conf*100)}%</span>
                            </div>
                          ) : <span style={{ color:C.muted }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'12px 18px', borderTop:`1px solid ${C.border}`,
              fontSize:11, color:C.muted2, lineHeight:1.8 }}>
              ⚠ Red rows = D-1 revised by &gt;10% vs D-2 — review before placing orders ·
              Recommended order applies <b style={{ color:strat.color }}>{strat.mult}× ({strat.label})</b> multiplier to D-1 forecast
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
