'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:'#f4f6f9', surf:'#ffffff', surf2:'#f0f2f6', surf3:'#e8ebf0',
  border:'#dde1e9', border2:'#c8cdd8',
  amber:'#d97706', amberDim:'rgba(217,119,6,0.08)', amberBrd:'rgba(217,119,6,0.25)',
  amberBorder:'rgba(217,119,6,0.25)',
  green:'#16a34a', greenDim:'rgba(22,163,74,0.07)', greenBrd:'rgba(22,163,74,0.2)',
  greenBorder:'rgba(22,163,74,0.2)',
  red:'#dc2626',   redDim:'rgba(220,38,38,0.07)',   redBrd:'rgba(220,38,38,0.2)',
  redBorder:'rgba(220,38,38,0.2)',
  blue:'#2563eb',  blueDim:'rgba(37,99,235,0.07)',  blueBrd:'rgba(37,99,235,0.2)',
  teal:'#0d9488',  violet:'#7c3aed',
  muted:'#94a3b8', muted2:'#64748b', text:'#111827', textDim:'#374151',
  surface: '#ffffff', surfaceHigh: '#f0f2f6',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const nowLocal = () => {
  // datetime-local expects local time string: YYYY-MM-DDTHH:mm
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const WASTE_REASONS = [
  { value: 'hot_hold_expired', label: 'انتهى وقت الاحتفاظ الساخن' },
  { value: 'overproduction', label: 'إنتاج زائد' },
  { value: 'damaged', label: 'تالف' },
  { value: 'other', label: 'أخرى' },
]

const TABS = [
  { id: 'batch', icon: '🍳', label: 'دفعة إنتاج', labelEn: 'Batch' },
  { id: 'waste', icon: '🗑', label: 'هدر / تخلص', labelEn: 'Waste' },
  { id: 'stockout', icon: '⚠️', label: 'نفاد المخزون', labelEn: 'Stockout' },
]

// ── Reusable form field ────────────────────────────────────────────────────────
const Field = ({ label, labelAr, error, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <label style={{ fontSize: 11, color: C.muted2, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </label>
      {labelAr && <span style={{ fontSize: 11, color: C.muted2, direction: 'rtl' }}>{labelAr}</span>}
    </div>
    {children}
    {error && <div style={{ fontSize: 10, color: C.red, marginTop: 3 }}>{error}</div>}
  </div>
)

const inputStyle = (hasError, disabled) => ({
  width: '100%',
  background: disabled ? C.surf3 : C.surfaceHigh,
  border: `1px solid ${hasError ? C.redBorder : C.border2}`,
  borderRadius: 8,
  padding: '11px 13px',
  fontSize: 14,
  color: disabled ? C.muted2 : C.text,
  outline: 'none',
  appearance: 'none',
  boxSizing: 'border-box',
  WebkitAppearance: 'none',
  cursor: disabled ? 'not-allowed' : 'auto',
})

const Select = ({ value, onChange, options, placeholder, error, disabled }) => (
  <div style={{ position: 'relative' }}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ ...inputStyle(error, disabled), paddingRight: 32, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <option value="">{placeholder ?? '— select —'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <span
      style={{
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        color: C.muted2,
        pointerEvents: 'none',
        fontSize: 10,
      }}
    >
      ▼
    </span>
  </div>
)

const Input = ({ value, onChange, type = 'text', min, max, step, placeholder, error, disabled }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    type={type}
    min={min}
    max={max}
    step={step}
    placeholder={placeholder}
    disabled={disabled}
    style={{ ...inputStyle(error, disabled), cursor: disabled ? 'not-allowed' : 'text' }}
  />
)

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ toast }) => {
  if (!toast) return null
  const isOk = toast.type === 'success'
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: isOk ? C.greenDim : C.redDim,
        border: `1px solid ${isOk ? C.greenBorder : C.redBorder}`,
        borderRadius: 10,
        padding: '12px 20px',
        fontSize: 13,
        fontWeight: 600,
        color: isOk ? C.green : C.red,
        zIndex: 999,
        maxWidth: '90vw',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        animation: 'slideUp .25s ease',
      }}
    >
      {isOk ? '✓' : '✗'} {toast.msg}
    </div>
  )
}

