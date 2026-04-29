create table if not exists public.subscription_fees (
  id uuid primary key default gen_random_uuid(),
  subscription_type text unique not null,
  commission_percentage numeric(5,2) not null check (commission_percentage >= 0 and commission_percentage <= 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.subscription_fees_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger set_timestamp
before update on public.subscription_fees
for each row
execute function public.subscription_fees_set_updated_at();

insert into public.subscription_fees (subscription_type, commission_percentage)
values
  ('standard', 10.0),
  ('boost', 5.0)
on conflict (subscription_type) do update set
  commission_percentage = excluded.commission_percentage,
  updated_at = timezone('utc', now());;
