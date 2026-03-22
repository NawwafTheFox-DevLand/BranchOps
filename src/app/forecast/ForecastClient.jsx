'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'

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

const fmtN = (n) => n == null ? '—' : Math.round(Number(n)).toLocaleString()
const fmt1 = (n) => n == null ? '—' : Number(n).toFixed(1)

function confidenceLabel(c, lang) {
  if (c == null)  return { label: lang==='ar'?'—':'—',           color: C.muted2 }
  if (c >= 0.7)   return { label: lang==='ar'?'عالية':'High',    color: C.green  }
  if (c >= 0.45)  return { label: lang==='ar'?'متوسطة':'Medium', color: C.amber  }
  return                  { label: lang==='ar'?'منخفضة':'Low',   color: C.red    }
}

function sourceBadge(source) {
  if (source === 'observed') return { label:'Observed',  bg:C.greenDim, brd:C.greenBrd, c:C.green  }
  if (source === 'mixed')    return { label:'Mixed',     bg:C.amberDim, brd:C.amberBrd, c:C.amber  }
  return                            { label:'Bootstrap', bg:C.blueDim,  brd:C.blueBrd,  c:C.blue   }
}

const Badge = ({ label, bg, brd, c, small }) => (
  <span style={{ background:bg, border:`1px solid ${brd}`, color:c, borderRadius:4, padding: small?'1px 6px':'2px 8px', fontSize:small?9:10, fontWeight:700, letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{label}</span>
)

const TH = ({ children, right }) => (
  <th style={{ padding:'9px 12px', textAlign:right?'right':'left', fontSize:9, color:C.muted2, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{children}</th>
)
const TD = ({ children, color, right, bold, small }) => (
  <td style={{ padding:'9px 12px', textAlign:right?'right':'left', color:color||C.text, fontWeight:bold?700:400, fontSize:small?10:12, whiteSpace:'nowrap' }}>{children}</td>
)

// Simple SVG line chart for actual vs predicted
function ActualVsPredicted({ data, lang }) {
  if (!data || data.length < 2) return (
    <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:C.muted2, fontSize:11 }}>
      {lang==='ar' ? 'سيظهر هنا بعد جمع بيانات فعلية' : 'Will appear once actual data is collected'}
    </div>
  )
  const W=800, H=180, PAD={t:16,r:16,b:32,l:50}
  const iW=W-PAD.l-PAD.r, iH=H-PAD.t-PAD.b
  const allV = data.flatMap(d=>[d.predicted,d.actual||0]).filter(Boolean)
  const maxV = Math.max(...allV, 1)
  const xs = data.map((_,i) => PAD.l + (i/(data.length-1||1))*iW)
  const vy = v => PAD.t + iH - (v/maxV)*iH
  const line = (key,color) => {
    const pts = data.map((d,i) => d[key]!=null ? `${xs[i]} ${vy(d[key])}` : null).filter(Boolean)
    if (pts.length < 2) return null
    return <path d={`M ${pts.join(' L ')}`} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
  }
  const ticks = 4
  const yT = Array.from({length:ticks},(_,i)=>maxV/(ticks-1)*i)
  const xLbls = data.map((d,i)=>({i,label:d.label})).filter((_,i)=>i%Math.max(1,Math.floor(data.length/6))===0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:H}} preserveAspectRatio="none">
      {yT.map((v,i)=>(
        <g key={i}>
          <line x1={PAD.l} y1={vy(v)} x2={W-PAD.r} y2={vy(v)} stroke={C.border2} strokeWidth="0.5" strokeDasharray="4 4"/>
          <text x={PAD.l-4} y={vy(v)+4} textAnchor="end" fontSize="9" fill={C.muted2}>{fmtN(v)}</text>
        </g>
      ))}
      {xLbls.map(({i,label})=>(
        <text key={i} x={xs[i]} y={H-6} textAnchor="middle" fontSize="8" fill={C.muted2}>{label}</text>
      ))}
      <defs>
        <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.amber} stopOpacity=".15"/><stop offset="100%" stopColor={C.amber} stopOpacity="0"/></linearGradient>
        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity=".12"/><stop offset="100%" stopColor={C.green} stopOpacity="0"/></linearGradient>
      </defs>
      {line('predicted', C.amber)}
      {line('actual',    C.green)}
      {data.map((d,i) => d.actual!=null && (
        <circle key={i} cx={xs[i]} cy={vy(d.actual)} r="3" fill={C.green} opacity="0.9"/>
      ))}
    </svg>
  )
}

