# Configuration

Worker Agent.Cloud is configured via environment variables. All configuration is centralized in `.env`.

## Required Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | MySQL/MariaDB connection string | `postgresql://user:pass@localhost:5432/db` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `PORT` | API server port | `4000` |

## Optional Variables

### AI Providers

Configure one or more providers. Platform auto-routes to available providers.

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `GROQ_API_KEY` | Groq API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `NVIDIA_API_KEY` | NVIDIA API key |
| `GEMINI_API_KEY` | Gemini API key |

### Publishing Platforms

| Variable | Description |
|---|---|
| `YOUTUBE_CLIENT_ID` | YouTube OAuth client ID |
| `YOUTUBE_CLIENT_SECRET` | YouTube OAuth client secret |
| `TIKTOK_API_KEY` | TikTok API key |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram access token |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn access token |

### Search Providers

| Variable | Description |
|---|---|
| `TAVILY_API_KEY` | Tavily search API key |
| `BRAVE_API_KEY` | Brave Search API key |
| `SERPAPI_KEY` | SerpAPI key |

### Storage

| Variable | Description |
|---|---|
| `S3_ACCESS_KEY_ID` | S3 access key |
| `S3_SECRET_ACCESS_KEY` | S3 secret key |
| `S3_BUCKET` | S3 bucket name |
| `S3_REGION` | S3 region |

### Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX` | `300` | Max requests per window per IP |

### Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

## Environment Profiles

### Development

```bash
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:5173
```

### Production

```bash
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_APP_URL=https://workeragent.cloud
```

## Configuration Validation

The server validates configuration at startup. Required variables must be present:

```bash
npm run dev
# Server logs will show missing configuration
```

## MCP Server Configuration

MCP servers are registered in the database, not via environment variables. Configure via Settings → Connectors → MCP Servers in the UI.

Example configuration JSON:

```json
{
  "timeout": 30000,
  "headers": {
    "Authorization": "Bearer ${MCP_API_KEY}"
  },
  "allowUnauthorized": false
}
```

## Database Initialization

For fresh installations:

```bash
npm run db:push  # Syncs schema to database
```

For production deployments, use migration files in `drizzle/sql/`.
