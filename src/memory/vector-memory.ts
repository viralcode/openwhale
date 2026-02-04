/**
 * OpenWhale Vector Memory
 * 
 * Provides semantic search over memory files using sqlite-vec.
 * Similar to OpenClaw's implementation with:
 * - Markdown chunking
 * - Embedding generation (local, OpenAI, or Gemini)
 * - Vector similarity search using cosine distance
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { getEmbeddingProvider, getProviderStatus, type EmbeddingProvider } from "./embeddings.js";

// Types
export interface MemoryChunk {
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    text: string;
    hash: string;
    embedding?: number[];
}

export interface SearchResult {
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    text: string;
    score: number;
}

// Constants
const MEMORY_DIR = join(homedir(), ".openwhale", "memory");
const VECTOR_DB_PATH = join(homedir(), ".openwhale", "memory", "vector.db");
const EMBEDDING_DIM = 1536; // OpenAI/Anthropic embedding dimension
const CHUNK_SIZE = 512; // ~512 tokens per chunk
const CHUNK_OVERLAP = 64; // ~64 token overlap

// Ensure directory exists
if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
}

// Database singleton
let vectorDb: DatabaseSync | null = null;
let sqliteVecLoaded = false;
let currentEmbeddingDim: number | null = null;
let embeddingProvider: EmbeddingProvider | null = null;

/**
 * Initialize the vector database
 */
export async function initVectorDb(): Promise<boolean> {
    if (vectorDb && sqliteVecLoaded) {
        return true;
    }

    try {
        vectorDb = new DatabaseSync(VECTOR_DB_PATH, { allowExtension: true });

        // Try to load sqlite-vec
        try {
            const sqliteVec = await import("sqlite-vec");
            sqliteVec.load(vectorDb);
            sqliteVecLoaded = true;
            console.log("[VectorMemory] sqlite-vec loaded successfully");
        } catch (err) {
            console.warn("[VectorMemory] sqlite-vec not available, using fallback search");
            sqliteVecLoaded = false;
        }

        // Create schema
        vectorDb.exec(`
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL,
                text TEXT NOT NULL,
                hash TEXT NOT NULL,
                embedding TEXT,
                created_at INTEGER DEFAULT (unixepoch())
            );
            CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);
            CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(hash);
        `);

        // Create vector table if sqlite-vec is available
        if (sqliteVecLoaded) {
            try {
                vectorDb.exec(`
                    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
                        id TEXT PRIMARY KEY,
                        embedding FLOAT[${EMBEDDING_DIM}]
                    );
                `);
                console.log("[VectorMemory] Vector table created");
            } catch (err) {
                console.warn("[VectorMemory] Could not create vector table:", err);
            }
        }

        return true;
    } catch (err) {
        console.error("[VectorMemory] Failed to initialize database:", err);
        return false;
    }
}

/**
 * Hash text for deduplication
 */
