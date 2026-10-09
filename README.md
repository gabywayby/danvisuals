# Dan Visuals

Static photography website hosted on GitHub Pages. The public booking form and private admin dashboard connect directly to Supabase; there is no server or build step.

## Admin setup

1. Create a Supabase project.
2. In the SQL Editor, replace `YOUR_ADMIN_EMAIL` in `schema.sql` and `migrations/003_blocked_dates.sql` with the admin account email, then run `schema.sql`.
3. Run every SQL file in `migrations/` in numerical order. These migrations are needed by the finished booking and admin pages.
4. Create the admin user in Supabase Authentication with that exact email and a password.
5. Disable new signups in Authentication settings.
6. Paste the project URL and anon/public key into `config.js`. These browser values are public; database access is restricted by the SQL policies.
7. Publish the static files to GitHub Pages, then open `/admin.html` and sign in.

Sessions persist across refreshes using Supabase Auth. The admin page has no sign-up flow and is excluded from search indexing. Keep `admin.html` out of `sitemap.xml`.

## Phase 2 database updates

The numbered migrations add notes, payment tracking, blocked dates, gallery delivery links, and the final balance calculation. Run the complete migration set before using the public booking form or admin page.
