# Agents

Worker Agent supports autonomous AI agents that can be configured, executed, and monitored.

## Agent Lifecycle

```
Created → Draft → Active → Executing → Completed/Failed
```

## Key Components

- **Agent Definition**: Template defining purpose, capabilities, and tools
- **Agent Version**: Immutable snapshot of an agent definition
- **Agent Execution**: Running instance with input/output tracking
- **Agent Evaluation**: Automated testing against test cases

## Features

- Multi-model support (OpenAI, Anthropic, Claude, local models)
- Tool integration (MCP, builtin tools)
- Execution history and replay
- Token usage and cost tracking
- Automated evaluations

## API

```typescript
// Create agent
const agent = await trpc.agents.create.mutate({
  name: "Research Assistant",
  description: "Performs deep research on demand",
  modelProvider: "openai",
  modelName: "gpt-4o",
  tools: ["web_search", "file_reader"],
});

// Execute agent
const execution = await trpc.agents.execute.mutate({
  agentId: agent.id,
  input: "Research the latest developments in quantum computing",
});
```