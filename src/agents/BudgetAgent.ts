import { BaseAgent } from './BaseAgent';
import { Message, MessageType, BudgetCheckRequest, BudgetApproval } from '../communication/types';
import { ethers } from 'ethers';

interface BudgetLimits {
    totalBudget: bigint;
    dailyLimit: bigint;
    perTaskLimit: bigint;
}

interface SpendingRecord {
    amount: bigint;
    timestamp: number;
    purpose: string;
}

/**
 * BudgetAgent - Enforces financial discipline and spending limits
 */
export class BudgetAgent extends BaseAgent {
    private limits: BudgetLimits;
    private spendingHistory: SpendingRecord[] = [];
    private mneeTokenAddress: string;

    constructor(
        privateKey: string,
        rpcUrl: string,
        mneeTokenAddress: string,
        limits?: Partial<BudgetLimits>
    ) {
        super('BudgetAgent', privateKey, rpcUrl);
        this.mneeTokenAddress = mneeTokenAddress;

        // Set default limits or use provided ones
        this.limits = {
            totalBudget: limits?.totalBudget || ethers.parseEther('10000'),
            dailyLimit: limits?.dailyLimit || ethers.parseEther('1000'),
            perTaskLimit: limits?.perTaskLimit || ethers.parseEther('100')
        };

        this.log(`Initialized with limits - Total: ${ethers.formatEther(this.limits.totalBudget)} MNEE, Daily: ${ethers.formatEther(this.limits.dailyLimit)} MNEE, Per-Task: ${ethers.formatEther(this.limits.perTaskLimit)} MNEE`);
    }

    protected async handleMessage(message: Message): Promise<void> {
        switch (message.type) {
            case MessageType.BUDGET_CHECK_REQUEST:
                await this.handleBudgetCheck(message);
                break;
            default:
                // Ignore other message types
                break;
        }
    }

    /**
     * Handle budget check requests
     */
    private async handleBudgetCheck(message: Message): Promise<void> {
        const request = message.payload as BudgetCheckRequest;
        const amount = ethers.parseEther(request.amount);

        this.log(`Budget check request from ${message.from}: ${request.amount} MNEE for ${request.purpose}`);

        // Get current balance
        const currentBalance = await this.getMNEEBalance(this.mneeTokenAddress);

        // Check various limits
        const checks = {
            sufficientBalance: currentBalance >= amount,
            withinPerTaskLimit: amount <= this.limits.perTaskLimit,
            withinDailyLimit: this.getDailySpending() + amount <= this.limits.dailyLimit,
            withinTotalBudget: this.getTotalSpending() + amount <= this.limits.totalBudget
        };

        const approved = Object.values(checks).every(check => check);

        let reason: string | undefined;
        if (!approved) {
            const reasons: string[] = [];
            if (!checks.sufficientBalance) reasons.push('Insufficient balance');
            if (!checks.withinPerTaskLimit) reasons.push(`Exceeds per-task limit (${ethers.formatEther(this.limits.perTaskLimit)} MNEE)`);
            if (!checks.withinDailyLimit) reasons.push(`Exceeds daily limit (${ethers.formatEther(this.limits.dailyLimit)} MNEE)`);
            if (!checks.withinTotalBudget) reasons.push(`Exceeds total budget (${ethers.formatEther(this.limits.totalBudget)} MNEE)`);
            reason = reasons.join('; ');
        }

        // Record spending if approved
        if (approved) {
            this.spendingHistory.push({
                amount,
                timestamp: Date.now(),
                purpose: request.purpose
            });
        }

        // Send response
        const approval: BudgetApproval = {
            approved,
            remainingBalance: ethers.formatEther(currentBalance - (approved ? amount : 0n)),
            reason
        };

        this.sendMessage(
            message.from,
            approved ? MessageType.BUDGET_APPROVED : MessageType.BUDGET_REJECTED,
            approval
        );

        this.log(`Budget check ${approved ? 'APPROVED' : 'REJECTED'} - ${reason || 'All checks passed'}`, approved ? 'info' : 'warn');
    }

    /**
     * Get total spending across all time
     */
    private getTotalSpending(): bigint {
        return this.spendingHistory.reduce((sum, record) => sum + record.amount, 0n);
    }

    /**
     * Get spending in the last 24 hours
     */
    private getDailySpending(): bigint {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return this.spendingHistory
            .filter(record => record.timestamp >= oneDayAgo)
            .reduce((sum, record) => sum + record.amount, 0n);
    }

    /**
     * Get budget status
     */
    async getBudgetStatus(): Promise<{
        currentBalance: string;
        totalSpent: string;
        dailySpent: string;
        limits: {
            total: string;
            daily: string;
            perTask: string;
        };
    }> {
        const balance = await this.getMNEEBalance(this.mneeTokenAddress);
        return {
            currentBalance: ethers.formatEther(balance),
            totalSpent: ethers.formatEther(this.getTotalSpending()),
            dailySpent: ethers.formatEther(this.getDailySpending()),
            limits: {
                total: ethers.formatEther(this.limits.totalBudget),
                daily: ethers.formatEther(this.limits.dailyLimit),
                perTask: ethers.formatEther(this.limits.perTaskLimit)
            }
        };
    }
}
