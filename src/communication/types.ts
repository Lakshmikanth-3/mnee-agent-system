/**
 * Message types for inter-agent communication
 */

export enum MessageType {
    // Task-related messages
    TASK_REQUEST = 'TASK_REQUEST',
    TASK_RESPONSE = 'TASK_RESPONSE',
    TASK_ASSIGNED = 'TASK_ASSIGNED',
    TASK_COMPLETED = 'TASK_COMPLETED',

    // Escrow-related messages
    ESCROW_CREATE_REQUEST = 'ESCROW_CREATE_REQUEST',
    ESCROW_CREATED = 'ESCROW_CREATED',
    ESCROW_RELEASE_REQUEST = 'ESCROW_RELEASE_REQUEST',
    ESCROW_RELEASED = 'ESCROW_RELEASED',

    // Proof-of-Work messages
    SUBMIT_WORK_PROOF = 'SUBMIT_WORK_PROOF',
    WORK_PROOF_SUBMITTED = 'WORK_PROOF_SUBMITTED',
    VERIFY_WORK_PROOF = 'VERIFY_WORK_PROOF',
    WORK_PROOF_VERIFIED = 'WORK_PROOF_VERIFIED',

    // Milestone & Dispute messages
    MILESTONE_RELEASED = 'MILESTONE_RELEASED',
    RAISE_DISPUTE = 'RAISE_DISPUTE',
    DISPUTE_RAISED = 'DISPUTE_RAISED',
    RESOLVE_DISPUTE = 'RESOLVE_DISPUTE',
    DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',

    // Audit messages
    AUDIT_REQUEST = 'AUDIT_REQUEST',
    AUDIT_COMPLETED = 'AUDIT_COMPLETED',

    // Budget-related messages
    BUDGET_CHECK_REQUEST = 'BUDGET_CHECK_REQUEST',
    BUDGET_APPROVED = 'BUDGET_APPROVED',
    BUDGET_REJECTED = 'BUDGET_REJECTED',

    // Status updates
    STATUS_UPDATE = 'STATUS_UPDATE',
    REPUTATION_UPDATED = 'REPUTATION_UPDATED',
    USER_TASK_REQUEST = 'USER_TASK_REQUEST',
    ERROR = 'ERROR'
}

export interface Message {
    id: string;
    type: MessageType;
    from: string;
    to: string;
    timestamp: number;
    payload: any;
}

export interface TaskRequest {
    taskId: string;
    description: string;
    requirements: string[];
}

export interface TaskResponse {
    taskId: string;
    accepted: boolean;
    priceInMNEE: string;
    estimatedDuration?: string;
    reason?: string;
}

export interface EscrowCreateRequest {
    taskId: string;
    provider: string;
    amount: string;
    milestones: number;
}

export interface EscrowCreated {
    escrowId: string;
    taskId: string;
    amount: string;
    txHash: string;
}

export interface BudgetCheckRequest {
    amount: string;
    purpose: string;
}

export interface BudgetApproval {
    approved: boolean;
    remainingBalance: string;
    reason?: string;
}

export interface TaskCompletion {
    taskId: string;
    escrowId: string;
    results: any;
}

export interface AgentStatus {
    agentName: string;
    balance: string;
    activeTasks: number;
    totalTasksCompleted: number;
    status: 'active' | 'busy' | 'idle';
}

export interface WorkProofSubmission {
    taskId: string;
    milestoneIndex: number;
    workHash: string;
}

export interface WorkProofVerification {
    taskId: string;
    milestoneIndex: number;
    isVerified: boolean;
}

export interface AuditRequest {
    taskId: string;
    milestoneIndex: number;
    content: any;
}

export interface AuditResult {
    taskId: string;
    milestoneIndex: number;
    passed: boolean;
    reason: string;
}

export interface DisputeRequest {
    taskId: string;
    reason: string;
}

export interface DisputeResolution {
    taskId: string;
    resolution: 'FULL' | 'PARTIAL' | 'REFUND';
}

export interface ReputationUpdate {
    agentName: string;
    newReputation: number;
}

export interface UserTaskRequest {
    taskDescription: string;
    requirements: string[];
    targetAgent?: string;
}
