# Security

Worker Agent implements defense-in-depth security measures.

## Authentication

- **Argon2id** password hashing
- Session-based auth with opaque tokens
- HttpOnly + Secure + SameSite cookies
- Rate limiting (10 attempts/minute per IP)
- Audit logging for auth events
- Session expiration (24h default)

## Authorization (RBAC)

- Roles: Owner, Admin, Member, Viewer
- Permission-based access control
- Organization-scoped data isolation
- Server-side enforcement (never client-side only)

## Data Protection

- **Secrets**: AES-256 encrypted storage
- **PII**: Minimal data collection, PII-scrubbed logs
- **Secrets rotation**: Audit-trail logged
- **Vault**: HashiCorp/Doppler/Env backend

## Network Security

- CORS: Explicit origin allowlist
- Rate limiting: 300 req/min per IP
- Request ID: End-to-end tracing
- Input validation: Zod schemas on all tRPC procedures

## CI/CD Security

- **Schema Guard**: Prevents database schema drift
- **Gitleaks**: Secret scanning in code
- **Dependency Review**: CVE and license checks
- **CodeQL**: Static analysis for vulnerabilities
- **OSSF Scorecard**: Open source security posture

## Incident Response

See [SECURITY.md](./../../SECURITY.md) for reporting procedures.