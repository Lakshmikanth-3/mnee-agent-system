import { ethers } from 'ethers';
import { messageBus } from '../communication/MessageBus';
import { Message, MessageType, AgentStatus } from '../communication/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * BaseAgent - Abstract base class for all agents
 */
export abstract class BaseAgent {
    protected name: string;
    protected wallet: ethers.Wallet;
    protected provider: ethers.Provider;
    protected status: 'active' | 'busy' | 'idle' = 'idle';
    protected activeTasks: Set<string> = new Set();
    protected completedTasks: number = 0;

    constructor(name: string, privateKey: string, rpcUrl: string) {
        this.name = name;
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);

        // Register with message bus
        messageBus.registerAgent(this.name);

        // Subscribe to messages
        messageBus.subscribe(this.name, this.handleMessage.bind(this));

        console.log(`[${this.name}] Initialized with address: ${this.wallet.address}`);
    }

    /**
     * Get agent's Ethereum address
     */
    getAddress(): string {
        return this.wallet.address;
    }

    /**
     * Get agent's current status
     */
    async getStatus(): Promise<AgentStatus> {
        const balance = await this.getBalance();
        return {
            agentName: this.name,
            balance: ethers.formatEther(balance),
            activeTasks: this.activeTasks.size,
            totalTasksCompleted: this.completedTasks,
            status: this.status
        };
    }

    /**
     * Get ETH balance
     */
    async getBalance(): Promise<bigint> {
        return await this.provider.getBalance(this.wallet.address);
    }

    /**
     * Get MNEE token balance
     */
    async getMNEEBalance(tokenAddress: string): Promise<bigint> {
        const tokenAbi = [
            'function balanceOf(address owner) view returns (uint256)'
        ];
        const token = new ethers.Contract(tokenAddress, tokenAbi, this.wallet);
        return await token.balanceOf(this.wallet.address);
    }

    /**
     * Send a message to another agent
     */
    protected sendMessage(to: string, type: MessageType, payload: any): void {
        const message: Message = {
            id: uuidv4(),
            type,
            from: this.name,
            to,
            timestamp: Date.now(),
            payload
        };
        messageBus.sendMessage(message);
    }

    /**
     * Broadcast a message to all agents
     */
    protected broadcast(type: MessageType, payload: any): void {
        const message = {
            id: uuidv4(),
            type,
            from: this.name,
            timestamp: Date.now(),
            payload
        };
        messageBus.broadcast(message);
    }

    /**
     * Handle incoming messages - must be implemented by subclasses
     */
    protected abstract handleMessage(message: Message): Promise<void>;

    /**
     * Log activity
     */
    protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${this.name}]`;

        switch (level) {
            case 'info':
                console.log(`${prefix} ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix} ${message}`);
                break;
            case 'error':
                console.error(`${prefix} ${message}`);
                break;
        }
    }

    /**
     * Cleanup on shutdown
     */
    shutdown(): void {
        messageBus.unregisterAgent(this.name);
        this.log('Agent shutdown');
    }
}
