'use client'
import { useState, useRef, useEffect } from 'react'

const C = {
  bg:'#ffffff', surf:'#ffffff', surf2:'#f4f6f9', surf3:'#e8ebf2',
  border:'#e2e6ed', border2:'#c8cdd8',
  amber:'#d97706', amberDim:'rgba(217,119,6,0.08)', amberBrd:'rgba(217,119,6,0.3)',
  green:'#16a34a', blue:'#2563eb', blueDim:'rgba(37,99,235,0.07)', blueBrd:'rgba(37,99,235,0.25)',
  muted:'#94a3b8', muted2:'#64748b', text:'#111827', textDim:'#374151',
  active:'#2563eb', activeDim:'rgba(37,99,235,0.08)',
}

const NAV = [
  { key:'dashboard', label:{en:'Dashboard',ar:'الرئيسية'}, href:'/dashboard', roles:['super_admin','admin','branch_user'] },
  { key:'forecast', label:{en:'Forecast',ar:'التنبؤ'}, roles:['super_admin','admin'], children:[
    { key:'f-daily',   label:{en:'Daily Forecast',  ar:'التنبؤ اليومي'},    href:'/forecast' },
    { key:'f-weekly',  label:{en:'Weekly Forecast', ar:'التنبؤ الأسبوعي'}, href:'/forecast/weekly' },
    { key:'f-compare', label:{en:'D-2 vs D-1',      ar:'مقارنة D-2 و D-1'}, href:'/forecast/compare', bo:true },
    { key:'f-perf',    label:{en:'Performance',     ar:'أداء النموذج'},     href:'/forecast/performance', bo:true },
  ]},
  { key:'operations', label:{en:'Operations',ar:'العمليات'}, href:'/operations', roles:['super_admin','admin','branch_user'] },
  { key:'analytics',  label:{en:'Analytics', ar:'التحليلات'}, href:'/analytics',  roles:['super_admin','admin'] },
  { key:'log',        label:{en:'Log Entry', ar:'تسجيل'},     href:'/log',        roles:['super_admin','admin','branch_user'] },
  { key:'data', label:{en:'Data',ar:'البيانات'}, roles:['super_admin','admin'], children:[
    { key:'import',    label:{en:'Import',    ar:'استيراد'}, href:'/import' },
    { key:'transform', label:{en:'Transform', ar:'تحويل'},   href:'/transform' },
  ]},
  { key:'admin', label:{en:'Admin',ar:'الإدارة'}, roles:['super_admin','admin'], children:[
    { key:'users',     label:{en:'Users',           ar:'المستخدمون'},      href:'/admin/users' },
    { key:'employees', label:{en:'Employee Shifts', ar:'ورديات الموظفين'}, href:'/admin/employees' },
  ]},
]

function Dropdown({ items, lang, path, onClose }) {
  return (
    <div style={{ position:'absolute', top:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)',
      background:'#ffffff', border:`1px solid ${C.border2}`, borderRadius:12, minWidth:220,
      overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.12)', zIndex:300 }}>
      {items.map((item, i) => {
        const active = path === item.href
        return (
          <a key={item.key} href={item.href} onClick={onClose}
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 18px', textDecoration:'none', fontSize:14,
              fontWeight: active ? 600 : 400, color: active ? C.active : C.text,
              background: active ? C.activeDim : 'transparent',
              borderBottom: i < items.length-1 ? `1px solid ${C.border}` : 'none',
              direction: lang==='ar' ? 'rtl' : 'ltr', transition:'background 0.15s' }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surf2 }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
            <span>{item.label[lang]}</span>
            {item.bo && <span style={{ fontSize:9, background:C.blueDim, border:`1px solid ${C.blueBrd}`,
              color:C.blue, borderRadius:4, padding:'1px 6px', fontWeight:700 }}>BO+</span>}
          </a>
        )
      })}
    </div>
  )
}

function Item({ item, lang, path, role }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isActive = item.href ? path === item.href : item.children?.some(c => path === c.href)
  const visibleChildren = item.children?.filter(c => !c.roles || c.roles.includes(role))

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const base = { display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:8,
    border:'none', background: isActive ? C.activeDim : 'transparent',
    color: isActive ? C.active : C.textDim, fontWeight: isActive ? 600 : 500,
    fontSize:14, cursor:'pointer', fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
    textDecoration:'none', whiteSpace:'nowrap', transition:'background 0.15s, color 0.15s' }

  const hoverOn  = e => { if (!isActive) { e.currentTarget.style.background=C.surf2; e.currentTarget.style.color=C.text } }
  const hoverOff = e => { if (!isActive) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color=C.textDim } }

  if (item.href && !visibleChildren?.length) {
    return <a href={item.href} style={base} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>{item.label[lang]}</a>
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button style={base} onClick={() => setOpen(o => !o)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        {item.label[lang]}
        <svg width="11" height="11" viewBox="0 0 10 10" fill="none" style={{ opacity:0.45, transform:open?'rotate(180deg)':'none', transition:'transform 0.2s' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && visibleChildren?.length > 0 && (
        <Dropdown items={visibleChildren} lang={lang} path={path} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

export default function TopNav({ profile, currentPath='', children }) {
  const role      = profile?.role      || 'branch_user'
  const adminType = profile?.admin_type || null
  const items     = NAV.filter(i => i.roles.includes(role))
  const [lang, setLang] = useState('ar')

  const toggleLang = () => {
    const next = lang === 'ar' ? 'en' : 'ar'
    setLang(next)
    typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('langchange', { detail: next }))
  }

  const roleLabel =
    role === 'super_admin'         ? 'Super Admin'    :
    adminType === 'branch_manager' ? 'Branch Manager' :
    role === 'admin'               ? 'Business Owner' : 'Employee'

  return (
    <>
      <style>{`.tnav*{box-sizing:border-box}.tnav a,.tnav button{outline:none}`}</style>
      <nav className="tnav" style={{
        position:'fixed', top:0, left:0, right:0, zIndex:200, height:62,
        background:'#ffffff', borderBottom:`1px solid ${C.border}`,
        boxShadow:'0 1px 6px rgba(0,0,0,0.07)',
        display:'flex', alignItems:'center', padding:'0 28px', gap:8,
        fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
      }}>
        <a href="/dashboard" style={{ display:'flex', alignItems:'center', gap:10,
          textDecoration:'none', marginRight:18, flexShrink:0 }}>
          <span style={{ fontSize:24 }}>🫒</span>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:17,
              color:C.text, letterSpacing:'-0.03em', lineHeight:1.15 }}>Branch Ops</div>
            <div style={{ fontSize:11, color:C.muted2, fontWeight:500, marginTop:1 }}>{roleLabel}</div>
          </div>
        </a>

        <div style={{ width:1, height:30, background:C.border, marginRight:10, flexShrink:0 }} />

        <div style={{ display:'flex', gap:2, alignItems:'center', flex:1 }}>
          {items.map(item => <Item key={item.key} item={item} lang={lang} path={currentPath} role={role} adminType={adminType} />)}
        </div>

        <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <button onClick={toggleLang} style={{
            background:C.surf2, border:`1px solid ${C.border2}`, color:C.textDim,
            borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit' }}
            onMouseEnter={e => e.currentTarget.style.background=C.surf3}
            onMouseLeave={e => e.currentTarget.style.background=C.surf2}>
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>
          {children}
        </div>
      </nav>
      <div style={{ height:62 }} />
    </>
  )
}
