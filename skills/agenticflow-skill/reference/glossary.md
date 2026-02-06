# AgenticFlow Glossary

Common terminology used in AgenticFlow.

---

## Core Concepts

| Term | Definition |
|------|------------|
| **Agent** | An AI entity that can reason, use tools, and accomplish tasks autonomously |
| **Workflow** | A linear, sequential automation pipeline that executes nodes step-by-step from top to bottom |
| **Node** | A single unit of work in a workflow (e.g., LLM call, API request, image generation) |
| **Node Type** | A reusable template defining a node's inputs, outputs, and required connections |
| **Tool** | A function an agent can invoke to interact with external systems |

---

## Workflow Terms

| Term | Definition |
|------|------------|
| **input_schema** | JSON Schema defining what data the workflow needs from users before execution |
| **output_mapping** | Configuration specifying which node outputs to return as workflow results |
| **Connection** | Stored credentials (API keys, OAuth tokens) for external services |
| **Execution** | A single run of a workflow from first node to last |
| **Expression** | Template syntax for dynamic values: `{{variable}}` or `{{node_name.field}}` |
| **input_config** | Configuration values passed to a node, based on its node_type's input_schema |

---

## Agent Terms

| Term | Definition |
|------|------------|
| **System Prompt** | Instructions that define agent behavior and persona |
| **Memory** | Context management for conversation history |
| **Iteration** | One cycle of agent reasoning (think → act → observe) |
| **Guardrails** | Constraints that limit agent actions for safety |
| **Handoff** | Transfer of control from one agent to another |

---

## Workforce Terms

| Term | Definition |
|------|------------|
| **Orchestration** | Coordination of multiple agents to complete a task |
| **Supervisor** | Agent that delegates tasks to worker agents |
| **Worker** | Specialist agent that handles specific task types |
| **Swarm** | Pattern where agents self-organize dynamically |
| **Pipeline** | Sequential chain of agent processing stages |
| **Consensus** | Agreement reached through agent collaboration |

---

## Integration Terms

| Term | Definition |
|------|------------|
| **MCP** | Model Context Protocol - standard for LLM tool integration |
| **Connection Provider** | A service category (e.g., `openai`, `claude`, `replicate`) that connections belong to |
| **Webhook** | HTTP callback triggered by external events |
| **API** | Application Programming Interface for external services |
| **Embedding** | Vector representation of text for semantic operations |
| **RAG** | Retrieval-Augmented Generation - enhancing LLM with external knowledge |

---

## Execution Terms

| Term | Definition |
|------|------------|
| **Workflow Run** | Single execution of a workflow with specific inputs |
| **Run Status** | State of execution: `created`, `running`, `success`, `failed` |
| **nodes_state** | Detailed status, input, and output of each node in a run |
| **Trace** | Log of all operations during an execution |
| **Token** | Unit of text processed by language models |
