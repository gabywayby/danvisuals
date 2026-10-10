# Dan Visuals

Static photography website hosted on GitHub Pages. The public booking form and private admin dashboard connect directly to Supabase; there is no server or build step.

## Admin setup

1. Create a Supabase project.
2. In the SQL Editor, confirm the admin email in `schema.sql` and `migrations/003_blocked_dates.sql` matches the Authentication account, then run `schema.sql`.
3. Run migrations `001`, `002`, `003`, `007`, `008`, `009`, `010`, `011`, `012`, `013`, and `014` in that order. Then run migration `015` (its SQL file is not in this checkout; restore the supplied migration SQL if it has not already been applied). Migration `015` comes before `017`.
4. Create the admin user in Supabase Authentication with that exact email and a strong, unique password (12+ characters). Turn email confirmation on and disable new signups.
5. Sign in to `/admin.html` and enroll an authenticator app (such as Google Authenticator, Microsoft Authenticator, or 1Password). Sign out, sign in again using its current six-digit code, and confirm the admin dashboard loads. Only then run migration `016` in the SQL Editor; it requires the MFA-protected session for admin database access.
6. Confirm `config.js` has the project URL and publishable/anon key. Edit `window.CONTACT.messenger` and `window.CONTACT.viberNumber` in that file to your real Messenger page URL and Viber number in international digits (for example, `639...`). These browser config values are public; never put a service-role key in the site.
7. Publish the static files to GitHub Pages, then open `/admin.html` and sign in.

Sessions persist across refreshes using Supabase Auth. The admin page has no sign-up flow and is excluded from search indexing. Keep `admin.html` out of `sitemap.xml`.

## Phase 2 database updates

The numbered migrations add notes, payment tracking, blocked dates, gallery delivery links, the balance calculation, migration 009's simple paid/unpaid payment status, migration 010's public booking insert permission, migration 011's public date-only availability and duplicate-date check, migration 012's column-limited public inserts and database-side validation, migration 013's public pending/fully-booked calendar status, migration 014's secure wedding gallery tables and public image bucket, migration 015's booking security controls, migration 016's MFA requirement, and migration 017's add-ons, booking codes, categories, and photo lookup. The 015 and 016 SQL files are not in this checkout and must be restored from the supplied SQL if not already applied. Do not re-run 017 if it is already applied. Run available migration files in numerical order, with the MFA enrollment gate before 016; 017 follows 015 (and should be applied after the admin schema/policies it depends on).

## Find my photos and booking notifications

The public `photos.html` lookup uses the `find_my_photos` RPC from migration 017 and asks for the booking code plus the booking email. It reveals only delivered galleries.

The booking notification Edge Function source and `scripts/compress-images.sh` are referenced in the project brief but are not present in this checkout. Once the function source is restored at `supabase/functions/notify-booking/`, deploy it with the Supabase CLI (`supabase login`, then `supabase functions deploy notify-booking --project-ref rmaswjkqiorjswhzjcte`) and set any secrets required by that function using `supabase secrets set ...`. Do not run those deploy commands until the source folder and its required secret names are available. The booking page currently records inquiries in the database; verify the function is deployed and configured if email notifications are expected.

## Content to personalize

- Replace each `[FILL IN]` in the FAQ with the studio's actual answer: clothing advice, backup photographer availability, travel fees, deposit/payment instructions, and rescheduling terms.
- Replace both review attribution placeholders with each reviewer's approved first name and event type.
- Review add-on prices in Admin → Settings; the initial SQL seed prices are placeholders. Confirm the price and label for every add-on before taking inquiries.
- Set the Messenger page and Viber number in `config.js` before using the booking success contact buttons.
- Replace `images/og-cover.jpg` with a final 1200 × 630 brand image when one is ready.

## Security notes

- The Supabase publishable key in `config.js` is intended to be visible in browser code. Never put a privileged server-only key in this static site.
- Keep Row Level Security enabled and review grants and policies before adding tables or RPC functions. Migration 012 narrows anonymous inserts to the public form fields, rejects past dates and blank required values, and limits function execution privileges.
- Enable multi-factor authentication for the admin account in Supabase Authentication settings, use a unique password, and keep new user signups disabled.
- GitHub Pages cannot keep credentials or enforce custom response headers. If you later add payments, file uploads, CAPTCHA, or other sensitive server-side operations, put those behind a trusted backend or edge function.
- Migration 014 creates a public `wedding-gallery` image bucket so published portfolio photos can load without signing in. Upload only images approved for public display; keep client proofs and private files elsewhere.
- Migration 015 adds the centralized admin check and public booking abuse controls. Migration 016 upgrades admin policies to require MFA (`aal2`), so enroll and test the authenticator before running it or the admin will be locked out.
