# Built-in Tools Catalog

Worker Agent.Cloud provides a comprehensive set of built-in tools for content creation, research, publishing, and more.

## Research Tools

| Tool | Description | Input Schema |
|---|---|---|
| `research_web` | Search the web for current information | `{ query: string, maxResults?: number }` |
| `research_paper` | Search academic papers | `{ query: string, source?: string }` |
| `extract_claims` | Extract factual claims from text | `{ text: string }` |
| `verify_claim` | Verify a claim against sources | `{ claim: string, sources?: string[] }` |

## Content Generation Tools

| Tool | Description | Input Schema |
|---|---|---|
| `generate_script` | Generate a content script | `{ topic: string, format: "youtube-video"\|"youtube-short"\|"tiktok", lengthMinutes?: number }` |
| `optimize_title` | Optimize video title for SEO | `{ title: string, keywords: string[] }` |
| `generate_hashtags` | Generate relevant hashtags | `{ topic: string, platform: "youtube"\|"tiktok"\|"instagram" }` |
| `generate_description` | Generate video description | `{ title: string, script?: string }` |

## Media Generation Tools

| Tool | Description | Input Schema |
|---|---|---|
| `generate_image` | Generate an image | `{ prompt: string, width?: number, height?: number }` |
| `generate_video` | Generate a video from images | `{ images: string[], audio?: string, duration?: number }` |
| `generate_tts` | Text-to-speech synthesis | `{ text: string, voice?: string }` |
| `edit_video` | Edit video with effects | `{ videoUrl: string, edits: VideoEdit[] }` |

## Publishing Tools

| Tool | Description | Input Schema |
|---|---|---|
| `publish_youtube` | Upload to YouTube | `{ title: string, description: string, videoPath: string, tags: string[] }` |
| `publish_tiktok` | Upload to TikTok | `{ videoPath: string, caption: string, hashtags: string[] }` |
| `publish_instagram` | Upload to Instagram Reels | `{ videoPath: string, caption: string }` |
| `publish_facebook` | Upload to Facebook | `{ videoPath: string, caption: string, tags: string[] }` |

## GitHub Tools

| Tool | Description | Input Schema |
|---|---|---|
| `git_commit` | Create a git commit | `{ message: string, files?: string[] }` |
| `git_push` | Push changes to remote | `{ branch?: string }` |
| `create_pr` | Create a pull request | `{ title: string, head: string, base: string, body?: string }` |

## MCP Integration Tools

| Tool | Description | Input Schema |
|---|---|---|
| `mcp_tool_invoke` | Invoke a tool from registered MCP server | `{ serverId: string, toolName: string, input: object }` |
| `mcp_tool_list` | List tools from MCP server | `{ serverId: string }` |

## Tool Security

All tools are subject to:

- **Organization-level allowlists** in `tool_gateway_policies`
- **Required permissions** configured per tool
- **Credential references** (never plaintext secrets)
- **Cost tracking** and audit logging

## Tool Policies

Define which tools your organization can use:

```json
{
  "allowedTools": ["research_web", "generate_script", "publish_youtube"],
  "allowedMcpServerIds": ["mcp-server-1"],
  "deniedTools": ["dangerous_command"]
}
```
