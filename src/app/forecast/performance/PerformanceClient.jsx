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

const TRUST = {
  high:    { label:'High',    color:C.green,  bg:C.greenDim, brd:C.greenBrd, icon:'✅' },
  medium:  { label:'Medium',  color:C.amber,  bg:C.amberDim, brd:C.amberBrd, icon:'⚠️' },
  low:     { label:'Low',     color:C.red,    bg:C.redDim,   brd:C.redBrd,   icon:'❌' },
  unknown: { label:'No data', color:C.muted2, bg:'transparent', brd:C.border, icon:'—'  },
}

const fmt  = n => n == null ? '—' : Math.round(Number(n)).toLocaleString()
const fmtP = n => n == null ? '—' : `${Number(n).toFixed(1)}%`

function MiniChart({ weeks }) {
  if (!weeks || weeks.length < 2) return (
    <div style={{ height:50, display:'flex', alignItems:'center', justifyContent:'center',
      color:C.muted, fontSize:10 }}>No actuals yet</div>
  )
  const W=300, H=50, PAD=8
  const iW=W-PAD*2, iH=H-PAD*2
  const maxV = Math.max(...weeks.flatMap(w=>[w.predicted||0, w.actual||0]), 1)
  const xs = weeks.map((_,i) => PAD + (i/(weeks.length-1||1))*iW)
  const vy = v => PAD + iH - (v/maxV)*iH
  const line = (key, color) => {
    const pts = weeks.map((w,i) => w[key]!=null ? `${xs[i]},${vy(w[key])}` : null).filter(Boolean)
    if (pts.length < 2) return null
    return <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:50 }}>
      {line('predicted', C.amber)}
      {line('actual', C.green)}
      {weeks.map((w,i) => w.actual!=null && (
        <circle key={i} cx={xs[i]} cy={vy(w.actual)} r="2.5" fill={C.green}/>
      ))}
    </svg>
  )
}

function TrustBadge({ trust }) {
  const t = TRUST[trust] || TRUST.unknown
  return (
    <span style={{ background:t.bg, border:`1px solid ${t.brd}`, color:t.color,
      borderRadius:5, padding:'3px 8px', fontSize:10, fontWeight:700 }}>
      {t.icon} {t.label}
    </span>
  )
}

function BiasBar({ bias, dir }) {
  if (bias == null) return <span style={{ color:C.muted }}>—</span>
  const color = dir==='over' ? C.amber : dir==='under' ? C.blue : C.green
  const label = dir==='over' ? `+${fmt(bias)} over-predicts` : dir==='under' ? `${fmt(bias)} under-predicts` : 'Balanced'
  return <span style={{ color, fontSize:11 }}>{label}</span>
}

