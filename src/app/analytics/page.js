import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnalyticsClient from './AnalyticsClient'
import { getUserAndProfile, getAllowedBranchId } from '@/lib/auth'
import TopNav from '@/app/_components/TopNav'
import NotificationBell from '@/app/_components/NotificationBell'
import SignOutButton from '@/app/_components/SignOutButton'

export const dynamic = 'force-dynamic'

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function parseMonthRange(periodLabel) {
  const s = String(periodLabel || '').trim()
  if (!s) return { start: null, end: null }
  const m1 = s.match(/^([A-Za-z]{3,9})\s+(\d{4})$/)
  if (m1) {
    const monText = m1[1].toLowerCase()
    const year = Number(m1[2])
    const monMap = { jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12 }
    const mon = monMap[monText] || monMap[monText.slice(0,3)]
    if (mon && year >= 2000 && year <= 2100) {
      const start = `${year}-${String(mon).padStart(2,'0')}-01`
      const endDate = new Date(Date.UTC(year, mon, 0))
      const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth()+1).padStart(2,'0')}-${String(endDate.getUTCDate()).padStart(2,'0')}`
      return { start, end }
    }
  }
  const m2 = s.match(/^(\d{4})-(\d{2})$/)
  if (m2) {
    const year = Number(m2[1]), mon = Number(m2[2])
    if (year >= 2000 && year <= 2100 && mon >= 1 && mon <= 12) {
      const start = `${year}-${String(mon).padStart(2,'0')}-01`
      const endDate = new Date(Date.UTC(year, mon, 0))
      const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth()+1).padStart(2,'0')}-${String(endDate.getUTCDate()).padStart(2,'0')}`
      return { start, end }
    }
  }
  return { start: null, end: null }
}

function uniqKeepOrder(arr) {
  const seen = new Set(), out = []
  for (const x of arr) { const v = String(x||'').trim(); if (!v||seen.has(v)) continue; seen.add(v); out.push(v) }
  return out
}

