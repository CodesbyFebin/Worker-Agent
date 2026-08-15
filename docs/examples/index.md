# Examples

Real working examples of Worker Agent capabilities. Each example is a self-contained project you can run immediately.

## Examples

### [Basic Agent](../examples/basic-agent/)

A minimal agent that responds to prompts using a single LLM provider.

```bash
cd examples/basic-agent
cp .env.example .env  # Add your API key
npm run dev
```

### [Research Agent](../examples/research-agent/)

An agent that performs multi-step research, gathering information before producing final output.

### [Streaming Agent](../examples/streaming-agent/)

Demonstrates real-time SSE event streaming from agent execution.

### [Multi-Step Agent](../examples/multi-step-agent/)

An agent orchestrated through a workflow engine with conditional steps and human approvals.

### [Provider Example](../examples/provider-example/)

Shows how to add a custom LLM provider to the routing system.

### [Production Self-Hosted](../examples/production-self-hosted/)

Full production deployment with Docker Compose, nginx TLS, and systemd.

## Running Any Example

All examples follow the same pattern:

```bash
# 1. Enter the example directory
cd examples/<example-name>

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Install and run
npm install
npm run dev
```

## Contributing an Example

1. Create a directory under `examples/`
2. Include a `README.md` with purpose, setup, and expected output
3. Include a `.env.example` with required variables
4. Add your example to this index
5. Submit a PR

[View the full example gallery on GitHub](https://github.com/CodesbyFebin/Worker-Agent/tree/main/examples)