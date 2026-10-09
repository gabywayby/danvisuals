alter table public.bookings drop column if exists balance_due;

alter table public.bookings
  add column balance_due numeric(10,2)
  generated always as (
    greatest(coalesce(total_price, 0) - case when deposit_paid then deposit_amount else 0 end, 0)
  ) stored;
