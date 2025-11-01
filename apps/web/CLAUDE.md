# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication and Language Guidelines

- **Korean Communication**: Always communicate in Korean when discussing with the user
- **English UI Implementation**: All user-facing text, UI elements, and interface content must remain in English
- **Documentation Updates**: After implementing any feature or making changes, update relevant documentation files in `docs/` or create new documentation if needed

## Code Development Guidelines

- **Concise Code**: Write clear, concise code with single responsibility principle
- **Module Separation**: Separate concerns into distinct modules and components
- **Reusability**: Create reusable components and utility functions
- **Common Error Handling**: Use centralized error handling patterns and custom error types

## Project Overview

SnapRace is a Next.js 15 application built with the T3 Stack that provides a race photo discovery platform for athletes. It supports multi-tenant architecture via subdomains, selfie-based photo matching, and integrates with AWS services for data storage and processing.

## Essential Development Commands

```bash
# Development
pnpm install              # Install dependencies (use pnpm, avoid npm/yarn)
pnpm dev                  # Start development server with Turbopack

# Code Quality & Verification
pnpm check                # Run linting + type checking (pre-commit gate)
pnpm lint                 # ESLint check only
pnpm lint:fix             # Auto-fix ESLint issues
pnpm typecheck            # TypeScript checking only
pnpm format:check         # Check Prettier formatting
pnpm format:write         # Apply Prettier formatting with Tailwind sorting

# Build & Production
pnpm build                # Build for production (must pass before deployment)
pnpm start                # Start production server
pnpm preview              # Build and preview production build locally

# Testing
pnpm test                 # Run Vitest tests (limited test coverage currently)
```

## Core Architecture

### Multi-Tenant Organization System
- **Subdomain Routing**: Middleware (`src/middleware.ts`) extracts organization from subdomain and sets `x-organization` header
- **tRPC Context**: All tRPC procedures receive organization context automatically (`src/server/api/trpc.ts:27-74`)
- **Development Testing**: Set `NEXT_PUBLIC_DEV_SUBDOMAIN` in `.env.local` or use `?org=organization` query parameter
- **Data Scoping**: All data queries automatically filter by organization_id through context

### Data Flow Pattern
1. Middleware parses subdomain → sets `x-organization` header
2. tRPC context fetches organization_id from DynamoDB using subdomain-index
3. All tRPC procedures receive `organizationId` in context
4. Components consume data through React Query hooks with automatic organization filtering

### Database Schema (DynamoDB)
- **snaprace-events** - Race events with optional finishline_video_info for YouTube integration
- **snaprace-galleries** - Photo galleries grouped by event
- **snaprace-photos** - Individual photo metadata with bib detection data
- **snaprace-organizations** - Multi-tenant org data with subdomain-index
- **snaprace-feedbacks** - User feedback submissions
- **TimingResults** - Race timing results with gun/net time support

### Technology Stack
- **Frontend**: Next.js 15 App Router, React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui
- **Backend**: tRPC for type-safe APIs, AWS SDK v3, DynamoDB, NextAuth.js (Discord)
- **UI**: Framer Motion animations, @egjs/react-infinitegrid for masonry layouts
- **Development**: Vitest for testing, ESLint + Prettier, pnpm package manager

## Key Development Patterns

### Component Organization
- Server components for initial data loading in `src/app/` routes
- Client components for interactivity (marked with "use client")
- Shared UI components in `src/components/ui/` (shadcn/ui)
- Context providers in `src/contexts/` for global state

### tRPC Router Structure (`src/server/api/routers/`)
- `events` - Event management and finishline video integration
- `galleries` - Photo gallery operations
- `photos` - Individual photo operations with bib detection
- `organizations` - Organization management for multi-tenancy
- `results` - Timing results and race data processing

### Environment Setup
Copy `.env.local.example` to `.env.local` and configure:
- AWS credentials and DynamoDB table names
- Auth.js secret and URL configuration
- Crisp chat widget ID
- Development subdomain via `NEXT_PUBLIC_DEV_SUBDOMAIN`

## Working with Organization Context

When working with tRPC procedures, organization context is available as:
```typescript
// In any tRPC procedure
const { organizationId, subdomain, isMainSite } = ctx;
```

For server-side data fetching outside tRPC:
```typescript
import { createCaller } from "@/server/api/root";
const trpc = createCaller(createContext({ headers: new Headers() }));
```

## Important Implementation Notes

### Subdomain Development
Three methods for testing multi-tenant functionality:
1. Environment variable: `NEXT_PUBLIC_DEV_SUBDOMAIN=millenniumrunning` (recommended)
2. URL query: `?org=organization`
3. Local DNS configuration (see `docs/LOCAL_DEVELOPMENT_SUBDOMAIN.md`)

### Code Quality Standards
- Strict TypeScript with `noUncheckedIndexedAccess`
- Conventional commits (`feat:`, `refactor:`, `fix:`, etc.)
- 2-space indentation with Prettier auto-formatting
- Import types with `import type` for ESLint compliance

### Key Files to Understand
- `src/middleware.ts` - Organization detection and routing
- `src/server/api/trpc.ts` - tRPC context creation with organization scoping
- `src/env.js` - Environment variable validation using @t3-oss/env-nextjs
- `test-data/` - DynamoDB JSON fixtures for local development seeding

### AWS Integration Notes
- All DynamoDB operations use AWS SDK v3 with lib-dynamodb
- Image downloads are proxied through `/api/download-image` for proper headers
- Selfie matching integrates with external Lambda endpoint
- CloudFront domains are configured in `next.config.js` for image optimization

## Deployment Requirements
1. Run `pnpm check` and `pnpm build` successfully
2. Configure all environment variables in production
3. Ensure IAM credentials allow DynamoDB access
4. Set up DNS for subdomain routing
5. Monitor with Google Analytics, Microsoft Clarity, and Crisp chat