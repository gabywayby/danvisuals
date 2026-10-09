alter table public.bookings drop column if exists balance_due;

alter table public.bookings
  add column balance_due numeric(10,2)
  generated always as (
    case when deposit_paid then 0 else coalesce(total_price, 0) end
  ) stored;
