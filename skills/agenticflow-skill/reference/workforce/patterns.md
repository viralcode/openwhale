# Workforce Patterns

Detailed implementation guide for workforce orchestration patterns.

---

## Supervisor Pattern

### Architecture

The supervisor receives tasks and delegates to the most appropriate worker agent.

```yaml
system:
  name: "Support Desk"
  pattern: supervisor
  
supervisor:
  id: "support-router"
  model: claude-3-sonnet
  prompt: |
    You are a support desk router.
    Analyze incoming requests and route to the appropriate specialist.
    Available specialists: billing, technical, general
  routing:
    strategy: llm  # or rule_based, keyword
    
workers:
  - id: "billing-specialist"
    trigger_keywords: [invoice, payment, refund, subscription]
    prompt: "You handle billing and payment inquiries."
    
  - id: "technical-specialist"
    trigger_keywords: [bug, error, crash, integration]
    prompt: "You handle technical issues and troubleshooting."
    
  - id: "general-specialist"
    trigger_keywords: []  # fallback
    prompt: "You handle general inquiries."
```

### Execution Flow

1. User message → Supervisor
2. Supervisor analyzes and selects worker
3. Worker processes and responds
4. Response → User (or back to Supervisor for review)

---

## Swarm Pattern

### Architecture

Agents dynamically hand off to each other based on context.

```yaml
system:
  name: "Research Swarm"
  pattern: swarm
  
agents:
  - id: "researcher"
    prompt: "You gather and compile information."
    handoff_triggers:
      - condition: "needs data analysis"
        target: "analyst"
      - condition: "ready to write report"
        target: "writer"
        
  - id: "analyst"
    prompt: "You analyze data and extract insights."
    handoff_triggers:
      - condition: "analysis complete"
        target: "writer"
      - condition: "need more data"
        target: "researcher"
        
  - id: "writer"
    prompt: "You create polished reports and summaries."
    handoff_triggers:
      - condition: "need fact check"
        target: "researcher"
      - condition: "report complete"
        target: null  # terminate

entry_point: "researcher"
max_handoffs: 10
```

### Handoff Protocol

```yaml
handoff:
  from: researcher
  to: analyst
  context:
    summary: "Gathered data on Q4 sales"
    artifacts: [sales_data.csv]
    pending_questions: ["Compare to Q3?"]
```

---

## Pipeline Pattern

### Architecture

Linear sequence of processing stages.

```yaml
system:
  name: "Content Pipeline"
  pattern: pipeline
  
stages:
  - stage: 1
    id: "extractor"
    prompt: "Extract key information from raw input."
    output_schema:
      type: object
      properties:
        entities: { type: array }
        summary: { type: string }
        
  - stage: 2
    id: "enricher"
    prompt: "Enrich extracted data with additional context."
    input_from: extractor
    output_schema:
      type: object
      properties:
        enriched_entities: { type: array }
        
  - stage: 3
    id: "formatter"
    prompt: "Format the enriched data for final output."
    input_from: enricher
    output_format: markdown
```

### Stage Contract

Each stage defines clear input/output schemas:

```yaml
stage:
  id: "validator"
  expects:
    type: object
    required: [content, metadata]
  returns:
    type: object
    properties:
      is_valid: { type: boolean }
      errors: { type: array }
```

---

## Debate Pattern

### Architecture

Multiple agents argue different perspectives; judge decides.

```yaml
system:
  name: "Decision Debate"
  pattern: debate
  
config:
  max_rounds: 3
  consensus_threshold: 0.8
  
debaters:
  - id: "proponent"
    stance: "in favor"
    prompt: "Argue for the proposed solution. Be persuasive."
    
  - id: "critic"
    stance: "against"
    prompt: "Challenge the proposal. Identify weaknesses."
    
judge:
  id: "arbiter"
  prompt: |
    Evaluate both arguments objectively.
    Score each on: logic, evidence, feasibility.
    Decide the winner or request another round.
  decision_schema:
    winner: { type: string, enum: [proponent, critic, tie] }
    reasoning: { type: string }
    final: { type: boolean }
```

### Round Structure

```yaml
round:
  number: 1
  proponent_argument: "..."
  critic_rebuttal: "..."
  judge_evaluation:
    proponent_score: 7
    critic_score: 6
    notes: "Proponent made stronger case for feasibility"
    continue: true
```

---

## Choosing a Pattern

| Pattern | Best For | Complexity |
|---------|----------|------------|
| **Supervisor** | Task routing, support desks | Low |
| **Swarm** | Creative collaboration, exploration | Medium |
| **Pipeline** | Structured processing, ETL | Low |
| **Debate** | Decision making, quality assurance | Medium |
