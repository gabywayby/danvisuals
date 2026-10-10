-- 017: add-ons, booking codes, paid date, portfolio categories, "Find my photos".
-- Run in the Supabase SQL Editor AFTER 015. Safe to re-run.
-- ADD-ON PRICES BELOW ARE PLACEHOLDERS: edit them here or later in the admin.

-- ---------- Add-ons ----------
create table if not exists public.addons (
  code text primary key,
  label text not null,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  sort int not null default 0
);
alter table public.addons enable row level security;
revoke all on public.addons from anon, authenticated;
grant select (code, label, price, active, sort) on public.addons to anon;
grant select, insert, update, delete on public.addons to authenticated;

drop policy if exists "Public can read active addons" on public.addons;
create policy "Public can read active addons" on public.addons
  for select to anon using (active);
drop policy if exists "Admin manages addons" on public.addons;
create policy "Admin manages addons" on public.addons
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.addons (code, label, price, sort) values
  ('extra-hour',     'Extra hour of coverage',        1000, 1),
  ('second-shooter', 'Second photographer',           2500, 2),
  ('same-day-edit',  'Same-day edit (10-20 photos)',  1000, 3),
  ('printed-album',  'Printed album',                 3500, 4)
on conflict (code) do nothing;

-- ---------- New booking columns ----------
alter table public.bookings
  add column if not exists addons text[] not null default '{}',
  add column if not exists booking_code text,
  add column if not exists paid_at timestamptz;

create unique index if not exists bookings_booking_code_key on public.bookings (booking_code);
alter table public.bookings drop constraint if exists bookings_code_fmt;
alter table public.bookings add constraint bookings_code_fmt
  check (booking_code is null or booking_code ~ '^[A-HJ-NP-Z2-9]{10}$') not valid;

-- Visitors may send add-ons and a booking code (nothing else new).
grant insert (addons, booking_code) on public.bookings to anon;

-- Backfill codes for existing bookings.
create or replace function public.make_booking_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text := ''; i int;
begin
  for i in 1..10 loop code := code || substr(chars, 1 + floor(random() * 32)::int, 1); end loop;
  return code;
end;
$$;
update public.bookings set booking_code = public.make_booking_code() where booking_code is null;
drop function public.make_booking_code();

-- ---------- Total price = package price + chosen add-ons ----------
create or replace function public.set_booking_package_price()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare base numeric; extra numeric; found_count int;
begin
  base := case new.package
    when 'wedding-standard' then 8000
    when 'wedding-premium'  then 10000
    when 'debut'            then 5000
    when 'birthday'         then 4000
    when 'maternity'        then 3000
    when 'engagement'       then 3000
    else null
  end;

  if coalesce(array_length(new.addons, 1), 0) > 10 then
    raise exception 'Too many add-ons.' using errcode = '23514';
  end if;

  select count(*), coalesce(sum(a.price), 0) into found_count, extra
  from public.addons a
  where a.code = any(new.addons) and (a.active or tg_op <> 'INSERT');

  if found_count <> coalesce(array_length(new.addons, 1), 0) then
    raise exception 'Unknown add-on.' using errcode = '23514';
  end if;

  new.total_price := case when base is null then null else base + extra end;
  return new;
end;
$$;
revoke all on function public.set_booking_package_price() from public, anon, authenticated;

drop trigger if exists booking_package_price on public.bookings;
create trigger booking_package_price
before insert or update of package, addons on public.bookings
for each row execute function public.set_booking_package_price();

-- Recalculate existing rows once (no add-ons yet, so totals stay the same).
update public.bookings set addons = addons;

-- ---------- Public insert policy (same rules as 012, plus the add-on cap) ----------
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
    and cardinality(addons) <= 10
    and nullif(btrim(name), '') is not null
    and nullif(btrim(phone), '') is not null
    and nullif(btrim(email), '') is not null
    and nullif(btrim(event), '') is not null
    and nullif(btrim(location), '') is not null
    and nullif(btrim(payment), '') is not null
  );

-- ---------- When it was marked paid ----------
create or replace function public.set_paid_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.deposit_paid and not coalesce(old.deposit_paid, false) then new.paid_at := now();
  elsif not new.deposit_paid then new.paid_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.set_paid_at() from public, anon, authenticated;
drop trigger if exists set_paid_at on public.bookings;
create trigger set_paid_at
before update of deposit_paid on public.bookings
for each row execute function public.set_paid_at();

-- Existing paid bookings: use today as a starting date so revenue totals work.
update public.bookings set paid_at = now() where deposit_paid and paid_at is null;

-- ---------- Portfolio categories ----------
alter table public.weddings add column if not exists category text not null default 'wedding';
alter table public.weddings drop constraint if exists weddings_category_ok;
alter table public.weddings add constraint weddings_category_ok
  check (category in ('wedding','debut','birthday','maternity','engagement','other'));

-- ---------- "Find my photos" (needs booking code AND email) ----------
create or replace function public.find_my_photos(p_code text, p_email text)
returns table (name text, event text, event_date date, delivery_url text)
language sql stable security definer set search_path = ''
as $$
  select b.name, b.event, b.event_date, b.delivery_url
  from public.bookings b
  where b.booking_code = upper(btrim(p_code))
    and lower(b.email) = lower(btrim(p_email))
    and b.delivery_url is not null
    and b.status <> 'cancelled'
  limit 1
$$;
revoke all on function public.find_my_photos(text, text) from public, anon, authenticated;
grant execute on function public.find_my_photos(text, text) to anon;

notify pgrst, 'reload schema';