/**
 * Approval Workflow - Requires user confirmation for dangerous operations
 * 
 * When a command needs approval, we:
 * 1. Display what the command wants to do
 * 2. Wait for user confirmation (CLI) or auto-deny (daemon mode)
 * 3. Log the decision for audit
 */

import { logSecurityEvent } from "./command-filter.js";

export type ApprovalRequest = {
    id: string;
    command: string;
    reason: string;
    severity: "critical" | "high" | "medium";
    requestedAt: Date;
    sessionId?: string;
    source: "cli" | "whatsapp" | "api" | "daemon";
};

export type ApprovalDecision = {
    requestId: string;
    approved: boolean;
    decidedBy: string;  // "user", "policy", "timeout"
    decidedAt: Date;
    reason?: string;
};

// Pending approval requests
const pendingApprovals = new Map<string, ApprovalRequest>();

// Approval callbacks
const approvalCallbacks = new Map<string, (decision: ApprovalDecision) => void>();

/**
 * Request approval for a command
 */
export async function requestApproval(
    request: Omit<ApprovalRequest, "id" | "requestedAt">,
    options: {
        timeout?: number;  // ms, 0 = wait forever
        autoApproveInCLI?: boolean;
    } = {}
): Promise<ApprovalDecision> {
    const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fullRequest: ApprovalRequest = {
        ...request,
        id,
        requestedAt: new Date(),
    };

    pendingApprovals.set(id, fullRequest);

    // Log the approval request
    logSecurityEvent({
        type: "approval_required",
        command: request.command,
        reason: request.reason,
        severity: request.severity,
        sessionId: request.sessionId,
    });

    // In CLI mode with autoApprove, show prompt and wait for input
    if (request.source === "cli" && options.autoApproveInCLI) {
        // Display approval request to user
        console.log("\n" + "=".repeat(60));
        console.log("⚠️  APPROVAL REQUIRED");
        console.log("=".repeat(60));
        console.log(`Command: ${request.command}`);
        console.log(`Reason:  ${request.reason}`);
        console.log(`Severity: ${request.severity.toUpperCase()}`);
        console.log("=".repeat(60));

        // For now, just deny in non-interactive mode
        // Real implementation would wait for user input
        const decision: ApprovalDecision = {
            requestId: id,
            approved: false,
            decidedBy: "policy",
            decidedAt: new Date(),
            reason: "Automatic denial in non-interactive mode",
        };

        pendingApprovals.delete(id);
        return decision;
    }

    // In daemon mode, apply policy-based decisions
    if (request.source === "daemon" || request.source === "api") {
        const decision: ApprovalDecision = {
            requestId: id,
            approved: false,
            decidedBy: "policy",
            decidedAt: new Date(),
            reason: "Automatic denial in daemon mode - dangerous commands require CLI approval",
        };

        logSecurityEvent({
            type: "denied",
            command: request.command,
            reason: decision.reason,
            sessionId: request.sessionId,
        });

        pendingApprovals.delete(id);
        return decision;
    }

    // For WhatsApp/other sources, deny by default
    const decision: ApprovalDecision = {
        requestId: id,
        approved: false,
        decidedBy: "policy",
        decidedAt: new Date(),
        reason: `Automatic denial for ${request.source} source - use CLI for dangerous commands`,
    };

    logSecurityEvent({
        type: "denied",
        command: request.command,
        reason: decision.reason,
        sessionId: request.sessionId,
    });

    pendingApprovals.delete(id);
    return decision;
}

/**
 * Manual approval (for CLI interactive mode)
 */
export function approveRequest(requestId: string, approved: boolean, reason?: string): ApprovalDecision {
    const request = pendingApprovals.get(requestId);
    if (!request) {
        throw new Error(`No pending approval request: ${requestId}`);
    }

    const decision: ApprovalDecision = {
        requestId,
        approved,
        decidedBy: "user",
        decidedAt: new Date(),
        reason,
    };

    logSecurityEvent({
        type: approved ? "approved" : "denied",
        command: request.command,
        reason: reason || (approved ? "User approved" : "User denied"),
        sessionId: request.sessionId,
    });

    pendingApprovals.delete(requestId);

    // Trigger callback if waiting
    const callback = approvalCallbacks.get(requestId);
    if (callback) {
        callback(decision);
        approvalCallbacks.delete(requestId);
    }

    return decision;
}

/**
 * Get all pending approval requests
 */
export function getPendingApprovals(): ApprovalRequest[] {
    return Array.from(pendingApprovals.values());
}

/**
 * Check if a source is allowed to execute commands without approval
 */
export function isTrustedSource(source: string): boolean {
    // Only CLI is trusted for dangerous commands
    return source === "cli";
}

/**
 * Policy: Should this command be auto-approved based on context?
 */
export function shouldAutoApprove(command: string, context: {
    source: string;
    workspaceDir?: string;
}): boolean {
    // Never auto-approve from untrusted sources
    if (!isTrustedSource(context.source)) {
        return false;
    }

    // File operations within workspace are auto-approved
    if (context.workspaceDir) {
        const wsPath = context.workspaceDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const inWorkspace = new RegExp(`^(mkdir|touch|cp|mv)\\s+${wsPath}`);
        if (inWorkspace.test(command)) {
            return true;
        }
    }

    return false;
}
