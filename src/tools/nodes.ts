import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

// Registered nodes/devices
const registeredNodes: Map<string, NodeDevice> = new Map();

type NodeDevice = {
    id: string;
    name: string;
    type: "light" | "switch" | "sensor" | "thermostat" | "custom";
    state: Record<string, unknown>;
    lastSeen: Date;
    capabilities: string[];
};

const NodesActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("register"),
        nodeId: z.string(),
        name: z.string(),
        type: z.enum(["light", "switch", "sensor", "thermostat", "custom"]),
        capabilities: z.array(z.string()).optional().default([]),
    }),
    z.object({
        action: z.literal("unregister"),
        nodeId: z.string(),
    }),
    z.object({
        action: z.literal("list"),
        type: z.enum(["light", "switch", "sensor", "thermostat", "custom"]).optional(),
    }),
    z.object({
        action: z.literal("get_state"),
        nodeId: z.string(),
    }),
    z.object({
        action: z.literal("set_state"),
        nodeId: z.string(),
        state: z.record(z.unknown()),
    }),
    z.object({
        action: z.literal("send_command"),
        nodeId: z.string(),
        command: z.string(),
        params: z.record(z.unknown()).optional(),
    }),
]);

type NodesAction = z.infer<typeof NodesActionSchema>;

export const nodesTool: AgentTool<NodesAction> = {
    name: "nodes",
    description: "Control and monitor IoT devices/nodes: lights, switches, sensors, thermostats.",
    category: "device",
    parameters: NodesActionSchema,

    async execute(params: NodesAction, _context: ToolCallContext): Promise<ToolResult> {
        switch (params.action) {
            case "register": {
                const node: NodeDevice = {
                    id: params.nodeId,
                    name: params.name,
                    type: params.type,
                    state: {},
                    lastSeen: new Date(),
                    capabilities: params.capabilities,
                };
                registeredNodes.set(params.nodeId, node);
                return {
                    success: true,
                    content: `Registered node: ${params.name} (${params.type})`,
                    metadata: { nodeId: params.nodeId },
                };
            }

            case "unregister": {
                if (!registeredNodes.has(params.nodeId)) {
                    return { success: false, content: "", error: `Node not found: ${params.nodeId}` };
                }
                registeredNodes.delete(params.nodeId);
                return { success: true, content: `Unregistered node: ${params.nodeId}` };
            }

            case "list": {
                let nodes = Array.from(registeredNodes.values());
                if (params.type) {
                    nodes = nodes.filter(n => n.type === params.type);
                }

                if (nodes.length === 0) {
                    return { success: true, content: "No nodes registered." };
                }

                const list = nodes.map(n =>
                    `• ${n.name} (${n.id})\n  Type: ${n.type}\n  Capabilities: ${n.capabilities.join(", ") || "none"}`
                ).join("\n\n");

                return { success: true, content: list, metadata: { count: nodes.length } };
            }

            case "get_state": {
                const node = registeredNodes.get(params.nodeId);
                if (!node) {
                    return { success: false, content: "", error: `Node not found: ${params.nodeId}` };
                }

                return {
                    success: true,
                    content: JSON.stringify({
                        name: node.name,
                        type: node.type,
                        state: node.state,
                        lastSeen: node.lastSeen.toISOString(),
                    }, null, 2),
                };
            }

            case "set_state": {
                const node = registeredNodes.get(params.nodeId);
                if (!node) {
                    return { success: false, content: "", error: `Node not found: ${params.nodeId}` };
                }

                node.state = { ...node.state, ...params.state };
                node.lastSeen = new Date();

                // Simulate device action based on state
                const stateStr = JSON.stringify(params.state);
                return {
                    success: true,
                    content: `Updated state for ${node.name}: ${stateStr}`,
                    metadata: { nodeId: params.nodeId, newState: node.state },
                };
            }

            case "send_command": {
                const node = registeredNodes.get(params.nodeId);
                if (!node) {
                    return { success: false, content: "", error: `Node not found: ${params.nodeId}` };
                }

                // Simulate command execution
                node.lastSeen = new Date();

                // Handle common commands
                switch (params.command) {
                    case "turn_on":
                        node.state = { ...node.state, on: true };
                        break;
                    case "turn_off":
                        node.state = { ...node.state, on: false };
                        break;
                    case "toggle":
                        node.state = { ...node.state, on: !node.state.on };
                        break;
                    case "set_brightness":
                        node.state = { ...node.state, brightness: params.params?.level ?? 100 };
                        break;
                    case "set_temperature":
                        node.state = { ...node.state, targetTemp: params.params?.temp };
                        break;
                }

                return {
                    success: true,
                    content: `Executed command '${params.command}' on ${node.name}`,
                    metadata: { nodeId: params.nodeId, command: params.command, newState: node.state },
                };
            }
        }
    },
};

// MQTT/WebSocket integration stubs for real device integration
export async function connectMQTT(_brokerUrl: string): Promise<void> {
    console.log("MQTT connection stub - implement with mqtt.js for real devices");
}

export async function connectHomeAssistant(_haUrl: string, _token: string): Promise<void> {
    console.log("Home Assistant connection stub - implement with HA WebSocket API");
}
