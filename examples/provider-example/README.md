# Custom Provider Example

Add a new LLM provider to the Worker Agent routing system.

## What This Example Shows

- Implementing a custom provider adapter
- Registering the provider in the routing table
- Configuring provider-specific policies
- Testing provider integration

## Prerequisites

- A provider with OpenAI-compatible API
- Provider API key

## Setup

```bash
cp .env.example .env
# Configure CUSTOM_PROVIDER_API_KEY and CUSTOM_PROVIDER_URL
npm install
npm run dev
```

## Implementing the Provider

### 1. Create the Adapter

```typescript
// src/providers/custom-provider.ts
import { BaseProvider, ProviderConfig } from '@worker-agent/sdk/providers';

export class CustomProvider extends BaseProvider {
  readonly name = 'custom';
  readonly type = 'llm';

  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig();
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.fetchWithAuth(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.adaptRequest(request)),
    });

    const data = await response.json();
    return this.adaptResponse(data);
  }

  async *stream(request: ChatRequest): AsyncGenerator<Token> {
    const response = await this.fetchWithAuth(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.adaptRequest(request), stream: true }),
    });

    for await (const line of response.body) {
      if (line.startsWith('data:')) {
        yield JSON.parse(line.slice(5));
      }
    }
  }
}
```

### 2. Register in Configuration

Add to `workers/provider-config.ts`:

```typescript
import { CustomProvider } from './providers/custom-provider';

registry.register('custom', CustomProvider, {
  baseUrl: process.env.CUSTOM_PROVIDER_URL,
  apiKey: process.env.CUSTOM_PROVIDER_API_KEY,
  headers: { 'HTTP-Referer': 'https://your-app.com' },
});

// Add capability metadata
modelCatalog.add({
  id: 'custom-gpt-4',
  provider: 'custom',
  name: 'Custom GPT-4',
  contextWindow: 8192,
  maxTokens: 4096,
  costPer1M: { input: 0.5, output: 1.5 },
  supports: ['chat', 'streaming', 'functions'],
});
```

### 3. Test the Integration

```bash
# Run provider self-test
npm run test:providers

# Test with the routing system
curl -X POST http://localhost:4000/api/v1/agents/test \
  -H "Content-Type: application/json" \
  -d '{"model": "custom-gpt-4", "prompt": "Hello world"}'
```

### 4. Add to Provider Policies

Update `model_policies` table:

```sql
INSERT INTO model_policies (model_id, provider, max_tokens, cost_per_1k, context_window)
VALUES ('custom-gpt-4', 'custom', 4096, 0.0015, 8192);
```

## Expected Output

```
Provider: custom
Model: custom-gpt-4
Status: ✓ healthy
Latency: 245ms avg
Cost: $0.0015 / 1k tokens
Supports: chat, streaming, functions
```

## Related Examples

- [production-self-hosted](../production-self-hosted/) — Full deployment