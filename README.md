# PayBridge — public website

The marketing site for **PayBridge** — a workforce-finance platform in development.

> You work every day. Why wait until payday? When life cannot wait, **bridge it.**

- **`webapp/`** — React + Vite + TypeScript + Tailwind + Framer Motion. The public site.
- **`backend/`** — Hono (Node.js) API. Persists waitlist submissions with Prisma + Postgres.

The canonical production domain is **https://getpaybridge.com**.

---

## 1. Full source code

- Landing page sections: `webapp/src/components/sections/`
- Brand system (logo, CTA, labels): `webapp/src/components/brand/`
- Waitlist client + validation: `webapp/src/lib/waitlist.ts`
- Analytics + attribution: `webapp/src/lib/analytics.ts`
- Design tokens: `webapp/src/index.css` + `webapp/tailwind.config.ts`
- Waitlist API: `backend/src/routes/waitlist.ts`
- Shared API contract (Zod): `backend/src/types.ts`
- Database schema: `backend/prisma/schema.prisma`

## 2. Production build command

```bash
cd webapp
npm install
npm run build       # outputs the static site to webapp/dist/
```

## 3. Final `dist` folder

`webapp/dist/` is a fully static, production-ready site containing:

```
index.html            sitemap.xml         favicon.svg / favicon-32.png / apple-touch-icon.png
assets/ (js + css)    robots.txt          og-paybridge.png / social-avatar.png / icon-512.png
.htaccess             (SPA routing, HTTPS + non-www redirects, caching, security headers)
```

## 4. Environment variables

See `webapp/.env.example` and `backend/.env.example`.

- **Production (same origin):** leave `VITE_BACKEND_URL` blank — the site calls `/api/...` relatively.
- **Cross-origin API:** set `VITE_BACKEND_URL` to the backend's URL before `npm run build`
  (not needed on Vercel, where `webapp/vercel.json` proxies `/api/...` to the Render backend).

No secret keys are ever exposed to the browser. The webapp only talks to the backend's
`/api/waitlist` endpoint; there are no service-role keys, database passwords or payment/email
secrets in the frontend.

## 5. Database schema

The waitlist is stored via Prisma (`backend/prisma/schema.prisma`):

```prisma
model WaitlistEntry {
  id           String   @id @default(cuid())
  fullName     String
  email        String   @unique          // duplicate submissions are idempotent
  phone        String
  organisation String?
  role         String
  goal         String?
  consent      Boolean  @default(false)
  source       String?
  utmSource    String?  utmMedium String?  utmCampaign String?
  utmTerm      String?  utmContent String? referrer String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([role])
  @@index([createdAt])
}
```

Internal pipeline history lives in a separate, **append-only** table. Nothing in it is ever
updated or deleted — a correction is a new row, so both the mistake and the fix stay visible:

```prisma
model RegistrationEvent {
  id             String   @id @default(cuid())
  registrationId String                        // cascades with the registration
  kind           String                        // registered | resubmitted | field_changed |
                                               // note | contacted | email_sent |
                                               // invitation_issued | invitation_revoked
  field          String?                       // which field moved
  oldValue       String?  newValue String?      // pipeline vocabulary only, never contact details
  message        String?                       // note body, or a system one-liner
  actor          String   @default("system")   // admin username, or "system"
  createdAt      DateTime @default(now())
  @@index([registrationId, createdAt])
}
```

It is written by `backend/src/registration-events.ts`, read only through
`GET /api/admin/registrations/:id`, and deliberately excluded from the CSV export.

Apply it with:

```bash
cd backend
npx prisma generate
npx prisma migrate dev     # dev / preview
# npx prisma migrate deploy   # production
```

## 6. Row Level Security

This deployment uses a server-owned Postgres/Prisma database (Neon) — the browser never connects
to the database directly, so there is no public database surface to protect with RLS. All writes
go through the validated `POST /api/waitlist` endpoint.

**If you migrate the waitlist to Supabase/Postgres instead**, keep the same protection model:

