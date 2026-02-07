# Configuring AI Providers

OpenWhale supports 8 AI providers. You can switch between them anytime from the dashboard.

## Supported Providers

| Provider | Models | Best For |
|----------|--------|----------|
| **Anthropic** | Claude Sonnet 5, Opus 4.5, Sonnet 4.5, Haiku 4.5 | Long-form reasoning, tool use |
| **OpenAI** | GPT-5.2, GPT-5, GPT-4o, o4-mini, o1-preview | General tasks, function calling |
| **Google** | Gemini 3 Pro, Gemini 2.5 Pro/Flash | Speed, multimodal |
| **Qwen** | Qwen3-Max, QwQ-Plus, Qwen3-Coder, Qwen3-VL | Chinese language, coding, vision |
| **DeepSeek** | DeepSeek Chat, Coder, Reasoner | Cost-effective reasoning |
| **Groq** | Llama 3.3 70B, Mixtral 8x7B | Ultra-fast inference |
| **Together** | Any open-source model | Open-source variety |
| **Ollama** | Llama, Mistral, Phi (local) | Local/private inference |

## Configuration

### Via Dashboard

1. Open **http://localhost:7777/dashboard**
2. Go to **Providers** tab
3. Paste your API key
4. Click **Save**

### Via .env File

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
OPENAI_API_KEY=sk-...

# Google
GOOGLE_API_KEY=...

# DeepSeek
DEEPSEEK_API_KEY=sk-...

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434

# Groq
GROQ_API_KEY=gsk_...

# Together
TOGETHER_API_KEY=...
```

## Setting Default Model

In the dashboard Settings page, you can set which model is used by default.

Example: `anthropic:claude-sonnet-4-20250514`

## Failover

OpenWhale automatically fails over to the next configured provider if one fails.

Priority order is based on your .env file order.

## Using Ollama (Local Models)

1. Install Ollama: https://ollama.ai
2. Pull a model:
   ```bash
   ollama pull llama3.3
   ```
3. Set in .env:
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   ```

## Tips

- **Claude** excels at tool use and complex reasoning
- **GPT-4o** has the best vision capabilities
- **DeepSeek** is extremely cost-effective
- **Ollama** keeps everything private and offline
