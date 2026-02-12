/**
 * A2A Protocol Types — Agent2Agent Protocol (RC v1.0)
 * 
 * TypeScript interfaces matching the A2A specification data model.
 * See: https://a2a-protocol.org/latest/specification/
 */

// ============== TASK LIFECYCLE ==============

export type TaskState =
    | "submitted"
    | "working"
    | "completed"
    | "failed"
    | "canceled"
    | "input-required"
    | "rejected"
    | "auth-required";

export interface TaskStatus {
    state: TaskState;
    message?: A2AMessage;
    timestamp?: string;
}

export interface A2ATask {
    id: string;
    contextId?: string;
    status: TaskStatus;
    artifacts?: Artifact[];
    history?: A2AMessage[];
    metadata?: Record<string, unknown>;
}

// ============== MESSAGES & PARTS ==============

export type Role = "user" | "agent";

export interface Part {
    text?: string;
    data?: unknown;
    metadata?: Record<string, unknown>;
    mediaType?: string;
    filename?: string;
}

export interface A2AMessage {
    messageId: string;
    contextId?: string;
    taskId?: string;
    role: Role;
    parts: Part[];
    metadata?: Record<string, unknown>;
    extensions?: string[];
    referenceTaskIds?: string[];
}

export interface Artifact {
    artifactId: string;
    name?: string;
    description?: string;
    parts: Part[];
    metadata?: Record<string, unknown>;
    extensions?: string[];
}

// ============== AGENT CARD ==============

export interface AgentSkill {
    id: string;
    name: string;
    description: string;
    tags?: string[];
    examples?: string[];
    inputModes?: string[];
    outputModes?: string[];
}

export interface AgentCapabilities {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
}

export interface AgentProvider {
    organization: string;
    url?: string;
}

export interface SupportedInterface {
    url: string;
    protocolBinding: "JSONRPC" | "GRPC" | "HTTP+JSON";
    protocolVersion: string;
}

export interface AgentCard {
    name: string;
    description: string;
    version: string;
    supportedInterfaces: SupportedInterface[];
    provider?: AgentProvider;
    iconUrl?: string;
    documentationUrl?: string;
    capabilities: AgentCapabilities;
    defaultInputModes: string[];
    defaultOutputModes: string[];
    skills: AgentSkill[];
}

// ============== JSON-RPC 2.0 ==============

export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number;
    result?: unknown;
    error?: JsonRpcError;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

// ============== REQUEST/RESPONSE PARAMS ==============

export interface SendMessageParams {
    message: A2AMessage;
    configuration?: {
        acceptedOutputModes?: string[];
        blocking?: boolean;
    };
    metadata?: Record<string, unknown>;
}

export interface GetTaskParams {
    id: string;
    historyLength?: number;
}

export interface CancelTaskParams {
    id: string;
}

// ============== A2A ERROR CODES ==============

export const A2AErrorCodes = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    TASK_NOT_FOUND: -32001,
    TASK_NOT_CANCELABLE: -32002,
    CONTENT_TYPE_NOT_SUPPORTED: -32003,
    UNSUPPORTED_OPERATION: -32004,
} as const;