// ── Today's log summary ────────────────────────────────────────────────────────
function TodaySummary({ todayStartISO, branchFilter }) {
  const [counts, setCounts] = useState({ batches: 0, waste: 0, stockouts: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()

        const qBatches = supabase
          .from('production_batches')
          .select('id', { count: 'exact', head: true })
          .gte('cooked_at', todayStartISO)

        const qWaste = supabase
          .from('waste_events')
          .select('id', { count: 'exact', head: true })
          .gte('wasted_at', todayStartISO)

        const qStock = supabase
          .from('stockout_events')
          .select('id', { count: 'exact', head: true })
          .gte('occurred_at', todayStartISO)

        if (branchFilter?.branch_id) {
          qBatches.eq('branch_id', branchFilter.branch_id)
          qWaste.eq('branch_id', branchFilter.branch_id)
          qStock.eq('branch_id', branchFilter.branch_id)
        }

        const [b, w, s] = await Promise.all([qBatches, qWaste, qStock])

        if (cancelled) return

        setCounts({
          batches: b.count ?? 0,
          waste: w.count ?? 0,
          stockouts: s.count ?? 0,
        })
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [todayStartISO, branchFilter?.branch_id])

  const stats = [
    { label: 'Batches Today', labelAr: 'دفعات اليوم', val: counts.batches, color: C.amber },
    { label: 'Waste Events', labelAr: 'أحداث الهدر', val: counts.waste, color: C.red },
    { label: 'Stockouts', labelAr: 'نفاد المخزون', val: counts.stockouts, color: C.blue },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '12px 10px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: loading ? 16 : 26,
              fontWeight: 800,
              color: s.color,
              fontFamily: "'Syne',sans-serif",
            }}
          >
            {loading ? '·' : s.val}
          </div>
          <div
            style={{
              fontSize: 9,
              color: C.muted2,
              marginTop: 3,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {s.label}
          </div>
          <div style={{ fontSize: 9, color: C.muted2, direction: 'rtl' }}>{s.labelAr}</div>
        </div>
      ))}
    </div>
  )
}

