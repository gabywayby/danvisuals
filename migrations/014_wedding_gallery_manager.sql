-- Wedding portfolio metadata and photo records.
create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  couple_names text not null check (length(btrim(couple_names)) > 0),
  event_date date not null,
  location text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.wedding_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  storage_path text not null unique,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create index if not exists wedding_gallery_photos_wedding_position_idx
  on public.wedding_gallery_photos (wedding_id, position, created_at);

alter table public.weddings enable row level security;
alter table public.wedding_gallery_photos enable row level security;
revoke all on public.weddings from anon, authenticated;
revoke all on public.wedding_gallery_photos from anon, authenticated;
grant select on public.weddings to anon;
grant select on public.wedding_gallery_photos to anon;
grant select, insert, update, delete on public.weddings to authenticated;
grant select, insert, update, delete on public.wedding_gallery_photos to authenticated;

drop policy if exists "Public can read published weddings" on public.weddings;
create policy "Public can read published weddings"
  on public.weddings for select to anon
  using (is_published = true);

drop policy if exists "Admin can read all weddings" on public.weddings;
create policy "Admin can read all weddings"
  on public.weddings for select to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can add weddings" on public.weddings;
create policy "Admin can add weddings"
  on public.weddings for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can edit weddings" on public.weddings;
create policy "Admin can edit weddings"
  on public.weddings for update to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can delete weddings" on public.weddings;
create policy "Admin can delete weddings"
  on public.weddings for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Public can read photos in published weddings" on public.wedding_gallery_photos;
create policy "Public can read photos in published weddings"
  on public.wedding_gallery_photos for select to anon
  using (exists (
    select 1 from public.weddings as w
    where w.id = wedding_id and w.is_published = true
  ));

drop policy if exists "Admin can read wedding photos" on public.wedding_gallery_photos;
create policy "Admin can read wedding photos"
  on public.wedding_gallery_photos for select to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can add wedding photos" on public.wedding_gallery_photos;
create policy "Admin can add wedding photos"
  on public.wedding_gallery_photos for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can edit wedding photos" on public.wedding_gallery_photos;
create policy "Admin can edit wedding photos"
  on public.wedding_gallery_photos for update to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

drop policy if exists "Admin can delete wedding photos" on public.wedding_gallery_photos;
create policy "Admin can delete wedding photos"
  on public.wedding_gallery_photos for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-gallery',
  'wedding-gallery',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin can upload wedding gallery images" on storage.objects;
create policy "Admin can upload wedding gallery images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'wedding-gallery'
    and (auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com'
  );

drop policy if exists "Admin can delete wedding gallery images" on storage.objects;
create policy "Admin can delete wedding gallery images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'wedding-gallery'
    and (auth.jwt() ->> 'email') = 'gabrieldandelamin700@gmail.com'
  );

notify pgrst, 'reload schema';
