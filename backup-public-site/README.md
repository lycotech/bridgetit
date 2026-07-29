# Restore point — PayBridge public website

Snapshot of the working public website exactly as it was **before** the platform
(dashboards, authentication) was added.

- Source: git commit `27a5da3` — the last state of the live public site.
- Contents: `webapp/src` (all pages, sections, components, styles), `webapp/index.html`,
  `webapp/tailwind.config.ts`.

## To restore any public page or section

Copy the file back over the working copy, e.g.

    cp backup-public-site/webapp/src/components/sections/Navbar.tsx webapp/src/components/sections/Navbar.tsx

## What changed after this snapshot

Public site (additive only — no design, copy or layout changes):

- `components/sections/Navbar.tsx` — added "Login" link and "Get Started" button; added
  "Join PayBridge" and "Login" to the mobile menu. The waitlist CTA is unchanged.
- `components/sections/Footer.tsx` — added a "Sign in" column (employee / employer /
  investor login, Join PayBridge). The operations sign-in is deliberately not listed.
- `components/sections/WhoItServes.tsx` — added a sign-up link to each audience card.
- `components/sections/EmployerStory.tsx` — added "Set up your organisation" next to the
  existing waitlist CTA.

Everything else is new: `pages/auth`, `pages/employee`, `pages/employer`, `pages/investor`,
`pages/operations`, `components/auth`, `components/bridge`, `components/dashboard`,
`components/investor`, `lib/auth`, `lib/platform`, plus the new routes in `App.tsx`.
