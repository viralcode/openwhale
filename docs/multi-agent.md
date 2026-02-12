# Multi-Agent Orchestration

OpenWhale can deploy **multiple AI agents in parallel** to tackle complex tasks faster. It automatically detects when fan-out is beneficial and coordinates agents through shared memory, file locks, and direct messaging.

---

## Fan-Out / Fan-In

Split work across specialized agents that run simultaneously:

```
You: "Research quantum computing and write a Python sorting algorithm"

┌─────────────────────────────────────┐
│         OpenWhale Orchestrator      │
│    Detects 2 independent tasks      │
└──────────┬──────────┬───────────────┘
           │          │
     ┌─────▼──┐  ┌────▼───┐
     │Research│  │ Coder  │    ← Running in parallel
     │ Agent  │  │ Agent  │
     └─────┬──┘  └────┬───┘
           │          │
     ┌─────▼──────────▼───────────────┐
     │    Results synthesized back     │
     │    into a single response       │
     └────────────────────────────────┘
```

The orchestrator (`src/agents/coordinator.ts`) manages task decomposition, agent spawning, progress tracking, and result synthesis.

---

## Auto-Detection

You don't need to explicitly ask for fan-out. The AI automatically detects patterns like:

- *"Do X and also Y"* → Fans out to separate agents
- *"Research A, then code B"* → Parallel researcher + coder
- *"Compare X vs Y"* → Parallel research, then synthesis

The fan-out tool (`src/tools/sessions-fanout-tool.ts`) handles spawning parallel sessions with proper coordination setup.

---

## Shared Context (Inter-Agent Memory)

Agents share data through a **namespaced key-value store** (`src/agents/shared-context.ts`):

- Agent A writes research findings → Agent B reads and builds on them
- All data persists in SQLite across restarts
- Namespace isolation keeps different projects separate

```
┌──────────────┐    shared_context_write    ┌──────────────┐
│  Research    │ ──────────────────────────► │  Shared      │
│  Agent A     │                            │  Context     │
│  (TypeScript)│ ◄────────────────────────── │  Namespace   │
└──────────────┘    shared_context_read      └──────┬───────┘
                                                    │
┌──────────────┐    shared_context_read       ┌─────▼────────┐
│  Research    │ ◄──────────────────────────── │  Shared      │
│  Agent B     │                              │  Context     │
│  (Rust)      │ ──────────────────────────►  │  Namespace   │
└──────────────┘    shared_context_write       └──────────────┘
```

### Tools

| Tool | Description |
|------|-------------|
| `shared_context_write` | Write a key-value pair to a namespace |
| `shared_context_read` | Read a value from a namespace |
| `shared_context_delete` | Remove a key from a namespace |

---

## Active Locks (Conflict Prevention)

Advisory file locks (`src/agents/conflict-resolver.ts`) prevent agents from stepping on each other:

- Lock files before modifying → prevents concurrent write conflicts
- Automatic expiry (configurable TTL)
- Dashboard shows all active locks in real-time

### Tools

| Tool | Description |
|------|-------------|
| `file_lock` | Acquire/release advisory locks on files |
| `conflicts` | View and resolve file conflicts |

---

## Inter-Agent Communication

Agents spawned in a fan-out **can talk to each other** during execution:

| Mechanism | How It Works |
|-----------|--------------|
| **Shared Context** | Agents write findings to a coordination namespace and read what siblings shared |
| **Direct Messaging** | Agents send messages to sibling sessions via `sessions_send` |
| **Session Discovery** | Each agent knows its siblings' session keys and task descriptions |
| **Organic Collaboration** | Agents decide when to communicate; they're not forced to |

### Coordination Tools

| Tool | Source | Description |
|------|--------|-------------|
| `agents_list` | `agents-list-tool.ts` | List all registered agents |
| `sessions_list` | `sessions-list-tool.ts` | List active sessions |
| `sessions_send` | `sessions-send-tool.ts` | Send messages between sessions |
| `sessions_history` | `sessions-history-tool.ts` | View session message history |
| `sessions_fanout` | `sessions-fanout-tool.ts` | Spawn parallel agent sessions |

---

## Coordination Dashboard

Monitor everything from the **Agents → Coordination** panel in the dashboard:

- **Coordinated Tasks** — See all fan-out tasks with COMPLETED/PARTIAL status
- **Shared Contexts** — Browse namespaces and entry counts
- **Active Locks** — View locked files with owner and purpose

---

## A2A Protocol (Agent-to-Agent)

OpenWhale implements the [Google Agent2Agent (A2A) protocol](https://a2a-protocol.org), enabling interoperability with other A2A-compliant agents from frameworks like LangGraph, CrewAI, and AutoGen.

Implementation: `src/agents/a2a-server.ts` and `src/agents/a2a-types.ts`

| Feature | Details |
|---------|--------|
| **Agent Card** | `GET /.well-known/agent.json` — Public discovery of capabilities and skills |
| **JSON-RPC Endpoint** | `POST /a2a` — Send messages, stream responses, manage tasks |
| **Streaming** | Server-Sent Events (SSE) for real-time task updates |
| **Task Lifecycle** | Create, monitor, and cancel tasks via standard A2A methods |
| **Auto-populated Skills** | Agent Card skills are dynamically generated from registered tools |

### Example

```bash
# Discover OpenWhale's capabilities
curl http://localhost:7777/.well-known/agent.json

# Send a task via A2A protocol
curl -X POST http://localhost:7777/a2a \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"SendMessage","params":{"message":{"role":"user","parts":[{"text":"Hello from another agent"}]}}}'
```

---

## Architecture

The multi-agent system lives in `src/agents/`:

| File | Purpose |
|------|---------|
| `coordinator.ts` | Task decomposition, agent spawning, result synthesis |
| `runner.ts` | Individual agent execution loop |
| `shared-context.ts` | Namespaced key-value store for inter-agent data |
| `conflict-resolver.ts` | Advisory file locks and conflict resolution |
| `sessions-tools.ts` | Session listing, messaging, and history tools |
| `subagent-registry.ts` | Registry of spawned sub-agents |
| `a2a-server.ts` | Google A2A protocol server |
| `a2a-types.ts` | A2A protocol type definitions |
| `agent-config.ts` | Agent configuration and capabilities |
| `prompt-builder.ts` | Dynamic prompt construction for agents |
| `router.ts` | Agent routing and dispatch |
