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

function KPI({ label, value, sub, color=C.amber, alert=false, icon }) {
  return (
    <div style={{ background:C.surf, border:`1px solid ${alert?C.red+'55':C.border}`, borderRadius:13, padding:'18px 20px', boxShadow:alert?`0 0 20px ${C.redDim}`:'none' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ fontSize:9, color:C.muted2, letterSpacing:'0.1em', textTransform:'uppercase' }}>{label}</div>
        {icon && <span style={{ fontSize:18, opacity:0.7 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:30, color:alert?C.red:color, letterSpacing:'-0.04em', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:C.muted2, marginTop:5 }}>{sub}</div>}
    </div>
  )
}

function Bar({ pct, color=C.amber, h=5 }) {
  return (
    <div style={{ background:C.border2, borderRadius:3, height:h, overflow:'hidden' }}>
      <div style={{ width:`${Math.min(100,Math.max(0,pct))}%`, height:'100%', background:color, borderRadius:3, transition:'width .5s ease' }}/>
    </div>
  )
}

const REASON_LABELS = {
  hot_hold_expired:{ ar:'انتهى وقت الاحتفاظ', en:'Hot Hold Expired' },
  overproduction:  { ar:'إنتاج زائد',          en:'Overproduction'   },
  damaged:         { ar:'تالف',                en:'Damaged'          },
  other:           { ar:'أخرى',               en:'Other'            },
}

const TABS = [
  { id:'overview', ar:'نظرة عامة',  en:'Overview'  },
  { id:'batches',  ar:'الدفعات',    en:'Batches'   },
  { id:'waste',    ar:'الهدر',      en:'Waste'     },
  { id:'branches', ar:'الفروع',     en:'Branches'  },
]

