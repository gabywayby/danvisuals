alter table public.bookings
  add column if not exists delivery_url text
  check (delivery_url is null or delivery_url ~ '^https://drive[.]google[.]com/');
