create or replace function public.public_booking_unavailable_dates()
returns table (event_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select b.event_date
  from public.bookings as b
  where b.status <> 'cancelled'
  union
  select d.blocked_date as event_date
  from public.blocked_dates as d
  order by event_date;
$$;

revoke all on function public.public_booking_unavailable_dates() from public, anon, authenticated;
grant execute on function public.public_booking_unavailable_dates() to anon;

create or replace function public.reject_taken_booking_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(739291, new.event_date - date '2000-01-01');
  if exists (
    select 1 from public.bookings as b
    where b.event_date = new.event_date and b.status <> 'cancelled'
  ) then
    raise exception 'This date is already taken.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_reject_taken_date on public.bookings;
create trigger booking_reject_taken_date
before insert on public.bookings
for each row execute function public.reject_taken_booking_date();

notify pgrst, 'reload schema';
