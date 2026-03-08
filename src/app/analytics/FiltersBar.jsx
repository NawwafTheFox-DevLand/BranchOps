'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  surf: '#0d0f12',
  surf2: '#131618',
  border: '#1e2328',
  border2: '#252d35',
  amber: '#f59e0b',
  text: '#e5e7eb',
  muted2: '#6b7280',
}

function TT(lang, ar, en) {
  return lang === 'ar' ? ar : en
}

export default function FiltersBar({ lang = 'ar', filters, classOptions }) {
  const router = useRouter()

  const periodOptions = filters?.periodOptions || []
  const branchOptions = filters?.branchOptions || []
  const productOptions = filters?.productOptions || []
  const selected = filters?.selected || {}

  const [period, setPeriod] = useState(selected.period || '')
  const [branch, setBranch] = useState(selected.branch || '')
  const [cls, setCls] = useState(selected.class || '')
  const [product, setProduct] = useState(selected.product || '')

  useEffect(() => {
    setPeriod(selected.period || '')
    setBranch(selected.branch || '')
    setCls(selected.class || '')
    setProduct(selected.product || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.period, selected.branch, selected.class, selected.product])

  const branchNote = useMemo(() => {
    if (!branch) return null
    const affects = filters?.notes?.branchAffects || []
    return `${TT(lang, 'فلتر الفرع يؤثر على:', 'Branch filter affects:')} ${affects.join(', ')}`
  }, [branch, filters, lang])

  const apply = (next) => {
    const p = new URLSearchParams()

    const nextPeriod = (next?.period ?? period ?? '').toString().trim()
    const nextBranch = (next?.branch ?? branch ?? '').toString().trim()
    const nextClass = (next?.cls ?? cls ?? '').toString().trim()
    const nextProduct = (next?.product ?? product ?? '').toString().trim()

    if (nextPeriod) p.set('period', nextPeriod)
    if (nextBranch) p.set('branch', nextBranch)
    if (nextClass) p.set('class', nextClass)
    if (nextProduct) p.set('product', nextProduct)

    const qs = p.toString()
    router.replace(qs ? `/analytics?${qs}` : '/analytics')
  }

  const clear = () => {
    setBranch('')
    setCls('')
    setProduct('')
    apply({ branch: '', cls: '', product: '' })
  }

  const selectStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 10,
    border: `1px solid ${C.border2}`,
    background: C.surf2,
    color: C.text,
    fontSize: 11,
    outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle = {
    fontSize: 9,
    color: C.muted2,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 6,
  }

  return (
    <div
      style={{
        background: C.surf,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{TT(lang, 'الفلاتر', 'Filters')}</div>
          <div style={{ fontSize: 10, color: C.muted2, marginTop: 2 }}>
            {TT(lang, 'اختر الشهر ثم (اختياري) الفرع/الفئة/المنتج', 'Pick a month, then (optional) branch/class/product')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => apply({})}
            style={{
              padding: '7px 10px',
              borderRadius: 10,
              border: `1px solid ${C.border2}`,
              background: 'rgba(245,158,11,0.10)',
              color: C.amber,
              fontWeight: 800,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {TT(lang, 'تطبيق', 'Apply')}
          </button>
          <button
            onClick={clear}
            style={{
              padding: '7px 10px',
              borderRadius: 10,
              border: `1px solid ${C.border2}`,
              background: C.surf2,
              color: C.muted2,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {TT(lang, 'مسح', 'Clear')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1.2fr', gap: 10 }}>
        <div>
          <div style={labelStyle}>{TT(lang, 'الشهر', 'Month')}</div>
          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value)
              apply({ period: e.target.value })
            }}
            style={selectStyle}
          >
            {periodOptions.length === 0 ? (
              <option value="">{TT(lang, 'لا توجد فترات', 'No periods')}</option>
            ) : (
              periodOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <div style={labelStyle}>{TT(lang, 'الفرع', 'Branch')}</div>
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value)
              apply({ branch: e.target.value })
            }}
            style={selectStyle}
          >
            <option value="">{TT(lang, 'الكل', 'All')}</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>{`${b.code || ''} ${b.name || ''}`.trim()}</option>
            ))}
          </select>
          {branchNote && <div style={{ marginTop: 6, fontSize: 10, color: C.muted2 }}>{branchNote}</div>}
        </div>

        <div>
          <div style={labelStyle}>{TT(lang, 'فئة القائمة', 'Product Class')}</div>
          <select
            value={cls}
            onChange={(e) => {
              setCls(e.target.value)
              apply({ cls: e.target.value })
            }}
            style={selectStyle}
          >
            <option value="">{TT(lang, 'الكل', 'All')}</option>
            {(classOptions || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 6, fontSize: 10, color: C.muted2 }}>
            {TT(lang, 'ملاحظة: الفئة تعتمد على بيانات المبيعات (Menu Engineering) فقط.', 'Note: Class applies to sales/menu engineering only.')}
          </div>
        </div>

        <div>
          <div style={labelStyle}>{TT(lang, 'المنتج', 'Product')}</div>
          <select
            value={product}
            onChange={(e) => {
              setProduct(e.target.value)
              apply({ product: e.target.value })
            }}
            style={selectStyle}
          >
            <option value="">{TT(lang, 'الكل', 'All')}</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_ar ? `${p.name_ar} (${p.erp_code || ''})`.trim() : p.erp_code || p.id}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 6, fontSize: 10, color: C.muted2 }}>
            {TT(lang, 'فلتر المنتج يطبّق على المبيعات/المشتريات/الهدر إذا كان هناك ربط بالمنتج.', 'Product filter applies where product linkage exists.')}
          </div>
        </div>
      </div>
    </div>
  )
}
