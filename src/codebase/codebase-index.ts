/**
 * OpenWhale Codebase Indexer
 *
 * Indexes the OpenWhale source code into a vector database so the AI can
 * search and understand its own codebase. Uses the existing embedding
 * providers (OpenAI / Gemini / local GGUF) and stores vectors in SQLite.
 *
 * Chunking strategy:
 *   - Each function/method becomes a chunk
 *   - Each class (signature + fields) becomes a chunk
 *   - Top-level exports/constants/imports become a file-header chunk
 *   - Comments/JSDoc are kept attached to their parent
 *
 * Incremental: hashes each chunk and skips unchanged ones on re-index.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { getEmbeddingProvider, type EmbeddingProvider } from "../memory/embeddings.js";
import { logger } from "../logger.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CodeChunk {
    id: string;
    filePath: string;   // relative to project root
    startLine: number;
    endLine: number;
    chunkType: "function" | "class" | "method" | "export" | "header" | "block";
    name: string;        // e.g. "screenshotTool.execute" or "imports"
    content: string;     // raw source text
    hash: string;
}

export interface CodeSearchResult {
    filePath: string;
    startLine: number;
    endLine: number;
    chunkType: string;
    name: string;
    content: string;
    score: number;
}

export interface IndexStatus {
    indexed: boolean;
    chunkCount: number;
    embeddedCount: number;
    lastIndexed: string | null;
    sourceRoot: string;
    provider: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DB_DIR = join(homedir(), ".openwhale", "codebase");
const DB_PATH = join(DB_DIR, "codebase-vectors.db");

const SKIP_DIRS = new Set([
    "node_modules", "dist", "build", ".git", ".next",
    "coverage", "__tests__", ".turbo", ".cache",
]);

const CODE_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
]);

// Max chunk size in characters (~1500 tokens)
const MAX_CHUNK_CHARS = 6000;

// ─── Database ────────────────────────────────────────────────────────────────

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
    if (db) return db;

    if (!existsSync(DB_DIR)) {
        mkdirSync(DB_DIR, { recursive: true });
    }

    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode=WAL;");
    db.exec("PRAGMA synchronous=NORMAL;");

    db.exec(`
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            start_line INTEGER NOT NULL,
            end_line INTEGER NOT NULL,
            chunk_type TEXT NOT NULL,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            hash TEXT NOT NULL,
            embedding TEXT
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS index_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_path);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(hash);`);

    return db;
}

// ─── Source File Discovery ───────────────────────────────────────────────────

function walkSourceFiles(dir: string, rootDir: string): string[] {
    const results: string[] = [];

    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return results;
    }

    for (const entryName of entries) {
        const fullPath = join(dir, entryName);

        let isDir = false;
        try {
            const st = statSync(fullPath);
            isDir = st.isDirectory();
        } catch { continue; }

        if (isDir) {
            if (!SKIP_DIRS.has(entryName) && !entryName.startsWith(".")) {
                results.push(...walkSourceFiles(fullPath, rootDir));
            }
        } else if (CODE_EXTENSIONS.has(extname(entryName))) {
            results.push(fullPath);
        }
    }

    return results;
}

// ─── Code Chunking ───────────────────────────────────────────────────────────

/**
 * Parse a TypeScript/JavaScript file into logical chunks.
 * Uses a line-by-line heuristic approach (no AST parser dependency).
 */
