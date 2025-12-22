import { BaseAgent } from './BaseAgent';
import {
    Message,
    MessageType,
    TaskRequest,
    TaskResponse,
    BudgetCheckRequest,
    EscrowCreateRequest,
    TaskCompletion
} from '../communication/types';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';

interface HiredAgent {
    name: string;
    address: string;
    taskId: string;
    price: string;
    escrowId?: string;
    status: 'negotiating' | 'escrow_pending' | 'working' | 'completed';
}

/**
 * StartupAgent - Main coordinator managing budget and hiring other agents
 */
export class StartupAgent extends BaseAgent {
    private mneeTokenAddress: string;
    private hiredAgents: Map<string, HiredAgent> = new Map();
    private pendingTasks: Map<string, any> = new Map();

    constructor(
        privateKey: string,
        rpcUrl: string,
        mneeTokenAddress: string
    ) {
        super('StartupAgent', privateKey, rpcUrl);
        this.mneeTokenAddress = mneeTokenAddress;
        this.log('StartupAgent initialized and ready to coordinate tasks');
    }

    protected async handleMessage(message: Message): Promise<void> {
        switch (message.type) {
            case MessageType.TASK_RESPONSE:
                await this.handleTaskResponse(message);
                break;
            case MessageType.BUDGET_APPROVED:
                await this.handleBudgetApproved(message);
                break;
            case MessageType.BUDGET_REJECTED:
                await this.handleBudgetRejected(message);
                break;
            case MessageType.ESCROW_CREATED:
                await this.handleEscrowCreated(message);
                break;
            case MessageType.TASK_COMPLETED:
                await this.handleTaskCompleted(message);
                break;
            case MessageType.AUDIT_COMPLETED:
                await this.handleAuditCompleted(message);
                break;
            case MessageType.WORK_PROOF_SUBMITTED:
                await this.handleWorkProofSubmitted(message);
                break;
            case MessageType.WORK_PROOF_VERIFIED:
                await this.handleWorkProofVerified(message);
                break;
            case MessageType.MILESTONE_RELEASED:
                await this.handleMilestoneReleased(message);
                break;
            case MessageType.DISPUTE_RAISED:
                this.log(`ATTENTION: Dispute detected for task ${message.payload.taskId}`, 'warn');
                break;
            case MessageType.DISPUTE_RESOLVED:
                await this.handleDisputeResolved(message);
                break;
            case MessageType.REPUTATION_UPDATED:
                this.log(`Reputation update: ${message.payload.agent} is now at ${message.payload.newReputation}`);
                break;
            case MessageType.USER_TASK_REQUEST:
                await this.hireAgent(
                    message.payload.taskDescription,
                    message.payload.requirements || []
                );
                break;
            default:
                break;
        }
    }

    /**
     * Hire an agent for a specific task
     */
    async hireAgent(taskDescription: string, requirements: string[]): Promise<void> {
        const taskId = uuidv4();

        this.log(`Initiating task ${taskId}: ${taskDescription}`);

        // Step 1: Discover and request quotes from available agents
        const taskRequest: TaskRequest = {
            taskId,
            description: taskDescription,
            requirements
        };

        this.pendingTasks.set(taskId, {
            description: taskDescription,
            requirements,
            status: 'discovering'
        });

        // Broadcast task request to discover agents
        this.broadcast(MessageType.TASK_REQUEST, taskRequest);
        this.log(`Task request broadcasted, waiting for responses...`);
    }

    /**
     * Handle task response from service agents
     */
    private async handleTaskResponse(message: Message): Promise<void> {
        const response = message.payload as TaskResponse;

        if (!response.accepted) {
            this.log(`Agent ${message.from} rejected task ${response.taskId}: ${response.reason}`, 'warn');
            return;
        }

        this.log(`Agent ${message.from} accepted task ${response.taskId} for ${response.priceInMNEE} MNEE`);

        const task = this.pendingTasks.get(response.taskId);
        if (!task) {
            this.log(`Task ${response.taskId} not found`, 'error');
            return;
        }

        // Step 2: Check budget before proceeding
        const budgetRequest: BudgetCheckRequest = {
            amount: response.priceInMNEE,
            purpose: `Hire ${message.from} for task ${response.taskId}`
        };

        // Store hired agent info
        this.hiredAgents.set(response.taskId, {
            name: message.from,
            address: '', // Will be filled later if needed
            taskId: response.taskId,
            price: response.priceInMNEE,
            status: 'negotiating'
        });

        this.sendMessage('BudgetAgent', MessageType.BUDGET_CHECK_REQUEST, budgetRequest);
        this.log(`Budget check requested for ${response.priceInMNEE} MNEE`);
    }

