-- Keep public submissions limited to fields used by booking.js.
-- The earlier table-level grant allowed callers to supply server-managed fields.
revoke insert on public.bookings from anon;
grant insert (
  package,
  name,
  phone,
  email,
  event,
  event_date,
  event_time,
  location,
  payment
) on public.bookings to anon;

-- Reassert strict constraints on every anonymous insert, including past dates.
drop policy if exists "Public can submit new bookings" on public.bookings;
create policy "Public can submit new bookings"
  on public.bookings for insert to anon
  with check (
    status = 'new'
    and notes is null
    and deposit_amount = 0
    and deposit_paid = false
    and delivery_url is null
    and event_date >= current_date
    and nullif(btrim(name), '') is not null
    and nullif(btrim(phone), '') is not null
    and nullif(btrim(email), '') is not null
    and nullif(btrim(event), '') is not null
    and nullif(btrim(location), '') is not null
    and nullif(btrim(payment), '') is not null
  );

-- Pin trigger function name resolution so callers cannot influence it through
-- a changed session search_path.
create or replace function public.reject_blocked_booking_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.blocked_dates as d
    where d.blocked_date = new.event_date
  ) then
    raise exception 'This date is unavailable.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.set_booking_package_price()
returns trigger
language plpgsql
set search_path = ''
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

-- Trigger functions must remain callable by their attached triggers, but should
-- not be directly callable through the public API as ordinary functions.
revoke all on function public.reject_taken_booking_date() from public, anon, authenticated;
revoke all on function public.reject_blocked_booking_date() from public, anon, authenticated;
revoke all on function public.set_booking_package_price() from public, anon, authenticated;

-- Expose only the date-only availability RPC to anonymous visitors.
revoke all on function public.public_booking_unavailable_dates() from public, anon, authenticated;
grant execute on function public.public_booking_unavailable_dates() to anon;

notify pgrst, 'reload schema';
