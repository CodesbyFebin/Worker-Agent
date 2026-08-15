# Examples Gallery

Real working examples of Worker Agent capabilities. Each example is a self-contained project you can run immediately.

## Examples

### [basic-agent](./basic-agent)
A minimal agent that responds to prompts using a single LLM provider.

**Use when:** You want the simplest possible starting point.

```bash
cd examples/basic-agent
cd src/providers
# Configure your provider credentials
```

### [research-agent](./research-agent)
An agent that performs multi-step research tasks, gathering information before producing final output.

**Use when:** You need an AI that can search, read sources, and synthesize findings.

### [streaming-agent](./streaming-agent)
Demonstrates real-time SSE event streaming from agent execution.

**Use when:** You want to show live agent progress to users.

### [multi-step-agent](./multi-step-agent)
An agent orchestrated through a workflow engine with conditional steps.

**Use when:** Your task requires branching logic, tool chains, or human approvals.

### [provider-example](./provider-example)
Shows how to add a custom LLM provider to the routing system.

**Use when:** You need to integrate a new OpenAI-compatible API.

### [production-self-hosted](./production-self-hosted)
Full production deployment with Docker Compose, nginx TLS, and systemd.

**Use when:** You're deploying to a real VPS for your organization.

## Running an Example

All examples follow the same pattern:

```bash
# 1. Clone the example
cd examples/basic-agent

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Run
npm run dev
```

## Contributing an Example

We welcome example contributions! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

To add a new example:

1. Create a directory under `examples/`
2. Include a `README.md` with:
   - What the example demonstrates
   - Prerequisites
   - Setup steps
   - Expected output
3. Keep it minimal — one concept per example
4. Add it to the list above