# Getting Started

Worker Agent.Cloud is a production-grade content automation platform for managing AI-powered content networks.

## Quick Start

### Prerequisites

- Node.js 20+ (or Docker)
- MySQL 8+ / MariaDB 10.6+
- Redis 7+
- API keys for configured providers (optional for dev)

### Local Development

1. **Clone and Install**
   ```bash
   git clone https://github.com/Cyberteckmaster/Worker-Agent.git
   cd Worker-Agent
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Infrastructure**
   ```bash
   npm run local:infra  # Starts MariaDB + Redis via Docker Compose
   ```

4. **Run Development Servers**
   ```bash
   npm run dev  # Runs API, Worker, and Client concurrently
   ```

5. **Access the Platform**
   - Client: http://localhost:5173
   - API: http://localhost:4000

### Docker Deployment

```bash
docker compose up --build
```

See [Deployment Configuration](./deployment.md) for production setup.

## Main Components

| Component | Description | Port |
|---|---|---|
| **Client** | React 19 UI with 20+ workspaces | 5173 |
| **API** | Express + tRPC server | 4000 |
| **Worker** | BullMQ job processors | API process |
| **Database** | MySQL/MariaDB | 3306 |
| **Redis** | BullMQ queues | 6380 |

## First Time Setup

1. **Dev Login** (Development only)
   - Navigate to http://localhost:5173
   - Click "Dev Login" to authenticate
   - Create your first organization

2. **Configure AI Providers**
   - Go to Settings → LLM Providers
   - Add your API keys (Anthropic, OpenAI, etc.)
   - Set your default model

3. **Configure MCP Servers**
   - Go to Settings → Connectors → MCP Servers
   - Add external MCP servers for tool discovery
   - Tools become available in Agent Rail

## Next Steps

- [Configuration](./configuration.md) - Set up providers, MCP servers, and preferences
- [MCP Integration](./mcp/tools.md) - Connect external MCP servers
- [Building Workflows](../server/routers/workflow.router.ts) - Create automated workflows
[Architecture](../ARCHITECTURE.md) - System overview
