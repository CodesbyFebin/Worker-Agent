# Security Documentation

Worker Agent implements defense-in-depth security measures.

## Overview

| Control | Implementation |
|---------|---------------|
| Password Hashing | Argon2id (`server/_core/auth/credentials.ts`) |
| Session Management | Opaque tokens, SHA-256 hashed, httpOnly cookies |
| Authorization | RBAC with 34 permission keys |
| Organization Isolation | Enforced at tRPC, SSE, REST, and database layers |
| Rate Limiting | 10 login attempts/min per IP + API rate limits |
| Audit Logging | All security events in `audit_logs` table |
| Secret Scanning | Gitleaks in CI + secret redaction in logs |

## Security Documentation Map

- [Supply Chain Security](./security/supply-chain.md)
- [Threat Model & Security Architecture](../architecture/security.md)
- [Canonical Documentation Strategy](../architecture/canonical-docs.md)

## Security Policy

See [SECURITY.md](./../../SECURITY.md) for the coordinated disclosure policy.

## Authentication Models

| Model | When |
|-------|------|
| Email + Password | Production |
| Dev Login | Development only (disabled in production) |
| Session Cookies | All sessions |

## Organization Isolation

Every tRPC procedure, REST endpoint, and SSE stream is scoped to the
authenticated user's active organization. See the [threat model](../architecture/security.md) for details.

## Reporting Vulnerabilities

Report security issues via [GitHub Security Advisories](https://github.com/CodesbyFebin/Worker-Agent/security/advisories)
or email security@workeragent.cloud.

See [SECURITY.md](./../../SECURITY.md) for the full policy.