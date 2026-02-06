# Workflow Overview

A **Workflow** in AgenticFlow is a linear, sequential automation pipeline that executes nodes step-by-step from top to bottom.

## Core Concepts

Every workflow consists of three main components:

| Component | Description | Schema Field |
|-----------|-------------|--------------|
| **Input Schema** | Parameters users provide when starting the workflow | `input_schema` |
| **Nodes** | Sequential processing steps that execute tasks | `nodes` |
| **Output Mapping** | Which node outputs to return as final results | `output_mapping` |

## Execution Model

- **Linear execution**: Nodes run one-by-one, top to bottom
- **No branching**: Every node executes every time
- **No loops**: Nodes run exactly once in sequence
- **Forward data flow**: Later nodes can reference earlier nodes' outputs

---

## Input Schema

Defines what data the workflow needs before execution.

### Supported Input Types

| Type | UI Type | Use Case |
|------|---------|----------|
| **Text** | `short_text` | Single-line text input |
| **Long Text** | `long_text` | Multi-line text input |
| **Number** | `number` | Numeric values |
| **Checkbox** | `checkbox` | Boolean true/false |
| **Select** | `select` | Dropdown single-select |
| **Multi-Select** | `multi_select` | Dropdown multi-select |
| **Image Upload** | `media_url` | Image file upload |
| **Video Upload** | `media_url` | Video file upload |
| **Audio Upload** | `media_url` | Audio file upload |
| **File to URL** | `file_url` | Any file upload |

### Input Schema Example

```json
{
  "input_schema": {
    "type": "object",
    "title": "User inputs",
    "description": "User inputs for the workflow",
    "required": ["image_to_url", "name", "description"],
    "properties": {
      "image_to_url": {
        "type": "string",
        "title": "Reference Image",
        "description": "",
        "ui_metadata": {
          "type": "media_url",
          "media_type": "image",
          "order": 0,
          "placeholder": "",
          "value": "",
          "allowed_mime_types": ["image/jpeg", "image/png", "image/gif"],
          "max_size": 26214400
        }
      },
      "name": {
        "type": "string",
        "title": "Workflow Name",
        "description": "",
        "ui_metadata": {
          "type": "short_text",
          "order": 1,
          "value": "",
          "placeholder": "Enter name..."
        }
      },
      "description": {
        "type": "string",
        "title": "Description",
        "description": "",
        "ui_metadata": {
          "type": "short_text",
          "order": 2,
          "value": "",
          "placeholder": "Enter description..."
        }
      }
    }
  }
}
```

### Input Field Properties

| Field | Description |
|-------|-------------|
| `type` | Data type: `string`, `number`, `boolean`, `array` |
| `title` | Display label in UI |
| `description` | Help text (optional) |
| `ui_metadata.type` | UI input type (see Supported Input Types) |
| `ui_metadata.order` | Display order (0, 1, 2...) |
| `ui_metadata.value` | Default value |
| `ui_metadata.placeholder` | Placeholder text |

### Media URL Options

For `media_url` type inputs:

| Field | Description |
|-------|-------------|
| `media_type` | `image`, `video`, or `audio` |
| `allowed_mime_types` | Array of allowed MIME types |
| `max_size` | Max file size in bytes (default: 26214400 = 25MB) |

---

## Nodes

Nodes are the building blocks that perform actions in a workflow. Each node is created from a **node_type** selected from the available node types list.

### Node Structure

Each node in the `nodes` array has:

```json
{
  "name": "unique_node_name",
  "title": "Human-readable Title",
  "description": "What this node does",
  "node_type_name": "selected_node_type",  // From node_type list
  "input_config": {
    // Configuration based on node_type's input schema
  },
  "connection": "{{__app_connections__['connection-id']}}",
  "output_mapping": null
}
```

### How Nodes Work

1. **Select a node_type** from the available list (e.g., `claude_ask`, `generate_image`)
2. **Configure input_config** based on that node_type's required fields
3. **Connect to services** if the node_type requires external API access
4. **Reference data** from inputs or previous nodes using `{{...}}` syntax

### Node Type Categories

Node types are organized by category:

| Category | Description | Example node_types |
|----------|-------------|-------------------|
| **AI/LLM** | AI model calls, text generation | `claude_ask`, `openai_chat`, `gemini` |
| **Image Generation** | Create images from prompts | `generate_image`, `dall_e` |
| **Data Processing** | Transform and manipulate data | `json_parse`, `text_transform` |
| **Integrations** | Connect to external services (300+ MCPs) | `slack_send`, `gmail`, `notion` |
| **API Calls** | HTTP requests, webhooks | `http_request`, `webhook` |
| **File Operations** | Upload, download, process files | `file_upload`, `pdf_parse` |

