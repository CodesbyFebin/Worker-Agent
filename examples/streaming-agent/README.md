# Streaming Agent Example

Demonstrates real-time SSE event streaming from agent execution.

## What This Example Shows

- Connecting to the SSE event stream
- Handling live agent events
- Displaying progress to users
- Error handling during streaming

## Setup

```bash
cp .env.example .env
npm run dev
```

## How It Works

```typescript
import { WorkerAgentClient } from '@worker-agent/sdk';

const client = new WorkerAgentClient({
  baseUrl: process.env.WORKER_AGENT_API_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

// Connect to event stream
const stream = client.stream({
  prompt: "Write a short story about a robot learning to paint",
  maxTokens: 1000,
});

stream.on('token', (token: string) => {
  process.stdout.write(token); // Live output
});

stream.on('step', (step) => {
  console.log(`\n[Step ${step.number}]: ${step.description}`);
});

stream.on('tool_call', (tool) => {
  console.log(`[Using tool: ${tool.name}]`);
});

stream.on('error', (err) => {
  console.error(`Error: ${err.message}`);
});

stream.on('done', (result) => {
  console.log(`\n\nCompleted in ${result.duration}ms`);
});
```

## Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `token` | `string` | New token from LLM |
| `step` | `{number, description}` | Agent step started |
| `tool_call` | `{name, args}` | Tool invocation |
| `tool_result` | `{output}` | Tool result received |
| `thinking` | `string` | Agent reasoning trace |
| `warning` | `string` | Non-fatal alert |
| `error` | `Error` | Execution error |
| `done` | `Result` | Stream completed |

## Expected Output

```
[Step 1]: Planning the story arc
[Using tool: character_generator]
[Using tool: setting_generator]

Once upon a time, there was a robot named P-34...
[Step 2]: Developing character arc
The robot picked up a brush, its mechanical fingers...
[Step 3]: Writing conclusion

Completed in 2450ms
```

## Related Examples

- [basic-agent](../basic-agent/) — Non-streaming version
- [multi-step-agent](../multi-step-agent/) — Workflow events