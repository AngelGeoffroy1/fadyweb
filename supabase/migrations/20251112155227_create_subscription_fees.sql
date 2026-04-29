create table if not exists public.subscription_fees (
  id uuid primary key default gen_random_uuid(),
  subscription_type text not null unique,
  commission_percentage numeric(5,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_fees (subscription_type, commission_percentage)
values
  ('standard', 10.00),
  ('boost', 5.00)
on conflict (subscription_type) do update set commission_percentage = excluded.commission_percentage,
  updated_at = now();;
