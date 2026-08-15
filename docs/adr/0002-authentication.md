# ADR-002: Authentication

## Status

Accepted (2025-01-15)

## Context

Worker Agent needed production-grade authentication that:

1. Supports email/password login (enterprise requirement)
2. Integrates with existing session system
3. Does NOT use JWT (per security review)
4. Provides session expiration and revocation

Options considered:

- **JWT tokens**: Rejected — token revocation is difficult, XSS risk with localStorage
- **Opaque session tokens**: Selected — server-side validation, easy revocation
- **OAuth-only**: Rejected — too restrictive for enterprise self-host

## Decision

Implement **opaque session tokens** stored in:

- Database: `sessions` table
- Redis: TTL-indexed for fast lookup
- Client: HttpOnly + Secure + SameSite=Lax cookie

### Password Hashing

- Algorithm: **Argon2id** (via `argon2` package)
- Rationale: OWASP-recommended, resistant to GPU/ASIC attacks

### Rate Limiting

- 10 login attempts per IP per minute
- Exceeding returns HTTP 429
- Counter stored in-memory with time-based reset

### Session Lifecycle

```
Login → Create Session (DB + Cookie) → Validate (cookie) → Revoke (cookie + DB)
                        │                    │                  │
                        │                    │                  │
                   24h TTL            Each request            Delete row
                                     checks Redis
```

### Dev Login

- `auth.devLogin` procedure exists for LOCAL development only
- Disabled when `NODE_ENV=production`
- Returns `developmentOnly: true` flag
- NEVER available in production deployments

## Consequences

- Passwords are never stored in plaintext
- Sessions can be revoked at any time
- CSRF protection via SameSite cookies
- Production deployments cannot accidentally use dev login