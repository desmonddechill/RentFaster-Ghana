# RentFaster Ghana

Ghana-first long-term rental marketplace for verified homes, landlords, tenants, and admin approval.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/rentfaster run dev` — run the RentFaster web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MAPBOX_ACCESS_TOKEN`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite artifact with Wouter routing and generated React Query API hooks

## Where things live

- `artifacts/rentfaster/src/App.tsx` — marketplace, listing, auth, tenant, landlord, and admin routes
- `artifacts/rentfaster/src/index.css` — RentFaster theme tokens and responsive styling
- `artifacts/api-server/src/routes/rentfaster.ts` — listing, inquiry, dashboard, review, and Paystack initialization routes
- `lib/db/src/schema/rentfaster.ts` — marketplace tables and GHS financial fields
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated hooks

## Architecture decisions

- All financial fields are derived from monthly rent at a fixed 10% service fee: 90% landlord payout, 10% platform.
- New listings always enter `pending`; only approved listings are returned to public listing searches.
- Video URL and at least three photo URLs are required by the create-listing contract.

## Product

Tenants can browse Ghana listings, filter by city/type/budget, open detail pages, message landlords, use WhatsApp, and start a Paystack rent flow. Landlords can submit properties and view portfolio/inquiry/earnings surfaces. Admins can review listing status and marketplace totals.

## User preferences

- Currency is GH₵ only and all marketplace financial summaries must show monthly and yearly GHS totals.
- Ghana launch cities include Accra, Kumasi, Takoradi, Tamale, Cape Coast, and other cities as inventory grows.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- Public listing queries intentionally default to `status=approved`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
