# Node Types Reference

A **NodeType** defines a reusable action template that can be added to workflows. Each node_type specifies its inputs, outputs, and required connections.

## Discovering Node Types

Use the **agenticflow-mcp** tools to discover and inspect node types:

| MCP Tool | Description |
|----------|-------------|
| `agenticflow_list_node_types` | List all available node types |
| `agenticflow_get_node_type_details` | Get full details of a specific node type |
| `agenticflow_search_node_types` | Search node types by keyword |

### Example Usage

```
# List all node types
agenticflow_list_node_types()

# Get details for a specific node type
agenticflow_get_node_type_details(name="openai_ask_assistant")

# Search for image-related nodes
agenticflow_search_node_types(query="image generation")
```

---

## Node Type Schema

```json
{
  "id": "unique_identifier",
  "name": "node_type_name",
  "title": "Human-readable Title",
  "description": "What this node type does",
  "categories": ["category1", "category2"],
  "scope": "public",
  "connection": {
    "name": "Connection Name",
    "description": "Connection description",
    "required": true,
    "connection_category": "service_name"
  },
  "cost": 4,
  "pml_cost": 0.01,
  "input_schema": { /* JSON Schema for inputs */ },
  "output_schema": { /* JSON Schema for outputs */ }
}
```

## Schema Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the node type |
| `name` | string | Node type name (used in `node_type_name`) |
| `title` | string | Display title in UI |
| `description` | string | What this node does |
| `categories` | array | Categories for filtering (e.g., `popular`, `ai`) |
| `scope` | string | Visibility: `public` or `private` |
| `connection` | object | Required service connection |
| `cost` | number | Credit cost per execution |
| `pml_cost` | number | PML token cost |
| `input_schema` | object | JSON Schema defining required inputs |
| `output_schema` | object | JSON Schema defining output structure |

---

## Connection Object

Nodes that interact with external services require a connection:

```json
{
  "connection": {
    "name": "OpenAI Connection",
    "description": "The OpenAI connection to use for the assistant.",
    "required": true,
    "connection_category": "openai"
  }
}
```

| Field | Description |
|-------|-------------|
| `name` | Display name for the connection |
| `description` | What this connection is used for |
| `required` | Whether connection is mandatory |
| `connection_category` | Service type (e.g., `openai`, `anthropic`, `google`) |

---

## Input Schema

Defines the inputs required by the node type using JSON Schema format.

### Input Field Structure

```json
{
  "input_schema": {
    "type": "object",
    "title": "InputSchemaName",
    "description": "Description of inputs",
    "required": ["field1", "field2"],
    "properties": {
      "field_name": {
        "type": "string",
        "title": "Display Title",
        "description": "Field description",
        "default": null,
        "ui_metadata": {
          "type": "dropdown",
          "order": 0,
          "options": null
        }
      }
    }
  }
}
```

### UI Metadata Types

| UI Type | Description | Use Case |
|---------|-------------|----------|
| `dropdown` | Dropdown select | Model selection, enum values |
| `short_text` | Single-line input | Names, identifiers |
| `long_text` | Multi-line input | Prompts, descriptions |
| `number` | Numeric input | Temperature, max_tokens |
| `checkbox` | Boolean toggle | Enable/disable features |
| `media` | File upload | Images, documents |
| `password` | Hidden input | API keys, secrets |

### Optional Fields with anyOf

```json
{
  "memory_key": {
    "anyOf": [
      { "type": "string" },
      { "type": "null" }
    ],
    "default": null,
    "description": "Optional memory key for chat history",
    "title": "Memory Key"
  }
}
```

---

## Output Schema

Defines the structure of data returned by the node.

### Output Schema Example

```json
{
  "output_schema": {
    "type": "object",
    "title": "ResponseName",
    "description": "Response description",
    "required": ["messages"],
    "properties": {
      "messages": {
        "type": "array",
        "title": "Messages",
        "items": {
          "$ref": "#/$defs/MessageType"
        }
      }
    },
    "$defs": {
      "MessageType": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "role": { "type": "string" },
          "content": { "type": "array" }
        }
      }
    }
  }
}
```

---

## Complete Node Type Example

```json
{
  "id": "openai_ask_assistant",
  "name": "openai_ask_assistant",
  "title": "Ask Assistant",
  "description": "Ask a GPT assistant anything you want!",
  "scope": "public",
  "categories": ["popular"],
  "connection": {
    "name": "OpenAI Connection",
    "description": "The OpenAI connection to use for the assistant.",
    "required": true,
    "connection_category": "openai"
  },
  "cost": 4,
  "pml_cost": 0.01,
  "input_schema": {
    "type": "object",
    "title": "AskAssistantInput",
    "required": ["assistant", "prompt"],
    "properties": {
      "assistant": {
        "type": "string",
        "title": "Assistant",
        "description": "The assistant which will generate the completion.",
        "ui_metadata": { "type": "dropdown", "order": 0 }
      },
      "prompt": {
        "type": "string",
        "title": "Question",
        "description": "The text prompt to ask the assistant."
      },
      "memory_key": {
        "anyOf": [{ "type": "string" }, { "type": "null" }],
        "default": null,
        "title": "Memory Key",
        "description": "Keep chat history shared across runs."
      }
    }
  },
  "output_schema": {
    "type": "object",
    "title": "AskAssistantResponse",
    "required": ["messages"],
    "properties": {
      "messages": {
        "type": "array",
        "title": "Messages",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "role": { "type": "string" },
            "content": { "type": "array" },
            "created_at": { "type": "integer" }
          }
        }
      }
    }
  }
}
```

---

## Using Node Types in Workflows

When adding a node to a workflow, reference the node_type by its `name`:

```json
{
  "name": "ask_gpt",
  "title": "Ask GPT Assistant",
  "node_type_name": "openai_ask_assistant",
  "input_config": {
    "assistant": "asst_abc123",
    "prompt": "{{user_question}}",
    "memory_key": "chat_session_1"
  },
  "connection": "{{__app_connections__['openai-connection-id']}}"
}
```

### Referencing Outputs

Access node outputs using the output_schema structure:

```
{{ask_gpt.messages}}           // Full messages array
{{ask_gpt.messages[0].content}} // First message content
```

---

## Node Type Categories

| Category | Description |
|----------|-------------|
| `popular` | Most used node types |
| `ai` | AI/LLM related nodes |
| `image` | Image generation/processing |
| `data` | Data transformation |
| `integration` | External service connections |
| `utility` | Helper functions |
