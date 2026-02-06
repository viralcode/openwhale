# How to Build a Workflow

Step-by-step guide to creating workflows in AgenticFlow.

---

## Step 1: Define Input Schema

What data does your workflow need from users?

```json
{
  "input_schema": {
    "title": "User Input",
    "type": "object",
    "required": ["topic"],
    "properties": {
      "topic": {
        "type": "string",
        "title": "Topic",
        "ui_metadata": { 
          "order": 1,
          "type": "short_text",
          "value": "",
          "placeholder": "Enter topic"
        }
      }
    }
  }
}
```

**Common input types:**
- `short_text` - Single line text
- `long_text` - Multi-line text  
- `media_url` - Image/video/audio upload
- `number`, `checkbox`, `select`

---

## Step 2: Find Node Types

Use MCP tools to discover available nodes:

```
# List all available node types
agenticflow_list_node_types()

# Search for what you need
agenticflow_search_node_types(query="image generation")

# Get full details
agenticflow_get_node_type_details(name="generate_image")
```

The response includes `input_schema` showing required fields.

> **Tip**: When two node types have the same functionality, **prefer the one without a required connection**. This simplifies workflow setup and avoids credential management.

---

## Step 2.1: Handle Dynamic Options (Dropdowns)

Some node fields require fetching options dynamically from the API. These are identified by `ui_metadata` with:
- `"type": "dropdown"`
- `"options": null`

**Example field with dynamic options:**

```json
{
  "model": {
    "type": "string",
    "title": "Model",
    "ui_metadata": {
      "type": "dropdown",
      "options": null,
      "order": 1,
      "depends_on": null
    }
  }
}
```

**Fetch options using:**

```
agenticflow_get_dynamic_options(
  node_type_name="claude_ask",
  field_name="model",
  connection_id=null  # or valid UUID if node requires connection
)
```

**Connection ID rules:**
- **No required connection**: Pass `connection_id=null`
- **Required connection**: Must provide a valid `connection_id` (the node type's `connection_type` field indicates this)

**Response example:**

```json
{
  "options": [
    {"label": "Claude 3 Haiku", "value": "claude-3-haiku-20240307"},
    {"label": "Claude 3 Sonnet", "value": "claude-3-sonnet-20240229"},
    {"label": "Claude 3 Opus", "value": "claude-3-opus-20240229"}
  ]
}
```

---

## Step 3: Add Nodes

Create nodes in execution order (top to bottom):

```json
{
  "nodes": {
    "nodes": [
      {
        "name": "ask_ai",
        "title": "Ask AI",
        "node_type_name": "llm",
        "input_config": {
          "human_message": "Write about {{topic}}",
          "system_message": null,
          "chat_history_id": null,
          "model": "agenticflow/gemini-2.0-flash",
          "temperature": 0.5
        },
        "output_mapping": null,
        "connection": null
      },
      {
        "name": "create_image",
        "title": "Create Image", 
        "node_type_name": "generate_image",
        "input_config": {
          "prompt": "Illustration for: {{topic}}"
        },
        "output_mapping": null,
        "connection": null
      }
    ]
  }
}
```

> **Important**: For optional fields in `input_config` (not in `required` array), use `null` as the value - not `""` or `{}`. This ensures proper API handling.

---

## Step 4: Wire Data Flow

Use `{{...}}` syntax to pass data between steps:

| Reference | Usage |
|-----------|-------|
| `{{topic}}` | Workflow input |
| `{{generate_content.result}}` | Previous node output |
| `{{node.field.nested}}` | Nested output field |

---

## Step 5: Define Output

What should the workflow return?

```json
{
  "output_mapping": {
    "content": "{{generate_content.result}}",
    "image": "{{create_image.image_url}}"
  }
}
```

> **Recommendation**: Use `{}` (empty object) by default - returns last node's full output. Only define explicit mapping when you need specific fields.

---

## Step 6: Create or Update via MCP Tool

Use AgenticFlow MCP tools to create or update workflows:

### Create New Workflow

```
agenticflow_create_workflow(
  name="My Workflow",
  description="Does something useful",
  input_schema={...},
  nodes={...},
  output_mapping={}
)
```

### Update Existing Workflow

```
agenticflow_update_workflow(
  workflow_id="workflow-uuid",
  name="Updated Name",
  input_schema={...},
  nodes={...},
  output_mapping={}
)
```

### View in Web UI

After creating or updating, view the workflow at:

```
https://agenticflow.ai/app/workspaces/{workspace_id}/workflows/{workflow_id}/build
```

---

## Quick Checklist

- [ ] Input schema defined with required fields
- [ ] Node types discovered via MCP tools
- [ ] Dynamic options fetched for dropdown fields (`options: null`)
- [ ] Nodes ordered correctly (dependencies first)
- [ ] Connections specified for nodes that need them
- [ ] Data references use correct `{{...}}` syntax
- [ ] Output mapping captures desired results

---

## Related

- [Workflow Overview](./overview.md) - Core concepts
- [How to Run a Workflow](./how-to-run.md) - Execute and manage workflow runs
- [Node Types Reference](./node-types.md) - Node type configurations
- [Connections](./connections.md) - Available connection providers
