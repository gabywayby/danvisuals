-- Admin access is restricted to this Supabase Authentication email.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  package text not null,
  name text not null,
  phone text not null,
  email text not null,
  event text not null,
  event_date date not null,
  event_time time not null,
  location text not null,
  payment text not null,
  status text not null default 'new'
    check (status in ('new', 'confirmed', 'completed', 'cancelled'))
);

alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
grant insert (package, name, phone, email, event, event_date, event_time, location, payment)
  on public.bookings to anon;
grant select, update, delete on public.bookings to authenticated;

drop policy if exists "Public can submit new bookings" on public.bookings;
create policy "Public can submit new bookings"
  on public.bookings for insert to anon
  with check (status = 'new');

drop policy if exists "Admin can read bookings" on public.bookings;
create policy "Admin can read bookings"
  on public.bookings for select to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can update bookings" on public.bookings;
create policy "Admin can update bookings"
  on public.bookings for update to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can delete bookings" on public.bookings;
create policy "Admin can delete bookings"
  on public.bookings for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');
