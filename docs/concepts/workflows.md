# Workflows

Worker Agent provides a visual workflow engine for automating multi-step AI processes.

## Workflow Model

```
Definition → Version → Run → Step Runs → Results
```

## Features

- Visual canvas editor (React Flow)
- Node-based pipeline construction
- Step-level execution and monitoring
- Error handling and retry logic
- Parallel execution support
- Real-time progress via SSE

## Building Blocks

| Node Type | Description |
|---|---|
| **Agent** | Execute an AI agent with configured input |
| **Research** | Trigger deep research with citations |
| **Transform** | Data transformation and formatting |
| **Evaluate** | Run compliance checks |
| **Approval** | Human-in-the-loop gate |
| **Publish** | Deploy content to target platforms |

## Example Workflow

```
[Research Request] → [Deep Research Agent] → [Script Generator] → [Content Review] → [Publish]
```