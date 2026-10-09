# Dan Visuals

Static photography website hosted on GitHub Pages. The public booking form and private admin dashboard connect directly to Supabase; there is no server or build step.

## Admin setup

1. Create a Supabase project.
2. In the SQL Editor, confirm the admin email in `schema.sql` and `migrations/003_blocked_dates.sql` matches the Authentication account, then run `schema.sql`.
3. Run the SQL files in `migrations/` in this order: `001_booking_notes.sql` → `002_payment_tracking.sql` → `003_blocked_dates.sql` → `007_delivery_links.sql` → `008_balance_due_paid_deposit.sql` → `009_simple_paid_unpaid.sql` → `010_public_booking_insert_privilege.sql` → `011_public_booking_availability.sql`. These migrations are needed by the finished booking and admin pages.
4. Create the admin user in Supabase Authentication with that exact email and a password.
5. Disable new signups in Authentication settings.
6. Paste the project URL and anon/public key into `config.js`. These browser values are public; database access is restricted by the SQL policies.
7. Publish the static files to GitHub Pages, then open `/admin.html` and sign in.

Sessions persist across refreshes using Supabase Auth. The admin page has no sign-up flow and is excluded from search indexing. Keep `admin.html` out of `sitemap.xml`.

## Phase 2 database updates

The numbered migrations add notes, payment tracking, blocked dates, gallery delivery links, the balance calculation, migration 009's simple paid/unpaid payment status, migration 010's public booking insert permission, and migration 011's public date-only availability and duplicate-date check. Run the complete migration set before using the public booking form or admin page.
