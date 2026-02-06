# Workforce Overview

**Workforce** systems in AgenticFlow coordinate multiple specialized agents to solve complex tasks collaboratively.

## When to Use Workforce

| Scenario | Single Agent | Workforce |
|----------|--------------|-----------|
| Simple Q&A | ✅ | ❌ |
| Single-domain task | ✅ | ❌ |
| Complex, multi-step tasks | ⚠️ | ✅ |
| Cross-domain expertise | ❌ | ✅ |
| Parallel processing | ❌ | ✅ |
| Quality through consensus | ❌ | ✅ |

## Orchestration Patterns

### 1. Supervisor Pattern

One agent delegates tasks to specialists.

```
         [Supervisor]
        /     |      \
[Coder]  [Writer]  [Analyst]
```

**Config:**
```yaml
workforce:
  pattern: supervisor
  supervisor:
    agent_id: router-agent
    routing_strategy: llm  # or rule-based
  workers:
    - agent_id: coder-agent
      specialization: code generation and review
    - agent_id: writer-agent
      specialization: content creation
    - agent_id: analyst-agent
      specialization: data analysis
```

---

### 2. Swarm Pattern

Agents self-organize and hand off dynamically.

```
[Agent A] ←→ [Agent B] ←→ [Agent C]
    ↑_____________↓
```

**Config:**
```yaml
workforce:
  pattern: swarm
  agents:
    - agent_id: researcher
      can_handoff_to: [analyst, writer]
    - agent_id: analyst
      can_handoff_to: [researcher, reporter]
    - agent_id: writer
      can_handoff_to: [researcher]
  entry_agent: researcher
```

---

### 3. Pipeline Pattern

Sequential handoff between agents.

```
[Intake] → [Process] → [Review] → [Output]
```

**Config:**
```yaml
workforce:
  pattern: pipeline
  stages:
    - agent_id: intake-agent
      output_to: processor-agent
    - agent_id: processor-agent
      output_to: reviewer-agent
    - agent_id: reviewer-agent
      output_to: null  # terminal
```

---

### 4. Debate Pattern

Agents discuss to reach consensus.

```
[Agent A] ─── debate ──→ [Agent B]
     ↓                        ↓
     └──────→ [Judge] ←──────┘
```

**Config:**
```yaml
workforce:
  pattern: debate
  debaters:
    - agent_id: agent-a
      role: advocate
    - agent_id: agent-b
      role: critic
  judge:
    agent_id: judge-agent
  max_rounds: 3
```

---

## Communication Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **Message Passing** | Agents send structured messages | Most common |
| **Shared State** | Common memory/context | Collaborative editing |
| **Event-Driven** | Pub/sub between agents | Loosely coupled systems |

## Best Practices

1. **Clear specializations**: Each agent has distinct expertise
2. **Minimal handoffs**: Reduce communication overhead
3. **Explicit contracts**: Define input/output between agents
4. **Termination conditions**: Prevent infinite loops
5. **Observability**: Log agent interactions for debugging

For pattern implementation details, see [patterns.md](./patterns.md).
