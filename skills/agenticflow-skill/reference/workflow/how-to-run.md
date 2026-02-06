# How to Run a Workflow

Guide to executing workflows and handling results in AgenticFlow.

> **Important**: Workflow execution is always a **2-step process**:
> 1. Start execution with `agenticflow_execute_workflow`
> 2. Poll status with `agenticflow_get_workflow_run`

---

## Step 1: Execute Workflow

Start workflow execution:

```
agenticflow_execute_workflow(
  workflow_id="workflow-uuid",
  input={
    "topic": "AI automation",
    "image_to_url": "https://example.com/image.png"
  }
)
```

---

## Execution Response

A successful run returns:

```json
{
  "id": "workflow-run-uuid",
  "workflow_id": "workflow-uuid",
  "status": "running",
  "input": {
    "topic": "AI automation"
  },
  "output": {
    "content": "Generated text...",
    "image_url": "https://..."
  },
  "state": {
    "nodes_state": [
      {
        "node_name": "generate_content",
        "status": "success",
        "input": { "prompt": "Write about AI automation" },
        "output": { "result": "..." },
        "execution_time": 1200
      }
    ],
    "execution_time": 2500,
    "error": null
  },
  "started_at": "2026-01-16T06:28:46.949Z",
  "completed_at": "2026-01-16T06:28:50.449Z"
}
```

### Key Response Fields

| Field | Description |
|-------|-------------|
| `id` | Workflow run ID (use for status polling) |
| `status` | `created`, `running`, `success`, `failed` |
| `output` | Final workflow output (based on `output_mapping`) |
| `state.nodes_state` | Each node's input, output, status, and timing |
| `state.error` | Error details if `status` is `failed` |

---

## Step 2: Get Execution Status

**Always** poll for status after starting execution:

```
agenticflow_get_workflow_run(workflow_run_id="workflow-run-id")
```

> **Note**: Keep polling until `status` is `success` or `failed`.

---

## Handle Errors

Common error scenarios:

| Error | Cause | Solution |
|-------|-------|----------|
| `missing_input` | Required input not provided | Check `input_schema.required` |
| `invalid_input` | Input doesn't match schema | Validate input types |
| `connection_failed` | API connection issue | Verify credentials |
| `node_error` | Node execution failed | Check node configuration |

### Error Response Example

```json
{
  "status": "failed",
  "error": {
    "node": "generate_image_1",
    "message": "API rate limit exceeded",
    "code": "rate_limit"
  }
}
```

---

## Tips

- **Test with minimal inputs first** - Verify workflow works before complex data
- **Check node outputs** - Each node's output is available for debugging
- **Monitor credit usage** - Each node has a `cost` value

---

## View Run in Web UI

View workflow run details at:

```
https://agenticflow.ai/app/workspaces/{workspace_id}/workflows/{workflow_id}/logs/{workflow_run_id}
```

---

## Related

- [How to Build](./how-to-build.md) - Create workflows
- [Workflow Overview](./overview.md) - Core concepts
- [Node Types Reference](./node-types.md) - Node type configurations
- [Connections](./connections.md) - Available connection providers
