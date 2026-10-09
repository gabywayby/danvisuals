create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null unique
);

alter table public.blocked_dates enable row level security;
revoke all on public.blocked_dates from anon, authenticated;
grant select (blocked_date) on public.blocked_dates to anon;
grant select, insert, delete on public.blocked_dates to authenticated;

drop policy if exists "Public can read blocked dates" on public.blocked_dates;
create policy "Public can read blocked dates"
  on public.blocked_dates for select to anon
  using (true);

drop policy if exists "Admin can read blocked dates" on public.blocked_dates;
create policy "Admin can read blocked dates"
  on public.blocked_dates for select to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can add blocked dates" on public.blocked_dates;
create policy "Admin can add blocked dates"
  on public.blocked_dates for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can remove blocked dates" on public.blocked_dates;
create policy "Admin can remove blocked dates"
  on public.blocked_dates for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

create or replace function public.reject_blocked_booking_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.blocked_dates where blocked_date = new.event_date) then
    raise exception 'This date is unavailable.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_blocked_booking_date on public.bookings;
create trigger reject_blocked_booking_date
before insert on public.bookings
for each row execute function public.reject_blocked_booking_date();
