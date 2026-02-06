# Agent Overview

An **Agent** in AgenticFlow is an AI entity that can reason, use tools, and accomplish tasks autonomously.

## Core Components

| Component | Description |
|-----------|-------------|
| **Model** | The LLM powering the agent (GPT-4, Claude, Gemini, etc.) |
| **System Prompt** | Defines persona, instructions, and constraints |
| **Tools** | Functions the agent can invoke to take actions |
| **Memory** | Context management for conversation history |

## Agent Configuration

```yaml
agent:
  id: "assistant-001"
  name: "Research Assistant"
  model: claude-3-sonnet
  
  system_prompt: |
    You are a helpful research assistant.
    Always cite sources when providing information.
    Ask clarifying questions when the request is ambiguous.
  
  tools:
    - web_search
    - document_reader
    - calculator
  
  memory:
    type: sliding_window
    max_tokens: 8000
  
  settings:
    temperature: 0.7
    max_iterations: 10
    timeout: 120
```

## Tool Integration

Agents interact with external systems through tools.

### Built-in Tools

| Tool | Description |
|------|-------------|
| `web_search` | Search the internet |
| `code_executor` | Run code snippets |
| `file_reader` | Read file contents |
| `calculator` | Perform calculations |

### Custom Tools

Define custom tools for domain-specific actions:

```yaml
tools:
  - name: get_customer
    description: Retrieve customer information by ID
    parameters:
      customer_id:
        type: string
        required: true
    endpoint: /api/customers/{customer_id}
```

## Agent Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Conversational** | Dialog-focused | Customer support, Q&A |
| **Task** | Action-focused | Automation, data processing |
| **Specialist** | Domain expert | Code review, legal analysis |
| **Router** | Delegates to other agents | Multi-agent orchestration |

## Best Practices

1. **Clear instructions**: Be explicit about agent behavior
2. **Minimal tools**: Only include necessary tools
3. **Structured output**: Define expected response formats
4. **Error handling**: Guide agent on handling failures
5. **Guardrails**: Set boundaries for sensitive operations

For tool configuration details, see [tools.md](./tools.md).
