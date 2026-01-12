import { BaseAgent } from './BaseAgent';
import { Message, MessageType, TaskRequest, TaskResponse, TaskCompletion, WorkProofSubmission } from '../communication/types';
import { ethers } from 'ethers';

interface Task {
    id: string;
    description: string;
    requirements: string[];
    price: string;
    milestones: number;
    escrowId?: string;
    status: 'pending' | 'in_progress' | 'completed';
    startedAt?: number;
    completedAt?: number;
}

/**
 * ResearchAgent - Service-providing agent that accepts and executes research tasks
 */
export class ResearchAgent extends BaseAgent {
    private tasks: Map<string, Task> = new Map();
    private basePrice: bigint = ethers.parseEther('10'); // 10 MNEE base price
    private mneeTokenAddress: string;

    constructor(
        privateKey: string,
        rpcUrl: string,
        mneeTokenAddress: string,
        basePrice?: string
    ) {
        super('ResearchAgent', privateKey, rpcUrl);
        this.mneeTokenAddress = mneeTokenAddress;

        if (basePrice) {
            this.basePrice = ethers.parseEther(basePrice);
        }

        this.log(`Initialized with base price: ${ethers.formatEther(this.basePrice)} MNEE`);
    }

    protected async handleMessage(message: Message): Promise<void> {
        switch (message.type) {
            case MessageType.TASK_REQUEST:
                await this.handleTaskRequest(message);
                break;
            case MessageType.TASK_ASSIGNED:
                await this.handleTaskAssignment(message);
                break;
            case MessageType.ESCROW_CREATED:
                await this.handleEscrowCreated(message);
                break;
            default:
                break;
        }
    }

    /**
     * Handle incoming task requests
     */
    private async handleTaskRequest(message: Message): Promise<void> {
        const request = message.payload as TaskRequest;

        this.log(`Received task request: ${request.taskId} - ${request.description}`);

        // Calculate price based on complexity
        const price = this.calculatePrice(request);

        // Check if we can accept the task
        const canAccept = this.activeTasks.size < 5; // Max 5 concurrent tasks

        const response: TaskResponse = {
            taskId: request.taskId,
            accepted: canAccept,
            priceInMNEE: ethers.formatEther(price),
            estimatedDuration: '5-10 minutes',
            responderAddress: this.wallet.address,
            reason: canAccept ? undefined : 'Currently at capacity'
        };

        // Store task if accepted
        if (canAccept) {
            this.tasks.set(request.taskId, {
                id: request.taskId,
                description: request.description,
                requirements: request.requirements,
                price: ethers.formatEther(price),
                milestones: 2, // Default to 2 milestones for demo
                status: 'pending'
            });
        }

        this.sendMessage(message.from, MessageType.TASK_RESPONSE, response);
        this.log(`Task ${request.taskId} ${canAccept ? 'ACCEPTED' : 'REJECTED'} - Price: ${ethers.formatEther(price)} MNEE`);
    }

    /**
     * Handle task assignment after escrow is created
     */
    private async handleTaskAssignment(message: Message): Promise<void> {
        const { taskId, escrowId } = message.payload;

        const task = this.tasks.get(taskId);
        if (!task) {
            this.log(`Task ${taskId} not found`, 'error');
            return;
        }

        this.log(`Task ${taskId} assigned with escrow ${escrowId}, starting work...`);

        task.status = 'in_progress';
        task.escrowId = escrowId;
        task.startedAt = Date.now();
        this.activeTasks.add(taskId);
        this.status = 'busy';

        // Execute the task
        await this.executeTask(task, message.from);
    }

    /**
     * Handle escrow creation confirmation
     */
    private async handleEscrowCreated(message: Message): Promise<void> {
        const { taskId, escrowId } = message.payload;

        const task = this.tasks.get(taskId);
        if (task) {
            task.escrowId = escrowId;
            this.log(`Escrow ${escrowId} confirmed for task ${taskId}`);
        }
    }

    /**
     * Execute a research task with multiple milestones
     */
    private async executeTask(task: Task, requester: string): Promise<void> {
        this.log(`Executing multi-milestone task: ${task.description}`);

        for (let i = 0; i < task.milestones; i++) {
            this.log(`Start Milestone ${i + 1}/${task.milestones}...`);

            // Simulate research work for this milestone
            await this.delay(4000);

            // Generate milestone results
            const results = {
                taskId: task.id,
                milestoneIndex: i,
                progress: `${((i + 1) / task.milestones * 100).toFixed(0)}%`,
                summary: `Milestone ${i + 1} for: ${task.description}`,
                findings: [
                    `Research findings for stage ${i + 1}`,
                    `Data point ${Math.floor(Math.random() * 1000)} validated`
                ],
                quality: 'AgentPay OS Premium'
            };

            // Generate work proof (hash of results)
            const workHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(results)));
            this.log(`[M${i}] Generated work proof: ${workHash}`);

            // 1. Submit work proof to EscrowAgent
            const proofSubmission: WorkProofSubmission = {
                taskId: task.id,
                milestoneIndex: i,
                workHash: workHash
            };
            this.sendMessage('EscrowAgent', MessageType.SUBMIT_WORK_PROOF, proofSubmission);

            // 2. Send milestone completion signal to StartupAgent
            const completion: TaskCompletion = {
                taskId: task.id,
                escrowId: task.escrowId!,
                results
            };
            this.sendMessage(requester, MessageType.TASK_COMPLETED, completion);

            this.log(`Milestone ${i + 1} submitted. Waiting for verification/audit...`);

            // Short delay between milestones
            await this.delay(2000);
        }

        // Mark task as completed
        task.status = 'completed';
        task.completedAt = Date.now();
        this.activeTasks.delete(task.id);
        this.completedTasks++;
        this.status = this.activeTasks.size > 0 ? 'busy' : 'idle';

        this.log(`Full target reached for task ${task.id}`);
    }

    /**
     * Calculate price based on task complexity
     */
    private calculatePrice(request: TaskRequest): bigint {
        let price = this.basePrice;

        // Add cost per requirement
        const requirementCost = ethers.parseEther('2');
        price += requirementCost * BigInt(request.requirements.length);

        // Add cost based on description length (complexity indicator)
        if (request.description.length > 100) {
            price += ethers.parseEther('5');
        }

        return price;
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get task history
     */
    getTaskHistory(): Task[] {
        return Array.from(this.tasks.values());
    }
}
