# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-15

### Added
- Production-ready MCP client for connecting external Model Context Protocol servers
- 12-agent system: planner, researcher, writer, reviewer, coder, qa, publisher, video_generator, video_editor, voiceover, caption_hashtag, seo
- Workflow Engine with durable task execution and retry logic
- God Machine orchestration engine with event-driven architecture
- Multi-platform publishing: YouTube, TikTok, Instagram, Facebook, X/Twitter, LinkedIn, Blogger
- BullMQ job queues with Redis persistence
- SSE events stream for real-time updates
- Dead-letter queue for failed jobs
- Tool Gateway with builtin and MCP tool support
- Health check endpoints (`/health`, `/ready`)
- Prometheus metrics endpoint (`/metrics`)
- Organization-based RBAC with 4 roles
- Session authentication with HTTP-only cookies
- Rate limiting (300 req/min/IP)
- Structured logging with secret redaction
- OpenTracing/OpenTelemetry integration
- React 19 client with 20 workspaces
- Comprehensive test suite (14 test files)

### Changed
- Project rebranded from CC-OS to Worker Agent.Cloud
- README completely rewritten for modern documentation
- TypeScript compilation moved to individual packages
- CI/CD pipeline enhanced with security checks
- Package metadata updated with proper keywords

### Deprecated
- Legacy CC-OS CLI tools in `src/` (maintained for backward compatibility)

### Security
- CSP, HSTS, X-Frame-Options headers enforced
- Secret redaction in logs and audit payloads
- CORS restricted to localhost origins
- TypeScript strict mode enabled

---

## [1.0.0] - 2024-01-15

### Added
- Initial release of Worker Agent.Cloud platform
- 5-layer content automation pipeline
- YouTube automation engine
- Basic agent system (planner, researcher, writer)
- Content generation and publishing

---

## Version History

| Version | Date | Description |
|---|---|---|
| 2.0.0 | 2026-08-15 | Production hardening, MCP integration, 10/10 documentation |
| 1.0.0 | 2024-01-15 | Initial release |

[2.0.0]: https://github.com/Cyberteckmaster/Worker-Agent/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Cyberteckmaster/Worker-Agent/releases/tag/v1.0.0
