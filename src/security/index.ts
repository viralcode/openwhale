/**
 * Security module exports
 */

export {
    checkCommand,
    sanitizeOutput,
    logSecurityEvent,
    getRecentEvents,
    ALLOWED_COMMANDS,
    BLOCKED_PATTERNS,
    APPROVAL_REQUIRED_PREFIXES,
    type CommandCheckResult,
    type SecurityEvent,
} from "./command-filter.js";

export {
    requestApproval,
    approveRequest,
    getPendingApprovals,
    isTrustedSource,
    shouldAutoApprove,
    type ApprovalRequest,
    type ApprovalDecision,
} from "./approval.js";

export {
    logAuditEvent,
    auditCommand,
    auditToolExecution,
    auditFileAccess,
    auditNetworkRequest,
    getAuditLogPath,
    listAuditLogs,
    type AuditEvent,
} from "./audit.js";

export {
    runInSandbox,
    ensureImage,
    isDockerAvailable,
    type SandboxConfig,
    type SandboxResult,
} from "./sandbox.js";