export default function PerformanceClient({ branches, products, allowedBranchId }) {
  const [branchId,  setBranchId]  = useState(allowedBranchId || '')
  const [productId, setProductId] = useState('')
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [expanded,  setExpanded]  = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (branchId)  p.set('branch_id',  branchId)
      if (productId) p.set('product_id', productId)
      const res  = await fetch(`/api/forecast/performance?${p}`, { credentials:'include' })
      const json = await res.json()
      setData(json)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [branchId, productId])

  const rows = useMemo(() => {
    if (!data?.performance) return []
    let r = data.performance
    if (search.trim()) {
      const s = search.toLowerCase()
      r = r.filter(p => p.product_name?.includes(search) || p.erp_code?.toLowerCase().includes(s) || p.branch_name?.toLowerCase().includes(s))
    }
    return [...r].sort((a,b) => {
      const ta = {low:0,medium:1,high:2,unknown:-1}
      return (ta[a.trust]||0) - (ta[b.trust]||0)
    })
  }, [data, search])

  const summary = useMemo(() => {
    if (!rows.length) return null
    const withMape = rows.filter(r => r.mape != null)
    return {
      total: rows.length,
      high:  rows.filter(r=>r.trust==='high').length,
      medium:rows.filter(r=>r.trust==='medium').length,
      low:   rows.filter(r=>r.trust==='low').length,
      avgMape: withMape.length ? Math.round(withMape.reduce((s,r)=>s+r.mape,0)/withMape.length*10)/10 : null,
    }
  }, [rows])

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, padding:'28px 24px 80px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif" }}>
      <style>{`*{box-sizing:border-box} select option{background:#ffffff} ::-webkit-scrollbar{width:3px;height:3px} ::-webkit-scrollbar-thumb{background:#c8cdd8}`}</style>

      <div style={{ maxWidth:1200, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:22,
            letterSpacing:'-0.03em', marginBottom:6 }}>Forecast Model Performance</div>
          <div style={{ fontSize:11, color:C.muted2 }}>
            Trust metrics · Bias analysis · Purchase recommendations per product × branch
          </div>
        </div>

        {/* Controls */}
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          {!allowedBranchId && (
            <select value={branchId} onChange={e=>setBranchId(e.target.value)}
              style={{ flex:'1 1 180px', padding:'9px 12px', borderRadius:8,
                border:`1px solid ${C.border2}`, background:C.surf2, color:C.text,
                fontSize:12, fontFamily:'inherit' }}>
              <option value="">All branches</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
            </select>
          )}
          <select value={productId} onChange={e=>setProductId(e.target.value)}
            style={{ flex:'1 1 180px', padding:'9px 12px', borderRadius:8,
              border:`1px solid ${C.border2}`, background:C.surf2, color:C.text,
              fontSize:12, fontFamily:'inherit' }}>
            <option value="">All products</option>
            {products.map(p=><option key={p.id} value={p.id}>{p.name_ar}</option>)}
          </select>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search product or branch…"
            style={{ flex:'1 1 200px', padding:'9px 12px', borderRadius:8,
              border:`1px solid ${C.border2}`, background:C.surf2, color:C.text,
              fontSize:12, fontFamily:'inherit', outline:'none' }} />
          <button onClick={load} style={{ padding:'9px 16px', borderRadius:8,
            border:`1px solid ${C.amberBrd}`, background:C.amberDim,
            color:C.amber, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            {loading ? '⟳' : '↻'}
          </button>
        </div>

        {/* Summary KPIs */}
        {summary && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',
            gap:10, marginBottom:20 }}>
            {[
              { label:'Total Models',   value:summary.total,   color:C.blue  },
              { label:'✅ High Trust',  value:summary.high,    color:C.green },
              { label:'⚠️ Medium',      value:summary.medium,  color:C.amber },
              { label:'❌ Low Trust',   value:summary.low,     color:C.red   },
              { label:'Avg MAPE',       value:summary.avgMape!=null?`${summary.avgMape}%`:'—', color:summary.avgMape<20?C.green:summary.avgMape<35?C.amber:C.red },
            ].map(k=>(
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

        {/* No data */}
        {!loading && rows.length === 0 && (
          <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14,
            padding:'48px 32px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🎯</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, marginBottom:10 }}>
              No performance data yet
            </div>
            <div style={{ fontSize:12, color:C.muted2, lineHeight:1.9 }}>
              Performance metrics appear after actuals are recorded.<br/>
              Run the training script then log actual sales in the system.
            </div>
          </div>
        )}

        {/* Performance table */}
        {rows.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {rows.map((r, i) => {
              const isExp = expanded === i
              const trust = TRUST[r.trust] || TRUST.unknown
              return (
                <div key={i} style={{ background:C.surf, border:`1px solid ${isExp?C.border2:C.border}`,
                  borderRadius:14, overflow:'hidden', transition:'border-color 0.2s' }}>

                  {/* Row header */}
                  <div onClick={() => setExpanded(isExp ? null : i)}
                    style={{ padding:'14px 20px', cursor:'pointer', display:'flex',
                      alignItems:'center', gap:16, flexWrap:'wrap' }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surf2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>

                    {/* Product + branch */}
                    <div style={{ flex:'2 1 200px' }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{r.product_name}</div>
                      <div style={{ fontSize:10, color:C.muted2, marginTop:2 }}>
                        {r.erp_code} · {r.branch_code} {r.branch_name}
                      </div>
                    </div>

                    {/* Trust */}
                    <div style={{ flex:'0 0 auto' }}>
                      <TrustBadge trust={r.trust} />
                    </div>

                    {/* MAPE */}
                    <div style={{ flex:'0 0 90px', textAlign:'center' }}>
                      <div style={{ fontSize:9, color:C.muted2, marginBottom:3 }}>MAPE</div>
                      <div style={{ fontWeight:800, fontSize:16,
                        color:r.trust==='high'?C.green:r.trust==='medium'?C.amber:C.red }}>
                        {fmtP(r.mape)}
                      </div>
                    </div>

                    {/* MAE */}
                    <div style={{ flex:'0 0 90px', textAlign:'center' }}>
                      <div style={{ fontSize:9, color:C.muted2, marginBottom:3 }}>MAE (units)</div>
                      <div style={{ fontWeight:700, fontSize:14, color:C.textDim }}>{fmt(r.mae)}</div>
                    </div>

                    {/* Model */}
                    <div style={{ flex:'0 0 auto' }}>
                      <span style={{ background:C.surf3, border:`1px solid ${C.border2}`,
                        color:C.teal, borderRadius:5, padding:'3px 8px', fontSize:10, fontWeight:700 }}>
                        {r.model_type || '—'}
                      </span>
                    </div>

                    {/* Mini chart */}
                    <div style={{ flex:'1 1 120px', minWidth:100 }}>
                      <MiniChart weeks={r.weeks} />
                    </div>

                    <div style={{ fontSize:11, color:C.muted, flexShrink:0 }}>{isExp?'▲':'▼'}</div>
                  </div>

                  {/* Expanded details */}
                  {isExp && (
                    <div style={{ borderTop:`1px solid ${C.border}`, padding:'20px 24px',
                      background:C.surf2, display:'grid',
                      gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>

                      {/* Bias analysis */}
                      <div>
                        <div style={{ fontSize:10, color:C.muted2, fontWeight:700,
                          letterSpacing:'0.07em', marginBottom:10 }}>BIAS ANALYSIS</div>
                        <div style={{ fontSize:12, marginBottom:8 }}>
                          <BiasBar bias={r.avg_bias} dir={r.bias_dir} />
                        </div>
                        <div style={{ fontSize:11, color:C.muted2, lineHeight:1.8 }}>
                          {r.accuracy_trend != null && (
                            <div>Accuracy trend: <span style={{ color:r.accuracy_trend<0?C.green:C.red }}>
                              {r.accuracy_trend>0?'↑ Worsening':'↓ Improving'} ({fmtP(Math.abs(r.accuracy_trend))})
                            </span></div>
                          )}
                          {r.best_week && <div>Best week: <span style={{ color:C.green }}>{r.best_week.week_start} ({fmtP(r.best_week.error_pct)} error)</span></div>}
                          {r.worst_week && <div>Worst week: <span style={{ color:C.red }}>{r.worst_week.week_start} ({fmtP(r.worst_week.error_pct)} error)</span></div>}
                        </div>
                      </div>

                      {/* Recommendation */}
                      <div>
                        <div style={{ fontSize:10, color:C.muted2, fontWeight:700,
                          letterSpacing:'0.07em', marginBottom:10 }}>PURCHASE RECOMMENDATION</div>
                        <div style={{ background:trust.bg, border:`1px solid ${trust.brd}`,
                          borderRadius:10, padding:'14px 16px', fontSize:12,
                          color:trust.color, lineHeight:1.7 }}>
                          {r.recommendation}
                        </div>
                        <div style={{ marginTop:10, fontSize:11, color:C.muted2 }}>
                          Model trained: {r.trained_at ? new Date(r.trained_at).toLocaleDateString() : '—'}
                        </div>
                      </div>

                      {/* Weekly error table */}
                      {r.weeks.length > 0 && (
                        <div style={{ gridColumn:'1/-1' }}>
                          <div style={{ fontSize:10, color:C.muted2, fontWeight:700,
                            letterSpacing:'0.07em', marginBottom:10 }}>WEEKLY BREAKDOWN</div>
                          <div style={{ overflowX:'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                              <thead>
                                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                                  {['Week','Predicted','Actual','Error %','Bias'].map(h=>(
                                    <th key={h} style={{ padding:'6px 10px', textAlign:'left',
                                      fontSize:9, color:C.muted2, fontWeight:700,
                                      letterSpacing:'0.07em', textTransform:'uppercase' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {r.weeks.map((w,j)=>(
                                  <tr key={j} style={{ borderBottom:`1px solid ${C.border}` }}>
                                    <td style={{ padding:'6px 10px', color:C.muted2 }}>{w.week_start}</td>
                                    <td style={{ padding:'6px 10px', color:C.amber }}>{fmt(w.predicted)}</td>
                                    <td style={{ padding:'6px 10px', color:C.green }}>{fmt(w.actual)}</td>
                                    <td style={{ padding:'6px 10px',
                                      color:w.error_pct<15?C.green:w.error_pct<30?C.amber:C.red }}>
                                      {fmtP(w.error_pct)}
                                    </td>
                                    <td style={{ padding:'6px 10px',
                                      color:w.bias>0?C.amber:w.bias<0?C.blue:C.muted2 }}>
                                      {w.bias!=null?(w.bias>0?'+':'')+fmt(w.bias):'—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