function chunkSourceFile(filePath: string, rootDir: string): CodeChunk[] {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const relPath = relative(rootDir, filePath);
    const chunks: CodeChunk[] = [];

    // Track brace depth to find function/class boundaries
    let currentChunk: {
        startLine: number;
        lines: string[];
        type: CodeChunk["chunkType"];
        name: string;
        braceDepth: number;
    } | null = null;

    // Header chunk: imports and top-level comments at the start
    const headerLines: string[] = [];
    let headerEnd = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();

        // Collect header (imports, top comments, empty lines at the start)
        if (headerEnd === i && (
            trimmed.startsWith("import ") ||
            trimmed.startsWith("import{") ||
            trimmed.startsWith("export {") ||
            trimmed.startsWith("export *") ||
            trimmed.startsWith("//") ||
            trimmed.startsWith("/*") ||
            trimmed.startsWith("*") ||
            trimmed.startsWith("*/") ||
            trimmed === ""
        )) {
            headerLines.push(line);
            headerEnd = i + 1;
            continue;
        }

        // If we're inside a chunk, track braces
        if (currentChunk) {
            currentChunk.lines.push(line);
            currentChunk.braceDepth += countBraces(line);

            // Chunk ends when braces balance
            if (currentChunk.braceDepth <= 0 && currentChunk.lines.length > 1) {
                finishChunk(currentChunk, i, relPath, chunks);
                currentChunk = null;
            }
            continue;
        }

        // Detect new chunk starts
        const chunkStart = detectChunkStart(trimmed, line);
        if (chunkStart) {
            currentChunk = {
                startLine: i + 1, // 1-indexed
                lines: [line],
                type: chunkStart.type,
                name: chunkStart.name,
                braceDepth: countBraces(line),
            };

            // Single-line declarations (no braces)
            if (currentChunk.braceDepth === 0 && !trimmed.endsWith("{")) {
                finishChunk(currentChunk, i, relPath, chunks);
                currentChunk = null;
            }
        }
    }

    // Flush remaining chunk
    if (currentChunk) {
        finishChunk(currentChunk, lines.length - 1, relPath, chunks);
    }

    // Add header if non-trivial
    if (headerLines.length > 3) {
        const text = headerLines.join("\n");
        chunks.unshift({
            id: `${relPath}:header`,
            filePath: relPath,
            startLine: 1,
            endLine: headerEnd,
            chunkType: "header",
            name: `${basename(filePath)} imports`,
            content: text.slice(0, MAX_CHUNK_CHARS),
            hash: hashText(text),
        });
    }

    // If no chunks were found (e.g., a config file), create one big chunk
    if (chunks.length === 0 && content.trim().length > 0) {
        chunks.push({
            id: `${relPath}:full`,
            filePath: relPath,
            startLine: 1,
            endLine: lines.length,
            chunkType: "block",
            name: basename(filePath),
            content: content.slice(0, MAX_CHUNK_CHARS),
            hash: hashText(content),
        });
    }

    return chunks;
}

function detectChunkStart(trimmed: string, _line: string): { type: CodeChunk["chunkType"]; name: string } | null {
    // async function foo(
    // export async function foo(
    // function foo(
    const funcMatch = trimmed.match(
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/
    );
    if (funcMatch) return { type: "function", name: funcMatch[1]! };

    // export class Foo
    // class Foo
    const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) return { type: "class", name: classMatch[1]! };

    // export const fooTool: AgentTool = {
    // export const fooTool = {
    const constObjMatch = trimmed.match(/^(?:export\s+)?const\s+(\w+)\s*(?::\s*\w[\w<>,\s|]*\s*)?=\s*\{/);
    if (constObjMatch) return { type: "export", name: constObjMatch[1]! };

    // export interface/type
    const typeMatch = trimmed.match(/^(?:export\s+)?(?:interface|type)\s+(\w+)/);
    if (typeMatch) return { type: "export", name: typeMatch[1]! };

    // Arrow function: export const foo = async (
    const arrowMatch = trimmed.match(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/);
    if (arrowMatch) return { type: "function", name: arrowMatch[1]! };

    // Arrow function: export const foo = (
    const arrowMatch2 = trimmed.match(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*(?::\s*\w[\w<>,\s|]*\s*)?\s*=>/);
    if (arrowMatch2) return { type: "function", name: arrowMatch2[1]! };

    return null;
}

function countBraces(line: string): number {
    let depth = 0;
    let inString = false;
    let stringChar = "";
    let escaped = false;

    for (const ch of line) {
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }

        if (inString) {
            if (ch === stringChar) inString = false;
            continue;
        }

        if (ch === '"' || ch === "'" || ch === "`") {
            inString = true;
            stringChar = ch;
            continue;
        }

        if (ch === "{") depth++;
        else if (ch === "}") depth--;
    }

    return depth;
}

function finishChunk(
    chunk: { startLine: number; lines: string[]; type: CodeChunk["chunkType"]; name: string },
    endLineIdx: number,
    relPath: string,
    chunks: CodeChunk[]
) {
    const text = chunk.lines.join("\n");
    if (text.trim().length < 10) return; // skip trivial chunks

    // Split oversized chunks
    if (text.length > MAX_CHUNK_CHARS) {
        const mid = Math.floor(chunk.lines.length / 2);
        const part1 = chunk.lines.slice(0, mid).join("\n");
        const part2 = chunk.lines.slice(mid).join("\n");

        chunks.push({
            id: `${relPath}:${chunk.name}:1`,
            filePath: relPath,
            startLine: chunk.startLine,
            endLine: chunk.startLine + mid - 1,
            chunkType: chunk.type,
            name: `${chunk.name} (part 1)`,
            content: part1.slice(0, MAX_CHUNK_CHARS),
            hash: hashText(part1),
        });
        chunks.push({
            id: `${relPath}:${chunk.name}:2`,
            filePath: relPath,
            startLine: chunk.startLine + mid,
            endLine: endLineIdx + 1,
            chunkType: chunk.type,
            name: `${chunk.name} (part 2)`,
            content: part2.slice(0, MAX_CHUNK_CHARS),
            hash: hashText(part2),
        });
    } else {
        chunks.push({
            id: `${relPath}:${chunk.name}`,
            filePath: relPath,
            startLine: chunk.startLine,
            endLine: endLineIdx + 1,
            chunkType: chunk.type,
            name: chunk.name,
            content: text,
            hash: hashText(text),
        });
    }
}

