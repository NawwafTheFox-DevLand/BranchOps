-- ============================================================
-- Patch: Make production logging more "bullet proof"
-- - expiry_at uses products.hot_hold_minutes (fallback 120)
-- - produced_qty auto-computed from yield_per_batch when omitted
-- - logged_by auto-filled from auth.uid() when omitted
-- - fix v_daily_waste view to avoid double-counting
-- ============================================================

-- 1) expiry_at based on product hot_hold_minutes
create or replace function public.set_expiry_at()
returns trigger language plpgsql as $$
declare
  hold_minutes int;
begin
  select coalesce(p.hot_hold_minutes, 120)
    into hold_minutes
  from public.products p
  where p.id = new.product_id;

  new.expiry_at := new.cooked_at + make_interval(mins => hold_minutes);
  return new;
end;
$$;

-- Recreate trigger to also run when product_id changes
DROP TRIGGER IF EXISTS trg_batches_expiry ON public.production_batches;
create trigger trg_batches_expiry
  before insert or update of cooked_at, product_id on public.production_batches
  for each row execute procedure public.set_expiry_at();


-- 2) produced_qty auto-fill (if null)
create or replace function public.set_produced_qty_default()
returns trigger language plpgsql as $$
declare
  y  numeric;
  bs numeric;
begin
  if new.produced_qty is null then
    select p.yield_per_batch, p.batch_size_kg
      into y, bs
    from public.products p
    where p.id = new.product_id;

    if y is not null and bs is not null and bs > 0 and new.batch_qty is not null then
      new.produced_qty := (new.batch_qty / bs) * y;
    end if;
  end if;

  -- Best-effort logged_by
  if new.logged_by is null then
    new.logged_by := auth.uid();
  end if;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_batches_produced_qty ON public.production_batches;
create trigger trg_batches_produced_qty
  before insert or update of batch_qty, product_id, produced_qty on public.production_batches
  for each row execute procedure public.set_produced_qty_default();


-- 3) Best-effort logged_by for other operational tables
create or replace function public.set_logged_by_default()
returns trigger language plpgsql as $$
begin
  if new.logged_by is null then
    new.logged_by := auth.uid();
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_waste_logged_by ON public.waste_events;
create trigger trg_waste_logged_by
  before insert on public.waste_events
  for each row execute procedure public.set_logged_by_default();

DROP TRIGGER IF EXISTS trg_stockout_logged_by ON public.stockout_events;
create trigger trg_stockout_logged_by
  before insert on public.stockout_events
  for each row execute procedure public.set_logged_by_default();


-- 4) Fix view: v_daily_waste (avoid double-counting produced_qty)
-- Old view joined waste_events to production_batches directly -> duplicates if multiple waste rows.
create or replace view public.v_daily_waste as
with prod as (
  select
    branch_id,
    product_id,
    date(cooked_at) as d,
    sum(coalesce(produced_qty,0)) as total_produced
  from public.production_batches
  group by 1,2,3
),
waste as (
  select
    branch_id,
    product_id,
    date(wasted_at) as d,
    sum(wasted_qty) as total_wasted
  from public.waste_events
  group by 1,2,3
),
keys as (
  select branch_id, product_id, d from prod
  union
  select branch_id, product_id, d from waste
)
select
  b.code as branch_code,
  b.name as branch_name,
  p.name_ar as product_name,
  k.d as waste_date,
  coalesce(w.total_wasted,0) as total_wasted,
  coalesce(pr.total_produced,0) as total_produced,
  case when coalesce(pr.total_produced,0) > 0
       then round(coalesce(w.total_wasted,0)/pr.total_produced*100,1)
       else null end as waste_pct
from keys k
join public.branches b on b.id=k.branch_id
join public.products p on p.id=k.product_id
left join prod pr on pr.branch_id=k.branch_id and pr.product_id=k.product_id and pr.d=k.d
left join waste w on w.branch_id=k.branch_id and w.product_id=k.product_id and w.d=k.d;
