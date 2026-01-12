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
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)'
];

// Error Categories for structured error handling
enum ErrorCategory {
    CONFIG = 'CONFIG',           // Missing env vars, wrong addresses
    CHAIN = 'CHAIN',             // Network errors, nonce issues
    VALIDATION = 'VALIDATION',   // Invalid inputs, business logic
    PERMISSION = 'PERMISSION',   // Insufficient allowance/balance
    STATE = 'STATE'              // Invalid state transitions
}

interface StructuredError {
    category: ErrorCategory;
    message: string;
    recovery: string;
    context: any;
}

/**
 * EscrowAgent - Manages escrow smart contract interactions with fail-safe guarantees
 */
export class EscrowAgent extends BaseAgent {
    private escrowContract: ethers.Contract;
    private mneeContract: ethers.Contract;
    private activeEscrows: Set<string> = new Set();
    private mutationQueue: Promise<void> = Promise.resolve();

    constructor(
        privateKey: string,
        rpcUrl: string,
        escrowContractAddress: string,
        mneeTokenAddress: string
    ) {
        super('EscrowAgent', privateKey, rpcUrl);

        this.escrowContract = new ethers.Contract(escrowContractAddress, ESCROW_ABI, this.wallet);
        this.mneeContract = new ethers.Contract(mneeTokenAddress, MNEE_ABI, this.wallet);

        this.log(`✓ Initialized | Escrow: ${escrowContractAddress} | MNEE: ${mneeTokenAddress}`);
        this.listenToEscrowEvents();
    }

    /**
     * Categorize and structure errors for meaningful bus messages
     */
    private categorizeError(error: any, context: string): StructuredError {
        const errorMsg = error.message || String(error);

        // Nonce errors
        if (error.code === 'NONCE_EXPIRED' || errorMsg.includes('nonce')) {
            return {
                category: ErrorCategory.CHAIN,
                message: 'Transaction nonce conflict',
                recovery: 'Automatic retry in progress',
                context: { originalError: errorMsg, operation: context }
            };
        }

        // Insufficient funds/allowance
        if (errorMsg.includes('insufficient') || errorMsg.includes('allowance')) {
            return {
                category: ErrorCategory.PERMISSION,
                message: 'Insufficient MNEE balance or allowance',
                recovery: 'Check wallet balance and token approval',
                context: { originalError: errorMsg, operation: context }
            };
        }

        // Contract revert
        if (errorMsg.includes('revert') || errorMsg.includes('execution reverted')) {
            return {
                category: ErrorCategory.STATE,
                message: 'Smart contract rejected transaction',
                recovery: 'Verify escrow state and parameters',
                context: { originalError: errorMsg, operation: context }
            };
        }

        // Network errors
        if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
            return {
                category: ErrorCategory.CHAIN,
                message: 'Blockchain network error',
                recovery: 'Check RPC connection and retry',
                context: { originalError: errorMsg, operation: context }
            };
        }