> **Note**: For the complete list of available node_types and their configurations, see [Node Types Reference](./node-types.md)

### Example: LLM Node

```json
{
  "name": "claude_ask",
  "title": "Ask Claude",
  "node_type_name": "claude_ask",
  "input_config": {
    "model": "claude-3-haiku-20240307",
    "prompt": "Generate a description for {{name}}: {{description}}",
    "max_tokens": 1000,
    "temperature": 0.5,
    "system_message": "You are a helpful assistant."
  },
  "connection": "{{__app_connections__['connection-id']}}"
}
```

### Example: Image Generation Node

```json
{
  "name": "generate_image_1",
  "title": "Generate Image",
  "node_type_name": "generate_image",
  "input_config": {
    "prompt": "Generate thumbnail for {{name}} in purple theme like {{image_to_url}}",
    "provider": "Nano Banana Pro",
    "aspect_ratio": "9:16 (1K)",
    "negative_prompt": "NSFW"
  },
  "connection": "{{__app_connections__['connection-id']}}"
}
```

---

## Parameter Substitution

Use `{{...}}` syntax to reference data between workflow steps.

### Reference Types

| Syntax | Description | Example |
|--------|-------------|---------|
| `{{input_name}}` | Reference workflow input | `{{name}}`, `{{description}}` |
| `{{node_name.field}}` | Reference node output field | `{{claude_ask.result}}` |
| `{{node_name}}` | Reference entire node output | `{{generate_image_1}}` |

### Usage in Prompts

```
"prompt": "Generate a description for my workflow about {{name}} which works like this: {{description}}"
```

### Nested Field Access

```
{{api_response.data.items[0].title}}
```

---

## Output Mapping

Controls what the workflow returns after execution.

### When Defined

```json
{
  "output_mapping": {
    "description": "{{claude_ask.result}}",
    "thumbnail": "{{generate_image_1.image_url}}"
  }
}
```

### When Empty

If `output_mapping` is empty `{}`, the workflow returns all outputs from the last node.

---

## Connections

Nodes that require external services use connections:

```json
"connection": "{{__app_connections__['connection-uuid']}}"
```

> For available connection providers, see [connections.md](./connections.md)

---

## Workflow Metadata

Additional workflow properties:

| Field | Description |
|-------|-------------|
| `id` | Unique workflow identifier |
| `name` | Display name |
| `description` | Workflow description |
| `public_runnable` | Can others run this workflow |
| `public_clone` | Can others clone this workflow |
| `num_runs` | Total execution count |
| `num_views` | Total view count |

---

## Complete Workflow Example

```json
{
  "name": "Marketplace Asset Generator",
  "input_schema": {
    "type": "object",
    "required": ["name", "description", "image_to_url"],
    "properties": {
      "name": { "type": "string", "ui_metadata": { "type": "short_text" } },
      "description": { "type": "string", "ui_metadata": { "type": "short_text" } },
      "image_to_url": { "type": "string", "ui_metadata": { "type": "media_url" } }
    }
  },
  "nodes": {
    "nodes": [
      {
        "name": "claude_ask",
        "node_type_name": "claude_ask",
        "input_config": {
          "prompt": "Generate description for {{name}}: {{description}}"
        }
      },
      {
        "name": "generate_image_1",
        "node_type_name": "generate_image",
        "input_config": {
          "prompt": "Generate thumbnail for {{name}} workflow"
        }
      }
    ]
  },
  "output_mapping": {}
}
```

---

## Web UI URLs

| Page | URL Pattern |
|------|-------------|
| Workflow List | `https://agenticflow.ai/app/workspaces/{workspace_id}/workflows` |
| Workflow Details | `https://agenticflow.ai/app/workspaces/{workspace_id}/workflows/{workflow_id}/build` |
| Workflow Run Details | `https://agenticflow.ai/app/workspaces/{workspace_id}/workflows/{workflow_id}/logs/{workflow_run_id}` |

---

## Related Documentation

- [How to Build a Workflow](./how-to-build.md) - Step-by-step guide to creating workflows
- [How to Run a Workflow](./how-to-run.md) - Execute and manage workflow runs
- [Node Types Reference](./node-types.md) - Detailed node type configurations
- [Connections](./connections.md) - Available connection providers
