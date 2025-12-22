import { BaseAgent } from './BaseAgent';
import { Message, MessageType, EscrowCreateRequest, EscrowCreated } from '../communication/types';
import { ethers } from 'ethers';

const ESCROW_ABI = [
    'function createEscrow(string taskId, address agent, uint256 amount, uint8 milestones)',
    'function submitWorkProof(string taskId, uint8 milestoneIndex, bytes32 workHash)',
    'function verifyWorkProof(string taskId, uint8 milestoneIndex)',
    'function releaseMilestone(string taskId, uint8 milestoneIndex)',
    'function raiseDispute(string taskId)',
    'function resolveDispute(string taskId, uint8 resolution)',
    'function emergencyRefund(string taskId)',
    'function reputations(address agent) view returns (uint256)',
    'function escrows(string taskId) view returns (address payer, address agent, uint256 totalAmount, uint256 paidAmount, uint8 totalMilestones, uint8 milestonesCompleted, bool isActive, bool isCompleted, uint8 disputeStatus)',
    'event EscrowCreated(string indexed taskId, address indexed payer, address indexed agent, uint256 amount, uint8 milestones)',
    'event MilestoneReleased(string indexed taskId, uint8 milestoneIndex, uint256 amount)',
    'event EscrowCompleted(string indexed taskId)',
    'event WorkProofSubmitted(string indexed taskId, uint8 milestoneIndex, address indexed agent, bytes32 workHash)',
    'event WorkProofVerified(string indexed taskId, uint8 milestoneIndex)',
    'event DisputeRaised(string indexed taskId, address indexed raiser)',
    'event DisputeResolved(string indexed taskId, uint8 resolution)',
    'event ReputationUpdated(address indexed agent, uint256 newReputation)'
];

const MNEE_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)'
];

/**
 * EscrowAgent - Manages escrow smart contract interactions
 */
export class EscrowAgent extends BaseAgent {
    private escrowContract: ethers.Contract;
    private mneeContract: ethers.Contract;
    private activeEscrows: Set<string> = new Set(); // taskId

    constructor(
        privateKey: string,
        rpcUrl: string,
        escrowContractAddress: string,
        mneeTokenAddress: string
    ) {
        super('EscrowAgent', privateKey, rpcUrl);

        this.escrowContract = new ethers.Contract(escrowContractAddress, ESCROW_ABI, this.wallet);
        this.mneeContract = new ethers.Contract(mneeTokenAddress, MNEE_ABI, this.wallet);

        this.log(`Initialized with escrow contract: ${escrowContractAddress}`);

        // Listen to escrow events
        this.listenToEscrowEvents();
    }

    protected async handleMessage(message: Message): Promise<void> {
        switch (message.type) {
            case MessageType.ESCROW_CREATE_REQUEST:
                await this.handleCreateEscrow(message);
                break;
            case MessageType.SUBMIT_WORK_PROOF:
                await this.handleWorkProofSubmission(message);
                break;
            case MessageType.VERIFY_WORK_PROOF:
                await this.handleWorkProofVerification(message);
                break;
            case MessageType.ESCROW_RELEASE_REQUEST:
                await this.handleEscrowRelease(message);
                break;
            case MessageType.RESOLVE_DISPUTE:
                await this.handleDisputeResolution(message);
                break;
            default:
                break;
        }
    }

    /**
     * Handle escrow creation request
     */
    private async handleCreateEscrow(message: Message): Promise<void> {
        const request = message.payload as EscrowCreateRequest;

        this.log(`Creating escrow for task ${request.taskId}: ${request.amount} MNEE to ${request.provider}`);

        try {
            const amount = ethers.parseEther(request.amount);

            // Approve MNEE spending
            this.log('Approving MNEE token transfer...');
            const approveTx = await this.mneeContract.approve(
                await this.escrowContract.getAddress(),
                amount
            );
            await approveTx.wait();

            // Create escrow
            this.log('Creating escrow on-chain...');
            const tx = await this.escrowContract.createEscrow(
                request.taskId,
                request.provider,
                amount,
                request.milestones || 1
            );
            const receipt = await tx.wait();

            // Store active task
            this.activeEscrows.add(request.taskId);

            // Send confirmation
            const created: EscrowCreated = {
                escrowId: request.taskId,
                taskId: request.taskId,
                amount: request.amount,
                txHash: receipt.hash
            };

            this.sendMessage(message.from, MessageType.ESCROW_CREATED, created);
            this.log(`Escrow created successfully for task: ${request.taskId}`);

        } catch (error: any) {
            this.log(`Failed to create escrow: ${error.message}`, 'error');
            this.sendMessage(message.from, MessageType.ERROR, {
                error: error.message,
                context: 'escrow_creation'
            });
        }
    }

