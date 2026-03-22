'use client'
import { useState, useMemo } from 'react'
import FiltersBar from './FiltersBar'

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

const CLASS_META = {
  Star:      { color:C.amber,   bg:C.amberDim,             icon:'⭐', desc:'High profit · High popularity' },
  Workhorse: { color:C.blue,    bg:C.blueDim,               icon:'🐎', desc:'Low profit · High popularity'  },
  Challenge: { color:C.violet,  bg:'rgba(167,139,250,0.10)',icon:'🎯', desc:'High profit · Low popularity'  },
  Dog:       { color:C.muted2,  bg:'rgba(107,114,128,0.10)',icon:'🐕', desc:'Low profit · Low popularity'   },
}

const CAT_COLORS = {
  dairy:'#60a5fa',eggs:'#f59e0b',packaging:'#a78bfa',protein:'#22c55e',
  beverages:'#2dd4bf',oils:'#f97316',condiments:'#ec4899',other:'#6b7280',
  dry_goods:'#84cc16',cleaning:'#06b6d4',
}

const SAR = n => n==null?'—':Number(n)>=1e6?`${(Number(n)/1e6).toFixed(2)}M`:Number(n)>=1000?`${(Number(n)/1000).toFixed(0)}K`:`${Math.round(Number(n))}`
const SARF = n => `${SAR(n)} SAR`
const PCT  = n => n==null?'—':`${Number(n).toFixed(1)}%`
const NUM  = n => n==null?'—':Math.round(Number(n)).toLocaleString()

const TABS = [
  { id:'overview',    ar:'نظرة عامة',      en:'Overview'         },
  { id:'menu',        ar:'هندسة القائمة',  en:'Menu Engineering' },
  { id:'procurement', ar:'المشتريات',      en:'Procurement'      },
  { id:'waste',       ar:'الهدر والإنتاج', en:'Waste & Production'},
]

const REASON_LABELS = {
  hot_hold_expired:{ ar:'انتهاء وقت الاحتفاظ', en:'Hot-Hold Expired' },
  overproduction:  { ar:'إنتاج زائد',           en:'Overproduction'   },
  damaged:         { ar:'تالف',                 en:'Damaged'          },
  other:           { ar:'أسباب أخرى',           en:'Other'            },
}