const TABS = [
  { id:'overview',  ar:'نظرة عامة',    en:'Overview'    },
  { id:'weekly',    ar:'خطة الأسبوع',  en:'Weekly Plan' },
  { id:'cookplan',  ar:'خطة الطهي',    en:'Cook Plan'   },
  { id:'heatmap',   ar:'خريطة الطلب',  en:'Heatmap'     },
  { id:'history',   ar:'سجل التشغيل',  en:'History'     },
]

export default function ForecastClient({ initial }) {
  const [lang,       setLang]       = useState('ar')
  const [tab,        setTab]        = useState('overview')
  const [date,       setDate]       = useState(initial.date)
  const [run,        setRun]        = useState(initial.run)
  const [forecasts,  setForecasts]  = useState(initial.forecasts || [])
  const [selBranch,  setSelBranch]  = useState('All')
  const [selProduct, setSelProduct] = useState('All')
  const [generating, setGenerating] = useState(false)
  const [genResult,  setGenResult]  = useState(null)
  const [weekDates,  setWeekDates]  = useState([])
  const [weekData,   setWeekData]   = useState({})
  const [weekLoading,setWeekLoading]= useState(false)
  const [margin,     setMargin]     = useState(15) // ±15% default

  // Build 7-day window from selected date
  useEffect(() => {
    const d = new Date(date + 'T12:00:00')
    const days = []
    for (let i = 0; i < 7; i++) {
      const dd = new Date(d)
      dd.setDate(d.getDate() + i)
      days.push(dd.toISOString().slice(0,10))
    }
    setWeekDates(days)
  }, [date])

  const generate = useCallback(async () => {
    setGenerating(true); setGenResult(null)
    try {
      const res = await fetch('/api/forecast/generate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ date }),
      })
      const out = await res.json()
      setGenResult(out)
      if (out.ok) setTimeout(() => { window.location.href = `/forecast?date=${date}` }, 900)
    } catch(e) { setGenResult({ ok:false, error:e.message }) }
    finally { setGenerating(false) }
  }, [date])

  const loadWeek = useCallback(async () => {
    setWeekLoading(true)
    const results = {}
    for (const d of weekDates) {
      try {
        const res = await fetch(`/api/forecast/generate?date=${d}`)
        const out = await res.json()
        results[d] = out.forecasts || []
      } catch { results[d] = [] }
    }
    setWeekData(results)
    setWeekLoading(false)
  }, [weekDates])

  const filtered = useMemo(() =>
    forecasts
      .filter(r => selBranch  === 'All' || r.branch_id  === selBranch)
      .filter(r => selProduct === 'All' || r.product_id === selProduct),
  [forecasts, selBranch, selProduct])

  // Group by branch → product for overview
  const byBranchProduct = useMemo(() => {
    const m = {}
    for (const r of filtered) {
      const bKey = r.branch_id
      const pKey = r.product_id
      if (!m[bKey]) m[bKey] = { code: r.branches?.code, name: r.branches?.name, products: {} }
      if (!m[bKey].products[pKey]) m[bKey].products[pKey] = {
        name: r.products?.name_ar, erp: r.products?.erp_code,
        totalP50: 0, totalP80: 0, batches: 0, conf: [], source: r.source,
      }
      m[bKey].products[pKey].totalP50 += Number(r.predicted_units||0)
      m[bKey].products[pKey].totalP80 += Number(r.predicted_units_p80||0)
      m[bKey].products[pKey].batches  += Number(r.recommended_batches||0)
      if (r.confidence) m[bKey].products[pKey].conf.push(Number(r.confidence))
    }
    return Object.values(m).sort((a,b)=>(a.code||'').localeCompare(b.code||''))
  }, [filtered])

  // For actual vs predicted chart
  const chartData = useMemo(() => {
    const byDate = {}
    for (const r of forecasts) {
      const d = r.forecast_date
      if (!byDate[d]) byDate[d] = { label: d, predicted:0, actual:0, hasActual:false }
      byDate[d].predicted += Number(r.predicted_units||0)
      if (r.actual_sold != null) { byDate[d].actual += Number(r.actual_sold); byDate[d].hasActual = true }
    }
    return Object.values(byDate).sort((a,b)=>a.label.localeCompare(b.label))
      .map(d => ({ ...d, actual: d.hasActual ? d.actual : null }))
  }, [forecasts])

  // Heatmap
  const heatData = useMemo(() => {
    const s = {}
    for (const r of filtered) {
      const sl = r.time_slots?.label||'?'
      s[sl] ??= { slot:sl, hour:r.time_slots?.start_hour||0, p50:0, p80:0, batches:0 }
      s[sl].p50  += Number(r.predicted_units||0)
      s[sl].p80  += Number(r.predicted_units_p80||0)
      s[sl].batches += Number(r.recommended_batches||0)
    }
    return Object.values(s).sort((a,b)=>a.hour-b.hour)
  }, [filtered])
  const maxHeat = Math.max(...heatData.map(s=>s.p50), 1)

  // Totals
  const totals = useMemo(() => ({
    p50:    filtered.reduce((s,r)=>s+Number(r.predicted_units||0),0),
    p80:    filtered.reduce((s,r)=>s+Number(r.predicted_units_p80||0),0),
    obs:    filtered.filter(r=>r.source==='observed').length,
    boot:   filtered.filter(r=>r.source==='bootstrap').length,
    avgConf:filtered.length ? filtered.reduce((s,r)=>s+Number(r.confidence||0),0)/filtered.length : 0,
  }), [filtered])

  const allSlots = useMemo(() =>
    [...new Set(filtered.map(r=>r.time_slots?.label).filter(Boolean))].sort(),
  [filtered])

  const hasData = forecasts.length > 0
  const T = (ar, en) => lang === 'ar' ? ar : en
  const selStyle = { background:C.surf3, border:`1px solid ${C.border2}`, color:C.text, borderRadius:8, padding:'8px 12px', fontSize:12, outline:'none', fontFamily:'inherit' }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text }} dir={lang==='ar'?'rtl':'ltr'}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        select,input{font-family:inherit;color:#111827}
        select option{background:#ffffff;color:#111827}
        .rh:hover{background:rgba(245,158,11,0.04)!important}
        @keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu .3s ease both}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin .8s linear infinite;display:inline-block}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#c8cdd8;border-radius:2px}
        @media print{.no-print{display:none!important}.print-only{display:block!important}}
        .print-only{display:none}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(7,8,9,0.97)', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:18, letterSpacing:'-0.03em' }}>
              {T('التنبؤ بالطلب', 'Demand Forecast')}
            </div>
            <div style={{ fontSize:10, color:C.muted2, marginTop:1 }}>
              {run
                ? `${T('آخر تشغيل','Last run')} ${new Date(run.created_at).toLocaleTimeString(lang==='ar'?'ar-SA':'en-SA',{hour:'2-digit',minute:'2-digit'})} · ${forecasts.length} ${T('صف','rows')}`
                : T('لا يوجد تنبؤ لهذا اليوم','No forecast for this date')}
            </div>
          </div>
          {run && (() => { const b=sourceBadge(run.source); return <Badge {...b}/> })()}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* Lang toggle */}
          <button onClick={()=>setLang(l=>l==='ar'?'en':'ar')} style={{ background:C.surf3, border:`1px solid ${C.border2}`, color:C.textDim, borderRadius:7, padding:'6px 11px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {lang==='ar'?'EN':'عربي'}
          </button>
          <input type="date" value={date}
            onChange={e=>{setDate(e.target.value); window.location.href=`/forecast?date=${e.target.value}`}}
            style={{ background:C.surf3, border:`1px solid ${C.border2}`, borderRadius:8, padding:'7px 10px', fontSize:12, color:C.text, outline:'none', fontFamily:'inherit' }}
          />
          <button onClick={generate} disabled={generating} style={{
            background: generating ? C.surf3 : C.amber,
            color: generating ? C.muted2 : '#060709',
            border:'none', borderRadius:8, padding:'8px 16px', fontWeight:800, fontSize:12,
            cursor: generating ? 'not-allowed':'pointer', fontFamily:"'Syne',sans-serif",
            display:'flex', alignItems:'center', gap:6,
          }}>
            {generating && <span className="spin">⟳</span>}
            {generating ? T('جارٍ التوليد…','Generating…') : run ? T('↺ إعادة','↺ Regen') : T('⚡ توليد التنبؤ','⚡ Generate')}
          </button>
        </div>
      </div>

      {genResult && (
        <div style={{ padding:'10px 28px', background: genResult.ok ? C.greenDim : C.redDim, borderBottom:`1px solid ${genResult.ok ? C.greenBrd : C.redBrd}`, fontSize:12, color: genResult.ok ? C.green : C.red, fontWeight:600 }}>
          {genResult.ok
            ? `✓ ${T('تم توليد','Generated')} ${genResult.rows_generated} ${T('صف','rows')} · ${genResult.debug?.batch_products} ${T('منتج','products')} · ${genResult.debug?.branches} ${T('فرع','branches')} · ${genResult.debug?.sales_source}`
            : `✗ ${genResult.error} | debug: ${JSON.stringify(genResult.debug||{})}`}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'0 28px', display:'flex', gap:2, background:C.surf, overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'11px 16px', fontSize:12, fontWeight:600, background:'none', border:'none',
            cursor:'pointer', color: tab===t.id ? C.amber : C.muted2, fontFamily:'inherit',
            borderBottom:`2px solid ${tab===t.id ? C.amber : 'transparent'}`, marginBottom:-1,
            whiteSpace:'nowrap',
          }}>{lang==='ar' ? t.ar : t.en}</button>
        ))}
        <a href="/forecast/train" style={{ padding:'11px 16px', fontSize:12, fontWeight:600, color:C.violet, fontFamily:'inherit', borderBottom:'2px solid transparent', marginBottom:-1, whiteSpace:'nowrap', textDecoration:'none', marginLeft:'auto' }}>
          ⚙ {T('ضبط النموذج','Model Training')}
        </a>
      </div>

      {!hasData && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:360, gap:12, padding:28 }}>
          <div style={{ fontSize:36 }}>📊</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:17 }}>{T('لا يوجد تنبؤ لهذا التاريخ','No forecast for this date')}</div>
          <div style={{ fontSize:12, color:C.muted2, textAlign:'center', maxWidth:440, lineHeight:1.9 }}>
            {T(
              'استورد بيانات المبيعات من صفحة الاستيراد ثم اضغط زر التوليد.',
              'Import your sales data at /import then click Generate Forecast.'
            )}
          </div>
        </div>
      )}

      {hasData && (
        <div style={{ padding:28 }}>
          {/* Filters */}
          <div style={{ display:'flex', gap:12, marginBottom:22, flexWrap:'wrap', alignItems:'flex-end' }}>
            {[
              { label:T('الفرع','Branch'),  val:selBranch,  set:setSelBranch,
                opts:[{v:'All',l:T('جميع الفروع','All Branches')}, ...initial.branches.map(b=>({v:b.id, l:`${b.code} — ${b.name}`}))] },
              { label:T('المنتج','Product'), val:selProduct, set:setSelProduct,
                opts:[{v:'All',l:T('جميع المنتجات','All Products')}, ...initial.products.map(p=>({v:p.id, l:p.name_ar}))] },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize:9, color:C.muted2, letterSpacing:'0.1em', marginBottom:4, textTransform:'uppercase' }}>{f.label}</div>
                <select value={f.val} onChange={e=>f.set(e.target.value)} style={selStyle}>
                  {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
            <div style={{ fontSize:11, color:C.muted2, alignSelf:'flex-end', paddingBottom:2 }}>
              {filtered.length} {T('صف','rows')}
            </div>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, fontSize:11, color:C.muted2 }}>
              <span>{T('هامش الخطأ','Margin')} ±</span>
              <input type="number" min={5} max={50} value={margin} onChange={e=>setMargin(Number(e.target.value))}
                style={{ ...selStyle, width:60, padding:'6px 8px' }}/>
              <span>%</span>
            </div>
          </div>

          {/* ── OVERVIEW ─────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="fu">
              {/* KPIs */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:22 }}>
                {[
                  { label:T('الطلب المتوقع P50','Predicted P50'),   value:fmtN(totals.p50), color:C.amber },
                  { label:T('الهامش الآمن P80','Safety P80'),       value:fmtN(totals.p80), color:C.green },
                  { label:T('البيانات المرصودة','Observed Rows'),   value:totals.obs,       color:C.blue,  dim:totals.obs===0 },
                  { label:T('البيانات التقديرية','Bootstrap Rows'), value:totals.boot,      color:C.violet,dim:totals.boot===0 },
                  { label:T('متوسط الثقة','Avg Confidence'),        value:totals.avgConf>=0.7?T('عالية','High'):totals.avgConf>=0.45?T('متوسطة','Medium'):T('منخفضة','Low'), color:totals.avgConf>=0.7?C.green:totals.avgConf>=0.45?C.amber:C.red },
                ].map((k,i) => (
                  <div key={i} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px', opacity:k.dim?0.4:1 }}>
                    <div style={{ fontSize:9, color:C.muted2, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>{k.label}</div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:26, color:k.color, lineHeight:1 }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Actual vs predicted chart */}
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'18px 20px', marginBottom:18 }}>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14 }}>
                    {T('الطلب الفعلي مقابل المتوقع','Actual vs Predicted Demand')}
                  </div>
                  <div style={{ fontSize:11, color:C.muted2, marginTop:4 }}>
                    {T('الخط الأصفر = التنبؤ، الخط الأخضر = الفعلي المسجل. كلما تقاربا، كانت دقة النموذج أعلى.','Yellow = forecast, Green = logged actual. Closer lines = higher model accuracy.')}
                  </div>
                </div>
                <div style={{ display:'flex', gap:16, marginBottom:10 }}>
                  {[{label:T('المتوقع','Predicted'),color:C.amber},{label:T('الفعلي','Actual'),color:C.green}].map((l,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:C.textDim }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:l.color }}/>
                      {l.label}
                    </div>
                  ))}
                </div>
                <ActualVsPredicted data={chartData} lang={lang} />
              </div>

              {/* Per-branch × per-product table */}
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14 }}>
                    {T('التفصيل حسب الفرع والمنتج','By Branch & Product')}
                  </div>
                  <div style={{ fontSize:11, color:C.muted2, marginTop:4 }}>
                    {T('إجمالي الطلب والدفعات الموصى بها لكل فرع ومنتج.','Total demand & recommended batches per branch and product.')}
                  </div>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                        <TH>{T('الفرع','Branch')}</TH>
                        <TH>{T('المنتج','Product')}</TH>
                        <TH right>{T('P50','P50')}</TH>
                        <TH right>{T('P80','P80')}</TH>
                        <TH right>{T('دفعات','Batches')}</TH>
                        <TH>{T('المصدر','Source')}</TH>
                        <TH>{T('الثقة','Conf.')}</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {byBranchProduct.flatMap(branch =>
                        Object.values(branch.products).map((prod, pi) => {
                          const avgConf = prod.conf.length ? prod.conf.reduce((a,b)=>a+b,0)/prod.conf.length : null
                          const cl = confidenceLabel(avgConf, lang)
                          const sb = sourceBadge(prod.source)
                          return (
                            <tr key={`${branch.code}-${pi}`} className="rh" style={{ borderBottom:`1px solid ${C.border}` }}>
                              <TD bold color={C.amber}>{pi===0 ? `${branch.code}` : ''}</TD>
                              <TD>{prod.name}</TD>
                              <TD right color={C.amber}>{fmtN(prod.totalP50)}</TD>
                              <TD right color={C.green}>{fmtN(prod.totalP80)}</TD>
                              <TD right bold>{Math.ceil(prod.batches)}</TD>
                              <td style={{ padding:'9px 12px' }}><Badge {...sb} small/></td>
                              <TD color={cl.color} bold>{cl.label}</TD>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── WEEKLY PLAN ──────────────────────────────────────── */}
          {tab === 'weekly' && (
            <div className="fu">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15 }}>
                    {T('خطة الطهي الأسبوعية','Weekly Cook Plan')}
                  </div>
                  <div style={{ fontSize:11, color:C.muted2, marginTop:4 }}>
                    {T(`التنبؤ لمدة 7 أيام مع هامش خطأ ±${margin}٪. تبدأ من ${date}.`,
                       `7-day forecast with ±${margin}% margin of error. Starting ${date}.`)}
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={loadWeek} disabled={weekLoading} style={{
                    background: weekLoading ? C.surf3 : C.violet,
                    color: weekLoading ? C.muted2 : '#fff',
                    border:'none', borderRadius:8, padding:'8px 16px',
                    fontWeight:800, fontSize:12, cursor:'pointer', fontFamily:"'Syne',sans-serif",
                  }}>
                    {weekLoading ? T('جارٍ التحميل…','Loading…') : T('⟳ تحميل الأسبوع','⟳ Load Week')}
                  </button>
                  <button onClick={()=>window.print()} style={{
                    background:C.surf3, border:`1px solid ${C.border2}`, color:C.textDim,
                    borderRadius:8, padding:'8px 16px', fontWeight:700, fontSize:12,
                    cursor:'pointer', fontFamily:'inherit',
                  }}>
                    🖨 {T('طباعة','Print')}
                  </button>
                </div>
              </div>

              {/* Week table per branch */}
              {initial.branches.map(branch => {
                // Collect per product per day
                const productNames = [...new Set(
                  Object.values(weekData).flatMap(rows =>
                    rows.filter(r=>r.branch_id===branch.id).map(r=>r.products?.name_ar).filter(Boolean)
                  )
                )]
                if (!productNames.length && Object.keys(weekData).length > 0) return null

                return (
                  <div key={branch.id} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, marginBottom:16, overflow:'hidden' }}>
                    <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:18, color:C.amber }}>{branch.code}</span>
                        <span style={{ fontSize:13, color:C.textDim }}>{branch.name}</span>
                      </div>
                      <span style={{ fontSize:10, color:C.muted2 }}>±{margin}% {T('هامش الخطأ','margin')}</span>
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                        <thead>
                          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                            <th style={{ padding:'9px 14px', textAlign:'left', color:C.muted2, fontSize:9, letterSpacing:'0.08em', minWidth:120 }}>{T('المنتج','PRODUCT')}</th>
                            {weekDates.map(d => {
                              const dow = new Date(d+'T12:00:00').toLocaleDateString(lang==='ar'?'ar-SA':'en-SA',{weekday:'short'})
                              return (
                                <th key={d} style={{ padding:'9px 10px', textAlign:'center', color:C.amber, fontSize:10, fontWeight:700, minWidth:90 }}>
                                  <div>{dow}</div>
                                  <div style={{ fontSize:8, color:C.muted2, fontWeight:400 }}>{d.slice(5)}</div>
                                </th>
                              )
                            })}
                            <th style={{ padding:'9px 10px', textAlign:'center', color:C.muted2, fontSize:9, letterSpacing:'0.08em' }}>{T('المجموع','TOTAL')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productNames.length === 0 ? (
                            <tr><td colSpan={9+1} style={{ padding:16, color:C.muted2, fontSize:11, textAlign:'center' }}>
                              {T('اضغط "تحميل الأسبوع" لعرض البيانات','Click "Load Week" to display data')}
                            </td></tr>
                          ) : productNames.map(prodName => {
                            let weekTotal = 0
                            return (
                              <tr key={prodName} style={{ borderBottom:`1px solid ${C.border}` }}>
                                <td style={{ padding:'9px 14px', fontWeight:700, color:C.text }}>{prodName}</td>
                                {weekDates.map(d => {
                                  const dayRows = (weekData[d]||[])
                                    .filter(r => r.branch_id===branch.id && r.products?.name_ar===prodName)
                                  const p80 = dayRows.reduce((s,r)=>s+Number(r.predicted_units_p80||0),0)
                                  const batches = dayRows.reduce((s,r)=>s+Number(r.recommended_batches||0),0)
                                  const low  = Math.max(1, Math.round(batches * (1 - margin/100)))
                                  const high = Math.round(batches * (1 + margin/100))
                                  weekTotal += batches
                                  return (
                                    <td key={d} style={{ padding:'9px 10px', textAlign:'center', borderLeft:`1px solid ${C.border}` }}>
                                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:16, color:C.text, lineHeight:1 }}>
                                        {batches > 0 ? Math.ceil(batches) : '—'}
                                      </div>
                                      {batches > 0 && (
                                        <div style={{ fontSize:9, color:C.muted2, marginTop:3 }}>
                                          {low}–{high}
                                        </div>
                                      )}
                                    </td>
                                  )
                                })}
                                <td style={{ padding:'9px 10px', textAlign:'center', borderLeft:`1px solid ${C.border}`, fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:15, color:C.amber }}>
                                  {weekTotal > 0 ? Math.ceil(weekTotal) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding:'8px 16px', borderTop:`1px solid ${C.border}`, fontSize:9, color:C.muted2 }}>
                      {T(`الأرقام = دفعات موصى بها (1 دفعة = 1 كجم). الأرقام الصغيرة = النطاق ±${margin}٪`,
                         `Numbers = recommended batches (1 batch = 1 kg). Small range = ±${margin}% margin.`)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── COOK PLAN ────────────────────────────────────────── */}
          {tab === 'cookplan' && (
            <div className="fu">
              <div style={{ marginBottom:14, fontSize:11, color:C.muted2, lineHeight:1.9 }}>
                {T('خطة الطهي اليومية لكل فرع. الأرقام = دفعات موصى بها لتغطية P80 من الطلب.','Daily cook plan per branch. Numbers = batches needed to cover P80 demand.')}
              </div>
              {byBranchProduct.map(branch => (
                <div key={branch.code} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, marginBottom:14, overflow:'hidden' }}>
                  <div style={{ padding:'13px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:18, color:C.amber }}>{branch.code}</span>
                      <span style={{ fontSize:13, color:C.textDim }}>{branch.name}</span>
                    </div>
                    <span style={{ fontSize:10, color:C.muted2 }}>{date}</span>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                          <th style={{ padding:'9px 14px', textAlign:'left', color:C.muted2, fontSize:9 }}>{T('المنتج','PRODUCT')}</th>
                          {allSlots.map(s=><th key={s} style={{ padding:'9px 10px', color:C.amber, fontSize:11, fontWeight:700, textAlign:'center' }}>{s}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(branch.products).map((prod, i) => {
                          const slotData = {}
                          filtered.filter(r=>r.branches?.code===branch.code && r.products?.name_ar===prod.name)
                            .forEach(r => { slotData[r.time_slots?.label||'?'] = r })
                          return (
                            <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                              <td style={{ padding:'9px 14px', fontWeight:700 }}>{prod.name}</td>
                              {allSlots.map(s => {
                                const r = slotData[s]
                                if (!r) return <td key={s} style={{ padding:'9px 10px', textAlign:'center', color:C.muted }}>—</td>
                                const cl = confidenceLabel(r.confidence, lang)
                                const low  = Math.max(1, Math.round(r.recommended_batches*(1-margin/100)))
                                const high = Math.round(r.recommended_batches*(1+margin/100))
                                return (
                                  <td key={s} style={{ padding:'9px 10px', textAlign:'center' }}>
                                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:17, lineHeight:1 }}>{r.recommended_batches}</div>
                                    <div style={{ fontSize:8, color:C.muted2, marginTop:2 }}>{low}–{high}</div>
                                    <div style={{ fontSize:8, color:cl.color, marginTop:1 }}>{cl.label}</div>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── HEATMAP ──────────────────────────────────────────── */}
          {tab === 'heatmap' && (
            <div className="fu">
              <div style={{ marginBottom:14, fontSize:11, color:C.muted2, lineHeight:1.9 }}>
                {T('توزيع الطلب عبر الفترات الزمنية. اللون الأعمق = طلب أعلى. يساعدك على تحديد أوقات الذروة.','Demand distribution across time slots. Darker = higher demand. Helps identify peak cooking windows.')}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10 }}>
                {heatData.map(slot => {
                  const pct = (slot.p50/maxHeat)*100
                  const alpha = 0.06 + (pct/100)*0.55
                  return (
                    <div key={slot.slot} style={{ background:`rgba(245,158,11,${alpha})`, border:`1px solid rgba(245,158,11,${alpha+0.1})`, borderRadius:12, padding:'16px 14px' }}>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, color:C.amber, marginBottom:10 }}>{slot.slot}</div>
                      <div style={{ fontSize:22, fontWeight:800, color:C.text, fontFamily:"'Syne',sans-serif", lineHeight:1 }}>{fmtN(slot.p50)}</div>
                      <div style={{ fontSize:9, color:C.muted2, marginTop:4 }}>{T('وحدة P50','units P50')}</div>
                      <div style={{ background:C.border2, borderRadius:2, height:3, marginTop:10, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:C.amber, borderRadius:2 }}/>
                      </div>
                      <div style={{ fontSize:9, color:C.muted2, marginTop:8 }}>
                        P80: {fmtN(slot.p80)} · {Math.ceil(slot.batches)} {T('دفعة','batches')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── HISTORY ──────────────────────────────────────────── */}
          {tab === 'history' && (
            <div className="fu">
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14 }}>
                  {T('سجل تشغيلات التنبؤ','Forecast Run History')}
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                        {[T('التاريخ','Date'),T('نوع اليوم','Day Type'),T('المصدر','Source'),T('الفروع','Branches'),T('المنتجات','Products'),T('وقت التشغيل','Run At'),''].map((h,i)=><TH key={i}>{h}</TH>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(initial.recentRuns||[]).map(r => {
                        const sb = sourceBadge(r.source)
                        return (
                          <tr key={r.id} className="rh" style={{ borderBottom:`1px solid ${C.border}` }}>
                            <TD bold color={C.amber}>{r.run_for_date}</TD>
                            <TD small color={C.muted2}>{r.day_type}</TD>
                            <td style={{ padding:'9px 12px' }}><Badge {...sb} small/></td>
                            <TD>{r.branches_covered ?? '—'}</TD>
                            <TD>{r.products_covered ?? '—'}</TD>
                            <TD small color={C.muted2}>{new Date(r.created_at).toLocaleString(lang==='ar'?'ar-SA':'en-SA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</TD>
                            <td style={{ padding:'9px 12px' }}>
                              <a href={`/forecast?date=${r.run_for_date}`} style={{ background:C.surf3, border:`1px solid ${C.border2}`, color:C.muted2, borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700, textDecoration:'none' }}>
                                {T('عرض','View')}
                              </a>
                            </td>
                          </tr>
                        )
                      })}
                      {!initial.recentRuns?.length && (
                        <tr><td colSpan={7} style={{ padding:16, color:C.muted2 }}>{T('لا توجد تشغيلات بعد.','No runs yet.')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