        // Default
        return {
            category: ErrorCategory.CONFIG,
            message: errorMsg,
            recovery: 'Contact system administrator',
            context: { originalError: errorMsg, operation: context }
        };
    }

    /**
     * Send structured error to message bus - NEVER FAIL SILENTLY
     */
    private emitError(recipient: string, structuredError: StructuredError, taskId?: string): void {
        const errorPayload = {
            category: structuredError.category,
            error: structuredError.message,
            recovery: structuredError.recovery,
            context: structuredError.context,
            taskId: taskId || 'UNKNOWN',
            timestamp: Date.now()
        };

        this.sendMessage(recipient, MessageType.ERROR, errorPayload);

        // Enhanced logging for Live Bus Activity
        this.log(
            `✗ ${structuredError.category} | ${structuredError.message} | TaskID: ${taskId || 'N/A'}`,
            'error'
        );
    }

    /**
     * Validate escrow creation request before blockchain interaction
     */
    private async validateEscrowRequest(request: EscrowCreateRequest): Promise<StructuredError | null> {
        // 1. Validate taskId
        if (!request.taskId || request.taskId.trim() === '') {
            return {
                category: ErrorCategory.VALIDATION,
                message: 'Invalid taskId: cannot be empty',
                recovery: 'Provide valid task identifier',
                context: { request }
            };
        }

        // 2. Validate provider address
        if (!request.provider || !ethers.isAddress(request.provider)) {
            return {
                category: ErrorCategory.VALIDATION,
                message: `Invalid provider address: ${request.provider}`,
                recovery: 'Provide valid Ethereum address',
                context: { request }
            };
        }

        // 3. Validate amount
        const amount = parseFloat(request.amount);
        if (isNaN(amount) || amount <= 0) {
            return {
                category: ErrorCategory.VALIDATION,
                message: `Invalid amount: ${request.amount}`,
                recovery: 'Amount must be positive number',
                context: { request }
            };
        }

        // 4. Check wallet balance
        try {
            const balance = await this.mneeContract.balanceOf(this.wallet.address);
            const requiredAmount = ethers.parseEther(request.amount);

            if (balance < requiredAmount) {
                return {
                    category: ErrorCategory.PERMISSION,
                    message: `Insufficient MNEE balance: have ${ethers.formatEther(balance)}, need ${request.amount}`,
                    recovery: 'Fund wallet with MNEE tokens',
                    context: { balance: ethers.formatEther(balance), required: request.amount }
                };
            }
        } catch (error: any) {
            return {
                category: ErrorCategory.CHAIN,
                message: 'Failed to check MNEE balance',
                recovery: 'Verify RPC connection',
                context: { error: error.message }
            };
        }

        // 5. Check if escrow already exists
        if (this.activeEscrows.has(request.taskId)) {
            return {
                category: ErrorCategory.STATE,
                message: `Escrow already exists for taskId: ${request.taskId}`,
                recovery: 'Use different taskId or release existing escrow',
                context: { taskId: request.taskId }
            };
        }

        return null; // Validation passed
    }

    /**
     * Execute blockchain transaction with comprehensive error handling
     */
    private async executeTransaction(
        context: string,
        operation: () => Promise<ethers.ContractTransactionResponse>
    ): Promise<ethers.ContractTransactionReceipt | null> {
        let result: ethers.ContractTransactionReceipt | null = null;

        await (this.mutationQueue = this.mutationQueue.then(async () => {
            const maxAttempts = 5;
            let attempts = 0;

            while (attempts < maxAttempts) {
                try {
                    this.log(`[${context}] Executing (Attempt ${attempts + 1}/${maxAttempts})...`);
                    const tx = await operation();

                    this.log(`[${context}] TX Sent: ${tx.hash} | nonce=${(tx as any).nonce}`);
                    result = await tx.wait();

                    this.log(`[${context}] ✓ Confirmed | Block: ${result?.blockNumber}`);
                    break;
                } catch (error: any) {
                    attempts++;
                    const isNonceError = error.code === 'NONCE_EXPIRED' ||
                        (error.message && error.message.includes('nonce'));

                    if (isNonceError && attempts < maxAttempts) {
                        // Gather and log provider nonce info to aid debugging
                        try {
                            const latest = await this.provider.getTransactionCount(this.wallet.address, 'latest');
                            let pending: number | null = null;
                            try { pending = await this.wallet.getNonce('pending'); } catch (e) { }
                            this.log(`[${context}] Nonce conflict detected. Provider expects ${latest + 1} (next), pending reported ${pending}. Retrying (${attempts}/${maxAttempts}) with backoff...`, 'warn');
                        } catch (e) {
                            this.log(`[${context}] Nonce conflict detected. Retrying (${attempts}/${maxAttempts}) with backoff...`, 'warn');
                        }

                        // Backoff increases with attempts to give automining node time to mine previous txs
                        await new Promise(r => setTimeout(r, 1500 + attempts * 1000 + Math.random() * 1000));

                        // Attempt to advance the provider state so nonce is updated
                        try {
                            await this.provider.getBlockNumber();
                        } catch (e) {
                            // ignore provider read errors during backoff
                        }

                        continue;
                    }

                    // Max retries exhausted or non-retryable error
                    this.log(`[${context}] ✗ Failed: ${error.message}`, 'error');
                    throw error;
                }
            }
        }).catch(error => {
            this.log(`[${context}] Queue error: ${error.message}`, 'error');
            throw error;
        }));

        return result;
    }

    private async getTxOptions(): Promise<Record<string, unknown>> {
        // Use latest mined nonce to avoid "nonce too low" errors on automining
        // networks where transactions are mined immediately and pending queueing
        // semantics differ from typical mempool behavior.
        try {
            const latest = await this.provider.getTransactionCount(this.wallet.address, 'latest');
            let pending: number | null = null;
            try {
                pending = await this.wallet.getNonce('pending');
            } catch (e) {
                // ignore
            }

            this.log(`getTxOptions: nonce.latest=${latest} nonce.pending=${pending}`);

            return { nonce: latest };
        } catch (e) {
            // If provider call fails for any reason, fall back to not specifying nonce
            return {};
        }
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
     * Handle escrow creation with FAIL-SAFE guarantees
     */
    private async handleCreateEscrow(message: Message): Promise<void> {
        const request = message.payload as EscrowCreateRequest;
        const taskId = request.taskId || 'UNKNOWN';

        this.log(`→ EscrowCreateRequest | TaskID: ${taskId} | Amount: ${request.amount} MNEE`);

        try {
            // STEP 1: Validate request
            const validationError = await this.validateEscrowRequest(request);
            if (validationError) {
                this.emitError(message.from, validationError, taskId);
                return;
            }

            const amount = ethers.parseEther(request.amount);

            // STEP 2: Check/Approve MNEE allowance
            const escrowAddress = await this.escrowContract.getAddress();
            const currentAllowance = await this.mneeContract.allowance(
                this.wallet.address,
                escrowAddress
            );

            if (currentAllowance < amount) {
                this.log(`Approving MNEE (Infinite)...`);
                await this.executeTransaction('Approve MNEE', async () => {
                    const opts = await this.getTxOptions();
                    return this.mneeContract.approve(escrowAddress, ethers.MaxUint256, opts);
                });
            }

            // STEP 3: Create escrow on-chain
            const receipt = await this.executeTransaction('Create Escrow', async () => {
                const opts = await this.getTxOptions();
                return this.escrowContract.createEscrow(
                    request.taskId,
                    request.provider,
                    amount,
                    request.milestones || 1,
                    opts
                );
            });

            if (receipt) {
                this.activeEscrows.add(request.taskId);

                const created: EscrowCreated = {
                    escrowId: request.taskId,
                    taskId: request.taskId,
                    amount: request.amount,
                    txHash: receipt.hash
                };

                this.sendMessage(message.from, MessageType.ESCROW_CREATED, created);
                this.log(`✓ EscrowLocked | TaskID: ${taskId} | Amount: ${request.amount} MNEE | TX: ${receipt.hash}`);
            }

        } catch (error: any) {
            const structuredError = this.categorizeError(error, 'escrow_creation');
            this.emitError(message.from, structuredError, taskId);
        }
    }

    /**
     * Handle work proof submission with guaranteed response
     */
    private async handleWorkProofSubmission(message: Message): Promise<void> {
        const { taskId, milestoneIndex, workHash } = message.payload;

        try {
            const receipt = await this.executeTransaction('Submit Proof', async () => {
                const opts = await this.getTxOptions();
                return this.escrowContract.submitWorkProof(taskId, milestoneIndex, workHash, opts);
            });

            if (receipt) {
                this.broadcast(MessageType.WORK_PROOF_SUBMITTED, { taskId, milestoneIndex, workHash });
                this.log(`✓ ProofSubmitted | TaskID: ${taskId} | Milestone: ${milestoneIndex}`);
            }
        } catch (error: any) {
            const structuredError = this.categorizeError(error, 'proof_submission');
            this.emitError(message.from, structuredError, taskId);
        }
    }

    /**
     * Handle proof verification with guaranteed response
     */
    private async handleWorkProofVerification(message: Message): Promise<void> {
        const { taskId, milestoneIndex } = message.payload;

        try {
            const receipt = await this.executeTransaction('Verify Proof', async () => {
                const opts = await this.getTxOptions();
                return this.escrowContract.verifyWorkProof(taskId, milestoneIndex, opts);
            });

            if (receipt) {
                this.broadcast(MessageType.WORK_PROOF_VERIFIED, { taskId, milestoneIndex, isVerified: true });
                this.log(`✓ ProofVerified | TaskID: ${taskId} | Milestone: ${milestoneIndex}`);
            }
        } catch (error: any) {
            const structuredError = this.categorizeError(error, 'proof_verification');
            this.emitError(message.from, structuredError, taskId);
        }
    }

    /**
     * Handle escrow release with guaranteed response
     */
    private async handleEscrowRelease(message: Message): Promise<void> {
        const { taskId, milestoneIndex } = message.payload;

        try {
            const receipt = await this.executeTransaction('Release Milestone', async () => {
                const opts = await this.getTxOptions();
                return this.escrowContract.releaseMilestone(taskId, milestoneIndex, opts);
            });

            if (receipt) {
                this.sendMessage(message.from, MessageType.MILESTONE_RELEASED, {
                    taskId,
                    milestoneIndex,
                    txHash: receipt.hash
                });
                this.log(`✓ MilestoneReleased | TaskID: ${taskId} | Index: ${milestoneIndex} | TX: ${receipt.hash}`);
            }
        } catch (error: any) {
            const structuredError = this.categorizeError(error, 'milestone_release');
            this.emitError(message.from, structuredError, taskId);
        }
    }

    private async handleDisputeResolution(message: Message): Promise<void> {
        const { taskId, resolution } = message.payload;
        const resolutionMap: any = { 'FULL': 2, 'PARTIAL': 3, 'REFUND': 4 };

        try {
            const receipt = await this.executeTransaction('Resolve Dispute', async () => {
                const opts = await this.getTxOptions();
                return this.escrowContract.resolveDispute(taskId, resolutionMap[resolution], opts);
            });

            if (receipt) {
                this.broadcast(MessageType.DISPUTE_RESOLVED, { taskId, resolution });
                this.log(`✓ DisputeResolved | TaskID: ${taskId} | Resolution: ${resolution}`);
            }
        } catch (error: any) {
            const structuredError = this.categorizeError(error, 'dispute_resolution');
            this.emitError(message.from, structuredError, taskId);
        }
    }

    /**
     * Listen to escrow contract events
     */
    private listenToEscrowEvents(): void {
        this.escrowContract.on('EscrowCreated', (taskId: string, payer: string, agent: string, amount: bigint, milestones: number) => {
            this.log(`Event: EscrowCreated | TaskID: ${taskId} | Milestones: ${milestones}`);
        });

        this.escrowContract.on('MilestoneReleased', (taskId: string, milestoneIndex: number, amount: bigint) => {
            this.log(`Event: MilestoneReleased | TaskID: ${taskId} | Index: ${milestoneIndex}`);
        });

        this.escrowContract.on('EscrowCompleted', (taskId: string) => {
            this.log(`Event: EscrowCompleted | TaskID: ${taskId}`);
            this.activeEscrows.delete(taskId);
        });

        this.escrowContract.on('DisputeRaised', (taskId: string, raiser: string) => {
            this.log(`Event: DisputeRaised | TaskID: ${taskId} | Raiser: ${raiser}`, 'warn');
            this.broadcast(MessageType.DISPUTE_RAISED, { taskId, raiser });
        });

        this.escrowContract.on('ReputationUpdated', (agent: string, newReputation: bigint) => {
            this.log(`Event: ReputationUpdated | Agent: ${agent} | Score: ${newReputation}`);
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
