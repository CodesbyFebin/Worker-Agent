# Basic Agent Example

A minimal Worker Agent that responds to prompts using a single LLM provider.

## What This Example Shows

- Loading Worker Agent SDK
- Creating a simple agent with a single tool
- Running the agent and collecting the response
- Using tRPC client to communicate with the API

## Prerequisites

- Node.js 20+
- An OpenAI API key (or Anthropic, etc.)
- A running Worker Agent instance (see [Quick Start](../../../docs/getting-started/installation.md))

## Setup

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env with your API credentials
#    - WORKER_AGENT_API_URL=http://localhost:4000
#    - OPENAI_API_KEY=your-key-here

# 3. Run the example
npm run dev
```

## Code Walkthrough

```typescript
import { WorkerAgentClient } from '@worker-agent/sdk';

// Initialize client
const agent = new WorkerAgentClient({
  baseUrl: process.env.WORKER_AGENT_API_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

// Create a simple prompt agent
const result = await agent.run({
  prompt: "Explain the difference between REST and GraphQL",
  maxTokens: 500,
});

console.log(result.response);
```

## Expected Output

```
REST (Representational State Transfer) and GraphQL are two different approaches
to building APIs...

[Full response with explanation of REST principles: statelessness, cacheability,
layered system, uniform interface]

[GraphQL principles: single endpoint, type system, query language, real-time subscriptions]

[Comparison: over-fetching vs under-fetching, caching, tooling, learning curve]
```

## Related Examples

- [research-agent](../research-agent/) — Multi-step research
- [streaming-agent](../streaming-agent/) — Real-time events
- [multi-step-agent](../multi-step-agent/) — Workflow orchestration