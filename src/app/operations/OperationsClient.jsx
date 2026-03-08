'use client'
import { useState, useEffect, useCallback } from 'react'

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

const REASONS = {
  hot_hold_expired: { ar: 'انتهى وقت الاحتفاظ', en: 'Hot Hold Expired' },
  overproduction:   { ar: 'إنتاج زائد',          en: 'Overproduction'   },
  damaged:          { ar: 'تالف',                en: 'Damaged'          },
  other:            { ar: 'أخرى',               en: 'Other'            },
}

const TABS = [
  { id: 'batch',    icon: '🍳', ar: 'تسجيل دفعة',  en: 'Log Batch'    },
  { id: 'waste',    icon: '🗑',  ar: 'تسجيل هدر',   en: 'Log Waste'    },
  { id: 'stockout', icon: '⚠️', ar: 'نفاد مخزون',  en: 'Stockout'     },
  { id: 'log',      icon: '📋', ar: 'السجل',        en: 'Recent Log'   },
]

const Lbl = ({ ar, en, lang }) => <span>{lang === 'ar' ? ar : en}</span>

export default function OperationsClient({ branches, products, slots, userRole, userBranchId }) {
  const [lang,    setLang]    = useState('ar')
  const [tab,     setTab]     = useState('batch')
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState(null)
  const [kpi,     setKpi]     = useState(null)
  const [recent,  setRecent]  = useState({ batches:[], waste:[], stockouts:[] })

  // Form state
  const [batchForm,    setBatch]    = useState({ branch_id:'', product_id:'', slot_id:'', batch_qty:'1', produced_qty:'', cooked_at: nowStr() })
  const [wasteForm,    setWaste]    = useState({ branch_id:'', product_id:'', wasted_qty:'', reason:'hot_hold_expired', wasted_at: nowStr() })
  const [stockoutForm, setStockout] = useState({ branch_id:'', product_id:'', duration_min:'', est_lost_qty:'', occurred_at: nowStr() })

  // Lock branch for non-admin
  const isAdmin = userRole === 'admin'
  const fixedBranch = !isAdmin ? userBranchId : null

  useEffect(() => {
    if (fixedBranch) {
      setBatch(f => ({ ...f, branch_id: fixedBranch }))
      setWaste(f => ({ ...f, branch_id: fixedBranch }))
      setStockout(f => ({ ...f, branch_id: fixedBranch }))
    }
  }, [fixedBranch])

  const loadRecent = useCallback(async () => {
    const res = await fetch('/api/operations?days=7')
    const d = await res.json()
    if (d.ok) { setRecent(d); setKpi(d.kpi) }
  }, [])

  useEffect(() => { loadRecent() }, [loadRecent])

  async function submit(type, form) {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...form }),
      })
      const d = await res.json()
      if (d.ok) {
        setMsg({ ok: true, text: lang === 'ar' ? 'تم الحفظ بنجاح ✓' : 'Saved successfully ✓' })
        // Reset form
        if (type === 'batch')    setBatch(f => ({ ...f, produced_qty:'', cooked_at: nowStr() }))
        if (type === 'waste')    setWaste(f => ({ ...f, wasted_qty:'', wasted_at: nowStr() }))
        if (type === 'stockout') setStockout(f => ({ ...f, duration_min:'', est_lost_qty:'', occurred_at: nowStr() }))
        loadRecent()
      } else {
        setMsg({ ok: false, text: d.error })
      }
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setLoading(false)
    }
  }

  const batchProducts = products.filter(p => p.is_batch_cooked)
  const inp = {
    background: C.surf3, border:`1px solid ${C.border2}`,
    color: C.text, borderRadius: 8, padding: '10px 12px',
    fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit',
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        select,input{font-family:inherit;color:#e5e7eb}
        select option{background:#14171b}
        @keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu .25s ease both}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#252c33;border-radius:2px}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'14px 28px', background:'rgba(7,8,10,0.97)', position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:18, letterSpacing:'-0.03em' }}>
            {lang==='ar' ? 'العمليات اليومية' : 'Daily Operations'}
          </div>
          <div style={{ fontSize:10, color:C.muted2, marginTop:1 }}>
            {lang==='ar' ? 'تسجيل الدفعات والهدر' : 'Log batches & waste'}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* KPI pill */}
          {kpi && (
            <div style={{ background: kpi.wastePct > 20 ? C.redDim : C.greenDim, border:`1px solid ${kpi.wastePct > 20 ? C.redBrd : C.greenBrd}`, borderRadius:8, padding:'6px 14px', fontSize:11, fontWeight:700, color: kpi.wastePct > 20 ? C.red : C.green }}>
              {lang==='ar' ? 'هدر' : 'Waste'}: {kpi.wastePct}%
            </div>
          )}
          {/* Lang toggle */}
          <button onClick={() => setLang(l => l==='ar'?'en':'ar')} style={{ background:C.surf2, border:`1px solid ${C.border2}`, color:C.textDim, borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {lang==='ar' ? 'EN' : 'عربي'}
          </button>
          <a href="/dashboard" style={{ fontSize:11, color:C.textDim, border:`1px solid ${C.border2}`, padding:'6px 10px', borderRadius:7, fontWeight:700, background:C.surf2 }}>
            {lang==='ar' ? 'لوحة التحكم' : 'Dashboard'}
          </a>
        </div>
      </div>

      {/* KPI row */}
      {kpi && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, padding:'20px 28px 0' }}>
          {[
            { label: lang==='ar'?'إجمالي الإنتاج (7 أيام)':'Total Produced (7d)', value: Math.round(kpi.totalProduced), color: C.blue },
            { label: lang==='ar'?'إجمالي الهدر (7 أيام)':'Total Wasted (7d)',    value: Math.round(kpi.totalWasted),   color: C.red  },
            { label: lang==='ar'?'نسبة الهدر':'Waste %',                          value: `${kpi.wastePct}%`,            color: kpi.wastePct > 20 ? C.red : C.green },
            { label: lang==='ar'?'سجلات الدفعات':'Batch Records',                 value: recent.batches.length,         color: C.amber },
          ].map((k,i) => (
            <div key={i} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px' }}>
              <div style={{ fontSize:9, color:C.muted2, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>{k.label}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:26, color:k.color, lineHeight:1 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'0 28px', display:'flex', gap:2, background:C.surf, marginTop:20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'11px 18px', fontSize:12, fontWeight:600, background:'none', border:'none',
            cursor:'pointer', color: tab===t.id ? C.amber : C.muted2, fontFamily:'inherit',
            borderBottom:`2px solid ${tab===t.id ? C.amber : 'transparent'}`, marginBottom:-1,
          }}>
            {t.icon} {lang==='ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      <div style={{ padding:'24px 28px' }}>
        {msg && (
          <div className="fu" style={{ marginBottom:16, padding:'10px 16px', borderRadius:10, background: msg.ok ? C.greenDim : C.redDim, border:`1px solid ${msg.ok ? C.greenBrd : C.redBrd}`, color: msg.ok ? C.green : C.red, fontSize:13, fontWeight:600 }}>
            {msg.text}
          </div>
        )}

        {/* ── BATCH FORM ─────────────────────────────────────────── */}
        {tab === 'batch' && (
          <div className="fu" style={{ maxWidth:560 }}>
            <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'22px 24px' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, marginBottom:6 }}>
                🍳 {lang==='ar' ? 'تسجيل دفعة إنتاج' : 'Log Production Batch'}
              </div>
              <div style={{ fontSize:11, color:C.muted2, marginBottom:20 }}>
                {lang==='ar'
                  ? 'سجّل كل دفعة تم طهيها مع الكمية المنتجة. يُستخدم لحساب نسبة الهدر وتحسين دقة التنبؤ.'
                  : 'Record each cooked batch with quantity produced. Used to calculate waste % and improve forecast accuracy.'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <Field label={lang==='ar'?'الفرع':'Branch'}>
                  <select value={batchForm.branch_id} onChange={e=>setBatch(f=>({...f,branch_id:e.target.value}))} style={inp} disabled={!isAdmin && !!fixedBranch}>
                    <option value="">{lang==='ar'?'اختر الفرع':'Select Branch'}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
                  </select>
                </Field>
                <Field label={lang==='ar'?'المنتج':'Product'}>
                  <select value={batchForm.product_id} onChange={e=>setBatch(f=>({...f,product_id:e.target.value}))} style={inp}>
                    <option value="">{lang==='ar'?'اختر المنتج':'Select Product'}</option>
                    {batchProducts.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
                  </select>
                </Field>
                <Field label={lang==='ar'?'الفترة الزمنية':'Time Slot'}>
                  <select value={batchForm.slot_id} onChange={e=>setBatch(f=>({...f,slot_id:e.target.value}))} style={inp}>
                    <option value="">{lang==='ar'?'اختر الفترة':'Select Slot'}</option>
                    {slots.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label={lang==='ar'?'الكمية (كجم)':'Batch Qty (kg)'}>
                  <input type="number" min="0.1" step="0.5" value={batchForm.batch_qty}
                    onChange={e=>setBatch(f=>({...f,batch_qty:e.target.value}))} style={inp} />
                </Field>
                <Field label={lang==='ar'?'الكمية المنتجة (وحدة)':'Produced Units'}>
                  <input type="number" min="1" value={batchForm.produced_qty}
                    onChange={e=>setBatch(f=>({...f,produced_qty:e.target.value}))}
                    placeholder={lang==='ar'?'اختياري':'optional'} style={inp} />
                </Field>
                <Field label={lang==='ar'?'وقت الطهي':'Cook Time'}>
                  <input type="datetime-local" value={batchForm.cooked_at}
                    onChange={e=>setBatch(f=>({...f,cooked_at:e.target.value}))} style={inp} />
                </Field>
              </div>
              <SubmitBtn loading={loading} lang={lang}
                disabled={!batchForm.branch_id || !batchForm.product_id || !batchForm.slot_id || !batchForm.batch_qty}
                onClick={() => submit('batch', batchForm)} />
            </div>
          </div>
        )}

        {/* ── WASTE FORM ─────────────────────────────────────────── */}
        {tab === 'waste' && (
          <div className="fu" style={{ maxWidth:560 }}>
            <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'22px 24px' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, marginBottom:6 }}>
                🗑 {lang==='ar' ? 'تسجيل هدر / تخلص' : 'Log Waste / Disposal'}
              </div>
              <div style={{ fontSize:11, color:C.muted2, marginBottom:20 }}>
                {lang==='ar'
                  ? 'سجّل أي كمية تم التخلص منها مع سبب الهدر. تُحدَّث نسبة الهدر تلقائياً.'
                  : 'Record any disposed quantity with reason. Waste % updates automatically.'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <Field label={lang==='ar'?'الفرع':'Branch'}>
                  <select value={wasteForm.branch_id} onChange={e=>setWaste(f=>({...f,branch_id:e.target.value}))} style={inp} disabled={!isAdmin && !!fixedBranch}>
                    <option value="">{lang==='ar'?'اختر الفرع':'Select Branch'}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
                  </select>
                </Field>
                <Field label={lang==='ar'?'المنتج':'Product'}>
                  <select value={wasteForm.product_id} onChange={e=>setWaste(f=>({...f,product_id:e.target.value}))} style={inp}>
                    <option value="">{lang==='ar'?'اختر المنتج':'Select Product'}</option>
                    {batchProducts.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
                  </select>
                </Field>
                <Field label={lang==='ar'?'الكمية المهدرة (كجم)':'Wasted Qty (kg)'}>
                  <input type="number" min="0.1" step="0.1" value={wasteForm.wasted_qty}
                    onChange={e=>setWaste(f=>({...f,wasted_qty:e.target.value}))} style={inp} />
                </Field>
                <Field label={lang==='ar'?'سبب الهدر':'Waste Reason'}>
                  <select value={wasteForm.reason} onChange={e=>setWaste(f=>({...f,reason:e.target.value}))} style={inp}>
                    {Object.entries(REASONS).map(([k,v]) => (
                      <option key={k} value={k}>{lang==='ar' ? v.ar : v.en}</option>
                    ))}
                  </select>
                </Field>
                <Field label={lang==='ar'?'وقت التخلص':'Disposal Time'} full>
                  <input type="datetime-local" value={wasteForm.wasted_at}
                    onChange={e=>setWaste(f=>({...f,wasted_at:e.target.value}))} style={inp} />
                </Field>
              </div>
              <SubmitBtn loading={loading} lang={lang}
                disabled={!wasteForm.branch_id || !wasteForm.product_id || !wasteForm.wasted_qty}
                onClick={() => submit('waste', wasteForm)} color={C.red} />
            </div>
          </div>
        )}

        {/* ── STOCKOUT FORM ──────────────────────────────────────── */}
        {tab === 'stockout' && (
          <div className="fu" style={{ maxWidth:560 }}>
            <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:'22px 24px' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, marginBottom:6 }}>
                ⚠️ {lang==='ar' ? 'تسجيل نفاد مخزون' : 'Log Stockout'}
              </div>
              <div style={{ fontSize:11, color:C.muted2, marginBottom:20 }}>
                {lang==='ar'
                  ? 'سجّل أي حادثة نفاد مخزون. يُستخدم لحساب المبيعات الضائعة وضبط التنبؤ.'
                  : 'Record any stockout incident. Used to estimate lost sales and calibrate forecast.'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <Field label={lang==='ar'?'الفرع':'Branch'}>
                  <select value={stockoutForm.branch_id} onChange={e=>setStockout(f=>({...f,branch_id:e.target.value}))} style={inp} disabled={!isAdmin && !!fixedBranch}>
                    <option value="">{lang==='ar'?'اختر الفرع':'Select Branch'}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
                  </select>
                </Field>
                <Field label={lang==='ar'?'المنتج':'Product'}>
                  <select value={stockoutForm.product_id} onChange={e=>setStockout(f=>({...f,product_id:e.target.value}))} style={inp}>
                    <option value="">{lang==='ar'?'اختر المنتج':'Select Product'}</option>
                    {batchProducts.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
                  </select>
                </Field>
                <Field label={lang==='ar'?'المدة (دقيقة)':'Duration (min)'}>
                  <input type="number" min="1" value={stockoutForm.duration_min}
                    onChange={e=>setStockout(f=>({...f,duration_min:e.target.value}))} style={inp} />
                </Field>
                <Field label={lang==='ar'?'الكمية الضائعة المقدرة':'Est. Lost Qty'}>
                  <input type="number" min="0" step="0.5" value={stockoutForm.est_lost_qty}
                    onChange={e=>setStockout(f=>({...f,est_lost_qty:e.target.value}))} style={inp} />
                </Field>
                <Field label={lang==='ar'?'وقت الحادثة':'Occurred At'} full>
                  <input type="datetime-local" value={stockoutForm.occurred_at}
                    onChange={e=>setStockout(f=>({...f,occurred_at:e.target.value}))} style={inp} />
                </Field>
              </div>
              <SubmitBtn loading={loading} lang={lang}
                disabled={!stockoutForm.branch_id || !stockoutForm.product_id}
                onClick={() => submit('stockout', stockoutForm)} color={C.blue} />
            </div>
          </div>
        )}

        {/* ── RECENT LOG ─────────────────────────────────────────── */}
        {tab === 'log' && (
          <div className="fu">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {/* Batches */}
              <LogTable
                title={lang==='ar'?'آخر الدفعات':'Recent Batches'}
                desc={lang==='ar'?'آخر 7 أيام':'Last 7 days'}
                rows={recent.batches.slice(0,15)}
                cols={[
                  { key: r => r.branches?.code || '?',                  label: lang==='ar'?'الفرع':'Branch' },
                  { key: r => r.products?.name_ar || '?',               label: lang==='ar'?'المنتج':'Product', truncate:true },
                  { key: r => r.time_slots?.label || '?',               label: lang==='ar'?'الفترة':'Slot' },
                  { key: r => r.produced_qty || r.batch_qty * 12 || '?',label: lang==='ar'?'الكمية':'Qty', right:true },
                  { key: r => r.cooked_at?.slice(0,16).replace('T',' '),label: lang==='ar'?'الوقت':'Time', dimmed:true },
                ]}
              />
              {/* Waste */}
              <LogTable
                title={lang==='ar'?'آخر الهدر':'Recent Waste'}
                desc={lang==='ar'?'آخر 7 أيام':'Last 7 days'}
                rows={recent.waste.slice(0,15)}
                cols={[
                  { key: r => r.branches?.code || '?',    label: lang==='ar'?'الفرع':'Branch' },
                  { key: r => r.products?.name_ar || '?', label: lang==='ar'?'المنتج':'Product', truncate:true },
                  { key: r => r.wasted_qty,               label: lang==='ar'?'الكمية':'Qty', right:true, color:C.red },
                  { key: r => REASONS[r.reason]?.[lang] || r.reason, label: lang==='ar'?'السبب':'Reason', dimmed:true },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Field({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize:10, color:'#6b7280', letterSpacing:'0.08em', marginBottom:5, textTransform:'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

function SubmitBtn({ loading, lang, disabled, onClick, color='#f59e0b' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        marginTop:20, width:'100%', padding:'13px', borderRadius:10, border:'none',
        background: disabled || loading ? '#1a1e23' : color,
        color: disabled || loading ? '#4b5563' : '#050608',
        fontWeight:800, fontSize:14, cursor: disabled||loading ? 'not-allowed':'pointer',
        fontFamily:"'Syne',sans-serif", letterSpacing:'0.02em',
      }}
    >
      {loading ? (lang==='ar'?'جارٍ الحفظ…':'Saving…') : (lang==='ar'?'حفظ ✓':'Save ✓')}
    </button>
  )
}

function LogTable({ title, desc, rows, cols }) {
  if (!rows.length) return (
    <div style={{ background:'#0f1114', border:'1px solid #1f2429', borderRadius:12, padding:'20px', textAlign:'center', color:'#4b5563', fontSize:12 }}>
      {title} — No data yet
    </div>
  )
  return (
    <div style={{ background:'#0f1114', border:'1px solid #1f2429', borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:'1px solid #1f2429' }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13 }}>{title}</div>
        <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>{desc}</div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #1f2429' }}>
              {cols.map((c,i) => (
                <th key={i} style={{ padding:'7px 10px', textAlign: c.right ? 'right':'left', color:'#6b7280', fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={i} style={{ borderBottom:'1px solid #1f2429' }}>
                {cols.map((c,j) => (
                  <td key={j} style={{
                    padding:'7px 10px',
                    textAlign: c.right ? 'right' : 'left',
                    color: c.color || (c.dimmed ? '#6b7280' : '#e5e7eb'),
                    maxWidth: c.truncate ? 100 : undefined,
                    overflow: c.truncate ? 'hidden' : undefined,
                    textOverflow: c.truncate ? 'ellipsis' : undefined,
                    whiteSpace: c.truncate ? 'nowrap' : undefined,
                  }}>{c.key(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function nowStr() {
  const d = new Date()
  const pad = n => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