export default function DashboardClient({ initial }) {
  const [lang, setLang] = useState('ar')
  const [tab,  setTab]  = useState('overview')

  useEffect(() => {
    const h = (e) => setLang(e.detail)
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])

  const {
    today, branches, products, batches, waste, stockouts,
    todayWasted, wastePctToday, wastePct7, totalProduced7, totalWasted7,
    latestForecast, batchCount7, stockoutCount,
  } = initial

  const T = (ar, en) => lang === 'ar' ? ar : en

  const branchWaste = branches.map(b => {
    const bBatches = batches.filter(r => r.branch_id === b.id)
    const bWaste   = waste.filter(r => r.branch_id === b.id)
    const produced = bBatches.reduce((s,r) => s + Number(r.produced_qty || r.batch_qty*12 || 0), 0)
    const wasted   = bWaste.reduce((s,r)   => s + Number(r.wasted_qty || 0), 0)
    const pct      = produced > 0 ? (wasted/produced)*100 : 0
    return { ...b, produced:Math.round(produced), wasted:Math.round(wasted), pct:Math.round(pct*10)/10, batchCount:bBatches.length, wasteCount:bWaste.length }
  }).sort((a,b) => b.pct - a.pct)

  const wasteByReason = {}
  for (const w of waste) wasteByReason[w.reason] = (wasteByReason[w.reason]||0) + Number(w.wasted_qty||0)

  const wasteByProduct = {}
  for (const w of waste) {
    const n = w.products?.name_ar || w.product_id
    wasteByProduct[n] = (wasteByProduct[n]||0) + Number(w.wasted_qty||0)
  }
  const topWasted = Object.entries(wasteByProduct).sort((a,b)=>b[1]-a[1]).slice(0,5)

  const batchByHour = {}
  for (const b of batches) { const h = new Date(b.cooked_at).getHours(); batchByHour[h]=(batchByHour[h]||0)+1 }
  const sparkData = Array.from({length:24}, (_,i) => batchByHour[i]||0)
  const wasteAlert = wastePctToday > 20 || wastePct7 > 20

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text, paddingBottom:60 }} dir={lang==='ar'?'rtl':'ltr'}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}.rh:hover{background:rgba(0,0,0,0.025)!important}@keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.fu{animation:fu .3s ease both}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#c8cdd8;border-radius:2px}select option{background:#ffffff;color:#111827}`}</style>

      <div style={{ padding:'12px 28px', borderBottom:`1px solid ${C.border}`, background:C.surf }}>
        <div style={{ fontSize:10, color:C.muted2 }}>{T('لوحة التشغيل اليومي','Daily Operations Dashboard')} · {today}</div>
      </div>

      {wasteAlert && (
        <div style={{ padding:'10px 28px', background:C.redDim, borderBottom:`1px solid ${C.redBrd}`, fontSize:12, color:C.red, fontWeight:600 }}>
          ⚠ {T(`نسبة الهدر مرتفعة: ${wastePctToday}٪ اليوم`, `Waste rate high: ${wastePctToday}% today — review required`)}
        </div>
      )}

      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'0 28px', display:'flex', gap:2, background:C.surf }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'11px 16px', fontSize:12, fontWeight:600, background:'none', border:'none', cursor:'pointer', color:tab===t.id?C.amber:C.muted2, fontFamily:'inherit', borderBottom:`2px solid ${tab===t.id?C.amber:'transparent'}`, marginBottom:-1 }}>
            {lang==='ar'?t.ar:t.en}
          </button>
        ))}
      </div>

      <div style={{ padding:28 }}>

        {tab === 'overview' && (
          <div className="fu">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:22 }}>
              <KPI label={T('هدر اليوم %','Waste % Today')}    value={`${wastePctToday}%`}  alert={wastePctToday>20} icon="🗑"/>
              <KPI label={T('هدر 7 أيام %','Waste % 7 Days')} value={`${wastePct7}%`}       color={wastePct7>15?C.red:C.green} sub={`${Math.round(totalWasted7)} units wasted`} icon="📉"/>
              <KPI label={T('دفعات اليوم','Batches Today')}    value={batches.length}        color={C.blue} sub={`${batches.reduce((s,b)=>s+Number(b.produced_qty||b.batch_qty*12||0),0)|0} units`} icon="🍳"/>
              <KPI label={T('نفاد المخزون','Stockouts Today')} value={stockouts.length}      color={stockouts.length>0?C.red:C.green} alert={stockouts.length>3} icon="⚠️"/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:22 }}>
              <KPI label={T('إنتاج 7 أيام','Produced 7d')}    value={`${(totalProduced7/1000).toFixed(1)}K`} color={C.amber} sub="units" icon="📦"/>
              <KPI label={T('الفروع النشطة','Active Branches')} value={branches.length}     color={C.blue} sub="branches" icon="🏪"/>
              <KPI label={T('دفعات الأسبوع','Batches 7 Days')} value={batchCount7}          color={C.teal} sub={T('آخر 7 أيام','last 7 days')} icon="📅"/>
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:13, padding:'18px 20px', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', gap:6 }}>
                <div style={{ fontSize:9, color:C.muted2, letterSpacing:'0.1em', textTransform:'uppercase' }}>{T('التحليلات','Analytics')}</div>
                <a href="/analytics" style={{ fontSize:12, color:C.amber, fontWeight:700 }}>{T('عرض التحليلات ←','View Analytics →')}</a>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'18px 20px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:14 }}>{T('نشاط الدفعات اليوم (بالساعة)','Batch Activity (Hourly)')}</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:60 }}>
                  {sparkData.map((v, i) => {
                    const max = Math.max(...sparkData, 1)
                    return <div key={i} title={`${i}:00 — ${v}`} style={{ flex:1, background:v>0?C.amber:C.border2, borderRadius:2, height:`${(v/max)*100}%`, minHeight:2, opacity:v>0?1:0.3 }}/>
                  })}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:C.muted2, marginTop:4 }}>
                  <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
                </div>
              </div>

              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'18px 20px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:14 }}>{T('الهدر حسب السبب','Waste by Reason')}</div>
                {Object.keys(wasteByReason).length === 0
                  ? <div style={{ color:C.green, fontSize:12, fontWeight:600 }}>✓ {T('لا هدر مسجل اليوم','No waste logged today')}</div>
                  : Object.entries(wasteByReason).sort((a,b)=>b[1]-a[1]).map(([reason, qty]) => {
                    const total = Object.values(wasteByReason).reduce((a,b)=>a+b, 0)
                    const pct = total > 0 ? (qty/total)*100 : 0
                    return (
                      <div key={reason} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                          <span>{REASON_LABELS[reason]?.[lang]||reason}</span>
                          <span style={{ color:C.red, fontWeight:700 }}>{Math.round(qty)} ({Math.round(pct)}%)</span>
                        </div>
                        <Bar pct={pct} color={C.red} h={4}/>
                      </div>
                    )
                  })
                }
              </div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:16, flexWrap:'wrap' }}>
              {[
                { href:'/operations', label:T('تسجيل دفعة/هدر','Log Batch/Waste'), color:C.amber },
                { href:'/analytics',  label:T('التحليلات','Analytics'),             color:C.blue  },
                { href:'/import',     label:T('استيراد البيانات','Import Data'),    color:C.teal  },
                { href:'/transform',  label:T('تحويل ملفات ERP','ETL Transform'),   color:C.purple },
                { href:'/forecast/weekly', label:T('التنبؤ الأسبوعي','Weekly Forecast'),  color:C.green  },
              ].map(l => (
                <a key={l.href} href={l.href} style={{ background:`${l.color}18`, border:`1px solid ${l.color}44`, color:l.color, borderRadius:9, padding:'10px 18px', fontSize:12, fontWeight:700, textDecoration:'none' }}>
                  {l.label} →
                </a>
              ))}
            </div>
          </div>
        )}

        {tab === 'batches' && (
          <div className="fu">
            {batches.length === 0
              ? <div style={{ textAlign:'center', padding:'60px 20px', color:C.muted2 }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>🍳</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color:C.textDim, marginBottom:8 }}>{T('لا توجد دفعات مسجلة اليوم','No batches logged today')}</div>
                  <a href="/operations" style={{ color:C.amber, fontSize:12, fontWeight:700 }}>{T('اذهب إلى العمليات ←','Go to Operations →')}</a>
                </div>
              : <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.surf2 }}>
                        {[T('الفرع','Branch'),T('المنتج','Product'),T('الوقت','Time'),T('الوحدات','Units'),T('دفعات','Batches')].map((h,i)=>(
                          <th key={i} style={{ padding:'9px 14px', textAlign:i>=3?'right':'left', color:C.muted2, fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batches.slice(0,50).map((b, i) => (
                        <tr key={i} className="rh" style={{ borderBottom:`1px solid ${C.border}` }}>
                          <td style={{ padding:'9px 14px', color:C.amber, fontWeight:700 }}>{b.branches?.code||'?'}</td>
                          <td style={{ padding:'9px 14px' }}>{b.products?.name_ar||'?'}</td>
                          <td style={{ padding:'9px 14px', color:C.muted2, fontSize:11 }}>{b.cooked_at?.slice(11,16)}</td>
                          <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700 }}>{Math.round(b.produced_qty||b.batch_qty*12||0)}</td>
                          <td style={{ padding:'9px 14px', textAlign:'right' }}>{b.batch_qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {tab === 'waste' && (
          <div className="fu">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
              <KPI label={T('هدر اليوم','Today Waste')}       value={`${todayWasted} units`} color={C.red} icon="🗑"/>
              <KPI label={T('هدر 7 أيام','7-Day Waste')}      value={`${Math.round(totalWasted7)} units`} color={C.red} icon="📉" sub={`${wastePct7}%`}/>
              <KPI label={T('نسبة الهدر اليوم','Waste % Today')} value={`${wastePctToday}%`} alert={wastePctToday>20} icon="%"/>
            </div>
            {topWasted.length > 0 && (
              <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'18px 20px', marginBottom:16 }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:14 }}>{T('أعلى المنتجات هدراً','Top Wasted Products')}</div>
                {topWasted.map(([name, qty], i) => (
                  <div key={i} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                      <span>{name}</span>
                      <span style={{ color:C.red, fontWeight:700 }}>{Math.round(qty)}</span>
                    </div>
                    <Bar pct={(qty/Math.max(...topWasted.map(([,v])=>v),1))*100} color={C.red} h={4}/>
                  </div>
                ))}
              </div>
            )}
            {waste.length === 0
              ? <div style={{ textAlign:'center', padding:'40px 20px', color:C.green, fontWeight:600 }}>✓ {T('لا يوجد هدر مسجل اليوم','No waste logged today — excellent!')}</div>
              : <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.surf2 }}>
                        {[T('الفرع','Branch'),T('المنتج','Product'),T('الكمية','Qty'),T('السبب','Reason'),T('الوقت','Time')].map((h,i)=>(
                          <th key={i} style={{ padding:'9px 14px', textAlign:'left', color:C.muted2, fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {waste.slice(0,50).map((w, i) => (
                        <tr key={i} className="rh" style={{ borderBottom:`1px solid ${C.border}` }}>
                          <td style={{ padding:'9px 14px', color:C.amber, fontWeight:700 }}>{w.branches?.code||'?'}</td>
                          <td style={{ padding:'9px 14px' }}>{w.products?.name_ar||'?'}</td>
                          <td style={{ padding:'9px 14px', color:C.red, fontWeight:700 }}>{Math.round(w.wasted_qty)}</td>
                          <td style={{ padding:'9px 14px', color:C.muted2, fontSize:11 }}>{REASON_LABELS[w.reason]?.[lang]||w.reason}</td>
                          <td style={{ padding:'9px 14px', color:C.muted2, fontSize:11 }}>{w.wasted_at?.slice(11,16)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {tab === 'branches' && (
          <div className="fu">
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {branchWaste.length === 0
                ? <div style={{ textAlign:'center', padding:'60px 20px', color:C.muted2 }}>
                    <div style={{ fontSize:36 }}>🏪</div>
                    <div style={{ marginTop:12, fontSize:14, color:C.textDim }}>
                      {T('لا توجد فروع. أضف فروعاً من لوحة Supabase.','No branches. Add branches in Supabase.')}
                    </div>
                  </div>
                : branchWaste.map(b => (
                  <div key={b.id} style={{ background:C.surf, border:`1px solid ${b.pct>20?C.redBrd:C.border}`, borderRadius:13, padding:'16px 20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:20, color:C.amber }}>{b.code}</span>
                        <span style={{ fontSize:13, color:C.textDim }}>{b.name}</span>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ fontSize:9, color:C.muted2 }}>{T('دفعات','BATCHES')}</span>
                        <span style={{ fontWeight:700 }}>{b.batchCount}</span>
                        <span style={{ fontSize:9, color:C.muted2, marginLeft:8 }}>{T('هدر','WASTE')}</span>
                        <span style={{ color:b.pct>20?C.red:b.pct>10?C.amber:C.green, fontWeight:700 }}>{b.pct}%</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:20, marginBottom:10, fontSize:11 }}>
                      <div><span style={{ color:C.muted2 }}>{T('منتج','Produced')}: </span><span style={{ fontWeight:600 }}>{b.produced}</span></div>
                      <div><span style={{ color:C.muted2 }}>{T('مهدر','Wasted')}: </span><span style={{ color:C.red, fontWeight:600 }}>{b.wasted}</span></div>
                    </div>
                    <Bar pct={b.pct} color={b.pct>20?C.red:b.pct>10?C.amber:C.green} h={6}/>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
