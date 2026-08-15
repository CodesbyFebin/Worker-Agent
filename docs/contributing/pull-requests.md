# Pull Request Process

## Before You Open

1. **Fork** the repository
2. Create a branch: `git checkout -b feat/my-feature`
3. Make changes following [coding conventions](./development.md)
4. Add tests for new functionality
5. Commit using [conventional commits](https://www.conventionalcommits.org/)

## Checklist

Before submitting your PR, ensure:

- [ ] `npm --prefix server run typecheck` passes
- [ ] `npm --prefix client run typecheck` passes
- [ ] `npm --prefix server run test` passes
- [ ] New code is tested
- [ ] Schema changes include Drizzle migrations (Schema Guard will verify)
- [ ] No secrets, credentials, or API keys in the diff
- [ ] README/docs updated if API changes

## PR Description Template

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Key change 1
- Key change 2

## Testing
Tested via:
- Unit tests
- Manual testing
- [if applicable] E2E tests

## Screenshots (if UI)
Before/after screenshots for UI changes.
```

## Review Process

1. CI checks must pass (typecheck, tests, build)
2. Schema Guard must pass (no drift)
3. Security Suite must pass (no secrets)
4. Code review by 1+ maintainers
5. Merge after approval

## Merge Requirements

- 1 approval from maintainer
- All CI checks green
- Branch is up to date with `main`