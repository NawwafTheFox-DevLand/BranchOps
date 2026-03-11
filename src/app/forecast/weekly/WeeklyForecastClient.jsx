'use client'
import { useState, useEffect } from 'react'

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

const MODEL_META = {
  wma:          { label:'WMA',          color:C.teal,   desc:'Optimized WMA · Auto-tuned decay λ via grid-search CV · Conformal CI · Best cold-start model (≥4w)' },
  holt_winters: { label:'Holt-Winters', color:C.blue,   desc:'ETS · Auto-selects trend/damped/no-trend by AIC · Walk-forward CV · Conformal CI (≥8w)' },
  theta:        { label:'Theta',        color:C.violet, desc:'Theta method · Linear trend + SES variation · Robust for noisy series · Equivalent to SES+drift (≥8w)' },
  lgbm:         { label:'LightGBM',     color:C.green,  desc:'Gradient boosting · Lag features (1,2,4,8w) + Saudi calendar · L1+L2 regularization · Walk-forward CV (≥26w)' },
  sarimax:      { label:'SARIMAX',      color:C.amber,  desc:'Seasonal ARIMA · AIC forward stepwise variable selection · Tests: is_ramadan, week_sin/cos, is_eid, is_summer (≥52w)' },
  ensemble:     { label:'Ensemble',     color:C.red,    desc:'Inverse-MAPE weighted average of all trained models · Lower MAPE → higher weight · Most robust' },
}

const fmt  = n => n == null ? '—' : Math.round(Number(n)).toLocaleString()
const fmt1 = n => n == null ? '—' : Number(n).toFixed(1)
const fmtPct = n => n == null ? '—' : Number(n).toFixed(1) + '%'

function Badge({ label, color, small }) {
  return <span style={{ background:`${color}18`, border:`1px solid ${color}44`, color, borderRadius:4, padding:small?'1px 6px':'3px 9px', fontSize:small?9:10, fontWeight:700, letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{label}</span>
}

function ConfBar({ value, max=100, color=C.amber, height=4 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ background:C.surf3, borderRadius:999, height, overflow:'hidden', flex:1 }}>
      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:999 }}/>
    </div>
  )
}

function MAPEBadge({ mape }) {
  if (mape == null) return <span style={{ color:C.muted2 }}>—</span>
  const color = mape < 10 ? C.green : mape < 20 ? C.amber : C.red
  return <Badge label={`MAPE ${fmtPct(mape)}`} color={color} small/>
}

function VarChip({ name, delta }) {
  const color = delta < -2 ? C.green : delta < 0 ? C.teal : C.muted2
  return (
    <span style={{ background:`${color}14`, border:`1px solid ${color}33`, color, borderRadius:4, padding:'2px 7px', fontSize:9, fontWeight:600, marginRight:4, marginBottom:3, display:'inline-block' }}>
      {name} {delta !== undefined ? `ΔAIC ${delta > 0 ? '+' : ''}${delta}` : '✓'}
    </span>
  )
}

// Mini sparkline SVG
function Sparkline({ values, color=C.amber, width=120, height=36 }) {
  if (!values || values.length < 2) return null
  const vals = values.map(v => Number(v) || 0)
  const max  = Math.max(...vals, 1)
  const min  = Math.min(...vals, 0)
  const range = max - min || 1
  const pts  = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ overflow:'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r="2.5" fill={color}/>
    </svg>
  )
}

// Confidence interval bar chart for one week
function CIBar({ lo80, mid, hi80, maxVal, color }) {
  if (!mid || !maxVal) return null
  const pct = v => `${Math.min(100, (v / maxVal) * 100)}%`
  return (
    <div style={{ position:'relative', height:18, background:C.surf3, borderRadius:3, overflow:'hidden' }}>
      {/* 80% CI band */}
      <div style={{ position:'absolute', left:pct(lo80), width:`calc(${pct(hi80)} - ${pct(lo80)})`, height:'100%', background:`${color}22`, borderLeft:`1px solid ${color}44`, borderRight:`1px solid ${color}44` }}/>
      {/* Point estimate */}
      <div style={{ position:'absolute', left:`calc(${pct(mid)} - 1px)`, width:2, height:'100%', background:color }}/>
    </div>
  )
}

