# Research

Deep Research in Worker Agent enables autonomous investigation with real-time streaming and source attribution.

## Flow

```
User Request → tRPC → Validation → BullMQ → Research Agent → SSE → UI
```

## Research Phases

1. **Started** - Research job queued and worker assigned
2. **Searching** - Querying AI providers and web sources
3. **Reading** - Analyzing retrieved content
4. **Analyzing** - Synthesizing information
5. **Synthesizing** - Generating final report
6. **Completed** - Report persisted with sources
7. **Failed** - Error captured with traceback

## Features

- Real-time SSE progress streaming
- Source citation and attribution
- Cost tracking per research request
- Organization-scoped events
- Retry on provider failure
- Dead letter queue for persistent failures

## API

```typescript
// Start research
const result = await trpc.research.create.mutate({
  prompt: "What are the latest developments in AI agents?",
  model: "gpt-4o",
  maxSteps: 5,
});

// Subscribe to events via SSE
const eventSource = new EventSource("/events");
```