```sql
-- Enable RLS and block anonymous reads; allow only inserts from the anon key.
alter table waitlist_entry enable row level security;

create policy "anon can insert waitlist"
  on waitlist_entry for insert
  to anon
  with check ( true );

-- No select/update/delete policy for anon => the public key can submit but never read.
-- Reads happen server-side with the service-role key only.
```

Then expose only the **anon public key** to the browser and keep the **service-role key** on the
server. Never ship the service-role key, database password, or any email/payment secret to the
frontend.

## 7. `.htaccess`

Ships in `webapp/dist/.htaccess` (source: `webapp/public/.htaccess`). It handles:
HTTPS redirect, `www` → non-`www` canonical redirect, SPA fallback so `/privacy`, `/terms`,
`/contact` resolve, gzip compression, long-lived caching for hashed assets, and security headers.

## 8. cPanel deployment

1. Run `npm run build` in `webapp/`.
2. In cPanel **File Manager**, open `public_html` for `getpaybridge.com`.
3. Upload the **contents** of `webapp/dist/` into `public_html` (include the hidden `.htaccess`).
4. Confirm `.htaccess` is present (enable "Show hidden files" in File Manager settings).
5. Ensure an SSL certificate is active (cPanel → SSL/TLS or AutoSSL) so the HTTPS redirect works.
6. For the waitlist to persist, host the `backend/` API and either:
   - serve it under the same domain at `/api/...` (recommended — keeps relative URLs), or
   - deploy it elsewhere and rebuild the frontend with `VITE_BACKEND_URL` set to that origin.

> Note: the static site itself needs no running Node server. Only the waitlist API does —
> see `backend/render.yaml` for deploying it to Render, and `webapp/vercel.json` if you're
> serving the frontend from Vercel instead of cPanel.

## 9. Post-deployment testing checklist

- [ ] `https://getpaybridge.com` loads; `http://` redirects to `https://`.
- [ ] `https://www.getpaybridge.com` redirects to the non-`www` URL.
- [ ] Hero, all sections and the manifesto render on mobile (375px), tablet and desktop.
- [ ] "Get on the Bridge" (nav, hero, mid-page) all scroll to and focus the waitlist form.
- [ ] Submit the waitlist form → success state "You are on the Bridge."
- [ ] Submitting the same email again still succeeds (idempotent).
- [ ] Invalid input shows inline validation errors; consent is required.
- [ ] `/privacy`, `/terms`, `/contact` load directly (SPA fallback works) and a bad URL shows the 404.
- [ ] `robots.txt`, `sitemap.xml`, `favicon.svg` and `og-paybridge.png` are reachable.
- [ ] Share the URL in a chat/social tool → the OG card shows the PayBridge image + title.
- [ ] Keyboard tab order reaches all controls with visible focus rings.
- [ ] Reduced-motion OS setting disables the animations.
```

## 10. Demonstration access

The pre-launch platform demo lives behind an invitation. There are two ways in — a
personal invitation link, or the shared access code — and both are recorded in
`DemoAccessLog`.

Invitations are issued from **Operations → Demonstration → Demo access**
(`/operations/demo-access`), inside the operations dashboard itself. Two independent
gates protect it:

| Gate | Where | What it stops |
| --- | --- | --- |
| `ops.demo.invite` permission | `webapp/src/lib/platform/roles.ts`, granted to `super_admin` only | An ops/risk/compliance/finance officer widening the guest list |
| PayBridge staff credentials | `AdminSessionGate` in the page + `requireAdmin()` on every `/api/admin/*` route | A demo guest inviting the next guest — the dashboard is *inside* the demo, so a role check alone is not a boundary |

The same invitations can also be issued from a registrant's record in the internal
admin at `/paybridge-admin`; both paths write to `DemoInvitation` and append an
`invitation_issued` event to the registration timeline. The event stores only a token
hint, never the link — the link is a credential.

Every invitation expires, has a maximum number of uses, and can be revoked at any
time from the Issued links tab.
