# Roadmap

All items link to their implementation status. "Completed" items show the PR that shipped them.

## v0.12 — Stability & Security (Current)

### In Progress

| Feature | Description | Status | Issue |
|---------|-------------|--------|-------|
| Provider health monitoring | Circuit breaker + latency tracking per LLM provider | 🚧 | [#523](https://github.com/Worker-Agent/Worker-Agent/issues/523) |
| Rate limiting | Per-org API rate limits with configurable tiers | 🚧 | [#489](https://github.com/Worker-Agent/Worker-Agent/issues/489) |
| OAuth integration | GitHub, Google SSO login providers | 🚧 | [#445](https://github.com/Worker-Agent/Worker-Agent/issues/445) |
| Audit log | Organization-level audit event log | 🚧 | [#412](https://github.com/Worker-Agent/Worker-Agent/issues/412) |

### Proposed

| Feature | Description | Status |
|---------|-------------|--------|
| Multi-region support | Deploy workers in different regions | 🧭 |
| Custom domain support | Per-organization custom domains | 🧭 |

## v0.11 — Provider Ecosystem (Released)

### ✅ Completed

| Feature | Description | PR |
|---------|-------------|-----|
| Drizzle ORM migration | Replaced Prisma with Drizzle ORM | [#387](https://github.com/Worker-Agent/Worker-Agent/pull/387) |
| Provider router | Policy-based LLM routing with fallback | [#392](https://github.com/Worker-Agent/Worker-Agent/pull/392) |
| Model policies | Per-model capability + cost metadata | [#395](https://github.com/Worker-Agent/Worker-Agent/pull/395) |
| Local provider support | Ollama + custom OpenAI-compatible endpoints | [#401](https://github.com/Worker-Agent/Worker-Agent/pull/401) |
| Schema Guard CI | Automated drift detection for database schema | [#415](https://github.com/Worker-Agent/Worker-Agent/pull/415) |
| Production hardening | Nginx config, systemd units, bootstrap scripts | [#420](https://github.com/Worker-Agent/Worker-Agent/pull/420) |
| Security scan workflows | Gitleaks, CodeQL, dependency review | [#425](https://github.com/Worker-Agent/Worker-Agent/pull/425) |
| ADR documentation | Five architecture decision records | [#430](https://github.com/Worker-Agent/Worker-Agent/pull/430) |

## v0.10 — Governance (Released)

### ✅ Completed

| Feature | Description | PR |
|---------|-------------|-----|
| Approval system | Multi-step approval workflow for agents | [#312](https://github.com/Worker-Agent/Worker-Agent/pull/312) |
| Tool gateway | Per-org tool enablement + rate limits | [#318](https://github.com/Worker-Agent/Worker-Agent/pull/318) |
| Governance policies | Blocking rules for providers/models/tools | [#325](https://github.com/Worker-Agent/Worker-Agent/pull/325) |
| Compliance verdicts | Decision logging for all agent actions | [#330](https://github.com/Worker-Agent/Worker-Agent/pull/330) |
| Quota ledger | Usage tracking and billing limits | [#335](https://github.com/Worker-Agent/Worker-Agent/pull/335) |

## v0.9 — Agent Runtime (Released)

### ✅ Completed

| Feature | Description | PR |
|---------|-------------|-----|
| Streaming agent | Real-time event streaming via SSE | [#245](https://github.com/Worker-Agent/Worker-Agent/pull/245) |
| Multi-step agents | Configurable agent workflows | [#252](https://github.com/Worker-Agent/Worker-Agent/pull/252) |
| Research chains | Multi-phase research agents | [#258](https://github.com/Worker-Agent/Worker-Agent/pull/258) |
| Worker registration | Dynamic worker discovery + status | [#265](https://github.com/Worker-Agent/Worker-Agent/pull/265) |

## Timeline

| Quarter | Focus |
|---------|-------|
| Q1 2025 | Agent runtime + streaming |
| Q2 2025 | Governance + policies |
| Q3 2025 | Provider ecosystem + stability |
| Q4 2025 | Scale + multi-region |

## How to Propose a Feature

1. Open a [discussion](https://github.com/Worker-Agent/Worker-Agent/discussions) in **Ideas**
2. If approved, a maintainer will convert it to an issue with a `roadmap` label
3. Items are prioritized quarterly based on community demand