function hashText(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

// ─── Cosine Similarity ──────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const len = Math.min(a.length, b.length);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < len; i++) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        dot += av * bv;
        normA += av * av;
        normB += bv * bv;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Indexing ────────────────────────────────────────────────────────────────

/**
 * Index the OpenWhale source code.
 * Returns stats about what was indexed.
 */
export async function indexCodebase(sourceRoot: string): Promise<{
    totalFiles: number;
    totalChunks: number;
    newChunks: number;
    embeddedChunks: number;
    skippedChunks: number;
    errors: string[];
}> {
    const database = getDb();
    const errors: string[] = [];

    logger.info("codebase", "Starting codebase indexing", { sourceRoot });

    // 1. Discover source files
    const sourceFiles = walkSourceFiles(sourceRoot, sourceRoot);
    logger.info("codebase", `Found ${sourceFiles.length} source files`);

    // 2. Chunk all files
    const allChunks: CodeChunk[] = [];
    for (const file of sourceFiles) {
        try {
            const chunks = chunkSourceFile(file, sourceRoot);
            allChunks.push(...chunks);
        } catch (err) {
            errors.push(`Failed to chunk ${relative(sourceRoot, file)}: ${err}`);
        }
    }

    logger.info("codebase", `Generated ${allChunks.length} code chunks`);

    // 3. Determine which chunks are new/changed
    const existingHashes = new Map<string, string>();
    const rows = database.prepare("SELECT id, hash FROM chunks").all() as Array<{ id: string; hash: string }>;
    for (const row of rows) {
        existingHashes.set(row.id, row.hash);
    }

    const newChunks: CodeChunk[] = [];
    const unchangedIds = new Set<string>();

    for (const chunk of allChunks) {
        const existingHash = existingHashes.get(chunk.id);
        if (existingHash === chunk.hash) {
            unchangedIds.add(chunk.id);
        } else {
            newChunks.push(chunk);
        }
    }

    logger.info("codebase", `${newChunks.length} new/changed, ${unchangedIds.size} unchanged`);

    // 4. Remove stale chunks (files/functions that no longer exist)
    const currentIds = new Set(allChunks.map(c => c.id));
    const staleIds: string[] = [];
    for (const [id] of existingHashes) {
        if (!currentIds.has(id)) staleIds.push(id);
    }
    if (staleIds.length > 0) {
        const deleteSt = database.prepare("DELETE FROM chunks WHERE id = ?");
        for (const id of staleIds) {
            deleteSt.run(id);
        }
        logger.info("codebase", `Removed ${staleIds.length} stale chunks`);
    }

    // 5. Get embedding provider
    let provider: EmbeddingProvider | null = null;
    let embeddedCount = 0;

    try {
        provider = await getEmbeddingProvider("auto");
        if (provider) {
            logger.info("codebase", `Using embedding provider: ${provider.id} (${provider.model})`);
        }
    } catch (err) {
        logger.warn("codebase", "No embedding provider available, indexing without embeddings");
    }

    // 6. Insert new chunks + generate embeddings
    const insertSt = database.prepare(`
        INSERT OR REPLACE INTO chunks (id, file_path, start_line, end_line, chunk_type, name, content, hash, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Process in batches for embeddings
    const BATCH_SIZE = 20;
    for (let i = 0; i < newChunks.length; i += BATCH_SIZE) {
        const batch = newChunks.slice(i, i + BATCH_SIZE);

        // Generate embeddings for batch
        let embeddings: number[][] | null = null;
        if (provider) {
            try {
                const texts = batch.map(c =>
                    `File: ${c.filePath}\nType: ${c.chunkType}\nName: ${c.name}\n\n${c.content}`
                );
                embeddings = await provider.embedBatch(texts);
                embeddedCount += batch.length;
            } catch (err) {
                errors.push(`Embedding batch ${i / BATCH_SIZE} failed: ${err}`);
            }
        }

        // Insert chunks
        for (let j = 0; j < batch.length; j++) {
            const chunk = batch[j]!;
            const embedding = embeddings?.[j] ?? null;
            insertSt.run(
                chunk.id,
                chunk.filePath,
                chunk.startLine,
                chunk.endLine,
                chunk.chunkType,
                chunk.name,
                chunk.content,
                chunk.hash,
                embedding ? JSON.stringify(embedding) : null
            );
        }

        if (i % 100 === 0 && i > 0) {
            logger.debug("codebase", `Indexed ${i}/${newChunks.length} chunks`);
        }
    }

    // 7. Update metadata
    const metaSt = database.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)");
    metaSt.run("last_indexed", new Date().toISOString());
    metaSt.run("source_root", sourceRoot);

    logger.info("codebase", "Indexing complete", {
        files: sourceFiles.length,
        chunks: allChunks.length,
        new: newChunks.length,
        embedded: embeddedCount,
    });

    return {
        totalFiles: sourceFiles.length,
        totalChunks: allChunks.length,
        newChunks: newChunks.length,
        embeddedChunks: embeddedCount,
        skippedChunks: unchangedIds.size,
        errors,
    };
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Search the codebase using semantic similarity + keyword fallback.
 */
export async function searchCodebase(
    query: string,
    limit: number = 10,
): Promise<CodeSearchResult[]> {
    const database = getDb();

    // Try vector search first
    let provider: EmbeddingProvider | null = null;
    try {
        provider = await getEmbeddingProvider("auto");
    } catch { /* fall back to keyword */ }

    if (provider) {
        try {
            const queryEmbedding = await provider.embedQuery(query);

            // Load all embedded chunks and compute similarity
            const rows = database.prepare(
                "SELECT id, file_path, start_line, end_line, chunk_type, name, content, embedding FROM chunks WHERE embedding IS NOT NULL"
            ).all() as Array<{
                id: string;
                file_path: string;
                start_line: number;
                end_line: number;
                chunk_type: string;
                name: string;
                content: string;
                embedding: string;
            }>;

            const scored = rows.map(row => ({
                filePath: row.file_path,
                startLine: row.start_line,
                endLine: row.end_line,
                chunkType: row.chunk_type,
                name: row.name,
                content: row.content,
                score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding) as number[]),
            }));

            scored.sort((a, b) => b.score - a.score);
            return scored.slice(0, limit);
        } catch (err) {
            logger.warn("codebase", "Vector search failed, falling back to keyword", { error: String(err) });
        }
    }

    // Keyword fallback: simple text matching
    return searchCodebaseKeyword(query, limit);
}

/**
 * Keyword-based code search (no embeddings needed).
 */
export function searchCodebaseKeyword(query: string, limit: number = 10): CodeSearchResult[] {
    const database = getDb();
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

    const rows = database.prepare(
        "SELECT file_path, start_line, end_line, chunk_type, name, content FROM chunks"
    ).all() as Array<{
        file_path: string;
        start_line: number;
        end_line: number;
        chunk_type: string;
        name: string;
        content: string;
    }>;

    const scored = rows.map(row => {
        const haystack = `${row.file_path} ${row.name} ${row.content}`.toLowerCase();
        let score = 0;
        for (const term of terms) {
            // Count occurrences
            let idx = 0;
            let count = 0;
            while ((idx = haystack.indexOf(term, idx)) !== -1) {
                count++;
                idx += term.length;
            }
            score += count;
            // Bonus for name match
            if (row.name.toLowerCase().includes(term)) score += 3;
            // Bonus for file path match
            if (row.file_path.toLowerCase().includes(term)) score += 2;
        }

        return {
            filePath: row.file_path,
            startLine: row.start_line,
            endLine: row.end_line,
            chunkType: row.chunk_type,
            name: row.name,
            content: row.content,
            score,
        };
    });

    return scored
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * Get codebase index status.
 */
export function getCodebaseStatus(): IndexStatus {
    try {
        const database = getDb();

        const chunkCount = (database.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number }).count;
        const embeddedCount = (database.prepare("SELECT COUNT(*) as count FROM chunks WHERE embedding IS NOT NULL").get() as { count: number }).count;

        const lastIndexedRow = database.prepare("SELECT value FROM index_meta WHERE key = 'last_indexed'").get() as { value: string } | undefined;
        const sourceRootRow = database.prepare("SELECT value FROM index_meta WHERE key = 'source_root'").get() as { value: string } | undefined;

        let providerName: string | null = null;
        try {
            // Check without actually initializing
            if (process.env.OPENAI_API_KEY) providerName = "openai";
            else if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) providerName = "gemini";
            else providerName = "local (if available)";
        } catch { /* ignore */ }

        return {
            indexed: chunkCount > 0,
            chunkCount,
            embeddedCount,
            lastIndexed: lastIndexedRow?.value ?? null,
            sourceRoot: sourceRootRow?.value ?? "",
            provider: providerName,
        };
    } catch {
        return {
            indexed: false,
            chunkCount: 0,
            embeddedCount: 0,
            lastIndexed: null,
            sourceRoot: "",
            provider: null,
        };
    }
}