    /**
     * Handle budget approval
     */
    private async handleBudgetApproved(message: Message): Promise<void> {
        const approval = message.payload;
        this.log(`Budget approved! Remaining balance: ${approval.remainingBalance} MNEE`);

        // Find the task associated with this approval
        const hiredAgent = Array.from(this.hiredAgents.values()).find(
            agent => agent.status === 'negotiating'
        );

        if (!hiredAgent) {
            this.log('No pending agent hire found', 'warn');
            return;
        }

        // Step 3: Create escrow
        hiredAgent.status = 'escrow_pending';

        // Get provider address (in real scenario, would query from agent registry)
        // For now, we'll use a placeholder and let EscrowAgent handle it
        const escrowRequest: EscrowCreateRequest = {
            taskId: hiredAgent.taskId,
            provider: this.wallet.address, // In demo, Startup acts as payer wallet
            amount: hiredAgent.price,
            milestones: 2 // Default 2 milestones
        };

        this.sendMessage('EscrowAgent', MessageType.ESCROW_CREATE_REQUEST, escrowRequest);
        this.log(`Escrow creation requested for task ${hiredAgent.taskId}`);
    }

    /**
     * Handle budget rejection
     */
    private async handleBudgetRejected(message: Message): Promise<void> {
        const rejection = message.payload;
        this.log(`Budget REJECTED: ${rejection.reason}`, 'error');
        this.log('Transaction aborted due to insufficient budget', 'error');

        // Clean up pending task
        const hiredAgent = Array.from(this.hiredAgents.values()).find(
            agent => agent.status === 'negotiating'
        );

        if (hiredAgent) {
            this.hiredAgents.delete(hiredAgent.taskId);
            this.pendingTasks.delete(hiredAgent.taskId);
        }
    }

    /**
     * Handle escrow creation confirmation
     */
    private async handleEscrowCreated(message: Message): Promise<void> {
        const { escrowId, taskId, txHash } = message.payload;

        this.log(`Escrow created: ${escrowId} for task ${taskId} (tx: ${txHash})`);

        const hiredAgent = this.hiredAgents.get(taskId);
        if (!hiredAgent) {
            this.log(`Hired agent for task ${taskId} not found`, 'error');
            return;
        }

        hiredAgent.escrowId = escrowId;
        hiredAgent.status = 'working';

        // Step 4: Assign task to agent
        this.sendMessage(hiredAgent.name, MessageType.TASK_ASSIGNED, {
            taskId,
            escrowId
        });

        this.log(`Task ${taskId} assigned to ${hiredAgent.name}, work in progress...`);
    }

    /**
     * Handle task milestone completion
     */
    private async handleTaskCompleted(message: Message): Promise<void> {
        const completion = message.payload as TaskCompletion;
        const milestoneIndex = completion.results?.milestoneIndex ?? 0;

        this.log(`Task ${completion.taskId} Milestone ${milestoneIndex} output received from ${message.from}`);

        // Step 4.5: Request AI Audit of the content
        this.log(`Triggering AI Audit for Milestone ${milestoneIndex}...`);
        this.sendMessage('AuditorAgent', MessageType.AUDIT_REQUEST, {
            taskId: completion.taskId,
            milestoneIndex,
            content: completion.results
        });
    }

    private async handleAuditCompleted(message: Message): Promise<void> {
        const result = message.payload;
        if (result.passed) {
            this.log(`AI Audit PASSED for task ${result.taskId} [M${result.milestoneIndex}]`);
            // Verification can only happen AFTER proof is submitted (WorkProofSubmitted listener)
            // But we keep track of audit status locally if needed. For demo, we just log.
        } else {
            this.log(`AI Audit FAILED: ${result.reason}`, 'error');
            this.log('Raising dispute based on AI Audit failure...', 'warn');
            this.sendMessage('EscrowAgent', MessageType.RAISE_DISPUTE, { taskId: result.taskId });
        }
    }

    /**
     * Handle work proof submission
     */
    private async handleWorkProofSubmitted(message: Message): Promise<void> {
        const { taskId, milestoneIndex, workHash } = message.payload;
        this.log(`Work proof for ${taskId} [M${milestoneIndex}] detected: ${workHash}`);

        // Automated decision: If it exists, verify it on-chain
        this.sendMessage('EscrowAgent', MessageType.VERIFY_WORK_PROOF, { taskId, milestoneIndex });
    }

    /**
     * Handle work proof verification confirmation
     */
    private async handleWorkProofVerified(message: Message): Promise<void> {
        const { taskId, milestoneIndex } = message.payload;
        this.log(`Proof verified for task ${taskId} [M${milestoneIndex}]. Releasing milestone funds...`);

        this.sendMessage('EscrowAgent', MessageType.ESCROW_RELEASE_REQUEST, { taskId, milestoneIndex });
    }

    /**
     * Handle milestone release confirmation
     */
    private async handleMilestoneReleased(message: Message): Promise<void> {
        const { taskId, milestoneIndex, txHash } = message.payload;
        this.log(`Milestone ${milestoneIndex} released for ${taskId} (tx: ${txHash})`);

        // If this was the last milestone, cleanup
        // (In reality, we'd check totalMilestones from contract)
    }

    private async handleDisputeResolved(message: Message): Promise<void> {
        const { taskId, resolution } = message.payload;
        this.log(`Dispute resolved for ${taskId}: ${resolution}`, 'info');

        const hiredAgent = this.hiredAgents.get(taskId);
        if (hiredAgent) {
            hiredAgent.status = 'completed'; // Simplified cleanup
        }
        this.pendingTasks.delete(taskId);
    }

    /**
     * Get hiring history
     */
    getHiringHistory(): HiredAgent[] {
        return Array.from(this.hiredAgents.values());
    }
}
