# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Architecture Decision Records (`docs/adr/`) — 5 records documenting key architectural choices:
  - ADR-001: Runtime Architecture (dual-service API + Worker)
  - ADR-002: Authentication (Argon2id + session tokens)
  - ADR-003: Event Streaming (org-scoped SSE)
  - ADR-004: Worker Queue (BullMQ + Redis)
  - ADR-005: Provider Routing (policy-based LLM routing)
- GitHub Discussions configuration (`.github/discussions.yml`) — 8 categories for community
- Examples gallery (`examples/`) — 6 working examples:
  - basic-agent, research-agent, streaming-agent, multi-step-agent, provider-example, production-self-hosted
- Observability documentation — health/readiness/metrics/SSE monitoring guide
- Deployment matrix — environment comparison (Local, Docker, Production)
- Repository audit (`docs/audits/AUDIT.md`) — comprehensive architecture and security audit
- GitHub Discussions category configuration

### Changed

- Documentation README updated with new ADR, Examples, Community, and Self-hosting links
- docs/README.md table of contents expanded with observability, ADRs, deployment matrix

### Security

- Verified: Argon2id password hashing with proper session token hashing
- Verified: Organization isolation enforced at tRPC, SSE, REST, and database layers
- Verified: Dev login procedure disabled when NODE_ENV=production
- Verified: Secret redaction in logs masks sk-, nvapi-, ghp_, Bearer tokens

## [0.12.0] - 2025-01-15

### Added

- 62-table database schema baseline (`deployment/rc1/001_worker_agent_baseline.sql`)
- Schema Guard CI workflow — prevents database schema drift
- Security CI workflow — gitleaks, CodeQL, dependency review, OSSF Scorecard
- Docker CI workflow — multi-stage builds (api, worker, client targets)
- Production self-hosting documentation
- Nginx reverse proxy configuration
- systemd service units for API and Worker processes
- Bootstrap, backup, and restore scripts for production deployment
- 18 tRPC routers covering all major subsystems
- REST API v1 facade at `/api/v1/`
- OpenAPI 3.1 specification (auto-generated from actual routes)
- Health endpoints (`/health` liveness, `/ready` readiness)
- Prometheus metrics endpoint (`/metrics`)
- 10/10 product README with features matrix and architecture diagram

### Security

- Implemented organization isolation tests in `server/tests/auth.tenancy.test.ts`
- 34 permission keys with RBAC role mapping
- Audit logging for all security-relevant actions

## [0.11.0] - 2025-01-10

### Added

- Authentication system with Argon2id hashing
- Organization tenancy model with RBAC
- Deep research streaming via SSE
- Agent task execution pipeline
- Workflow compilation and step execution
- Knowledge base with embeddings
- Governance policies with approval workflows
- Artifact and evidence tracking