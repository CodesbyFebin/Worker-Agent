# Development Guide

This guide covers how to contribute to Worker Agent.Cloud.

## Prerequisites

- Node.js 20+
- npm 10+
- MySQL 8+ or MariaDB 10.6+
- Redis 6+
- Docker (optional, for local infrastructure)

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Infrastructure

```bash
npm run local:infra
```

### 4. Start Development Servers

```bash
npm run dev
```

This runs all three components:
- **Client**: http://localhost:5173 (Vue + Tailwind)
- **API**: http://localhost:4000 (Express + tRPC)
- **Workers**: BullMQ workers (in API process during dev)

## Project Structure

### Client (`client/src/`)

- `components/` — Reusable React components
- `features/` — Feature-specific workspaces
- `hooks/` — Custom React hooks
- `lib/` — Utility libraries

### Server (`server/`)

- `_core/` — Core infrastructure (DB, tRPC, auth, queue, events)
- `agents/` — Agent role implementations
- `routers/` — tRPC routers and REST endpoints
- `services/` — External service integrations

### Database (`drizzle/`)

- `schema.ts` — Table definitions
- `relations.ts` — Drizzle ORM relations
- `sql/` — Migration files (future)

## Development Scripts

```bash
npm run typecheck    # Check TypeScript
npm run lint         # Run ESLint
npm run test         # Run Vitest
npm run build        # Build production bundles
npm run validate     # Run all checks (tc → lint → test → build)
```

## Code Style

- TypeScript strict mode enabled
- ESLint with Prettier
- Zod for runtime validation
- Drizzle ORM for database queries

## Adding New Features

### 1. Database Changes

Add to `drizzle/schema.ts`:

```typescript
export const myNewTable = mysqlTable("my_new_table", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 36 }),
  data: text("data"),
});
```

### 2. tRPC Router

Create `server/routers/myFeature.router.ts`:

```typescript
import { router, protectedProcedure } from "../_core/trpc";

export const myFeatureRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(myNewTable);
  }),
});
```

### 3. Register Router

Add to `server/routers/_app.ts`:

```typescript
import { myFeatureRouter } from "./myFeature Router";

export const appRouter = router({
  // ...
  myFeature: myFeatureRouter,
});
```

## Testing

### Unit Tests

```typescript
// server/tests/myFeature.test.ts
import { test, expect } from "vitest";

test("myFeature does something", async () => {
  const result = await myFeatureFunction();
  expect(result).toEqual({ success: true });
});
```

### Integration Tests

```bash
npm run test -- --run
```

## CI/CD

CI runs on every push to `main`:

1. Install dependencies
2. Typecheck
3. Lint
4. Test
5. Build

GitHub Actions workflow: `.github/workflows/ci.yml`

## Database Migrations

For production:

```bash
# Generate migration
npx drizzle-kit generate

# Apply migration
npm run db:push
```

