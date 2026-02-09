import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as os from "node:os";

const execAsync = promisify(exec);

const SystemInfoActionSchema = z.object({
    action: z.enum(["overview", "cpu", "memory", "disk", "network", "battery", "processes"]).describe("What system info to retrieve"),
    count: z.number().optional().default(10).describe("Number of top processes to show"),
});

type SystemInfoAction = z.infer<typeof SystemInfoActionSchema>;

export const systemInfoTool: AgentTool<SystemInfoAction> = {
    name: "system_info",
    description: "Get system information: CPU, memory, disk, network, battery, and running processes.",
    category: "system",
    parameters: SystemInfoActionSchema,

    async execute(params: SystemInfoAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            switch (params.action) {
                case "overview": {
                    const cpus = os.cpus();
                    const totalMem = os.totalmem();
                    const freeMem = os.freemem();
                    const usedMem = totalMem - freeMem;
                    const uptime = os.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const mins = Math.floor((uptime % 3600) / 60);

                    let diskInfo = "";
                    try {
                        const diskCmd = process.platform === "win32"
                            ? "wmic logicaldisk get size,freespace,caption"
                            : "df -h / | tail -1";
                        const { stdout } = await execAsync(diskCmd);
                        diskInfo = stdout.trim();
                    } catch { /* ignore */ }

                    return {
                        success: true,
                        content: [
                            `**System Overview**`,
                            `• Hostname: ${os.hostname()}`,
                            `• OS: ${os.type()} ${os.release()} (${os.arch()})`,
                            `• CPU: ${cpus[0]?.model || "Unknown"} (${cpus.length} cores)`,
                            `• Memory: ${(usedMem / 1024 / 1024 / 1024).toFixed(1)} GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(1)} GB (${Math.round(usedMem / totalMem * 100)}% used)`,
                            `• Uptime: ${hours}h ${mins}m`,
                            `• Node.js: ${process.version}`,
                            diskInfo ? `• Disk: ${diskInfo}` : "",
                        ].filter(Boolean).join("\n"),
                    };
                }

                case "cpu": {
                    const cpus = os.cpus();
                    const loadAvg = os.loadavg();
                    return {
                        success: true,
                        content: [
                            `**CPU Info**`,
                            `• Model: ${cpus[0]?.model || "Unknown"}`,
                            `• Cores: ${cpus.length}`,
                            `• Speed: ${cpus[0]?.speed || 0} MHz`,
                            `• Load Average: ${loadAvg.map(l => l.toFixed(2)).join(", ")} (1m, 5m, 15m)`,
                        ].join("\n"),
                    };
                }

                case "memory": {
                    const total = os.totalmem();
                    const free = os.freemem();
                    const used = total - free;
                    const toGB = (b: number) => (b / 1024 / 1024 / 1024).toFixed(2);

                    return {
                        success: true,
                        content: [
                            `**Memory**`,
                            `• Total: ${toGB(total)} GB`,
                            `• Used: ${toGB(used)} GB (${Math.round(used / total * 100)}%)`,
                            `• Free: ${toGB(free)} GB`,
                        ].join("\n"),
                    };
                }

                case "disk": {
                    let cmd: string;
                    if (process.platform === "win32") {
                        cmd = "wmic logicaldisk get caption,freespace,size /format:table";
                    } else if (process.platform === "darwin") {
                        cmd = "df -h | head -20";
                    } else {
                        cmd = "df -h --total | head -20";
                    }
                    const { stdout } = await execAsync(cmd);
                    return { success: true, content: `**Disk Usage**\n\`\`\`\n${stdout.trim()}\n\`\`\`` };
                }

                case "network": {
                    const interfaces = os.networkInterfaces();
                    const lines: string[] = ["**Network Interfaces**"];
                    for (const [name, addrs] of Object.entries(interfaces)) {
                        if (!addrs) continue;
                        for (const addr of addrs) {
                            if (addr.family === "IPv4") {
                                lines.push(`• ${name}: ${addr.address} (${addr.internal ? "internal" : "external"})`);
                            }
                        }
                    }
                    return { success: true, content: lines.join("\n") };
                }

                case "battery": {
                    if (process.platform === "darwin") {
                        try {
                            const { stdout } = await execAsync("pmset -g batt");
                            return { success: true, content: `**Battery**\n${stdout.trim()}` };
                        } catch {
                            return { success: true, content: "No battery found (desktop Mac)" };
                        }
                    } else if (process.platform === "win32") {
                        try {
                            const { stdout } = await execAsync("WMIC PATH Win32_Battery Get EstimatedChargeRemaining,BatteryStatus /format:list");
                            return { success: true, content: `**Battery**\n${stdout.trim()}` };
                        } catch {
                            return { success: true, content: "No battery found or WMIC unavailable" };
                        }
                    } else {
                        // Linux
                        try {
                            const { stdout } = await execAsync("cat /sys/class/power_supply/BAT0/capacity 2>/dev/null && cat /sys/class/power_supply/BAT0/status 2>/dev/null");
                            return { success: true, content: `**Battery**\n${stdout.trim()}` };
                        } catch {
                            return { success: true, content: "No battery found" };
                        }
                    }
                }

                case "processes": {
                    const count = params.count || 10;
                    let cmd: string;
                    if (process.platform === "win32") {
                        cmd = `tasklist /FO TABLE /NH | sort /R | more +1 | findstr /N "^" | findstr /B "[1-${count}]:"`;
                    } else if (process.platform === "darwin") {
                        cmd = `ps aux | sort -k3 -r | head -${count + 1}`;
                    } else {
                        cmd = `ps aux --sort=-%cpu | head -${count + 1}`;
                    }
                    try {
                        const { stdout } = await execAsync(cmd);
                        return { success: true, content: `**Top ${count} Processes (by CPU)**\n\`\`\`\n${stdout.trim()}\n\`\`\`` };
                    } catch {
                        // Fallback for Windows if the complex pipe fails
                        if (process.platform === "win32") {
                            const { stdout } = await execAsync("tasklist /FO TABLE");
                            return { success: true, content: `**Running Processes**\n\`\`\`\n${stdout.trim()}\n\`\`\`` };
                        }
                        throw new Error("Failed to list processes");
                    }
                }

                default:
                    return { success: false, content: "", error: `Unknown action: ${params.action}` };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `System info error: ${message}` };
        }
    },
};
