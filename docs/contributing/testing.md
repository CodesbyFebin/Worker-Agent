# Testing

Worker Agent maintains a layered testing approach.

## Test Structure

```
server/test/
├── unit/           # Individual function tests
├── integration/    # tRPC/DB integration tests
└── e2e/            # End-to-end flow tests
```

## Running Tests

```bash
# All server tests
npm --prefix server run test

# Watch mode
npm --prefix server run test -- --watch

# Coverage
npm --prefix server run test -- --coverage
```

## Test Categories

### Unit Tests
- Authentication helpers (hash/verify passwords)
- Authorization logic (permission checking)
- Organization isolation (cross-org access prevention)
- Schema helpers
- Event filtering
- Research logic
- Rate limiting

### Integration Tests
- Database operations (user, organization, agent CRUD)
- tRPC procedures (auth flow, workspace access)
- SSE event isolation
- Worker job processing
- Session management

### E2E Tests
- Landing page load
- Dashboard rendering
- Login/logout flow
- Workspace switching
- Agent creation and execution
- Research request and results
- SSE event streaming
- Permission enforcement

## Security Tests
- Unauthenticated API access
- Cross-organization data access
- Role escalation attempts
- Session invalidation
- Malformed input handling