// ── Batch Log Form ─────────────────────────────────────────────────────────────
function BatchForm({ branches, products, slots, branchLock, onSuccess, refreshRecentBatches, userId }) {
  const batchProducts = useMemo(() => products.filter((p) => p.is_batch_cooked), [products])

  const [form, setForm] = useState({
    branch_id: branchLock?.branch_id || '',
    product_id: '',
    slot_id: '',
    cooked_at: nowLocal(),
    batch_qty: '1',
    produced_qty: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (branchLock?.branch_id) {
      setForm((f) => ({ ...f, branch_id: branchLock.branch_id }))
    }
  }, [branchLock?.branch_id])

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.branch_id) e.branch_id = 'Required'
    if (!form.product_id) e.product_id = 'Required'
    if (!form.cooked_at) e.cooked_at = 'Required'
    if (!form.batch_qty || parseFloat(form.batch_qty) <= 0) e.batch_qty = 'Must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)

    try {
      const supabase = createClient()

      const payload = {
        branch_id: form.branch_id,
        product_id: form.product_id,
        slot_id: form.slot_id ? parseInt(form.slot_id) : null,
        cooked_at: new Date(form.cooked_at).toISOString(),
        batch_qty: parseFloat(form.batch_qty),
        produced_qty: form.produced_qty ? parseFloat(form.produced_qty) : null,
        logged_by: userId,
      }

      const { error } = await supabase.from('production_batches').insert(payload)
      if (error) throw error

      setForm((f) => ({
        ...f,
        product_id: '',
        slot_id: '',
        cooked_at: nowLocal(),
        batch_qty: '1',
        produced_qty: '',
      }))

      onSuccess('Batch logged ✓')
      refreshRecentBatches?.()
    } catch (e) {
      onSuccess('Error: ' + (e?.message || 'Failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const selProduct = batchProducts.find((p) => p.id === form.product_id)

  return (
    <div>
      <Field label="Branch" labelAr="الفرع" error={errors.branch_id}>
        <Select
          value={form.branch_id}
          onChange={(v) => set('branch_id', v)}
          error={errors.branch_id}
          disabled={!!branchLock?.branch_id}
          options={branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
          placeholder="Select branch"
        />
      </Field>

      <Field label="Product" labelAr="المنتج" error={errors.product_id}>
        <Select
          value={form.product_id}
          onChange={(v) => set('product_id', v)}
          error={errors.product_id}
          options={batchProducts.map((p) => ({ value: p.id, label: p.name_ar ?? p.name_en ?? p.erp_code }))}
          placeholder="Select product (batch items only)"
        />
      </Field>

      {selProduct && (
        <div
          style={{
            background: C.amberDim,
            border: `1px solid ${C.amberBorder}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
            fontSize: 11,
            color: C.amber,
          }}
        >
          Batch: {selProduct.batch_size_kg ?? '—'}kg → ~{selProduct.yield_per_batch ?? '—'} units · Expires in{' '}
          {selProduct.hot_hold_minutes ?? 120} min
        </div>
      )}

      <Field label="Time Slot" labelAr="الفترة الزمنية">
        <Select
          value={form.slot_id}
          onChange={(v) => set('slot_id', v)}
          options={slots.map((s) => ({ value: s.id, label: s.label }))}
          placeholder="Select slot (optional)"
        />
      </Field>

      <Field label="Cooked At" labelAr="وقت الطهي" error={errors.cooked_at}>
        <Input value={form.cooked_at} onChange={(v) => set('cooked_at', v)} type="datetime-local" error={errors.cooked_at} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Batch Qty (kg)" labelAr="الكمية (كجم)" error={errors.batch_qty}>
          <Input value={form.batch_qty} onChange={(v) => set('batch_qty', v)} type="number" min="0.1" step="0.5" error={errors.batch_qty} />
        </Field>
        <Field label="Produced Units" labelAr="الوحدات المنتجة">
          <Input
            value={form.produced_qty}
            onChange={(v) => set('produced_qty', v)}
            type="number"
            min="0"
            step="1"
            placeholder={selProduct?.yield_per_batch ?? 'e.g. 14'}
          />
        </Field>
      </div>

      <button
        onClick={submit}
        disabled={saving}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 10,
          marginTop: 4,
          background: saving ? C.surface : C.amber,
          color: saving ? C.muted : '#0a0a0a',
          border: 'none',
          fontWeight: 800,
          fontSize: 15,
          cursor: saving ? 'not-allowed' : 'pointer',
          letterSpacing: '0.02em',
        }}
      >
        {saving ? 'Saving…' : 'Log Batch 🍳'}
      </button>
    </div>
  )
}

// ── Waste Log Form ─────────────────────────────────────────────────────────────
function WasteForm({ branches, products, recentBatches, branchLock, onSuccess, userId }) {
  const [form, setForm] = useState({
    branch_id: branchLock?.branch_id || '',
    product_id: '',
    batch_id: '',
    wasted_at: nowLocal(),
    wasted_qty: '',
    reason: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (branchLock?.branch_id) {
      setForm((f) => ({ ...f, branch_id: branchLock.branch_id }))
    }
  }, [branchLock?.branch_id])

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: null }))
  }

  const branchBatches = useMemo(() => {
    return recentBatches.filter(
      (b) => b.branch_id === form.branch_id && (!form.product_id || b.product_id === form.product_id)
    )
  }, [recentBatches, form.branch_id, form.product_id])

  const validate = () => {
    const e = {}
    if (!form.branch_id) e.branch_id = 'Required'
    if (!form.product_id) e.product_id = 'Required'
    if (!form.wasted_qty || parseFloat(form.wasted_qty) <= 0) e.wasted_qty = 'Must be > 0'
    if (!form.reason) e.reason = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        branch_id: form.branch_id,
        product_id: form.product_id,
        batch_id: form.batch_id || null,
        wasted_at: new Date(form.wasted_at).toISOString(),
        wasted_qty: parseFloat(form.wasted_qty),
        reason: form.reason,
        notes: form.notes || null,
        logged_by: userId,
      }

      const { error } = await supabase.from('waste_events').insert(payload)
      if (error) throw error

      setForm((f) => ({
        ...f,
        product_id: '',
        batch_id: '',
        wasted_at: nowLocal(),
        wasted_qty: '',
        reason: '',
        notes: '',
      }))
      onSuccess('Waste logged ✓')
    } catch (e) {
      onSuccess('Error: ' + (e?.message || 'Failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Field label="Branch" labelAr="الفرع" error={errors.branch_id}>
        <Select
          value={form.branch_id}
          onChange={(v) => set('branch_id', v)}
          error={errors.branch_id}
          disabled={!!branchLock?.branch_id}
          options={branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
          placeholder="Select branch"
        />
      </Field>

      <Field label="Product" labelAr="المنتج" error={errors.product_id}>
        <Select
          value={form.product_id}
          onChange={(v) => set('product_id', v)}
          error={errors.product_id}
          options={products.map((p) => ({ value: p.id, label: p.name_ar ?? p.erp_code }))}
          placeholder="Select product"
        />
      </Field>

      <Field label="Link to Batch (optional)" labelAr="ربط بالدفعة (اختياري)">
        <Select
          value={form.batch_id}
          onChange={(v) => set('batch_id', v)}
          options={branchBatches.map((b) => ({
            value: b.id,
            label: `${new Date(b.cooked_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} — ${b.produced_qty ?? '?'} units`,
          }))}
          placeholder="Select recent batch (optional)"
        />
      </Field>

      <Field label="Wasted At" labelAr="وقت التخلص" error={errors.wasted_at}>
        <Input value={form.wasted_at} onChange={(v) => set('wasted_at', v)} type="datetime-local" error={errors.wasted_at} />
      </Field>

      <Field label="Wasted Qty (units)" labelAr="الكمية المهدرة" error={errors.wasted_qty}>
        <Input
          value={form.wasted_qty}
          onChange={(v) => set('wasted_qty', v)}
          type="number"
          min="0.1"
          step="1"
          placeholder="e.g. 4"
          error={errors.wasted_qty}
        />
      </Field>

      <Field label="Reason" labelAr="السبب" error={errors.reason}>
        <Select value={form.reason} onChange={(v) => set('reason', v)} error={errors.reason} options={WASTE_REASONS} placeholder="Select reason" />
      </Field>

      <Field label="Notes (optional)" labelAr="ملاحظات">
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Any additional notes…"
          style={{ ...inputStyle(false, false), height: 72, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>

      <button
        onClick={submit}
        disabled={saving}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 10,
          marginTop: 4,
          background: saving ? C.surface : '#ef4444',
          color: saving ? C.muted : '#fff',
          border: 'none',
          fontWeight: 800,
          fontSize: 15,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Log Waste 🗑'}
      </button>
    </div>
  )
}

// ── Stockout Log Form ─────────────────────────────────────────────────────────
function StockoutForm({ branches, products, slots, branchLock, onSuccess, userId }) {
  const [form, setForm] = useState({
    branch_id: branchLock?.branch_id || '',
    product_id: '',
    slot_id: '',
    occurred_at: nowLocal(),
    duration_min: '',
    est_lost_qty: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (branchLock?.branch_id) {
      setForm((f) => ({ ...f, branch_id: branchLock.branch_id }))
    }
  }, [branchLock?.branch_id])

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.branch_id) e.branch_id = 'Required'
    if (!form.product_id) e.product_id = 'Required'
    if (!form.occurred_at) e.occurred_at = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        branch_id: form.branch_id,
        product_id: form.product_id,
        slot_id: form.slot_id ? parseInt(form.slot_id) : null,
        occurred_at: new Date(form.occurred_at).toISOString(),
        duration_min: form.duration_min ? parseInt(form.duration_min) : null,
        est_lost_qty: form.est_lost_qty ? parseFloat(form.est_lost_qty) : null,
        notes: form.notes || null,
        logged_by: userId,
      }

      const { error } = await supabase.from('stockout_events').insert(payload)
      if (error) throw error

      setForm((f) => ({
        ...f,
        product_id: '',
        slot_id: '',
        occurred_at: nowLocal(),
        duration_min: '',
        est_lost_qty: '',
        notes: '',
      }))
      onSuccess('Stockout logged ✓')
    } catch (e) {
      onSuccess('Error: ' + (e?.message || 'Failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Field label="Branch" labelAr="الفرع" error={errors.branch_id}>
        <Select
          value={form.branch_id}
          onChange={(v) => set('branch_id', v)}
          error={errors.branch_id}
          disabled={!!branchLock?.branch_id}
          options={branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
          placeholder="Select branch"
        />
      </Field>

      <Field label="Product" labelAr="المنتج" error={errors.product_id}>
        <Select
          value={form.product_id}
          onChange={(v) => set('product_id', v)}
          error={errors.product_id}
          options={products.map((p) => ({ value: p.id, label: p.name_ar ?? p.erp_code }))}
          placeholder="Select product"
        />
      </Field>

      <Field label="Time Slot" labelAr="الفترة الزمنية">
        <Select
          value={form.slot_id}
          onChange={(v) => set('slot_id', v)}
          options={slots.map((s) => ({ value: s.id, label: s.label }))}
          placeholder="Select slot (optional)"
        />
      </Field>

      <Field label="Occurred At" labelAr="وقت النفاد" error={errors.occurred_at}>
        <Input value={form.occurred_at} onChange={(v) => set('occurred_at', v)} type="datetime-local" error={errors.occurred_at} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Duration (min)" labelAr="المدة (دقيقة)">
          <Input value={form.duration_min} onChange={(v) => set('duration_min', v)} type="number" min="1" step="5" placeholder="e.g. 30" />
        </Field>
        <Field label="Est. Lost Units" labelAr="الوحدات المفقودة">
          <Input value={form.est_lost_qty} onChange={(v) => set('est_lost_qty', v)} type="number" min="0" step="1" placeholder="e.g. 5" />
        </Field>
      </div>

      <Field label="Notes (optional)" labelAr="ملاحظات">
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="What happened? Why was it out of stock?"
          style={{ ...inputStyle(false, false), height: 72, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>

      <div
        style={{
          background: C.amberDim,
          border: `1px solid ${C.amberBorder}`,
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 14,
          fontSize: 11,
          color: C.amber,
          lineHeight: 1.6,
        }}
      >
        💡 Log every stockout — including short ones. This data corrects demand estimates in forecasting.
      </div>

      <button
        onClick={submit}
        disabled={saving}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 10,
          background: saving ? C.surface : C.amber,
          color: saving ? C.muted : '#0a0a0a',
          border: 'none',
          fontWeight: 800,
          fontSize: 15,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Log Stockout ⚠️'}
      </button>
    </div>
  )
}

export default function BranchLoggerClient({ initial, profile, user }) {
  const [tab, setTab] = useState('batch')
  const [recentBatches, setRecentBatches] = useState(initial.recentBatches || [])
  const [toast, setToast] = useState(null)

  const branchLock = useMemo(() => {
    if (profile?.role === 'admin') return null
    if (!profile?.branch_id) return { branch_id: null }
    return { branch_id: profile.branch_id }
  }, [profile?.role, profile?.branch_id])

  const todayStartISO = useMemo(() => `${initial.today}T00:00:00+03:00`, [initial.today])

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const refreshRecentBatches = useCallback(async () => {
    try {
      const supabase = createClient()
      const q = supabase
        .from('production_batches')
        .select('id, branch_id, product_id, cooked_at, produced_qty')
        .gte('cooked_at', todayStartISO)
        .order('cooked_at', { ascending: false })
        .limit(50)

      if (branchLock?.branch_id) q.eq('branch_id', branchLock.branch_id)

      const { data, error } = await q
      if (error) throw error
      setRecentBatches(data || [])
    } catch {
      // ignore
    }
  }, [todayStartISO, branchLock?.branch_id])

  useEffect(() => {
    // Keep waste batch dropdown fresh when switching to waste tab
    if (tab === 'waste') {
      refreshRecentBatches()
    }
  }, [tab, refreshRecentBatches])

  // No branch assigned -> show blocking message (branch_user)
  if (profile?.role !== 'admin' && !profile?.branch_id) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.text,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🛑</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>No branch assigned</div>
          <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
            Your account is created but not linked to a branch. Ask the admin to assign your branch in{' '}
            <b>Admin → Users</b>.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        maxWidth: 480,
        margin: '0 auto',
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        color: C.text,
      }}
    >
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea { color: #111827; font-family: inherit; }
        input:focus, select:focus, textarea:focus {
          outline: none; border-color: rgba(217,119,6,0.5) !important;
          box-shadow: 0 0 0 2px rgba(217,119,6,0.08);
        }
        select option { background: #ffffff; color: #111827; }
        @keyframes slideUp { from{opacity:0;transform:translate(-50%,12px)} to{opacity:1;transform:translate(-50%,0)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .fade-in { animation: fadeIn .25s ease; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #c8cdd8; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '20px 20px 0',
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
              Branch Log
            </div>
            <div style={{ fontSize: 10, color: C.muted2, marginTop: 1 }}>
              {new Date().toLocaleDateString('en-SA', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: C.green,
              boxShadow: `0 0 8px ${C.green}`,
            }}
          />
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '10px 4px',
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                borderBottom: `2px solid ${tab === t.id ? C.amber : 'transparent'}`,
                marginBottom: -1,
                transition: 'border-color .15s',
              }}
            >
              <div style={{ fontSize: 16 }}>{t.icon}</div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  marginTop: 2,
                  color: tab === t.id ? C.amber : C.muted2,
                  letterSpacing: '0.04em',
                }}
              >
                {t.labelEn}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 20px 100px' }}>
        <TodaySummary todayStartISO={todayStartISO} branchFilter={branchLock} />

        <div className="fade-in" key={tab}>
          {tab === 'batch' && (
            <BatchForm
              branches={initial.branches}
              products={initial.products}
              slots={initial.slots}
              branchLock={branchLock}
              onSuccess={showToast}
              refreshRecentBatches={refreshRecentBatches}
              userId={user.id}
            />
          )}
          {tab === 'waste' && (
            <WasteForm
              branches={initial.branches}
              products={initial.products}
              recentBatches={recentBatches}
              branchLock={branchLock}
              onSuccess={showToast}
              userId={user.id}
            />
          )}
          {tab === 'stockout' && (
            <StockoutForm
              branches={initial.branches}
              products={initial.products}
              slots={initial.slots}
              branchLock={branchLock}
              onSuccess={showToast}
              userId={user.id}
            />
          )}
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
