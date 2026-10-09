alter table public.bookings
  add column if not exists total_price numeric(10,2),
  add column if not exists deposit_amount numeric(10,2) not null default 0 check (deposit_amount >= 0),
  add column if not exists deposit_paid boolean not null default false;

alter table public.bookings
  add column if not exists balance_due numeric(10,2)
  generated always as (greatest(coalesce(total_price, 0) - deposit_amount, 0)) stored;

create or replace function public.set_booking_package_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.total_price := case new.package
    when 'wedding-standard' then 8000
    when 'wedding-premium' then 10000
    when 'debut' then 5000
    when 'birthday' then 4000
    when 'maternity' then 3000
    when 'engagement' then 3000
    else null
  end;
  return new;
end;
$$;

drop trigger if exists booking_package_price on public.bookings;
create trigger booking_package_price
before insert or update of package on public.bookings
for each row execute function public.set_booking_package_price();

update public.bookings set package = package;