function KPI({ label, value, sub, color=C.amber, alert=false, icon, small=false }) {
  return (
    <div style={{ background:C.surf, border:`1px solid ${alert?C.red+'55':C.border}`, borderRadius:13,
      padding:small?'14px 16px':'18px 20px', boxShadow:alert?`0 0 18px ${C.redDim}`:'none',
      position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:color,opacity:0.4,borderRadius:'13px 13px 0 0' }}/>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ fontSize:9, color:C.muted2, letterSpacing:'0.1em', textTransform:'uppercase' }}>{label}</div>
        {icon && <span style={{ fontSize:16, opacity:0.7 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:small?22:28, color:alert?C.red:color, letterSpacing:'-0.04em', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:C.muted2, marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function HBar({ label, value, maxVal, color=C.amber, fmt=SARF, rank }) {
  const pct = maxVal > 0 ? (value / maxVal) * 100 : 0
  return (
    <div style={{ marginBottom:9 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          {rank != null && <span style={{ fontSize:9, color:C.muted2, minWidth:16, textAlign:'right' }}>{rank}</span>}
          <span style={{ fontSize:11, color:C.text, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={label}>{label}</span>
        </div>
        <span style={{ fontSize:11, color, fontWeight:700, marginLeft:10, whiteSpace:'nowrap' }}>{fmt(value)}</span>
      </div>
      <div style={{ background:C.border2, borderRadius:3, height:5, overflow:'hidden' }}>
        <div style={{ width:`${Math.min(100,pct)}%`, height:'100%', background:color, borderRadius:3, transition:'width .5s ease' }}/>
      </div>
    </div>
  )
}

function TimelineBar({ data, color=C.amber, onTip }) {
  if (!data?.length) return (
    <div style={{ height:80, display:'flex', alignItems:'center', justifyContent:'center', color:C.muted2, fontSize:12 }}>
      No purchase data — import Purchases.xlsx first
    </div>
  )
  const max = Math.max(...data.map(d => d.amount), 1)
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:80 }}>
        {data.map((d, i) => (
          <div
            key={i}
            title={`${d.date}: ${SARF(d.amount)}`}
            onMouseMove={(e) => onTip?.({ x: e.clientX, y: e.clientY, text: `${d.date}: ${SARF(d.amount)}` })}
            onMouseLeave={() => onTip?.(null)}
            style={{
              flex: 1,
              background: d.amount > max * 0.5 ? C.amber : `${color}99`,
              borderRadius: '2px 2px 0 0',
              height: Math.max(2, (d.amount / max) * 80),
              cursor: 'default',
            }}
          />
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:C.muted2, marginTop:4 }}>
        <span>{data[0]?.date}</span><span>{data[Math.floor(data.length/2)]?.date}</span><span>{data[data.length-1]?.date}</span>
      </div>
    </div>
  )
}

function DonutChart({ segments, size=110, onTip }) {
  const total = segments.reduce((s, g) => s + g.value, 0)
  if (!total) return null
  let angle = -90
  const cx=size/2, cy=size/2, r=size*0.38, inner=size*0.24
  const toR = a => a * Math.PI / 180
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width:size, height:size }}>
      {segments.map(seg => {
        const sw = (seg.value/total)*360
        const [s,e] = [angle, angle+sw]; angle += sw
        const lg = sw > 180 ? 1 : 0
        const x1=cx+r*Math.cos(toR(s)), y1=cy+r*Math.sin(toR(s))
        const x2=cx+r*Math.cos(toR(e)), y2=cy+r*Math.sin(toR(e))
        const xi1=cx+inner*Math.cos(toR(s)), yi1=cy+inner*Math.sin(toR(s))
        const xi2=cx+inner*Math.cos(toR(e)), yi2=cy+inner*Math.sin(toR(e))
        return <path key={seg.label}
          d={`M${x1} ${y1}A${r} ${r} 0 ${lg} 1 ${x2} ${y2}L${xi2} ${yi2}A${inner} ${inner} 0 ${lg} 0 ${xi1} ${yi1}Z`}
          fill={seg.color} opacity={0.85} title={`${seg.label}: ${PCT(seg.value/total*100)}`}
          onMouseMove={(e) => onTip?.({ x: e.clientX, y: e.clientY, text: `${seg.label}: ${PCT(seg.value/total*100)}` })}
          onMouseLeave={() => onTip?.(null)}
          />
      })}
      <circle cx={cx} cy={cy} r={inner-1} fill={C.surf}/>
    </svg>
  )
}

function Empty({ icon='📊', msg, sub, cta, href }) {
  return (
    <div style={{ textAlign:'center', padding:'40px 20px', color:C.muted2 }}>
      <div style={{ fontSize:32, marginBottom:10 }}>{icon}</div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, color:C.textDim, marginBottom:6 }}>{msg}</div>
      {sub && <div style={{ fontSize:11, marginBottom:10 }}>{sub}</div>}
      {cta && href && <a href={href} style={{ fontSize:12, color:C.amber, fontWeight:700 }}>{cta} →</a>}
    </div>
  )
}

