# Vibecode Workspace

This workspace contains a mobile app and backend server.

<projects>
  webapp/    — React app (port 8000, environment variable VITE_BASE_URL)
  backend/   — Hono API server (port 3000)

  In production, the webapp uses relative URLs (/api/...) so it works on any domain.
  VITE_BACKEND_URL is only needed in development for cross-origin requests to the backend on a different port.

  Set `baseURL: env.BACKEND_URL` in betterAuth() config (required for crossSubDomainCookies, harmless otherwise —
  proxy headers override via trustedProxyHeaders: true).
  The webapp auth client (createAuthClient) should use: baseURL: import.meta.env.VITE_BACKEND_URL || undefined
  The webapp API helper should use: import.meta.env.VITE_BACKEND_URL || "" (empty string = relative URLs)
</projects>

<coordination>
  When a feature needs both frontend and backend:
  1. Define Zod schemas for request/response in backend/src/types.ts (shared contracts)
  2. Implement backend route using the schemas
  3. Test backend with cURL (use $BACKEND_URL, never localhost)
  4. Implement frontend, importing schemas from backend/src/types.ts to parse responses
  5. Test the integration

  <shared_types>
    All API contracts live in backend/src/types.ts as Zod schemas.
    Both backend and frontend can import from this file — single source of truth.
  </shared_types>
</coordination>

<brand_copy>
  Full positioning/copy brief: WEBSITE_COPY_BRIEF.md. Pending work tracked in AGENTS.md §8.
  Read the brief before writing or editing any public-facing marketing copy (homepage,
  employer/employee landing pages, footer, registration flow copy).

  Hard rules:
  - Primary line is "Financial wellbeing, built around work." — "From payroll to prosperity" is
    secondary only, never the lead promise.
  - PayBridge works AROUND an employer's existing payroll — never imply it replaces or duplicates
    payroll, or that it's fully automated / integrated with every provider.
  - Employees keep their existing bank — PayBridge never claims to require abandoning it.
  - Never publicly call users "Bridgers" — use Employees / Employers / Funding Partners. The
    in-app transaction label "Bridge ₦X" is fine; the public audience category is not.
  - Never say "No documents" — say "Simple digital onboarding" (KYC/verification still applies).
  - Never call the product account an "intermediate account," "collection account," or "virtual
    salary wallet" — always "PayBridge Account."
  - Never claim a fixed investment return (e.g. "18% p.a."), guaranteed automation, universal
    payroll-provider support, or that employers see nothing — see WEBSITE_COPY_BRIEF.md "Hard
    rules" for the full forbidden-claims list. Hedge with "designed to," "where supported,"
    "subject to eligibility," "through regulated partners."
</brand_copy>

<skills>
  Project skills:
  - frontend-developer: Changes to the webapp frontend (read webapp/CLAUDE.md)
  - backend-developer: Changes to the backend API (read backend/CLAUDE.md)

  Shared skills:
  - database-auth: Set up Prisma + Better Auth for user accounts and data persistence
  - ai-apis-like-chatgpt: Use this skill when the user asks you to make an app that requires an AI API.

  Frontend only skills:
  - frontend-app-design: Create distinctive, production-grade web interfaces using React, Tailwind, and shadcn/ui. Use when building pages, components, or styling any web UI.
</skills>

<environment>
  System manages git and dev servers. DO NOT manage these.
  The user views the app through Vibecode Mobile App with a webview preview or Vibecode Web App with an iframe preview.
  The user cannot see code or terminal. Do everything for them.
  Write one-off scripts to achieve tasks the user asks for.
  Communicate in an easy to understand manner for non-technical users.
  Be concise and don't talk too much.
</environment>
