create table if not exists public.subscription_fees (
    id uuid primary key default gen_random_uuid(),
    subscription_type text not null unique,
    commission_percentage numeric(5,2) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.set_subscription_fees_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgname = 'trg_subscription_fees_updated_at'
    ) then
        create trigger trg_subscription_fees_updated_at
        before update on public.subscription_fees
        for each row
        execute function public.set_subscription_fees_updated_at();
    end if;
end;
$$;

insert into public.subscription_fees (subscription_type, commission_percentage)
values 
    ('standard', 10.00),
    ('boost', 5.00)
on conflict (subscription_type) do update
set commission_percentage = excluded.commission_percentage;
;
