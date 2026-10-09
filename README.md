# Dan Visuals

Static photography website hosted on GitHub Pages. The public booking form and private admin dashboard connect directly to Supabase; there is no server or build step.

## Admin setup

1. Create a Supabase project.
2. In the SQL Editor, replace `YOUR_ADMIN_EMAIL` in `schema.sql` and `migrations/003_blocked_dates.sql` with the admin account email, then run `schema.sql`.
3. Create the admin user in Supabase Authentication with that exact email and a password.
4. Disable new signups in Authentication settings.
5. Paste the project URL and anon/public key into `config.js`. These browser values are public; database access is restricted by the SQL policies.
6. Publish the static files to GitHub Pages, then open `/admin.html` and sign in.

Sessions persist across refreshes using Supabase Auth. The admin page has no sign-up flow and is excluded from search indexing. Keep `admin.html` out of `sitemap.xml`.

## Phase 2 database updates

After the base schema is installed, run the SQL migrations in `migrations/` in numerical order. Each migration adds the corresponding optional admin workflow. Re-run the matching migration if the static site needs a feature added after the database update.