export default function AnalyticsClient({ initial }) {
  const [lang, setLang] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('lang') || 'ar') : 'ar')
  const [tab,  setTab]  = useState('overview')
  const [sortKey, setSortKey] = useState('total_sales_sar')
  const [tip, setTip] = useState(null)

  const T = (ar, en) => lang === 'ar' ? ar : en

  const { sales=[], purchases=[], waste=[], batches=[], stockouts=[], purchByDate=[], purchBySupplier=[], purchByCategory=[], summary={} } = initial

  // ── Menu engineering grouping — uses "class" column ──────────────────────
  const byClass = useMemo(() => {
    const groups = { Star:[], Workhorse:[], Challenge:[], Dog:[] }
    for (const r of sales) {
      const cls = r.class || r.menu_class || 'Dog'
      if (groups[cls]) groups[cls].push(r)
      else groups.Dog.push(r)
    }
    return groups
  }, [sales])

  const sorted = useMemo(() =>
    [...sales].sort((a,b) => Number(b[sortKey]||0) - Number(a[sortKey]||0)),
  [sales, sortKey])

  const maxRev  = Math.max(...sales.map(r => Number(r.total_sales_sar||0)), 1)
  const maxProf = Math.max(...sales.map(r => Number(r.total_profit||0)), 1)
  const maxSupp = purchBySupplier[0]?.amount || 1
  const maxCat  = purchByCategory[0]?.amount || 1

  // ── Waste aggregations ────────────────────────────────────────────────────
  const wasteByReason = useMemo(() => {
    const m = {}
    for (const w of waste) m[w.reason] = (m[w.reason]||0) + Number(w.wasted_qty||0)
    return Object.entries(m).sort((a,b) => b[1]-a[1])
  }, [waste])

  const wasteByProduct = useMemo(() => {
    const m = {}
    for (const w of waste) {
      const n = w.products?.name_ar || w.product_id || 'Unknown'
      m[n] = (m[n]||0) + Number(w.wasted_qty||0)
    }
    return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,10)
  }, [waste])

  const totalWasteQty = wasteByReason.reduce((s,[,v]) => s+v, 0)
  const maxWaste = wasteByProduct[0]?.[1] || 1

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text, paddingBottom:60 }}
      dir={lang==='ar'?'rtl':'ltr'}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        .rh:hover{background:rgba(0,0,0,0.025)!important}
        @keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .fu{animation:fu .3s ease both}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#c8cdd8;border-radius:2px}
        select option{background:#ffffff;color:#111827}
      `}</style>

      {/* Hover tooltip */}
      {tip && (
        <div id="chart-tooltip"
          style={{
            position: 'fixed',
            left: Math.min(window.innerWidth - 260, tip.x + 12),
            top: Math.min(window.innerHeight - 80, tip.y + 12),
            width: 250,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(13,15,18,0.95)',
            border: `1px solid ${C.border2}`,
            color: C.text,
            fontSize: 11,
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          {tip.text}
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', background:C.surf, position:'sticky', top:0, zIndex:40 }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:20, letterSpacing:'-0.04em' }}>
            Branch Ops <span style={{ color:C.amber }}>Analytics</span>
          </div>
          <div style={{ fontSize:10, color:C.muted2, marginTop:1 }}>
            {T('تحليل المبيعات · المشتريات · الهدر','Sales · Procurement · Waste')}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <a href="/dashboard" style={{ fontSize:11, color:C.muted2, textDecoration:'none' }}>← {T('الرئيسية','Dashboard')}</a>
          <button onClick={() => { const n=lang==='ar'?'en':'ar'; setLang(n); localStorage.setItem('lang',n) }} style={{ background:C.surf2, border:`1px solid ${C.border2}`, color:C.textDim, borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {lang==='ar'?'EN':'عربي'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'0 28px', display:'flex', gap:2, background:C.surf, overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'11px 16px', fontSize:12, fontWeight:600, background:'none', border:'none',
            cursor:'pointer', color:tab===t.id?C.amber:C.muted2, fontFamily:'inherit',
            borderBottom:`2px solid ${tab===t.id?C.amber:'transparent'}`, marginBottom:-1, whiteSpace:'nowrap',
          }}>{lang==='ar'?t.ar:t.en}</button>
        ))}
      </div>

      <div style={{ padding:28 }}>

        {/* Filters */}
        <FiltersBar lang={lang} filters={initial.filters} classOptions={Object.keys(CLASS_META)} />


        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <div className="fu">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:14 }}>
              <KPI label={T('إجمالي الإيرادات','Total Revenue')}   value={SARF(summary.totalRevenue)}   icon="💰" color={C.amber}/>
              <KPI label={T('إجمالي المشتريات','Total Purchases')} value={SARF(summary.totalPurchases)} icon="📦" color={C.blue}/>
              <KPI label={T('صافي الربح','Net Profit')}             value={SARF(summary.totalProfit)}    icon="📈" color={C.green}/>
              <KPI label={T('هامش الربح','Gross Margin')}           value={PCT(summary.grossMarginPct)}
                color={summary.grossMarginPct>30?C.green:summary.grossMarginPct>0?C.amber:C.red}
                alert={summary.procurementExceedsRevenue} icon="%"
                sub={summary.procurementExceedsRevenue?T('المشتريات تتجاوز الإيرادات','Purchases exceed revenue'):''}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:22 }}>
              <KPI label={T('الكميات المباعة','Units Sold')}       value={NUM(summary.totalQty)}        icon="🛒" color={C.teal}    small/>
              <KPI label={T('المنتجات النشطة','Active Products')}  value={sales.length}                 icon="🍽️" color={C.violet}  small/>
              <KPI label={T('نسبة الهدر','Waste Rate')}             value={PCT(summary.wastePct)}
                color={summary.wastePct>15?C.red:summary.wastePct>8?C.amber:C.green}
                alert={summary.wastePct>20} icon="🗑" small/>
              <KPI label={T('نفاد المخزون','Stockout Events')}     value={stockouts.length}
                color={stockouts.length>0?C.red:C.green} alert={stockouts.length>5} icon="⚠️" small/>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:4 }}>
                  {T('تدفق المشتريات اليومي','Daily Procurement Flow')}
                </div>
                <div style={{ fontSize:10, color:C.muted2, marginBottom:14 }}>{T('إجمالي الإنفاق على المشتريات يومياً','Daily purchase spend in SAR')}</div>
                <TimelineBar data={purchByDate} color={C.blue} onTip={setTip}/>
              </div>

              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:4 }}>
                  {T('توزيع هندسة القائمة','Menu Class Distribution')}
                </div>
                <div style={{ fontSize:10, color:C.muted2, marginBottom:14 }}>{T('عدد المنتجات حسب التصنيف','Products by menu engineering class')}</div>
                {sales.length === 0
                  ? <Empty icon="🍽️" msg={T('لا توجد بيانات مبيعات','No sales data')} cta={T('استيراد','Import')} href="/import"/>
                  : (
                    <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                      <DonutChart size={100} onTip={setTip} segments={Object.entries(CLASS_META).map(([cls,m]) => ({
                        label:cls, value:(byClass[cls]||[]).length, color:m.color,
                      }))}/>
                      <div style={{ flex:1 }}>
                        {Object.entries(CLASS_META).map(([cls, m]) => {
                          const items = byClass[cls] || []
                          const rev = items.reduce((s,r) => s+Number(r.total_sales_sar||0), 0)
                          return (
                            <div key={cls} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8,
                              padding:'5px 10px', background:m.bg, borderRadius:8 }}>
                              <span style={{ fontSize:14 }}>{m.icon}</span>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:11, color:m.color, fontWeight:700 }}>{cls}</div>
                                <div style={{ fontSize:9, color:C.muted2 }}>{m.desc}</div>
                              </div>
                              <div style={{ textAlign:'right' }}>
                                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:15, color:m.color }}>{items.length}</div>
                                <div style={{ fontSize:9, color:C.muted2 }}>{SAR(rev)} SAR</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:14 }}>
                  {T('أعلى منتجات من حيث الإيرادات','Top Products by Revenue')}
                </div>
                {sales.length === 0
                  ? <Empty icon="📊" msg={T('لا توجد بيانات','No data')} cta="Import" href="/import"/>
                  : [...sales].sort((a,b)=>Number(b.total_sales_sar||0)-Number(a.total_sales_sar||0)).slice(0,10).map((r,i) => (
                    <HBar key={i} rank={i+1} label={r.product_name_raw||'—'}
                      value={Number(r.total_sales_sar||0)} maxVal={maxRev}
                      color={CLASS_META[r.class||r.menu_class]?.color||C.amber} fmt={SARF}/>
                  ))
                }
              </div>
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:14 }}>
                  {T('أعلى الموردين إنفاقاً','Top Suppliers by Spend')}
                </div>
                {purchBySupplier.length === 0
                  ? <Empty icon="🏭" msg={T('لا توجد بيانات','No data')} cta="Import" href="/import"/>
                  : purchBySupplier.map((s,i) => (
                    <HBar key={i} rank={i+1} label={s.name} value={s.amount} maxVal={maxSupp} color={C.blue} fmt={SARF}/>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ══ MENU ENGINEERING ══════════════════════════════════════════════ */}
        {tab === 'menu' && (
          <div className="fu">
            {sales.length === 0
              ? <Empty icon="🍽️" msg={T('لا توجد بيانات مبيعات بعد','No sales data yet')}
                  sub={T('استورد ملف Sales.xlsx','Import Sales.xlsx')} cta={T('استورد','Import')} href="/import"/>
              : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:22 }}>
                    {Object.entries(CLASS_META).map(([cls, m]) => {
                      const items = byClass[cls] || []
                      const rev = items.reduce((s,r) => s+Number(r.total_sales_sar||0), 0)
                      const qty = items.reduce((s,r) => s+Number(r.total_quantity||0), 0)
                      const revPct = summary.totalRevenue > 0 ? rev/summary.totalRevenue*100 : 0
                      return (
                        <div key={cls} style={{ background:m.bg, border:`1px solid ${m.color}33`, borderRadius:14, padding:'18px 20px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                            <span style={{ fontSize:22 }}>{m.icon}</span>
                            <div>
                              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:15, color:m.color }}>{cls}</div>
                              <div style={{ fontSize:9, color:C.muted2 }}>{m.desc}</div>
                            </div>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
                            {[['#',items.length],[T('إيرادات','Rev'),SAR(rev)],[T('وحدات','Units'),NUM(qty)]].map(([l,v])=>(
                              <div key={l}>
                                <div style={{ fontSize:8, color:C.muted2, textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</div>
                                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:13, color:m.color }}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ background:C.border2, borderRadius:3, height:4 }}>
                            <div style={{ width:`${revPct}%`, height:'100%', background:m.color, borderRadius:3 }}/>
                          </div>
                          <div style={{ fontSize:9, color:C.muted2, marginTop:4 }}>{PCT(revPct)} {T('من الإيرادات','of revenue')}</div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:C.muted2 }}>{T('ترتيب حسب:','Sort by:')}</span>
                    {[
                      ['total_sales_sar', T('الإيرادات','Revenue')],
                      ['total_quantity',  T('الكمية','Quantity')],
                      ['total_profit',    T('الربح','Profit')],
                    ].map(([k,l]) => (
                      <button key={k} onClick={() => setSortKey(k)} style={{
                        padding:'5px 12px', borderRadius:7,
                        border:`1px solid ${sortKey===k?C.amber+'66':C.border}`,
                        background:sortKey===k?C.amberDim:C.surf2,
                        color:sortKey===k?C.amber:C.muted2,
                        fontSize:11, cursor:'pointer', fontFamily:'inherit',
                        fontWeight:sortKey===k?700:400,
                      }}>{l}</button>
                    ))}
                  </div>

                  <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                        <thead>
                          <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.surf2 }}>
                            {['#', T('المنتج','Product'), T('الفئة','Class'), T('الإيرادات','Revenue'), T('الكمية','Units'), T('الربح','Profit'), T('الهامش','Margin')].map((h,i)=>(
                              <th key={i} style={{ padding:'10px 14px', textAlign:i>=3?'right':'left', color:C.muted2, fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((r,i) => {
                            const cls = r.class || r.menu_class || 'Dog'
                            const m = CLASS_META[cls] || CLASS_META.Dog
                            return (
                              <tr key={i} className="rh" style={{ borderBottom:`1px solid ${C.border}` }}>
                                <td style={{ padding:'9px 14px', color:C.muted2, fontSize:10 }}>{i+1}</td>
                                <td style={{ padding:'9px 14px' }}>{r.product_name_raw||'—'}</td>
                                <td style={{ padding:'9px 14px' }}>
                                  <span style={{ background:m.bg, color:m.color, border:`1px solid ${m.color}33`, padding:'2px 8px', borderRadius:5, fontSize:10, fontWeight:700 }}>{m.icon} {cls}</span>
                                </td>
                                <td style={{ padding:'9px 14px', textAlign:'right', color:C.amber, fontWeight:700 }}>{SAR(r.total_sales_sar)} SAR</td>
                                <td style={{ padding:'9px 14px', textAlign:'right' }}>{NUM(r.total_quantity)}</td>
                                <td style={{ padding:'9px 14px', textAlign:'right', color:C.green }}>{SAR(r.total_profit)} SAR</td>
                                <td style={{ padding:'9px 14px', textAlign:'right', color:C.muted2 }}>{PCT(Number(r.profit_pct||0)*100)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )
            }
          </div>
        )}

        {/* ══ PROCUREMENT ══════════════════════════════════════════════════ */}
        {tab === 'procurement' && (
          <div className="fu">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
              <KPI label={T('إجمالي المشتريات','Total Purchases')} value={SARF(summary.totalPurchases)} icon="📦" color={C.blue}/>
              <KPI label={T('المرتجعات','Returns')}                 value={SARF(summary.totalReturns)}   icon="↩️" color={C.amber}/>
              <KPI label={T('صافي الإنفاق','Net Spend')}            value={SARF(summary.netPurchases)}   icon="💳" color={C.violet}/>
              <KPI label={T('عدد الموردين','Suppliers')}            value={summary.suppliersCount||0}    icon="🏭" color={C.teal}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:4 }}>{T('تدفق المشتريات اليومي','Daily Purchase Flow')}</div>
                <div style={{ fontSize:10, color:C.muted2, marginBottom:14 }}>{T('إجمالي الإنفاق يومياً','Daily total spend')}</div>
                <TimelineBar data={purchByDate} color={C.blue} onTip={setTip}/>
              </div>
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:4 }}>{T('الإنفاق حسب الفئة','Spend by Category')}</div>
                <div style={{ fontSize:10, color:C.muted2, marginBottom:14 }}>{T('تصنيف المشتريات حسب النوع','Purchases by type')}</div>
                {purchByCategory.length === 0
                  ? <Empty icon="📦" msg={T('لا توجد بيانات','No data')} cta="Import" href="/import"/>
                  : purchByCategory.map((c,i) => (
                    <HBar key={i} label={c.name} value={c.amount} maxVal={maxCat} color={CAT_COLORS[c.name]||C.muted2} fmt={SARF}/>
                  ))
                }
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:14 }}>{T('أعلى 10 موردين','Top 10 Suppliers')}</div>
                {purchBySupplier.length === 0
                  ? <Empty icon="🏭" msg={T('لا توجد بيانات','No data')}/>
                  : purchBySupplier.map((s,i) => (
                    <HBar key={i} rank={i+1} label={s.name} value={s.amount} maxVal={maxSupp} color={C.blue} fmt={SARF}/>
                  ))
                }
              </div>
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14 }}>{T('آخر المشتريات','Recent Purchases')}</div>
                </div>
                {purchases.length === 0
                  ? <Empty icon="📋" msg={T('لا توجد مشتريات مستوردة','No purchases imported')} cta="Import" href="/import"/>
                  : (
                    <div style={{ overflowX:'auto', maxHeight:360, overflowY:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                        <thead style={{ position:'sticky', top:0, background:C.surf2 }}>
                          <tr>
                            {[T('البند','Item'),T('التاريخ','Date'),T('الإجمالي','Total')].map((h,i)=>(
                              <th key={i} style={{ padding:'8px 14px', textAlign:i===2?'right':'left', color:C.muted2, fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {purchases.filter(p=>p.invoice_type!=='return').slice(0,30).map((p,i)=>(
                            <tr key={i} className="rh" style={{ borderBottom:`1px solid ${C.border}` }}>
                              <td style={{ padding:'7px 14px', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={p.item_name_ar||'—'}>{p.item_name_ar||'—'}</td>
                              <td style={{ padding:'7px 14px', color:C.muted2 }}>{p.purchased_at}</td>
                              <td style={{ padding:'7px 14px', textAlign:'right', color:C.blue, fontWeight:700 }}>{SAR(p.total_sar)} SAR</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>
            </div>
          </div>
        )}

        {/* ══ WASTE & PRODUCTION ══════════════════════════════════════════ */}
        {tab === 'waste' && (
          <div className="fu">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
              <KPI label={T('إجمالي الهدر','Total Waste')}         value={`${NUM(summary.totalWasted)} units`} icon="🗑" color={C.red} alert={summary.wastePct>20}/>
              <KPI label={T('إجمالي الإنتاج','Total Produced')}    value={NUM(summary.totalProduced)}           icon="🍳" color={C.blue}/>
              <KPI label={T('نسبة الهدر','Waste Rate')}              value={PCT(summary.wastePct)}
                color={summary.wastePct>15?C.red:summary.wastePct>8?C.amber:C.green} alert={summary.wastePct>20} icon="%"/>
              <KPI label={T('نفاد المخزون','Stockout Events')}      value={stockouts.length}
                color={stockouts.length>0?C.red:C.green} alert={stockouts.length>5} icon="⚠️"/>
            </div>

            {waste.length === 0 && batches.length === 0
              ? <Empty icon="📋" msg={T('لا توجد بيانات هدر أو إنتاج بعد','No waste or production data yet')}
                  sub={T('ابدأ التسجيل من صفحة العمليات','Start logging from the Operations page')}
                  cta={T('العمليات','Operations')} href="/operations"/>
              : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:14 }}>
                      {T('الهدر حسب السبب','Waste by Reason')}
                    </div>
                    {wasteByReason.length === 0
                      ? <div style={{ color:C.green, fontSize:12, fontWeight:600 }}>✓ {T('لا هدر مسجل','No waste logged')}</div>
                      : wasteByReason.map(([reason, qty]) => {
                        const pct = totalWasteQty > 0 ? (qty/totalWasteQty)*100 : 0
                        const label = REASON_LABELS[reason]?.[lang] || reason
                        return (
                          <div key={reason} style={{ marginBottom:12 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                              <span>{label}</span>
                              <span style={{ color:C.red, fontWeight:700 }}>{NUM(qty)} ({Math.round(pct)}%)</span>
                            </div>
                            <div style={{ background:C.border2, borderRadius:3, height:5 }}>
                              <div style={{ width:`${pct}%`, height:'100%', background:C.red, borderRadius:3 }}/>
                            </div>
                          </div>
                        )
                      })
                    }
                  </div>
                  <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'20px 22px' }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:14 }}>
                      {T('أكثر المنتجات هدراً','Most Wasted Products')}
                    </div>
                    {wasteByProduct.length === 0
                      ? <div style={{ color:C.green, fontSize:12, fontWeight:600 }}>✓ {T('لا هدر مسجل','No waste logged')}</div>
                      : wasteByProduct.map(([name, qty], i) => (
                        <HBar key={i} rank={i+1} label={name} value={qty} maxVal={maxWaste} color={C.red} fmt={NUM}/>
                      ))
                    }
                  </div>
                </div>
              )
            }
          </div>
        )}

      </div>
    </div>
  )
}