export default function WeeklyForecastClient({ branches, products }) {
  const [branchId,    setBranchId]    = useState(branches[0]?.id || '')
  const [productId,   setProductId]   = useState('')
  const [loading,     setLoading]     = useState(false)
  const [forecasts,   setForecasts]   = useState([])
  const [models,      setModels]      = useState([])
  const [activeTab,   setActiveTab]   = useState('table')   // table | chart | models
  const [safetyMult,  setSafetyMult]  = useState(1.15)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ weeks: '8' })
      if (branchId)  params.append('branch_id', branchId)
      if (productId) params.append('product_id', productId)
      const res  = await fetch(`/api/forecast/weekly?${params}`, { credentials: 'include' })
      const data = await res.json()
      setForecasts(data.forecasts || [])

      const mres  = await fetch(`/api/forecast/models?${params}`, { credentials: 'include' })
      const mdata = await mres.json()
      setModels(mdata.models || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [branchId, productId])

  // Group forecasts by product
  const byProduct = {}
  for (const f of forecasts) {
    const pid = f.products?.id
    if (!pid) continue
    if (!byProduct[pid]) byProduct[pid] = { product: f.products, weeks: [] }
    byProduct[pid].weeks.push(f)
  }

  // Get all unique week labels in order
  const allWeeks = [...new Set(forecasts.map(f => f.week_start))].sort()

  // Model lookup by product
  const modelByProduct = {}
  for (const m of models) {
    const pid = m.products?.id
    if (!pid) continue
    if (!modelByProduct[pid]) modelByProduct[pid] = []
    modelByProduct[pid].push(m)
  }

  const noData = !loading && Object.keys(byProduct).length === 0

  const selBranch = branches.find(b => b.id === branchId)

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text, padding:'28px 24px 80px' }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.fu{animation:fu .2s ease both}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#252d35;border-radius:2px}.rh:hover{background:rgba(255,255,255,0.02)!important}select option{background:#ffffff}`}</style>

      <div style={{ maxWidth:1100, margin:'0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:22, letterSpacing:'-0.03em' }}>Weekly Demand Forecast</div>
            <Badge label="v4.0 · WMA · HW · Theta · LightGBM · SARIMAX · Ensemble" color={C.amber}/>
          </div>
          <div style={{ fontSize:11, color:C.muted2, lineHeight:1.9 }}>
            Trained via train_forecast.py · 5-fold walk-forward CV · AIC variable selection · Conformal prediction intervals · 8-week horizon · 1.15× safety factor
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:'1 1 200px' }}>
            <div style={{ fontSize:9, color:C.muted2, marginBottom:5, letterSpacing:'0.07em' }}>BRANCH</div>
            <select value={branchId} onChange={e => setBranchId(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border2}`, background:C.surf2, color:C.text, fontSize:12, fontFamily:'inherit' }}>
              <option value="">All branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
            </select>
          </div>
          <div style={{ flex:'1 1 200px' }}>
            <div style={{ fontSize:9, color:C.muted2, marginBottom:5, letterSpacing:'0.07em' }}>PRODUCT</div>
            <select value={productId} onChange={e => setProductId(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border2}`, background:C.surf2, color:C.text, fontSize:12, fontFamily:'inherit' }}>
              <option value="">All products</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
            </select>
          </div>
          <div style={{ flex:'0 0 160px' }}>
            <div style={{ fontSize:9, color:C.muted2, marginBottom:5, letterSpacing:'0.07em' }}>SAFETY FACTOR</div>
            <select value={safetyMult} onChange={e => setSafetyMult(Number(e.target.value))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border2}`, background:C.surf2, color:C.text, fontSize:12, fontFamily:'inherit' }}>
              <option value={1.0}>1.0× — Exact</option>
              <option value={1.1}>1.1× — Conservative</option>
              <option value={1.15}>1.15× — Default</option>
              <option value={1.2}>1.2× — Buffer</option>
              <option value={1.3}>1.3× — High safety</option>
            </select>
          </div>
          <button onClick={load} style={{ flex:'0 0 auto', padding:'9px 18px', borderRadius:8, border:`1px solid ${C.amberBrd}`, background:C.amberDim, color:C.amber, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            {loading ? '⟳' : '↻ Refresh'}
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:`1px solid ${C.border}`, paddingBottom:0 }}>
          {[['table','📋 Forecast Table'],['chart','📈 Trend Chart'],['models','🔬 Model Details']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{ padding:'9px 16px', border:'none', borderBottom: activeTab===key ? `2px solid ${C.amber}` : '2px solid transparent', background:'none', color: activeTab===key ? C.amber : C.muted2, fontWeight: activeTab===key ? 700 : 500, fontSize:11, cursor:'pointer', fontFamily:'inherit', marginBottom:-1 }}>
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign:'center', padding:'60px 0', color:C.muted2, fontSize:12 }}>
            Loading forecasts…
          </div>
        )}

        {noData && !loading && (
          <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'40px 32px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🤖</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, marginBottom:10 }}>No forecast data yet</div>
            <div style={{ fontSize:12, color:C.muted2, lineHeight:1.9, maxWidth:480, margin:'0 auto' }}>
              Run the Python training script to generate forecasts.<br/>
              <code style={{ background:C.surf2, padding:'2px 8px', borderRadius:4, color:C.amber, fontSize:11 }}>python train_forecast.py</code>
              <br/><br/>
              The script trains Prophet, SARIMAX (with AIC variable selection), and Holt-Winters models,
              evaluates them on a 4-week hold-out, picks the best per product, and stores
              8 weeks of forecasts + batch recommendations here.
            </div>
            <div style={{ marginTop:20, padding:'14px 18px', background:C.surf2, borderRadius:10, textAlign:'left', maxWidth:560, margin:'20px auto 0', fontSize:11, color:C.muted2, lineHeight:1.9 }}>
              <div style={{ fontWeight:700, color:C.text, marginBottom:8 }}>Setup (one time):</div>
              <div><span style={{ color:C.amber }}>1.</span> pip install pandas openpyxl numpy statsmodels pmdarima lightgbm supabase</div>
              <div><span style={{ color:C.amber }}>2.</span> python3 train_forecast.py --source excel \</div>
              <div style={{ paddingLeft:16 }}>--sales تاريخ_المخزون_2yr.xlsx \</div>
              <div style={{ paddingLeft:16 }}>--models wma,holt_winters,theta,lgbm,ensemble</div>
              <div><span style={{ color:C.amber }}>3.</span> Refresh this page</div>
              <div style={{ marginTop:8, color:C.muted, fontSize:10 }}>
                v4.0: Optimized-λ WMA · Holt-Winters · Theta · LightGBM (L1+L2) · SARIMAX · Ensemble · 5-fold walk-forward CV · Conformal CI
              </div>
            </div>
          </div>
        )}

        {/* ══ FORECAST TABLE ══ */}
        {activeTab === 'table' && !loading && Object.keys(byProduct).length > 0 && (
          <div className="fu">
            {Object.entries(byProduct).map(([pid, { product, weeks }]) => {
              const sorted  = [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start))
              const mapeVal = modelByProduct[pid]?.[0]?.mape
              const modelType = sorted[0]?.model_type
              const mm = MODEL_META[modelType] || MODEL_META.wma
              const sparkVals = sorted.map(w => w.predicted_units)
              const maxUnits  = Math.max(...sorted.map(w => w.predicted_hi80 || w.predicted_units || 0), 1)

              return (
                <div key={pid} style={{ marginBottom:24, background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                  {/* Product header */}
                  <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.surf2, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:160 }}>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14 }}>{product.name_ar}</div>
                      <div style={{ fontSize:10, color:C.muted2, marginTop:2 }}>SKU {product.erp_code} · Yield {product.yield_per_batch || '?'} units/batch</div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <Badge label={mm.label} color={mm.color} small/>
                      <MAPEBadge mape={mapeVal}/>
                      {selBranch && <Badge label={selBranch.code} color={C.muted2} small/>}
                    </div>
                    <Sparkline values={sparkVals} color={mm.color}/>
                  </div>

                  {/* Week columns */}
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                      <thead>
                        <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.surf3 }}>
                          <th style={{ padding:'8px 14px', textAlign:'left', fontSize:9, color:C.muted2, letterSpacing:'0.07em', textTransform:'uppercase', whiteSpace:'nowrap', fontWeight:600 }}>WEEK</th>
                          <th style={{ padding:'8px 12px', textAlign:'right', fontSize:9, color:C.muted2, letterSpacing:'0.07em', textTransform:'uppercase', whiteSpace:'nowrap', fontWeight:600 }}>FORECAST</th>
                          <th style={{ padding:'8px 12px', textAlign:'center', fontSize:9, color:C.muted2, letterSpacing:'0.07em', textTransform:'uppercase', whiteSpace:'nowrap', fontWeight:600, minWidth:120 }}>80% CI</th>
                          <th style={{ padding:'8px 12px', textAlign:'right', fontSize:9, color:C.muted2, letterSpacing:'0.07em', textTransform:'uppercase', whiteSpace:'nowrap', fontWeight:600 }}>BATCHES×{safetyMult}</th>
                          <th style={{ padding:'8px 12px', textAlign:'right', fontSize:9, color:C.muted2, letterSpacing:'0.07em', textTransform:'uppercase', whiteSpace:'nowrap', fontWeight:600 }}>ACTUAL</th>
                          <th style={{ padding:'8px 12px', textAlign:'center', fontSize:9, color:C.muted2, letterSpacing:'0.07em', textTransform:'uppercase', whiteSpace:'nowrap', fontWeight:600 }}>CONFIDENCE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((w, i) => {
                          const yieldPb = product.yield_per_batch || 14
                          const adjBatches = Math.max(1, Math.ceil((w.predicted_hi80 || w.predicted_units || 0) * safetyMult / yieldPb))
                          const hasActual = w.actual_units != null
                          const err = hasActual ? Math.abs((w.actual_units - w.predicted_units) / (w.predicted_units || 1)) * 100 : null

                          return (
                            <tr key={i} className="rh" style={{ borderBottom:`1px solid ${C.border}` }}>
                              <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                                <div style={{ fontWeight:700, fontSize:11 }}>{w.week_label || w.week_start}</div>
                                <div style={{ fontSize:9, color:C.muted2 }}>{w.week_start}</div>
                              </td>
                              <td style={{ padding:'10px 12px', textAlign:'right' }}>
                                <span style={{ fontWeight:800, fontSize:14, color:mm.color }}>{fmt(w.predicted_units)}</span>
                                <div style={{ fontSize:9, color:C.muted2 }}>units</div>
                              </td>
                              <td style={{ padding:'10px 12px' }}>
                                <CIBar lo80={w.predicted_lo80} mid={w.predicted_units} hi80={w.predicted_hi80} maxVal={maxUnits} color={mm.color}/>
                                <div style={{ fontSize:9, color:C.muted2, marginTop:3, textAlign:'center' }}>
                                  {fmt(w.predicted_lo80)} – {fmt(w.predicted_hi80)}
                                </div>
                              </td>
                              <td style={{ padding:'10px 12px', textAlign:'right' }}>
                                <span style={{ fontWeight:800, fontSize:16, color:C.green }}>{adjBatches}</span>
                                <div style={{ fontSize:9, color:C.muted2 }}>batches</div>
                              </td>
                              <td style={{ padding:'10px 12px', textAlign:'right' }}>
                                {hasActual ? (
                                  <>
                                    <span style={{ fontWeight:700, color: err < 10 ? C.green : err < 20 ? C.amber : C.red }}>{fmt(w.actual_units)}</span>
                                    <div style={{ fontSize:9, color: err < 10 ? C.green : err < 20 ? C.amber : C.red }}>err {fmtPct(err)}</div>
                                  </>
                                ) : <span style={{ color:C.muted }}>pending</span>}
                              </td>
                              <td style={{ padding:'10px 12px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <ConfBar value={(w.confidence || 0) * 100} max={100} color={w.confidence > 0.7 ? C.green : w.confidence > 0.45 ? C.amber : C.red}/>
                                  <span style={{ fontSize:10, color:C.muted2, minWidth:28 }}>{w.confidence ? Math.round(w.confidence * 100) + '%' : '—'}</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══ TREND CHART ══ */}
        {activeTab === 'chart' && !loading && Object.keys(byProduct).length > 0 && (
          <div className="fu">
            {Object.entries(byProduct).map(([pid, { product, weeks }]) => {
              const sorted = [...weeks].sort((a,b) => a.week_start.localeCompare(b.week_start))
              const mm = MODEL_META[sorted[0]?.model_type] || MODEL_META.wma
              const W=900, H=220, PAD={t:20,r:20,b:40,l:55}
              const iW=W-PAD.l-PAD.r, iH=H-PAD.t-PAD.b
              const allVals = sorted.flatMap(w => [w.predicted_units, w.predicted_hi80, w.actual_units].filter(Boolean))
              const maxV = Math.max(...allVals, 1)
              const xs = sorted.map((_, i) => PAD.l + (i/(sorted.length-1||1))*iW)
              const vy = v => PAD.t + iH - (v/maxV)*iH
              const linePts = sorted.map((w,i) => `${xs[i]},${vy(w.predicted_units||0)}`).join(' ')
              const hiPts   = sorted.map((w,i) => `${xs[i]},${vy(w.predicted_hi80||w.predicted_units||0)}`).join(' ')
              const loPts   = sorted.map((w,i) => `${xs[i]},${vy(w.predicted_lo80||w.predicted_units||0)}`).join(' ')
              const yTicks  = 4
              return (
                <div key={pid} style={{ marginBottom:24, background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                  <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, background:C.surf2, display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14 }}>{product.name_ar}</div>
                    </div>
                    <Badge label={mm.label} color={mm.color} small/>
                    <div style={{ display:'flex', gap:14, fontSize:10, color:C.muted2 }}>
                      <span><span style={{ color:mm.color }}>——</span> Forecast</span>
                      <span><span style={{ color:`${mm.color}55` }}>▓</span> 80% CI</span>
                      {sorted.some(w=>w.actual_units) && <span><span style={{ color:C.green }}>●</span> Actual</span>}
                    </div>
                  </div>
                  <div style={{ padding:'16px 16px 8px' }}>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:H }}>
                      {/* Y grid */}
                      {Array.from({length:yTicks},(_,i)=>maxV/yTicks*(i+1)).map((v,i) => (
                        <g key={i}>
                          <line x1={PAD.l} y1={vy(v)} x2={W-PAD.r} y2={vy(v)} stroke={C.border2} strokeWidth="0.5" strokeDasharray="3 3"/>
                          <text x={PAD.l-6} y={vy(v)+4} textAnchor="end" fontSize="9" fill={C.muted2}>{Math.round(v)}</text>
                        </g>
                      ))}
                      {/* CI band */}
                      <defs>
                        <linearGradient id={`ci_${pid}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={mm.color} stopOpacity="0.12"/>
                          <stop offset="100%" stopColor={mm.color} stopOpacity="0.03"/>
                        </linearGradient>
                      </defs>
                      <polygon
                        points={[
                          ...sorted.map((w,i) => `${xs[i]},${vy(w.predicted_hi80||w.predicted_units||0)}`),
                          ...[...sorted].reverse().map((w,i) => `${xs[sorted.length-1-i]},${vy(w.predicted_lo80||w.predicted_units||0)}`)
                        ].join(' ')}
                        fill={`url(#ci_${pid})`} stroke={`${mm.color}33`} strokeWidth="0.5"
                      />
                      {/* Forecast line */}
                      <polyline points={linePts} fill="none" stroke={mm.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                      {/* Actual dots */}
                      {sorted.map((w,i) => w.actual_units != null && (
                        <circle key={i} cx={xs[i]} cy={vy(w.actual_units)} r="4" fill={C.green} stroke={C.bg} strokeWidth="1.5"/>
                      ))}
                      {/* X labels */}
                      {sorted.map((w,i) => (
                        <text key={i} x={xs[i]} y={H-6} textAnchor="middle" fontSize="8" fill={C.muted2}>
                          {w.week_label?.split(' · ')[1] || w.week_start?.slice(5)}
                        </text>
                      ))}
                    </svg>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══ MODEL DETAILS ══ */}
        {activeTab === 'models' && !loading && (
          <div className="fu">
            {/* Methodology cards — v4.0 */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
              {[
                { key:'wma', extra: <>Min weeks: <b>4</b> · λ grid-searched ∈ [0.50–0.99] · Flat forecast with conformal CI</> },
                { key:'holt_winters', extra: <>Min weeks: <b>8</b> · Auto-selects trend / damped / no-trend by AIC · Conformal CI</> },
                { key:'theta', extra: <>Min weeks: <b>8</b> · θ=0 linear trend + θ=2 SES · Robust for noisy series</> },
                { key:'lgbm', extra: <>Min weeks: <b>26</b> · Lags: 1,2,4,8w · Calendar: Ramadan, Eid, salary-week, school · L1=0.1 L2=1.0</> },
                { key:'sarimax', extra: <>Min weeks: <b>52</b> · Variables tested: <span style={{ color:C.teal }}>is_ramadan · week_sin/cos · is_eid · is_summer · is_holiday</span> · ΔAIC threshold: −2</> },
                { key:'ensemble', extra: <>Weights = 1/MAPE (normalised) · Needs ≥ 2 models · Lowest variance across all approaches</> },
              ].map(({ key, extra }) => {
                const mm = MODEL_META[key]
                return (
                  <div key={key} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <Badge label={mm.label} color={mm.color}/>
                    </div>
                    <div style={{ fontSize:11, color:C.muted2, lineHeight:1.8, marginBottom:8 }}>{mm.desc.split('·').slice(1).join('·').trim() || mm.desc}</div>
                    <div style={{ fontSize:10, color:C.textDim, lineHeight:1.8, borderTop:`1px solid ${C.border}`, paddingTop:8 }}>{extra}</div>
                  </div>
                )
              })}
            </div>

            {/* Per-product model results */}
            {models.length === 0 ? (
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:'32px', textAlign:'center', color:C.muted2 }}>
                No trained models found. Run <code style={{ color:C.amber }}>python train_forecast.py</code> first.
              </div>
            ) : (
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'12px 18px', borderBottom:`1px solid ${C.border}`, background:C.surf2, fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:13 }}>
                  Active Models — v4.0 Walk-Forward CV Results
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.surf3 }}>
                        {['Product','Branch','Model','CV MAPE','MAE','AIC / λ','Model Details','Trained'].map(h => (
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:9, color:C.muted2, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {models.map((m, i) => {
                        const mm = MODEL_META[m.model_type] || MODEL_META.wma
                        const vars = typeof m.selected_vars === 'string' ? JSON.parse(m.selected_vars || '[]') : (m.selected_vars || [])
                        const aicScores = typeof m.var_aic_scores === 'string' ? JSON.parse(m.var_aic_scores || '{}') : (m.var_aic_scores || {})
                        const mp = typeof m.model_params === 'string' ? (() => { try { return JSON.parse(m.model_params) } catch { return {} } })() : (m.model_params || {})
                        const cvMape = mp.cv_mape ?? m.mape

                        // Model-specific detail cell
                        let detailCell = null
                        if (m.model_type === 'wma') {
                          detailCell = mp.lambda != null ? <span style={{ color:C.teal }}>λ={Number(mp.lambda).toFixed(3)}</span> : null
                        } else if (m.model_type === 'holt_winters') {
                          detailCell = <span style={{ color:C.muted2 }}>trend={mp.trend||'add'} damped={mp.damped?'✓':'✗'}</span>
                        } else if (m.model_type === 'theta') {
                          detailCell = mp.alpha != null ? <span style={{ color:C.violet }}>SES α={Number(mp.alpha).toFixed(2)} slope={Number(mp.slope||0).toFixed(2)}</span> : null
                        } else if (m.model_type === 'lgbm') {
                          const features = mp.top_features || []
                          detailCell = features.length > 0 ? (
                            <span>{features.slice(0,3).map(f => <VarChip key={f} name={f}/>)}</span>
                          ) : null
                        } else if (m.model_type === 'sarimax') {
                          detailCell = vars.length > 0 ? vars.map(v => (
                            <VarChip key={v} name={v} delta={aicScores[v]}/>
                          )) : <span style={{ color:C.muted, fontSize:9 }}>no vars selected</span>
                        } else if (m.model_type === 'ensemble') {
                          const weights = mp.weights || {}
                          detailCell = Object.entries(weights).map(([k,w]) => (
                            <VarChip key={k} name={`${k}=${(w*100).toFixed(0)}%`}/>
                          ))
                        }

                        const aicOrLambda = m.model_type === 'wma' ? (mp.lambda != null ? `λ ${Number(mp.lambda).toFixed(3)}` : '—')
                          : m.model_type === 'lgbm' ? `L1=${mp.lambda_l1??'—'} L2=${mp.lambda_l2??'—'}`
                          : m.aic ? Math.round(m.aic) : '—'

                        return (
                          <tr key={i} className="rh" style={{ borderBottom:`1px solid ${C.border}` }}>
                            <td style={{ padding:'9px 12px', fontWeight:700 }}>{m.products?.name_ar}</td>
                            <td style={{ padding:'9px 12px', color:C.muted2 }}>{m.branches?.code}</td>
                            <td style={{ padding:'9px 12px' }}><Badge label={mm.label} color={mm.color} small/></td>
                            <td style={{ padding:'9px 12px' }}><MAPEBadge mape={cvMape}/></td>
                            <td style={{ padding:'9px 12px', color:C.textDim }}>{fmt1(m.mae)}</td>
                            <td style={{ padding:'9px 12px', color:C.muted2, fontSize:10 }}>{aicOrLambda}</td>
                            <td style={{ padding:'9px 12px', maxWidth:280 }}>
                              {detailCell || <span style={{ color:C.muted, fontSize:9 }}>—</span>}
                            </td>
                            <td style={{ padding:'9px 12px', color:C.muted2, fontSize:10 }}>
                              {m.trained_at ? new Date(m.trained_at).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
