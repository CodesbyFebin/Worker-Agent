# Research Agent Example

An agent that performs multi-step research tasks, gathering information before producing final output.

## What This Example Shows

- Chaining multiple agent steps
- Using web search tool
- Synthesizing findings from multiple sources
- Confidence scoring and source citation

## Prerequisites

- Node.js 20+
- Research tool provider credentials (e.g., Serper API for search)
- Running Worker Agent instance

## Setup

```bash
cp .env.example .env
# Configure:
# - WORKER_AGENT_API_URL
# - RESEARCH_SEARCH_API_KEY
npm run dev
```

## How It Works

```typescript
import { ResearchAgent } from '@worker-agent/sdk/agents';

const researcher = new ResearchAgent({
  searchProvider: 'serper',
  maxSteps: 5,
  citationFormat: 'apa',
});

const report = await researcher.investigate({
  topic: "The impact of LLMs on software development",
  depth: "comprehensive",
});

console.log(report.summary);
console.log(report.sources); // Citations
console.log(report.confidence); // 0.92
```

## Expected Output

```
Research Report: The Impact of LLMs on Software Development

Summary:
LLMs are transforming software development through automated code generation,
bug detection, and pair-programming assistance. Key findings from 12 sources:

1. Code Generation: GitHub Copilot users complete tasks 55% faster
2. Bug Detection: Static analysis accuracy improved by 34%
3. Learning Curve: Junior developers adapt to LLM tools in ~2 weeks

Sources:
[1] Smith et al. (2024). "LLM-Assisted Development." Journal of Software Engineering.
[2] GitHub (2024). "State of the Octoverse: AI Edition."
...

Confidence: 92%
```

## Related Examples

- [basic-agent](../basic-agent/) — Single-step prompt
- [streaming-agent](../streaming-agent/) — Live updates
- [multi-step-agent](../multi-step-agent/) — Conditional workflows