# Multi-Step Agent Example

An agent orchestrated through a workflow engine with conditional steps and human approvals.

## What This Example Shows

- Defining agent workflows
- Conditional branching
- Human approval gates
- Error recovery and retries

## Setup

```bash
cp .env.example .env
npm run dev
```

## Workflow Definition

```typescript
import { WorkflowBuilder } from '@worker-agent/sdk/workflows';

const workflow = WorkflowBuilder.create('content-pipeline')
  .step('research')
  .agent({
    prompt: "Research the latest developments in quantum computing",
    maxTokens: 2000,
  })
  .branch()
  .if('quality_score > 0.8', 'high-quality')
  .if('quality_score > 0.5', 'needs-review')
  .else('rewrite')
  .step('publish')
  .humanApproval({
    required: true,
    approvers: ['editor@example.com'],
    timeout: '24h',
  })
  .agent({
    prompt: "Format research findings into a blog post",
    template: 'blog-post',
  })
  .build();
```

## Running the Workflow

```typescript
import { WorkerAgentClient } from '@worker-agent/sdk';

const client = new WorkerAgentClient({ baseUrl: process.env.WORKER_AGENT_API_URL });

const execution = client.runWorkflow(workflow, {
  topic: "quantum computing breakthroughs 2025",
  targetAudience: "technical professionals",
});

execution.on('step:complete', (step, result) => {
  console.log(`✓ ${step.name} completed`);
    console.log(`  Quality: ${result.qualityScore}/100`);
});

execution.on('approval:requested', (approval) => {
  console.log(`Review needed: ${approval.workflow}`);
  console.log(`URL: ${approval.approvalUrl}`);
});
```

## Expected Output

```
✓ research completed
  Quality: 92/100
  Sources: 15
✓ analysis completed
  Quality: 88/100
Approval requested: content-pipeline
URL: https://app.workeragent.ai/approvals/abc123
[Waiting for human approval...]
✓ Human approved
✓ publish completed
  Word count: 1247
```

## Advanced Features

### Parallel Steps

```typescript
workflow
  .step('generate-variants', { parallel: true })
  .agent({ prompt: "Write version A...", })
  .agent({ prompt: "Write version B...", })
  .agent({ prompt: "Write version C...", })
```

### Retry Policies

```typescript
workflow
  .step('publish')
  .retry({
    attempts: 3,
    backoff: 'exponential',
    on: ['timeout', 'rate_limit'],
  })
```

## Related Examples

- [research-agent](../research-agent/) — Single-purpose research
- [streaming-agent](../streaming-agent/) — Real-time events