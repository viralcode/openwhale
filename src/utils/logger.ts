type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel = LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? "info"];

export interface Logger {
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
}

function formatLog(level: LogLevel, subsystem: string, message: string, data?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";

    if (process.env.LOG_FORMAT === "json") {
        return JSON.stringify({
            timestamp,
            level,
            subsystem,
            message,
            ...data,
        });
    }

    const levelColors: Record<LogLevel, string> = {
        debug: "\x1b[90m",  // Gray
        info: "\x1b[36m",   // Cyan
        warn: "\x1b[33m",   // Yellow
        error: "\x1b[31m",  // Red
    };
    const reset = "\x1b[0m";
    const color = levelColors[level];

    return `${color}[${timestamp}] [${level.toUpperCase()}] [${subsystem}]${reset} ${message}${dataStr}`;
}

export function createLogger(subsystem: string): Logger {
    const log = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
        if (LEVELS[level] >= currentLevel) {
            console.log(formatLog(level, subsystem, message, data));
        }
    };

    return {
        debug: (message, data) => log("debug", message, data),
        info: (message, data) => log("info", message, data),
        warn: (message, data) => log("warn", message, data),
        error: (message, data) => log("error", message, data),
    };
}
