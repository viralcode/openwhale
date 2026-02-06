# Agent Tools Reference

Tools extend agent capabilities by allowing them to interact with external systems.

## Tool Definition Schema

```yaml
tool:
  name: string           # Unique identifier (snake_case)
  description: string    # What the tool does (for LLM understanding)
  parameters:            # Input parameters
    param_name:
      type: string | number | boolean | array | object
      description: string
      required: boolean
      default: any
      enum: [values]     # Optional: restrict to specific values
  returns:               # Output format
    type: string
    description: string
```

---

## Built-in Tools

### web_search

Search the internet for information.

```yaml
name: web_search
parameters:
  query:
    type: string
    description: Search query
    required: true
  max_results:
    type: number
    default: 5
```

### code_executor

Execute code in a sandboxed environment.

```yaml
name: code_executor
parameters:
  language:
    type: string
    enum: [python, javascript, bash]
    required: true
  code:
    type: string
    required: true
  timeout:
    type: number
    default: 30
```

### file_operations

Read, write, or manipulate files.

```yaml
name: file_operations
parameters:
  operation:
    type: string
    enum: [read, write, list, delete]
    required: true
  path:
    type: string
    required: true
  content:
    type: string
    description: Required for write operation
```

### http_request

Make HTTP requests to external APIs.

```yaml
name: http_request
parameters:
  method:
    type: string
    enum: [GET, POST, PUT, DELETE]
    required: true
  url:
    type: string
    required: true
  headers:
    type: object
    default: {}
  body:
    type: object
```

---

## Custom Tool Creation

### MCP Tools (via Model Context Protocol)

Connect to MCP servers for standardized tool access:

```yaml
mcp_tools:
  - server: postgres-mcp
    tools: [query, insert, update]
  - server: github-mcp
    tools: [create_issue, list_prs, merge_pr]
```

### API-based Tools

Wrap REST APIs as tools:

```yaml
custom_tools:
  - name: get_weather
    description: Get current weather for a location
    api:
      method: GET
      url: "https://api.weather.com/v1/current"
      params:
        location: "{{ parameters.city }}"
      headers:
        API-Key: "{{ env.WEATHER_API_KEY }}"
    parameters:
      city:
        type: string
        required: true
```

### Function Tools

Define inline functions:

```yaml
custom_tools:
  - name: calculate_discount
    description: Calculate discount price
    function: |
      def calculate_discount(price, percent):
          return price * (1 - percent / 100)
    parameters:
      price:
        type: number
        required: true
      percent:
        type: number
        required: true
```

---

## Tool Best Practices

1. **Clear descriptions**: Help LLM understand when to use
2. **Minimal parameters**: Only what's necessary
3. **Sensible defaults**: Reduce required inputs
4. **Structured returns**: Consistent output format
5. **Error messages**: Actionable guidance on failure
