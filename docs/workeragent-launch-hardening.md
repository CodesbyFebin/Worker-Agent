# Worker Agent launch hardening

## God Router

The runtime router now uses provider cooldowns and exponential backoff. A provider enters cooldown after repeated transient failures or a 429 response, preventing repeated immediate retries and thundering-herd behavior.

Cooldown state is process-local and intentionally ephemeral. It is surfaced through `trpc.chat.status` so Mission Control can show currently cooling providers.

## Research streaming

The current chat API remains a tRPC mutation. Deep Research progress is represented by the existing pending UI until a dedicated streaming transport is added. This avoids inventing fake progress events.

A future streaming transport should expose provider/tool events from the research provider adapter itself so the UI can render real `searching`, `source`, and `synthesizing` events rather than simulated status messages.

## Domain

`workeragent.cloud` must be attached to the Vercel project and verified at the DNS/registrar layer. That is infrastructure configuration, not a repository change.
