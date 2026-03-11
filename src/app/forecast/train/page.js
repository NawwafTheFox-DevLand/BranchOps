import { requireAdmin } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import TrainingClient from './TrainingClient'

export default async function TrainingPage() {
  await requireAdmin()
  const service = createServiceRoleClient()

  const [productsRes, runsRes, accuracyRes, batchCountRes, modelsRes] = await Promise.all([
    service.from('products').select('id, erp_code, name_ar, yield_per_batch, batch_size_kg').eq('is_batch_cooked', true).eq('is_active', true).order('name_ar'),
    service.from('forecast_runs').select('*').order('created_at', { ascending: false }).limit(30),
    service.from('v_forecast_accuracy').select('*').not('actual_sold', 'is', null).order('forecast_date', { ascending: false }).limit(500),
    service.from('production_batches').select('id', { count: 'exact', head: true }).gte('cooked_at', new Date(Date.now() - 30*24*3600*1000).toISOString()),
    service.from('forecast_models').select('id, model_type, mape, mae, rmse, aic, model_params, training_start, training_end, trained_at, products(id, name_ar), branches(id, code)').eq('is_active', true).order('mape', { ascending: true }).limit(200),
  ])

  return (
    <TrainingClient
      products={productsRes.data || []}
      recentRuns={runsRes.data || []}
      accuracyRows={accuracyRes.data || []}
      batchCount={batchCountRes.count || 0}
      trainedModels={modelsRes.data || []}
    />
  )
}
