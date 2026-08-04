# Phase 2 — Authentication and tenancy

## What landed

- HttpOnly session cookies (`wa_session`) — `x-user-id` is **no longer trusted**
- Organizations, membership, system roles (owner/admin/member/viewer), permissions
- `authenticatedProcedure`, `organizationProcedure`, `permissionProcedure`
- Org-scoped domain queries (scripts, campaigns, pipelines, ledger, agent tasks/events)
- Org-scoped SSE `/events` (requires session)
- Development-only `auth.devLogin` + UI **AuthGate** / **OrgSessionBar**
- Audit log table + `auth.listAuditLog`
- Bootstrap backfills `organizationId` on legacy rows

## SQL

Applied via `drizzle/sql/phase2_auth_tenancy.sql` (drizzle-kit push hit truncate FK errors on this DB).

## Client

1. Open http://localhost:5173
2. Use **Dev login** (labeled development-only)
3. Org selector + Log out appear in the top bar

## APIs

| Procedure | Notes |
|---|---|
| `auth.devLogin` | Dev only; sets cookie |
| `auth.logout` | Revokes session |
| `auth.me` | Current user + org + permissions |
| `auth.switchOrganization` | Must be a member |
| `auth.listMembers` | Requires `org:members` |
| `auth.listAuditLog` | Requires `audit:read` |

## Remaining limits

- No email/password or OAuth yet — only marked development login
- `organizationId` columns are nullable at DB level (enforced in app + backfilled on boot)
- Full e2e tenant-isolation Playwright suite still Phase later
- Some God Machine mutations still use coarse org checks (improved vs user-header, not every edge path audited)
