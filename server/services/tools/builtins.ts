import { listProviderStatus } from "../llm/router";
import { webSearch } from "../search/index";
import { getRepoStatus, listAllowedCommands, runAllowedCommand } from "../ide/gitOps";
import { listRepoDir, readRepoFile } from "../ide/repoFs";
import { env } from "../../_core/env";

export type BuiltinToolSpec = {
  name: string;
  displayName: string;
  description: string;
  requiredPermission: string;
  credentialProvider?: string;
  inputSchema: Record<string, unknown>;
};

export function listBuiltinToolSpecs(): BuiltinToolSpec[] {
  return [
    {
      name: "connectors.status",
      displayName: "Connector status",
      description: "List which LLM/search/publish connectors have env credentials configured (never returns secrets).",
      requiredPermission: "tool:invoke",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "llm.providers",
      displayName: "LLM providers",
      description: "Live provider reachability from the model router.",
      requiredPermission: "tool:invoke",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "search.web",
      displayName: "Web search",
      description: "Search via configured Tavily/Brave/Serper keys.",
      requiredPermission: "tool:invoke",
      credentialProvider: "search",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" } },
        required: ["query"],
      },
    },
    {
      name: "repo.status",
      displayName: "Git status",
      description: "Branch + short status for GOD_MACHINE_REPO_ROOT.",
      requiredPermission: "tool:invoke",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "repo.list",
      displayName: "List directory",
      description: "List a directory under the agent repo root (path-safe).",
      requiredPermission: "tool:invoke",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
      },
    },
    {
      name: "repo.read",
      displayName: "Read file",
      description: "Read a text file under the agent repo root.",
      requiredPermission: "script:read",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
    {
      name: "ide.run_command",
      displayName: "Run allowlisted command",
      description: "Run an IDE allowlisted command (typecheck/lint/test/git).",
      requiredPermission: "script:write",
      inputSchema: {
        type: "object",
        properties: {
          commandId: { type: "string", enum: listAllowedCommands().map((c) => c.id) },
          worktreeId: { type: "string" },
        },
        required: ["commandId"],
      },
    },
    {
      name: "env.presence",
      displayName: "Env key presence",
      description: "Check whether named env keys are set (boolean only).",
      requiredPermission: "settings:read",
      inputSchema: {
        type: "object",
        properties: { keys: { type: "array", items: { type: "string" } } },
        required: ["keys"],
      },
    },
  ];
}

export async function executeBuiltinTool(
  name: string,
  input: Record<string, unknown>,
  _ctx: { organizationId: string; actorUserId: string },
): Promise<unknown> {
  switch (name) {
    case "connectors.status": {
      const keys = [
        ["anthropic", env.ANTHROPIC_API_KEY],
        ["openrouter", env.OPENROUTER_API_KEY],
        ["nvidia", env.NVIDIA_API_KEY],
        ["groq", env.GROQ_API_KEY],
        ["gemini", env.GEMINI_API_KEY],
        ["tavily", env.TAVILY_API_KEY],
        ["brave", env.BRAVE_SEARCH_API_KEY],
        ["serper", env.SERPER_API_KEY],
        ["github", env.GITHUB_TOKEN],
      ] as const;
      return {
        connectors: keys.map(([id, val]) => ({ id, configured: Boolean(val) })),
      };
    }
    case "llm.providers":
      return { providers: await listProviderStatus() };
    case "search.web": {
      const query = String(input.query ?? "");
      if (!query) throw new Error("query required");
      const limit = typeof input.limit === "number" ? input.limit : 5;
      const hits = await webSearch(query, limit);
      return { query, hits };
    }
    case "repo.status":
      return getRepoStatus();
    case "repo.list":
      return listRepoDir(String(input.path ?? ""));
    case "repo.read": {
      const path = String(input.path ?? "");
      if (!path) throw new Error("path required");
      return readRepoFile(path);
    }
    case "ide.run_command": {
      const commandId = String(input.commandId ?? "");
      if (!commandId) throw new Error("commandId required");
      return runAllowedCommand({
        commandId,
        worktreeId: typeof input.worktreeId === "string" ? input.worktreeId : undefined,
      });
    }
    case "env.presence": {
      const keys = Array.isArray(input.keys) ? input.keys.map(String) : [];
      return {
        keys: keys.map((k) => ({
          key: k,
          set: Boolean((process.env as Record<string, string | undefined>)[k]),
        })),
      };
    }
    default:
      throw new Error(`Unknown builtin tool: ${name}`);
  }
}
