-- Public calendar output includes only dates and a coarse availability state;
-- client names, contact details, notes, and payment data remain private.
drop function if exists public.public_booking_unavailable_dates();

create function public.public_booking_unavailable_dates()
returns table (event_date date, availability_status text)
language sql
stable
security definer
set search_path = ''
as $$
  with date_states as (
    select
      b.event_date,
      case
        when bool_or(b.status in ('confirmed', 'completed')) then 'fully_booked'
        else 'pending'
      end as availability_status
    from public.bookings as b
    where b.status <> 'cancelled'
    group by b.event_date

    union all

    select d.blocked_date as event_date, 'fully_booked' as availability_status
    from public.blocked_dates as d
  )
  select
    date_states.event_date,
    case
      when bool_or(date_states.availability_status = 'fully_booked') then 'fully_booked'
      else 'pending'
    end as availability_status
  from date_states
  group by date_states.event_date
  order by date_states.event_date;
$$;

revoke all on function public.public_booking_unavailable_dates() from public, anon, authenticated;
grant execute on function public.public_booking_unavailable_dates() to anon;

notify pgrst, 'reload schema';
