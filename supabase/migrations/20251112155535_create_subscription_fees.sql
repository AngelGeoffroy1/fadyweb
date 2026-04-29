create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create table if not exists public.subscription_fees (
  id uuid primary key default gen_random_uuid(),
  subscription_type text not null unique,
  commission_percentage numeric(5,2) not null check (commission_percentage >= 0 and commission_percentage <= 100),
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now())
);

drop trigger if exists set_subscription_fees_updated_at on public.subscription_fees;

create trigger set_subscription_fees_updated_at
  before update on public.subscription_fees
  for each row
  execute function public.set_updated_at();

insert into public.subscription_fees (subscription_type, commission_percentage)
values
  ('standard', 10.0)
  on conflict (subscription_type) do update set commission_percentage = excluded.commission_percentage;

insert into public.subscription_fees (subscription_type, commission_percentage)
values
  ('boost', 5.0)
  on conflict (subscription_type) do update set commission_percentage = excluded.commission_percentage;;
