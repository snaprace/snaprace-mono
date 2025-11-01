# Repository Guidelines

## Project Structure & Module Organization
SnapRace runs on the Next.js App Router. Route segments live in `src/app`, shared UI in `src/components`, and styling tokens in `src/styles`. Data access, server actions, and tRPC wiring sit in `src/lib`, `src/server`, and `src/trpc`, while cross-cutting state belongs in `src/contexts` and `src/hooks`. Static files stay in `public`, long-form docs in `docs`, and research briefs in `tasks`.

## Build, Test, and Development Commands
- `pnpm install` keeps dependencies in sync; avoid mixing package managers.
- `pnpm dev` serves the app on `http://localhost:3000` with Turbo refresh.
- `pnpm check` chains ESLint and TypeScript for a fast pre-commit gate.
- `pnpm build` compiles the production bundle used by `pnpm preview`.
- `pnpm lint` / `pnpm lint:fix` apply the Next.js ESLint ruleset.
- `pnpm format:check` / `pnpm format:write` run Prettier with Tailwind sorting.

## Coding Style & Naming Conventions
Code is written in strict TypeScript with 2-space indentation handled by Prettier. React components use PascalCase file and symbol names, utilities stay camelCase, and exported constants from `src/constants` use UPPER_SNAKE_CASE. Import types with `import type` to satisfy the ESLint config, and let `prettier-plugin-tailwindcss` manage class order automatically.

## Testing Guidelines
Automated tests are not yet committed, so `pnpm check` acts as the minimum verification bar. When introducing tests, colocate them next to the feature (`feature.test.tsx`) and add the matching `pnpm test` script in the same pull request. Document manual QA steps for flows under `src/app/events` and `src/app/photo` so reviewers can replay Dynamo-backed scenarios.

## Commit & Pull Request Guidelines
Follow the Conventional Commits pattern already in history (`feat:`, `refactor:`, `docs:`) and keep subjects under 72 characters. Bundle related work together, leaving formatting-only changes in their own commit when possible. Pull requests need a short summary, linked issue, screenshots or clips for UI tweaks, and a checklist of commands executed (`pnpm check`, `pnpm build`, optional manual steps).

## Environment & Configuration
Environment validation lives in `src/env.js` via `@t3-oss/env-nextjs`. Store secrets in `.env.local`, mirror them in the schema before use, and note any new keys in your PR. Required values today include the AWS region, DynamoDB table names, and Auth.js credentials; use `SKIP_ENV_VALIDATION=1` only for containerized builds that inject secrets externally.
