# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x.x | ✅ Yes |
| < 2.0 | ❌ No |

## Reporting a Vulnerability

We take security seriously. Please report vulnerabilities responsibly.

**DO NOT** file public issues for security vulnerabilities.

### Report via

1. **GitHub Security Advisory**: Use the "Security" tab in the repository
2. **Email**: security@workeragent.cloud (for significant issues)
3. **Private Discussion**: Open a private security discussion

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Affected versions
- Your contact information

### Response Timeline

- **Initial Response**: Within 24 hours
- **Assessment**: Within 72 hours
- **Fix Release**: Within 7 days (critical issues)

## Security Controls

### Authentication
- Session-based auth with HTTP-only cookies
- SHA-256 hashed session tokens
- 7-day session expiration

### Authorization
- 4-role RBAC system (owner, admin, member, viewer)
- Organization-scoped access control
- Permission-based API guards

### Transport Security
- HTTPS enforced in production
- Secure, HttpOnly, SameSite cookies
- CORS configured for authorized origins

### Secret Management
- Secrets stored in environment variables only
- No plaintext secrets in code or logs
- Secret redaction in log output

### Rate Limiting
- In-process limits: 300 requests/minute/IP
- Redis-backed limits recommended for multi-replica deployments

### Database Security
- Prepared statements via Drizzle ORM
- Parameterized queries
- Organization isolation at query level

## Known Limitations

- OAuth token refresh not yet implemented
- Rate limiter is in-process memory (not distributed)
- Workers share process with API (not containerized separation)

## Best Practices

1. Never commit `.env` files
2. Use environment-specific secrets
3. Review permission changes carefully
4. Monitor audit logs regularly
5. Rotate credentials periodically

## Security Audits

Automated security checks in CI:

- Dependency vulnerability scanning
- Secret scanning
- CodeQL analysis
- OWASP security checks

## Disclosure Policy

We follow responsible disclosure:

1. You give us reasonable time to investigate
2. We assess and fix the vulnerability
3. We release the fix with credit to you
4. We publish a security advisory

## Contact

- Security Team: security@workeragent.cloud
- GitHub Security: https://github.com/Cyberteckmaster/Worker-Agent/security/advisories
