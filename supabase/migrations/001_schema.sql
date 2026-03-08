-- Branch Ops MVP — Full Schema
-- Run this first in Supabase SQL Editor

create extension if not exists "uuid-ossp";

-- BRANCHES
create table if not exists public.branches (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  name_ar    text,
  city       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- PRODUCTS
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  erp_code         text unique,
  name_ar          text not null unique,
  name_en          text,
  category         text,
  batch_size_kg    numeric,
  yield_per_batch  numeric,
  hot_hold_minutes int default 120,
  shelf_life_days  int,
  reorder_point    numeric,
  safety_stock     numeric,
  is_active        boolean not null default true,
  is_perishable    boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- PROFILES (linked to auth.users)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'branch_user' check (role in ('admin','manager','branch_user')),
  branch_id  uuid references public.branches(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- IMPORT LOG
create table if not exists public.import_log (
  id           uuid primary key default gen_random_uuid(),
  import_type  text not null,
  file_name    text,
  period_label text,
  row_count    int,
  error_count  int default 0,
  status       text default 'running' check (status in ('running','done','error','empty')),
  notes        text,
  imported_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- PURCHASES
create table if not exists public.purchases (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid references public.products(id),
  erp_code       text,
  item_name_ar   text,
  purchased_at   date not null,
  invoice_type   text not null default 'purchase' check (invoice_type in ('purchase','return')),
  invoice_number text,
  invoice_raw    text,
  supplier       text,
  employee       text,
  quantity       numeric not null,
  unit_cost      numeric,
  tax_total      numeric,
  total_sar      numeric,
  category       text,
  import_batch   uuid references public.import_log(id),
  created_at     timestamptz not null default now()
);

create index if not exists purchases_date_idx     on public.purchases(purchased_at);
create index if not exists purchases_product_idx  on public.purchases(product_id);
create index if not exists purchases_supplier_idx on public.purchases(supplier);

-- SALES SUMMARY
create table if not exists public.sales_summary (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid references public.products(id),
  product_name_raw     text not null,
  period_label         text,
  period_start         date,
  period_end           date,
  total_sales_sar      numeric,
  total_quantity       numeric,
  total_cost           numeric,
  item_profit          numeric,
  total_profit         numeric,
  profit_pct           numeric,
  popularity_score     numeric,
  profit_category      text,
  popularity_category  text,
  class                text check (class in ('Star','Workhorse','Challenge','Dog') or class is null),
  import_batch         uuid references public.import_log(id),
  created_at           timestamptz not null default now()
);

create index if not exists sales_summary_product_idx on public.sales_summary(product_id);
create index if not exists sales_summary_period_idx  on public.sales_summary(period_label);
create index if not exists sales_summary_class_idx   on public.sales_summary(class);

-- PRODUCTION BATCHES
create table if not exists public.production_batches (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id),
  product_id   uuid not null references public.products(id),
  cooked_at    timestamptz not null default now(),
  expiry_at    timestamptz,
  batch_qty    numeric not null default 1,
  produced_qty numeric,
  notes        text,
  logged_by    uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists batches_branch_idx  on public.production_batches(branch_id);
create index if not exists batches_product_idx on public.production_batches(product_id);
create index if not exists batches_cooked_idx  on public.production_batches(cooked_at);

-- WASTE EVENTS
create table if not exists public.waste_events (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  batch_id   uuid references public.production_batches(id),
  wasted_at  timestamptz not null default now(),
  wasted_qty numeric not null,
  reason     text not null default 'hot_hold_expired' check (reason in ('hot_hold_expired','overproduction','damaged','other')),
  notes      text,
  logged_by  uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists waste_branch_idx   on public.waste_events(branch_id);
create index if not exists waste_product_idx  on public.waste_events(product_id);
create index if not exists waste_at_idx       on public.waste_events(wasted_at);

-- STOCKOUT EVENTS
create table if not exists public.stockout_events (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches(id),
  product_id       uuid not null references public.products(id),
  occurred_at      timestamptz not null default now(),
  duration_minutes int,
  est_lost_qty     numeric,
  notes            text,
  logged_by        uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

create index if not exists stockout_branch_idx on public.stockout_events(branch_id);
create index if not exists stockout_at_idx     on public.stockout_events(occurred_at);

-- DEMAND FORECASTS
create table if not exists public.demand_forecasts (
  id                  uuid primary key default gen_random_uuid(),
  branch_id           uuid not null references public.branches(id),
  product_id          uuid not null references public.products(id),
  forecast_date       date not null,
  time_slot           text,
  predicted_units     numeric,
  predicted_units_p80 numeric,
  recommended_batches int,
  actual_sold         numeric,
  source              text default 'rolling_avg',
  created_at          timestamptz not null default now()
);

create index if not exists forecasts_date_idx on public.demand_forecasts(forecast_date);

-- ── VIEWS ──────────────────────────────────────────────────────────────────────

create or replace view public.v_daily_waste as
with prod as (
  select branch_id, product_id, date(cooked_at) as d, sum(coalesce(produced_qty,0)) as total_produced
  from public.production_batches group by 1,2,3
),
waste as (
  select branch_id, product_id, date(wasted_at) as d, sum(wasted_qty) as total_wasted
  from public.waste_events group by 1,2,3
),
keys as (
  select branch_id, product_id, d from prod
  union select branch_id, product_id, d from waste
)
select
  b.code as branch_code, b.name as branch_name, p.name_ar as product_name, k.d as waste_date,
  coalesce(w.total_wasted,0) as total_wasted, coalesce(pr.total_produced,0) as total_produced,
  case when coalesce(pr.total_produced,0)>0
       then round(coalesce(w.total_wasted,0)/pr.total_produced*100,1) else null end as waste_pct
from keys k
join public.branches b on b.id=k.branch_id
join public.products  p on p.id=k.product_id
left join prod  pr on pr.branch_id=k.branch_id and pr.product_id=k.product_id and pr.d=k.d
left join waste w  on w.branch_id=k.branch_id  and w.product_id=k.product_id  and w.d=k.d;

create or replace view public.v_menu_engineering as
select
  ss.class as menu_class, ss.period_label,
  count(*) as product_count,
  sum(ss.total_sales_sar) as total_revenue,
  sum(ss.total_quantity) as total_units,
  sum(ss.total_profit) as total_profit,
  avg(ss.profit_pct)*100 as avg_profit_pct
from public.sales_summary ss
group by 1,2;

-- ── RLS ────────────────────────────────────────────────────────────────────────

alter table public.profiles            enable row level security;
alter table public.branches            enable row level security;
alter table public.products            enable row level security;
alter table public.purchases           enable row level security;
alter table public.sales_summary       enable row level security;
alter table public.production_batches  enable row level security;
alter table public.waste_events        enable row level security;
alter table public.stockout_events     enable row level security;
alter table public.demand_forecasts    enable row level security;
alter table public.import_log          enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create or replace function public.my_branch_id()
returns uuid language sql security definer stable as $$
  select branch_id from public.profiles where id=auth.uid();
$$;

-- Profiles
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update"  on public.profiles;
drop policy if exists "admin all profiles"  on public.profiles;
create policy "own profile read"   on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update using (id=auth.uid());
create policy "admin all profiles" on public.profiles for all    using (public.is_admin());

-- Branches & Products: all authenticated can read, only admin can write
drop policy if exists "auth read branches" on public.branches;
drop policy if exists "admin write branches" on public.branches;
create policy "auth read branches"   on public.branches for select using (auth.uid() is not null);
create policy "admin write branches" on public.branches for all    using (public.is_admin());

drop policy if exists "auth read products" on public.products;
drop policy if exists "admin write products" on public.products;
create policy "auth read products"   on public.products for select using (auth.uid() is not null);
create policy "admin write products" on public.products for all    using (public.is_admin());

-- Purchases & Sales: admin full access
drop policy if exists "admin purchases" on public.purchases;
drop policy if exists "admin sales" on public.sales_summary;
drop policy if exists "auth read sales" on public.sales_summary;
create policy "admin purchases" on public.purchases     for all    using (public.is_admin());
create policy "auth read sales" on public.sales_summary for select using (auth.uid() is not null);
create policy "admin sales"     on public.sales_summary for all    using (public.is_admin());

-- Operations: branch-scoped
drop policy if exists "branch read batches"   on public.production_batches;
drop policy if exists "branch insert batches" on public.production_batches;
create policy "branch read batches"   on public.production_batches for select using (public.is_admin() or branch_id=public.my_branch_id());
create policy "branch insert batches" on public.production_batches for insert with check (public.is_admin() or branch_id=public.my_branch_id());

drop policy if exists "branch read waste"   on public.waste_events;
drop policy if exists "branch insert waste" on public.waste_events;
create policy "branch read waste"   on public.waste_events for select using (public.is_admin() or branch_id=public.my_branch_id());
create policy "branch insert waste" on public.waste_events for insert with check (public.is_admin() or branch_id=public.my_branch_id());

drop policy if exists "branch stockouts" on public.stockout_events;
create policy "branch stockouts" on public.stockout_events for all using (public.is_admin() or branch_id=public.my_branch_id());

drop policy if exists "auth read forecasts" on public.demand_forecasts;
drop policy if exists "admin forecasts" on public.demand_forecasts;
create policy "auth read forecasts" on public.demand_forecasts for select using (auth.uid() is not null);
create policy "admin forecasts"     on public.demand_forecasts for all    using (public.is_admin());

drop policy if exists "admin import log" on public.import_log;
create policy "admin import log" on public.import_log for all using (public.is_admin());

-- ── TRIGGERS ───────────────────────────────────────────────────────────────────

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, full_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  return new;
end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;$$;
drop trigger if exists set_products_updated on public.products;
create trigger set_products_updated before update on public.products for each row execute procedure public.set_updated_at();
drop trigger if exists set_profiles_updated on public.profiles;
create trigger set_profiles_updated before update on public.profiles for each row execute procedure public.set_updated_at();

-- expiry_at from hot_hold_minutes
create or replace function public.set_expiry_at()
returns trigger language plpgsql as $$
declare hold_minutes int;
begin
  select coalesce(p.hot_hold_minutes,120) into hold_minutes from public.products p where p.id=new.product_id;
  new.expiry_at := new.cooked_at + make_interval(mins=>hold_minutes);
  return new;
end;$$;
drop trigger if exists trg_batches_expiry on public.production_batches;
create trigger trg_batches_expiry before insert or update of cooked_at,product_id on public.production_batches
  for each row execute procedure public.set_expiry_at();

-- produced_qty auto-fill
create or replace function public.set_produced_qty_default()
returns trigger language plpgsql as $$
declare y numeric; bs numeric;
begin
  if new.produced_qty is null then
    select p.yield_per_batch,p.batch_size_kg into y,bs from public.products p where p.id=new.product_id;
    if y is not null and bs is not null and bs>0 and new.batch_qty is not null then
      new.produced_qty := (new.batch_qty/bs)*y;
    end if;
  end if;
  if new.logged_by is null then new.logged_by:=auth.uid(); end if;
  return new;
end;$$;
drop trigger if exists trg_batches_produced on public.production_batches;
create trigger trg_batches_produced before insert or update of batch_qty,product_id,produced_qty on public.production_batches
  for each row execute procedure public.set_produced_qty_default();

-- logged_by auto-fill
create or replace function public.set_logged_by_default()
returns trigger language plpgsql as $$
begin if new.logged_by is null then new.logged_by:=auth.uid(); end if; return new; end;$$;
drop trigger if exists trg_waste_logged_by on public.waste_events;
create trigger trg_waste_logged_by before insert on public.waste_events for each row execute procedure public.set_logged_by_default();
drop trigger if exists trg_stockout_logged_by on public.stockout_events;
create trigger trg_stockout_logged_by before insert on public.stockout_events for each row execute procedure public.set_logged_by_default();

-- ── GRANTS ─────────────────────────────────────────────────────────────────────
grant usage on schema public to service_role, authenticated;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant select, insert, update on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

-- ── SEED BRANCHES ──────────────────────────────────────────────────────────────
insert into public.branches(code,name,name_ar,city) values
  ('JED-01','Jeddah Branch 1','جدة الفرع 1','Jeddah'),
  ('JED-02','Jeddah Branch 2','جدة الفرع 2','Jeddah'),
  ('JED-03','Jeddah Branch 3','جدة الفرع 3','Jeddah'),
  ('JED-04','Jeddah Branch 4','جدة الفرع 4','Jeddah'),
  ('JED-05','Jeddah Branch 5','جدة الفرع 5','Jeddah')
on conflict(code) do nothing;