    /**
     * Handle work proof submission
     */
    private async handleWorkProofSubmission(message: Message): Promise<void> {
        const { taskId, milestoneIndex, workHash } = message.payload;
        this.log(`Submitting proof for task ${taskId} milestone ${milestoneIndex}: ${workHash}`);

        try {
            const tx = await this.escrowContract.submitWorkProof(taskId, milestoneIndex, workHash);
            await tx.wait();
            this.log(`Proof submitted for ${taskId} [Mile: ${milestoneIndex}]`);

            this.broadcast(MessageType.WORK_PROOF_SUBMITTED, { taskId, milestoneIndex, workHash });
        } catch (error: any) {
            this.log(`Failed to submit proof: ${error.message}`, 'error');
        }
    }

    /**
     * Handle proof verification
     */
    private async handleWorkProofVerification(message: Message): Promise<void> {
        const { taskId, milestoneIndex } = message.payload;
        this.log(`Verifying proof for task ${taskId} milestone ${milestoneIndex}`);

        try {
            const tx = await this.escrowContract.verifyWorkProof(taskId, milestoneIndex);
            await tx.wait();
            this.log(`Milestone ${milestoneIndex} verified for ${taskId}`);

            this.broadcast(MessageType.WORK_PROOF_VERIFIED, { taskId, milestoneIndex, isVerified: true });
        } catch (error: any) {
            this.log(`Failed to verify proof: ${error.message}`, 'error');
        }
    }

    /**
     * Handle escrow release
     */
    private async handleEscrowRelease(message: Message): Promise<void> {
        const { taskId, milestoneIndex } = message.payload;

        this.log(`Releasing milestone ${milestoneIndex} for task ${taskId}`);

        try {
            const tx = await this.escrowContract.releaseMilestone(taskId, milestoneIndex);
            const receipt = await tx.wait();

            this.log(`Milestone released: ${receipt.hash}`);

            this.sendMessage(message.from, MessageType.MILESTONE_RELEASED, {
                taskId,
                milestoneIndex,
                txHash: receipt.hash
            });

        } catch (error: any) {
            this.log(`Failed to release milestone: ${error.message}`, 'error');
            this.sendMessage(message.from, MessageType.ERROR, {
                error: error.message,
                context: 'milestone_release'
            });
        }
    }

    private async handleDisputeResolution(message: Message): Promise<void> {
        const { taskId, resolution } = message.payload;
        this.log(`Resolving dispute for ${taskId} with resolution: ${resolution}`);

        // Mapping RESOLVED_FULL=2, RESOLVED_PARTIAL=3, REFUNDED=4
        const resolutionMap: any = { 'FULL': 2, 'PARTIAL': 3, 'REFUND': 4 };

        try {
            const tx = await this.escrowContract.resolveDispute(taskId, resolutionMap[resolution]);
            await tx.wait();
            this.log(`Dispute resolved for ${taskId}`);
            this.broadcast(MessageType.DISPUTE_RESOLVED, { taskId, resolution });
        } catch (error: any) {
            this.log(`Failed to resolve dispute: ${error.message}`, 'error');
        }
    }

    /**
     * Listen to escrow contract events
     */
    private listenToEscrowEvents(): void {
        this.escrowContract.on('EscrowCreated', (taskId: string, payer: string, agent: string, amount: bigint, milestones: number) => {
            this.log(`Event: Escrow created for task ${taskId} with ${milestones} milestones`);
        });

        this.escrowContract.on('MilestoneReleased', (taskId: string, milestoneIndex: number, amount: bigint) => {
            this.log(`Event: Milestone ${milestoneIndex} released for task ${taskId}`);
        });

        this.escrowContract.on('EscrowCompleted', (taskId: string) => {
            this.log(`Event: Escrow completed for task ${taskId}`);
            this.activeEscrows.delete(taskId);
        });

        this.escrowContract.on('DisputeRaised', (taskId: string, raiser: string) => {
            this.log(`Event: Dispute raised for task ${taskId} by ${raiser}`, 'warn');
            this.broadcast(MessageType.DISPUTE_RAISED, { taskId, raiser });
        });

        this.escrowContract.on('ReputationUpdated', (agent: string, newReputation: bigint) => {
            this.log(`Event: Reputation for ${agent} updated to ${newReputation}`);
            this.broadcast(MessageType.REPUTATION_UPDATED, { agent, newReputation: Number(newReputation) });
        });
    }

    async getEscrowDetails(taskId: string): Promise<any> {
        return await this.escrowContract.escrows(taskId);
    }

    async getWorkProof(taskId: string): Promise<any> {
        return await this.escrowContract.workProofs(taskId);
    }
}
