# SnapRace

SnapRace helps race organizers deliver a branded photo discovery experience where athletes can quickly search, filter, and download their event shots. The app supports white-labeled subdomains, selfie-based matching, and direct integration with AWS data pipelines.

## Core Features

- **Bib & event search** – App Router pages let visitors pick an event, enter a bib number, or browse every photo in a responsive masonry layout.
- **Selfie matching** – Participants can upload a selfie; an AWS Lambda endpoint enriches results with additional matches after collecting facial-recognition consent.
- **Multi-tenant branding** – Middleware detects subdomains, loads organization colors, logos, and partner assets, and scopes tRPC queries by organization.
- **Photo actions** – Bulk selection, download routing through Next.js, and share dialogs make it easy to save or publish images.
- **Feedback & analytics** – Microsoft Clarity tagging, Google Analytics, and a Crisp chat widget capture insights and support.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19 and Turbopack dev server.
- **Data & APIs**: tRPC + AWS SDK v3 hitting DynamoDB tables (`events`, `galleries`, `photos`, `organizations`, `feedbacks`).
- **Media UX**: `@egjs/react-infinitegrid`, Tailwind CSS v4, shadcn/ui primitives, and lucide-react icons.
- **Auth & telemetry**: NextAuth (Discord provider configured), Microsoft Clarity, Google Analytics, and Crisp chat.

## Directory Layout

- `src/app` – App Router routes, API handlers (`api/download-image`), and layout providers.
- `src/components` – Reusable UI, analytics hooks, gallery widgets, and modals.
- `src/contexts`, `src/hooks` – Client state management (organization, photo selection, selfie upload, analytics tracking).
- `src/server` – tRPC routers, NextAuth configuration, and server-only utilities.
- `src/lib` – DynamoDB client, organization helpers, analytics utilities, consent storage.
- `docs/` – Deep-dive guides (e.g., `LOCAL_DEVELOPMENT_SUBDOMAIN.md`).
- `test-data/` – DynamoDB JSON fixtures for local seeding.

## Getting Started

1. Install dependencies with `pnpm install` (Corepack recommended).
2. Copy environment defaults: `cp .env.local.example .env.local`.
3. Populate the variables below, then run `pnpm dev`.

## Local Development

- Start the dev server: `pnpm dev`.
- Run linting + type checks: `pnpm check` (wraps `next lint` and `tsc --noEmit`).
- Auto-fix issues: `pnpm lint:fix`, format with `pnpm format:write`.
- Preview a production build locally: `pnpm preview` (runs `next build` then `next start`).

### Testing Branded Subdomains

The middleware emits an `x-organization` header so all tRPC calls and theming respect the selected tenant. During development you can:

- Set `NEXT_PUBLIC_DEV_SUBDOMAIN` in `.env.local` (recommended).
- Append `?org=millenniumrunning` to URLs.
- Configure host aliases as described in `docs/LOCAL_DEVELOPMENT_SUBDOMAIN.md` for the most realistic setup.

## Data & External Services

- DynamoDB is the system of record. Make sure the tables referenced above exist and match the expected primary keys/indexes.
- Seed sample data using the fixtures, for example:
  ```bash
  aws dynamodb put-item \
    --table-name snaprace-organizations \
    --item file://test-data/millennium-organization.json
  ```
- Selfie matching calls a deployed Lambda (`useSelfieUpload`); ensure the endpoint remains accessible or update the hook before launch.
- The download route proxies CloudFront images so browsers receive proper headers for `Save As` flows.

## Deployment Notes

1. Run `pnpm build` and confirm it succeeds without type or lint errors.
2. Provision environment variables (including analytics IDs and Crisp) in your hosting platform.
3. Ensure IAM credentials allow read/write to DynamoDB tables in the target account.
4. Configure DNS/subdomain routing so requests arrive with the correct hostname for middleware parsing.
5. Monitor production with Clarity dashboards, Google Analytics, and Crisp conversations.

## Additional Resources

- `PROJECT_SPEC.md` – High-level product goals and constraints.
- `AGENTS.md` – Contributor guidelines, coding standards, and PR expectations.
- `tasks/` – Implementation briefs and context for in-flight work.
- `docs/LOCAL_DEVELOPMENT_SUBDOMAIN.md` – Detailed instructions for subdomain testing, DynamoDB structure, and troubleshooting.
