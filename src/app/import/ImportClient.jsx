'use client'
import { useState } from 'react'

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

function Card({ title, desc, children }) {
  return (
    <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:5 }}>{title}</div>
      <div style={{ fontSize:11, color:C.muted, marginBottom:16, lineHeight:1.6 }}>{desc}</div>
      {children}
    </div>
  )
}

function Btn({ onClick, disabled, loading, color=C.amber, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      marginTop:12, width:'100%', padding:'11px', borderRadius:10, border:'none',
      fontWeight:800, fontSize:13, cursor:disabled?'not-allowed':'pointer',
      background:disabled?'#1a1a1a':color, color:disabled?'#555':'#0a0a0a',
      fontFamily:"'Syne',sans-serif", opacity:disabled?0.6:1,
    }}>{loading ? '⏳ جارٍ الاستيراد…' : children}</button>
  )
}

function Result({ result }) {
  if (!result) return null
  return (
    <div style={{
      marginTop:12, padding:14, borderRadius:10,
      background:result.ok?'rgba(34,197,94,0.07)':'rgba(239,68,68,0.07)',
      border:`1px solid ${result.ok?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}`,
    }}>
      <div style={{ fontWeight:800, fontSize:12, color:result.ok?C.green:C.red, marginBottom:6 }}>
        {result.ok ? '✓ نجح الاستيراد' : '✗ فشل الاستيراد'}
      </div>
      <pre style={{ margin:0, whiteSpace:'pre-wrap', color:C.text, fontSize:11, lineHeight:1.7 }}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  )
}

export default function ImportClient() {
  const [files,   setFiles]   = useState({})
  const [period,  setPeriod]  = useState('')
  const [loading, setLoading] = useState(null)
  const [results, setResults] = useState({})

  const setFile = (key, file) => setFiles(f => ({ ...f, [key]: file }))

  const run = async (type, endpoint) => {
    const file = files[type]
    if (!file && type !== 'sales_daily') return alert('اختر ملفاً أولاً')
    if (type === 'sales_summary' && !period) return alert('أدخل label الفترة (مثل: Jan 2026)')

    setLoading(type)
    setResults(r => ({ ...r, [type]: null }))
    try {
      const fd = new FormData()
      if (file) fd.append('file', file)
      if (type === 'sales_summary') fd.append('period_label', period)

      const res = await fetch(endpoint, { method:'POST', body:fd })
      const out = await res.json().catch(() => ({ ok:false, error:`HTTP ${res.status}` }))
      setResults(r => ({ ...r, [type]: out }))
    } catch(e) {
      setResults(r => ({ ...r, [type]: { ok:false, error:e.message } }))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text, padding:28 }} dir="rtl">
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ marginBottom:28 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:22, letterSpacing:'-0.04em' }}>
            استيراد البيانات <span style={{ color:C.amber }}>Data Import</span>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
            استورد ملفات Excel من نظام ERP لتحديث لوحة التحليلات
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

          {/* Purchases */}
          <Card title="استيراد المشتريات" desc="ارفع Purchases.xlsx — يُدرج البيانات في جدول purchases ويُضيف المنتجات تلقائياً.">
            <input type="file" accept=".xlsx"
              onChange={e => setFile('purchases', e.target.files?.[0])}
              style={{ width:'100%', fontSize:11, color:C.muted }}/>
            <Btn onClick={() => run('purchases', '/api/import/purchases')}
              disabled={!files.purchases || !!loading}
              loading={loading==='purchases'} color={C.amber}>
              📦 استورد المشتريات
            </Btn>
            <Result result={results.purchases}/>
          </Card>

          {/* Sales Summary */}
          <Card title="استيراد ملخص المبيعات" desc="ارفع Sales.xlsx (هندسة القائمة) — يُدرج في جدول sales_summary مع التصنيف.">
            <input type="file" accept=".xlsx"
              onChange={e => setFile('sales_summary', e.target.files?.[0])}
              style={{ width:'100%', fontSize:11, color:C.muted, marginBottom:8 }}/>
            <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>تسمية الفترة (مثل: Jan 2026)</div>
            <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Jan 2026"
              style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:`1px solid ${C.border2}`, background:'#0a0a0a', color:C.text, fontSize:12, fontFamily:'inherit' }}/>
            <Btn onClick={() => run('sales_summary', '/api/import/sales-summary')}
              disabled={!files.sales_summary || !period || !!loading}
              loading={loading==='sales_summary'} color={C.amber}>
              📊 استورد ملخص المبيعات
            </Btn>
            <Result result={results.sales_summary}/>
          </Card>

          {/* Menu Analysis (new route) */}
          <Card title="استيراد تحليل القائمة (موسّع)" desc="ارفع Sales.xlsx — يُدرج في sales_summary مع ربط المنتجات وتصنيفها تلقائياً.">
            <input type="file" accept=".xlsx"
              onChange={e => setFile('menu_analysis', e.target.files?.[0])}
              style={{ width:'100%', fontSize:11, color:C.muted, marginBottom:8 }}/>
            <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>تسمية الفترة</div>
            <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Jan 2026"
              style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:`1px solid ${C.border2}`, background:'#0a0a0a', color:C.text, fontSize:12, fontFamily:'inherit' }}/>
            <Btn onClick={() => run('menu_analysis', '/api/import/menu-analysis')}
              disabled={!files.menu_analysis || !period || !!loading}
              loading={loading==='menu_analysis'} color={C.green}>
              🍽️ استورد تحليل القائمة
            </Btn>
            <Result result={results.menu_analysis}/>
          </Card>

          {/* Notes */}
          <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, marginBottom:12, color:C.amber }}>📌 ملاحظات الاستيراد</div>
            <ul style={{ listStyle:'none', padding:0, fontSize:11, color:C.muted, lineHeight:2.2 }}>
              <li>✓ يتم تجاهل الصفوف الفارغة والمدمجة تلقائياً</li>
              <li>✓ المرتجعات (مرتجع مشتريات) تُسجَّل بكميات سالبة</li>
              <li>✓ رموز ERP تُحوَّل من 94.0 إلى "94" تلقائياً</li>
              <li>✓ مطابقة المنتجات تتم باسم عربي مطابق تماماً</li>
              <li>✓ عمود التصنيف يُقرأ من خانة Class أو التصنيف</li>
              <li>→ بعد الاستيراد اذهب إلى <a href="/analytics" style={{ color:C.amber }}>Analytics</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
