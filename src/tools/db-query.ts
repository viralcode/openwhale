import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { stat } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const DbQueryActionSchema = z.object({
    action: z.enum(["query", "tables", "schema", "databases"]).describe("Database action"),
    dbType: z.enum(["sqlite", "postgres"]).describe("Database type"),
    // For SQLite
    dbPath: z.string().optional().describe("Path to SQLite database file"),
    // For Postgres
    connectionString: z.string().optional().describe("Postgres connection string (postgresql://user:pass@host:port/db)"),
    // For query
    sql: z.string().optional().describe("SQL query to execute"),
    allowWrite: z.boolean().optional().default(false).describe("Allow write operations (INSERT, UPDATE, DELETE, etc.)"),
    // For tables/schema
    tableName: z.string().optional().describe("Table name for schema action"),
});

type DbQueryAction = z.infer<typeof DbQueryActionSchema>;

export const dbQueryTool: AgentTool<DbQueryAction> = {
    name: "db_query",
    description: "Query SQLite or PostgreSQL databases. Supports running SQL, listing tables, and inspecting schemas. Read-only by default.",
    category: "utility",
    parameters: DbQueryActionSchema,

    async execute(params: DbQueryAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            if (params.dbType === "sqlite") {
                return await handleSQLite(params);
            } else if (params.dbType === "postgres") {
                return await handlePostgres(params);
            }
            return { success: false, content: "", error: `Unsupported database type: ${params.dbType}` };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Database error: ${message}` };
        }
    },
};

async function handleSQLite(params: DbQueryAction): Promise<ToolResult> {
    if (!params.dbPath) {
        return { success: false, content: "", error: "dbPath is required for SQLite" };
    }

    // Verify file exists
    try {
        await stat(params.dbPath);
    } catch {
        return { success: false, content: "", error: `Database file not found: ${params.dbPath}` };
    }

    switch (params.action) {
        case "tables": {
            const { stdout } = await execAsync(`sqlite3 "${params.dbPath}" ".tables"`);
            const tables = stdout.trim().split(/\s+/).filter(Boolean);
            return {
                success: true,
                content: `**Tables** (${tables.length}):\n${tables.map(t => `• ${t}`).join("\n")}`,
                metadata: { tables, count: tables.length },
            };
        }

        case "schema": {
            const table = params.tableName;
            const cmd = table
                ? `sqlite3 "${params.dbPath}" ".schema ${table}"`
                : `sqlite3 "${params.dbPath}" ".schema"`;
            const { stdout } = await execAsync(cmd);
            return {
                success: true,
                content: `**Schema${table ? ` for ${table}` : ""}**\n\`\`\`sql\n${stdout.trim()}\n\`\`\``,
            };
        }

        case "query": {
            if (!params.sql) {
                return { success: false, content: "", error: "sql is required" };
            }

            // Safety check for write operations
            const sqlUpper = params.sql.trim().toUpperCase();
            const isWrite = ["INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE", "TRUNCATE"].some(kw => sqlUpper.startsWith(kw));
            if (isWrite && !params.allowWrite) {
                return {
                    success: false,
                    content: "",
                    error: "Write operations are disabled by default. Set allowWrite: true to enable.",
                };
            }

            const { stdout } = await execAsync(`sqlite3 -json "${params.dbPath}" "${params.sql.replace(/"/g, '\\"')}"`);
            let data: any[];
            try {
                data = JSON.parse(stdout);
            } catch {
                // Non-JSON output (e.g., write operations)
                return { success: true, content: stdout.trim() || "Query executed successfully" };
            }

            return {
                success: true,
                content: `**Results** (${data.length} rows):\n${JSON.stringify(data.slice(0, 100), null, 2)}`,
                metadata: { rowCount: data.length },
            };
        }

        case "databases": {
            return { success: true, content: `SQLite database: ${params.dbPath}` };
        }

        default:
            return { success: false, content: "", error: `Unknown action: ${params.action}` };
    }
}

async function handlePostgres(params: DbQueryAction): Promise<ToolResult> {
    if (!params.connectionString) {
        return { success: false, content: "", error: "connectionString is required for Postgres" };
    }

    const connStr = params.connectionString;
    const escapedConn = connStr.replace(/"/g, '\\"');

    switch (params.action) {
        case "tables": {
            const sql = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;";
            const { stdout } = await execAsync(`psql "${escapedConn}" -t -A -c "${sql}"`);
            const tables = stdout.trim().split("\n").filter(Boolean);
            return {
                success: true,
                content: `**Tables** (${tables.length}):\n${tables.map(t => `• ${t}`).join("\n")}`,
                metadata: { tables, count: tables.length },
            };
        }

        case "schema": {
            const table = params.tableName;
            if (!table) {
                return { success: false, content: "", error: "tableName is required for schema action" };
            }
            const { stdout } = await execAsync(`psql "${escapedConn}" -c "\\d ${table}"`);
            return {
                success: true,
                content: `**Schema for ${table}**\n\`\`\`\n${stdout.trim()}\n\`\`\``,
            };
        }

        case "query": {
            if (!params.sql) {
                return { success: false, content: "", error: "sql is required" };
            }

            const sqlUpper = params.sql.trim().toUpperCase();
            const isWrite = ["INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE", "TRUNCATE"].some(kw => sqlUpper.startsWith(kw));
            if (isWrite && !params.allowWrite) {
                return {
                    success: false,
                    content: "",
                    error: "Write operations are disabled by default. Set allowWrite: true to enable.",
                };
            }

            const escapedSQL = params.sql.replace(/"/g, '\\"');
            const { stdout } = await execAsync(`psql "${escapedConn}" -c "${escapedSQL}"`);
            return { success: true, content: `**Results**\n\`\`\`\n${stdout.trim()}\n\`\`\`` };
        }

        case "databases": {
            const { stdout } = await execAsync(`psql "${escapedConn}" -t -A -c "SELECT datname FROM pg_database WHERE datistemplate = false;"`);
            const dbs = stdout.trim().split("\n").filter(Boolean);
            return {
                success: true,
                content: `**Databases** (${dbs.length}):\n${dbs.map(d => `• ${d}`).join("\n")}`,
            };
        }

        default:
            return { success: false, content: "", error: `Unknown action: ${params.action}` };
    }
}
