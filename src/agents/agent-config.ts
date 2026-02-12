/**
 * Agent Configuration - Types, DB operations, and resolution
 * 
 * Manages named agent definitions with per-agent settings
 * (model, workspace, system prompt, capabilities, subagent policies).
 */

import { db } from "../db/index.js";

// ============== TYPES ==============

export interface AgentConfig {
    id: string;
    name: string;
    description?: string;
    model?: string;
    systemPrompt?: string;
    workspace?: string;
    capabilities?: string[];
    isDefault?: boolean;
    enabled: boolean;
    allowAgents?: string[];  // Which agents this one can spawn
    createdAt?: string;
    updatedAt?: string;
}

// ============== DB INIT ==============

let tableReady = false;

function ensureTable(): void {
    if (tableReady) return;
    tableReady = true;
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS agent_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                model TEXT,
                system_prompt TEXT,
                workspace TEXT,
                capabilities TEXT,
                is_default INTEGER DEFAULT 0,
                enabled INTEGER DEFAULT 1,
                allow_agents TEXT,
                created_at INTEGER DEFAULT (unixepoch()),
                updated_at INTEGER DEFAULT (unixepoch())
            )
        `);

        // Ensure default "main" agent exists
        const existing = db.prepare("SELECT id FROM agent_configs WHERE id = 'main'").get();
        if (!existing) {
            db.prepare(`
                INSERT INTO agent_configs (id, name, description, is_default, enabled, capabilities)
                VALUES ('main', 'OpenWhale', 'Default general-purpose AI assistant', 1, 1, '["general","code","tools"]')
            `).run();
        }
    } catch (e) {
        console.warn("[AgentConfig] Failed to init table:", e);
    }
}

// ============== CRUD ==============

export function listAgentConfigs(): AgentConfig[] {
    ensureTable();
    try {
        const rows = db.prepare(
            "SELECT * FROM agent_configs ORDER BY is_default DESC, name ASC"
        ).all() as any[];

        return rows.map(rowToConfig);
    } catch {
        return [defaultAgent()];
    }
}

export function getAgentConfig(id: string): AgentConfig | undefined {
    ensureTable();
    try {
        const row = db.prepare("SELECT * FROM agent_configs WHERE id = ?").get(id) as any;
        return row ? rowToConfig(row) : undefined;
    } catch {
        return id === "main" ? defaultAgent() : undefined;
    }
}

export function getDefaultAgent(): AgentConfig {
    ensureTable();
    try {
        const row = db.prepare(
            "SELECT * FROM agent_configs WHERE is_default = 1 LIMIT 1"
        ).get() as any;
        return row ? rowToConfig(row) : defaultAgent();
    } catch {
        return defaultAgent();
    }
}

export function saveAgentConfig(config: AgentConfig): void {
    ensureTable();
    const now = Math.floor(Date.now() / 1000);

    // If setting as default, unset others
    if (config.isDefault) {
        db.prepare("UPDATE agent_configs SET is_default = 0").run();
    }

    db.prepare(`
        INSERT INTO agent_configs (id, name, description, model, system_prompt, workspace, capabilities, is_default, enabled, allow_agents, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            model = excluded.model,
            system_prompt = excluded.system_prompt,
            workspace = excluded.workspace,
            capabilities = excluded.capabilities,
            is_default = excluded.is_default,
            enabled = excluded.enabled,
            allow_agents = excluded.allow_agents,
            updated_at = excluded.updated_at
    `).run(
        config.id,
        config.name,
        config.description || null,
        config.model || null,
        config.systemPrompt || null,
        config.workspace || null,
        config.capabilities ? JSON.stringify(config.capabilities) : null,
        config.isDefault ? 1 : 0,
        config.enabled ? 1 : 0,
        config.allowAgents ? JSON.stringify(config.allowAgents) : null,
        now,
        now
    );
}

export function deleteAgentConfig(id: string): boolean {
    ensureTable();
    if (id === "main") return false; // Can't delete default
    const result = db.prepare("DELETE FROM agent_configs WHERE id = ? AND is_default = 0").run(id);
    return result.changes > 0;
}

// ============== HELPERS ==============

function rowToConfig(row: any): AgentConfig {
    return {
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        model: row.model || undefined,
        systemPrompt: row.system_prompt || undefined,
        workspace: row.workspace || undefined,
        capabilities: row.capabilities ? JSON.parse(row.capabilities) : undefined,
        isDefault: !!row.is_default,
        enabled: !!row.enabled,
        allowAgents: row.allow_agents ? JSON.parse(row.allow_agents) : undefined,
        createdAt: row.created_at ? new Date(row.created_at * 1000).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at * 1000).toISOString() : undefined,
    };
}

function defaultAgent(): AgentConfig {
    return {
        id: "main",
        name: "OpenWhale",
        description: "Default general-purpose AI assistant",
        isDefault: true,
        enabled: true,
        capabilities: ["general", "code", "tools"],
    };
}

/**
 * Check if a given agent is allowed to spawn a target agent
 */
export function canAgentSpawn(sourceAgentId: string, targetAgentId: string): boolean {
    const source = getAgentConfig(sourceAgentId);
    if (!source) return false;

    // No allowlist = can only spawn self
    if (!source.allowAgents || source.allowAgents.length === 0) {
        return sourceAgentId === targetAgentId;
    }

    // Wildcard = can spawn any
    if (source.allowAgents.includes("*")) return true;

    return source.allowAgents.includes(targetAgentId);
}