export default async function AnalyticsPage({ searchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { profile } = await getUserAndProfile()
  if (!['super_admin','admin'].includes(profile?.role)) redirect('/')
  const allowedBranchId = getAllowedBranchId(profile)

  const urlPeriod = (searchParams?.period ?? '').toString().trim() || null
  const urlBranch = (searchParams?.branch ?? '').toString().trim() || null
  const urlClass  = (searchParams?.class  ?? '').toString().trim() || null
  const urlProd   = (searchParams?.product ?? '').toString().trim() || null

  const selectedBranchId  = isUuid(urlBranch) ? urlBranch : (allowedBranchId || null)
  const selectedProductId = isUuid(urlProd) ? urlProd : null
  const selectedClass     = urlClass && ['Star','Workhorse','Challenge','Dog'].includes(urlClass) ? urlClass : null

  let branchesQ = supabase.from('branches').select('id,code,name,is_warehouse,is_active').eq('is_active',true).order('code')
  if (allowedBranchId) branchesQ = branchesQ.eq('id', allowedBranchId)

  const [branchesRes, productsRes] = await Promise.all([
    branchesQ,
    supabase.from('products').select('id,erp_code,name_ar,is_active').eq('is_active',true).order('name_ar').limit(800),
  ])

  const branches = (branchesRes.data||[]).filter(b => !b.is_warehouse)
  const products = productsRes.data || []

  let periodOptions = []
  const { data: impLog, error: impErr } = await supabase.from('import_log').select('period_label,created_at').eq('import_type','sales_summary').not('period_label','is',null).order('created_at',{ascending:false}).limit(50)
  if (!impErr && impLog?.length) {
    periodOptions = uniqKeepOrder(impLog.map(r => r.period_label))
  } else {
    const { data: ss } = await supabase.from('sales_summary').select('period_label').not('period_label','is',null).order('id',{ascending:false}).limit(2000)
    if (ss?.length) periodOptions = uniqKeepOrder(ss.map(r => r.period_label))
  }

  let selectedPeriod = urlPeriod || periodOptions[0] || null
  const { start: periodStart, end: periodEnd } = parseMonthRange(selectedPeriod)
  const startTs = periodStart ? `${periodStart}T00:00:00+03:00` : null
  const endTs   = periodEnd   ? `${periodEnd}T23:59:59+03:00`   : null
  const selectedProduct     = selectedProductId ? products.find(p => p.id === selectedProductId) : null
  const selectedProductName = selectedProduct?.name_ar || null

  let salesQ = supabase.from('sales_summary').select('product_id,product_name_raw,total_sales_sar,total_quantity,total_cost,total_profit,profit_pct,popularity_score,profit_category,popularity_category,class,period_label').order('total_sales_sar',{ascending:false}).limit(5000)
  if (selectedPeriod)  salesQ = salesQ.eq('period_label', selectedPeriod)
  if (selectedClass)   salesQ = salesQ.eq('class', selectedClass)

  let purchasesQ = supabase.from('purchases').select('product_id,item_name_ar,erp_code,purchased_at,invoice_type,supplier,quantity,unit_cost,total_sar,category').order('purchased_at',{ascending:false}).limit(20000)
  if (periodStart && periodEnd) purchasesQ = purchasesQ.gte('purchased_at',periodStart).lte('purchased_at',periodEnd)
  if (selectedProductId) purchasesQ = purchasesQ.eq('product_id', selectedProductId)

  let wasteQ    = supabase.from('waste_events').select('wasted_at,wasted_qty,reason,branch_id,product_id,products(name_ar),branches(code,name)').order('wasted_at',{ascending:false}).limit(8000)
  let batchesQ  = supabase.from('production_batches').select('cooked_at,batch_qty,produced_qty,branch_id,product_id,branches(code,name),products(name_ar)').order('cooked_at',{ascending:false}).limit(8000)
  let stockoutQ = supabase.from('stockout_events').select('occurred_at,branch_id,product_id,branches(code,name)').order('occurred_at',{ascending:false}).limit(8000)

  if (startTs && endTs) {
    wasteQ    = wasteQ.gte('wasted_at',startTs).lte('wasted_at',endTs)
    batchesQ  = batchesQ.gte('cooked_at',startTs).lte('cooked_at',endTs)
    stockoutQ = stockoutQ.gte('occurred_at',startTs).lte('occurred_at',endTs)
  }
  if (selectedBranchId) {
    wasteQ    = wasteQ.eq('branch_id',selectedBranchId)
    batchesQ  = batchesQ.eq('branch_id',selectedBranchId)
    stockoutQ = stockoutQ.eq('branch_id',selectedBranchId)
  }
  if (selectedProductId) {
    wasteQ    = wasteQ.eq('product_id',selectedProductId)
    batchesQ  = batchesQ.eq('product_id',selectedProductId)
    stockoutQ = stockoutQ.eq('product_id',selectedProductId)
  }

  const [salesRes,purchasesRes,wasteRes,batchesRes,stockoutRes] = await Promise.all([salesQ,purchasesQ,wasteQ,batchesQ,stockoutQ])
  if (salesRes.error)     console.error('sales:', salesRes.error.message)
  if (purchasesRes.error) console.error('purchases:', purchasesRes.error.message)
  if (wasteRes.error)     console.error('waste:', wasteRes.error.message)
  if (batchesRes.error)   console.error('batches:', batchesRes.error.message)
  if (stockoutRes.error)  console.error('stockouts:', stockoutRes.error.message)

  const salesRaw=salesRes.data||[], purchases=purchasesRes.data||[], waste=wasteRes.data||[], batches=batchesRes.data||[], stockouts=stockoutRes.data||[]
  const sales = selectedProductId ? salesRaw.filter(r => r.product_id===selectedProductId||(selectedProductName&&r.product_name_raw===selectedProductName)) : salesRaw

  const purchOnly=purchases.filter(p=>p.invoice_type!=='return'), byDate={}, bySupplier={}, byCategory={}
  for (const p of purchOnly) {
    byDate[p.purchased_at||'unknown']=(byDate[p.purchased_at||'unknown']||0)+Number(p.total_sar||0)
    bySupplier[p.supplier||'Unknown']=(bySupplier[p.supplier||'Unknown']||0)+Number(p.total_sar||0)
    byCategory[p.category||'other']=(byCategory[p.category||'other']||0)+Number(p.total_sar||0)
  }

  const totalRevenue=sales.reduce((s,r)=>s+Number(r.total_sales_sar||0),0)
  const totalCogs=sales.reduce((s,r)=>s+Number(r.total_cost||0),0)
  const totalProfit=totalRevenue-totalCogs
  const grossMarginPct=totalRevenue>0?+((totalProfit/totalRevenue)*100).toFixed(1):0
  const totalPurchasesGross=purchOnly.reduce((s,r)=>s+Math.abs(Number(r.total_sar||0)),0)
  const totalReturns=purchases.filter(p=>p.invoice_type==='return').reduce((s,r)=>s+Math.abs(Number(r.total_sar||0)),0)
  const netPurchases=totalPurchasesGross-totalReturns
  const procurementExceedsRevenue=netPurchases>totalRevenue
  const totalWasted=waste.reduce((s,r)=>s+Number(r.wasted_qty||0),0)
  const totalProduced=batches.reduce((s,r)=>s+Number(r.produced_qty||(r.batch_qty*12)||0),0)
  const wastePct=totalProduced>0?+((totalWasted/totalProduced)*100).toFixed(1):0

  return (
    <div style={{ minHeight:'100vh', background:'#f4f6f9' }}>
      <TopNav profile={profile} currentPath="/analytics">
        <NotificationBell />
        <SignOutButton />
      </TopNav>
      <AnalyticsClient initial={{
        sales, purchases, waste, batches, stockouts,
        purchByDate: Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,amount])=>({date,amount:Math.round(amount)})),
        purchBySupplier: Object.entries(bySupplier).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,amount])=>({name,amount:Math.round(amount)})),
        purchByCategory: Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([name,amount])=>({name,amount:Math.round(amount)})),
        summary: {
          totalRevenue:Math.round(totalRevenue), totalQty:Math.round(sales.reduce((s,r)=>s+Number(r.total_quantity||0),0)),
          totalProfit:Math.round(totalProfit), totalPurchases:Math.round(totalPurchasesGross),
          totalReturns:Math.round(totalReturns), netPurchases:Math.round(netPurchases),
          grossMarginPct, procurementExceedsRevenue, totalWasted:Math.round(totalWasted),
          totalProduced:Math.round(totalProduced), wastePct, stockoutCount:stockouts.length,
          suppliersCount:Object.keys(bySupplier).length,
        },
        filters: {
          periodOptions, branchOptions:branches, productOptions:products,
          selected:{ period:selectedPeriod, branch:selectedBranchId, class:selectedClass, product:selectedProductId },
          notes:{ branchAffects:['waste_events','production_batches','stockout_events'], salesIsCompanyWide:true },
          periodStart, periodEnd, selectedProductName,
        },
      }} />
    </div>
  )
}
