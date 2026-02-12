# AI Providers

OpenWhale supports **8 AI providers** with automatic failover. Add the API keys for whichever services you want to use — you can switch models on the fly from the dashboard or CLI.

---

## Supported Providers

| Provider | Env Variable | Top Models |
|----------|--------------|------------|
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude Opus 4.5, Claude Sonnet 4.5 |
| **OpenAI** | `OPENAI_API_KEY` | GPT-5.2, GPT-5, GPT-4o, o4-mini |
| **Google Gemini** | `GOOGLE_API_KEY` | Gemini 3 Pro, Gemini 2.5 Pro |
| **Qwen** | `DASHSCOPE_API_KEY` | Qwen3-Max, QwQ-Plus, Qwen3-Coder |
| **DeepSeek** | `DEEPSEEK_API_KEY` | DeepSeek Chat, DeepSeek Coder, DeepSeek Reasoner |
| **Groq** | `GROQ_API_KEY` | Llama 3.3 70B, Mixtral 8x7B |
| **Together AI** | `TOGETHER_API_KEY` | Any open-source model |
| **Ollama** | `OLLAMA_HOST` | Local models (Llama, Mistral, Phi) — no API key needed! |

---

## Configuration

Add your API keys in `.env` or via the Dashboard (**Settings → Providers**):

```bash
# Example .env configuration
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
DASHSCOPE_API_KEY=...      # or QWEN_API_KEY
DEEPSEEK_API_KEY=...
GROQ_API_KEY=...
TOGETHER_API_KEY=...
OLLAMA_HOST=http://localhost:11434
```

> 💡 You only need to configure providers you want to use. Even a single provider is enough to get started.

---

## Automatic Failover

If your primary provider fails (rate limit, quota exceeded, service down), OpenWhale automatically switches to the next available provider.

**Default failover chain:** Anthropic → OpenAI → Ollama

### How It Works

The failover system (`src/providers/failover.ts`) handles three types of failures:
- **Rate limits** — 429 / "too many requests"
- **Quota exhaustion** — billing / insufficient quota errors
- **Service outages** — 502, 503, "service unavailable"

| Setting | Default | Description |
|---------|---------|-------------|
| **Max retries** | 3 | Failures before switching provider |
| **Retry delay** | 1000ms | Wait between retry attempts |
| **Provider chain** | Configurable | Ordered list of fallback providers |

After a successful call, the failure counter resets. You can configure a custom failover chain or reset to the primary provider at any time.

---

## Architecture

Providers are implemented in `src/providers/`:

| File | Purpose |
|------|---------|
| `anthropic.ts` | Anthropic (Claude) provider |
| `google.ts` | Google Gemini provider |
| `openai-compatible.ts` | OpenAI, Qwen, DeepSeek, Groq, Together AI, Ollama (all use OpenAI-compatible API format) |
| `failover.ts` | Automatic failover logic |
| `index.ts` | Provider registry and initialization |
| `base.ts` | Base provider interface |

> **Note:** Qwen, DeepSeek, Groq, Together AI, and Ollama all use the OpenAI-compatible API format and are handled by a single adapter (`openai-compatible.ts`).

---

## Switching Models

### From the Dashboard
Go to **Providers** and select your preferred model from the dropdown.

### From the CLI
```bash
npm run cli providers    # List all configured providers and their status
```
