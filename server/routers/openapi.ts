/**
 * OpenAPI 3.1 contract for the versioned REST facade mounted at `/api/v1`.
 *
 * This is a hand-authored, accurate description of the REAL routes served by
 * `rest.ts`. It is not generated from aspirational endpoints — every path
 * below maps to a handler that exists in this codebase. Exposed so SDKs can be
 * generated and the contract can be tested.
 */

const HealthSchema = {
  type: "object",
  properties: {
    status: { type: "string" },
    uptimeSec: { type: "integer" },
    pid: { type: "integer" },
    node: { type: "string" },
    role: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
    memory: {
      type: "object",
      properties: {
        rss: { type: "integer" },
        heapUsed: { type: "integer" },
        heapTotal: { type: "integer" },
      },
    },
    counters: { type: "object", additionalProperties: { type: "number" } },
  },
  required: ["status", "uptimeSec", "pid", "node", "role", "timestamp"],
} as const;

const ErrorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
  },
  required: ["error", "message"],
} as const;

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Worker Agent.Cloud REST",
      version: "1.0.0",
      description:
        "Versioned REST facade mirroring the tRPC API. Auth uses the same httpOnly " +
        "`wa_session` cookie used by the tRPC layer; organizations are scoped via " +
        "the `x-organization-id` header (see AuthContext in server/_core/context.ts).",
    },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/health": {
        get: {
          summary: "Process liveness + counters (no auth)",
          operationId: "getHealth",
          tags: ["observability"],
          responses: {
            "200": {
              description: "Service is alive",
              content: { "application/json": { schema: HealthSchema } },
            },
          },
        },
      },
      "/openapi.json": {
        get: {
          summary: "This OpenAPI document (no auth)",
          operationId: "getOpenApi",
          tags: ["observability"],
          responses: {
            "200": {
              description: "OpenAPI 3.1 document",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/workflows": {
        get: {
          summary: "List workflows for the active organization",
          operationId: "listWorkflows",
          tags: ["orchestration"],
          security: [{ cookie: [] }],
          parameters: [
            {
              name: "x-organization-id",
              in: "header",
              required: false,
              schema: { type: "string" },
              description: "Overrides the session's active organization.",
            },
          ],
          responses: {
            "200": {
              description: "Workflow list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        description: { type: "string" },
                        status: { type: "string" },
                        currentVersionId: { type: "string", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthenticated", content: { "application/json": { schema: ErrorSchema } } },
            "403": { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
          },
        },
      },
      "/goals": {
        post: {
          summary: "Dispatch a goal to the God Machine orchestrator",
          operationId: "dispatchGoal",
          tags: ["orchestration"],
          security: [{ cookie: [] }],
          parameters: [
            {
              name: "x-organization-id",
              in: "header",
              required: false,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["goal"],
                  properties: {
                    goal: { type: "string", minLength: 1, maxLength: 2000 },
                    scriptId: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Goal dispatched; poll /tasks for the resulting root task",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      rootTaskId: { type: "string" },
                      scriptId: { type: "string", nullable: true },
                      pipelineId: { type: "string", nullable: true },
                    },
                    required: ["rootTaskId"],
                  },
                },
              },
            },
            "400": { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
            "401": { description: "Unauthenticated", content: { "application/json": { schema: ErrorSchema } } },
            "403": { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
          },
        },
      },
      "/campaigns": {
        get: {
          summary: "List content campaigns for the org",
          operationId: "listCampaigns",
          tags: ["orchestration"],
          security: [{ cookie: [] }],
          responses: {
            "200": {
              description: "Campaign list",
              content: {
                "application/json": {
                  schema: { type: "array", items: { type: "object" } },
                },
              },
            },
            "401": { description: "Unauthenticated", content: { "application/json": { schema: ErrorSchema } } },
            "403": { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
          },
        },
      },
      "/youtube/channels": {
        get: {
          summary: "List bound YouTube channels for the org",
          operationId: "listYoutubeChannels",
          tags: ["publishing"],
          security: [{ cookie: [] }],
          responses: {
            "200": {
              description: "Channel bindings (OAuth refs are env keys, never raw tokens)",
              content: {
                "application/json": {
                  schema: { type: "array", items: { type: "object" } },
                },
              },
            },
            "401": { description: "Unauthenticated", content: { "application/json": { schema: ErrorSchema } } },
            "403": { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
          },
        },
      },
      "/knowledge/search": {
        get: {
          summary: "Keyword search across scripts, trends, research, taxonomies, patterns, brands",
          operationId: "searchKnowledge",
          tags: ["knowledge"],
          security: [{ cookie: [] }],
          parameters: [
            { name: "query", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 1000 } },
            { name: "entityTypes", in: "query", required: false, schema: { type: "array", items: { type: "string" }, style: "form", explode: false } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "x-organization-id", in: "header", required: false, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Search results", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/KnowledgeSearchResult" } } } } },
            "400": { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
            "401": { description: "Unauthenticated", content: { "application/json": { schema: ErrorSchema } } },
            "403": { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
          },
        },
      },
      "/knowledge/semantic": {
        get: {
          summary: "Vector (cosine) semantic search over stored embeddings",
          operationId: "semanticSearch",
          tags: ["knowledge"],
          security: [{ cookie: [] }],
          parameters: [
            { name: "query", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 1000 } },
            { name: "entityTypes", in: "query", required: false, schema: { type: "array", items: { type: "string" }, style: "form", explode: false } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "x-organization-id", in: "header", required: false, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Semantic results ranked by cosine score", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/SemanticResult" } } } } },
            "400": { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
            "401": { description: "Unauthenticated", content: { "application/json": { schema: ErrorSchema } } },
            "403": { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
          },
        },
      },
      "/knowledge/embeddings": {
        post: {
          summary: "Embed + upsert a knowledge entity for semantic search",
          operationId: "indexEmbedding",
          tags: ["knowledge"],
          security: [{ cookie: [] }],
          parameters: [
            { name: "x-organization-id", in: "header", required: false, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/KnowledgeEmbedding" },
              },
            },
          },
          responses: {
            "201": { description: "Embedding upserted", content: { "application/json": { schema: { $ref: "#/components/schemas/KnowledgeEmbeddingRecord" } } } },
            "400": { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
            "401": { description: "Unauthenticated", content: { "application/json": { schema: ErrorSchema } } },
            "403": { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        cookie: {
          type: "apiKey",
          in: "cookie",
          name: "wa_session",
          description: "httpOnly session cookie issued by POST /trpc/auth.devLogin (devLogin).",
        },
      },
      schemas: {
        HealthSchema,
        ErrorSchema,
        KnowledgeEmbedding: {
          type: "object",
          required: ["entityType", "entityId", "text"],
          properties: {
            entityType: { type: "string" },
            entityId: { type: "string" },
            text: { type: "string", maxLength: 25000 },
            metadata: { type: "object", additionalProperties: true },
          },
        },
        KnowledgeEmbeddingRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            organizationId: { type: "string" },
            entityType: { type: "string" },
            entityId: { type: "string" },
            metadata: { type: "string", nullable: true },
            embeddingJson: { type: "string" },
            model: { type: "string" },
            backend: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["id", "organizationId", "entityType", "entityId", "embeddingJson", "model", "backend", "createdAt"],
        },
        KnowledgeSearchResult: {
          type: "object",
          properties: {
            entityType: { type: "string" },
            entityId: { type: "string" },
            title: { type: "string" },
            snippet: { type: "string" },
            score: { type: "number" },
          },
          required: ["entityType", "entityId", "title", "snippet", "score"],
        },
        SemanticResult: {
          type: "object",
          properties: {
            entityType: { type: "string" },
            entityId: { type: "string" },
            score: { type: "number" },
            metadata: { type: "string", nullable: true },
          },
          required: ["entityType", "entityId", "score", "metadata"],
        },
      },
    },
  };
}
