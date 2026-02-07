import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import Dockerode from "dockerode";

const DockerActionSchema = z.object({
    action: z.enum(["ps", "images", "run", "stop", "rm", "logs", "build", "exec", "pull", "stats"]).describe("Docker action"),
    // For run
    image: z.string().optional().describe("Docker image name"),
    name: z.string().optional().describe("Container name"),
    ports: z.record(z.string()).optional().describe("Port mappings e.g. {'8080': '80'}"),
    env: z.array(z.string()).optional().describe("Environment variables e.g. ['KEY=value']"),
    detach: z.boolean().optional().default(true).describe("Run in detached mode"),
    volumes: z.array(z.string()).optional().describe("Volume mounts e.g. ['/host/path:/container/path']"),
    // For stop/rm/logs/exec
    containerId: z.string().optional().describe("Container ID or name"),
    // For logs
    tail: z.number().optional().default(50).describe("Number of log lines"),
    // For exec
    command: z.string().optional().describe("Command to execute in container"),
    // For build
    dockerfile: z.string().optional().describe("Path to Dockerfile or build context"),
    tag: z.string().optional().describe("Image tag"),
    // For ps/images
    all: z.boolean().optional().default(false).describe("Show all (including stopped)"),
});

type DockerAction = z.infer<typeof DockerActionSchema>;

export const dockerTool: AgentTool<DockerAction> = {
    name: "docker",
    description: "Manage Docker containers and images: list, run, stop, remove, logs, build, exec, pull, stats.",
    category: "utility",
    parameters: DockerActionSchema,

    async execute(params: DockerAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            const docker = new Dockerode();

            switch (params.action) {
                case "ps": {
                    const containers = await docker.listContainers({ all: params.all });
                    if (containers.length === 0) {
                        return { success: true, content: "No containers running" };
                    }
                    const lines = containers.map(c => {
                        const name = c.Names[0]?.replace(/^\//, "") || "unnamed";
                        const ports = c.Ports.map(p => `${p.PublicPort || ""}→${p.PrivatePort}`).join(", ");
                        return `• ${c.Id.slice(0, 12)} ${name} (${c.Image}) — ${c.State} ${ports ? `[${ports}]` : ""}`;
                    });
                    return { success: true, content: `**Containers (${containers.length})**\n${lines.join("\n")}` };
                }

                case "images": {
                    const images = await docker.listImages();
                    const lines = images.map(img => {
                        const tags = img.RepoTags?.join(", ") || "<none>";
                        const sizeMB = (img.Size / 1024 / 1024).toFixed(1);
                        return `• ${img.Id.slice(7, 19)} ${tags} (${sizeMB} MB)`;
                    });
                    return { success: true, content: `**Images (${images.length})**\n${lines.join("\n")}` };
                }

                case "run": {
                    if (!params.image) {
                        return { success: false, content: "", error: "image is required" };
                    }

                    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
                    const exposedPorts: Record<string, Record<string, never>> = {};
                    if (params.ports) {
                        for (const [hostPort, containerPort] of Object.entries(params.ports)) {
                            const key = `${containerPort}/tcp`;
                            portBindings[key] = [{ HostPort: hostPort }];
                            exposedPorts[key] = {};
                        }
                    }

                    const binds = params.volumes || [];

                    const container = await docker.createContainer({
                        Image: params.image,
                        name: params.name,
                        Env: params.env,
                        ExposedPorts: exposedPorts,
                        HostConfig: {
                            PortBindings: portBindings,
                            Binds: binds,
                        },
                    });

                    await container.start();
                    return {
                        success: true,
                        content: `Container started: ${container.id.slice(0, 12)} (${params.image})${params.name ? ` as "${params.name}"` : ""}`,
                        metadata: { containerId: container.id },
                    };
                }

                case "stop": {
                    if (!params.containerId) {
                        return { success: false, content: "", error: "containerId is required" };
                    }
                    const container = docker.getContainer(params.containerId);
                    await container.stop();
                    return { success: true, content: `Container stopped: ${params.containerId}` };
                }

                case "rm": {
                    if (!params.containerId) {
                        return { success: false, content: "", error: "containerId is required" };
                    }
                    const container = docker.getContainer(params.containerId);
                    await container.remove({ force: true });
                    return { success: true, content: `Container removed: ${params.containerId}` };
                }

                case "logs": {
                    if (!params.containerId) {
                        return { success: false, content: "", error: "containerId is required" };
                    }
                    const container = docker.getContainer(params.containerId);
                    const logs = await container.logs({
                        stdout: true,
                        stderr: true,
                        tail: params.tail || 50,
                    });
                    return { success: true, content: `**Logs for ${params.containerId}**\n\`\`\`\n${logs.toString().trim()}\n\`\`\`` };
                }

                case "exec": {
                    if (!params.containerId || !params.command) {
                        return { success: false, content: "", error: "containerId and command are required" };
                    }
                    const container = docker.getContainer(params.containerId);
                    const exec = await container.exec({
                        Cmd: ["sh", "-c", params.command],
                        AttachStdout: true,
                        AttachStderr: true,
                    });
                    const stream = await exec.start({ Detach: false });
                    const output = await new Promise<string>((resolve) => {
                        let data = "";
                        stream.on("data", (chunk: Buffer) => { data += chunk.toString(); });
                        stream.on("end", () => resolve(data));
                    });
                    return { success: true, content: output.trim() };
                }

                case "pull": {
                    if (!params.image) {
                        return { success: false, content: "", error: "image is required" };
                    }
                    await new Promise<void>((resolve, reject) => {
                        docker.pull(params.image!, (err: any, stream: any) => {
                            if (err) return reject(err);
                            docker.modem.followProgress(stream, (err2: any) => {
                                if (err2) reject(err2);
                                else resolve();
                            });
                        });
                    });
                    return { success: true, content: `Pulled image: ${params.image}` };
                }

                case "stats": {
                    const containers = await docker.listContainers();
                    if (containers.length === 0) {
                        return { success: true, content: "No running containers" };
                    }
                    const lines: string[] = [];
                    for (const c of containers.slice(0, 10)) {
                        const name = c.Names[0]?.replace(/^\//, "") || c.Id.slice(0, 12);
                        lines.push(`• ${name}: ${c.Image} — ${c.State}`);
                    }
                    return { success: true, content: `**Running Containers**\n${lines.join("\n")}` };
                }

                case "build": {
                    return { success: false, content: "", error: "Use exec tool with 'docker build' for builds" };
                }

                default:
                    return { success: false, content: "", error: `Unknown action: ${params.action}` };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Docker error: ${message}` };
        }
    },
};
