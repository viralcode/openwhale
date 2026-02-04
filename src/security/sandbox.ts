import Docker from "dockerode";
import { randomBytes } from "node:crypto";

export type SandboxConfig = {
    image: string;
    memory: string; // e.g., "512m"
    cpus: number;
    workspaceMount?: string;
    networkMode: "none" | "bridge" | "host";
    timeout: number; // ms
};

export type SandboxResult = {
    success: boolean;
    output: string;
    exitCode: number;
    duration: number;
    error?: string;
};

const DEFAULT_CONFIG: SandboxConfig = {
    image: "node:20-alpine",
    memory: "512m",
    cpus: 1,
    networkMode: "none",
    timeout: 60000,
};

let docker: Docker | null = null;

function getDocker(): Docker {
    if (!docker) {
        docker = new Docker();
    }
    return docker;
}

export async function runInSandbox(
    command: string,
    config: Partial<SandboxConfig> = {}
): Promise<SandboxResult> {
    const opts = { ...DEFAULT_CONFIG, ...config };
    const containerId = `openwhale-sandbox-${randomBytes(8).toString("hex")}`;
    const d = getDocker();
    const startTime = Date.now();

    try {
        // Create container
        const container = await d.createContainer({
            name: containerId,
            Image: opts.image,
            Cmd: ["/bin/sh", "-c", command],
            HostConfig: {
                Memory: parseMemory(opts.memory),
                NanoCpus: opts.cpus * 1e9,
                NetworkMode: opts.networkMode,
                AutoRemove: true,
                Binds: opts.workspaceMount
                    ? [`${opts.workspaceMount}:/workspace:rw`]
                    : undefined,
                ReadonlyRootfs: false,
                SecurityOpt: ["no-new-privileges"],
            },
            WorkingDir: opts.workspaceMount ? "/workspace" : "/",
            Tty: false,
            AttachStdout: true,
            AttachStderr: true,
        });

        // Start container
        await container.start();

        // Wait for completion with timeout
        const waitPromise = container.wait();
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                container.kill().catch(() => { });
                reject(new Error("Sandbox timeout"));
            }, opts.timeout);
        });

        const result = await Promise.race([waitPromise, timeoutPromise]) as { StatusCode: number };

        // Get logs
        const logs = await container.logs({
            stdout: true,
            stderr: true,
        });

        const output = logs.toString("utf-8");
        const duration = Date.now() - startTime;

        return {
            success: result.StatusCode === 0,
            output,
            exitCode: result.StatusCode,
            duration,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            success: false,
            output: "",
            exitCode: -1,
            duration: Date.now() - startTime,
            error: message,
        };
    }
}

// Pull image if not available
export async function ensureImage(image: string): Promise<boolean> {
    const d = getDocker();

    try {
        await d.getImage(image).inspect();
        return true;
    } catch {
        // Image doesn't exist, pull it
        console.log(`Pulling sandbox image: ${image}`);
        await new Promise<void>((resolve, reject) => {
            d.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
                if (err) return reject(err);
                d.modem.followProgress(stream, (err: Error | null) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
        return true;
    }
}

function parseMemory(mem: string): number {
    const match = mem.match(/^(\d+)([kmg]?)$/i);
    if (!match) return 512 * 1024 * 1024; // Default 512MB

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case "k": return value * 1024;
        case "m": return value * 1024 * 1024;
        case "g": return value * 1024 * 1024 * 1024;
        default: return value;
    }
}

// Check if Docker is available
export async function isDockerAvailable(): Promise<boolean> {
    try {
        const d = getDocker();
        await d.ping();
        return true;
    } catch {
        return false;
    }
}