function hashText(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Chunk markdown content
 */
export function chunkMarkdown(content: string, filePath: string): MemoryChunk[] {
    const lines = content.split("\n");
    if (lines.length === 0) return [];

    const maxChars = CHUNK_SIZE * 4; // ~4 chars per token
    const overlapChars = CHUNK_OVERLAP * 4;
    const chunks: MemoryChunk[] = [];

    let current: Array<{ line: string; lineNo: number }> = [];
    let currentChars = 0;

    const flush = () => {
        if (current.length === 0) return;

        const text = current.map(e => e.line).join("\n");
        const startLine = current[0]!.lineNo;
        const endLine = current[current.length - 1]!.lineNo;
        const hash = hashText(text);

        chunks.push({
            id: `${hashText(filePath)}_${startLine}_${endLine}`,
            path: filePath,
            startLine,
            endLine,
            text,
            hash,
        });
    };

    const carryOverlap = () => {
        if (overlapChars <= 0 || current.length === 0) {
            current = [];
            currentChars = 0;
            return;
        }

        let acc = 0;
        const kept: Array<{ line: string; lineNo: number }> = [];
        for (let i = current.length - 1; i >= 0; i--) {
            const entry = current[i]!;
            acc += entry.line.length + 1;
            kept.unshift(entry);
            if (acc >= overlapChars) break;
        }
        current = kept;
        currentChars = kept.reduce((sum, e) => sum + e.line.length + 1, 0);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const lineNo = i + 1;
        const lineSize = line.length + 1;

        if (currentChars + lineSize > maxChars && current.length > 0) {
            flush();
            carryOverlap();
        }
        current.push({ line, lineNo });
        currentChars += lineSize;
    }
    flush();

    return chunks;
}

/**
 * List all memory files
 */
export function listMemoryFiles(): string[] {
    const files: string[] = [];

    // Main MEMORY.md
    const mainMemory = join(MEMORY_DIR, "MEMORY.md");
    if (existsSync(mainMemory)) {
        files.push(mainMemory);
    }

    // Daily notes
    try {
        const entries = readdirSync(MEMORY_DIR);
        for (const entry of entries) {
            if (entry.match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
                files.push(join(MEMORY_DIR, entry));
            }
        }
    } catch { }

    return files;
}

/**
 * Generate embedding using the best available provider
 * Priority: Local (no API key) > OpenAI > Gemini
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    // Get or create provider
    if (!embeddingProvider) {
        embeddingProvider = await getEmbeddingProvider("auto");
    }

    if (!embeddingProvider) {
        console.warn("[VectorMemory] No embedding provider available");
        return null;
    }

    try {
        const embedding = await embeddingProvider.embedQuery(text);

        // Update dimension if this is the first embedding
        if (!currentEmbeddingDim && embedding.length > 0) {
            currentEmbeddingDim = embedding.length;
            console.log(`[VectorMemory] Embedding dimension: ${currentEmbeddingDim}`);

            // Recreate vector table with correct dimensions
            if (sqliteVecLoaded && vectorDb) {
                try {
                    vectorDb.exec(`DROP TABLE IF EXISTS vec_chunks`);
                    vectorDb.exec(`
                        CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
                            id TEXT PRIMARY KEY,
                            embedding FLOAT[${currentEmbeddingDim}]
                        );
                    `);
                } catch { }
            }
        }

        return embedding;
    } catch (err) {
        console.warn("[VectorMemory] Embedding generation failed:", err);
        return null;
    }
}

/**
 * Index memory files
 */
export async function indexMemoryFiles(): Promise<{ indexed: number; errors: number }> {
    if (!await initVectorDb()) {
        return { indexed: 0, errors: 1 };
    }

    const files = listMemoryFiles();
    let indexed = 0;
    let errors = 0;

    for (const filePath of files) {
        try {
            const content = readFileSync(filePath, "utf-8");
            const chunks = chunkMarkdown(content, filePath);

            for (const chunk of chunks) {
                // Check if already indexed
                const existing = vectorDb!.prepare(
                    "SELECT id FROM chunks WHERE id = ? AND hash = ?"
                ).get(chunk.id, chunk.hash) as { id: string } | undefined;

                if (existing) continue;

                // Generate embedding
                const embedding = await generateEmbedding(chunk.text);

                // Insert or update chunk
                vectorDb!.prepare(`
                    INSERT OR REPLACE INTO chunks (id, path, start_line, end_line, text, hash, embedding)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    chunk.id,
                    chunk.path,
                    chunk.startLine,
                    chunk.endLine,
                    chunk.text,
                    chunk.hash,
                    embedding ? JSON.stringify(embedding) : null
                );

                // Insert into vector table if available
                if (sqliteVecLoaded && embedding) {
                    try {
                        const vecBlob = Buffer.from(new Float32Array(embedding).buffer);
                        vectorDb!.prepare(
                            "INSERT OR REPLACE INTO vec_chunks (id, embedding) VALUES (?, ?)"
                        ).run(chunk.id, vecBlob);
                    } catch { }
                }

                indexed++;
            }
        } catch (err) {
            console.error(`[VectorMemory] Failed to index ${filePath}:`, err);
            errors++;
        }
    }

    console.log(`[VectorMemory] Indexed ${indexed} chunks from ${files.length} files`);
    return { indexed, errors };
}

/**
 * Convert vector to buffer for sqlite-vec
 */
function vectorToBlob(embedding: number[]): Buffer {
    return Buffer.from(new Float32Array(embedding).buffer);
}

/**
 * Cosine similarity fallback
 */
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

/**
 * Search memory using vector similarity
 */
export async function searchMemoryVector(
    query: string,
    limit: number = 5
): Promise<SearchResult[]> {
    if (!await initVectorDb()) {
        return [];
    }

    const queryEmbedding = await generateEmbedding(query);

    if (!queryEmbedding) {
        // Fallback to keyword search
        return searchMemoryKeyword(query, limit);
    }

    // Try vector search with sqlite-vec
    if (sqliteVecLoaded) {
        try {
            const rows = vectorDb!.prepare(`
                SELECT c.id, c.path, c.start_line, c.end_line, c.text,
                       vec_distance_cosine(v.embedding, ?) AS dist
                FROM vec_chunks v
                JOIN chunks c ON c.id = v.id
                ORDER BY dist ASC
                LIMIT ?
            `).all(vectorToBlob(queryEmbedding), limit) as Array<{
                id: string;
                path: string;
                start_line: number;
                end_line: number;
                text: string;
                dist: number;
            }>;

            return rows.map(row => ({
                id: row.id,
                path: row.path,
                startLine: row.start_line,
                endLine: row.end_line,
                text: row.text,
                score: 1 - row.dist, // Convert distance to similarity
            }));
        } catch (err) {
            console.warn("[VectorMemory] Vector search failed, using fallback:", err);
        }
    }

    // Fallback: compute cosine similarity in JavaScript
    const allChunks = vectorDb!.prepare(
        "SELECT id, path, start_line, end_line, text, embedding FROM chunks WHERE embedding IS NOT NULL"
    ).all() as Array<{
        id: string;
        path: string;
        start_line: number;
        end_line: number;
        text: string;
        embedding: string;
    }>;

    const scored = allChunks
        .map(chunk => {
            const embedding = JSON.parse(chunk.embedding) as number[];
            return {
                ...chunk,
                score: cosineSimilarity(queryEmbedding, embedding),
            };
        })
        .filter(c => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored.map(row => ({
        id: row.id,
        path: row.path,
        startLine: row.start_line,
        endLine: row.end_line,
        text: row.text,
        score: row.score,
    }));
}

/**
 * Keyword-based search fallback
 */
export function searchMemoryKeyword(query: string, limit: number = 5): SearchResult[] {
    if (!vectorDb) return [];

    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter(w => w.length > 2);

    if (words.length === 0) return [];

    const allChunks = vectorDb.prepare(
        "SELECT id, path, start_line, end_line, text FROM chunks"
    ).all() as Array<{
        id: string;
        path: string;
        start_line: number;
        end_line: number;
        text: string;
    }>;

    const scored = allChunks
        .map(chunk => {
            const textLower = chunk.text.toLowerCase();
            let score = 0;
            for (const word of words) {
                const matches = textLower.split(word).length - 1;
                score += matches;
            }
            return { ...chunk, score };
        })
        .filter(c => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored.map(row => ({
        id: row.id,
        path: row.path,
        startLine: row.start_line,
        endLine: row.end_line,
        text: row.text,
        score: row.score / words.length, // Normalize
    }));
}

/**
 * Get vector memory status
 */
export function getVectorMemoryStatus(): {
    initialized: boolean;
    sqliteVecAvailable: boolean;
    chunkCount: number;
    embeddingCount: number;
    embeddingDim: number | null;
    provider: {
        current: string | null;
        available: string[];
        localError: string | null;
    };
} {
    const providerStatus = getProviderStatus();

    if (!vectorDb) {
        return {
            initialized: false,
            sqliteVecAvailable: false,
            chunkCount: 0,
            embeddingCount: 0,
            embeddingDim: null,
            provider: providerStatus,
        };
    }

    const chunkCount = (vectorDb.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number }).count;
    const embeddingCount = (vectorDb.prepare("SELECT COUNT(*) as count FROM chunks WHERE embedding IS NOT NULL").get() as { count: number }).count;

    return {
        initialized: true,
        sqliteVecAvailable: sqliteVecLoaded,
        chunkCount,
        embeddingCount,
        embeddingDim: currentEmbeddingDim,
        provider: providerStatus,
    };
}

