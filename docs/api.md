# API Reference

OpenWhale exposes an OpenAI-compatible REST API, so you can plug it into existing tools.

---

## Base URL

```
http://localhost:7777
```

---

## Authentication

All API routes (except `/health` and `/auth/*`) require a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:7777/api/...
```

Get a token by logging in via the `/auth/login` endpoint.

---

## Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check — returns status, version, timestamp |
| `POST` | `/auth/register` | Create a new account |
| `POST` | `/auth/login` | Authenticate and get access token |
| `GET` | `/.well-known/agent.json` | A2A Agent Card discovery |

### Protected (Requires Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/agent/chat/completions` | Chat completion with tool support |
| `GET` | `/api/providers` | List configured AI providers |
| `*` | `/api/admin/*` | Admin operations (users, system) |

### OpenAI-Compatible

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat endpoint (proxies to agent routes) |

### A2A Protocol

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/a2a` | JSON-RPC endpoint for Agent-to-Agent protocol |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard` | Web dashboard UI |

---

## Example: Chat Completion

```bash
curl -X POST http://localhost:7777/api/agent/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
```

---

## Rate Limiting

- **Auth routes** (`/auth/*`) — Rate limited to prevent brute-force attacks
- **API routes** (`/api/*`) — Rate limited to prevent abuse

Implementation: `src/security/rate-limit.ts`

---

## Architecture

Routes are implemented in `src/gateway/routes/`:

| File | Routes |
|------|--------|
| `auth.ts` | `/auth/register`, `/auth/login` |
| `agent.ts` | `/api/agent/chat/completions` and chat-related endpoints |
| `providers.ts` | `/api/providers` |
| `admin.ts` | `/api/admin/*` |
| `a2a.ts` | `/a2a` and `/.well-known/agent.json` |

The server is built on [Hono](https://hono.dev/) with middleware for CORS, secure headers, logging, and authentication.
