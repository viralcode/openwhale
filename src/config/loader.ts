import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Configuration schema with Zod
const DatabaseConfigSchema = z.object({
    type: z.enum(["sqlite", "postgres", "mysql"]).default("sqlite"),
    url: z.string().default("file:./data/openwhale.db"),
});

const SecurityConfigSchema = z.object({
    mode: z.enum(["local", "public"]).default("local"),
    jwt: z.object({
        secret: z.string().min(32),
        expiresIn: z.string().default("7d"),
        refreshExpiresIn: z.string().default("30d"),
    }),
    cors: z.object({
        origins: z.array(z.string()).default(["*"]),
        credentials: z.boolean().default(true),
    }),
    rateLimit: z.object({
        enabled: z.boolean().default(true),
        requestsPerMinute: z.number().default(60),
        requestsPerHour: z.number().default(1000),
    }).default({}),
    oauth: z.object({
        providers: z.array(z.object({
            name: z.string(),
            clientId: z.string(),
            clientSecret: z.string(),
            redirectUri: z.string(),
        })).default([]),
    }).optional(),
});

const GatewayConfigSchema = z.object({
    host: z.string().default("0.0.0.0"),
    port: z.number().default(7777),
});

const ProviderConfigSchema = z.object({
    name: z.string(),
    type: z.enum(["openai-compatible", "anthropic", "google", "custom"]),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    models: z.array(z.string()).optional(),
    enabled: z.boolean().default(true),
});

const ConfigSchema = z.object({
    database: DatabaseConfigSchema.default({}),
    security: SecurityConfigSchema,
    gateway: GatewayConfigSchema.default({}),
    providers: z.record(z.string(), ProviderConfigSchema).default({}),
});

export type OpenWhaleConfig = z.infer<typeof ConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

const CONFIG_PATHS = [
    "./openwhale.config.json",
    "./config/openwhale.json",
    join(homedir(), ".openwhale", "config.json"),
];

function loadConfigFile(): Partial<OpenWhaleConfig> {
    for (const configPath of CONFIG_PATHS) {
        if (existsSync(configPath)) {
            const content = readFileSync(configPath, "utf-8");
            return JSON.parse(content);
        }
    }
    return {};
}

function loadEnvConfig(): Partial<OpenWhaleConfig> {
    const env = process.env;

    return {
        database: {
            type: (env.DATABASE_TYPE as "sqlite" | "postgres" | "mysql") ?? "sqlite",
            url: env.DATABASE_URL ?? "file:./data/openwhale.db",
        },
        security: {
            mode: (env.SECURITY_MODE as "local" | "public") ?? "local",
            jwt: {
                secret: env.JWT_SECRET ?? "dev-secret-change-in-production-" + Math.random().toString(36),
                expiresIn: env.JWT_EXPIRES_IN ?? "7d",
                refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN ?? "30d",
            },
            cors: {
                origins: env.CORS_ORIGINS?.split(",") ?? ["*"],
                credentials: env.CORS_CREDENTIALS !== "false",
            },
            rateLimit: {
                enabled: env.RATE_LIMIT_ENABLED !== "false",
                requestsPerMinute: parseInt(env.RATE_LIMIT_PER_MINUTE ?? "60"),
                requestsPerHour: parseInt(env.RATE_LIMIT_PER_HOUR ?? "1000"),
            },
        },
        gateway: {
            host: env.GATEWAY_HOST ?? "0.0.0.0",
            port: parseInt(env.GATEWAY_PORT ?? "7777"),
        },
        providers: buildProviders(env),
    };
}

function buildProviders(env: NodeJS.ProcessEnv): Record<string, ProviderConfig> {
    const providers: Record<string, ProviderConfig> = {};

    // Anthropic/Claude
    if (env.ANTHROPIC_API_KEY) {
        providers.anthropic = {
            name: "Anthropic",
            type: "anthropic",
            apiKey: env.ANTHROPIC_API_KEY,
            enabled: true,
        };
    }

    // OpenAI
    if (env.OPENAI_API_KEY) {
        providers.openai = {
            name: "OpenAI",
            type: "openai-compatible",
            apiKey: env.OPENAI_API_KEY,
            baseUrl: "https://api.openai.com/v1",
            enabled: true,
        };
    }

    // DeepSeek
    if (env.DEEPSEEK_API_KEY) {
        providers.deepseek = {
            name: "DeepSeek",
            type: "openai-compatible",
            apiKey: env.DEEPSEEK_API_KEY,
            baseUrl: "https://api.deepseek.com/v1",
            enabled: true,
        };
    }

    // Google Gemini
    if (env.GOOGLE_API_KEY) {
        providers.google = {
            name: "Google Gemini",
            type: "google",
            apiKey: env.GOOGLE_API_KEY,
            enabled: true,
        };
    }

    // Groq
    if (env.GROQ_API_KEY) {
        providers.groq = {
            name: "Groq",
            type: "openai-compatible",
            apiKey: env.GROQ_API_KEY,
            baseUrl: "https://api.groq.com/openai/v1",
            enabled: true,
        };
    }

    // Together AI
    if (env.TOGETHER_API_KEY) {
        providers.together = {
            name: "Together AI",
            type: "openai-compatible",
            apiKey: env.TOGETHER_API_KEY,
            baseUrl: "https://api.together.xyz/v1",
            enabled: true,
        };
    }

    // Ollama (local)
    if (env.OLLAMA_HOST) {
        providers.ollama = {
            name: "Ollama",
            type: "openai-compatible",
            baseUrl: env.OLLAMA_HOST,
            enabled: true,
        };
    }

    return providers;
}

export async function loadConfig(): Promise<OpenWhaleConfig> {
    const fileConfig = loadConfigFile();
    const envConfig = loadEnvConfig();

    // Merge: env > file > defaults
    const merged = {
        ...fileConfig,
        ...envConfig,
        database: { ...fileConfig.database, ...envConfig.database },
        security: {
            ...fileConfig.security,
            ...envConfig.security,
            jwt: { ...fileConfig.security?.jwt, ...envConfig.security?.jwt },
            cors: { ...fileConfig.security?.cors, ...envConfig.security?.cors },
            rateLimit: { ...fileConfig.security?.rateLimit, ...envConfig.security?.rateLimit },
        },
        gateway: { ...fileConfig.gateway, ...envConfig.gateway },
        providers: { ...fileConfig.providers, ...envConfig.providers },
    };

    return ConfigSchema.parse(merged);
}
