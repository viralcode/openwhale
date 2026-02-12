# Security

Production-ready security features built in.

---

## Overview

| Feature | Source | Description |
|---------|--------|-------------|
| **JWT Authentication** | `src/auth/` | Token-based auth with session management |
| **Rate Limiting** | `src/security/rate-limit.ts` | Prevents brute-force and abuse |
| **Audit Logs** | `src/security/audit.ts` | Tracks all actions |
| **Sandboxed Execution** | `src/security/sandbox.ts` | Isolates code execution |
| **Command Filtering** | `src/security/command-filter.ts` | Filters dangerous shell commands |
| **Approval System** | `src/security/approval.ts` | Requires approval for sensitive operations |
| **Mobile Pairing** | `src/security/pairing.ts` | Secure device pairing |

---

## Authentication

JWT-based authentication with session management.

- **Default credentials:** `admin` / `admin` (change after first login!)
- **Session expiry:** 7 days
- **Multi-user support:** Admin can create additional users
- **Password change:** Available in Settings

---

## Rate Limiting

Two rate limiters protect the server:

| Scope | Purpose |
|-------|---------|
| **Auth routes** | Prevents brute-force login attempts |
| **API routes** | Prevents excessive API usage |

---

## Audit Logs

All significant actions are logged for accountability. View audit logs from the dashboard under **Settings → Audit Logs**.

---

## Sandboxed Code Execution

When the AI runs code via the `code_exec` tool, it executes in a sandboxed environment to prevent unintended side effects.

---

## Command Filtering

The command filter (`src/security/command-filter.ts`) inspects shell commands before execution, blocking dangerous operations like:
- Destructive system commands
- Unauthorized file access
- Network operations outside allowed scope

---

## Security Modes

Set via the `SECURITY_MODE` environment variable:

| Mode | Description |
|------|-------------|
| `local` | Relaxed security for local development |
| `strict` | Full security for production deployment |

```bash
# In .env
SECURITY_MODE=local    # Development
SECURITY_MODE=strict   # Production
```

---

## API Key Management

Provider API keys and other credentials are stored securely in the SQLite database. Configure them via the dashboard or `.env` file.
