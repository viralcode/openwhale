# Connections

Connections store API keys and credentials for external services used by workflow nodes.

---

## How to Know Which Connection a Node Needs

Check the `connection` field in the node_type schema:

```json
{
  "name": "OpenAI Connection",
  "description": "The OpenAI connection to use for the assistant.",
  "required": true,
  "connection_category": "openai"
}
```

| Field | Description |
|-------|-------------|
| `connection_category` | The provider category (e.g., `openai`, `claude`) |
| `required` | Whether a connection is mandatory |

Use `agenticflow_get_node_type_details(name="node_type_name")` to see the connection requirements.

---

## Usage in Nodes

```json
"connection": "{{__app_connections__['connection-uuid']}}"
```

Or set to `null`:

```json
"connection": null
```

> **Note**: When **creating** a workflow, `connection` can be `null` even if `required: true`. However, to **execute** the workflow, nodes with required connections must have valid connection values.

---

## Connection Providers

### AI Model Providers

| Category | Provider | Description |
|----------|----------|-------------|
| `openai` | OpenAI | GPT models, DALL-E, Whisper |
| `claude` | Anthropic | Claude 3.5 Sonnet, Claude 3 Opus |
| `google_gen_ai` | Google Gemini | Gemini Pro, Gemini Flash |
| `deepseek` | DeepSeek | DeepSeek models |
| `groq` | Groq | Fast inference for open models |
| `perplexity` | Perplexity | AI-powered search |

### AI Infrastructure

| Category | Provider | Description |
|----------|----------|-------------|
| `replicate` | Replicate | Open-source models (FLUX, Stable Diffusion) |
| `fal` | FAL.ai | Fast generative AI inference |
| `straico` | Straico | Multi-model unified API |
| `pixelml` | PixelML | Enterprise AI platform |

### Specialized Tools

| Category | Provider | Description |
|----------|----------|-------------|
| `firecrawl` | Firecrawl | Web scraping for AI/LLMs |
| `tavily` | Tavily | Search API for AI agents |
| `telegram` | Telegram | Bot API for messaging |

### MCP Connections

| Category | Description |
|----------|-------------|
| `mcp` | Model Context Protocol - Connect to any MCP server |

---

## Managing Connections

Use MCP tools to manage connections:

```
# List available connections
agenticflow_list_app_connections

```

---

## Full Documentation

For complete provider details and setup instructions:
[Connection Providers Documentation](https://docs.agenticflow.ai/integrations/connection-providers)
