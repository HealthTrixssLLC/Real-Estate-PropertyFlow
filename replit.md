# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Application: TourFlow — Real Estate Tour Manager

### Features Implemented

1. **Full-stack web app** — React+Vite at `/` with Google Maps integration, tour planning, dashboard
2. **Express API backend** with PostgreSQL (Drizzle ORM) — all CRUD routes implemented
3. **Object Storage** (Replit GCS-backed) — voice note file uploads via presigned URLs
4. **AI Provider Abstraction** — Azure OpenAI (text/summarization), Azure Speech (transcription), OpenAI fallback
5. **Expo Mobile App** — iOS-first field execution app at `/mobile` with Today/Tours/Notes/Settings tabs, Active Tour flow, Stop Detail with voice recording, Skip Stop (form sheet), Tour Summary with AI generation + Action Items section (follow-ups / revisits)
6. **Offline Voice Queue** — `utils/voiceUploadQueue.ts` enqueues recordings when offline (AsyncStorage) and flushes automatically on reconnect using `@react-native-community/netinfo`
7. **In-App Documentation** — Web `/help` page with sticky left TOC, Getting Started 8-step guide, full feature reference (Dashboard, Tours, Route Optimization, Showings, Readiness, Voice Notes, AI Summary). Contextual `?` HelpPopovers on Route Optimization map and Readiness Checklist. Mobile Help & Guide screen in Settings with expandable sections. First-launch 4-card onboarding overlay (stored in AsyncStorage). Contextual HelpTip buttons in ActionTray and VoiceRecorder components.
8. **Local Auth (username/password)** — Replaced Replit OIDC with bcrypt-based local credentials. Admin seeded at startup (`admin`/`Admin123!`). Admin-only user management UI at `/admin/users`. Agent/assistant roles cannot access admin routes (403). Admin account is excluded from user listings (`is_system_account=true`). Mobile app has dedicated login screen (`/login` route in Expo).

### Authentication

- **Auth system**: Local username/password (bcrypt). No OIDC/Replit SSO.
- **Endpoints**: `POST /api/login` (web), `POST /api/logout`, `POST /api/mobile-auth/login` (mobile), `POST /api/mobile-auth/logout`
- **Admin seed**: On startup, upserts `admin` user with role `admin` and `is_system_account=true`
- **Roles**: `agent` | `assistant` | `admin`. Only `admin` can access `/api/admin/**`
- **User management**: `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id`
- **Users table**: Added `username VARCHAR UNIQUE`, `password_hash VARCHAR`, `is_system_account BOOLEAN`, `is_active BOOLEAN` columns

### API Endpoints (all under `/api`)

- **Buyers**: GET/POST/GET/:id/PUT/DELETE
- **Properties**: GET/POST/GET/:id/PUT/DELETE
- **Tours**: GET/POST/GET/:id/PUT/DELETE + `/optimize` (Google Maps Distance Matrix) + `/skip-stop` + `/publish` + `/readiness` + `/generate-summary`
- **Tour Stops**: GET/:stopId/PUT/DELETE + `/arrive` + `/complete` + `/note` + `/summarize`
- **Showing Requests**: GET/POST/PUT per stop
- **Restriction Notes**: GET/PUT per stop
- **Voice Notes**: POST upload (multipart → GCS) + POST transcribe + GET
- **Storage**: POST presigned-url + GET public-objects/* + GET objects/*
- **Admin AI**: GET/POST config + POST config/test + GET health

### AI Provider Config

Stored in-memory singleton (`src/lib/aiConfig.ts`) — initialized from env vars, updated via `POST /api/admin/ai/config`. Supports:
- `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL` + `AZURE_OPENAI_MODEL`
- `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`
- `OPENAI_API_KEY` (fallback for both text and transcription)

### Route Optimization

`POST /api/tours/:tourId/optimize` uses Google Maps Distance Matrix API (`GOOGLE_MAPS_API_KEY`) + nearest-neighbor greedy algorithm to reorder stops.

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
