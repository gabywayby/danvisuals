grant insert on public.bookings to anon;

drop policy if exists "Public can submit new bookings" on public.bookings;
create policy "Public can submit new bookings"
  on public.bookings for insert to anon
  with check (
    status = 'new'
    and notes is null
    and deposit_amount = 0
    and deposit_paid = false
    and delivery_url is null
  );
